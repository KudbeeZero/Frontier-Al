import { useState, useEffect } from "react";
import { TopBar } from "./TopBar";
import { ResourceHUD } from "./ResourceHUD";
import { HexGrid } from "./HexGrid";
import { PlanetGlobe } from "./PlanetGlobe";
import { AttackModal } from "./AttackModal";
import { BottomNav, type NavTab } from "./BottomNav";
import { LandSheet } from "./LandSheet";
import { InventoryPanel } from "./InventoryPanel";
import { BattlesPanel } from "./BattlesPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { RulesPanel } from "./RulesPanel";
import { OnboardingFlow } from "./OnboardingFlow";
import { BaseInfoPanel } from "./BaseInfoPanel";
import { WarRoomPanel } from "./WarRoomPanel";
import { useWallet } from "@/hooks/useWallet";
import { useBlockchainActions } from "@/hooks/useBlockchainActions";
import { useGameState, useCurrentPlayer, useMine, useUpgrade, useAttack, useBuild, usePurchase, useCollectAll } from "@/hooks/useGameState";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { ImprovementType } from "@shared/schema";

export function GameLayout() {
  const { isConnected, balance } = useWallet();
  const { signMineAction, signUpgradeAction, signAttackAction, isWalletConnected } = useBlockchainActions();
  const { data: gameState, isLoading, error } = useGameState();
  const player = useCurrentPlayer();
  const { toast } = useToast();

  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [attackModalOpen, setAttackModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>("map");
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("frontier_onboarding_done");
    if (!seen) setShowOnboarding(true);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("frontier_onboarding_done", "true");
    setShowOnboarding(false);
  };

  const mineMutation = useMine();
  const upgradeMutation = useUpgrade();
  const attackMutation = useAttack();
  const buildMutation = useBuild();
  const purchaseMutation = usePurchase();
  const collectMutation = useCollectAll();

  const selectedParcel = gameState?.parcels.find((p) => p.id === selectedParcelId) || null;
  const activeBattleCount = gameState?.battles.filter(b => b.status === "pending").length || 0;

  const handleMine = async () => {
    if (!player || !selectedParcelId) return;
    if (isWalletConnected) {
      const txId = await signMineAction(selectedParcelId);
      if (!txId) return;
    }
    mineMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId },
      {
        onSuccess: () => toast({ title: "Mining Complete", description: "Resources extracted successfully." }),
        onError: (error) => toast({ title: "Mining Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleUpgrade = async (type: string) => {
    if (!player || !selectedParcelId) return;
    if (isWalletConnected) {
      const txId = await signUpgradeAction(selectedParcelId, type);
      if (!txId) return;
    }
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
    if (!player || !selectedParcelId) return;
    if (isWalletConnected) {
      const txId = await signAttackAction(selectedParcelId, troops, iron, fuel);
      if (!txId) return;
    }
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

  const handlePurchase = () => {
    if (!player || !selectedParcelId) return;
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

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab === "map") setSelectedParcelId(selectedParcelId);
  };

  const handleParcelSelectFromInventory = (id: string) => {
    setSelectedParcelId(id);
    setActiveTab("map");
  };

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
    <div className="flex flex-col h-screen bg-background" data-testid="game-layout">
      <TopBar isConnected={isConnected} mobileMenuContent={mobileMenuContent} />

      <div className="flex-1 flex overflow-hidden relative">
        <aside className="hidden lg:flex flex-col w-80 border-r border-border p-4 space-y-4 overflow-auto bg-sidebar/50">
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

        <main className="flex-1 relative overflow-hidden">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="font-display text-lg uppercase tracking-wide text-muted-foreground">Loading Game World...</p>
              </div>
            </div>
          ) : gameState ? (
            <PlanetGlobe
              parcels={gameState.parcels}
              selectedParcelId={selectedParcelId}
              currentPlayerId={player?.id || null}
              onParcelSelect={setSelectedParcelId}
              className="absolute inset-0"
            />
          ) : null}

          {player && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
              <ResourceHUD
                iron={player.iron}
                fuel={player.fuel}
                crystal={player.crystal}
                algoBalance={balance}
              />
            </div>
          )}
        </main>

        <aside className="hidden lg:flex flex-col w-80 border-l border-border overflow-auto bg-sidebar/50">
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
          <div className="lg:hidden absolute inset-0 z-30 bg-background" data-testid="fullscreen-panel">
            {activeTab === "inventory" && gameState && (
              <InventoryPanel
                player={player}
                parcels={gameState.parcels}
                onCollectAll={handleCollectAll}
                onSelectParcel={handleParcelSelectFromInventory}
                isCollecting={collectMutation.isPending}
              />
            )}
            {activeTab === "battles" && gameState && (
              <BattlesPanel
                battles={gameState.battles}
                events={gameState.events}
                players={gameState.players}
              />
            )}
            {activeTab === "leaderboard" && gameState && (
              <LeaderboardPanel
                entries={gameState.leaderboard}
                currentPlayerId={player?.id || null}
              />
            )}
            {activeTab === "rules" && <RulesPanel />}
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
            onClose={() => setSelectedParcelId(null)}
            isMining={mineMutation.isPending}
            isUpgrading={upgradeMutation.isPending}
            isBuilding={buildMutation.isPending}
            isPurchasing={purchaseMutation.isPending}
          />
        )}
      </div>

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
