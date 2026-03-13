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

export const biomeBonuses: Record<BiomeType, {
  ironMod: number; fuelMod: number; crystalMod: number; defenseMod: number;
}> = {
  volcanic: { ironMod: 1.8, fuelMod: 0.6, crystalMod: 2.5, defenseMod: 0.8 },
  mountain: { ironMod: 2.0, fuelMod: 0.4, crystalMod: 0.5, defenseMod: 1.3 },
  desert:   { ironMod: 0.6, fuelMod: 2.5, crystalMod: 0.3, defenseMod: 0.9 },
  forest:   { ironMod: 1.2, fuelMod: 1.0, crystalMod: 1.5, defenseMod: 1.1 },
  plains:   { ironMod: 1.0, fuelMod: 1.0, crystalMod: 1.0, defenseMod: 1.0 },
  tundra:   { ironMod: 0.8, fuelMod: 1.8, crystalMod: 0.8, defenseMod: 1.2 },
  swamp:    { ironMod: 0.7, fuelMod: 0.9, crystalMod: 2.0, defenseMod: 0.6 },
  water:    { ironMod: 0.3, fuelMod: 0.3, crystalMod: 3.0, defenseMod: 0.7 },
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
  turret: { name: "Turret", description: "Automated defense turret. Each level adds power to battle defense.", cost: { iron: 40, fuel: 20 }, maxLevel: 3, effect: "+3 def · battle power/lvl" },
  shield_gen: { name: "Shield Generator", description: "Energy shield that reduces influence loss on attack.", cost: { iron: 60, fuel: 40 }, maxLevel: 2, effect: "+5 def · less influence dmg" },
  storage_depot: { name: "Storage Depot", description: "Expands resource storage so mining runs longer before capping.", cost: { iron: 35, fuel: 15 }, maxLevel: 3, effect: "+200 storage capacity/lvl" },
  radar: { name: "Radar Array", description: "Detects incoming attacks. Reduces incoming attacker power by 10%.", cost: { iron: 45, fuel: 35 }, maxLevel: 1, effect: "-10% incoming attack power" },
  fortress: { name: "Fortress", description: "Massive fortification providing maximum defense and storage.", cost: { iron: 200, fuel: 150 }, maxLevel: 1, effect: "+8 def · +50 storage" },
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
    description: "Power grid required by all advanced facilities. Provides baseline token income.",
    costFrontier: [30],
    maxLevel: 1,
    frontierPerDay: [1],
    effect: "+1 FRNTR/day. Unlocks advanced facilities.",
  },
  blockchain_node: {
    name: "Blockchain Node",
    description: "Decentralized computing node. Pure passive FRONTIER token income.",
    costFrontier: [120, 270, 480],
    maxLevel: 3,
    frontierPerDay: [2, 3, 4],
    effect: "+2/3/4 FRNTR/day per level",
    prerequisite: "electricity",
  },
  data_centre: {
    name: "Data Centre",
    description: "High-performance processing that boosts all resource yields from this plot.",
    costFrontier: [120, 270, 480],
    maxLevel: 3,
    frontierPerDay: [0, 0, 0],
    effect: "+5/10/15% resource yield per level",
    prerequisite: "electricity",
  },
  ai_lab: {
    name: "AI Lab",
    description: "AI-optimised mining routines that reduce the mine cooldown on this plot.",
    costFrontier: [120, 270, 480],
    maxLevel: 3,
    frontierPerDay: [0, 0, 0],
    effect: "-30s/-60s/-90s mine cooldown per level",
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
  data_centre: { name: "Data Centre", description: "High-performance processing that boosts all resource yields from this plot.", cost: { iron: 0, fuel: 0 }, maxLevel: 3, effect: "+5/10/15% resource yield per level" },
  ai_lab: { name: "AI Lab", description: "AI-optimised mining routines that reduce the mine cooldown on this plot.", cost: { iron: 0, fuel: 0 }, maxLevel: 3, effect: "-30s/-60s/-90s mine cooldown per level" },
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
  influence: number;
  influenceRepairRate: number;
  // Reconquest tracking — set when human captures AI land
  capturedFromFaction: string | null;
  capturedAt:          number | null;
  handoverCount:       number;
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
  totalCrystalMined: number;
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
  satellites: OrbitalSatellite[];
  welcomeBonusReceived: boolean;
  /** Timestamp (ms) until which morale debuff is active — reduces attack power */
  moraleDebuffUntil?: number;
  /** Timestamp (ms) until which this player/AI cannot launch new attacks */
  attackCooldownUntil?: number;
  /** Running count of consecutive territory losses; resets on a successful defence */
  consecutiveLosses?: number;
  testnetProgress: string[];
  /** AI-only: virtual treasury for land purchases and operations */
  treasury?: number;
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
  crystalBurned?: number;
  influenceDamage?: number;
  /** ID of the commander deployed in this attack */
  commanderId?: string;
  /** ID of the parcel the player chose to launch from (drives globe arc origin) */
  sourceParcelId?: string;
}

export interface GameEvent {
  id: string;
  type: "mine" | "upgrade" | "attack" | "battle_resolved" | "ai_action" | "purchase" | "build" | "claim_frontier" | "mint_avatar" | "special_attack" | "deploy_drone" | "deploy_satellite" | "orbital_event";
  playerId: string;
  parcelId?: string;
  battleId?: string;
  description: string;
  timestamp: number;
}

// ── Orbital Event Engine ─────────────────────────────────────────────────────

export type OrbitalEventType =
  | "METEOR_SHOWER"
  | "SINGLE_BOLIDE"
  | "COMET_PASS"
  | "ORBITAL_DEBRIS"
  | "ATMOSPHERIC_BURST"
  | "IMPACT_STRIKE";

export type OrbitalEffectType = "RESOURCE_BURST" | "TILE_HAZARD";

export interface OrbitalEffect {
  type: OrbitalEffectType;
  /** Multiplier delta: positive = buff, negative = debuff (e.g. 0.5 = +50%) */
  magnitude: number;
  durationMs: number;
  description: string;
}

export interface OrbitalTrajectory {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

export interface OrbitalEvent {
  id: string;
  type: OrbitalEventType;
  /** true = visual-only; false = affects gameplay and requires server authority */
  cosmetic: boolean;
  startAt: number;
  endAt: number;
  /** Deterministic seed — all clients use this to reproduce visuals */
  seed: number;
  /** 0–1 intensity; affects trail length, brightness, shake */
  intensity: number;
  trajectory: OrbitalTrajectory;
  targetParcelId?: string;
  effects?: OrbitalEffect[];
  /** server-set: whether gameplay effects have been applied/resolved */
  resolved?: boolean;
}

// Cosmetic epoch window (ms): every client uses the same window so they generate
// the same visual events without server communication.
export const ORBITAL_EPOCH_MS = 15_000; // 15-second windows for frequent events
export const ORBITAL_WORLD_SEED = 31337; // stable across all clients

// Maximum cosmetic events generated per epoch (tunable)
export const ORBITAL_MAX_COSMETIC_PER_EPOCH = 4;

// Impact event rarity: probability that server creates a gameplay-affecting event
// when `triggerOrbitalCheck` is called.
export const ORBITAL_IMPACT_CHANCE = 0.15; // 15% chance per check

// Effect constants
export const ORBITAL_RESOURCE_BURST_BONUS = 0.5;   // +50% yield
export const ORBITAL_RESOURCE_BURST_MS = 10 * 60 * 1000; // 10 minutes
export const ORBITAL_TILE_HAZARD_PENALTY = -0.4;   // -40% yield
export const ORBITAL_TILE_HAZARD_MS = 8 * 60 * 1000; // 8 minutes

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  address: string;
  territories: number;
  totalIronMined: number;
  totalFuelMined: number;
  totalCrystalMined: number;
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

/** Minimal parcel data broadcast to all clients for globe/map rendering. */
export interface SlimParcel {
  id: string;
  plotId: number;
  lat: number;
  lng: number;
  biome: BiomeType;
  ownerId: string | null;
  activeBattleId: string | null;
}

/** Minimal player data broadcast to all clients for color/name rendering. */
export interface SlimPlayer {
  id: string;
  name: string;
  address: string;
  isAI: boolean;
}

/** Slim game state — broadcast to all clients on every dirty flush. */
export interface SlimGameState {
  parcels: SlimParcel[];
  players: SlimPlayer[];
  battles: Battle[];
  leaderboard: LeaderboardEntry[];
  claimedPlots: number;
  frontierCirculating: number;
  lastUpdateTs: number;
}

export const mineActionSchema = z.object({
  playerId: z.string(),
  parcelId: z.string(),
});

export const upgradeActionSchema = z.object({
  playerId: z.string(),
  parcelId: z.string(),
  upgradeType: z.enum(["defense", "yield", "mine", "bunker"]),
});

export const attackActionSchema = z.object({
  attackerId: z.string(),
  targetParcelId: z.string(),
  troopsCommitted: z.number().min(1),
  resourcesBurned: z.object({
    iron: z.number().min(0),
    fuel: z.number().min(0),
  }),
  crystalBurned: z.number().min(0).optional(),
  commanderId: z.string().optional(),
  sourceParcelId: z.string().optional(),
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
export const BASE_YIELD = { iron: 20, fuel: 12, crystal: 4 };
export const BASE_STORAGE_CAPACITY = 800;
export const UPGRADE_COSTS: Record<string, { iron: number; fuel: number; description: string; effect: string }> = {
  defense: { iron: 50, fuel: 25, description: "Reinforces base defenses", effect: "+1 defense level → +15 battle power" },
  yield:   { iron: 75, fuel: 50, description: "Improves extraction efficiency", effect: "+20% all resource yields permanently" },
  mine:    { iron: 100, fuel: 75, description: "Restores depleted resource veins", effect: "+10 richness (recovers depletion)" },
  bunker:  { iron: 150, fuel: 100, description: "Hardened shelter that accelerates influence repair", effect: "+5 influence repair rate/day" },
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

export const COMMANDER_LOCK_MS = 12 * 60 * 60 * 1000; // 12 hours per deployment

export interface CommanderAvatar {
  id: string;
  tier: CommanderTier;
  name: string;
  attackBonus: number;
  defenseBonus: number;
  specialAbility: string;
  mintedAt: number;
  totalKills: number;
  /** Timestamp (ms) until which this commander is locked after being deployed in an attack */
  lockedUntil?: number;
}

export const COMMANDER_INFO: Record<CommanderTier, {
  name: string;
  description: string;
  mintCostFrontier: number;
  baseAttackBonus: number;
  baseDefenseBonus: number;
  specialAbility: string;
  imageKey: string;
  maxConcurrentAttacks: number;
}> = {
  sentinel: {
    name: "Sentinel",
    description: "Balanced tactical commander with reliable stats",
    mintCostFrontier: 50,
    baseAttackBonus: 10,
    baseDefenseBonus: 10,
    specialAbility: "Fortify",
    imageKey: "sentinel",
    maxConcurrentAttacks: 1,
  },
  phantom: {
    name: "Phantom",
    description: "Stealth specialist excelling at sabotage and infiltration",
    mintCostFrontier: 150,
    baseAttackBonus: 18,
    baseDefenseBonus: 6,
    specialAbility: "Cloak",
    imageKey: "phantom",
    maxConcurrentAttacks: 2,
  },
  reaper: {
    name: "Reaper",
    description: "Elite destroyer with maximum offensive firepower",
    mintCostFrontier: 400,
    baseAttackBonus: 30,
    baseDefenseBonus: 5,
    specialAbility: "Annihilate",
    imageKey: "reaper",
    maxConcurrentAttacks: 3,
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

// ── Battle-loss penalty constants ────────────────────────────────────────────
/** How long (ms) a morale debuff lasts after losing territory (scales with consecutive losses). */
export const MORALE_DEBUFF_BASE_MS = 5 * 60 * 1000; // 5 minutes base
/** Attack power multiplier reduction while morale-debuffed (0.25 = 25% weaker). */
export const MORALE_ATTACK_PENALTY = 0.25;
/** Base attack cooldown (ms) per consecutive loss. Stacks additively. */
export const ATTACK_COOLDOWN_PER_LOSS_MS = 2 * 60 * 1000; // 2 minutes per loss
/** Fraction of stored resources stolen by the attacker on a successful conquest. */
export const PILLAGE_RATE = 0.3;
/** Defense-level reduction applied to parcels adjacent to a freshly-captured territory. */
export const CASCADE_DEFENSE_PENALTY = 1;

export interface OrbitalSatellite {
  id: string;
  deployedAt: number;
  expiresAt: number;
  status: "active" | "expired";
}

export const SATELLITE_DEPLOY_COST_FRONTIER = 50;
export const SATELLITE_ORBIT_DURATION_MS = 60 * 60 * 1000; // 1 hour
export const MAX_SATELLITES = 2;
export const SATELLITE_YIELD_BONUS = 0.25; // +25% mining yield

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

export const deploySatelliteActionSchema = z.object({
  playerId: z.string(),
});

export type MintAvatarAction = z.infer<typeof mintAvatarActionSchema>;
export type SpecialAttackAction = z.infer<typeof specialAttackActionSchema>;
export type DeployDroneAction = z.infer<typeof deployDroneActionSchema>;
export type DeploySatelliteAction = z.infer<typeof deploySatelliteActionSchema>;

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
