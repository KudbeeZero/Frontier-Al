/**
 * server/services/chain/types.ts
 *
 * Pure type definitions for the FRONTIER Chain Service.
 * No algosdk imports, no DB imports — only serializable contracts.
 */

export type ChainNetwork = "testnet" | "mainnet" | "localnet";

export type AssetId = number;
export type TxId    = string;

/** Parameters for creating a new Algorand Standard Asset. */
export interface CreateAsaParams {
  name:         string;
  unitName:     string;
  total:        bigint;
  decimals:     number;
  url?:         string;
  note?:        string;
  manager?:     string; // defaults to admin address
  reserve?:     string;
  freeze?:      string;
  clawback?:    string;
}

/** Parameters for minting a FRONTIER Plot NFT. */
export interface MintLandParams {
  plotId:          number;
  receiverAddress: string; // Algorand wallet address of the buyer
  metadataBaseUrl: string; // PUBLIC_BASE_URL — baked permanently into on-chain ASA
}

/** Parameters for transferring an already-minted Plot NFT. */
export interface TransferLandParams {
  assetId:   AssetId;
  toAddress: string;
  note?:     string;
}

/** Result of a successful mint operation. */
export interface MintResult {
  assetId:          AssetId;
  createTxId:       TxId;
  transferTxId?:    TxId;   // undefined if buyer not yet opted in
  custodyHeld:      boolean; // true when admin holds NFT pending buyer opt-in
  mintedToAddress:  string;  // actual current holder (admin or buyer)
}

/** Idempotency record stored in DB. */
export type MintStatus = "pending" | "confirmed" | "failed";

export interface MintIdempotencyKey {
  key:     string;  // "mint:{playerId}:{plotId}"
  status:  MintStatus;
  assetId: AssetId | null;
  txId:    TxId    | null;
  createdAt: number; // Unix ms
  updatedAt: number;
}
