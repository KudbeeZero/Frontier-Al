/**

- server/services/chain/land.ts
- 
- FRONTIER Land NFT (Plot ASA) mint and transfer service.
- 
- Custodian mode: When a buyer has not yet opted into the freshly-minted ASA
- (which is always the case — they can’t opt in until the ASA exists),
- the NFT is held by the admin (custodian) address until the buyer opts in
- and an admin transfer completes the delivery.
- 
- DB columns required (handled by caller, not this module):
- plot_nfts.asset_id           — on-chain ASA ID
- plot_nfts.minted_to_address  — current on-chain holder
- players.custody_owner_player_id — (future) for full custody tracking
- 
- No UI imports. No route logic. No game state.
  */

import algosdk from “algosdk”;
import { getAlgodClient, getAdminAccount, getNetwork } from “./client.js”;
import type { MintLandParams, TransferLandParams, MintResult, AssetId } from “./types.js”;

// ── Mint ──────────────────────────────────────────────────────────────────────

/**

- Mint a FRONTIER Plot NFT (1-of-1 Algorand ASA) and attempt to transfer
- it to the buyer. If the buyer has not opted in yet, the NFT is held by
- the admin (custodian) and `custodyHeld` is set to true.
- 
- Idempotency: caller must check the DB for an existing record BEFORE calling
- this function. This function does NOT query the DB.
  */
  export async function mintLandNft(params: MintLandParams): Promise<MintResult> {
  const { plotId, receiverAddress, metadataBaseUrl } = params;
  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const network = getNetwork();

// ── Step 1: Create the NFT ASA ────────────────────────────────────────────
const createSp = await algod.getTransactionParams().do();

const createTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
sender:         account.addr.toString(),
total:          BigInt(1),
decimals:       0,
defaultFrozen:  false,
unitName:       “PLOT”,
assetName:      `Frontier Plot #${plotId}`,
assetURL:       `${metadataBaseUrl}/nft/metadata/${plotId}`,
// On TestNet: all roles set to admin for recovery.
// Production mainnet: freeze and clawback should be empty strings (””).
manager:        account.addr.toString(),
reserve:        account.addr.toString(),
freeze:         network === “mainnet” ? undefined : account.addr.toString(),
clawback:       network === “mainnet” ? undefined : account.addr.toString(),
suggestedParams: createSp,
note:           new TextEncoder().encode(`FRONTIER Plot NFT #${plotId} - ${network}`),
});

const signedCreate   = createTxn.signTxn(account.sk);
const createResponse = await algod.sendRawTransaction(signedCreate).do();
const createTxId     = createResponse.txid || createTxn.txID();

const confirmedCreate = await algosdk.waitForConfirmation(algod, createTxId, 4);
const assetId: AssetId = Number(
(confirmedCreate as any).assetIndex ?? (confirmedCreate as any)[“asset-index”]
);

if (!assetId) {
throw new Error(`[chain/land] mintLandNft: no assetIndex in confirmed create tx ${createTxId} for plotId=${plotId}`);
}

console.log(`[chain/land] plotId=${plotId} ASA created assetId=${assetId} txId=${createTxId}`);

// ── Step 2: Attempt transfer to buyer ─────────────────────────────────────
// The buyer cannot have opted in to this ASA yet (it was just created),
// so this step will typically fail on the first purchase. The assetId is
// recorded regardless; buyer opts in later and admin delivers on-chain.

let transferTxId: string | undefined;
let mintedToAddress  = account.addr.toString(); // admin holds by default
let custodyHeld      = true;

try {
const transferSp  = await algod.getTransactionParams().do();
const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
sender:          account.addr.toString(),
receiver:        receiverAddress,
amount:          1,
assetIndex:      assetId,
suggestedParams: transferSp,
note:            new TextEncoder().encode(`FRONTIER Plot #${plotId} NFT to buyer`),
});

```
const signedTransfer   = transferTxn.signTxn(account.sk);
const transferResponse = await algod.sendRawTransaction(signedTransfer).do();
transferTxId           = transferResponse.txid || transferTxn.txID();

await algosdk.waitForConfirmation(algod, transferTxId, 4);

mintedToAddress = receiverAddress;
custodyHeld     = false;

console.log(`[chain/land] plotId=${plotId} NFT transferred to ${receiverAddress} txId=${transferTxId}`);
```

} catch (err) {
console.warn(
`[chain/land] plotId=${plotId} Transfer to ${receiverAddress} failed — ` +
`buyer likely not opted in to assetId=${assetId}. NFT held by admin (custodian mode).`,
err instanceof Error ? err.message : err
);
}

return {
assetId,
createTxId,
transferTxId,
custodyHeld,
mintedToAddress,
};
}

// ── Transfer ──────────────────────────────────────────────────────────────────

/**

- Transfer an already-minted Plot NFT from admin to a receiver.
- Used when:
- - Buyer opts in after initial custody-held mint
- - Admin-initiated secondary delivery
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

await algosdk.waitForConfirmation(algod, txId, 4);

console.log(`[chain/land] Transferred assetId=${assetId} to ${toAddress} txId=${txId}`);
return { txId };
}