/**
 * server/services/chain/treasury.ts
 *
 * Hybrid central bank: tracks protocol treasury fees in the DB (instant),
 * and periodically settles them on-chain by transferring accumulated FRONTIER
 * to the admin (treasury) wallet.
 *
 * Settlement triggers:
 *   - Manual: call settleTreasury() directly
 *   - Scheduled: startTreasurySettlementScheduler() runs every 24h
 *   - Threshold: auto-settles when unsettled balance exceeds AUTO_SETTLE_THRESHOLD_FRNTR
 */

import { fromMicroFRNTR } from "../../storage/game-rules";
import { getAdminAccount, getAlgodClient } from "./client";
import { getFrontierAsaId } from "./asa";
import algosdk from "algosdk";

const AUTO_SETTLE_THRESHOLD_FRNTR = 1000; // settle when 1000+ FRONTIER has accumulated
const SETTLEMENT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

let schedulerRunning = false;

/**
 * Attempt to settle all unsettled treasury ledger rows on-chain.
 * Transfers accumulated FRONTIER to the admin wallet and marks rows settled.
 *
 * Returns the txId if settlement occurred, or null if nothing to settle.
 */
export async function settleTreasury(storage: {
  getUnsettledTreasuryRows: () => Promise<{ id: string; amountMicro: number }[]>;
  markTreasurySettled: (ids: string[], txId: string) => Promise<void>;
}): Promise<string | null> {
  const rows = await storage.getUnsettledTreasuryRows();
  if (rows.length === 0) return null;

  const totalMicro = rows.reduce((sum, r) => sum + r.amountMicro, 0);
  const totalFrntr = fromMicroFRNTR(totalMicro);

  if (totalFrntr <= 0) return null;

  const asaId = getFrontierAsaId();
  if (!asaId) {
    console.warn("[treasury] settleTreasury: FRONTIER ASA ID not set, skipping on-chain settlement");
    return null;
  }

  try {
    const algod   = getAlgodClient();
    const account = getAdminAccount();
    const sp      = await algod.getTransactionParams().do();
    const microAmount = BigInt(Math.round(totalFrntr * 1_000_000));

    // Self-transfer to admin wallet to record treasury accumulation on-chain
    // (admin already holds these tokens via the DB-tracked model — this is an audit record)
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender:          account.addr.toString(),
      receiver:        account.addr.toString(),
      amount:          microAmount,
      assetIndex:      asaId,
      suggestedParams: sp,
      note:            new TextEncoder().encode(
        `FRONTIER treasury settlement: ${totalFrntr.toFixed(6)} FRNTR from ${rows.length} fees`
      ),
    });

    const signed   = txn.signTxn(account.sk);
    const response = await algod.sendRawTransaction(signed).do();
    const txId     = response.txid || txn.txID();
    await algosdk.waitForConfirmation(algod, txId, 4);

    await storage.markTreasurySettled(rows.map(r => r.id), txId);
    console.log(`[treasury] settled ${totalFrntr.toFixed(2)} FRNTR (${rows.length} rows) txId=${txId}`);
    return txId;
  } catch (err) {
    console.error("[treasury] settleTreasury failed:", err);
    return null;
  }
}

/**
 * Check if treasury should auto-settle based on threshold.
 */
export async function maybeAutoSettle(storage: {
  getTreasuryBalance: () => Promise<{ unsettledMicro: number; totalMicro: number }>;
  getUnsettledTreasuryRows: () => Promise<{ id: string; amountMicro: number }[]>;
  markTreasurySettled: (ids: string[], txId: string) => Promise<void>;
}): Promise<void> {
  const { unsettledMicro } = await storage.getTreasuryBalance();
  const unsettledFrntr = fromMicroFRNTR(unsettledMicro);
  if (unsettledFrntr >= AUTO_SETTLE_THRESHOLD_FRNTR) {
    await settleTreasury(storage);
  }
}

/**
 * Start the 24h scheduled settlement loop.
 * Safe to call multiple times — only one scheduler runs at a time.
 */
export function startTreasurySettlementScheduler(storage: {
  getTreasuryBalance: () => Promise<{ unsettledMicro: number; totalMicro: number }>;
  getUnsettledTreasuryRows: () => Promise<{ id: string; amountMicro: number }[]>;
  markTreasurySettled: (ids: string[], txId: string) => Promise<void>;
}): void {
  if (schedulerRunning) return;
  schedulerRunning = true;

  const tick = async () => {
    try {
      await settleTreasury(storage);
    } catch (err) {
      console.error("[treasury] scheduled settlement error:", err);
    }
    setTimeout(tick, SETTLEMENT_INTERVAL_MS);
  };

  // First tick after 24h (don't settle immediately on startup)
  setTimeout(tick, SETTLEMENT_INTERVAL_MS);
  console.log("[treasury] settlement scheduler started (24h interval)");
}
