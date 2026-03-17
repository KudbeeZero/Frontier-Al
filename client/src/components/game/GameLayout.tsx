import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { TopBar } from "./TopBar";
import PlanetGlobe from "./PlanetGlobe";
import type { LivePulse } from "@/components/game/PlanetGlobe";
import { AttackModal } from "./AttackModal";
import { BattleWatchModal } from "./BattleWatchModal";
import { BottomNav, type NavTab } from "./BottomNav";
import { LandSheet } from "./LandSheet";
import { InventoryPanel } from "./InventoryPanel";
import { BattlesPanel } from "./BattlesPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { TradeStationPanel } from "./TradeStation";
import { CommanderPanel } from "./CommanderPanel";
import { EconomicsPanel } from "./EconomicsPanel";
import { GamerTagModal } from "./GamerTagModal";
import { CommandCenterPanel } from "./CommandCenterPanel";
import { WarRoomPanel } from "./WarRoomPanel";
import { WorldIntelPanel } from "./WorldIntelPanel";
import { FactionPanel } from "./FactionPanel";
import { PredictionMarketsPanel } from "./PredictionMarkets";
import { useWorldEvents } from "@/hooks/useWorldEvents";
import { WalletConnect } from "./WalletConnect";
import { OrbitalEventToast } from "./OrbitalEventToast";
import { useOrbitalEngine } from "@/hooks/useOrbitalEngine";
import { useWallet } from "@/hooks/useWallet";
import { useBlockchainActions } from "@/hooks/useBlockchainActions";
import { useGameSocket } from "@/hooks/useGameSocket";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useGameState, useCurrentPlayer, useMine, useUpgrade, useAttack, useBuild, usePurchase, useCollectAll, useClaimFrontier, useMintAvatar, useSwitchCommander, useSpecialAttack, useDeployDrone, useDeploySatellite } from "@/hooks/useGameState";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Coins, Shield, Globe, Trophy, ArrowLeftRight, AlertTriangle, Clock, Flag, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImprovementType, CommanderTier, SpecialAttackType } from "@shared/schema";
import { startSpaceAmbience, stopSpaceAmbience } from "@/audio/spaceAmbience";
import { StreamOverlay } from "./StreamOverlay";
import { TutorialOverlay } from "./TutorialOverlay";
import { SelectedPlotPanel } from "./SelectedPlotPanel";
import { useTutorial, TUTORIAL_STEPS } from "@/hooks/useTutorial";
import { sendPaymentTransaction } from "@/lib/algorand";
import algosdk from "algosdk";

export function GameLayout() {
  const wallet = useWallet();
  const { isConnected, balance, walletStatus } = wallet;
  const isOnboarded = true;
  const {
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
    isWalletConnected,
    frontierAsaId,
    isOptedInToFrontier,
    treasuryAddress,
    signOptInToPlotNft,
  } = useBlockchainActions();
  useGameSocket();
  const { data: gameState, isLoading, error } = useGameState();
  const player = useCurrentPlayer(wallet.address);
  const { toast } = useToast();
  const { events: orbitalEvents, impactEvents } = useOrbitalEngine();
  const tutorial = useTutorial();

  // When tutorial step changes, update camera coords if the step defines them
  useEffect(() => {
    if (!tutorial.isOpen) return;
    const s = tutorial.currentStepDef;
    if (s?.cameraLat != null && s?.cameraLng != null) {
      setTutorialLat(s.cameraLat);
      setTutorialLng(s.cameraLng);
      setFlyRequestId((prev) => prev + 1);
    } else {
      setTutorialLat(null);
      setTutorialLng(null);
    }
  }, [tutorial.step, tutorial.isOpen, tutorial.currentStepDef]);

  // Notify tutorial when a parcel is selected (any click on the globe)
  const handleParcelSelect = useCallback((id: string) => {
    setSelectedParcelId(id);
    setShowFullLandSheet(false); // Always open lightweight panel first
    tutorial.notifyEvent("plot_selected");
  }, [tutorial.notifyEvent]);

  const initializedAddressRef = useRef<string | null>(null);
  const ambienceStartedRef = useRef(false);

  useEffect(() => {
    if (isConnected && !ambienceStartedRef.current) {
      ambienceStartedRef.current = true;
      startSpaceAmbience();
    }
    return () => {
      if (ambienceStartedRef.current) {
        stopSpaceAmbience();
        ambienceStartedRef.current = false;
      }
    };
  }, [isConnected]);

  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  /** Controls whether the full LandSheet is open (vs. the lightweight SelectedPlotPanel) */
  const [showFullLandSheet, setShowFullLandSheet] = useState(false);
  const [attackModalOpen, setAttackModalOpen] = useState(false);
  const [watchingBattleId, setWatchingBattleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>("map");
  const [desktopRightTab, setDesktopRightTab] = useState<"warroom" | "rankings" | "trade" | "factions" | "markets">("warroom");
  const [showGamerTag, setShowGamerTag] = useState(false);
  const [newPlayerId, setNewPlayerId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [miningParcelIds, setMiningParcelIds] = useState<Set<string>>(new Set());
  const [livePulses, setLivePulses] = useState<LivePulse[]>([]);
  const [flyRequestId, setFlyRequestId] = useState(0);
  const [mapTransitioning, setMapTransitioning] = useState(false);

  // Tutorial-driven camera override — set when a tutorial step has camera coords
  const [tutorialLat, setTutorialLat] = useState<number | null>(null);
  const [tutorialLng, setTutorialLng] = useState<number | null>(null);

  // ── Stream mode & season countdown ────────────────────────────────────────
  /** Detect ?stream=1 in URL to enable the fullscreen streaming HUD. */
  const streamMode = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("stream") === "1";
    } catch {
      return false;
    }
  }, []);

  /** Tick `now` every second to drive the live season countdown display. */
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(tick);
  }, []);

  const seasonEndsAt = (gameState as any)?.seasonEndsAt as number | null | undefined;
  const seasonName   = (gameState as any)?.seasonName as string | null | undefined;

  const seasonCountdown = useMemo(() => {
    if (!seasonEndsAt) return null;
    const ms = seasonEndsAt - now;
    if (ms <= 0) return "SEASON ENDED";
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }, [seasonEndsAt, now]);

  useEffect(() => {
    if (livePulses.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setLivePulses(prev => prev.filter(p => now - p.startMs < 700));
    }, 700);
    return () => clearTimeout(timer);
  }, [livePulses]);

  const lastLocatedOwnedId = useRef<string | null>(null);
  const lastLocatedEnemyId = useRef<string | null>(null);
  const [replayTime, setReplayTime] = useState<number>(Date.now());
  const [replayVisibleTypes, setReplayVisibleTypes] = useState<Set<string>>(new Set());
  const replayWindowStart = useMemo(() => Date.now() - 24 * 60 * 60_000, []);
  const { data: replayEvents = [] } = useWorldEvents({ start: replayWindowStart, limit: 500 });
  const handleReplayStateChange = useCallback(({ replayTime: rt, visibleTypes: vt }: { replayTime: number; visibleTypes: Set<string> }) => {
    setReplayTime(rt);
    setReplayVisibleTypes(vt);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const mineMutation = useMine();
  const upgradeMutation = useUpgrade();
  const attackMutation = useAttack();
  const buildMutation = useBuild();
  const purchaseMutation = usePurchase();
  const collectMutation = useCollectAll();
  const claimFrontierMutation = useClaimFrontier();
  const mintAvatarMutation = useMintAvatar();
  const specialAttackMutation = useSpecialAttack();
  const switchCommanderMutation = useSwitchCommander();
  const deployDroneMutation = useDeployDrone();
  const deploySatelliteMutation = useDeploySatellite();


  useEffect(() => {
    if (!wallet.address || !wallet.isConnected) return;
    if (initializedAddressRef.current === wallet.address) return;

    initializedAddressRef.current = wallet.address;

    fetch(`/api/game/player-by-address/${encodeURIComponent(wallet.address)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.welcomeBonus) {
          setNewPlayerId(data.id);
          setShowGamerTag(true);
          toast({
            title: "Welcome Commander!",
            description: "You've received 500 FRONTIER tokens as a welcome bonus. Use them to build facilities and grow your empire!",
          });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
      })
      .catch((err) => console.error("Failed to initialise player for address:", err));
  }, [wallet.address, wallet.isConnected]);


  const selectedParcel = gameState?.parcels.find((p) => p.id === selectedParcelId) || null;
  const activeBattleCount = gameState?.battles.filter(b => b.status === "pending").length || 0;

  // Notify tutorial when LandSheet becomes visible (parcel selected on map tab)
  useEffect(() => {
    if (selectedParcel && activeTab === "map") {
      tutorial.notifyEvent("landsheet_opened");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParcel?.id]);

  const handleMine = async () => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player || !selectedParcelId || !selectedParcel) return;
    if (miningParcelIds.has(selectedParcelId)) return;
    setMiningParcelIds((prev) => new Set([...prev, selectedParcelId]));
    mineMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId },
      {
        onSuccess: (data: any) => {
          const yields = data?.yield as { iron: number; fuel: number; crystal: number } | undefined;
          queueMineAction(selectedParcel.plotId, yields);
          const desc = yields
            ? `+${yields.iron} Iron, +${yields.fuel} Fuel, +${yields.crystal} Crystal`
            : "Resources extracted successfully.";
          toast({ title: "Mining Complete", description: desc });
          tutorial.notifyEvent("land_action_completed");
          if (selectedParcel) {
            const pulse: LivePulse = {
              id: `pulse-${Date.now()}-${Math.random()}`,
              lat: selectedParcel.lat,
              lng: selectedParcel.lng,
              startMs: Date.now(),
            };
            setLivePulses(prev => [...prev, pulse]);
          }
        },
        onError: (error: unknown) => toast({ title: "Mining Failed", description: (error as Error).message, variant: "destructive" }),
        onSettled: () => {
          setMiningParcelIds((prev) => {
            const next = new Set(prev);
            next.delete(selectedParcelId);
            return next;
          });
        },
      }
    );
  };

  const handleMineParcel = async (parcelId: string) => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player) return;
    if (miningParcelIds.has(parcelId)) return;
    const parcel = gameState?.parcels.find(p => p.id === parcelId);
    if (!parcel) return;
    setMiningParcelIds((prev) => new Set([...prev, parcelId]));
    mineMutation.mutate(
      { playerId: player.id, parcelId },
      {
        onSuccess: (data: any) => {
          const yields = data?.yield as { iron: number; fuel: number; crystal: number } | undefined;
          queueMineAction(parcel.plotId, yields);
          const desc = yields
            ? `+${yields.iron} Iron, +${yields.fuel} Fuel, +${yields.crystal} Crystal`
            : "Resources extracted successfully.";
          toast({ title: "Mining Complete", description: desc });
          const pulse: LivePulse = {
            id: `pulse-${Date.now()}-${Math.random()}`,
            lat: parcel.lat,
            lng: parcel.lng,
            startMs: Date.now(),
          };
          setLivePulses(prev => [...prev, pulse]);
        },
        onError: (error: unknown) => toast({ title: "Mining Failed", description: (error as Error).message, variant: "destructive" }),
        onSettled: () => {
          setMiningParcelIds((prev) => {
            const next = new Set(prev);
            next.delete(parcelId);
            return next;
          });
        },
      }
    );
  };

  const handleUpgrade = async (type: string) => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player || !selectedParcelId || !selectedParcel) return;
    upgradeMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId, upgradeType: type as any },
      {
        onSuccess: () => {
          queueUpgradeAction(selectedParcel.plotId, type);
          toast({ title: "Upgrade Complete", description: `${type} upgraded.` });
        },
        onError: (error) => toast({ title: "Upgrade Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleAttackClick = () => setAttackModalOpen(true);

  const handleAttackConfirm = async (troops: number, iron: number, fuel: number, crystal: number, commanderId?: string, sourceParcelId?: string) => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player || !selectedParcelId || !selectedParcel) return;
    attackMutation.mutate(
      { attackerId: player.id, targetParcelId: selectedParcelId, troopsCommitted: troops, resourcesBurned: { iron, fuel }, crystalBurned: crystal, commanderId, sourceParcelId },
      {
        onSuccess: (data: any) => {
          queueAttackAction(selectedParcel.plotId, troops, iron, fuel, crystal);
          const battleId = data?.id as string | undefined;
          toast({ title: "Attack Deployed", description: "Battle will resolve in 10 minutes." });
          setAttackModalOpen(false);
          if (battleId) setWatchingBattleId(battleId);
        },
        onError: (error) => toast({ title: "Attack Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleBuild = (type: ImprovementType) => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player || !selectedParcelId || !selectedParcel) return;
    buildMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId, improvementType: type },
      {
        onSuccess: () => {
          queueBuildAction(selectedParcel.plotId, type);
          toast({ title: "Construction Complete", description: `${type} has been built.` });
        },
        onError: (error) => toast({ title: "Build Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handlePurchase = async () => {
    if (!player || !selectedParcelId || !selectedParcel) return;

    if (!isWalletConnected) {
      toast({
        title: "Wallet Required",
        description: "Connect your Algorand wallet to purchase territory.",
        variant: "destructive",
      });
      return;
    }

    if (selectedParcel.purchasePriceAlgo !== null) {
      const result = await signPurchaseAction(selectedParcel.plotId, selectedParcel.purchasePriceAlgo);
      if (result === "cancelled") return;
    }

    purchaseMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId },
      {
        onSuccess: () => {
          toast({ title: "Territory Acquired", description: "New land is now yours." });
          tutorial.notifyEvent("plot_purchased");
          setSelectedParcelId(null);
        },
        onError: (error) => toast({ title: "Purchase Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleCollectAll = () => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player) return;
    collectMutation.mutate(player.id, {
      onSuccess: (data: any) => {
        const c = data.collected;
        queueMineAction(0, c);
        toast({ title: "Resources Collected", description: `+${c.iron} Iron, +${c.fuel} Fuel, +${c.crystal} Crystal` });
      },
      onError: (error) => toast({ title: "Collection Failed", description: error.message, variant: "destructive" }),
    });
  };

  const handleClaimFrontier = async () => {
    if (!player || !gameState) return;
    if (isOptedInToFrontier === false) {
      toast({ title: "Opt-In Required", description: "Opt into FRONTIER ASA before claiming tokens.", variant: "destructive" });
      return;
    }
    claimFrontierMutation.mutate(player.id, {
      onSuccess: (data: any) => {
        if (!data.success && data.reason === "wallet_not_opted_in") {
          toast({ title: "Opt-In Required", description: "Your wallet must opt into the FRONTIER ASA before tokens can be sent on-chain.", variant: "destructive" });
          return;
        }
        const amount = data.claimed?.amount || 0;
        if (amount === 0) {
          toast({ title: "Nothing to Claim", description: "Mine resources and own territory to earn FRONTIER tokens." });
          return;
        }
        const txId = data.txId;
        if (txId) {
          toast({ title: "FRONTIER Claimed On-Chain", description: `+${amount.toFixed(2)} FRONTIER tokens sent to your wallet. TX: ${txId.slice(0, 8)}...` });
        } else {
          toast({ title: "FRONTIER Claimed", description: `+${amount.toFixed(2)} FRONTIER tokens credited` });
        }
      },
      onError: (error) => toast({ title: "Claim Failed", description: error.message, variant: "destructive" }),
    });
  };

  // NFT delivery: query status of selected plot's NFT when player owns it
  const ownedSelectedPlotId = selectedParcel && player && selectedParcel.ownerId === player.id
    ? selectedParcel.plotId
    : null;

  const { data: nftData, refetch: refetchNft } = useQuery<{
    plotId: number; assetId: number | null; mintedToAddress: string | null;
  } | null>({
    queryKey: ["nft-plot", ownedSelectedPlotId],
    queryFn: async () => {
      if (!ownedSelectedPlotId) return null;
      const res = await fetch(`/api/nft/plot/${ownedSelectedPlotId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch NFT status");
      return res.json();
    },
    enabled: !!ownedSelectedPlotId,
    staleTime: 30_000,
  });

  const adminAddr = ""; // server-side check handles admin; client just knows custody = mintedToAddress !== player address
  const nftInfo = (() => {
    if (!nftData || !nftData.assetId) return null;
    const inCustody = !!nftData.mintedToAddress && nftData.mintedToAddress !== wallet.address;
    return { assetId: nftData.assetId, inCustody };
  })();

  const [isDeliveringNft, setIsDeliveringNft] = useState(false);

  const handleDeliverNft = async () => {
    if (!ownedSelectedPlotId || !wallet.address || !nftInfo) return;
    setIsDeliveringNft(true);

    const attemptDeliver = async (): Promise<void> => {
      const res = await fetch(`/api/nft/deliver/${ownedSelectedPlotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "NFT Delivery Failed", description: data.error || "Unknown error", variant: "destructive" });
        return;
      }

      if (data.success) {
        toast({ title: "NFT Delivered! 🎉", description: `Plot #${ownedSelectedPlotId} NFT is now in your wallet.` });
        refetchNft();
        return;
      }

      if (data.reason === "not_opted_in") {
        const optedIn = await signOptInToPlotNft(nftInfo.assetId);
        if (optedIn) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const retryRes = await fetch(`/api/nft/deliver/${ownedSelectedPlotId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: wallet.address }),
          });
          const retryData = await retryRes.json();
          if (retryData.success) {
            toast({ title: "NFT Delivered! 🎉", description: `Plot #${ownedSelectedPlotId} NFT is now in your wallet.` });
            refetchNft();
          } else {
            toast({ title: "Claim Failed", description: "Opt-in confirmed but delivery failed. Try claiming again in a moment.", variant: "destructive" });
          }
        }
        return;
      }

      if (data.reason === "not_in_custody") {
        toast({ title: "Already In Your Wallet", description: data.message || "NFT is already delivered." });
        refetchNft();
        return;
      }

      toast({ title: "Claim Issue", description: data.message || "Unexpected state — try again.", variant: "destructive" });
    };

    try {
      await attemptDeliver();
    } catch (err) {
      toast({ title: "NFT Delivery Error", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setIsDeliveringNft(false);
    }
  };

  // ── NFT delivery for all owned parcels (now in CommanderPanel only) ──────────
  const [isDeliveringPlotNftId, setIsDeliveringPlotNftId] = useState<number | null>(null);

  const handleDeliverPlotNft = async (plotId: number, assetId: number) => {
    if (!wallet.address) return;
    setIsDeliveringPlotNftId(plotId);
    try {
      const res = await fetch(`/api/nft/deliver/${plotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "NFT Delivery Failed", description: data.error || "Unknown error", variant: "destructive" });
        return;
      }
      if (data.success) {
        toast({ title: "NFT Delivered! 🎉", description: `Plot #${plotId} NFT is now in your wallet.` });
        queryClient.invalidateQueries({ queryKey: ["nft-plot", plotId] });
        return;
      }
      if (data.reason === "not_opted_in") {
        const optedIn = await signOptInToPlotNft(assetId);
        if (optedIn) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const retryRes = await fetch(`/api/nft/deliver/${plotId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: wallet.address }),
          });
          const retryData = await retryRes.json();
          if (retryData.success) {
            toast({ title: "NFT Delivered! 🎉", description: `Plot #${plotId} NFT is now in your wallet.` });
            queryClient.invalidateQueries({ queryKey: ["nft-plot", plotId] });
          } else {
            toast({ title: "Claim Failed", description: "Opt-in confirmed but delivery failed. Try again.", variant: "destructive" });
          }
        }
        return;
      }
      if (data.reason === "not_in_custody") {
        toast({ title: "Already In Your Wallet", description: data.message || "NFT is already delivered." });
        queryClient.invalidateQueries({ queryKey: ["nft-plot", plotId] });
        return;
      }
      toast({ title: "Claim Issue", description: data.message || "Unexpected state — try again.", variant: "destructive" });
    } catch (err) {
      toast({ title: "NFT Delivery Error", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setIsDeliveringPlotNftId(null);
    }
  };

  const [isClaimingCommanderNft, setIsClaimingCommanderNft] = useState(false);

  const handleMintAvatar = async (tier: CommanderTier) => {
    if (!player) return;

    // Fetch pricing — response now returns frntrCost (primary currency) and
    // algoNetworkFee (unavoidable Algorand tx fee, ~0.001 ALGO, wallet handles automatically).
    let frntrCost = 0;
    try {
      const priceRes = await fetch(`/api/nft/commander-price/${tier}`);
      if (!priceRes.ok) throw new Error("Could not fetch commander price");
      const priceData: { frntrCost: number; algoNetworkFee: number; note: string; economyMode: string } = await priceRes.json();
      frntrCost = priceData.frntrCost;

      toast({
        title: "Minting Commander",
        description: `Cost: ${frntrCost} FRNTR${priceData.economyMode === "testing" ? " (testing price)" : ""}. The Algorand network fee (~${priceData.algoNetworkFee} ALGO) is handled by your wallet automatically.`,
      });
    } catch (fetchErr) {
      toast({
        title: "Price Fetch Failed",
        description: fetchErr instanceof Error ? fetchErr.message : "Could not load commander pricing",
        variant: "destructive",
      });
      return;
    }

    // No ALGO game-level payment required — FRNTR is deducted server-side via mintAvatarMutation.
    // The minimal Algorand network fee is covered automatically by the wallet during NFT minting.
    queueMintAvatarAction(tier);
    mintAvatarMutation.mutate(
      { playerId: player.id, tier },
      {
        onSuccess: (data: any) => {
          const nft = data.nft;
          if (nft?.assetId) {
            toast({
              title: "Commander Minted + NFT Created!",
              description: `${data.avatar?.name || tier} Commander is ready. ${frntrCost} FRNTR spent. NFT ASA ${nft.assetId} held in custody — claim from Commander page.`,
            });
          } else {
            toast({ title: "Commander Minted", description: `${data.avatar?.name || tier} Commander is ready for battle! ${frntrCost} FRNTR spent.` });
          }
        },
        onError: (error: unknown) => toast({ title: "Mint Failed", description: (error as Error).message, variant: "destructive" }),
      }
    );
  };

  const handleClaimCommanderNft = async (commanderId: string) => {
    if (!wallet.address) return;
    setIsClaimingCommanderNft(true);
    try {
      const res = await fetch(`/api/nft/deliver-commander/${commanderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address }),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Commander NFT Delivered!", description: `Your NFT is now in your wallet. TX: ${data.txId?.slice(0, 8)}...` });
        queryClient.invalidateQueries({ queryKey: ["/api/nft/commander"] });
      } else if (data.reason === "not_opted_in") {
        // Auto opt-in (standard Algorand ASA self-send), then retry delivery
        const optedIn = await signOptInToPlotNft(data.assetId);
        if (optedIn) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // wait for indexer propagation
          const retryRes = await fetch(`/api/nft/deliver-commander/${commanderId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: wallet.address }),
          });
          const retryData = await retryRes.json();
          if (retryData.success) {
            toast({ title: "Commander NFT Delivered!", description: `Your Commander NFT is now in your wallet. TX: ${retryData.txId?.slice(0, 8)}...` });
            queryClient.invalidateQueries({ queryKey: ["/api/nft/commander"] });
          } else {
            toast({ title: "Claim Failed", description: "Opt-in confirmed but delivery failed. Try claiming again.", variant: "destructive" });
          }
        }
      } else if (data.reason === "not_in_custody") {
        toast({ title: "Already In Your Wallet", description: data.message || "NFT has already been delivered." });
      } else {
        toast({ title: "Claim Info", description: data.message || "Unexpected state — try again.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Claim Failed", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setIsClaimingCommanderNft(false);
    }
  };

  const handleSpecialAttack = (attackType: SpecialAttackType) => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    specialAttackMutation.mutate(
      { playerId: player.id, attackType, targetParcelId: selectedParcelId },
      {
        onSuccess: (data: any) => {
          queueSpecialAttackAction(selectedParcel.plotId, attackType);
          const result = data.result;
          toast({ title: "Special Attack Launched", description: `${result?.effect || "Attack successful"} - ${result?.damage || 0} damage dealt` });
        },
        onError: (error) => toast({ title: "Attack Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleSwitchCommander = (index: number) => {
    if (!player) return;
    switchCommanderMutation.mutate(
      { playerId: player.id, commanderIndex: index },
      {
        onSuccess: () => {
          queueSwitchCommanderAction(index);
          toast({ title: "Commander Switched", description: "Active commander updated." });
        },
        onError: (error) => toast({ title: "Switch Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleDeployDrone = (targetParcelId?: string) => {
    if (!player) return;
    const targetParcel = targetParcelId
      ? gameState?.parcels.find((p) => p.id === targetParcelId)
      : null;
    deployDroneMutation.mutate(
      { playerId: player.id, targetParcelId },
      {
        onSuccess: () => {
          queueDeployDroneAction(targetParcel?.plotId);
          toast({ title: "Drone Deployed", description: "Recon Drone is now scouting enemy territory." });
        },
        onError: (error) => toast({ title: "Deploy Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleDeploySatellite = () => {
    if (!player) return;
    deploySatelliteMutation.mutate(
      { playerId: player.id },
      {
        onSuccess: () => {
          queueDeploySatelliteAction();
          toast({ title: "Satellite Launched", description: "+25% mining yield on all your territories for 1 hour." });
        },
        onError: (error) => toast({ title: "Launch Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab !== "map") setShowFullLandSheet(false);
    if (tab === "map") setSelectedParcelId(selectedParcelId);
  };

  /** Navigate to a parcel on the globe, forcing a camera fly-to and showing a brief transition overlay. */
  const flyToParcelOnMap = (parcelId: string) => {
    setSelectedParcelId(parcelId);
    setFlyRequestId(prev => prev + 1);
    if (activeTab !== "map") {
      setMapTransitioning(true);
      setTimeout(() => setMapTransitioning(false), 600);
    }
    setActiveTab("map");
  };

  const handleParcelSelectFromInventory = (id: string) => {
    flyToParcelOnMap(id);
  };

  const handleLocateTerritory = () => {
    if (!player || !gameState) return;
    const ownedPlots = gameState.parcels.filter(p => p.ownerId === player.id);
    if (ownedPlots.length > 0) {
      let candidates = ownedPlots.filter(p => p.id !== lastLocatedOwnedId.current);
      if (candidates.length === 0) candidates = ownedPlots;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      lastLocatedOwnedId.current = pick.id;
      flyToParcelOnMap(pick.id);
    }
  };

  const handleFindEnemyTarget = () => {
    if (!gameState) return;
    const enemyPlots = gameState.parcels.filter(p => p.ownerId && p.ownerId !== player?.id);
    if (enemyPlots.length > 0) {
      let candidates = enemyPlots.filter(p => p.id !== lastLocatedEnemyId.current);
      if (candidates.length === 0) candidates = enemyPlots;
      const randomEnemy = candidates[Math.floor(Math.random() * candidates.length)];
      lastLocatedEnemyId.current = randomEnemy.id;
      flyToParcelOnMap(randomEnemy.id);
      toast({ title: "Enemy Located", description: `Plot #${randomEnemy.plotId} owned by ${randomEnemy.ownerType === "ai" ? "AI Faction" : "Player"} — tap to attack!` });
    } else {
      toast({ title: "No Enemies Found", description: "No enemy territories detected yet." });
    }
  };

  const handleViewOnGlobe = (parcelId: string) => {
    flyToParcelOnMap(parcelId);
  };

  const playerHasOwnedPlots = player && gameState ? gameState.parcels.some(p => p.ownerId === player.id) : false;

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background" data-testid="game-error">
        <div className="text-center p-8">
          <p className="text-destructive font-display text-xl uppercase tracking-wide">Connection Error</p>
          <p className="text-muted-foreground mt-2">Failed to connect to game server</p>
        </div>
      </div>
    );
  }

  if (showGamerTag && newPlayerId) {
    return (
      <GamerTagModal
        playerId={newPlayerId}
        walletAddress={wallet.address || ""}
        onComplete={(name) => {
          setShowGamerTag(false);
          setNewPlayerId(null);
          queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
          toast({ title: `Welcome, ${name}!`, description: "Your commander tag has been set." });
        }}
        onSkip={() => {
          setShowGamerTag(false);
          setNewPlayerId(null);
        }}
      />
    );
  }

  if (walletStatus === "restoring") {
    return (
      <div className="flex items-center justify-center h-screen bg-background" data-testid="wallet-restoring">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-display text-lg uppercase tracking-wide text-muted-foreground">Reconnecting Wallet...</p>
        </div>
      </div>
    );
  }

  if (!isConnected && !isOnboarded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background" data-testid="wallet-gate">
        <div className="text-center p-8 max-w-md space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="w-10 h-10 text-primary" />
            </div>
          </div>
          <h1 className="font-display text-3xl uppercase tracking-wide text-primary">FRONTIER</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Connect your Algorand wallet to enter the game. Compete for 21,000 land plots on a 3D globe, build facilities, and earn FRONTIER tokens.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <Shield className="w-4 h-4" />
            <span>New players receive 500 FRONTIER tokens</span>
          </div>
          <WalletConnect className="w-full" />
          <p className="text-[10px] text-muted-foreground/60">Algorand TestNet | Pera Wallet & LUTE Wallet Supported</p>
        </div>
      </div>
    );
  }

  const isMiningParcel = (parcelId: string) => miningParcelIds.has(parcelId);

  const commandCenterProps = {
    player,
    parcels: gameState?.parcels ?? [],
    selectedParcel,
    onSelectParcel: (id: string) => {
      setSelectedParcelId(id);
    },
    onClaimFrontier: handleClaimFrontier,
    onCollectAll: handleCollectAll,
    onMine: handleMine,
    onMineParcel: handleMineParcel,
    isMiningParcel,
    onUpgrade: handleUpgrade,
    onAttack: handleAttackClick,
    isMining: mineMutation.isPending,
    isUpgrading: upgradeMutation.isPending,
    isClaimingFrontier: claimFrontierMutation.isPending,
    isCollecting: collectMutation.isPending,
  };

  const mobileMenuContent = (
    <CommandCenterPanel {...commandCenterProps} className="h-full" />
  );

  const showFullscreenPanel = activeTab !== "map";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black" data-testid="game-layout">
      {gameState ? (
        <>
          <div className="absolute inset-0 w-full h-full" data-tutorial="map-area">
            <PlanetGlobe
              parcels={gameState.parcels}
              players={gameState.players}
              currentPlayerId={player?.id || null}
              selectedParcelId={selectedParcelId}
              onParcelSelect={handleParcelSelect}
              onAttack={handleAttackClick}
              onMine={handleMine}
              onBuild={() => { /* LandSheet handles upgrades — stay on map */ }}
              onPurchase={handlePurchase}
              className="absolute inset-0 w-full h-full"
              battles={gameState.battles}
              livePulses={livePulses}
              orbitalEvents={orbitalEvents}
              replayEvents={replayEvents}
              replayTime={replayTime}
              replayVisibleTypes={replayVisibleTypes}
              streamMode={streamMode}
              flyRequestId={flyRequestId}
              tutorialLat={tutorialLat}
              tutorialLng={tutorialLng}
              nftInfo={nftInfo}
              onDeliverNft={handleDeliverNft}
              isDeliveringNft={isDeliveringNft}
            />
          </div>

          {/* Brief overlay when transitioning from a panel to the map */}
          {mapTransitioning && (
            <div
              className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center pointer-events-none transition-opacity duration-500"
              style={{ animation: "fadeOut 600ms ease-out forwards" }}
            >
              <p className="text-muted-foreground font-display text-sm uppercase tracking-wide">Locating plot...</p>
            </div>
          )}
        </>
      ) : null}

      <div className="absolute top-0 left-0 right-0 z-40">
        <TopBar
          isConnected={isConnected}
          mobileMenuContent={mobileMenuContent}
          playerFactionId={player?.playerFactionId ?? null}
        />
        {/* Season countdown badge — shown when a season is active */}
        {seasonCountdown && (
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 pointer-events-none select-none flex items-center gap-2 px-3 py-1 rounded-full z-50"
            style={{
              background: "rgba(4,8,20,0.85)",
              border: "1px solid rgba(0,229,255,0.25)",
              backdropFilter: "blur(8px)",
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "rgba(0,229,255,0.8)",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5ff", display: "inline-block", boxShadow: "0 0 6px #00e5ff" }} />
            {seasonName ? `${seasonName.toUpperCase()} · ` : "SEASON · "}
            {seasonCountdown}
          </div>
        )}
      </div>

      {impactEvents.length > 0 && <OrbitalEventToast events={impactEvents} />}

      {/* Morale debuff warning badge */}
      {player?.moraleDebuffUntil && player.moraleDebuffUntil > Date.now() && (
        <div
          className="absolute top-16 right-4 mt-1 z-40 flex items-center gap-1.5 px-3 py-1 rounded-full pointer-events-none select-none"
          style={{
            background: "rgba(20,4,4,0.88)",
            border: "1px solid rgba(255,60,60,0.4)",
            backdropFilter: "blur(8px)",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.15em",
            color: "rgba(255,100,100,0.9)",
          }}
          data-testid="morale-debuff-badge"
        >
          <AlertTriangle style={{ width: 10, height: 10 }} />
          MORALE LOW · {Math.ceil((player.moraleDebuffUntil - Date.now()) / 60000)}m
          {(player.consecutiveLosses ?? 0) > 1 && (
            <span style={{ color: "rgba(255,60,60,0.7)", marginLeft: 4 }}>
              ×{player.consecutiveLosses} LOSSES
            </span>
          )}
        </div>
      )}

      {/* Attack cooldown warning badge */}
      {player?.attackCooldownUntil && player.attackCooldownUntil > Date.now() && (
        <div
          className="absolute top-16 right-4 mt-8 z-40 flex items-center gap-1.5 px-3 py-1 rounded-full pointer-events-none select-none"
          style={{
            background: "rgba(8,8,20,0.88)",
            border: "1px solid rgba(255,165,0,0.4)",
            backdropFilter: "blur(8px)",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.15em",
            color: "rgba(255,180,80,0.9)",
          }}
          data-testid="attack-cooldown-badge"
        >
          <Clock style={{ width: 10, height: 10 }} />
          ATK COOLDOWN · {Math.ceil((player.attackCooldownUntil - Date.now()) / 60000)}m
        </div>
      )}

      {isConnected && frontierAsaId && isOptedInToFrontier === false && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30" data-testid="opt-in-banner">
          <Button
            onClick={signOptInToFrontier}
            className="gap-2 font-display uppercase tracking-wide text-xs animate-pulse"
            data-testid="button-opt-in-frontier"
          >
            <Coins className="w-4 h-4" />
            Opt-In to FRONTIER Token (ASA #{frontierAsaId})
          </Button>
        </div>
      )}


      <aside className="hidden md:flex flex-col w-60 lg:w-72 absolute top-16 left-0 bottom-0 z-30 backdrop-blur-md bg-background/70 border-r border-border overflow-hidden" data-tutorial="buy-plot">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <CommandCenterPanel {...commandCenterProps} className="h-full" />
        )}
      </aside>

      <aside className="hidden md:flex flex-col w-60 lg:w-72 absolute top-16 right-0 bottom-0 z-30 backdrop-blur-md bg-background/70 border-l border-border overflow-hidden">
        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => setDesktopRightTab("warroom")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-display uppercase tracking-wide transition-colors border-b-2",
              desktopRightTab === "warroom"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Shield className="w-3.5 h-3.5" />
            War Room
          </button>
          <button
            onClick={() => setDesktopRightTab("rankings")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-display uppercase tracking-wide transition-colors border-b-2",
              desktopRightTab === "rankings"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Trophy className="w-3.5 h-3.5" />
            Rankings
          </button>
          <button
            onClick={() => setDesktopRightTab("trade")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-display uppercase tracking-wide transition-colors border-b-2",
              desktopRightTab === "trade"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Trade
          </button>
          <button
            onClick={() => setDesktopRightTab("factions")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-display uppercase tracking-wide transition-colors border-b-2",
              desktopRightTab === "factions"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Flag className="w-3.5 h-3.5" />
            Factions
          </button>
          <button
            onClick={() => setDesktopRightTab("markets")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-display uppercase tracking-wide transition-colors border-b-2",
              desktopRightTab === "markets"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Coins className="w-3.5 h-3.5" />
            Markets
          </button>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : desktopRightTab === "trade" ? (
          <TradeStationPanel
            currentPlayerId={player?.id ?? ""}
            currentPlayerName={player?.name ?? ""}
            className="flex-1 border-0 rounded-none overflow-hidden"
          />
        ) : desktopRightTab === "factions" ? (
          <FactionPanel
            player={player}
            className="flex-1 border-0 rounded-none overflow-hidden"
          />
        ) : desktopRightTab === "markets" ? (
          <PredictionMarketsPanel
            currentPlayerId={player?.id ?? ""}
            currentPlayerFrontier={player?.frontier ?? 0}
            className="flex-1 border-0 rounded-none overflow-hidden"
          />
        ) : gameState ? (
          desktopRightTab === "warroom" ? (
            <WarRoomPanel
              battles={gameState.battles}
              events={gameState.events}
              players={gameState.players}
              onWatchBattle={setWatchingBattleId}
              onViewOnGlobe={handleViewOnGlobe}
              onPlotSelect={setSelectedParcelId}
              className="flex-1 border-0 rounded-none overflow-auto"
            />
          ) : (
            <LeaderboardPanel
              entries={gameState.leaderboard}
              currentPlayerId={player?.id || null}
              className="flex-1 border-0 rounded-none overflow-auto"
            />
          )
        ) : null}
      </aside>

      {showFullscreenPanel && (
        <div className="md:hidden absolute inset-0 z-30 bg-background pt-16 pb-16 overflow-hidden" data-testid="fullscreen-panel">
          {activeTab === "inventory" && gameState && (
            <InventoryPanel
              player={player}
              parcels={gameState.parcels}
              onCollectAll={handleCollectAll}
              onClaimFrontier={handleClaimFrontier}
              onSelectParcel={handleParcelSelectFromInventory}
              onMineParcel={handleMineParcel}
              isMiningParcel={isMiningParcel}
              isCollecting={collectMutation.isPending}
              isClaimingFrontier={claimFrontierMutation.isPending}
            />
          )}
          {activeTab === "battles" && gameState && (
            <BattlesPanel
              battles={gameState.battles}
              events={gameState.events}
              players={gameState.players}
              onWatchBattle={setWatchingBattleId}
              onViewOnGlobe={handleViewOnGlobe}
            />
          )}
          {activeTab === "commander" && gameState && (
            <CommanderPanel
              player={player}
              onMintAvatar={handleMintAvatar}
              onDeployDrone={handleDeployDrone}
              onDeploySatellite={handleDeploySatellite}
              onSwitchCommander={handleSwitchCommander}
              onClaimCommanderNft={handleClaimCommanderNft}
              onAttack={handleAttackConfirm}
              isMinting={mintAvatarMutation.isPending}
              isDeployingDrone={deployDroneMutation.isPending}
              isDeployingSatellite={deploySatelliteMutation.isPending}
              isClaimingCommanderNft={isClaimingCommanderNft}
              isAttacking={attackMutation.isPending}
              selectedParcel={selectedParcel}
              ownedParcels={gameState.parcels.filter(p => p.ownerId === player?.id)}
              wallet={{ isConnected: wallet.isConnected, address: wallet.address }}
              onDeliverPlotNft={handleDeliverPlotNft}
              isDeliveringPlotNftId={isDeliveringPlotNftId}
            />
          )}
          {activeTab === "leaderboard" && gameState && (
            <LeaderboardPanel
              entries={gameState.leaderboard}
              currentPlayerId={player?.id || null}
            />
          )}
          {activeTab === "economics" && (
            <EconomicsPanel className="h-full" />
          )}
          {activeTab === "trade" && (
            <TradeStationPanel
              currentPlayerId={player?.id ?? ""}
              currentPlayerName={player?.name ?? ""}
              className="h-full"
            />
          )}
          {activeTab === "factions" && (
            <FactionPanel
              player={player}
              className="h-full"
            />
          )}
          {activeTab === "markets" && (
            <PredictionMarketsPanel
              currentPlayerId={player?.id ?? ""}
              currentPlayerFrontier={player?.frontier ?? 0}
              className="h-full"
            />
          )}
          <div
            className={activeTab === "intel" ? "h-full" : "hidden"}
            style={{ display: activeTab === "intel" ? undefined : "none" }}
          >
            <WorldIntelPanel
              className="h-full"
              onReplayStateChange={handleReplayStateChange}
            />
          </div>
        </div>
      )}

      {/* ── Plot Action Surface ─────────────────────────────────────────────────
           Shown for ANY selected plot (mobile + desktop).
           Mobile: slides above BottomNav (z-55). Desktop: floating card (z-55).
           The full LandSheet opens separately when the player taps "Manage Plot".
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "map" && selectedParcel && (
        <SelectedPlotPanel
          parcel={selectedParcel}
          player={player}
          isOpen={!showFullLandSheet}
          onClaim={handlePurchase}
          isClaiming={purchaseMutation.isPending}
          isWalletConnected={isWalletConnected}
          onOpenFullSheet={() => {
            setShowFullLandSheet(true);
            tutorial.notifyEvent("landsheet_opened");
          }}
          onClose={() => setSelectedParcelId(null)}
        />
      )}

      {/* ── Full LandSheet — owned plot management ──────────────────────────── */}
      {activeTab === "map" && selectedParcel && showFullLandSheet && (
        <LandSheet
          parcel={selectedParcel}
          player={player}
          onMine={handleMine}
          onUpgrade={handleUpgrade}
          onAttack={handleAttackClick}
          onBuild={handleBuild}
          onPurchase={handlePurchase}
          onSpecialAttack={handleSpecialAttack}
          onClose={() => {
            setShowFullLandSheet(false);
            setSelectedParcelId(null);
          }}
          onNavigateToPlot={selectedParcel ? () => flyToParcelOnMap(selectedParcel.id) : undefined}
          isMining={mineMutation.isPending}
          isUpgrading={upgradeMutation.isPending}
          isBuilding={buildMutation.isPending}
          isPurchasing={purchaseMutation.isPending}
          isWalletConnected={isWalletConnected}
          isSpecialAttacking={specialAttackMutation.isPending}
          nftInfo={nftInfo}
          onDeliverNft={handleDeliverNft}
          isDeliveringNft={isDeliveringNft}
        />
      )}

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} battleCount={activeBattleCount} />

      <AttackModal
        open={attackModalOpen}
        onOpenChange={setAttackModalOpen}
        targetParcel={selectedParcel}
        attacker={player}
        ownedParcels={
          gameState
            ? gameState.parcels.filter((p) => player && p.ownerId === player.id)
            : []
        }
        onAttack={handleAttackConfirm}
        isAttacking={attackMutation.isPending}
      />

      <BattleWatchModal
        open={!!watchingBattleId}
        onOpenChange={(o) => { if (!o) setWatchingBattleId(null); }}
        battle={watchingBattleId ? (gameState?.battles.find((b) => b.id === watchingBattleId) ?? null) : null}
        players={gameState?.players ?? []}
        targetParcel={
          watchingBattleId && gameState
            ? (gameState.parcels.find(
                (p) => p.id === gameState.battles.find((b) => b.id === watchingBattleId)?.targetParcelId
              ) ?? null)
            : null
        }
      />

      {/* Stream overlay — rendered only when ?stream=1 is in the URL */}
      {streamMode && (
        <StreamOverlay
          gameState={gameState ?? null}
          seasonCountdown={seasonCountdown}
          seasonName={seasonName ?? null}
        />
      )}

      {/* Tutorial test button — lower left, always visible for testing */}
      <button
        onClick={tutorial.resetAndOpen}
        className="absolute bottom-20 left-3 z-40 md:bottom-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full select-none transition-opacity opacity-60 hover:opacity-100"
        style={{
          background: "rgba(4,8,20,0.85)",
          border: "1px solid rgba(0,229,255,0.3)",
          backdropFilter: "blur(8px)",
          fontFamily: "monospace",
          fontSize: 10,
          letterSpacing: "0.15em",
          color: "rgba(0,229,255,0.85)",
        }}
        title="Restart Tutorial"
        data-testid="button-tutorial-restart"
      >
        <BookOpen style={{ width: 11, height: 11 }} />
        TUTORIAL
      </button>

      {/* Onboarding tutorial — shown to first-time users */}
      <TutorialOverlay
        isOpen={tutorial.isOpen}
        step={tutorial.step}
        steps={TUTORIAL_STEPS}
        onNext={tutorial.next}
        onBack={tutorial.back}
        onSkip={tutorial.complete}
        onFinish={tutorial.complete}
      />
    </div>
  );
}
