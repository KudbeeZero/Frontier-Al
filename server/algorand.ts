import algosdk from "algosdk";

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

export async function isAddressOptedInToFrontier(address: string): Promise<boolean> {
  if (!frontierAsaId) return false;

  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    const assets = (accountInfo as any).assets || (accountInfo as any)["assets"] || [];
    return assets.some((a: any) => {
      const id = a["asset-id"] ?? a.assetIndex ?? a["assetIndex"];
      return Number(id) === frontierAsaId;
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
