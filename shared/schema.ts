import { z } from "zod";

export type BiomeType = "forest" | "desert" | "mountain" | "plains" | "water" | "tundra" | "volcanic" | "swamp";

export const biomeColors: Record<BiomeType, string> = {
  forest: "#1a472a",
  desert: "#c2a83e",
  mountain: "#5c5c5c",
  plains: "#4a7c23",
  water: "#1e4d7b",
  tundra: "#a8c8d8",
  volcanic: "#8b2500",
  swamp: "#3a5a2a",
};

export const biomeBonuses: Record<BiomeType, { yieldMod: number; defenseMod: number }> = {
  forest: { yieldMod: 1.2, defenseMod: 1.1 },
  desert: { yieldMod: 0.8, defenseMod: 0.9 },
  mountain: { yieldMod: 0.6, defenseMod: 1.3 },
  plains: { yieldMod: 1.0, defenseMod: 1.0 },
  water: { yieldMod: 0.5, defenseMod: 0.7 },
  tundra: { yieldMod: 0.7, defenseMod: 1.2 },
  volcanic: { yieldMod: 1.5, defenseMod: 0.8 },
  swamp: { yieldMod: 0.9, defenseMod: 0.6 },
};

export const FRONTIER_PER_HOUR_BY_BIOME: Record<BiomeType, number> = {
  forest: 1.2,
  desert: 0.8,
  mountain: 1.0,
  plains: 1.0,
  water: 0.5,
  tundra: 0.7,
  volcanic: 1.5,
  swamp: 0.9,
};

export type ImprovementType = "turret" | "shield_gen" | "mine_drill" | "storage_depot" | "radar" | "fortress";

export interface Improvement {
  type: ImprovementType;
  level: number;
}

export const IMPROVEMENT_INFO: Record<ImprovementType, {
  name: string;
  description: string;
  cost: { iron: number; fuel: number };
  maxLevel: number;
  effect: string;
}> = {
  turret: { name: "Turret", description: "Automated defense turret", cost: { iron: 40, fuel: 20 }, maxLevel: 3, effect: "+3 defense per level" },
  shield_gen: { name: "Shield Generator", description: "Energy shield for base", cost: { iron: 60, fuel: 40 }, maxLevel: 2, effect: "+5 defense per level" },
  mine_drill: { name: "Mining Drill", description: "Automated mining drill", cost: { iron: 50, fuel: 30 }, maxLevel: 3, effect: "+25% yield per level" },
  storage_depot: { name: "Storage Depot", description: "Increases storage capacity", cost: { iron: 35, fuel: 15 }, maxLevel: 3, effect: "+100 capacity per level" },
  radar: { name: "Radar Array", description: "Early warning system", cost: { iron: 45, fuel: 35 }, maxLevel: 1, effect: "See incoming attacks" },
  fortress: { name: "Fortress", description: "Heavy fortification", cost: { iron: 200, fuel: 150 }, maxLevel: 1, effect: "+8 defense, +50 capacity" },
};

export interface LandParcel {
  id: string;
  plotId: number;
  lat: number;
  lng: number;
  biome: BiomeType;
  richness: number;
  ownerId: string | null;
  ownerType: "player" | "ai" | null;
  defenseLevel: number;
  ironStored: number;
  fuelStored: number;
  crystalStored: number;
  storageCapacity: number;
  lastMineTs: number;
  activeBattleId: string | null;
  yieldMultiplier: number;
  improvements: Improvement[];
  purchasePriceAlgo: number | null;
  frontierAccumulated: number;
  lastFrontierClaimTs: number;
  frontierPerHour: number;
}

export interface Player {
  id: string;
  address: string;
  name: string;
  iron: number;
  fuel: number;
  crystal: number;
  frontier: number;
  ownedParcels: string[];
  isAI: boolean;
  aiBehavior?: "expansionist" | "defensive" | "raider" | "economic" | "adaptive";
  totalIronMined: number;
  totalFuelMined: number;
  totalFrontierEarned: number;
  attacksWon: number;
  attacksLost: number;
  territoriesCaptured: number;
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
  type: "mine" | "upgrade" | "attack" | "battle_resolved" | "ai_action" | "purchase" | "build" | "claim_frontier";
  playerId: string;
  parcelId?: string;
  battleId?: string;
  description: string;
  timestamp: number;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  address: string;
  territories: number;
  totalIronMined: number;
  totalFuelMined: number;
  totalFrontierEarned: number;
  attacksWon: number;
  attacksLost: number;
  isAI: boolean;
}

export interface GameState {
  parcels: LandParcel[];
  players: Player[];
  battles: Battle[];
  events: GameEvent[];
  leaderboard: LeaderboardEntry[];
  currentTurn: number;
  lastUpdateTs: number;
  totalPlots: number;
  claimedPlots: number;
  frontierTotalSupply: number;
  frontierCirculating: number;
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

export const buildActionSchema = z.object({
  playerId: z.string(),
  parcelId: z.string(),
  improvementType: z.enum(["turret", "shield_gen", "mine_drill", "storage_depot", "radar", "fortress"]),
});

export const purchaseActionSchema = z.object({
  playerId: z.string(),
  parcelId: z.string(),
});

export const collectActionSchema = z.object({
  playerId: z.string(),
});

export const claimFrontierActionSchema = z.object({
  playerId: z.string(),
});

export type MineAction = z.infer<typeof mineActionSchema>;
export type UpgradeAction = z.infer<typeof upgradeActionSchema>;
export type AttackAction = z.infer<typeof attackActionSchema>;
export type BuildAction = z.infer<typeof buildActionSchema>;
export type PurchaseAction = z.infer<typeof purchaseActionSchema>;
export type CollectAction = z.infer<typeof collectActionSchema>;
export type ClaimFrontierAction = z.infer<typeof claimFrontierActionSchema>;

export const MINE_COOLDOWN_MS = 5 * 60 * 1000;
export const BATTLE_DURATION_MS = 10 * 60 * 1000;
export const BASE_YIELD = { iron: 10, fuel: 5, crystal: 1 };
export const BASE_STORAGE_CAPACITY = 200;
export const UPGRADE_COSTS: Record<string, { iron: number; fuel: number }> = {
  defense: { iron: 50, fuel: 25 },
  yield: { iron: 75, fuel: 50 },
  mine: { iron: 100, fuel: 75 },
  fortress: { iron: 200, fuel: 150 },
};
export const ATTACK_BASE_COST = { iron: 30, fuel: 20 };

export const TOTAL_PLOTS = 21000;
export const FRONTIER_TOTAL_SUPPLY = 1_000_000_000;

export const LAND_PURCHASE_ALGO: Record<BiomeType, number> = {
  forest: 0.5,
  plains: 0.3,
  mountain: 0.8,
  desert: 0.2,
  water: 1.5,
  tundra: 0.4,
  volcanic: 1.0,
  swamp: 0.3,
};
