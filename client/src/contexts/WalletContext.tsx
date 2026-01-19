import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { peraWallet, getAccountBalance, formatAddress } from "@/lib/algorand";

interface WalletState {
  isConnected: boolean;
  address: string | null;
  displayAddress: string | null;
  balance: number;
  isConnecting: boolean;
  error: string | null;
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
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
  });
  
  const isReconnecting = useRef(false);

  const handleDisconnect = useCallback(() => {
    setState({
      isConnected: false,
      address: null,
      displayAddress: null,
      balance: 0,
      isConnecting: false,
      error: null,
    });
  }, []);

  const updateBalance = useCallback(async (address: string) => {
    const balance = await getAccountBalance(address);
    setState((prev) => ({ ...prev, balance }));
  }, []);

  useEffect(() => {
    if (isReconnecting.current) return;
    isReconnecting.current = true;

    peraWallet
      .reconnectSession()
      .then((accounts) => {
        peraWallet.connector?.on("disconnect", handleDisconnect);
        
        if (accounts.length > 0) {
          const address = accounts[0];
          setState({
            isConnected: true,
            address,
            displayAddress: formatAddress(address),
            balance: 0,
            isConnecting: false,
            error: null,
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

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      const accounts = await peraWallet.connect();
      peraWallet.connector?.on("disconnect", handleDisconnect);
      
      if (accounts.length > 0) {
        const address = accounts[0];
        const balance = await getAccountBalance(address);
        
        setState({
          isConnected: true,
          address,
          displayAddress: formatAddress(address),
          balance,
          isConnecting: false,
          error: null,
        });
      }
    } catch (error: unknown) {
      const err = error as { data?: { type?: string }; message?: string };
      if (err?.data?.type !== "CONNECT_MODAL_CLOSED") {
        console.error("Wallet connection failed:", error);
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          error: err?.message || "Failed to connect wallet",
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
        }));
      }
    }
  }, [handleDisconnect]);

  const disconnect = useCallback(() => {
    peraWallet.disconnect();
    handleDisconnect();
  }, [handleDisconnect]);

  const refreshBalance = useCallback(async () => {
    if (state.address) {
      await updateBalance(state.address);
    }
  }, [state.address, updateBalance]);

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect, refreshBalance }}>
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
