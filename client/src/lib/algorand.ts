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
      encodedTxn += String.fromCharCode(...bytes.slice(i, i + chunk));
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
  actionType: "mine" | "upgrade" | "attack" | "claim",
  parcelId: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const suggestedParams = await getTransactionParams();
  
  const actionData = JSON.stringify({
    action: actionType,
    parcelId,
    timestamp: Date.now(),
    ...metadata,
  });
  
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: fromAddress,
    receiver: fromAddress,
    amount: 0,
    note: new TextEncoder().encode(`FRONTIER:${actionData}`),
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
    const accountInfo = await algodClient.accountInformation(address).do();
    const assets = accountInfo.assets || [];
    return assets.some((a: any) => (a.assetIndex ?? a["asset-id"]) === assetId);
  } catch {
    return false;
  }
}

export async function createPurchaseTransaction(
  fromAddress: string,
  parcelId: string,
  ironCost: number,
  fuelCost: number
): Promise<string> {
  return createGameActionTransaction(fromAddress, "claim", parcelId, {
    type: "purchase",
    ironCost,
    fuelCost,
  });
}

export async function createBuildTransaction(
  fromAddress: string,
  parcelId: string,
  improvementType: string
): Promise<string> {
  return createGameActionTransaction(fromAddress, "upgrade", parcelId, {
    type: "build",
    improvementType,
  });
}
