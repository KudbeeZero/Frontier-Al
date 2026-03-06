/**
 * server/services/chain/land.ts
 *
 * FRONTIER Land NFT (Plot ASA) mint and transfer service.
 *
 * Custodian mode: A freshly-minted ASA can never be received by the buyer
 * immediately — they would have had to opt-in before the ASA existed, which
 * is impossible.  The NFT is therefore always held by the admin (custodian)
 * address after minting.  The buyer calls POST /api/nft/deliver/:plotId after
 * opting in (zero-amount self-transfer of the specific ASA) to receive it.
 *
 * DB columns required (handled by caller, not this module):
 *   plot_nfts.asset_id           — on-chain ASA ID
 *   plot_nfts.minted_to_address  — current on-chain holder (admin until delivery)
 *
 * No UI imports. No route logic. No game state.
 */

import algosdk from "algosdk";
import { getAlgodClient, getAdminAccount, getNetwork } from "./client";
import type { MintLandParams, TransferLandParams, MintResult, AssetId } from "./types";

// ── Mint ──────────────────────────────────────────────────────────────────────

/**
 * Mint a FRONTIER Plot NFT (1-of-1 Algorand ASA).
 *
 * The NFT is always held in admin custody after creation — the buyer cannot
 * have opted into an ASA that did not exist before this call.
 *
 * Idempotency: caller must check the DB for an existing record BEFORE calling
 * this function. This function does NOT query the DB.
 */
export async function mintLandNft(params: MintLandParams): Promise<MintResult> {
  const { plotId, receiverAddress, metadataBaseUrl } = params;
  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const network = getNetwork();

  // Strip trailing slash from metadata base URL to avoid double-slash in assetURL.
  const baseUrl = metadataBaseUrl.replace(/\/+$/, "");

  // ── Create the NFT ASA ─────────────────────────────────────────────────────
  const createSp = await algod.getTransactionParams().do();

  const createTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender:         account.addr.toString(),
    total:          BigInt(1),
    decimals:       0,
    defaultFrozen:  false,
    unitName:       "PLOT",
    assetName:      `Frontier Plot #${plotId}`,
    assetURL:       `${baseUrl}/nft/metadata/${plotId}`,
    // On TestNet: all roles set to admin for recovery.
    // Production mainnet: freeze and clawback should be empty strings ("").
    manager:        account.addr.toString(),
    reserve:        account.addr.toString(),
    freeze:         network === "mainnet" ? undefined : account.addr.toString(),
    clawback:       network === "mainnet" ? undefined : account.addr.toString(),
    suggestedParams: createSp,
    note:           new TextEncoder().encode(`FRONTIER Plot NFT #${plotId} - ${network}`),
  });

  const signedCreate   = createTxn.signTxn(account.sk);
  const createResponse = await algod.sendRawTransaction(signedCreate).do();
  const createTxId     = createResponse.txid || createTxn.txID();

  const confirmedCreate = await algosdk.waitForConfirmation(algod, createTxId, 2);
  const assetId: AssetId = Number(
    (confirmedCreate as any).assetIndex ?? (confirmedCreate as any)["asset-index"]
  );

  if (!assetId) {
    throw new Error(`[chain/land] mintLandNft: no assetIndex in confirmed create tx ${createTxId} for plotId=${plotId}`);
  }

  console.log(
    `[chain/land] plotId=${plotId} ASA created assetId=${assetId} txId=${createTxId}` +
    ` | custody: admin holds until buyer opts in (receiverAddress=${receiverAddress})`
  );

  // NFT stays in admin custody. Buyer calls POST /api/nft/deliver/:plotId after
  // opting into ASA ${assetId} in their wallet.
  return {
    assetId,
    createTxId,
    transferTxId:   undefined,
    custodyHeld:    true,
    mintedToAddress: account.addr.toString(),
  };
}

// ── Transfer ──────────────────────────────────────────────────────────────────

/**
 * Transfer an already-minted Plot NFT from admin to a receiver.
 * Used when:
 *   - Buyer opts in after initial custody-held mint
 *   - Admin-initiated secondary delivery
 *
 * Caller must verify the receiver has opted into the ASA before calling this.
 */
export async function transferLandNft(params: TransferLandParams): Promise<{ txId: string }> {
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
    note:            new TextEncoder().encode(note ?? `FRONTIER Land NFT transfer to ${toAddress}`),
  });

  const signed   = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signed).do();
  const txId     = response.txid || txn.txID();

  await algosdk.waitForConfirmation(algod, txId, 2);

  console.log(`[chain/land] Transferred assetId=${assetId} to ${toAddress} txId=${txId}`);
  return { txId };
}
