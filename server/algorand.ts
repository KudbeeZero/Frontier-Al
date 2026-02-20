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
  return getAdminAccount().addr.toString();
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
    assetURL: "https://frontier-game.replit.app",
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
  const assetId = Number(confirmedTxn.assetIndex ?? confirmedTxn["asset-index"]);

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

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr.toString(),
    receiver: toAddress,
    amount: amountUnits,
    assetIndex: frontierAsaId,
    suggestedParams,
    note: new TextEncoder().encode(`FRONTIER claim: ${amount}`),
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
    const assets = accountInfo.assets || [];
    return assets.some((a: any) => (a.assetIndex ?? a["asset-id"]) === frontierAsaId);
  } catch {
    return false;
  }
}

export async function lookupExistingASA(): Promise<number | null> {
  try {
    const account = getAdminAccount();
    const accountInfo = await algodClient.accountInformation(account.addr.toString()).do();
    const createdAssets = accountInfo["created-assets"] || accountInfo.createdAssets || [];

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
