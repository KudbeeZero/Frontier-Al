import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  peraWallet,
  luteWallet,
  getAccountBalance,
  formatAddress,
  setActiveWalletType,
  ALGORAND_TESTNET,
  type WalletType,
} from "@/lib/algorand";

interface WalletState {
  isConnected: boolean;
  address: string | null;
  displayAddress: string | null;
  balance: number;
  isConnecting: boolean;
  error: string | null;
  walletType: WalletType | null;
}

interface WalletContextValue extends WalletState {
  connectPera: () => Promise<void>;
  connectLute: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    displayAddress: null,
    balance: 0,
    isConnecting: false,
    error: null,
    walletType: null,
  });
  
  const isReconnecting = useRef(false);

  const handleDisconnect = useCallback(() => {
    setActiveWalletType(null);
    localStorage.removeItem("frontier_wallet_type");
    localStorage.removeItem("frontier_wallet_address");
    setState({
      isConnected: false,
      address: null,
      displayAddress: null,
      balance: 0,
      isConnecting: false,
      error: null,
      walletType: null,
    });
  }, []);

  const updateBalance = useCallback(async (address: string) => {
    const balance = await getAccountBalance(address);
    setState((prev) => ({ ...prev, balance }));
  }, []);

  const setConnected = useCallback((address: string, walletType: WalletType, balance: number) => {
    setActiveWalletType(walletType);
    localStorage.setItem("frontier_wallet_type", walletType);
    localStorage.setItem("frontier_wallet_address", address);
    setState({
      isConnected: true,
      address,
      displayAddress: formatAddress(address),
      balance,
      isConnecting: false,
      error: null,
      walletType,
    });
  }, []);

  useEffect(() => {
    if (isReconnecting.current) return;
    isReconnecting.current = true;

    const savedType = localStorage.getItem("frontier_wallet_type") as WalletType | null;
    const savedAddress = localStorage.getItem("frontier_wallet_address");

    if (savedType === "lute" && savedAddress) {
      setActiveWalletType("lute");
      setState({
        isConnected: true,
        address: savedAddress,
        displayAddress: formatAddress(savedAddress),
        balance: 0,
        isConnecting: false,
        error: null,
        walletType: "lute",
      });
      updateBalance(savedAddress);
      isReconnecting.current = false;
      return;
    }

    peraWallet
      .reconnectSession()
      .then((accounts) => {
        peraWallet.connector?.on("disconnect", handleDisconnect);
        
        if (accounts.length > 0) {
          const address = accounts[0];
          setActiveWalletType("pera");
          localStorage.setItem("frontier_wallet_type", "pera");
          localStorage.setItem("frontier_wallet_address", address);
          setState({
            isConnected: true,
            address,
            displayAddress: formatAddress(address),
            balance: 0,
            isConnecting: false,
            error: null,
            walletType: "pera",
          });
          updateBalance(address);
        }
      })
      .catch((error) => {
        console.error("Session reconnection failed:", error);
      })
      .finally(() => {
        isReconnecting.current = false;
      });
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

  return (
    <WalletContext.Provider value={{
      ...state,
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
