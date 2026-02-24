import { useState, useCallback, useEffect } from "react";
import { useWallet } from "./useWallet";
import {
  createGameActionTransaction,
  createPurchaseWithAlgoTransaction,
  createClaimFrontierTransaction,
  registerTxnQueueAddress,
  registerBatchStatusCallback,
  enqueueGameAction,
  fetchBlockchainStatus,
  getCachedTreasuryAddress,
  getCachedAsaId,
  optInToASA,
  algodClient,
  hasOptedIn,
  type BatchStatusCallback,
} from "@/lib/algorand";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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
  | "deploy_satellite"
  | "switch_commander";

export function useBlockchainActions() {
  const { isConnected, isReady, address } = useWallet();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [frontierAsaId, setFrontierAsaId] = useState<number | null>(null);
  // tri-state: undefined = checking, true = opted in, false = not opted in
  const [isOptedIn, setIsOptedIn] = useState<boolean | undefined>(undefined);
  const [treasuryAddress, setTreasuryAddress] = useState<string>("");

  useEffect(() => {
    fetchBlockchainStatus().then((status) => {
      if (status.frontierAsaId) setFrontierAsaId(status.frontierAsaId);
      if (status.adminAddress) setTreasuryAddress(status.adminAddress);
    });
  }, []);

  useEffect(() => {
    setIsOptedIn(undefined);
  }, [address, frontierAsaId]);

  // Once we have both address and ASA id, read the per-wallet+ASA cache first
  // (so opted-in users never see the banner flash), then verify on-chain in
  // the background to keep the cache accurate.
  useEffect(() => {
    if (!address || !frontierAsaId) return;

    const network = "testnet";
    const cacheKey = `frontier_optin_${network}_${address}_${frontierAsaId}`;
    if (localStorage.getItem(cacheKey) === "true") {
      setIsOptedIn(true);
    }

    algodClient
      .accountInformation(address)
      .do()
      .then((accountInfo) => {
        const result = hasOptedIn(accountInfo as unknown as Record<string, unknown>, frontierAsaId);
        setIsOptedIn(result);
        if (result) {
          localStorage.setItem(cacheKey, "true");
        } else {
          localStorage.removeItem(cacheKey);
        }
      })
      .catch(() => {
        // Keep existing cached state if algod is temporarily unreachable
      });
  }, [address, frontierAsaId]);

  useEffect(() => {
    if (!address || !isReady) return;
    registerTxnQueueAddress(address);

    const statusHandler: BatchStatusCallback = (event, detail) => {
      switch (event) {
        case "bundling":
          toast({
            title: "Bundling Operations",
            description: `Bundling ${detail.count}/16 operations...`,
            duration: 2000,
          });
          break;
        case "submitting":
          toast({
            title: "Submitting Batch",
            description: `Submitting batch (${detail.count} ops)`,
            duration: 3000,
          });
          break;
        case "confirmed":
          toast({
            title: "Batch Confirmed",
            description: `Confirmed (${detail.count} ops)${detail.txIds?.[0] ? ` TX: ${detail.txIds[0].slice(0, 8)}...` : ""}`,
          });
          break;
        case "error": {
          const msg = detail.message || "Unknown error";
          if (!msg.includes("cancelled") && !msg.includes("rejected")) {
            toast({
              title: "Batch Failed",
              description: msg.slice(0, 100),
              variant: "destructive",
            });
          } else {
            toast({
              title: "Batch Cancelled",
              description: "You cancelled the transaction in your wallet.",
            });
          }
          break;
        }
      }
    };
    registerBatchStatusCallback(statusHandler);
  }, [address, isReady, toast]);

  const queueMineAction = useCallback(
    (plotId: number, minerals?: { iron: number; fuel: number; crystal: number }) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueMineAction | path: enqueueGameAction→batch | plotId: ${plotId} | ts: ${Date.now()}`);
        const mineralData = minerals
          ? { fe: minerals.iron, fu: minerals.fuel, cr: minerals.crystal }
          : undefined;
        enqueueGameAction("mine", plotId, undefined, mineralData);
      }
    },
    [isReady, address]
  );

  const queueUpgradeAction = useCallback(
    (plotId: number, upgradeType: string) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueUpgradeAction | path: enqueueGameAction→batch | plotId: ${plotId} | type: ${upgradeType} | ts: ${Date.now()}`);
        enqueueGameAction("upgrade", plotId, { upgradeType });
      }
    },
    [isReady, address]
  );

  const queueAttackAction = useCallback(
    (plotId: number, troops: number, iron: number, fuel: number) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueAttackAction | path: enqueueGameAction→batch | plotId: ${plotId} | troops: ${troops} | ts: ${Date.now()}`);
        enqueueGameAction("attack", plotId, { troops, iron, fuel });
      }
    },
    [isReady, address]
  );

  const queueBuildAction = useCallback(
    (plotId: number, improvementType: string) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueBuildAction | path: enqueueGameAction→batch | plotId: ${plotId} | type: ${improvementType} | ts: ${Date.now()}`);
        enqueueGameAction("build", plotId, { improvementType });
      }
    },
    [isReady, address]
  );

  const queueMintAvatarAction = useCallback(
    (tier: string) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueMintAvatarAction | path: enqueueGameAction→batch | tier: ${tier} | ts: ${Date.now()}`);
        enqueueGameAction("mint_avatar", 0, { tier });
      }
    },
    [isReady, address]
  );

  const queueSpecialAttackAction = useCallback(
    (targetPlotId: number, attackType: string) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueSpecialAttackAction | path: enqueueGameAction→batch | plotId: ${targetPlotId} | type: ${attackType} | ts: ${Date.now()}`);
        enqueueGameAction("special_attack", targetPlotId, { attackType });
      }
    },
    [isReady, address]
  );

  const queueSwitchCommanderAction = useCallback(
    (commanderIndex: number) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueSwitchCommanderAction | path: enqueueGameAction→batch | idx: ${commanderIndex} | ts: ${Date.now()}`);
        enqueueGameAction("switch_commander", 0, { commanderIndex });
      }
    },
    [isReady, address]
  );

  const queueDeployDroneAction = useCallback(
    (targetPlotId?: number) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueDeployDroneAction | path: enqueueGameAction→batch | plotId: ${targetPlotId ?? 0} | ts: ${Date.now()}`);
        enqueueGameAction("deploy_drone", targetPlotId ?? 0);
      }
    },
    [isReady, address]
  );

  const queueDeploySatelliteAction = useCallback(
    () => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueDeploySatelliteAction | path: enqueueGameAction→batch | ts: ${Date.now()}`);
        enqueueGameAction("deploy_satellite", 0);
      }
    },
    [isReady, address]
  );

  const signGameAction = useCallback(
    async (
      actionType: ActionType,
      plotId: number,
      metadata?: Record<string, unknown>
    ): Promise<string | null> => {
      if (!isReady || !address) {
        toast({
          title: "Wallet Not Ready",
          description: "Connect your wallet and wait for initialization to record actions on-chain.",
          variant: "destructive",
        });
        return null;
      }

      setIsPending(true);
      try {
        console.log(`[ACTION-DEBUG] signGameAction | path: createGameActionTransaction (single txn) | action: ${actionType} | plotId: ${plotId} | ts: ${Date.now()}`);
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
    [isReady, address, toast]
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
      if (!isReady || !address) {
        toast({
          title: "Wallet Not Ready",
          description: "Connect your wallet to purchase land.",
          variant: "destructive",
        });
        return null;
      }

      setIsPending(true);
      try {
        console.log(`[ACTION-DEBUG] signPurchaseAction | path: createPurchaseWithAlgoTransaction (single txn) | plotId: ${plotId} | algo: ${algoAmount} | ts: ${Date.now()}`);
        let targetAddress = treasuryAddress || getCachedTreasuryAddress();
        if (!targetAddress) {
          const fresh = await fetchBlockchainStatus();
          targetAddress = fresh.adminAddress || "";
        }
        if (!targetAddress) {
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
        toast({ title: "On-Chain Payment Failed", description: `${err?.message || "Network error"} — land claimed in-game only.`, variant: "default" });
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [isReady, address, toast, treasuryAddress]
  );

  const signClaimFrontierAction = useCallback(
    async (frontierAmount: number): Promise<string | null> => {
      if (!isReady || !address) {
        toast({
          title: "Wallet Not Ready",
          description: "Connect your wallet to claim FRONTIER tokens.",
          variant: "destructive",
        });
        return null;
      }

      setIsPending(true);
      try {
        console.log(`[ACTION-DEBUG] signClaimFrontierAction | path: createClaimFrontierTransaction (single txn) | amount: ${frontierAmount} | ts: ${Date.now()}`);
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
    [isReady, address, toast]
  );

  const signOptInToFrontier = useCallback(
    async (): Promise<string | null> => {
      if (!isReady || !address) {
        toast({ title: "Wallet Not Ready", description: "Connect wallet first.", variant: "destructive" });
        return null;
      }
      if (!frontierAsaId) {
        toast({ title: "Not Ready", description: "FRONTIER token not created yet.", variant: "destructive" });
        return null;
      }
      if (isOptedIn === true) {
        toast({ title: "Already Opted In", description: "You're already opted into FRONTIER." });
        return null;
      }

      setIsPending(true);
      try {
        console.log(`[ACTION-DEBUG] signOptInToFrontier | path: optInToASA (single txn) | asaId: ${frontierAsaId} | ts: ${Date.now()}`);
        const txId = await optInToASA(address, frontierAsaId);
        setLastTxId(txId);
        // waitForConfirmation inside optInToASA already confirmed the tx —
        // optimistically mark as opted-in immediately so the banner disappears.
        const cacheKey = `frontier_optin_testnet_${address}_${frontierAsaId}`;
        setIsOptedIn(true);
        localStorage.setItem(cacheKey, "true");
        // Refetch game state so the HUD and any balance displays update.
        queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
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
    [isReady, address, frontierAsaId, isOptedIn, toast]
  );

  return {
    isPending,
    lastTxId,
    signMineAction,
    signUpgradeAction,
    signAttackAction,
    signPurchaseAction,
    signClaimFrontierAction,
    signOptInToFrontier,
    queueMineAction,
    queueUpgradeAction,
    queueAttackAction,
    queueBuildAction,
    queueMintAvatarAction,
    queueSpecialAttackAction,
    queueSwitchCommanderAction,
    queueDeployDroneAction,
    queueDeploySatelliteAction,
    isWalletConnected: isConnected,
    frontierAsaId,
    isOptedInToFrontier: isOptedIn,
    treasuryAddress,
  };
}
