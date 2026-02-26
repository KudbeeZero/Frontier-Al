import { useState, useEffect, useRef } from "react";
import { TopBar } from "./TopBar";
import { ResourceHUD } from "./ResourceHUD";
import { FlatMap } from "./FlatMap";
import PlanetGlobe from "./PlanetGlobe";
import { AttackModal } from "./AttackModal";
import { BattleWatchModal } from "./BattleWatchModal";
import { BottomNav, type NavTab } from "./BottomNav";
import { LandSheet } from "./LandSheet";
import { InventoryPanel } from "./InventoryPanel";
import { BattlesPanel } from "./BattlesPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { CommanderPanel } from "./CommanderPanel";
import { EconomicsPanel } from "./EconomicsPanel";
import { OnboardingFlow } from "./OnboardingFlow";
import { GamerTagModal } from "./GamerTagModal";
import { CommandCenterPanel } from "./CommandCenterPanel";
import { WarRoomPanel } from "./WarRoomPanel";
import { WalletConnect } from "./WalletConnect";
import { OrbitalEventToast } from "./OrbitalEventToast";
import { OrbitalCanvas } from "./OrbitalCanvas";
import { useOrbitalEngine } from "@/hooks/useOrbitalEngine";
import { useWallet } from "@/hooks/useWallet";
import { useBlockchainActions } from "@/hooks/useBlockchainActions";
import { useGameState, useCurrentPlayer, useMine, useUpgrade, useAttack, useBuild, usePurchase, useCollectAll, useClaimFrontier, useMintAvatar, useSwitchCommander, useSpecialAttack, useDeployDrone, useDeploySatellite } from "@/hooks/useGameState";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Coins, Shield, Globe, Map, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImprovementType, CommanderTier, SpecialAttackType } from "@shared/schema";
import { startSpaceAmbience, stopSpaceAmbience } from "@/audio/spaceAmbience";

export function GameLayout() {
  const wallet = useWallet();
  const { isConnected, balance, walletStatus } = wallet;
  const isOnboarded = !!localStorage.getItem("frontier_onboarded_v1");
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
  } = useBlockchainActions();
  const { data: gameState, isLoading, error } = useGameState();
  // Find the player that belongs to the currently connected wallet address.
  // useCurrentPlayer now accepts an address so each wallet sees its own data.
  const player = useCurrentPlayer(wallet.address);
  const { toast } = useToast();
  // Orbital event engine (cosmetic + impact events)
  const { events: orbitalEvents, impactEvents } = useOrbitalEngine();

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
  const [attackModalOpen, setAttackModalOpen] = useState(false);
  const [watchingBattleId, setWatchingBattleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>("map");
  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d");
  const [desktopRightTab, setDesktopRightTab] = useState<"warroom" | "rankings">("warroom");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showGamerTag, setShowGamerTag] = useState(false);
  const [newPlayerId, setNewPlayerId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Per-parcel mining state — prevents double-clicks and rapid-fire clicking
  const [miningParcelIds, setMiningParcelIds] = useState<Set<string>>(new Set());
  const lastLocatedOwnedId = useRef<string | null>(null);
  const lastLocatedEnemyId = useRef<string | null>(null);

  // Tick every second for live FRNTR accumulation display in ResourceHUD.
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
    const seen = localStorage.getItem("frontier_onboarding_done") || localStorage.getItem("frontier_onboarded_v1");
    if (!seen) setShowOnboarding(true);
  }, []);

  // When a wallet connects (or changes), look up / create the player for that
  // specific address so each wallet always starts with isolated, fresh data.
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

  const handleOnboardingComplete = () => {
    localStorage.setItem("frontier_onboarding_done", "true");
    localStorage.setItem("frontier_onboarded_v1", "1");
    setShowOnboarding(false);
  };

  const selectedParcel = gameState?.parcels.find((p) => p.id === selectedParcelId) || null;
  const activeBattleCount = gameState?.battles.filter(b => b.status === "pending").length || 0;

  const handleMine = async () => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    if (miningParcelIds.has(selectedParcelId)) return;
    setMiningParcelIds((prev) => new Set([...prev, selectedParcelId]));
    mineMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId },
      {
        onSuccess: (data: any) => {
          const yields = data?.yield as { iron: number; fuel: number; crystal: number } | undefined;
          // Log the mine action to chain once (after success) with actual mineral yields
          queueMineAction(selectedParcel.plotId, yields);
          const desc = yields
            ? `+${yields.iron} Iron, +${yields.fuel} Fuel, +${yields.crystal} Crystal`
            : "Resources extracted successfully.";
          toast({ title: "Mining Complete", description: desc });
        },
        onError: (error) => toast({ title: "Mining Failed", description: error.message, variant: "destructive" }),
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
          // Log the mine action to chain once (after success) with actual mineral yields
          queueMineAction(parcel.plotId, yields);
          const desc = yields
            ? `+${yields.iron} Iron, +${yields.fuel} Fuel, +${yields.crystal} Crystal`
            : "Resources extracted successfully.";
          toast({ title: "Mining Complete", description: desc });
        },
        onError: (error) => toast({ title: "Mining Failed", description: error.message, variant: "destructive" }),
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
    if (!player || !selectedParcelId || !selectedParcel) return;
    // Log to chain (batched, fire-and-forget)
    queueUpgradeAction(selectedParcel.plotId, type);
    upgradeMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId, upgradeType: type as any },
      {
        onSuccess: () => toast({ title: "Upgrade Complete", description: `${type} upgraded.` }),
        onError: (error) => toast({ title: "Upgrade Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleAttackClick = () => setAttackModalOpen(true);

  const handleAttackConfirm = async (troops: number, iron: number, fuel: number, commanderId?: string) => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    // Log to chain (batched, fire-and-forget)
    queueAttackAction(selectedParcel.plotId, troops, iron, fuel);
    attackMutation.mutate(
      { attackerId: player.id, targetParcelId: selectedParcelId, troopsCommitted: troops, resourcesBurned: { iron, fuel }, commanderId },
      {
        onSuccess: (data: any) => {
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
    if (!player || !selectedParcelId || !selectedParcel) return;
    // Log to chain (batched, fire-and-forget) — covers turrets, shield_gen,
    // electricity, blockchain_node, data_centre, ai_lab, radar, fortress, etc.
    queueBuildAction(selectedParcel.plotId, type);
    buildMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId, improvementType: type },
      {
        onSuccess: () => toast({ title: "Construction Complete", description: `${type} has been built.` }),
        onError: (error) => toast({ title: "Build Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handlePurchase = async () => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    if (isWalletConnected && selectedParcel.purchasePriceAlgo !== null) {
      const result = await signPurchaseAction(selectedParcel.plotId, selectedParcel.purchasePriceAlgo);
      // "cancelled" = user explicitly rejected in wallet — abort entirely
      if (result === "cancelled") return;
      // null = blockchain/network error — toast already shown, still proceed in-game
    }
    purchaseMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId },
      {
        onSuccess: () => {
          toast({ title: "Territory Acquired", description: "New land is now yours." });
          setSelectedParcelId(null);
        },
        onError: (error) => toast({ title: "Purchase Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleCollectAll = () => {
    if (!player) return;
    collectMutation.mutate(player.id, {
      onSuccess: (data: any) => {
        const c = data.collected;
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
        const amount = data.claimed?.amount || 0;
        const txId = data.txId;
        if (txId) {
          toast({ title: "FRONTIER Claimed On-Chain", description: `+${amount.toFixed(2)} FRONTIER tokens sent to your wallet. TX: ${txId.slice(0, 8)}...` });
        } else {
          toast({ title: "FRONTIER Claimed", description: `+${amount.toFixed(2)} FRONTIER tokens` });
        }
      },
      onError: (error) => toast({ title: "Claim Failed", description: error.message, variant: "destructive" }),
    });
  };

  const handleMintAvatar = (tier: CommanderTier) => {
    if (!player) return;
    // Log commander mint to chain (batched)
    queueMintAvatarAction(tier);
    mintAvatarMutation.mutate(
      { playerId: player.id, tier },
      {
        onSuccess: (data: any) => toast({ title: "Commander Minted", description: `${data.avatar?.name || tier} Commander is ready for battle!` }),
        onError: (error) => toast({ title: "Mint Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleSpecialAttack = (attackType: SpecialAttackType) => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    // Log special attack to chain with target plot + attack type (batched)
    queueSpecialAttackAction(selectedParcel.plotId, attackType);
    specialAttackMutation.mutate(
      { playerId: player.id, attackType, targetParcelId: selectedParcelId },
      {
        onSuccess: (data: any) => {
          const result = data.result;
          toast({ title: "Special Attack Launched", description: `${result?.effect || "Attack successful"} - ${result?.damage || 0} damage dealt` });
        },
        onError: (error) => toast({ title: "Attack Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleSwitchCommander = (index: number) => {
    if (!player) return;
    // Log commander selection to chain (batched)
    queueSwitchCommanderAction(index);
    switchCommanderMutation.mutate(
      { playerId: player.id, commanderIndex: index },
      {
        onSuccess: () => toast({ title: "Commander Switched", description: "Active commander updated." }),
        onError: (error) => toast({ title: "Switch Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleDeployDrone = (targetParcelId?: string) => {
    if (!player) return;
    // Log drone deployment to chain (batched) — targetParcelId resolved to plotId below
    const targetParcel = targetParcelId
      ? gameState?.parcels.find((p) => p.id === targetParcelId)
      : null;
    queueDeployDroneAction(targetParcel?.plotId);
    deployDroneMutation.mutate(
      { playerId: player.id, targetParcelId },
      {
        onSuccess: () => toast({ title: "Drone Deployed", description: "Recon Drone is now scouting enemy territory." }),
        onError: (error) => toast({ title: "Deploy Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleDeploySatellite = () => {
    if (!player) return;
    queueDeploySatelliteAction();
    deploySatelliteMutation.mutate(
      { playerId: player.id },
      {
        onSuccess: () => toast({ title: "Satellite Launched", description: "+25% mining yield on all your territories for 1 hour." }),
        onError: (error) => toast({ title: "Launch Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab === "map") setSelectedParcelId(selectedParcelId);
  };

  const handleParcelSelectFromInventory = (id: string) => {
    setSelectedParcelId(id);
    setActiveTab("map");
  };

  const handleLocateTerritory = () => {
    if (!player || !gameState) return;
    const ownedPlots = gameState.parcels.filter(p => p.ownerId === player.id);
    if (ownedPlots.length > 0) {
      // Pick a random plot that differs from the last one shown (if possible)
      let candidates = ownedPlots.filter(p => p.id !== lastLocatedOwnedId.current);
      if (candidates.length === 0) candidates = ownedPlots;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      lastLocatedOwnedId.current = pick.id;
      setSelectedParcelId(pick.id);
      setActiveTab("map");
    }
  };

  const handleFindEnemyTarget = () => {
    if (!gameState) return;
    const enemyPlots = gameState.parcels.filter(p => p.ownerId && p.ownerId !== player?.id);
    if (enemyPlots.length > 0) {
      // Pick a random enemy plot that differs from the last one shown (if possible)
      let candidates = enemyPlots.filter(p => p.id !== lastLocatedEnemyId.current);
      if (candidates.length === 0) candidates = enemyPlots;
      const randomEnemy = candidates[Math.floor(Math.random() * candidates.length)];
      lastLocatedEnemyId.current = randomEnemy.id;
      setSelectedParcelId(randomEnemy.id);
      setActiveTab("map");
      toast({ title: "Enemy Located", description: `Plot #${randomEnemy.plotId} owned by ${randomEnemy.ownerType === "ai" ? "AI Faction" : "Player"} — tap to attack!` });
    } else {
      toast({ title: "No Enemies Found", description: "No enemy territories detected yet." });
    }
  };

  const handleViewOnGlobe = (parcelId: string) => {
    setSelectedParcelId(parcelId);
    setActiveTab("map");
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

  if (showOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
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
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-display text-lg uppercase tracking-wide text-muted-foreground">Loading Game World...</p>
          </div>
        </div>
      ) : gameState ? (
        <>
          {mapMode === "2d" ? (
            <>
              <FlatMap
                parcels={gameState.parcels}
                selectedParcelId={selectedParcelId}
                currentPlayerId={player?.id || null}
                onParcelSelect={setSelectedParcelId}
                className="absolute inset-0 w-full h-full"
                onLocateTerritory={handleLocateTerritory}
                onFindEnemyTarget={handleFindEnemyTarget}
                hasOwnedPlots={playerHasOwnedPlots}
                players={gameState.players}
              />
              <OrbitalCanvas events={orbitalEvents} />
            </>
          ) : (
            <PlanetGlobe
              parcels={gameState.parcels}
              currentPlayerId={player?.id || null}
              selectedParcelId={selectedParcelId}
              onParcelSelect={setSelectedParcelId}
              className="absolute inset-0 w-full h-full"
            />
          )}

          {/* 2D / 3D map toggle — bottom-left corner, above bottom nav */}
          {activeTab === "map" && (
            <div className="absolute bottom-20 left-4 z-20 flex gap-1 bg-card/80 backdrop-blur border border-border rounded-lg p-1">
              <button
                onClick={() => setMapMode("2d")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-display uppercase tracking-wide transition-colors",
                  mapMode === "2d"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Map className="w-3.5 h-3.5" />
                2D
              </button>
              <button
                onClick={() => setMapMode("3d")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-display uppercase tracking-wide transition-colors",
                  mapMode === "3d"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Globe className="w-3.5 h-3.5" />
                3D
              </button>
            </div>
          )}
        </>
      ) : null}

      <div className="absolute top-0 left-0 right-0 z-40">
        <TopBar isConnected={isConnected} mobileMenuContent={mobileMenuContent} />
      </div>

      {/* Orbital impact event notifications */}
      {impactEvents.length > 0 && <OrbitalEventToast events={impactEvents} />}

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

      {player && (
        <div className={cn("absolute left-1/2 -translate-x-1/2 z-20", isConnected && frontierAsaId && isOptedInToFrontier === false ? "top-28" : "top-16")}>
          <ResourceHUD
            iron={player.iron}
            fuel={player.fuel}
            crystal={player.crystal}
            frontier={player.frontier}
            algoBalance={balance}
            frontierDailyRate={
              gameState
                ? gameState.parcels
                    .filter(p => p.ownerId === player.id)
                    .reduce((s, p) => s + p.frontierPerDay, 0)
                : undefined
            }
            frontierPending={
              gameState
                ? gameState.parcels
                    .filter(p => p.ownerId === player.id)
                    .reduce((s, p) => {
                      const days = Math.max(0, (now - p.lastFrontierClaimTs) / (1000 * 60 * 60 * 24));
                      return s + p.frontierAccumulated + days * p.frontierPerDay;
                    }, 0)
                : undefined
            }
          />
        </div>
      )}

      <aside className="hidden lg:flex flex-col w-72 absolute top-16 left-0 bottom-0 z-30 backdrop-blur-md bg-background/70 border-r border-border overflow-hidden">
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

      <aside className="hidden lg:flex flex-col w-72 absolute top-16 right-0 bottom-0 z-30 backdrop-blur-md bg-background/70 border-l border-border overflow-hidden">
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
        </div>
        {isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : gameState ? (
          desktopRightTab === "warroom" ? (
            <WarRoomPanel
              battles={gameState.battles}
              events={gameState.events}
              players={gameState.players}
              onWatchBattle={setWatchingBattleId}
              onViewOnGlobe={handleViewOnGlobe}
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
        <div className="lg:hidden absolute inset-0 z-30 bg-background pt-16" data-testid="fullscreen-panel">
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
              isMinting={mintAvatarMutation.isPending}
              isDeployingDrone={deployDroneMutation.isPending}
              isDeployingSatellite={deploySatelliteMutation.isPending}
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
        </div>
      )}

      {activeTab === "map" && selectedParcel && (
        <LandSheet
          parcel={selectedParcel}
          player={player}
          onMine={handleMine}
          onUpgrade={handleUpgrade}
          onAttack={handleAttackClick}
          onBuild={handleBuild}
          onPurchase={handlePurchase}
          onSpecialAttack={handleSpecialAttack}
          onClose={() => setSelectedParcelId(null)}
          isMining={mineMutation.isPending}
          isUpgrading={upgradeMutation.isPending}
          isBuilding={buildMutation.isPending}
          isPurchasing={purchaseMutation.isPending}
          isSpecialAttacking={specialAttackMutation.isPending}
        />
      )}

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} battleCount={activeBattleCount} />

      <AttackModal
        open={attackModalOpen}
        onOpenChange={setAttackModalOpen}
        targetParcel={selectedParcel}
        attacker={player}
        onAttack={handleAttackConfirm}
        isAttacking={attackMutation.isPending}
      />

      <BattleWatchModal
        open={!!watchingBattleId}
        onOpenChange={(o) => { if (!o) setWatchingBattleId(null); }}
        battle={watchingBattleId ? (gameState?.battles.find((b) => b.id === watchingBattleId) ?? null) : null}
        players={gameState?.players ?? []}
      />
    </div>
  );
}
