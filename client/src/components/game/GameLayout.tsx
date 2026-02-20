import { useState, useEffect } from "react";
import { TopBar } from "./TopBar";
import { ResourceHUD } from "./ResourceHUD";
import { FlatMap } from "./FlatMap";
import { AttackModal } from "./AttackModal";
import { BottomNav, type NavTab } from "./BottomNav";
import { LandSheet } from "./LandSheet";
import { InventoryPanel } from "./InventoryPanel";
import { BattlesPanel } from "./BattlesPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { CommanderPanel } from "./CommanderPanel";
import { OnboardingFlow } from "./OnboardingFlow";
import { BaseInfoPanel } from "./BaseInfoPanel";
import { WarRoomPanel } from "./WarRoomPanel";
import { WalletConnect } from "./WalletConnect";
import { useWallet } from "@/hooks/useWallet";
import { useBlockchainActions } from "@/hooks/useBlockchainActions";
import { useGameState, useCurrentPlayer, useMine, useUpgrade, useAttack, useBuild, usePurchase, useCollectAll, useClaimFrontier, useMintAvatar, useSwitchCommander, useSpecialAttack, useDeployDrone } from "@/hooks/useGameState";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Coins, Shield, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImprovementType, CommanderTier, SpecialAttackType } from "@shared/schema";

export function GameLayout() {
  const wallet = useWallet();
  const { isConnected, balance } = wallet;
  const { signMineAction, signUpgradeAction, signAttackAction, signPurchaseAction, signClaimFrontierAction, signOptInToFrontier, isWalletConnected, frontierAsaId, isOptedInToFrontier, treasuryAddress } = useBlockchainActions();
  const { data: gameState, isLoading, error } = useGameState();
  const player = useCurrentPlayer();
  const { toast } = useToast();

  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [attackModalOpen, setAttackModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>("map");
  const [showOnboarding, setShowOnboarding] = useState(false);

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

  useEffect(() => {
    const seen = localStorage.getItem("frontier_onboarding_done");
    if (!seen) setShowOnboarding(true);
  }, []);

  useEffect(() => {
    if (player && wallet.address && wallet.isConnected) {
      if (player.address !== wallet.address) {
        fetch("/api/actions/connect-wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: player.id, address: wallet.address }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.welcomeBonus) {
              toast({
                title: "Welcome Commander!",
                description: "You've received 500 FRONTIER tokens as a welcome bonus. Use them to build facilities and grow your empire!",
              });
            }
          })
          .catch((err) => console.error("Failed to sync wallet address:", err));
      }
    }
  }, [player?.id, wallet.address, wallet.isConnected]);

  const handleOnboardingComplete = () => {
    localStorage.setItem("frontier_onboarding_done", "true");
    setShowOnboarding(false);
  };

  const selectedParcel = gameState?.parcels.find((p) => p.id === selectedParcelId) || null;
  const activeBattleCount = gameState?.battles.filter(b => b.status === "pending").length || 0;

  const handleMine = async () => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    mineMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId },
      {
        onSuccess: () => toast({ title: "Mining Complete", description: "Resources extracted successfully." }),
        onError: (error) => toast({ title: "Mining Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleUpgrade = async (type: string) => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    upgradeMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId, upgradeType: type as any },
      {
        onSuccess: () => toast({ title: "Upgrade Complete", description: `${type} upgraded.` }),
        onError: (error) => toast({ title: "Upgrade Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleAttackClick = () => setAttackModalOpen(true);

  const handleAttackConfirm = async (troops: number, iron: number, fuel: number) => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    attackMutation.mutate(
      { attackerId: player.id, targetParcelId: selectedParcelId, troopsCommitted: troops, resourcesBurned: { iron, fuel } },
      {
        onSuccess: () => {
          toast({ title: "Attack Deployed", description: "Battle will resolve in 10 minutes." });
          setAttackModalOpen(false);
        },
        onError: (error) => toast({ title: "Attack Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleBuild = (type: ImprovementType) => {
    if (!player || !selectedParcelId) return;
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
      const txId = await signPurchaseAction(selectedParcel.plotId, selectedParcel.purchasePriceAlgo);
      if (!txId) return;
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
    mintAvatarMutation.mutate(
      { playerId: player.id, tier },
      {
        onSuccess: (data: any) => toast({ title: "Commander Minted", description: `${data.avatar?.name || tier} Commander is ready for battle!` }),
        onError: (error) => toast({ title: "Mint Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleSpecialAttack = (attackType: SpecialAttackType) => {
    if (!player || !selectedParcelId) return;
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
    deployDroneMutation.mutate(
      { playerId: player.id, targetParcelId },
      {
        onSuccess: () => toast({ title: "Drone Deployed", description: "Recon Drone is now scouting enemy territory." }),
        onError: (error) => toast({ title: "Deploy Failed", description: error.message, variant: "destructive" }),
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
      setSelectedParcelId(ownedPlots[0].id);
      setActiveTab("map");
    }
  };

  const handleFindEnemyTarget = () => {
    if (!gameState) return;
    const enemyPlots = gameState.parcels.filter(p => p.ownerId && p.ownerId !== player?.id);
    if (enemyPlots.length > 0) {
      const randomEnemy = enemyPlots[Math.floor(Math.random() * enemyPlots.length)];
      setSelectedParcelId(randomEnemy.id);
      setActiveTab("map");
      toast({ title: "Enemy Located", description: `Plot #${randomEnemy.plotId} owned by ${randomEnemy.ownerType === "ai" ? "AI Faction" : "Player"} — tap to attack!` });
    } else {
      toast({ title: "No Enemies Found", description: "No enemy territories detected yet." });
    }
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

  if (!isConnected) {
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

  const mobileMenuContent = (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="font-display text-lg uppercase tracking-wide">FRONTIER</h2>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <BaseInfoPanel
          parcel={selectedParcel}
          player={player}
          onMine={handleMine}
          onUpgrade={handleUpgrade}
          onAttack={handleAttackClick}
          isMining={mineMutation.isPending}
          isUpgrading={upgradeMutation.isPending}
        />
      </div>
    </div>
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
      ) : null}

      <div className="absolute top-0 left-0 right-0 z-40">
        <TopBar isConnected={isConnected} mobileMenuContent={mobileMenuContent} />
      </div>

      {isConnected && frontierAsaId && !isOptedInToFrontier && (
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
        <div className={cn("absolute left-1/2 -translate-x-1/2 z-20", isConnected && frontierAsaId && !isOptedInToFrontier ? "top-28" : "top-16")}>
          <ResourceHUD
            iron={player.iron}
            fuel={player.fuel}
            crystal={player.crystal}
            frontier={player.frontier}
            algoBalance={balance}
          />
        </div>
      )}

      <aside className="hidden lg:flex flex-col w-72 absolute top-16 left-0 bottom-0 z-30 backdrop-blur-md bg-background/70 border-r border-border p-4 space-y-4 overflow-auto">
        {isLoading ? (
          <>
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : (
          <BaseInfoPanel
            parcel={selectedParcel}
            player={player}
            onMine={handleMine}
            onUpgrade={handleUpgrade}
            onAttack={handleAttackClick}
            isMining={mineMutation.isPending}
            isUpgrading={upgradeMutation.isPending}
          />
        )}
      </aside>

      <aside className="hidden lg:flex flex-col w-72 absolute top-16 right-0 bottom-0 z-30 backdrop-blur-md bg-background/70 border-l border-border overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : gameState ? (
          <WarRoomPanel
            battles={gameState.battles}
            events={gameState.events}
            players={gameState.players}
            className="h-full border-0 rounded-none"
          />
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
              isCollecting={collectMutation.isPending}
              isClaimingFrontier={claimFrontierMutation.isPending}
            />
          )}
          {activeTab === "battles" && gameState && (
            <BattlesPanel
              battles={gameState.battles}
              events={gameState.events}
              players={gameState.players}
            />
          )}
          {activeTab === "commander" && gameState && (
            <CommanderPanel
              player={player}
              onMintAvatar={handleMintAvatar}
              onDeployDrone={handleDeployDrone}
              onSwitchCommander={handleSwitchCommander}
              isMinting={mintAvatarMutation.isPending}
              isDeployingDrone={deployDroneMutation.isPending}
            />
          )}
          {activeTab === "leaderboard" && gameState && (
            <LeaderboardPanel
              entries={gameState.leaderboard}
              currentPlayerId={player?.id || null}
            />
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
    </div>
  );
}
