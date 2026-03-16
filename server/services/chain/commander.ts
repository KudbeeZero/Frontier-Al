/**
 * server/services/chain/commander.ts
 *
 * FRONTIER Commander NFT (ASA) mint and transfer service.
 *
 * Mirrors land.ts pattern exactly. Custodian model: NFT is held by admin
 * after minting; buyer calls POST /api/nft/deliver-commander/:commanderId
 * after opting in to receive it.
 *
 * On mainnet: freeze/clawback are unset → freely tradeable on secondary markets.
 *
 * No UI imports. No route logic. No game state.
 */

import algosdk from "algosdk";
import { getAlgodClient, getAdminAccount, getNetwork, getIndexerClient } from "./client";
import { isAddressOptedIn } from "./asa";
import type { AssetId, MintResult } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MintCommanderParams {
  commanderId:     string; // UUID from CommanderAvatar.id
  tier:            "sentinel" | "phantom" | "reaper";
  receiverAddress: string; // buyer's Algorand wallet (held in custody until opt-in)
  metadataBaseUrl: string; // PUBLIC_BASE_URL — baked permanently into on-chain ASA
}

export interface TransferCommanderParams {
  assetId:   AssetId;
  toAddress: string;
  note?:     string;
}

// ── Mint ──────────────────────────────────────────────────────────────────────

/**
 * Mint a FRONTIER Commander NFT (1-of-1 Algorand ASA).
 *
 * NFT is held in admin custody after creation — buyer opts in then calls deliver.
 * Idempotency: caller must check the DB before calling this function.
 */
export async function mintCommanderNft(params: MintCommanderParams): Promise<MintResult> {
  const { commanderId, tier, receiverAddress, metadataBaseUrl } = params;
  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const network = getNetwork();

  const baseUrl = metadataBaseUrl.replace(/\/+$/, "");
  const shortId = commanderId.slice(0, 8);

  const createSp = await algod.getTransactionParams().do();

  const createTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender:         account.addr.toString(),
    total:          BigInt(1),
    decimals:       0,
    defaultFrozen:  false,
    unitName:       "CMDR",
    assetName:      `Frontier Commander - ${tier} #${shortId}`,
    assetURL:       `${baseUrl}/nft/metadata/commander/${commanderId}`,
    manager:        account.addr.toString(),
    reserve:        account.addr.toString(),
    // Mainnet: no freeze/clawback → freely tradeable on secondary markets.
    // Testnet: keep all roles for recovery during development.
    freeze:         network === "mainnet" ? undefined : account.addr.toString(),
    clawback:       network === "mainnet" ? undefined : account.addr.toString(),
    suggestedParams: createSp,
    note:           new TextEncoder().encode(`FRONTIER Commander NFT ${tier} #${shortId} - ${network}`),
  });

  const signedCreate   = createTxn.signTxn(account.sk);
  const createResponse = await algod.sendRawTransaction(signedCreate).do();
  const createTxId     = createResponse.txid || createTxn.txID();

  const confirmedCreate = await algosdk.waitForConfirmation(algod, createTxId, 2);
  const assetId: AssetId = Number(
    (confirmedCreate as any).assetIndex ?? (confirmedCreate as any)["asset-index"]
  );

  if (!assetId) {
    throw new Error(
      `[chain/commander] mintCommanderNft: no assetIndex in confirmed create tx ${createTxId} for commanderId=${commanderId}`
    );
  }

  console.log(
    `[chain/commander] commanderId=${commanderId} tier=${tier} ASA created assetId=${assetId} txId=${createTxId}` +
    ` | custody: admin holds until buyer opts in (receiverAddress=${receiverAddress})`
  );

  return {
    assetId,
    createTxId,
    transferTxId:    undefined,
    custodyHeld:     true,
    mintedToAddress: account.addr.toString(),
  };
}

// ── Transfer ──────────────────────────────────────────────────────────────────

/**
 * Transfer an already-minted Commander NFT from admin to a receiver.
 * Caller must verify the receiver has opted into the ASA before calling this.
 */
export async function transferCommanderNft(params: TransferCommanderParams): Promise<{ txId: string }> {
  const { assetId, toAddress, note } = params;
  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const sp      = await algod.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender:          account.addr.toString(),
    receiver:        toAddress,
    amount:          1,
    assetIndex:      assetId,
    suggestedParams: sp,
    note:            new TextEncoder().encode(note ?? `FRONTIER Commander NFT transfer to ${toAddress}`),
  });

  const signed   = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signed).do();
  const txId     = response.txid || txn.txID();

  await algosdk.waitForConfirmation(algod, txId, 2);

  console.log(`[chain/commander] Transferred assetId=${assetId} to ${toAddress} txId=${txId}`);
  return { txId };
}

// ── Liquidity Split ───────────────────────────────────────────────────────────

/**
 * Forward `microAlgo` to the LIQUIDITY_WALLET (env var).
 * Fire-and-forget — caller should not await or block on this.
 */
export async function forwardLiquiditySplit(microAlgo: number, note: string): Promise<void> {
  const liquidityWallet = process.env.LIQUIDITY_WALLET;
  if (!liquidityWallet || !algosdk.isValidAddress(liquidityWallet)) {
    console.warn("[chain/commander] LIQUIDITY_WALLET not set or invalid — skipping liquidity split");
    return;
  }

  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const sp      = await algod.getTransactionParams().do();

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender:          account.addr.toString(),
    receiver:        liquidityWallet,
    amount:          BigInt(microAlgo),
    suggestedParams: sp,
    note:            new TextEncoder().encode(note),
  });

  const signed   = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signed).do();
  const txId     = response.txid || txn.txID();

  await algosdk.waitForConfirmation(algod, txId, 2);
  console.log(`[chain/commander] Liquidity split ${microAlgo} microAlgo → ${liquidityWallet} txId=${txId}`);
}

// ── Payment Verification ──────────────────────────────────────────────────────

/**
 * Verify an ALGO payment transaction via the Algorand Indexer.
 * Returns the amount (in microAlgo) if valid, throws otherwise.
 *
 * Checks:
 *  - txn is confirmed on-chain
 *  - sender matches expectedSender
 *  - receiver matches admin wallet
 *  - amount >= minMicroAlgo
 */
export async function verifyAlgoPayment(params: {
  txId:            string;
  expectedSender:  string;
  minMicroAlgo:    number;
}): Promise<{ amountMicroAlgo: number }> {
  const { txId, expectedSender, minMicroAlgo } = params;
  const indexer   = getIndexerClient();
  const adminAddr = (await import("./client")).getAdminAddress();

  let txnInfo: any;
  try {
    txnInfo = await indexer.lookupTransactionByID(txId).do();
  } catch (err) {
    throw new Error(`[chain/commander] Payment txn not found on indexer: ${txId}`);
  }

  const txn = txnInfo.transaction ?? txnInfo;
  if (!txn) throw new Error(`[chain/commander] Empty txn response for txId=${txId}`);

  // Confirmed check: confirmed-round must be set and > 0
  const confirmedRound = txn["confirmed-round"] ?? txn.confirmedRound ?? 0;
  if (!confirmedRound || confirmedRound === 0) {
    throw new Error(`[chain/commander] Payment txn ${txId} is not yet confirmed on-chain`);
  }

  // Type must be pay
  if (txn["tx-type"] !== "pay") {
    throw new Error(`[chain/commander] txn ${txId} is not a payment txn (type=${txn["tx-type"]})`);
  }

  const payFields = txn["payment-transaction"] ?? txn.paymentTransaction ?? {};
  const receiver  = payFields.receiver ?? payFields["receiver"];
  const amount    = Number(payFields.amount ?? 0);
  const sender    = txn.sender;

  if (sender !== expectedSender) {
    throw new Error(`[chain/commander] Payment sender mismatch: got ${sender}, expected ${expectedSender}`);
  }
  if (receiver !== adminAddr) {
    throw new Error(`[chain/commander] Payment receiver mismatch: got ${receiver}, expected admin ${adminAddr}`);
  }
  if (amount < minMicroAlgo) {
    throw new Error(
      `[chain/commander] Insufficient payment: got ${amount} microAlgo, required ${minMicroAlgo}`
    );
  }

  return { amountMicroAlgo: amount };
}
