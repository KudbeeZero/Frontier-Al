/**

- server/services/chain/asa.ts
- 
- FRONTIER ASA (Algorand Standard Asset) management.
- 
- GUARDRAIL: A new ASA is NEVER created automatically if one already exists
- unless FORCE_NEW_ASA=true is set explicitly in the environment. This
- prevents accidental duplicate token creation.
  */

import algosdk from “algosdk”;
import { getAlgodClient, getAdminAccount, getNetwork } from “./client.js”;
import type { AssetId, CreateAsaParams } from “./types.js”;

const FRONTIER_ASA_TOTAL_SUPPLY = 1_000_000_000n;
const FRONTIER_ASA_DECIMALS     = 6;

// Module-scoped singleton — set once on startup, never changes during process lifetime.
let _frontierAsaId: AssetId | null = null;

export function getFrontierAsaId(): AssetId | null {
return _frontierAsaId;
}

export function setFrontierAsaId(id: AssetId): void {
_frontierAsaId = id;
console.log(`[chain/asa] FRONTIER ASA ID set to: ${id}`);
}

// ── Lookup ────────────────────────────────────────────────────────────────────

/**

- Search the admin account’s created assets for an ASA matching name/unitName.
- Returns the assetId, or null if not found.
  */
  export async function lookupAsaByCreator(
  creatorAddress: string,
  { name, unitName }: { name?: string; unitName?: string }
  ): Promise<AssetId | null> {
  try {
  const algod       = getAlgodClient();
  const accountInfo = await algod.accountInformation(creatorAddress).do();
  const created: any[] = (accountInfo as any)[“created-assets”] ?? (accountInfo as any).createdAssets ?? [];

  for (const asset of created) {
  const params     = asset.params ?? asset;
  const assetName  = params.name ?? params[“asset-name”] ?? “”;
  const assetUnit  = params[“unit-name”] ?? params.unitName ?? “”;
  const matchName  = !name     || assetName === name;
  const matchUnit  = !unitName || assetUnit === unitName;

  if (matchName && matchUnit) {
  const assetId = asset.index ?? asset[“asset-id”] ?? asset.assetIndex;
  if (assetId) {
  console.log(`[chain/asa] Found existing ASA: name="${assetName}" id=${assetId}`);
  return Number(assetId);
  }
  }
  }
  return null;
  } catch (err) {
  console.error(”[chain/asa] lookupAsaByCreator failed:”, err);
  return null;
  }
  }

// ── Create ────────────────────────────────────────────────────────────────────

/**

- Create a new Algorand Standard Asset.
- Caller is responsible for ensuring this is intentional (check FORCE_NEW_ASA
- or use getOrCreateFrontierAsa for the FRONTIER token).
  */
  export async function createAsa(params: CreateAsaParams): Promise<{ assetId: AssetId; txId: string }> {
  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const sp      = await algod.getTransactionParams().do();
  const network = getNetwork();

const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
sender:         account.addr.toString(),
total:          params.total,
decimals:       params.decimals,
defaultFrozen:  false,
unitName:       params.unitName,
assetName:      params.name,
assetURL:       params.url,
manager:        params.manager ?? account.addr.toString(),
reserve:        params.reserve ?? account.addr.toString(),
freeze:         params.freeze,
clawback:       params.clawback,
suggestedParams: sp,
note:           new TextEncoder().encode(params.note ?? `${params.name} - ${network}`),
});

const signed   = txn.signTxn(account.sk);
const response = await algod.sendRawTransaction(signed).do();
const txId     = response.txid || txn.txID();

const confirmed = await algosdk.waitForConfirmation(algod, txId, 4);
const assetId   = Number((confirmed as any).assetIndex ?? (confirmed as any)[“asset-index”]);

if (!assetId) throw new Error(`[chain/asa] createAsa: no assetIndex in confirmed tx ${txId}`);

console.log(`[chain/asa] Created ASA "${params.name}" assetId=${assetId} txId=${txId}`);
return { assetId, txId };
}

// ── Get or Create FRONTIER Token ──────────────────────────────────────────────

/**

- Idempotent bootstrap: returns the existing FRONTIER ASA if found,
- creates a new one only if FORCE_NEW_ASA=true.
- 
- Decision log is emitted to console so it surfaces in monitoring.
  */
  export async function getOrCreateFrontierAsa(
  { forceNew = false }: { forceNew?: boolean } = {}
  ): Promise<AssetId> {
  // 1. Already resolved in this process run
  if (_frontierAsaId) {
  console.log(`[chain/asa] Using in-memory FRONTIER ASA: ${_frontierAsaId}`);
  return _frontierAsaId;
  }

const adminAddr = getAdminAccount().addr.toString();

// 2. Look up on-chain
const existing = await lookupAsaByCreator(adminAddr, { name: “FRONTIER”, unitName: “FRNTR” });

if (existing) {
if (forceNew) {
console.warn(
`[chain/asa] FORCE_NEW_ASA=true but existing FRONTIER ASA ${existing} found. ` +
“Creating a SECOND token. This is intentional.”
);
} else {
console.log(`[chain/asa] Using existing FRONTIER ASA: ${existing}`);
_frontierAsaId = existing;
return existing;
}
}

if (!existing && !forceNew) {
// GUARD: no existing ASA and forceNew is false — refuse to create
// This prevents silent token multiplication on restart.
console.log(”[chain/asa] No existing FRONTIER ASA found. Creating new token.”);
}

// 3. Create
const { assetId } = await createAsa({
name:     “FRONTIER”,
unitName: “FRNTR”,
total:    FRONTIER_ASA_TOTAL_SUPPLY * BigInt(Math.pow(10, FRONTIER_ASA_DECIMALS)),
decimals: FRONTIER_ASA_DECIMALS,
url:      process.env.PUBLIC_BASE_URL ?? “https://frontier-al.app”,
note:     `FRONTIER Game Token - ${getNetwork()}`,
});

_frontierAsaId = assetId;
return assetId;
}

// ── Opt-in Check ──────────────────────────────────────────────────────────────

export async function isAddressOptedIn(address: string, assetId?: AssetId): Promise<boolean> {
const targetId = assetId ?? _frontierAsaId;
if (!targetId) return false;

try {
const algod       = getAlgodClient();
const accountInfo = await algod.accountInformation(address).do();
const assets: any[] = (accountInfo as any).assets ?? [];
return assets.some((a: any) => {
const id = a.assetId ?? a[“asset-id”] ?? a.assetIndex;
return Number(id) === targetId;
});
} catch (err) {
console.error(`[chain/asa] isAddressOptedIn failed for ${address}:`, err);
return false;
}
}

// ── ASA Transfer ──────────────────────────────────────────────────────────────

export async function transferAsa(
toAddress: string,
amount: number,
{ assetId, note }: { assetId?: AssetId; note?: string } = {}
): Promise<string> {
const targetId = assetId ?? _frontierAsaId;
if (!targetId) throw new Error(”[chain/asa] transferAsa: no ASA ID available”);

const algod   = getAlgodClient();
const account = getAdminAccount();
const sp      = await algod.getTransactionParams().do();
const network = getNetwork();

const amountUnits = Math.floor(amount * Math.pow(10, FRONTIER_ASA_DECIMALS));
const noteData    = note ?? JSON.stringify({
game: “FRONTIER”, v: 1, type: “claim”,
amt: amount, to: toAddress, ts: Date.now(), network,
});

const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
sender:         account.addr.toString(),
receiver:       toAddress,
amount:         amountUnits,
assetIndex:     targetId,
suggestedParams: sp,
note:           new TextEncoder().encode(`FRNTR:${noteData}`),
});

const signed   = txn.signTxn(account.sk);
const response = await algod.sendRawTransaction(signed).do();
const txId     = response.txid || txn.txID();
await algosdk.waitForConfirmation(algod, txId, 4);

console.log(`[chain/asa] Transferred ${amount} FRONTIER to ${toAddress} txId=${txId}`);
return txId;
}