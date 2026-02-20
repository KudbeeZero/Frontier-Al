import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { GameState, MineAction, UpgradeAction, AttackAction, BuildAction, PurchaseAction, MintAvatarAction, SpecialAttackAction, DeployDroneAction } from "@shared/schema";

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

export function useBuild() {
  return useMutation({
    mutationFn: async (action: BuildAction) => {
      const response = await apiRequest("POST", "/api/actions/build", action);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });
}

export function usePurchase() {
  return useMutation({
    mutationFn: async (action: PurchaseAction) => {
      const response = await apiRequest("POST", "/api/actions/purchase", action);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });
}

export function useCollectAll() {
  return useMutation({
    mutationFn: async (playerId: string) => {
      const response = await apiRequest("POST", "/api/actions/collect", { playerId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });
}

export function useClaimFrontier() {
  return useMutation({
    mutationFn: async (playerId: string) => {
      const response = await apiRequest("POST", "/api/actions/claim-frontier", { playerId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });
}

export function useMintAvatar() {
  return useMutation({
    mutationFn: async (action: MintAvatarAction) => {
      const response = await apiRequest("POST", "/api/actions/mint-avatar", action);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });
}

export function useSpecialAttack() {
  return useMutation({
    mutationFn: async (action: SpecialAttackAction) => {
      const response = await apiRequest("POST", "/api/actions/special-attack", action);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });
}

export function useDeployDrone() {
  return useMutation({
    mutationFn: async (action: DeployDroneAction) => {
      const response = await apiRequest("POST", "/api/actions/deploy-drone", action);
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
