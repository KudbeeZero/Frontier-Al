/**
 * server/services/chain/client.ts
 *
 * Algorand client factory for the FRONTIER Chain Service.
 * Single source of truth for algod/indexer configuration.
 * No route logic, no game logic — only client construction.
 */

import algosdk from "algosdk";
import type { ChainNetwork } from "./types";

export function assertChainConfig(): void {
  const isProd = process.env.NODE_ENV === 'production';

  // PUBLIC_BASE_URL can be derived from REPLIT_DOMAINS in dev
  if (!process.env.PUBLIC_BASE_URL && process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',')[0].trim();
    process.env.PUBLIC_BASE_URL = `https://${domains}`;
    console.log(`[FRONTIER] PUBLIC_BASE_URL auto-set from REPLIT_DOMAINS: ${process.env.PUBLIC_BASE_URL}`);
  }

  const alwaysRequired = ['DATABASE_URL', 'SESSION_SECRET', 'PUBLIC_BASE_URL'];
  const chainRequired = ['ALGORAND_ADMIN_MNEMONIC', 'ALGORAND_ADMIN_ADDRESS'];

  const missingCore = alwaysRequired.filter(k => !process.env[k]);
  if (missingCore.length > 0) {
    throw new Error(`[FRONTIER] Missing required secrets: ${missingCore.join(', ')}`);
  }

  const missingChain = chainRequired.filter(k => !process.env[k]);
  if (missingChain.length > 0) {
    if (isProd) {
      throw new Error(`[FRONTIER] Missing required secrets: ${missingChain.join(', ')}`);
    }
    console.warn(`[FRONTIER] WARNING: Missing chain secrets (blockchain features disabled): ${missingChain.join(', ')}`);
  }

  const network = process.env.ALGORAND_NETWORK;
  if (!network) {
    if (isProd) {
      throw new Error('[FRONTIER] ALGORAND_NETWORK must be set explicitly in production. Set to "mainnet" or "testnet".');
    }
    console.warn('[FRONTIER] WARNING: ALGORAND_NETWORK not set. Defaulting to testnet.');
  } else {
    console.log(`[FRONTIER] Network: ${network}`);
  }
}

// Override with env vars to switch networks without code changes.
const ALGOD_URL     = process.env.ALGOD_URL     ?? "https://testnet-api.algonode.cloud";
const INDEXER_URL   = process.env.INDEXER_URL   ?? "https://testnet-idx.algonode.cloud";
const ALGOD_TOKEN   = process.env.ALGOD_TOKEN   ?? "";
const INDEXER_TOKEN = process.env.INDEXER_TOKEN ?? "";

// Lazily constructed singletons — avoids constructing clients if blockchain
// features are disabled (e.g. test environments without ALGORAND_ADMIN_MNEMONIC).
let _algodClient:   algosdk.Algodv2  | null = null;
let _indexerClient: algosdk.Indexer  | null = null;

export function getAlgodClient(): algosdk.Algodv2 {
  if (!_algodClient) {
    _algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, "");
  }
  return _algodClient;
}

export function getIndexerClient(): algosdk.Indexer {
  if (!_indexerClient) {
    _indexerClient = new algosdk.Indexer(INDEXER_TOKEN, INDEXER_URL, "");
  }
  return _indexerClient;
}

export function getNetwork(): ChainNetwork {
  const raw = process.env.ALGORAND_NETWORK ?? "testnet";
  if (raw === "mainnet" || raw === "localnet" || raw === "testnet") return raw;
  console.warn(`[chain/client] Unknown ALGORAND_NETWORK="${raw}", defaulting to testnet`);
  return "testnet";
}

/**
 * Retrieve and memoize the admin Algorand account from ALGORAND_ADMIN_MNEMONIC.
 * Throws if the env var is not set.
 */
let _adminAccount: algosdk.Account | null = null;

export function getAdminAccount(): algosdk.Account {
  if (_adminAccount) return _adminAccount;
  const mnemonic = process.env.ALGORAND_ADMIN_MNEMONIC;
  if (!mnemonic) throw new Error("[chain/client] ALGORAND_ADMIN_MNEMONIC not set");
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
    return process.env.ALGORAND_ADMIN_ADDRESS ?? "";
  }
}

export async function getAdminBalance(frontierAsaId?: number | null): Promise<{ algo: number; frontierAsa: number }> {
  try {
    const account     = getAdminAccount();
    const algod       = getAlgodClient();
    const accountInfo = await algod.accountInformation(account.addr.toString()).do();
    const algoBalance = Number(accountInfo.amount) / 1_000_000;

    let frontierAsa = 0;
    if (frontierAsaId) {
      const assets: any[] = (accountInfo as any).assets ?? [];
      const assetEntry = Array.isArray(assets)
        ? assets.find((a: any) => Number(a.assetId ?? a["asset-id"] ?? a.assetIndex) === frontierAsaId)
        : undefined;
      if (assetEntry) {
        frontierAsa = Number(assetEntry.amount ?? 0) / 1_000_000;
      }
    }

    return { algo: algoBalance, frontierAsa };
  } catch (err) {
    console.error("[chain/client] getAdminBalance failed:", err);
    return { algo: 0, frontierAsa: 0 };
  }
}
