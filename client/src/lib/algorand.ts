import algosdk from "algosdk";
import { PeraWalletConnect } from "@perawallet/connect";
import LuteConnect from "lute-connect";

export type WalletType = "pera" | "lute";

// Override with VITE_ALGOD_URL / VITE_INDEXER_URL at build time to switch networks.
export const ALGORAND_TESTNET = {
  chainId: 416002 as const,
  genesisID: "testnet-v1.0",
  algodUrl: (import.meta.env.VITE_ALGOD_URL as string | undefined) ?? "https://testnet-api.algonode.cloud",
  indexerUrl: (import.meta.env.VITE_INDEXER_URL as string | undefined) ?? "https://testnet-idx.algonode.cloud",
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

function _encodeUnsignedTxnToBase64(txn: algosdk.Transaction): string {
  const encoded = algosdk.encodeUnsignedTransaction(txn);
  const bytes = new Uint8Array(encoded);
  let str = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    str += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + chunk)));
  }
  return btoa(str);
}

function _normalizeSignedBlob(item: unknown): Uint8Array {
  if (item instanceof Uint8Array) return item;
  if (typeof item === "object" && item !== null && "blob" in item) {
    return (item as { blob: Uint8Array }).blob;
  }
  if (typeof item === "string") {
    const binary = atob(item);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return arr;
  }
  return item as Uint8Array;
}

export async function signGroupedTransactionsWithActiveWallet(
  txns: algosdk.Transaction[],
  signerAddress: string
): Promise<Uint8Array[]> {
  console.log(`[BATCH-DEBUG] signGroupedTransactions | wallet: ${activeWalletType} | txnCount: ${txns.length} | signer: ${signerAddress.slice(0, 8)}... | ts: ${Date.now()}`);
  if (activeWalletType === "pera") {
    const txnGroup = txns.map((txn) => ({ txn, signers: [signerAddress] }));
    const signedResult = await peraWallet.signTransaction([txnGroup]);
    const flat = signedResult.flat().map(_normalizeSignedBlob);
    console.log(`[BATCH-DEBUG] Pera signed ${flat.length} txns | ts: ${Date.now()}`);
    return flat;
  } else if (activeWalletType === "lute") {
    const encodedTxns = txns.map((txn) => ({
      txn: _encodeUnsignedTxnToBase64(txn),
      signers: [signerAddress],
    }));
    const signedResult = await luteWallet.signTxns(encodedTxns);
    const flat = (signedResult as unknown[])
      .filter((s) => s !== null && s !== undefined)
      .map((s) => _normalizeSignedBlob(s));
    if (flat.length !== txns.length) {
      console.warn(`[BATCH-DEBUG] LUTE signed ${flat.length} blobs but expected ${txns.length} — possible signature loss`);
    }
    console.log(`[BATCH-DEBUG] LUTE signed ${flat.length} txns | ts: ${Date.now()}`);
    return flat;
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
  console.log(`[TXN-DEBUG] sendPaymentTransaction triggered | txns: 1 | groupID: NO | ts: ${Date.now()} | from: ${fromAddress.slice(0,8)}... | to: ${toAddress.slice(0,8)}... | amount: ${amountMicroAlgos} microAlgos`);
  const suggestedParams = await getTransactionParams();
  
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: fromAddress,
    receiver: toAddress,
    amount: amountMicroAlgos,
    note: note ? new TextEncoder().encode(note) : undefined,
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, fromAddress);
  console.log(`[TXN-DEBUG] sendPaymentTransaction submitting to algod | ts: ${Date.now()}`);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  console.log(`[TXN-DEBUG] sendPaymentTransaction confirmed | txId: ${txId} | ts: ${Date.now()}`);
  
  return txId;
}

export async function createGameActionTransaction(
  fromAddress: string,
  actionType: string,
  plotId: number,
  metadata?: Record<string, unknown>
): Promise<string> {
  console.log(`[TXN-DEBUG] createGameActionTransaction triggered | action: ${actionType} | plotId: ${plotId} | txns: 1 | groupID: NO | ts: ${Date.now()} | from: ${fromAddress.slice(0,8)}...`);
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
  console.log(`[TXN-DEBUG] createGameActionTransaction submitting | ts: ${Date.now()}`);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  console.log(`[TXN-DEBUG] createGameActionTransaction confirmed | txId: ${txId} | ts: ${Date.now()}`);
  
  return txId;
}

export async function createPurchaseWithAlgoTransaction(
  fromAddress: string,
  treasuryAddress: string,
  plotId: number,
  algoAmount: number
): Promise<string> {
  console.log(`[TXN-DEBUG] createPurchaseWithAlgoTransaction triggered | plotId: ${plotId} | algo: ${algoAmount} | txns: 1 | groupID: NO | ts: ${Date.now()} | from: ${fromAddress.slice(0,8)}... | to: ${treasuryAddress.slice(0,8)}...`);
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
  console.log(`[TXN-DEBUG] createPurchaseWithAlgoTransaction submitting | ts: ${Date.now()}`);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  console.log(`[TXN-DEBUG] createPurchaseWithAlgoTransaction confirmed | txId: ${txId} | ts: ${Date.now()}`);
  
  return txId;
}

export async function createClaimFrontierTransaction(
  fromAddress: string,
  frontierAmount: number
): Promise<string> {
  console.log(`[TXN-DEBUG] createClaimFrontierTransaction triggered | amount: ${frontierAmount} | txns: 1 | groupID: NO | ts: ${Date.now()} | from: ${fromAddress.slice(0,8)}...`);
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
  console.log(`[TXN-DEBUG] createClaimFrontierTransaction submitting | ts: ${Date.now()}`);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  console.log(`[TXN-DEBUG] createClaimFrontierTransaction confirmed | txId: ${txId} | ts: ${Date.now()}`);
  
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
  frontier: { name: "FRONTIER", unitName: "FRNTR", decimals: 6 },
} as const;

export type FrontierResourceType = keyof typeof FRONTIER_ASSETS;

export async function getASABalance(address: string, assetId: number): Promise<number> {
  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    const assets = accountInfo.assets || [];
    // algosdk v3: .assetId (bigint) — v2/raw JSON: "asset-id" or assetIndex
    const asset = assets.find((a: any) => Number(a.assetId ?? a["asset-id"] ?? a.assetIndex) === assetId);
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
  console.log(`[TXN-DEBUG] optInToASA triggered | assetId: ${assetId} | txns: 1 | groupID: NO | ts: ${Date.now()} | address: ${address.slice(0,8)}...`);
  const suggestedParams = await getTransactionParams();
  
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 0,
    assetIndex: assetId,
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, address);
  console.log(`[TXN-DEBUG] optInToASA submitting | ts: ${Date.now()}`);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  console.log(`[TXN-DEBUG] optInToASA confirmed | txId: ${txId} | ts: ${Date.now()}`);
  
  return txId;
}

export async function isOptedInToASA(address: string, assetId: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/blockchain/opt-in-check/${address}?assetId=${assetId}`);
    const data = await res.json();
    return data.optedIn === true;
  } catch {
    try {
      const accountInfo = await algodClient.accountInformation(address).do();
      const assets = accountInfo.assets || accountInfo["assets"] || [];
      return assets.some((a: any) => {
        // algosdk v3: .assetId (bigint); v2/raw JSON: "asset-id" / assetIndex
        const id = a.assetId ?? a["asset-id"] ?? a.assetIndex ?? a["assetIndex"];
        return Number(id) === assetId;
      });
    } catch {
      return false;
    }
  }
}

/**
 * Pure helper: checks whether an account is opted into a specific ASA by
 * inspecting the accountInfo object returned from algodClient.accountInformation().do().
 *
 * algosdk v3 deserializes AssetHolding with a camelCase `.assetId` (bigint) property.
 * Older / raw-JSON paths expose the kebab-case `"asset-id"` key instead.
 * We check all known variants so this works regardless of how the object was produced.
 */
export function hasOptedIn(
  accountInfo: Record<string, unknown>,
  asaId: number
): boolean {
  const assets = (accountInfo.assets as Array<Record<string, unknown>>) ?? [];
  return assets.some(
    // assetId  → algosdk v3 AssetHolding (bigint, use Number() for comparison)
    // asset-id → raw JSON / legacy algosdk v2 response
    // assetIndex → older SDK alias sometimes seen in typed responses
    (a) => Number(a["assetId"] ?? a["asset-id"] ?? a["assetIndex"]) === asaId
  );
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

// Treasury address is fetched at runtime from /api/blockchain/status and
// cached in _cachedTreasuryAddress. Use getCachedTreasuryAddress() to access it.

// ---------------------------------------------------------------------------
// Client-side atomic transaction group queue
//
// Game actions (mine, upgrade, attack, build, commander actions, drones,
// special attacks) are queued as individual 0-ALGO self-payment transactions.
// After a debounce window (BATCH_WINDOW_MS) or when the queue reaches
// MAX_GROUP_SIZE, all pending transactions are grouped via
// algosdk.assignGroupID(), signed in one wallet popup, and submitted as
// an atomic group. A hard MAX_WAIT_MS cap prevents indefinite queueing.
// ---------------------------------------------------------------------------

export const MAX_GROUP_SIZE = 16;
export const BATCH_WINDOW_MS = 800;
export const MAX_WAIT_MS = 2000;

export interface BatchedAction {
  a: string;
  p: number;
  x?: Record<string, unknown>;
  t: number;
  m?: { fe: number; fu: number; cr: number };
}

type BatchSignCallback = (actions: BatchedAction[]) => Promise<string | null>;

// Module-level queue state (survives re-renders)
let _actionQueue: BatchedAction[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
let _maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
let _batchSignFn: BatchSignCallback | null = null;
let _batchAddress: string | null = null;

// ── Batch / queue tuning knobs ────────────────────────────────────────────────
// Increase MAX_ACTIONS to allow more actions to accumulate before flushing.
// The "Satellite Relay" framing makes this feel like a game mechanic, not lag.
const MAX_BATCH_NOTE_BYTES   = 1000;  // stay under Algorand's 1024-byte limit
const MAX_ACTIONS_PER_FLUSH  = 16;    // Algorand group-tx limit (also our soft cap)
const FLUSH_INTERVAL_MS      = 15_000; // Satellite relay window: 15 seconds
const FLUSH_MAX_WAIT_MS      = 45_000; // Never hold longer than 45 seconds
interface TxnQueueEntry {
  action: BatchedAction;
  enqueuedAt: number;
}

export type BatchStatusCallback = (
  event: "bundling" | "submitting" | "confirmed" | "error",
  detail: { count: number; txIds?: string[]; message?: string }
) => void;

let _txnQueue: TxnQueueEntry[] = [];
let _txnDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let _txnMaxWaitTimer: ReturnType<typeof setTimeout> | null = null;
let _txnFlushInProgress = false;
let _txnQueueAddress: string | null = null;
let _txnStatusCallback: BatchStatusCallback | null = null;

export function registerTxnQueueAddress(address: string) {
  _txnQueueAddress = address;
  if (_txnQueue.length > 0 && !_txnFlushInProgress) {
    console.log(`[BATCH-DEBUG] address registered with ${_txnQueue.length} queued entries → scheduling flush | ts: ${Date.now()}`);
    _clearTimers();
    _txnDebounceTimer = setTimeout(() => {
      _txnDebounceTimer = null;
      _triggerAtomicFlush();
    }, BATCH_WINDOW_MS);
  }
}

export function registerBatchStatusCallback(cb: BatchStatusCallback) {
  _txnStatusCallback = cb;
}

function _buildActionNote(action: BatchedAction, fromAddress: string): Uint8Array {
  const data = JSON.stringify({
    game: "FRONTIER",
    v: 1,
    action: action.a,
    plotId: action.p,
    player: fromAddress.slice(0, 8),
    ts: action.t,
    network: "testnet",
    ...(action.x || {}),
    ...(action.m ? { minerals: action.m } : {}),
  });
  return new TextEncoder().encode(`FRNTR:${data}`);
}

export function enqueueGameAction(
  type: string,
  plotId: number,
  extra?: Record<string, unknown>,
  minerals?: { fe: number; fu: number; cr: number }
) {
  const action: BatchedAction = { a: type, p: plotId, x: extra, t: Date.now() };
  if (minerals) action.m = minerals;

  const byteCount = _estimatedBatchBytes();
  console.log(
    `[ACTION-DEBUG] player action enqueued | type: ${type} | plotId: ${plotId} | queue: ${_actionQueue.length} | bytes: ${byteCount} | ts: ${Date.now()}`
  );

  const shouldFlushNow =
    byteCount >= MAX_BATCH_NOTE_BYTES ||
    _actionQueue.length >= MAX_ACTIONS_PER_FLUSH;

  if (shouldFlushNow) {
    // Hit the size/count threshold — flush immediately (Satellite relay opens)
    if (_flushTimer) {
      clearTimeout(_flushTimer);
      _flushTimer = null;
    }
    _triggerFlush();
  } else if (!_flushTimer) {
    // Schedule the relay window: flush after FLUSH_INTERVAL_MS
    _flushTimer = setTimeout(() => {
      _flushTimer = null;
      _triggerFlush();
    }, FLUSH_INTERVAL_MS);

    // Hard upper bound: never hold longer than FLUSH_MAX_WAIT_MS
    if (_maxWaitTimer) clearTimeout(_maxWaitTimer);
    _maxWaitTimer = setTimeout(() => {
      _maxWaitTimer = null;
      if (_actionQueue.length > 0) {
        console.log(`[TXN-DEBUG] FLUSH_MAX_WAIT_MS reached — force flushing ${_actionQueue.length} actions`);
        if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
        _triggerFlush();
      }
    }, FLUSH_MAX_WAIT_MS);
  }
}

function _triggerFlush() {
  if (_actionQueue.length === 0 || !_batchSignFn) return;
  const batch = _actionQueue.splice(0); // drain the queue atomically
  const noteBytes = _encodeBatch(batch).length;
  console.log(
    `[TXN-DEBUG] flush started | actions: ${batch.length} | noteBytes: ${noteBytes} | types: [${batch.map((a) => a.a).join(",")}] | ts: ${Date.now()}`
  );
  _batchSignFn(batch)
    .then((txId) => {
      if (txId) {
        console.log(
          `[TXN-DEBUG] flush confirmed | actions: ${batch.length} | TX: ${txId} | ts: ${Date.now()}`
        );
      } else {
        console.log(`[TXN-DEBUG] flush skipped (no wallet / cancelled) | actions: ${batch.length}`);
      }
    })
    .catch((err) => {
      console.error(`[TXN-DEBUG] flush failed — re-queuing ${batch.length} actions:`, err);
      // Re-queue at the front so the actions aren't lost
      _actionQueue.unshift(...batch);
  _txnQueue.push({ action, enqueuedAt: Date.now() });
  console.log(`[BATCH-DEBUG] enqueue | type: ${type} | plotId: ${plotId} | queueSize: ${_txnQueue.length}/${MAX_GROUP_SIZE} | ts: ${Date.now()}`);

  _txnStatusCallback?.("bundling", { count: _txnQueue.length });

  if (_txnQueue.length >= MAX_GROUP_SIZE) {
    console.log(`[BATCH-DEBUG] queue full (${MAX_GROUP_SIZE}) → immediate flush | ts: ${Date.now()}`);
    _clearTimers();
    _triggerAtomicFlush();
    return;
  }

  if (!_txnDebounceTimer) {
    _txnDebounceTimer = setTimeout(() => {
      _txnDebounceTimer = null;
      console.log(`[BATCH-DEBUG] debounce expired (${BATCH_WINDOW_MS}ms) → flush | queueSize: ${_txnQueue.length} | ts: ${Date.now()}`);
      _triggerAtomicFlush();
    }, BATCH_WINDOW_MS);
  }

  if (!_txnMaxWaitTimer) {
    _txnMaxWaitTimer = setTimeout(() => {
      _txnMaxWaitTimer = null;
      console.log(`[BATCH-DEBUG] maxWait expired (${MAX_WAIT_MS}ms) → flush | queueSize: ${_txnQueue.length} | ts: ${Date.now()}`);
      _clearTimers();
      _triggerAtomicFlush();
    }, MAX_WAIT_MS);
  }
}

function _clearTimers() {
  if (_txnDebounceTimer) {
    clearTimeout(_txnDebounceTimer);
    _txnDebounceTimer = null;
  }
  if (_txnMaxWaitTimer) {
    clearTimeout(_txnMaxWaitTimer);
    _txnMaxWaitTimer = null;
  }
}

function _triggerAtomicFlush() {
  if (_txnQueue.length === 0 || _txnFlushInProgress || !_txnQueueAddress) return;
  _clearTimers();
  const entries = _txnQueue.splice(0);
  _txnFlushInProgress = true;

  const address = _txnQueueAddress;
  const waitedMs = Date.now() - entries[0].enqueuedAt;
  console.log(`[BATCH-DEBUG] flush start | count: ${entries.length} | waitedMs: ${waitedMs} | address: ${address.slice(0, 8)}... | ts: ${Date.now()}`);

  _flushAtomicGroup(address, entries)
    .then((txIds) => {
      console.log(`[BATCH-DEBUG] flush complete | txIds: [${txIds.map(t => t.slice(0, 8)).join(",")}] | ts: ${Date.now()}`);
      _txnStatusCallback?.("confirmed", { count: entries.length, txIds });
    })
    .catch((err) => {
      const msg = (err as Error)?.message || String(err);
      console.error(`[BATCH-DEBUG] flush FAILED | error: ${msg} | re-queuing ${entries.length} entries | ts: ${Date.now()}`);
      if (!msg.includes("cancelled") && !msg.includes("rejected")) {
        _txnQueue.unshift(...entries);
      }
      _txnStatusCallback?.("error", { count: entries.length, message: msg });
    })
    .finally(() => {
      _txnFlushInProgress = false;
    });
}

async function _flushAtomicGroup(
  fromAddress: string,
  entries: TxnQueueEntry[]
): Promise<string[]> {
  const suggestedParams = await getTransactionParams();
  const allTxIds: string[] = [];

  const chunks: TxnQueueEntry[][] = [];
  for (let i = 0; i < entries.length; i += MAX_GROUP_SIZE) {
    chunks.push(entries.slice(i, i + MAX_GROUP_SIZE));
  }

  for (const chunk of chunks) {
    const txns = chunk.map((entry) => {
      return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: fromAddress,
        receiver: fromAddress,
        amount: 0,
        note: _buildActionNote(entry.action, fromAddress),
        suggestedParams,
      });
    });

    if (txns.length > 1) {
      algosdk.assignGroupID(txns);
      console.log(`[BATCH-DEBUG] assignGroupID applied | groupSize: ${txns.length} | ts: ${Date.now()}`);
    }

    _txnStatusCallback?.("submitting", { count: txns.length });

    const signedBlobs = txns.length === 1
      ? await signTransactionWithActiveWallet(txns[0], fromAddress)
      : await signGroupedTransactionsWithActiveWallet(txns, fromAddress);

    console.log(`[BATCH-DEBUG] signed ${signedBlobs.length} blob(s) → submitting to algod | ts: ${Date.now()}`);
    const response = await algodClient.sendRawTransaction(signedBlobs).do();
    const firstTxId = response.txid || txns[0].txID();
    await algosdk.waitForConfirmation(algodClient, firstTxId, 4);
    console.log(`[BATCH-DEBUG] group confirmed | firstTxId: ${firstTxId} | ts: ${Date.now()}`);
    allTxIds.push(firstTxId);
  }

  return allTxIds;
}

export function getTxnQueueSize(): number {
  return _txnQueue.length;
}

export function registerBatchSignCallback(
  address: string,
  _callback: unknown
) {
  registerTxnQueueAddress(address);
}
