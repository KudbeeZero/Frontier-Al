import { useState, useCallback, useEffect } from "react";

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: number;
  isConnecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: 0,
    isConnecting: false,
    error: null,
  });

  useEffect(() => {
    const savedAddress = localStorage.getItem("frontier-wallet-address");
    const savedBalance = localStorage.getItem("frontier-wallet-balance");
    if (savedAddress) {
      setState({
        isConnected: true,
        address: savedAddress,
        balance: savedBalance ? parseFloat(savedBalance) : 1000,
        isConnecting: false,
        error: null,
      });
    }
  }, []);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const mockAddress = `ALGO${Math.random().toString(36).substring(2, 10).toUpperCase()}...${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const mockBalance = Math.floor(Math.random() * 9000) + 1000;
      
      localStorage.setItem("frontier-wallet-address", mockAddress);
      localStorage.setItem("frontier-wallet-balance", mockBalance.toString());
      
      setState({
        isConnected: true,
        address: mockAddress,
        balance: mockBalance,
        isConnecting: false,
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: "Failed to connect wallet",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem("frontier-wallet-address");
    localStorage.removeItem("frontier-wallet-balance");
    setState({
      isConnected: false,
      address: null,
      balance: 0,
      isConnecting: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    connect,
    disconnect,
  };
}
