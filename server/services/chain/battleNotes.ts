/**
 * server/services/chain/battleNotes.ts
 *
 * FRONTIER Battle Note Encoder
 *
 * Every FRONTIER ASA claim that results from a battle (pillage payout,
 * reconquest reward, raid bounty) is signed with a structured note that
 * embeds the faction identity ASA IDs involved. This makes FRONTIER battles
 * verifiably traceable on the Algorand blockchain:
 *
 *   - Which human player was involved (their wallet address)
 *   - Which AI faction was the opponent (faction assetId on-chain)
 *   - The battle outcome
 *   - Plot ID and biome
 *
 * Anyone can query the Algorand indexer for all transactions with this note
 * format to reconstruct the full battle history without trusting FRONTIER's
 * own database.
 *
 * Note format (prefix: "FRNTR:"):
 * {
 *   "game":        "FRONTIER",
 *   "v":           2,
 *   "type":        "battle_reward" | "reconquest_loss" | "raid_bounty",
 *   "plotId":      42,
 *   "biome":       "mountain",
 *   "outcome":     "attacker_wins" | "defender_wins",
 *   "humanAddr":   "ALGO...",
 *   "factionName": "NEXUS-7",
 *   "factionAsaId": 12345678,     ← on-chain faction identity reference
 *   "amt":         50.5,          ← FRONTIER tokens transferred
 *   "network":     "testnet",
 *   "ts":          1710000000000
 * }
 */

import { getFactionAsaId } from "./factions.js";
import { getNetwork }      from "./client.js";

export type BattleNoteType = "battle_reward" | "reconquest_loss" | "raid_bounty";

export interface BattleNoteParams {
  type:        BattleNoteType;
  plotId:      number;
  biome:       string;
  outcome:     "attacker_wins" | "defender_wins";
  humanAddr:   string;
  factionName: string;       // AI faction name — used to resolve assetId
  amount:      number;       // FRONTIER tokens in this transfer
}

/**
 * Build the Uint8Array note to embed in an Algorand transaction.
 * Includes the faction's on-chain assetId if it has been minted.
 */
export function buildBattleNote(params: BattleNoteParams): Uint8Array {
  const factionAsaId = getFactionAsaId(params.factionName);
  const network      = getNetwork();

  const payload = {
    game:         "FRONTIER",
    v:            2,
    type:         params.type,
    plotId:       params.plotId,
    biome:        params.biome,
    outcome:      params.outcome,
    humanAddr:    params.humanAddr,
    factionName:  params.factionName,
    factionAsaId: factionAsaId ?? null,   // null if faction not yet minted
    amt:          params.amount,
    network,
    ts:           Date.now(),
  };

  return new TextEncoder().encode(`FRNTR:${JSON.stringify(payload)}`);
}

/**
 * Parse a raw Algorand transaction note back into a battle note.
 * Returns null if the note is not a FRONTIER battle note.
 */
export function parseBattleNote(noteBytes: Uint8Array): ReturnType<typeof JSON.parse> | null {
  try {
    const raw = new TextDecoder().decode(noteBytes);
    if (!raw.startsWith("FRNTR:")) return null;
    const parsed = JSON.parse(raw.slice(6));
    if (parsed?.v !== 2 || !parsed?.type?.startsWith("battle")) return null;
    return parsed;
  } catch {
    return null;
  }
}
