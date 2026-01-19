import { z } from "zod";

export type BiomeType = "forest" | "desert" | "mountain" | "plains" | "water";

export const biomeColors: Record<BiomeType, string> = {
  forest: "#1a472a",
  desert: "#c2a83e",
  mountain: "#5c5c5c",
  plains: "#4a7c23",
  water: "#1e4d7b",
};

export const biomeBonuses: Record<BiomeType, { yieldMod: number; defenseMod: number }> = {
  forest: { yieldMod: 1.2, defenseMod: 1.1 },
  desert: { yieldMod: 0.8, defenseMod: 0.9 },
  mountain: { yieldMod: 0.6, defenseMod: 1.3 },
  plains: { yieldMod: 1.0, defenseMod: 1.0 },
  water: { yieldMod: 0.5, defenseMod: 0.7 },
};

export interface HexCoord {
  q: number;
  r: number;
}

export interface LandParcel {
  id: string;
  q: number;
  r: number;
  biome: BiomeType;
  richness: number;
  ownerId: string | null;
  ownerType: "player" | "ai" | null;
  defenseLevel: number;
  ironStored: number;
  fuelStored: number;
  lastMineTs: number;
  activeBattleId: string | null;
  yieldMultiplier: number;
  improvements: string[];
}

export interface Player {
  id: string;
  address: string;
  name: string;
  iron: number;
  fuel: number;
  crystal: number;
  ownedParcels: string[];
  isAI: boolean;
  aiBehavior?: "expansionist" | "defensive" | "raider" | "economic" | "adaptive";
}

export interface Battle {
  id: string;
  attackerId: string;
  defenderId: string | null;
  targetParcelId: string;
  attackerPower: number;
  defenderPower: number;
  troopsCommitted: number;
  resourcesBurned: { iron: number; fuel: number };
  startTs: number;
  resolveTs: number;
  status: "pending" | "resolved";
  outcome?: "attacker_wins" | "defender_wins";
  randFactor?: number;
}

export interface GameEvent {
  id: string;
  type: "mine" | "upgrade" | "attack" | "battle_resolved" | "ai_action";
  playerId: string;
  parcelId?: string;
  battleId?: string;
  description: string;
  timestamp: number;
}

export interface GameState {
  parcels: LandParcel[];
  players: Player[];
  battles: Battle[];
  events: GameEvent[];
  currentTurn: number;
  lastUpdateTs: number;
}

export const mineActionSchema = z.object({
  playerId: z.string(),
  parcelId: z.string(),
});

export const upgradeActionSchema = z.object({
  playerId: z.string(),
  parcelId: z.string(),
  upgradeType: z.enum(["defense", "yield", "mine", "fortress"]),
});

export const attackActionSchema = z.object({
  attackerId: z.string(),
  targetParcelId: z.string(),
  troopsCommitted: z.number().min(1),
  resourcesBurned: z.object({
    iron: z.number().min(0),
    fuel: z.number().min(0),
  }),
});

export type MineAction = z.infer<typeof mineActionSchema>;
export type UpgradeAction = z.infer<typeof upgradeActionSchema>;
export type AttackAction = z.infer<typeof attackActionSchema>;

export const MINE_COOLDOWN_MS = 60 * 60 * 1000;
export const BATTLE_DURATION_MS = 4 * 60 * 60 * 1000;
export const BASE_YIELD = { iron: 10, fuel: 5 };
export const UPGRADE_COSTS: Record<string, { iron: number; fuel: number }> = {
  defense: { iron: 50, fuel: 25 },
  yield: { iron: 75, fuel: 50 },
  mine: { iron: 100, fuel: 75 },
  fortress: { iron: 200, fuel: 150 },
};
export const ATTACK_BASE_COST = { iron: 30, fuel: 20 };
