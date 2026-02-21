import { useState, useCallback, useEffect } from "react";
import { useWallet } from "./useWallet";
import {
  createGameActionTransaction,
  createPurchaseWithAlgoTransaction,
  createClaimFrontierTransaction,
  createBatchedGameActionTransaction,
  registerBatchSignCallback,
  enqueueGameAction,
  fetchBlockchainStatus,
  getCachedTreasuryAddress,
  getCachedAsaId,
  optInToASA,
  isOptedInToASA,
  type BatchedAction,
} from "@/lib/algorand";
import { useToast } from "@/hooks/use-toast";

type ActionType =
  | "mine"
  | "upgrade"
  | "attack"
  | "claim"
  | "build"
  | "purchase"
  | "claim_frontier"
  | "mint_avatar"
  | "special_attack"
  | "deploy_drone"
  | "switch_commander";

export function useBlockchainActions() {
  const { isConnected, address } = useWallet();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [frontierAsaId, setFrontierAsaId] = useState<number | null>(null);
  const [isOptedIn, setIsOptedIn] = useState(() => {
    const cached = localStorage.getItem("frontier_opted_in");
    return cached === "true";
  });
  const [treasuryAddress, setTreasuryAddress] = useState<string>("");

  useEffect(() => {
    fetchBlockchainStatus().then((status) => {
      if (status.frontierAsaId) setFrontierAsaId(status.frontierAsaId);
      if (status.adminAddress) setTreasuryAddress(status.adminAddress);
    });
  }, []);

  useEffect(() => {
    if (address && frontierAsaId) {
      isOptedInToASA(address, frontierAsaId).then((result) => {
        setIsOptedIn(result);
        if (result) {
          localStorage.setItem("frontier_opted_in", "true");
          localStorage.setItem("frontier_opted_in_address", address);
        }
      });
    }
  }, [address, frontierAsaId]);

  useEffect(() => {
    const cachedAddress = localStorage.getItem("frontier_opted_in_address");
    if (address && cachedAddress && cachedAddress !== address) {
      localStorage.removeItem("frontier_opted_in");
      localStorage.removeItem("frontier_opted_in_address");
      setIsOptedIn(false);
    }
  }, [address]);

  // Register the batch-sign callback so the module-level queue knows how to
  // flush: sign one 0-ALGO transaction whose note encodes all pending actions.
  useEffect(() => {
    if (!address || !isConnected) return;
    registerBatchSignCallback(address, async (actions: BatchedAction[]) => {
      try {
        const txId = await createBatchedGameActionTransaction(address, actions);
        toast({
          title: "Actions Logged On-Chain",
          description: `${actions.length} action${actions.length !== 1 ? "s" : ""} recorded on Algorand. TX: ${txId.slice(0, 8)}...`,
        });
        return txId;
      } catch (err) {
        const e = err as { message?: string };
        if (!e?.message?.includes("cancelled") && !e?.message?.includes("rejected")) {
          console.error("Batch action sign failed:", err);
        }
        return null;
      }
    });
  }, [address, isConnected, toast]);

  // -------------------------------------------------------------------------
  // Queue-based action loggers — fire-and-forget, batch into 1 KB transactions
  // -------------------------------------------------------------------------

  const queueMineAction = useCallback(
    (plotId: number) => {
      if (isConnected && address) enqueueGameAction("mine", plotId);
    },
    [isConnected, address]
  );

  const queueUpgradeAction = useCallback(
    (plotId: number, upgradeType: string) => {
      if (isConnected && address) enqueueGameAction("upgrade", plotId, { upgradeType });
    },
    [isConnected, address]
  );

  const queueAttackAction = useCallback(
    (plotId: number, troops: number, iron: number, fuel: number) => {
      if (isConnected && address)
        enqueueGameAction("attack", plotId, { troops, iron, fuel });
    },
    [isConnected, address]
  );

  const queueBuildAction = useCallback(
    (plotId: number, improvementType: string) => {
      if (isConnected && address) enqueueGameAction("build", plotId, { improvementType });
    },
    [isConnected, address]
  );

  const queueMintAvatarAction = useCallback(
    (tier: string) => {
      if (isConnected && address) enqueueGameAction("mint_avatar", 0, { tier });
    },
    [isConnected, address]
  );

  const queueSpecialAttackAction = useCallback(
    (targetPlotId: number, attackType: string) => {
      if (isConnected && address)
        enqueueGameAction("special_attack", targetPlotId, { attackType });
    },
    [isConnected, address]
  );

  const queueSwitchCommanderAction = useCallback(
    (commanderIndex: number) => {
      if (isConnected && address)
        enqueueGameAction("switch_commander", 0, { commanderIndex });
    },
    [isConnected, address]
  );

  const queueDeployDroneAction = useCallback(
    (targetPlotId?: number) => {
      if (isConnected && address)
        enqueueGameAction("deploy_drone", targetPlotId ?? 0);
    },
    [isConnected, address]
  );

  const signGameAction = useCallback(
    async (
      actionType: ActionType,
      plotId: number,
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
          plotId,
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
    (plotId: number) => signGameAction("mine", plotId),
    [signGameAction]
  );

  const signUpgradeAction = useCallback(
    (plotId: number, upgradeType: string) =>
      signGameAction("upgrade", plotId, { upgradeType }),
    [signGameAction]
  );

  const signAttackAction = useCallback(
    (plotId: number, troops: number, iron: number, fuel: number) =>
      signGameAction("attack", plotId, { troops, iron, fuel }),
    [signGameAction]
  );

  const signPurchaseAction = useCallback(
    async (plotId: number, algoAmount: number): Promise<string | null | "cancelled"> => {
      if (!isConnected || !address) {
        toast({
          title: "Wallet Not Connected",
          description: "Connect your wallet to purchase land.",
          variant: "destructive",
        });
        return null;
      }

      setIsPending(true);
      try {
        // Use state value first, fall back to module cache, then try a fresh fetch
        let targetAddress = treasuryAddress || getCachedTreasuryAddress();
        if (!targetAddress) {
          const fresh = await fetchBlockchainStatus();
          targetAddress = fresh.adminAddress || "";
        }
        if (!targetAddress) {
          // Blockchain not ready — return null (non-blocking: caller may still do in-game purchase)
          toast({ title: "On-Chain Payment Skipped", description: "Blockchain not initialized yet — land claimed in-game only.", variant: "default" });
          setIsPending(false);
          return null;
        }
        const txId = await createPurchaseWithAlgoTransaction(
          address,
          targetAddress,
          plotId,
          algoAmount
        );
        setLastTxId(txId);
        toast({
          title: "Purchase Confirmed",
          description: `Land purchased for ${algoAmount} ALGO. TX: ${txId.slice(0, 8)}...`,
        });
        return txId;
      } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message?.includes("cancelled") || err?.message?.includes("rejected")) {
          toast({ title: "Transaction Cancelled", description: "Purchase cancelled." });
          return "cancelled";
        }
        // Blockchain / network error — non-blocking, in-game purchase will still proceed
        toast({ title: "On-Chain Payment Failed", description: `${err?.message || "Network error"} — land claimed in-game only.`, variant: "default" });
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [isConnected, address, toast, treasuryAddress]
  );

  const signClaimFrontierAction = useCallback(
    async (frontierAmount: number): Promise<string | null> => {
      if (!isConnected || !address) {
        toast({
          title: "Wallet Not Connected",
          description: "Connect your wallet to claim FRONTIER tokens.",
          variant: "destructive",
        });
        return null;
      }

      setIsPending(true);
      try {
        const txId = await createClaimFrontierTransaction(address, frontierAmount);
        setLastTxId(txId);
        toast({
          title: "FRONTIER Claimed",
          description: `Claimed ${frontierAmount.toFixed(2)} FRONTIER tokens. TX: ${txId.slice(0, 8)}...`,
        });
        return txId;
      } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message?.includes("cancelled") || err?.message?.includes("rejected")) {
          toast({ title: "Claim Cancelled", description: "Claim cancelled." });
        } else {
          toast({ title: "Claim Failed", description: err?.message || "Failed", variant: "destructive" });
        }
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [isConnected, address, toast]
  );

  const signOptInToFrontier = useCallback(
    async (): Promise<string | null> => {
      if (!isConnected || !address) {
        toast({ title: "Wallet Not Connected", description: "Connect wallet first.", variant: "destructive" });
        return null;
      }
      if (!frontierAsaId) {
        toast({ title: "Not Ready", description: "FRONTIER token not created yet.", variant: "destructive" });
        return null;
      }
      if (isOptedIn) {
        toast({ title: "Already Opted In", description: "You're already opted into FRONTIER." });
        return null;
      }

      setIsPending(true);
      try {
        const txId = await optInToASA(address, frontierAsaId);
        setLastTxId(txId);
        setIsOptedIn(true);
        localStorage.setItem("frontier_opted_in", "true");
        localStorage.setItem("frontier_opted_in_address", address);
        toast({ title: "Opt-In Confirmed", description: `Opted into FRONTIER ASA. TX: ${txId.slice(0, 8)}...` });
        return txId;
      } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message?.includes("cancelled") || err?.message?.includes("rejected")) {
          toast({ title: "Opt-In Cancelled", description: "You cancelled the opt-in." });
        } else {
          toast({ title: "Opt-In Failed", description: err?.message || "Failed", variant: "destructive" });
        }
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [isConnected, address, frontierAsaId, isOptedIn, toast]
  );

  return {
    isPending,
    lastTxId,
    // Legacy individual-sign actions (kept for compatibility)
    signMineAction,
    signUpgradeAction,
    signAttackAction,
    signPurchaseAction,
    signClaimFrontierAction,
    signOptInToFrontier,
    // Batch queue actions — fire-and-forget, flushed in 1 KB atomic groups
    queueMineAction,
    queueUpgradeAction,
    queueAttackAction,
    queueBuildAction,
    queueMintAvatarAction,
    queueSpecialAttackAction,
    queueSwitchCommanderAction,
    queueDeployDroneAction,
    isWalletConnected: isConnected,
    frontierAsaId,
    isOptedInToFrontier: isOptedIn,
    treasuryAddress,
  };
}
