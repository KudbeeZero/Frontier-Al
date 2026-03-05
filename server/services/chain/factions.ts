/**
 * server/services/chain/factions.ts
 *
 * FRONTIER AI Faction Identity ASAs
 *
 * Each of the four AI factions (NEXUS-7, KRONOS, VANGUARD, SPECTRE) gets a
 * single Algorand Standard Asset minted once at world initialisation. This
 * ASA serves as the faction's permanent, verifiable on-chain identity.
 *
 * Properties of each faction identity ASA:
 *   total      = 1,000,000  (divisible — humans can hold fractional "faction shares")
 *   decimals   = 0          (whole units only)
 *   unitName   = faction abbreviation (NXUS / KRNOS / VNGRD / SPCT)
 *   assetName  = full faction name ("NEXUS-7 Faction", etc.)
 *   manager    = admin wallet (allows future metadata URL updates)
 *   freeze     = undefined (no freeze — faction shares are freely tradable)
 *   clawback   = undefined (no clawback — true ownership)
 *   url        = /faction/<name> metadata endpoint
 *
 * GUARDRAIL: Like the FRONTIER ASA, faction ASAs are NEVER re-minted if they
 * already exist on-chain. Idempotent — safe to call on every server restart.
 *
 * Future use cases this design enables:
 *   - Players hold faction tokens to earn yield bonuses on AI-adjacent territory
 *   - Battle transaction notes reference faction assetId for chain-verifiable logs
 *   - Faction token holders vote on AI behavior tuning parameters
 *   - Secondary market for faction shares on Algorand DEXes
 */

import algosdk from "algosdk";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { aiFactionIdentities } from "../../db-schema";
import { getAlgodClient, getAdminAccount, getNetwork } from "./client";
import type { AssetId } from "./types";

// ── Faction Definitions ───────────────────────────────────────────────────────

export interface FactionDefinition {
  name:       string;  // canonical name — primary key in DB and AI logic
  unitName:   string;  // max 8 chars, Algorand unit name
  assetName:  string;  // full display name on explorers
  behavior:   string;  // "expansionist" | "defensive" | "raider" | "economic"
  lore:       string;  // short description baked into on-chain note
  totalSupply: number; // how many identity tokens exist
}

export const FACTION_DEFINITIONS: FactionDefinition[] = [
  {
    name:        "NEXUS-7",
    unitName:    "NXUS",
    assetName:   "NEXUS-7 Faction",
    behavior:    "expansionist",
    lore:        "The relentless expander. NEXUS-7 claims territory aggressively across the Frontier globe.",
    totalSupply: 1_000_000,
  },
  {
    name:        "KRONOS",
    unitName:    "KRNOS",
    assetName:   "KRONOS Faction",
    behavior:    "defensive",
    lore:        "The patient fortress-builder. KRONOS waits, fortifies, then strikes with overwhelming force.",
    totalSupply: 1_000_000,
  },
  {
    name:        "VANGUARD",
    unitName:    "VNGRD",
    assetName:   "VANGUARD Faction",
    behavior:    "raider",
    lore:        "The chaos agent. VANGUARD raids, pillages, and withdraws — never settling, always destabilising.",
    totalSupply: 1_000_000,
  },
  {
    name:        "SPECTRE",
    unitName:    "SPCT",
    assetName:   "SPECTRE Faction",
    behavior:    "economic",
    lore:        "The precision economist. SPECTRE targets only the richest plots and optimises yield above all.",
    totalSupply: 1_000_000,
  },
];

// ── In-memory cache: factionName → assetId ───────────────────────────────────

const _factionAsaIds = new Map<string, AssetId>();

export function getFactionAsaId(factionName: string): AssetId | null {
  return _factionAsaIds.get(factionName) ?? null;
}

export function getAllFactionAsaIds(): Record<string, AssetId | null> {
  return Object.fromEntries(
    FACTION_DEFINITIONS.map((f) => [f.name, _factionAsaIds.get(f.name) ?? null])
  );
}

// ── Core: mint one faction identity ASA ──────────────────────────────────────

async function mintFactionIdentityAsa(
  faction:    FactionDefinition,
  baseUrl:    string,
): Promise<{ assetId: AssetId; txId: string }> {
  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const network = getNetwork();
  const sp      = await algod.getTransactionParams().do();

  const notePayload = JSON.stringify({
    game:     "FRONTIER",
    v:        1,
    type:     "faction_identity",
    faction:  faction.name,
    behavior: faction.behavior,
    lore:     faction.lore,
    network,
    ts:       Date.now(),
  });

  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender:          account.addr.toString(),
    total:           BigInt(faction.totalSupply),
    decimals:        0,
    defaultFrozen:   false,
    unitName:        faction.unitName,
    assetName:       faction.assetName,
    assetURL:        `${baseUrl}/faction/${encodeURIComponent(faction.name)}`,
    // Manager kept so metadata URL can be updated if the deployment URL changes.
    // No freeze or clawback — faction shares are freely tradable.
    manager:         account.addr.toString(),
    reserve:         account.addr.toString(),
    freeze:          undefined,
    clawback:        undefined,
    suggestedParams: sp,
    note:            new TextEncoder().encode(`FRONTIER:${notePayload}`),
  });

  const signed   = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signed).do();
  const txId     = response.txid || txn.txID();

  const confirmed = await algosdk.waitForConfirmation(algod, txId, 4);
  const assetId   = Number(
    (confirmed as any).assetIndex ?? (confirmed as any)["asset-index"]
  );

  if (!assetId) {
    throw new Error(
      `[chain/factions] mintFactionIdentityAsa: no assetIndex for faction="${faction.name}" tx=${txId}`
    );
  }

  console.log(`[chain/factions] Minted ${faction.assetName} identity ASA: assetId=${assetId} txId=${txId}`);
  return { assetId, txId };
}

// ── Public: idempotent bootstrap for all four factions ───────────────────────

/**
 * Ensure all four faction identity ASAs exist on-chain and are recorded in DB.
 * Safe to call on every server restart — re-mints nothing if records exist.
 *
 * Called once during blockchain initialisation, after the FRONTIER ASA is ready.
 *
 * @param baseUrl  PUBLIC_BASE_URL — baked into on-chain assetURL permanently.
 */
export async function bootstrapFactionIdentities(baseUrl: string): Promise<void> {
  if (!db) {
    console.warn("[chain/factions] No DB available — skipping faction identity bootstrap");
    return;
  }

  console.log("[chain/factions] Bootstrapping faction identity ASAs...");

  for (const faction of FACTION_DEFINITIONS) {
    try {
      // 1. Check DB first (fastest path — avoids on-chain lookup on restarts)
      const [existing] = await db
        .select()
        .from(aiFactionIdentities)
        .where(eq(aiFactionIdentities.factionName, faction.name));

      if (existing?.assetId) {
        _factionAsaIds.set(faction.name, Number(existing.assetId));
        console.log(
          `[chain/factions] ${faction.name} already minted: assetId=${existing.assetId}`
        );
        continue;
      }

      // 2. Not in DB — check if admin account already has this ASA on-chain
      //    (handles the case where DB was wiped but chain wasn't)
      const algod       = getAlgodClient();
      const account     = getAdminAccount();
      const accountInfo = await algod.accountInformation(account.addr.toString()).do();
      const created: any[] = (accountInfo as any)["created-assets"] ??
                             (accountInfo as any).createdAssets ?? [];

      const onChain = created.find((a: any) => {
        const p = a.params ?? a;
        return (p["unit-name"] ?? p.unitName) === faction.unitName;
      });

      if (onChain) {
        const assetId = Number(onChain.index ?? onChain["asset-id"] ?? onChain.assetIndex);
        _factionAsaIds.set(faction.name, assetId);
        const mintedAt   = Date.now();
        const explorerUrl = `https://allo.info/asset/${assetId}`;

        await db
          .insert(aiFactionIdentities)
          .values({ factionName: faction.name, assetId, mintedAt, explorerUrl })
          .onConflictDoUpdate({
            target: aiFactionIdentities.factionName,
            set:    { assetId, mintedAt, explorerUrl },
          });

        console.log(`[chain/factions] ${faction.name} recovered from chain: assetId=${assetId}`);
        continue;
      }

      // 3. Truly new — mint it
      console.log(`[chain/factions] Minting new identity ASA for ${faction.name}...`);
      const { assetId, txId } = await mintFactionIdentityAsa(faction, baseUrl);
      _factionAsaIds.set(faction.name, assetId);

      const mintedAt    = Date.now();
      const explorerUrl = `https://allo.info/asset/${assetId}`;

      await db
        .insert(aiFactionIdentities)
        .values({ factionName: faction.name, assetId, mintTxId: txId, mintedAt, explorerUrl })
        .onConflictDoUpdate({
          target: aiFactionIdentities.factionName,
          set:    { assetId, mintTxId: txId, mintedAt, explorerUrl },
        });

    } catch (err) {
      // Non-fatal: game runs without on-chain faction identities,
      // but log clearly so the operator knows to investigate.
      console.error(
        `[chain/factions] Failed to bootstrap faction "${faction.name}":`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const minted = [..._factionAsaIds.entries()]
    .map(([name, id]) => `${name}=${id}`)
    .join(", ");
  console.log(`[chain/factions] Faction identity bootstrap complete: ${minted}`);
}
