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

export type DefenseImprovementType = "turret" | "shield_gen" | "storage_depot" | "radar" | "fortress";
export type FacilityType = "electricity" | "blockchain_node" | "data_centre" | "ai_lab";
export type ImprovementType = DefenseImprovementType | FacilityType;

export interface Improvement {
  type: ImprovementType;
  level: number;
}

export const DEFENSE_IMPROVEMENT_INFO: Record<DefenseImprovementType, {
  name: string;
  description: string;
  cost: { iron: number; fuel: number };
  maxLevel: number;
  effect: string;
}> = {
  turret: { name: "Turret", description: "Automated defense turret", cost: { iron: 40, fuel: 20 }, maxLevel: 3, effect: "+3 defense per level" },
  shield_gen: { name: "Shield Generator", description: "Energy shield for base", cost: { iron: 60, fuel: 40 }, maxLevel: 2, effect: "+5 defense per level" },
  storage_depot: { name: "Storage Depot", description: "Increases storage capacity", cost: { iron: 35, fuel: 15 }, maxLevel: 3, effect: "+100 capacity per level" },
  radar: { name: "Radar Array", description: "Early warning system", cost: { iron: 45, fuel: 35 }, maxLevel: 1, effect: "See incoming attacks" },
  fortress: { name: "Fortress", description: "Heavy fortification", cost: { iron: 200, fuel: 150 }, maxLevel: 1, effect: "+8 defense, +50 capacity" },
};

export const FACILITY_INFO: Record<FacilityType, {
  name: string;
  description: string;
  costFrontier: number[];
  maxLevel: number;
  frontierPerDay: number[];
  effect: string;
  prerequisite?: FacilityType;
}> = {
  electricity: {
    name: "Electricity",
    description: "Power grid enabling advanced facilities",
    costFrontier: [30],
    maxLevel: 1,
    frontierPerDay: [1],
    effect: "+1 FRNTR/day",
  },
  blockchain_node: {
    name: "Blockchain Node",
    description: "Decentralized computing node generating tokens",
    costFrontier: [120, 270, 480],
    maxLevel: 3,
    frontierPerDay: [2, 3, 4],
    effect: "+2/3/4 FRNTR/day per level",
    prerequisite: "electricity",
  },
  data_centre: {
    name: "Data Centre",
    description: "High-performance data processing facility",
    costFrontier: [120, 270, 480],
    maxLevel: 3,
    frontierPerDay: [2, 3, 4],
    effect: "+2/3/4 FRNTR/day per level",
    prerequisite: "electricity",
  },
  ai_lab: {
    name: "AI Lab",
    description: "Artificial intelligence research laboratory",
    costFrontier: [120, 270, 480],
    maxLevel: 3,
    frontierPerDay: [2, 3, 4],
    effect: "+2/3/4 FRNTR/day per level",
    prerequisite: "electricity",
  },
};

export const IMPROVEMENT_INFO: Record<ImprovementType, {
  name: string;
  description: string;
  cost: { iron: number; fuel: number };
  maxLevel: number;
  effect: string;
}> = {
  ...DEFENSE_IMPROVEMENT_INFO,
  electricity: { name: "Electricity", description: "Power grid", cost: { iron: 0, fuel: 0 }, maxLevel: 1, effect: "+1 FRNTR/day" },
  blockchain_node: { name: "Blockchain Node", description: "Computing node", cost: { iron: 0, fuel: 0 }, maxLevel: 3, effect: "+2/3/4 FRNTR/day" },
  data_centre: { name: "Data Centre", description: "Data processing", cost: { iron: 0, fuel: 0 }, maxLevel: 3, effect: "+2/3/4 FRNTR/day" },
  ai_lab: { name: "AI Lab", description: "AI research", cost: { iron: 0, fuel: 0 }, maxLevel: 3, effect: "+2/3/4 FRNTR/day" },
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
  frontierPerDay: number;
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
  totalFrontierBurned: number;
  attacksWon: number;
  attacksLost: number;
  territoriesCaptured: number;
  commander: CommanderAvatar | null;
  commanders: CommanderAvatar[];
  activeCommanderIndex: number;
  specialAttacks: SpecialAttackRecord[];
  drones: ReconDrone[];
  welcomeBonusReceived: boolean;
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
  type: "mine" | "upgrade" | "attack" | "battle_resolved" | "ai_action" | "purchase" | "build" | "claim_frontier" | "mint_avatar" | "special_attack" | "deploy_drone";
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
  improvementType: z.enum(["turret", "shield_gen", "storage_depot", "radar", "fortress", "electricity", "blockchain_node", "data_centre", "ai_lab"]),
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
export const WELCOME_BONUS_FRONTIER = 500;

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

export type CommanderTier = "sentinel" | "phantom" | "reaper";

export interface CommanderAvatar {
  id: string;
  tier: CommanderTier;
  name: string;
  attackBonus: number;
  defenseBonus: number;
  specialAbility: string;
  mintedAt: number;
  totalKills: number;
}

export const COMMANDER_INFO: Record<CommanderTier, {
  name: string;
  description: string;
  mintCostFrontier: number;
  baseAttackBonus: number;
  baseDefenseBonus: number;
  specialAbility: string;
  imageKey: string;
}> = {
  sentinel: {
    name: "Sentinel",
    description: "Balanced tactical commander with reliable stats",
    mintCostFrontier: 50,
    baseAttackBonus: 10,
    baseDefenseBonus: 10,
    specialAbility: "Fortify",
    imageKey: "sentinel",
  },
  phantom: {
    name: "Phantom",
    description: "Stealth specialist excelling at sabotage and infiltration",
    mintCostFrontier: 150,
    baseAttackBonus: 18,
    baseDefenseBonus: 6,
    specialAbility: "Cloak",
    imageKey: "phantom",
  },
  reaper: {
    name: "Reaper",
    description: "Elite destroyer with maximum offensive firepower",
    mintCostFrontier: 400,
    baseAttackBonus: 30,
    baseDefenseBonus: 5,
    specialAbility: "Annihilate",
    imageKey: "reaper",
  },
};

export type SpecialAttackType = "orbital_strike" | "emp_blast" | "siege_barrage" | "sabotage";

export interface SpecialAttackRecord {
  type: SpecialAttackType;
  lastUsedTs: number;
}

export const SPECIAL_ATTACK_INFO: Record<SpecialAttackType, {
  name: string;
  description: string;
  costFrontier: number;
  cooldownMs: number;
  damageMultiplier: number;
  effect: string;
  requiredTier: CommanderTier[];
}> = {
  orbital_strike: {
    name: "Orbital Strike",
    description: "Devastating bombardment from orbit, bypasses shields",
    costFrontier: 25,
    cooldownMs: 30 * 60 * 1000,
    damageMultiplier: 3.0,
    effect: "Ignores 50% of target defense",
    requiredTier: ["sentinel", "phantom", "reaper"],
  },
  emp_blast: {
    name: "EMP Blast",
    description: "Disables turrets and shield generators temporarily",
    costFrontier: 15,
    cooldownMs: 20 * 60 * 1000,
    damageMultiplier: 1.5,
    effect: "Disables improvements for 10 minutes",
    requiredTier: ["phantom", "reaper"],
  },
  siege_barrage: {
    name: "Siege Barrage",
    description: "Area bombardment hitting target and nearby plots",
    costFrontier: 40,
    cooldownMs: 45 * 60 * 1000,
    damageMultiplier: 2.0,
    effect: "Damages up to 3 nearby enemy plots",
    requiredTier: ["reaper"],
  },
  sabotage: {
    name: "Sabotage",
    description: "Covert ops reducing enemy resource production",
    costFrontier: 10,
    cooldownMs: 15 * 60 * 1000,
    damageMultiplier: 0.5,
    effect: "Halves target mining yield for 30 minutes",
    requiredTier: ["phantom", "reaper"],
  },
};

export interface ReconDrone {
  id: string;
  deployedAt: number;
  targetParcelId: string | null;
  status: "idle" | "scouting" | "returned";
  discoveredResources: { iron: number; fuel: number; crystal: number };
  scoutReportReady: boolean;
}

export const DRONE_MINT_COST_FRONTIER = 20;
export const DRONE_SCOUT_DURATION_MS = 15 * 60 * 1000;
export const MAX_DRONES = 5;

export const mintAvatarActionSchema = z.object({
  playerId: z.string(),
  tier: z.enum(["sentinel", "phantom", "reaper"]),
});

export const specialAttackActionSchema = z.object({
  playerId: z.string(),
  targetParcelId: z.string(),
  attackType: z.enum(["orbital_strike", "emp_blast", "siege_barrage", "sabotage"]),
});

export const deployDroneActionSchema = z.object({
  playerId: z.string(),
  targetParcelId: z.string().optional(),
});

export type MintAvatarAction = z.infer<typeof mintAvatarActionSchema>;
export type SpecialAttackAction = z.infer<typeof specialAttackActionSchema>;
export type DeployDroneAction = z.infer<typeof deployDroneActionSchema>;

export function calculateFrontierPerDay(improvements: Improvement[]): number {
  let perDay = 1;
  
  const electricity = improvements.find(i => i.type === "electricity");
  if (electricity) {
    perDay += 1;
    
    const bcNode = improvements.find(i => i.type === "blockchain_node");
    if (bcNode) perDay += FACILITY_INFO.blockchain_node.frontierPerDay[bcNode.level - 1];
    
    const dc = improvements.find(i => i.type === "data_centre");
    if (dc) perDay += FACILITY_INFO.data_centre.frontierPerDay[dc.level - 1];
    
    const aiLab = improvements.find(i => i.type === "ai_lab");
    if (aiLab) perDay += FACILITY_INFO.ai_lab.frontierPerDay[aiLab.level - 1];
  }
  
  return perDay;
}
