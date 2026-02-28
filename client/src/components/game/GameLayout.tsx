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
import { Coins, Shield, Globe } from "lucide-react";
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
  const player = useCurrentPlayer(wallet.address);
  const { toast } = useToast();
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showGamerTag, setShowGamerTag] = useState(false);
  const [newPlayerId, setNewPlayerId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [miningParcelIds, setMiningParcelIds] = useState<Set<string>>(new Set());
  const lastLocatedOwnedId = useRef<string | null>(null);
  const lastLocatedEnemyId = useRef<string | null>(null);

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
            description: "You've received 500 FRONTIER tokens as a welcome bonus.",
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
          const yields = data?.yield;
          queueMineAction(selectedParcel.plotId, yields);
          toast({ title: "Mining Complete" });
        },
        onError: (error) => toast({ title: "Mining Failed", description: error.message, variant: "destructive" }),
        onSettled: () => setMiningParcelIds((prev) => {
          const next = new Set(prev);
          next.delete(selectedParcelId);
          return next;
        }),
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
          const yields = data?.yield;
          queueMineAction(parcel.plotId, yields);
          toast({ title: "Mining Complete" });
        },
        onError: (error) => toast({ title: "Mining Failed", description: error.message, variant: "destructive" }),
        onSettled: () => setMiningParcelIds((prev) => {
          const next = new Set(prev);
          next.delete(parcelId);
          return next;
        }),
      }
    );
  };

  const handleUpgrade = async (type: string) => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    queueUpgradeAction(selectedParcel.plotId, type);
    upgradeMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId, upgradeType: type as any },
      {
        onSuccess: () => toast({ title: "Upgrade Complete" }),
        onError: (error) => toast({ title: "Upgrade Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleAttackConfirm = async (troops: number, iron: number, fuel: number, commanderId?: string) => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    queueAttackAction(selectedParcel.plotId, troops, iron, fuel);
    attackMutation.mutate(
      { attackerId: player.id, targetParcelId: selectedParcelId, troopsCommitted: troops, resourcesBurned: { iron, fuel }, commanderId },
      {
        onSuccess: (data: any) => {
          setAttackModalOpen(false);
          if (data?.id) setWatchingBattleId(data.id);
          toast({ title: "Attack Deployed" });
        },
        onError: (error) => toast({ title: "Attack Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleBuild = (type: ImprovementType) => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    queueBuildAction(selectedParcel.plotId, type);
    buildMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId, improvementType: type },
      {
        onSuccess: () => toast({ title: "Construction Complete" }),
        onError: (error) => toast({ title: "Build Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handlePurchase = async () => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    if (isWalletConnected && selectedParcel.purchasePriceAlgo !== null) {
      const result = await signPurchaseAction(selectedParcel.plotId, selectedParcel.purchasePriceAlgo);
      if (result === "cancelled") return;
    }
    purchaseMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId },
      {
        onSuccess: () => {
          toast({ title: "Territory Acquired" });
          setSelectedParcelId(null);
        },
        onError: (error) => toast({ title: "Purchase Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleCollectAll = () => {
    if (!player) return;
    collectMutation.mutate(player.id, {
      onSuccess: () => toast({ title: "Resources Collected" }),
      onError: (error) => toast({ title: "Collection Failed", description: error.message, variant: "destructive" }),
    });
  };

  const handleClaimFrontier = async () => {
    if (!player || !gameState) return;
    if (isOptedInToFrontier === false) {
      toast({ title: "Opt-In Required", variant: "destructive" });
      return;
    }
    claimFrontierMutation.mutate(player.id, {
      onSuccess: () => toast({ title: "FRONTIER Claimed" }),
      onError: (error) => toast({ title: "Claim Failed", description: error.message, variant: "destructive" }),
    });
  };

  const handleMintAvatar = (tier: CommanderTier) => {
    if (!player) return;
    queueMintAvatarAction(tier);
    mintAvatarMutation.mutate(
      { playerId: player.id, tier },
      {
        onSuccess: () => toast({ title: "Commander Minted" }),
        onError: (error) => toast({ title: "Mint Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleSpecialAttack = (attackType: SpecialAttackType) => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    queueSpecialAttackAction(selectedParcel.plotId, attackType);
    specialAttackMutation.mutate(
      { playerId: player.id, attackType, targetParcelId: selectedParcelId },
      {
        onSuccess: () => toast({ title: "Special Attack Launched" }),
        onError: (error) => toast({ title: "Attack Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleSwitchCommander = (index: number) => {
    if (!player) return;
    queueSwitchCommanderAction(index);
    switchCommanderMutation.mutate(
      { playerId: player.id, commanderIndex: index },
      {
        onSuccess: () => toast({ title: "Commander Switched" }),
        onError: (error) => toast({ title: "Switch Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleDeployDrone = (targetParcelId?: string) => {
    if (!player) return;
    const targetParcel = targetParcelId ? gameState?.parcels.find((p) => p.id === targetParcelId) : null;
    queueDeployDroneAction(targetParcel?.plotId);
    deployDroneMutation.mutate(
      { playerId: player.id, targetParcelId },
      {
        onSuccess: () => toast({ title: "Drone Deployed" }),
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
        onSuccess: () => toast({ title: "Satellite Launched" }),
        onError: (error) => toast({ title: "Launch Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const toggleViewMode = () => setViewMode(prev => (prev === "2d" ? "3d" : "2d"));

  const handleLocateTerritory = () => {
    setViewMode("2d");
    if (!player || !gameState) return;
    const ownedPlots = gameState.parcels.filter(p => p.ownerId === player.id);
    if (ownedPlots.length > 0) {
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
      let candidates = enemyPlots.filter(p => p.id !== lastLocatedEnemyId.current);
      if (candidates.length === 0) candidates = enemyPlots;
      const randomEnemy = candidates[Math.floor(Math.random() * candidates.length)];
      lastLocatedEnemyId.current = randomEnemy.id;
      setSelectedParcelId(randomEnemy.id);
      setActiveTab("map");
      toast({ title: "Enemy Located" });
    }
  };

  const playerHasOwnedPlots = player && gameState ? gameState.parcels.some(p => p.ownerId === player.id) : false;

  if (error) return <div className="flex items-center justify-center h-screen bg-background">Connection Error</div>;
  if (showOnboarding) return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  if (showGamerTag && newPlayerId) return <GamerTagModal playerId={newPlayerId} walletAddress={wallet.address || ""} onComplete={() => setShowGamerTag(false)} onSkip={() => setShowGamerTag(false)} />;
  if (walletStatus === "restoring") return <div className="flex items-center justify-center h-screen bg-background text-muted-foreground">Reconnecting...</div>;
  if (!isConnected && !isOnboarded) return <div className="flex flex-col items-center justify-center h-screen bg-background p-8 text-center space-y-6"><h1 className="text-3xl font-display text-primary">FRONTIER</h1><p className="text-muted-foreground">Connect your Algorand wallet to enter the game.</p><WalletConnect /></div>;

  const commandCenterProps = {
    player,
    parcels: gameState?.parcels ?? [],
    selectedParcel,
    onSelectParcel: setSelectedParcelId,
    onClaimFrontier: handleClaimFrontier,
    onCollectAll: handleCollectAll,
    onMine: handleMine,
    onMineParcel: handleMineParcel,
    isMiningParcel: (id: string) => miningParcelIds.has(id),
    onUpgrade: handleUpgrade,
    onAttack: () => setAttackModalOpen(true),
    isMining: mineMutation.isPending,
    isUpgrading: upgradeMutation.isPending,
    isClaimingFrontier: claimFrontierMutation.isPending,
    isCollecting: collectMutation.isPending,
  };

  const mobileMenuContent = <CommandCenterPanel {...commandCenterProps} className="h-full" />;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center z-10 text-muted-foreground">Loading World...</div>
      ) : gameState ? (
        <>
          {viewMode === "2d" ? (
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
          ) : (
            <div className="absolute inset-0 w-full h-full">
              <PlanetGlobe
                parcels={gameState.parcels}
                currentPlayerId={player?.id || null}
                selectedParcelId={selectedParcelId}
                onParcelSelect={setSelectedParcelId}
                className="w-full h-full"
              />
            </div>
          )}

          <TopBar isConnected={isConnected} mobileMenuContent={mobileMenuContent} />

          {/* ResourceHUD disabled per request */}
          {false && player && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 w-full max-w-lg px-4 pointer-events-none">
              <ResourceHUD iron={player.iron} fuel={player.fuel} crystal={player.crystal} frontier={player.frontier} algoBalance={balance} />
            </div>
          ) }

          {/* Pulsing frame disabled per request */}
          {/* <OrbitalCanvas events={orbitalEvents} /> */}

          <button
            onClick={toggleViewMode}
            className="absolute top-16 right-4 z-40 px-4 py-2 rounded-md bg-black/60 border border-primary/40 text-primary font-display uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-primary/20 transition-all backdrop-blur-md"
          >
            {viewMode === "2d" ? <Globe className="w-4 h-4" /> : <Globe className="w-4 h-4 text-primary" />}
            {viewMode === "2d" ? "Switch to 3D" : "Switch to 2D"}
          </button>

          {selectedParcelId && activeTab === "map" && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4 pointer-events-auto">
              <LandSheet
                parcel={selectedParcel!}
                player={player}
                onMine={handleMine}
                onUpgrade={handleUpgrade}
                onAttack={() => setAttackModalOpen(true)}
                onBuild={handleBuild}
                onPurchase={handlePurchase}
                onDeployDrone={handleDeployDrone}
                onDeploySatellite={handleDeploySatellite}
                isMining={mineMutation.isPending || miningParcelIds.has(selectedParcelId)}
                isUpgrading={upgradeMutation.isPending}
                isBuilding={buildMutation.isPending}
                isPurchasing={purchaseMutation.isPending}
                isDeployingDrone={deployDroneMutation.isPending}
                isLaunchingSatellite={deploySatelliteMutation.isPending}
              />
            </div>
          )}

          {activeTab === "inventory" && (
            <div className="absolute inset-0 z-40 bg-black/95 pt-20 pb-24 overflow-y-auto px-4">
              <InventoryPanel
                player={player}
                parcels={gameState.parcels}
                onSelectParcel={handleParcelSelectFromInventory}
                onCollectAll={handleCollectAll}
                onClaimFrontier={handleClaimFrontier}
                isCollecting={collectMutation.isPending}
                isClaiming={claimFrontierMutation.isPending}
              />
            </div>
          )}

          {activeTab === "battles" && (
            <div className="absolute inset-0 z-40 bg-black/95 pt-20 pb-24 overflow-y-auto px-4">
              <BattlesPanel
                battles={gameState.battles}
                players={gameState.players}
                currentPlayerId={player?.id || null}
                onWatchBattle={setWatchingBattleId}
              />
            </div>
          )}

          {activeTab === "leaderboard" && (
            <div className="absolute inset-0 z-40 bg-black/95 pt-20 pb-24 overflow-y-auto px-4">
              <LeaderboardPanel players={gameState.players} parcels={gameState.parcels} currentPlayerId={player?.id || null} />
            </div>
          )}

          {activeTab === "commander" && (
            <div className="absolute inset-0 z-40 bg-black/95 pt-20 pb-24 overflow-y-auto px-4">
              <CommanderPanel
                player={player}
                onMintAvatar={handleMintAvatar}
                onSwitchCommander={handleSwitchCommander}
                onSpecialAttack={handleSpecialAttack}
                isMinting={mintAvatarMutation.isPending}
                isSwitching={switchCommanderMutation.isPending}
                isAttacking={specialAttackMutation.isPending}
                selectedParcel={selectedParcel}
              />
            </div>
          )}

          {activeTab === "economics" && (
            <div className="absolute inset-0 z-40 bg-black/95 pt-20 pb-24 overflow-y-auto px-4">
              <EconomicsPanel player={player} parcels={gameState.parcels} onClaimFrontier={handleClaimFrontier} isClaiming={claimFrontierMutation.isPending} />
            </div>
          )}

          {activeTab === "warroom" && (
            <div className="absolute inset-0 z-40 bg-black/95 pt-20 pb-24 overflow-y-auto px-4">
              <WarRoomPanel battles={gameState.battles} players={gameState.players} currentPlayerId={player?.id || null} />
            </div>
          )}

          <BottomNav activeTab={activeTab} onTabChange={handleTabChange} activeBattleCount={activeBattleCount} />
          
          <AttackModal
            isOpen={attackModalOpen}
            onClose={() => setAttackModalOpen(false)}
            onAttack={handleAttackConfirm}
            player={player}
            targetParcel={selectedParcel}
            isAttacking={attackMutation.isPending}
          />

          <BattleWatchModal battleId={watchingBattleId} onClose={() => setWatchingBattleId(null)} players={gameState.players} />
          <OrbitalEventToast events={orbitalEvents} />
        </>
      ) : null}
    </div>
  );
}
