import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  peraWallet,
  luteWallet,
  getAccountBalance,
  formatAddress,
  setActiveWalletType,
  getActiveWalletType,
  ALGORAND_TESTNET,
  fetchBlockchainStatus,
  type WalletType,
} from "@/lib/algorand";

type WalletStatus = "restoring" | "connected" | "disconnected";

interface WalletState {
  isConnected: boolean;
  walletStatus: WalletStatus;
  address: string | null;
  displayAddress: string | null;
  balance: number;
  isConnecting: boolean;
  error: string | null;
  walletType: WalletType | null;
  signerReady: boolean;
  blockchainReady: boolean;
}

interface WalletContextValue extends WalletState {
  isReady: boolean;
  connectPera: () => Promise<void>;
  connectLute: () => Promise<void>;
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

  const isReconnecting = useRef(false);

  useEffect(() => {
    fetchBlockchainStatus().then((status) => {
      setState((prev) => ({ ...prev, blockchainReady: status.ready || !!status.adminAddress }));
    });
  }, []);

  const handleDisconnect = useCallback(() => {
    setActiveWalletType(null);
    localStorage.removeItem("frontier_wallet_type");
    localStorage.removeItem("frontier_wallet_address");
    setState((prev) => ({
      ...prev,
      isConnected: false,
      walletStatus: "disconnected" as WalletStatus,
      address: null,
      displayAddress: null,
      balance: 0,
      isConnecting: false,
      error: null,
      walletType: null,
      signerReady: false,
    }));
  }, []);

  const updateBalance = useCallback(async (address: string) => {
    const balance = await getAccountBalance(address);
    setState((prev) => ({ ...prev, balance }));
  }, []);

  const setConnected = useCallback((address: string, walletType: WalletType, balance: number) => {
    setActiveWalletType(walletType);
    localStorage.setItem("frontier_wallet_type", walletType);
    localStorage.setItem("frontier_wallet_address", address);
    localStorage.setItem("frontier_onboarded_v1", "1");
    setState((prev) => ({
      ...prev,
      isConnected: true,
      walletStatus: "connected" as WalletStatus,
      address,
      displayAddress: formatAddress(address),
      balance,
      isConnecting: false,
      error: null,
      walletType,
      signerReady: true,
    }));
  }, []);

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

    if (savedType === "pera") {
      peraWallet
        .reconnectSession()
        .then((accounts) => {
          peraWallet.connector?.on("disconnect", handleDisconnect);

          if (accounts.length > 0) {
            const address = accounts[0];
            setActiveWalletType("pera");
            localStorage.setItem("frontier_wallet_type", "pera");
            localStorage.setItem("frontier_wallet_address", address);
            localStorage.setItem("frontier_onboarded_v1", "1");
            setState((prev) => ({
              ...prev,
              isConnected: true,
              walletStatus: "connected" as WalletStatus,
              address,
              displayAddress: formatAddress(address),
              balance: 0,
              isConnecting: false,
              error: null,
              walletType: "pera",
              signerReady: true,
            }));
            updateBalance(address);
          } else {
            localStorage.removeItem("frontier_wallet_type");
            localStorage.removeItem("frontier_wallet_address");
            setState((prev) => ({ ...prev, walletStatus: "disconnected" as WalletStatus }));
          }
        })
        .catch((error) => {
          console.error("Pera session reconnection failed:", error);
          localStorage.removeItem("frontier_wallet_type");
          localStorage.removeItem("frontier_wallet_address");
          setState((prev) => ({ ...prev, walletStatus: "disconnected" as WalletStatus }));
        })
        .finally(() => {
          isReconnecting.current = false;
        });
    } else {
      isReconnecting.current = false;
      setState((prev) => ({ ...prev, walletStatus: "disconnected" as WalletStatus }));
    }
  }, [handleDisconnect, updateBalance]);

  const connectPera = useCallback(async () => {
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const accounts = await peraWallet.connect();
      peraWallet.connector?.on("disconnect", handleDisconnect);

      if (accounts.length > 0) {
        const address = accounts[0];
        const balance = await getAccountBalance(address);
        setConnected(address, "pera", balance);
      }
    } catch (error: unknown) {
      const err = error as { data?: { type?: string }; message?: string };
      if (err?.data?.type !== "CONNECT_MODAL_CLOSED") {
        console.error("Pera connection failed:", error);
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          error: err?.message || "Failed to connect Pera Wallet",
        }));
      } else {
        setState((prev) => ({ ...prev, isConnecting: false }));
      }
    }
  }, [handleDisconnect, setConnected]);

  const connectLute = useCallback(async () => {
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const accounts = await luteWallet.connect(ALGORAND_TESTNET.genesisID);

      if (accounts.length > 0) {
        const address = accounts[0];
        const balance = await getAccountBalance(address);
        setConnected(address, "lute", balance);
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("LUTE connection failed:", error);
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: err?.message || "Failed to connect LUTE Wallet",
      }));
    }
  }, [setConnected]);

  const disconnect = useCallback(() => {
    if (state.walletType === "pera") {
      peraWallet.disconnect();
    }
    handleDisconnect();
  }, [state.walletType, handleDisconnect]);

  const refreshBalance = useCallback(async () => {
    if (state.address) {
      await updateBalance(state.address);
    }
  }, [state.address, updateBalance]);

  const isReady = state.isConnected && state.signerReady && !!state.address && !!getActiveWalletType();

  return (
    <WalletContext.Provider value={{
      ...state,
      isReady,
      connectPera,
      connectLute,
      disconnect,
      refreshBalance,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
