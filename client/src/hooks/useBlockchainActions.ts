import { useState, useCallback } from "react";
import { useWallet } from "./useWallet";
import { createGameActionTransaction } from "@/lib/algorand";
import { useToast } from "@/hooks/use-toast";

type ActionType = "mine" | "upgrade" | "attack" | "claim";

export function useBlockchainActions() {
  const { isConnected, address } = useWallet();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);

  const signGameAction = useCallback(
    async (
      actionType: ActionType,
      parcelId: string,
      metadata?: Record<string, unknown>
    ): Promise<string | null> => {
      if (!isConnected || !address) {
        toast({
          title: "Wallet Not Connected",
          description: "Connect your wallet to record actions on-chain.",
          variant: "destructive",
        });
        return null;
      }

      setIsPending(true);
      try {
        const txId = await createGameActionTransaction(
          address,
          actionType,
          parcelId,
          metadata
        );
        setLastTxId(txId);
        toast({
          title: "Transaction Confirmed",
          description: `Action recorded on Algorand TestNet. TX: ${txId.slice(0, 8)}...`,
        });
        return txId;
      } catch (error: unknown) {
        const err = error as { message?: string };
        console.error("Blockchain action failed:", error);
        
        if (err?.message?.includes("cancelled") || err?.message?.includes("rejected")) {
          toast({
            title: "Transaction Cancelled",
            description: "You cancelled the transaction in your wallet.",
          });
        } else {
          toast({
            title: "Transaction Failed",
            description: err?.message || "Failed to sign transaction",
            variant: "destructive",
          });
        }
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [isConnected, address, toast]
  );

  const signMineAction = useCallback(
    (parcelId: string) => signGameAction("mine", parcelId),
    [signGameAction]
  );

  const signUpgradeAction = useCallback(
    (parcelId: string, upgradeType: string) =>
      signGameAction("upgrade", parcelId, { upgradeType }),
    [signGameAction]
  );

  const signAttackAction = useCallback(
    (parcelId: string, troops: number, iron: number, fuel: number) =>
      signGameAction("attack", parcelId, { troops, iron, fuel }),
    [signGameAction]
  );

  const signClaimAction = useCallback(
    (parcelId: string) => signGameAction("claim", parcelId),
    [signGameAction]
  );

  return {
    isPending,
    lastTxId,
    signMineAction,
    signUpgradeAction,
    signAttackAction,
    signClaimAction,
    isWalletConnected: isConnected,
  };
}
