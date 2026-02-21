import algosdk from "algosdk";
import { PeraWalletConnect } from "@perawallet/connect";
import LuteConnect from "lute-connect";

export type WalletType = "pera" | "lute";

export const ALGORAND_TESTNET = {
  chainId: 416002 as const,
  genesisID: "testnet-v1.0",
  algodUrl: "https://testnet-api.algonode.cloud",
  indexerUrl: "https://testnet-idx.algonode.cloud",
};

export const algodClient = new algosdk.Algodv2(
  "",
  ALGORAND_TESTNET.algodUrl,
  ""
);

export const indexerClient = new algosdk.Indexer(
  "",
  ALGORAND_TESTNET.indexerUrl,
  ""
);

export const peraWallet = new PeraWalletConnect({
  shouldShowSignTxnToast: true,
  compactMode: false,
});

export const luteWallet = new LuteConnect("FRONTIER");

let activeWalletType: WalletType | null = null;

export function getActiveWalletType(): WalletType | null {
  return activeWalletType;
}

export function setActiveWalletType(type: WalletType | null) {
  activeWalletType = type;
}

export async function signTransactionWithActiveWallet(
  txn: algosdk.Transaction,
  signerAddress: string
): Promise<Uint8Array[]> {
  if (activeWalletType === "pera") {
    const singleTxnGroups = [{ txn, signers: [signerAddress] }];
    const signedTxnResult = await peraWallet.signTransaction([singleTxnGroups]);
    return signedTxnResult.flat().map((item: unknown) => {
      if (item instanceof Uint8Array) return item;
      if (typeof item === "object" && item !== null && "blob" in item) {
        return (item as { blob: Uint8Array }).blob;
      }
      return item as Uint8Array;
    });
  } else if (activeWalletType === "lute") {
    const encoded = algosdk.encodeUnsignedTransaction(txn);
    let encodedTxn = "";
    const bytes = new Uint8Array(encoded);
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      encodedTxn += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + chunk)));
    }
    encodedTxn = btoa(encodedTxn);
    const signedResult = await luteWallet.signTxns([
      { txn: encodedTxn, signers: [signerAddress] },
    ]);
    return signedResult
      .filter((s): s is Uint8Array => s !== null)
      .map((s) => {
        if (s instanceof Uint8Array) return s;
        const binary = atob(s as unknown as string);
        const arr = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
        return arr;
      });
  }
  throw new Error("No wallet connected");
}

export async function getAccountBalance(address: string): Promise<number> {
  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    const amount = accountInfo.amount;
    return Number(amount) / 1_000_000;
  } catch (error) {
    console.error("Failed to fetch account balance:", error);
    return 0;
  }
}

export async function getTransactionParams() {
  return await algodClient.getTransactionParams().do();
}

export async function sendPaymentTransaction(
  fromAddress: string,
  toAddress: string,
  amountMicroAlgos: number,
  note?: string
): Promise<string> {
  const suggestedParams = await getTransactionParams();
  
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: fromAddress,
    receiver: toAddress,
    amount: amountMicroAlgos,
    note: note ? new TextEncoder().encode(note) : undefined,
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, fromAddress);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  
  return txId;
}

export async function createGameActionTransaction(
  fromAddress: string,
  actionType: string,
  plotId: number,
  metadata?: Record<string, unknown>
): Promise<string> {
  const suggestedParams = await getTransactionParams();

  const actionData = JSON.stringify({
    game: "FRONTIER",
    v: 1,
    action: actionType,
    plotId,
    player: fromAddress.slice(0, 8),
    ts: Date.now(),
    network: "testnet",
    ...metadata,
  });

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: fromAddress,
    receiver: fromAddress,
    amount: 0,
    note: new TextEncoder().encode(`FRNTR:${actionData}`),
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, fromAddress);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  
  return txId;
}

export async function createPurchaseWithAlgoTransaction(
  fromAddress: string,
  treasuryAddress: string,
  plotId: number,
  algoAmount: number
): Promise<string> {
  const suggestedParams = await getTransactionParams();
  const microAlgos = Math.floor(algoAmount * 1_000_000);
  
  const actionData = JSON.stringify({
    game: "FRONTIER",
    v: 1,
    action: "purchase",
    plotId,
    algoAmount,
    player: fromAddress.slice(0, 8),
    ts: Date.now(),
    network: "testnet",
  });

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: fromAddress,
    receiver: treasuryAddress,
    amount: microAlgos,
    note: new TextEncoder().encode(`FRNTR:${actionData}`),
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, fromAddress);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  
  return txId;
}

export async function createClaimFrontierTransaction(
  fromAddress: string,
  frontierAmount: number
): Promise<string> {
  const suggestedParams = await getTransactionParams();
  
  const actionData = JSON.stringify({
    game: "FRONTIER",
    v: 1,
    action: "claim_frontier",
    amount: frontierAmount,
    player: fromAddress.slice(0, 8),
    ts: Date.now(),
    network: "testnet",
  });

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: fromAddress,
    receiver: fromAddress,
    amount: 0,
    note: new TextEncoder().encode(`FRNTR:${actionData}`),
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, fromAddress);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  
  return txId;
}

export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

export const FRONTIER_ASSETS = {
  iron: { name: "FRONTIER-IRON", unitName: "IRON", decimals: 0 },
  fuel: { name: "FRONTIER-FUEL", unitName: "FUEL", decimals: 0 },
  crystal: { name: "FRONTIER-CRYSTAL", unitName: "CRYSTAL", decimals: 0 },
  frontier: { name: "FRONTIER", unitName: "FRNTR", decimals: 2 },
} as const;

export type FrontierResourceType = keyof typeof FRONTIER_ASSETS;

export async function getASABalance(address: string, assetId: number): Promise<number> {
  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    const assets = accountInfo.assets || [];
    const asset = assets.find((a: any) => (a.assetIndex ?? a["asset-id"]) === assetId);
    return asset ? Number(asset.amount) : 0;
  } catch (error) {
    console.error("Failed to fetch ASA balance:", error);
    return 0;
  }
}

export async function optInToASA(
  address: string,
  assetId: number
): Promise<string> {
  const suggestedParams = await getTransactionParams();
  
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 0,
    assetIndex: assetId,
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, address);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  
  return txId;
}

export async function isOptedInToASA(address: string, assetId: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/blockchain/opt-in-check/${address}`);
    const data = await res.json();
    return data.optedIn === true;
  } catch {
    try {
      const accountInfo = await algodClient.accountInformation(address).do();
      const assets = accountInfo.assets || accountInfo["assets"] || [];
      return assets.some((a: any) => {
        const id = a["asset-id"] ?? a.assetIndex ?? a["assetIndex"];
        return id === assetId;
      });
    } catch {
      return false;
    }
  }
}

let _cachedTreasuryAddress: string | null = null;
let _cachedAsaId: number | null = null;

export async function fetchBlockchainStatus(): Promise<{
  ready: boolean;
  frontierAsaId: number | null;
  adminAddress: string | null;
}> {
  try {
    const res = await fetch("/api/blockchain/status");
    const data = await res.json();
    if (data.adminAddress) _cachedTreasuryAddress = data.adminAddress;
    if (data.frontierAsaId) _cachedAsaId = data.frontierAsaId;
    return data;
  } catch {
    return { ready: false, frontierAsaId: null, adminAddress: null };
  }
}

export function getCachedTreasuryAddress(): string {
  return _cachedTreasuryAddress || "";
}

export function getCachedAsaId(): number | null {
  return _cachedAsaId;
}

export const GAME_TREASURY_ADDRESS = "FRONTIER_TREASURY_TESTNET";

// ---------------------------------------------------------------------------
// Client-side game action batch queue
//
// All significant game actions (mine, upgrade, attack, build, turrets,
// commander actions, drones, special attacks) are logged on-chain via a
// compact batch transaction. Instead of one transaction per action, actions
// accumulate until the encoded note reaches ~1 KB, then a SINGLE 0-ALGO
// self-payment transaction is signed (one wallet popup covers many actions).
// A 10-second safety timer ensures partial batches are flushed promptly.
// ---------------------------------------------------------------------------

/** Compact on-chain action record (short keys keep the note small). */
export interface BatchedAction {
  /** Action type abbreviation */
  a: string;
  /** Plot ID (0 if not plot-specific) */
  p: number;
  /** Optional extra fields (improvement type, troops, tier, mineral yields, etc.) */
  x?: Record<string, unknown>;
  /** Unix ms timestamp */
  t: number;
  /** Mineral yields (mine actions only): iron, fuel, crystal */
  m?: { fe: number; fu: number; cr: number };
}

type BatchSignCallback = (actions: BatchedAction[]) => Promise<string | null>;

// Module-level queue state (survives re-renders)
let _actionQueue: BatchedAction[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
let _batchSignFn: BatchSignCallback | null = null;
let _batchAddress: string | null = null;

const MAX_BATCH_NOTE_BYTES = 1000; // stay under Algorand's 1024-byte note limit
const BATCH_FLUSH_DELAY_MS = 10_000; // 10-second safety flush

function _encodeBatch(actions: BatchedAction[]): Uint8Array {
  const payload = { game: "FRONTIER", v: 1, network: "testnet", actions };
  return new TextEncoder().encode(`FRNTR:${JSON.stringify(payload)}`);
}

function _estimatedBatchBytes(): number {
  return _encodeBatch(_actionQueue).length;
}

/** Called by the hook when the player's wallet address or connection changes. */
export function registerBatchSignCallback(
  address: string,
  callback: BatchSignCallback
) {
  _batchAddress = address;
  _batchSignFn = callback;
}

/** Enqueue a game action for batched on-chain logging. Fire-and-forget. */
export function enqueueGameAction(
  type: string,
  plotId: number,
  extra?: Record<string, unknown>,
  minerals?: { fe: number; fu: number; cr: number }
) {
  const action: BatchedAction = { a: type, p: plotId, x: extra, t: Date.now() };
  if (minerals) action.m = minerals;
  _actionQueue.push(action);

  if (_estimatedBatchBytes() >= MAX_BATCH_NOTE_BYTES) {
    // Hit the 1 KB threshold — flush immediately
    if (_flushTimer) {
      clearTimeout(_flushTimer);
      _flushTimer = null;
    }
    _triggerFlush();
  } else if (!_flushTimer) {
    // Schedule a safety flush so the batch doesn't sit forever
    _flushTimer = setTimeout(() => {
      _flushTimer = null;
      _triggerFlush();
    }, BATCH_FLUSH_DELAY_MS);
  }
}

function _triggerFlush() {
  if (_actionQueue.length === 0 || !_batchSignFn) return;
  const batch = _actionQueue.splice(0); // drain the queue atomically
  _batchSignFn(batch)
    .then((txId) => {
      if (txId) {
        console.log(
          `Game action batch confirmed: ${batch.length} action(s), TX: ${txId}`
        );
      }
    })
    .catch((err) => {
      console.error("Game action batch failed — re-queuing:", err);
      // Re-queue at the front so the actions aren't lost
      _actionQueue.unshift(...batch);
    });
}

/**
 * Create and submit a single 0-ALGO self-payment transaction whose note field
 * encodes a batch of game actions (up to ~1 KB).
 */
export async function createBatchedGameActionTransaction(
  fromAddress: string,
  actions: BatchedAction[]
): Promise<string> {
  const noteBytes = _encodeBatch(actions);
  if (noteBytes.length > 1024) {
    throw new Error(`Batch note too large: ${noteBytes.length} bytes`);
  }

  const suggestedParams = await getTransactionParams();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: fromAddress,
    receiver: fromAddress,
    amount: 0,
    note: noteBytes,
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, fromAddress);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);

  return txId;
}
