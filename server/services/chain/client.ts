/**

- server/services/chain/client.ts
- 
- Algorand client factory for the FRONTIER Chain Service.
- Single source of truth for algod/indexer configuration.
- No route logic, no game logic — only client construction.
  */

import algosdk from “algosdk”;
import type { ChainNetwork } from “./types.js”;

// Override with env vars to switch networks without code changes.
const ALGOD_URL     = process.env.ALGOD_URL     ?? “https://testnet-api.algonode.cloud”;
const INDEXER_URL   = process.env.INDEXER_URL   ?? “https://testnet-idx.algonode.cloud”;
const ALGOD_TOKEN   = process.env.ALGOD_TOKEN   ?? “”;
const INDEXER_TOKEN = process.env.INDEXER_TOKEN ?? “”;

// Lazily constructed singletons — avoids constructing clients if blockchain
// features are disabled (e.g. test environments without ALGORAND_ADMIN_MNEMONIC).
let _algodClient:   algosdk.Algodv2  | null = null;
let _indexerClient: algosdk.Indexer  | null = null;

export function getAlgodClient(): algosdk.Algodv2 {
if (!_algodClient) {
_algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, “”);
}
return _algodClient;
}

export function getIndexerClient(): algosdk.Indexer {
if (!_indexerClient) {
_indexerClient = new algosdk.Indexer(INDEXER_TOKEN, INDEXER_URL, “”);
}
return _indexerClient;
}

export function getNetwork(): ChainNetwork {
const raw = process.env.ALGORAND_NETWORK ?? “testnet”;
if (raw === “mainnet” || raw === “localnet” || raw === “testnet”) return raw;
console.warn(`[chain/client] Unknown ALGORAND_NETWORK="${raw}", defaulting to testnet`);
return “testnet”;
}

/**

- Retrieve and memoize the admin Algorand account from ALGORAND_ADMIN_MNEMONIC.
- Throws if the env var is not set.
  */
  let _adminAccount: algosdk.Account | null = null;

export function getAdminAccount(): algosdk.Account {
if (_adminAccount) return _adminAccount;
const mnemonic = process.env.ALGORAND_ADMIN_MNEMONIC;
if (!mnemonic) throw new Error(”[chain/client] ALGORAND_ADMIN_MNEMONIC not set”);
_adminAccount = algosdk.mnemonicToSecretKey(mnemonic);

const expected = process.env.ALGORAND_ADMIN_ADDRESS;
if (expected && _adminAccount.addr.toString() !== expected) {
console.warn(
`[chain/client] Admin address mismatch: derived=${_adminAccount.addr.toString()} expected=${expected}`
);
}
return _adminAccount;
}

export function getAdminAddress(): string {
try {
return getAdminAccount().addr.toString();
} catch {
return process.env.ALGORAND_ADMIN_ADDRESS ?? “”;
}
}

export async function getAdminBalance(): Promise<{ algo: number; frontierAsa: number }> {
try {
const account     = getAdminAccount();
const algod       = getAlgodClient();
const accountInfo = await algod.accountInformation(account.addr.toString()).do();
const algoBalance = Number(accountInfo.amount) / 1_000_000;

```
// frontierAsa balance is populated by the asa module caller if needed.
return { algo: algoBalance, frontierAsa: 0 };
```

} catch (err) {
console.error(”[chain/client] getAdminBalance failed:”, err);
return { algo: 0, frontierAsa: 0 };
}
}