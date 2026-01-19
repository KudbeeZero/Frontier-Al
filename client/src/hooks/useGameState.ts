import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { GameState, LandParcel, Player, Battle, GameEvent, MineAction, UpgradeAction, AttackAction } from "@shared/schema";

export function useGameState() {
  return useQuery<GameState>({
    queryKey: ["/api/game/state"],
    refetchInterval: 5000,
  });
}

export function useSelectedParcel(parcelId: string | null) {
  const { data: gameState } = useGameState();
  
  if (!parcelId || !gameState) return null;
  return gameState.parcels.find((p) => p.id === parcelId) || null;
}

export function usePlayer(playerId: string | null) {
  const { data: gameState } = useGameState();
  
  if (!playerId || !gameState) return null;
  return gameState.players.find((p) => p.id === playerId) || null;
}

export function useCurrentPlayer() {
  const { data: gameState } = useGameState();
  if (!gameState) return null;
  return gameState.players.find((p) => !p.isAI) || null;
}

export function useMine() {
  return useMutation({
    mutationFn: async (action: MineAction) => {
      const response = await apiRequest("POST", "/api/actions/mine", action);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });
}

export function useUpgrade() {
  return useMutation({
    mutationFn: async (action: UpgradeAction) => {
      const response = await apiRequest("POST", "/api/actions/upgrade", action);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });
}

export function useAttack() {
  return useMutation({
    mutationFn: async (action: AttackAction) => {
      const response = await apiRequest("POST", "/api/actions/attack", action);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });
}

export function useBattles() {
  const { data: gameState } = useGameState();
  return gameState?.battles || [];
}

export function useGameEvents() {
  const { data: gameState } = useGameState();
  return gameState?.events || [];
}
