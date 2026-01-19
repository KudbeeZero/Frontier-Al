import { useState } from "react";
import { TopBar } from "./TopBar";
import { ResourceHUD } from "./ResourceHUD";
import { BaseInfoPanel } from "./BaseInfoPanel";
import { WarRoomPanel } from "./WarRoomPanel";
import { HexGrid } from "./HexGrid";
import { AttackModal } from "./AttackModal";
import { useWallet } from "@/hooks/useWallet";
import { useGameState, useCurrentPlayer, useMine, useUpgrade, useAttack } from "@/hooks/useGameState";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function GameLayout() {
  const { isConnected, balance } = useWallet();
  const { data: gameState, isLoading, error } = useGameState();
  const player = useCurrentPlayer();
  const { toast } = useToast();

  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [attackModalOpen, setAttackModalOpen] = useState(false);

  const mineMutation = useMine();
  const upgradeMutation = useUpgrade();
  const attackMutation = useAttack();

  const selectedParcel = gameState?.parcels.find((p) => p.id === selectedParcelId) || null;

  const handleMine = () => {
    if (!player || !selectedParcelId) return;
    mineMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId },
      {
        onSuccess: () => {
          toast({
            title: "Mining Complete",
            description: "Resources have been extracted from your territory.",
          });
        },
        onError: (error) => {
          toast({
            title: "Mining Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleUpgrade = (type: string) => {
    if (!player || !selectedParcelId) return;
    upgradeMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId, upgradeType: type as any },
      {
        onSuccess: () => {
          toast({
            title: "Upgrade Complete",
            description: `Your base has been upgraded with ${type}.`,
          });
        },
        onError: (error) => {
          toast({
            title: "Upgrade Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleAttackClick = () => {
    setAttackModalOpen(true);
  };

  const handleAttackConfirm = (troops: number, iron: number, fuel: number) => {
    if (!player || !selectedParcelId) return;
    attackMutation.mutate(
      {
        attackerId: player.id,
        targetParcelId: selectedParcelId,
        troopsCommitted: troops,
        resourcesBurned: { iron, fuel },
      },
      {
        onSuccess: () => {
          toast({
            title: "Attack Deployed",
            description: "Your troops are en route. Battle will resolve in 4 hours.",
          });
          setAttackModalOpen(false);
        },
        onError: (error) => {
          toast({
            title: "Attack Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
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

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="game-layout">
      <TopBar isConnected={isConnected} mobileMenuContent={mobileMenuContent} />

      <div className="flex-1 flex overflow-hidden">
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
                <p className="font-display text-lg uppercase tracking-wide text-muted-foreground">
                  Loading Game World...
                </p>
              </div>
            </div>
          ) : gameState ? (
            <HexGrid
              parcels={gameState.parcels}
              selectedParcelId={selectedParcelId}
              currentPlayerId={player?.id || null}
              onParcelSelect={setSelectedParcelId}
              className="absolute inset-0"
            />
          ) : null}

          {player && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
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
      </div>

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
