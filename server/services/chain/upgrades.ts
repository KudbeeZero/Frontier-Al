/**
 * server/services/chain/upgrades.ts
 *
 * Fire-and-forget Algorand note-recording for sub-parcel upgrade events.
 * Uses a zero-value self-transfer (admin → admin) with a JSON note payload.
 * Non-blocking — game state never depends on this call succeeding.
 */

import algosdk from "algosdk";
import { getAlgodClient, getAdminAccount } from "./client";

export interface UpgradeNoteParams {
  plotId: number;
  subIndex: number;
  biome: string;
  improvementType: string;
  level: number;
  playerId: string;
}

/**
 * Records a sub-parcel upgrade event on-chain as an admin self-transfer
 * with a JSON note containing the upgrade metadata.
 *
 * Throws if Algorand credentials are not configured — callers should
 * wrap in a try/catch or use .catch(() => {}) for fire-and-forget use.
 */
export async function recordUpgradeOnChain(params: UpgradeNoteParams): Promise<string> {
  const algod  = getAlgodClient();
  const admin  = getAdminAccount();
  const sp     = await algod.getTransactionParams().do();

  const noteStr = JSON.stringify({
    frontier: "sub_parcel_upgrade",
    ...params,
    ts: Date.now(),
  });
  const note = new TextEncoder().encode(noteStr);

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender:          admin.addr,
    receiver:        admin.addr,
    amount:          0,
    note,
    suggestedParams: sp,
  });

  const signed       = txn.signTxn(admin.sk);
  const { txid }     = await algod.sendRawTransaction(signed).do();
  console.log(`[chain/upgrades] upgrade recorded txid=${txid} plot=${params.plotId} sub=${params.subIndex} type=${params.improvementType} lv=${params.level}`);
  return txid;
}
