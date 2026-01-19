import algosdk from "algosdk";
import { PeraWalletConnect } from "@perawallet/connect";

export const ALGORAND_TESTNET = {
  chainId: 416002 as const,
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

  const singleTxnGroups = [{ txn, signers: [fromAddress] }];
  const signedTxn = await peraWallet.signTransaction([singleTxnGroups]);
  
  const response = await algodClient.sendRawTransaction(signedTxn).do();
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

  const singleTxnGroups = [{ txn, signers: [fromAddress] }];
  const signedTxn = await peraWallet.signTransaction([singleTxnGroups]);
  
  const response = await algodClient.sendRawTransaction(signedTxn).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  
  return txId;
}

export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}
