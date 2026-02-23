import algosdk from "algosdk";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { plotNfts } from "./db-schema";

const ALGOD_URL = "https://testnet-api.algonode.cloud";
const INDEXER_URL = "https://testnet-idx.algonode.cloud";

export const algodClient = new algosdk.Algodv2("", ALGOD_URL, "");
export const indexerClient = new algosdk.Indexer("", INDEXER_URL, "");

let adminAccount: algosdk.Account | null = null;
let frontierAsaId: number | null = null;

const FRONTIER_ASA_TOTAL_SUPPLY = 1_000_000_000;
const FRONTIER_ASA_DECIMALS = 6;

export function getAdminAccount(): algosdk.Account {
  if (adminAccount) return adminAccount;

  const mnemonic = process.env.ALGORAND_ADMIN_MNEMONIC;
  if (!mnemonic) throw new Error("ALGORAND_ADMIN_MNEMONIC not set");

  adminAccount = algosdk.mnemonicToSecretKey(mnemonic);

  const expectedAddress = process.env.ALGORAND_ADMIN_ADDRESS;
  if (expectedAddress && adminAccount.addr.toString() !== expectedAddress) {
    console.warn(`Admin address mismatch: derived ${adminAccount.addr.toString()} vs expected ${expectedAddress}`);
  }

  return adminAccount;
}

export function getAdminAddress(): string {
  try {
    return getAdminAccount().addr.toString();
  } catch {
    return process.env.ALGORAND_ADMIN_ADDRESS || "";
  }
}

export function getFrontierAsaId(): number | null {
  return frontierAsaId;
}

export function setFrontierAsaId(id: number) {
  frontierAsaId = id;
  console.log(`FRONTIER ASA ID set to: ${id}`);
}

export async function getAdminBalance(): Promise<{ algo: number; frontierAsa: number }> {
  try {
    const account = getAdminAccount();
    const accountInfo = await algodClient.accountInformation(account.addr.toString()).do();
    const algoBalance = Number(accountInfo.amount) / 1_000_000;

    let frontierBalance = 0;
    if (frontierAsaId) {
      const assets = accountInfo.assets || [];
      const asaInfo = assets.find((a: any) => (a.assetIndex ?? a["asset-id"]) === frontierAsaId);
      if (asaInfo) {
        frontierBalance = Number(asaInfo.amount) / Math.pow(10, FRONTIER_ASA_DECIMALS);
      }
    }

    return { algo: algoBalance, frontierAsa: frontierBalance };
  } catch (error) {
    console.error("Failed to get admin balance:", error);
    return { algo: 0, frontierAsa: 0 };
  }
}

export async function createFrontierASA(): Promise<number> {
  const account = getAdminAccount();
  const suggestedParams = await algodClient.getTransactionParams().do();

  const totalSupplyUnits = BigInt(FRONTIER_ASA_TOTAL_SUPPLY) * BigInt(Math.pow(10, FRONTIER_ASA_DECIMALS));

  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: account.addr.toString(),
    total: totalSupplyUnits,
    decimals: FRONTIER_ASA_DECIMALS,
    defaultFrozen: false,
    unitName: "FRNTR",
    assetName: "FRONTIER",
    assetURL: "https://frontier-al.app",
    manager: account.addr.toString(),
    reserve: account.addr.toString(),
    freeze: undefined,
    clawback: undefined,
    suggestedParams,
    note: new TextEncoder().encode("FRONTIER Game Token - TestNet"),
  });

  const signedTxn = txn.signTxn(account.sk);
  const response = await algodClient.sendRawTransaction(signedTxn).do();
  const txId = response.txid || txn.txID();

  const confirmedTxn = await algosdk.waitForConfirmation(algodClient, txId, 4);
  const assetId = Number((confirmedTxn as any).assetIndex ?? (confirmedTxn as any)["asset-index"]);

  if (!assetId || assetId === 0) {
    throw new Error("ASA creation confirmed but no asset ID returned");
  }

  frontierAsaId = assetId;
  console.log(`FRONTIER ASA created! Asset ID: ${assetId}, TX: ${txId}`);

  return assetId;
}

export async function transferFrontierASA(
  toAddress: string,
  amount: number
): Promise<string> {
  if (!frontierAsaId) throw new Error("FRONTIER ASA not created yet");

  const account = getAdminAccount();
  const suggestedParams = await algodClient.getTransactionParams().do();

  const amountUnits = Math.floor(amount * Math.pow(10, FRONTIER_ASA_DECIMALS));

  const noteData = JSON.stringify({
    game: "FRONTIER",
    v: 1,
    type: "claim",
    amt: amount,
    to: toAddress,
    ts: Date.now(),
    network: "testnet",
  });

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr.toString(),
    receiver: toAddress,
    amount: amountUnits,
    assetIndex: frontierAsaId,
    suggestedParams,
    note: new TextEncoder().encode(`FRNTR:${noteData}`),
  });

  const signedTxn = txn.signTxn(account.sk);
  const response = await algodClient.sendRawTransaction(signedTxn).do();
  const txId = response.txid || txn.txID();

  await algosdk.waitForConfirmation(algodClient, txId, 4);
  console.log(`Transferred ${amount} FRONTIER to ${toAddress}, TX: ${txId}`);

  return txId;
}

export async function isAddressOptedInToFrontier(address: string, assetId?: number): Promise<boolean> {
  const targetAsaId = assetId ?? frontierAsaId;
  if (!targetAsaId) return false;

  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    const assets = (accountInfo as any).assets || (accountInfo as any)["assets"] || [];
    return assets.some((a: any) => {
      const id = a["asset-id"] ?? a.assetIndex ?? a["assetIndex"];
      return Number(id) === targetAsaId;
    });
  } catch (err) {
    console.error("Opt-in check failed for", address, err);
    return false;
  }
}

export async function lookupExistingASA(): Promise<number | null> {
  try {
    const account = getAdminAccount();
    const accountInfo = await algodClient.accountInformation(account.addr.toString()).do();
    const createdAssets = (accountInfo as any)["created-assets"] || (accountInfo as any).createdAssets || [];

    for (const asset of createdAssets) {
      const params = asset.params || asset;
      const name = params.name || params["asset-name"] || "";
      const unitName = params["unit-name"] || params.unitName || "";
      if (name === "FRONTIER" || unitName === "FRNTR") {
        const assetId = asset.index ?? asset["asset-id"] ?? asset.assetIndex;
        if (assetId) {
          console.log(`Found existing FRONTIER ASA: ${assetId}`);
          return Number(assetId);
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to lookup existing ASA:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Batched FRONTIER ASA transfers using Algorand Atomic Transaction Groups
// Flushes when accumulated serialized size >= 1 KB or group limit (16) reached
// ---------------------------------------------------------------------------

interface PendingTransfer {
  toAddress: string;
  amount: number;
  resolve: (txId: string) => void;
  reject: (err: Error) => void;
}

class FrontierTransferBatcher {
  private _pending: PendingTransfer[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** Maximum total estimated serialized bytes before an immediate flush */
  private readonly maxBatchBytes = 1024;
  /** Algorand atomic group hard limit */
  private readonly maxBatchCount = 16;
  /** Maximum time to wait before flushing a partial batch (ms) */
  private readonly flushDelayMs = 30_000;

  /** Queue a transfer and return a promise that resolves with its on-chain txId */
  async queue(toAddress: string, amount: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this._pending.push({ toAddress, amount, resolve, reject });
      this.maybeFlush();
    });
  }

  private estimatedBytes(): number {
    // ~200 bytes base overhead per txn + structured JSON note content length
    return this._pending.reduce((sum, item) => {
      const note = `FRNTR:{"game":"FRONTIER","v":1,"type":"batch_claim","amt":${item.amount},"to":"${item.toAddress}","batchIdx":0,"batchSize":1,"ts":${Date.now()},"network":"testnet"}`;
      return sum + 200 + note.length;
    }, 0);
  }

  private maybeFlush() {
    const shouldFlushNow =
      this._pending.length >= this.maxBatchCount ||
      this.estimatedBytes() >= this.maxBatchBytes;

    if (shouldFlushNow) {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
      this.doFlush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.doFlush();
      }, this.flushDelayMs);
    }
  }

  private async doFlush() {
    if (this._pending.length === 0) return;

    // Take up to maxBatchCount items
    const batch = this._pending.splice(0, this.maxBatchCount);

    try {
      const txIds = await sendAtomicFrontierTransfers(
        batch.map((b) => ({ toAddress: b.toAddress, amount: b.amount }))
      );
      batch.forEach((item, i) => item.resolve(txIds[i] || txIds[0]));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      batch.forEach((item) => item.reject(error));
    }

    // If more items arrived while flushing, schedule another check
    if (this._pending.length > 0) {
      this.maybeFlush();
    }
  }
}

async function sendAtomicFrontierTransfers(
  transfers: Array<{ toAddress: string; amount: number }>
): Promise<string[]> {
  if (!frontierAsaId) throw new Error("FRONTIER ASA not created yet");

  const account = getAdminAccount();
  const suggestedParams = await algodClient.getTransactionParams().do();

  const batchTs = Date.now();
  const txns = transfers.map(({ toAddress, amount }, index) => {
    const amountUnits = Math.floor(amount * Math.pow(10, FRONTIER_ASA_DECIMALS));
    const noteData = JSON.stringify({
      game: "FRONTIER",
      v: 1,
      type: "batch_claim",
      amt: amount,
      to: toAddress,
      batchIdx: index,
      batchSize: transfers.length,
      ts: batchTs,
      network: "testnet",
    });
    return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: account.addr.toString(),
      receiver: toAddress,
      amount: amountUnits,
      assetIndex: frontierAsaId!,
      suggestedParams,
      note: new TextEncoder().encode(`FRNTR:${noteData}`),
    });
  });

  // Assign a shared group ID so all transfers are atomic
  if (txns.length > 1) {
    algosdk.assignGroupID(txns);
  }

  const signedTxns = txns.map((txn) => txn.signTxn(account.sk));
  const response = await algodClient.sendRawTransaction(signedTxns).do();
  const firstTxId = response.txid || txns[0].txID();

  await algosdk.waitForConfirmation(algodClient, firstTxId, 4);
  console.log(
    `Atomic batch: ${txns.length} FRONTIER transfer(s) confirmed, first TX: ${firstTxId}`
  );

  return txns.map((txn) => txn.txID());
}

/** Singleton batcher instance used across route handlers */
export const frontierTransferBatcher = new FrontierTransferBatcher();

/**
 * Queue a FRONTIER ASA transfer into the batcher.
 * Resolves with the on-chain txId once the batch is confirmed.
 */
export async function batchedTransferFrontierASA(
  toAddress: string,
  amount: number
): Promise<string> {
  return frontierTransferBatcher.queue(toAddress, amount);
}

// ---------------------------------------------------------------------------

export async function initializeBlockchain(): Promise<{ asaId: number | null; adminAddress: string; adminAlgo: number }> {
  try {
    const account = getAdminAccount();
    const adminAddress = account.addr.toString();
    console.log(`Admin wallet: ${adminAddress}`);

    const balance = await getAdminBalance();
    console.log(`Admin ALGO balance: ${balance.algo}`);

    if (balance.algo < 0.5) {
      console.warn("Admin wallet has low ALGO balance. Fund from TestNet faucet.");
      return { asaId: null, adminAddress, adminAlgo: balance.algo };
    }

    const existingId = await lookupExistingASA();
    if (existingId) {
      frontierAsaId = existingId;
      console.log(`Using existing FRONTIER ASA: ${existingId}`);
      return { asaId: existingId, adminAddress, adminAlgo: balance.algo };
    }

    console.log("Creating new FRONTIER ASA on TestNet...");
    const asaId = await createFrontierASA();
    return { asaId, adminAddress, adminAlgo: balance.algo };
  } catch (error) {
    console.error("Blockchain initialization failed:", error);
    return { asaId: null, adminAddress: process.env.ALGORAND_ADMIN_ADDRESS || "", adminAlgo: 0 };
  }
}

// ---------------------------------------------------------------------------
// Plot NFT minting — real Algorand ASA on TestNet
// ---------------------------------------------------------------------------

/**
 * Mint a Frontier Plot NFT (Algorand ASA) for the given plot and transfer it
 * to the buyer's wallet address.
 *
 * ASA parameters (TestNet):
 *   assetName  = `Frontier Plot #<plotId>`
 *   unitName   = `PLOT`
 *   total      = 1  (true NFT — indivisible)
 *   decimals   = 0
 *   manager    = admin (allows metadata URL updates in future)
 *   reserve    = admin (displayed as "reserve" in explorers)
 *   freeze     = admin (allows freeze on TestNet for recovery)
 *   clawback   = admin (allows clawback on TestNet for recovery)
 *
 * NOTE: On mainnet, freeze and clawback should be set to "" (empty string)
 * to give true ownership to buyers. Kept as admin on TestNet for safety.
 *
 * Transfer step: After creation the 1 unit lives in the admin wallet.
 * We attempt to send it to `address`. If the buyer has not yet opted in to
 * this specific ASA (which is always the case for a freshly-minted NFT),
 * the transfer will fail gracefully — the assetId is still recorded and the
 * admin holds the NFT until the buyer opts in.
 *
 * @param plotId  - Integer plot identifier (primary key in `plot_nfts`).
 * @param address - Algorand wallet address that should receive the NFT.
 * @returns       `{ assetId }` — the real on-chain Algorand ASA asset ID.
 */
export async function mintPlotNftToAddress(
  plotId: number,
  address: string
): Promise<{ assetId: number }> {
  // Safety: if this plot has already been minted, return the existing assetId.
  const [existing] = await db
    .select()
    .from(plotNfts)
    .where(eq(plotNfts.plotId, plotId));

  if (existing?.assetId) {
    console.log(
      `[mintPlotNftToAddress] plotId=${plotId} already minted, assetId=${existing.assetId}`
    );
    return { assetId: Number(existing.assetId) };
  }

  const account = getAdminAccount();
  const PUBLIC_BASE_URL =
    process.env.PUBLIC_BASE_URL || "https://frontier-al--kudbeex.replit.app";

  // ── Step 1: Create the NFT ASA ────────────────────────────────────────────
  const createParams = await algodClient.getTransactionParams().do();

  const createTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: account.addr.toString(),
    total: BigInt(1),
    decimals: 0,
    defaultFrozen: false,
    unitName: "PLOT",
    assetName: `Frontier Plot #${plotId}`,
    assetURL: `${PUBLIC_BASE_URL}/nft/metadata/${plotId}`,
    // All roles set to admin for TestNet recovery purposes.
    // On mainnet, freeze and clawback should be empty strings.
    manager: account.addr.toString(),
    reserve: account.addr.toString(),
    freeze: account.addr.toString(),
    clawback: account.addr.toString(),
    suggestedParams: createParams,
    note: new TextEncoder().encode(`FRONTIER Plot NFT #${plotId} - TestNet`),
  });

  const signedCreate = createTxn.signTxn(account.sk);
  const createResp = await algodClient.sendRawTransaction(signedCreate).do();
  const createTxId = createResp.txid || createTxn.txID();

  const confirmedCreate = await algosdk.waitForConfirmation(algodClient, createTxId, 4);
  const assetId = Number(
    (confirmedCreate as any).assetIndex ?? (confirmedCreate as any)["asset-index"]
  );

  if (!assetId || assetId === 0) {
    throw new Error(
      `Plot NFT ASA creation failed for plotId=${plotId}: no assetIndex in confirmed txn`
    );
  }

  console.log(
    `[mintPlotNftToAddress] plotId=${plotId} ASA created, assetId=${assetId}, TX: ${createTxId}`
  );

  // ── Step 2: Transfer the 1 unit to the buyer ──────────────────────────────
  // The buyer must have opted in to this ASA before they can receive it.
  // For freshly-minted NFTs the buyer cannot have opted in yet, so the
  // transfer will typically fail on the first attempt. The assetId is still
  // recorded — the buyer can opt in later and an admin transfer can follow.
  let mintedToAddress = account.addr.toString(); // admin holds by default

  try {
    const transferParams = await algodClient.getTransactionParams().do();
    const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: account.addr.toString(),
      receiver: address,
      amount: 1,
      assetIndex: assetId,
      suggestedParams: transferParams,
      note: new TextEncoder().encode(`FRONTIER Plot #${plotId} NFT to buyer`),
    });

    const signedTransfer = transferTxn.signTxn(account.sk);
    const transferResp = await algodClient.sendRawTransaction(signedTransfer).do();
    const transferTxId = transferResp.txid || transferTxn.txID();
    await algosdk.waitForConfirmation(algodClient, transferTxId, 4);

    mintedToAddress = address;
    console.log(
      `[mintPlotNftToAddress] plotId=${plotId} NFT transferred to ${address}, TX: ${transferTxId}`
    );
  } catch (err) {
    console.warn(
      `[mintPlotNftToAddress] Transfer to ${address} failed — buyer likely not opted in to` +
        ` assetId=${assetId}. NFT held by admin until buyer opts in.`,
      err instanceof Error ? err.message : err
    );
  }

  // ── Step 3: Persist to plot_nfts (upsert on plotId) ──────────────────────
  const mintedAt = Date.now();
  await db
    .insert(plotNfts)
    .values({ plotId, assetId, mintedToAddress, mintedAt })
    .onConflictDoUpdate({
      target: plotNfts.plotId,
      set: { assetId, mintedToAddress, mintedAt },
    });

  console.log(
    `[mintPlotNftToAddress] plotId=${plotId} recorded in plot_nfts,` +
      ` assetId=${assetId}, holder=${mintedToAddress}`
  );

  return { assetId };
}
