import { WalletManager, WalletId, NetworkId } from "@txnlab/use-wallet";

export const walletManager = new WalletManager({
  wallets: [
    WalletId.PERA,
    WalletId.DEFLY,
    WalletId.KIBISIS,
    WalletId.LUTE,
  ],
  defaultNetwork: NetworkId.TESTNET,
});
