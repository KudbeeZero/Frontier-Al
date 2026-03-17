import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { GameState, MineAction, UpgradeAction, AttackAction, BuildAction, PurchaseAction, MintAvatarAction, SpecialAttackAction, DeployDroneAction, DeploySatelliteAction } from "@shared/schema";

export function useGameState() {
  return useQuery<GameState>({
    queryKey: ["/api/game/state"],
    refetchInterval: 30_000,  // fallback poll — WS push handles real-time updates
    placeholderData: keepPreviousData,  // keep stale data during refetch so the globe never unmounts
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

export function useCurrentPlayer(walletAddress?: string | null) {
  const { data: gameState } = useGameState();
  if (!gameState) return null;
  if (walletAddress) {
    const lower = walletAddress.toLowerCase();
    return gameState.players.find((p) => p.address.toLowerCase() === lower) ?? null;
  }
  return gameState.players.find((p) => !p.isAI) ?? null;
}

export function useMine() {
  return useMutation({
    mutationFn: async (action: MineAction) => {
      const response = await apiRequest("POST", "/api/actions/mine", action);
      return response.json();
    },
    onMutate: async (action: MineAction) => {
      await queryClient.cancelQueries({ queryKey: ["/api/game/state"] });
      const previous = queryClient.getQueryData<GameState>(["/api/game/state"]);
      queryClient.setQueryData<GameState>(["/api/game/state"], (old) => {
        if (!old) return old;
        return {
          ...old,
          parcels: old.parcels.map(p =>
            p.id === action.parcelId ? { ...p, lastMineTs: Date.now() } : p
          ),
        };
      });
      return { previous };
    },
    onSuccess: (data: any, action: MineAction) => {
      const yields = data?.yield as { iron: number; fuel: number; crystal: number } | undefined;
      if (yields) {
        queryClient.setQueryData<GameState>(["/api/game/state"], (old) => {
          if (!old) return old;
          return {
            ...old,
            players: old.players.map(p =>
              p.id === action.playerId
                ? { ...p, iron: p.iron + yields.iron, fuel: p.fuel + yields.fuel, crystal: p.crystal + yields.crystal }
                : p
            ),
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
    onError: (_err: unknown, _action: MineAction, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/game/state"], context.previous);
      }
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
    mutationFn: async (action: MintAvatarAction & { algoPaymentTxId?: string }) => {
      const response = await apiRequest("POST", "/api/actions/mint-avatar", action);
      return response.json();
    },
    onMutate: async (action: MintAvatarAction & { algoPaymentTxId?: string }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/game/state"] });
      const previous = queryClient.getQueryData<GameState>(["/api/game/state"]);
      queryClient.setQueryData<GameState>(["/api/game/state"], (old) => {
        if (!old) return old;
        return {
          ...old,
          players: old.players.map(p =>
            p.id === action.playerId
              ? { ...p, frontier: Math.max(0, p.frontier - 50) } // Optimistic: reduce by sentinel cost (minimum)
              : p
          ),
        };
      });
      return { previous };
    },
    onSuccess: (data: any) => {
      const newCommander = data?.commander;
      if (newCommander) {
        queryClient.setQueryData<GameState>(["/api/game/state"], (old) => {
          if (!old) return old;
          return {
            ...old,
            players: old.players.map(p =>
              p.commanders ? { ...p, commanders: [...p.commanders, newCommander] } : p
            ),
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
    onError: (_err: unknown, _action: MintAvatarAction & { algoPaymentTxId?: string }, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/game/state"], context.previous);
      }
    },
  });
}

export function useSwitchCommander() {
  return useMutation({
    mutationFn: async (data: { playerId: string; commanderIndex: number }) => {
      const response = await apiRequest("POST", "/api/actions/switch-commander", data);
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

export function useDeploySatellite() {
  return useMutation({
    mutationFn: async (action: DeploySatelliteAction) => {
      const response = await apiRequest("POST", "/api/actions/deploy-satellite", action);
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
