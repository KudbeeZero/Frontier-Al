import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useWallet as useWalletLib } from "@txnlab/use-wallet-react";
import {
  getAccountBalance,
  formatAddress,
  fetchBlockchainStatus,
  registerWalletSigner,
} from "@/lib/algorand";

type WalletStatus = "restoring" | "connected" | "disconnected";

export interface WalletInfo {
  id: string;
  name: string;
  icon: string;
  isConnected: boolean;
  isActive: boolean;
}

interface WalletState {
  isConnected: boolean;
  walletStatus: WalletStatus;
  address: string | null;
  displayAddress: string | null;
  balance: number;
  isConnecting: boolean;
  error: string | null;
  walletType: string | null;
  signerReady: boolean;
  blockchainReady: boolean;
}

interface WalletContextValue extends WalletState {
  isReady: boolean;
  availableWallets: WalletInfo[];
  connect: (walletId: string) => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

interface WalletProviderProps {
  children: ReactNode;
  enableAutoConnect?: boolean;
}

export function WalletProvider({ children, enableAutoConnect = false }: WalletProviderProps) {
  const hasSavedWallet = !!(localStorage.getItem("frontier_wallet_type"));

  const [state, setState] = useState<WalletState>({
    isConnected: false,
    walletStatus: hasSavedWallet && enableAutoConnect ? "restoring" : "disconnected",
    address: null,
    displayAddress: null,
    balance: 0,
    isConnecting: false,
    error: null,
    walletType: null,
    signerReady: false,
    blockchainReady: false,
  });

  const [balance, setBalance] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockchainReady, setBlockchainReady] = useState(false);
  // Brief restoring window so GameLayout can show the reconnecting spinner
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    fetchBlockchainStatus().then((status) => {
      setBlockchainReady(status.ready || !!status.adminAddress);
    });
    // Give use-wallet ~800ms to restore any saved session before we declare "disconnected"
    const timer = setTimeout(() => setIsInitialized(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Register/unregister the signer whenever the active wallet changes
  useEffect(() => {
    if (!enableAutoConnect || isReconnecting.current) return;
    isReconnecting.current = true;

    const savedType = localStorage.getItem("frontier_wallet_type") as WalletType | null;
    const savedAddress = localStorage.getItem("frontier_wallet_address");

    if (savedType === "lute" && savedAddress) {
      luteWallet
        .connect(ALGORAND_TESTNET.genesisID)
        .then((accounts) => {
          const addr = accounts.length > 0 ? accounts[0] : savedAddress;
          setActiveWalletType("lute");
          localStorage.setItem("frontier_wallet_address", addr);
          localStorage.setItem("frontier_onboarded_v1", "1");
          setState((prev) => ({
            ...prev,
            isConnected: true,
            walletStatus: "connected",
            address: addr,
            displayAddress: formatAddress(addr),
            balance: 0,
            isConnecting: false,
            error: null,
            walletType: "lute",
            signerReady: true,
          }));
          updateBalance(addr);
        })
        .catch((err) => {
          console.warn("LUTE reconnection failed, clearing saved state:", err);
          localStorage.removeItem("frontier_wallet_type");
          localStorage.removeItem("frontier_wallet_address");
          setState((prev) => ({ ...prev, walletStatus: "disconnected" }));
        })
        .finally(() => {
          isReconnecting.current = false;
        });
      return;
    }
  }, [activeAddress, signTransactions]);

  // Refresh balance whenever the active address changes
  useEffect(() => {
    if (activeAddress) {
      getAccountBalance(activeAddress).then(setBalance);
    } else {
      setBalance(0);
    }
  }, [activeAddress]);

  const refreshBalance = useCallback(async () => {
    if (activeAddress) {
      const b = await getAccountBalance(activeAddress);
      setBalance(b);
    }
  }, [activeAddress]);

  const connect = useCallback(async (walletId: string) => {
    setIsConnecting(true);
    setError(null);
    try {
      const wallet = wallets.find((w) => w.id === walletId);
      if (!wallet) throw new Error(`Wallet ${walletId} not configured`);
      await wallet.connect();
    } catch (err: unknown) {
      const e = err as { message?: string; data?: { type?: string } };
      const msg = e?.message || "";
      // Ignore modal-closed / user-cancelled errors
      if (!msg.toLowerCase().includes("cancel") && e?.data?.type !== "CONNECT_MODAL_CLOSED") {
        setError(msg || "Failed to connect wallet");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [wallets]);

  const disconnect = useCallback(() => {
    const activeWallet = wallets.find((w) => w.isActive);
    activeWallet?.disconnect();
    setError(null);
    setBalance(0);
    registerWalletSigner(null);
  }, [wallets]);

  const isConnected = !!activeAddress;
  const signerReady = isConnected;
  const activeWallet = wallets.find((w) => w.isActive) ?? null;
  const walletType = activeWallet?.id ?? null;

  const walletStatus: WalletStatus = !isInitialized
    ? "restoring"
    : isConnected
    ? "connected"
    : "disconnected";

  const availableWallets: WalletInfo[] = wallets.map((w) => ({
    id: w.id,
    name: w.metadata.name,
    icon: w.metadata.icon,
    isConnected: w.isConnected,
    isActive: w.isActive,
  }));

  const isReady = isConnected && signerReady && !!activeAddress;

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        walletStatus,
        address: activeAddress ?? null,
        displayAddress: activeAddress ? formatAddress(activeAddress) : null,
        balance,
        isConnecting,
        error,
        walletType,
        signerReady,
        blockchainReady,
        isReady,
        availableWallets,
        connect,
        disconnect,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  return <InnerWalletProvider>{children}</InnerWalletProvider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
