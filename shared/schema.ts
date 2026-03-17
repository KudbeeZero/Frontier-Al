import { z } from "zod";

// ── Phase 2: Rare Minerals & Loot System ──────────────────────────────────────

export type RareMineralType = "xenorite" | "void_shard" | "plasma_core" | "dark_matter";

export type LootBoxTier = "common" | "rare" | "epic" | "legendary";

/** Maximum units stored per rare mineral type in a player's vault. */
export const RARE_MINERAL_VAULT_CAP = 50;

/** Maximum unopened loot boxes a player may hold. */
export const LOOT_BOX_INVENTORY_CAP = 20;

/**
 * Per-biome drop chance (0–1) for each rare mineral on a successful mine action.
 * Rolls are independent — a single mine can yield multiple minerals.
 */
export const RARE_MINERAL_DROP_RATES: Record<BiomeType, Partial<Record<RareMineralType, number>>> = {
  volcanic: { xenorite: 0.08, plasma_core: 0.05 },
  mountain: { xenorite: 0.04, void_shard: 0.03 },
  forest:   { void_shard: 0.04, plasma_core: 0.02 },
  desert:   { plasma_core: 0.05, xenorite: 0.03 },
  tundra:   { void_shard: 0.06, dark_matter: 0.01 },
  swamp:    { dark_matter: 0.03, void_shard: 0.02 },
  plains:   { xenorite: 0.02 },
  water:    { dark_matter: 0.02, plasma_core: 0.02 },
};

/**
 * Weighted loot box reward tables.
 * Each entry: { type, weight } — higher weight = more likely to appear.
 * Weights within a tier sum to 100.
 */
export const LOOT_BOX_DROP_TABLES: Record<LootBoxTier, Array<{ mineral: RareMineralType; amount: number; weight: number }>> = {
  common: [
    { mineral: "xenorite",    amount: 1, weight: 50 },
    { mineral: "void_shard",  amount: 1, weight: 30 },
    { mineral: "plasma_core", amount: 1, weight: 20 },
  ],
  rare: [
    { mineral: "xenorite",    amount: 2, weight: 30 },
    { mineral: "void_shard",  amount: 2, weight: 30 },
    { mineral: "plasma_core", amount: 2, weight: 25 },
    { mineral: "dark_matter", amount: 1, weight: 15 },
  ],
  epic: [
    { mineral: "plasma_core", amount: 3, weight: 35 },
    { mineral: "void_shard",  amount: 3, weight: 30 },
    { mineral: "dark_matter", amount: 2, weight: 25 },
    { mineral: "xenorite",    amount: 4, weight: 10 },
  ],
  legendary: [
    { mineral: "dark_matter", amount: 5, weight: 40 },
    { mineral: "plasma_core", amount: 5, weight: 30 },
    { mineral: "void_shard",  amount: 5, weight: 20 },
    { mineral: "xenorite",    amount: 8, weight: 10 },
  ],
};

/** Drop triggers for loot boxes. */
export const LOOT_BOX_TRIGGERS = {
  mine_action:      "common" as LootBoxTier,      // small chance on any mine
  battle_victory:   "rare" as LootBoxTier,         // awarded on attack win
  orbital_impact:   "epic" as LootBoxTier,         // awarded during orbital events
} as const;

/** Probability of awarding a loot box per trigger event. */
export const LOOT_BOX_DROP_CHANCE: Record<keyof typeof LOOT_BOX_TRIGGERS, number> = {
  mine_action:    0.03,   // 3% per mine
  battle_victory: 0.25,   // 25% on win
  orbital_impact: 0.50,   // 50% during orbital event
};

/** A single loot box in a player's inventory. */
export interface LootBoxRecord {
  id:        string;
  tier:      LootBoxTier;
  awardedAt: number; // Unix ms
  openedAt?: number; // Unix ms — undefined if unopened
}

// ── End Phase 2 types ─────────────────────────────────────────────────────────

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
  /** true when this macro-plot has been subdivided into 9 sub-parcels */
  isSubdivided?: boolean;
  /** Owner IDs for each of the 9 sub-parcels (index 0–8, null = unowned) */
  subParcelOwnerIds?: (string | null)[];
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
  /** Faction the human player has aligned with. NULL = unaligned. */
  playerFactionId?: string | null;
  /** Timestamp (ms) when the player joined/last switched faction */
  factionJoinedAt?: number | null;
  // ── Phase 2: Rare Mineral Vault (cap: RARE_MINERAL_VAULT_CAP per type) ──
  xenoriteVault?:    number;
  voidShardVault?:   number;
  plasmaCoreVault?:  number;
  darkMatterVault?:  number;
  // ── Phase 2: Loot Box Inventory (cap: LOOT_BOX_INVENTORY_CAP) ──
  lootBoxes?: LootBoxRecord[];
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
  /** Current season metadata (null if no season started yet) */
  currentSeason: Season | null;
}

/** Minimal parcel data broadcast to all clients for globe/map rendering. */
export type ParcelAnimationType = "pulse_gold" | "shimmer_blue" | "strobe_red" | "glow_cyan" | "none";

export interface ParcelAnimation {
  type: ParcelAnimationType;
  colorHex: string;
  intensity: number;   // 0.0 – 1.0
  startTs: number;
  endTs: number | null; // null = permanent until cleared
}

export interface SlimParcel {
  id: string;
  plotId: number;
  lat: number;
  lng: number;
  biome: BiomeType;
  ownerId: string | null;
  activeBattleId: string | null;
  animation?: ParcelAnimation;
  /** true when this macro-plot has been subdivided into sub-parcels */
  isSubdivided?: boolean;
  /** Sub-parcel ownership counts for subdivided tiles (optional, for globe rendering) */
  subParcelOwnerIds?: (string | null)[];
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
  /** Season countdown — millisecond Unix timestamp when current season ends. null if no season active. */
  seasonEndsAt: number | null;
  /** Human-readable season name e.g. "Season 1: First Colonists" */
  seasonName: string | null;
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

// ─── Trade Station ────────────────────────────────────────────────────────────

export type TradeResource = "iron" | "fuel" | "crystal" | "frontier";

export interface TradeOrder {
  id: string;
  offererId: string;
  offererName: string;
  giveResource: TradeResource;
  giveAmount: number;
  wantResource: TradeResource;
  wantAmount: number;
  status: "open" | "filled" | "cancelled";
  createdAt: number;
  filledById: string | null;
  filledByName: string | null;
  filledAt: number | null;
}

export const createTradeOrderSchema = z.object({
  giveResource: z.enum(["iron", "fuel", "crystal", "frontier"]),
  giveAmount: z.number().int().min(1).max(10000),
  wantResource: z.enum(["iron", "fuel", "crystal", "frontier"]),
  wantAmount: z.number().int().min(1).max(10000),
}).refine(d => d.giveResource !== d.wantResource, {
  message: "Cannot trade a resource for itself",
});

// ─── Sub-Parcel Action Schemas ────────────────────────────────────────────────

export const subdivideParcelSchema = z.object({
  playerId: z.string(),
  plotId: z.number().int().min(1),
});

export const purchaseSubParcelSchema = z.object({
  playerId: z.string(),
  subParcelId: z.string(),
});

export type SubdivideParcelAction = z.infer<typeof subdivideParcelSchema>;
export type PurchaseSubParcelAction = z.infer<typeof purchaseSubParcelSchema>;

// ─── Sub-Parcel System ────────────────────────────────────────────────────────
// Each macro-plot can be subdivided into a 3×3 grid of 9 sub-parcels.
// Sub-parcels are a human-exclusive feature — AI factions own whole macro-plots only.

export const SUB_PARCEL_GRID = 3; // 3×3 = 9 sub-parcels per macro-plot
export const SUB_PARCEL_COUNT = SUB_PARCEL_GRID * SUB_PARCEL_GRID; // 9
/** Hours a player must hold a macro-plot before subdividing it */
export const SUB_PARCEL_HOLD_HOURS = 4;
/** Fraction of parent plot's daily FRONTIER yield each sub-parcel generates */
export const SUB_PARCEL_YIELD_FRACTION = 1 / SUB_PARCEL_COUNT;
/** Bonus multiplier applied when a player owns ALL sub-parcels in a plot */
export const SUB_PARCEL_FULL_CONTROL_BONUS = 1.5; // +50% yield

/** Build costs (FRONTIER) for facilities on a sub-parcel — ≈50% of macro-parcel rates */
export const SUB_PARCEL_FACILITY_COSTS: Record<FacilityType, number[]> = {
  electricity:     [15],
  blockchain_node: [60, 135, 240],
  data_centre:     [60, 135, 240],
  ai_lab:          [60, 135, 240],
};

/** Build costs (Iron/Fuel) for defense improvements on a sub-parcel — ≈50% of macro-parcel rates */
export const SUB_PARCEL_DEFENSE_COSTS: Record<DefenseImprovementType, { iron: number; fuel: number }> = {
  turret:        { iron: 20, fuel: 10 },
  shield_gen:    { iron: 30, fuel: 20 },
  storage_depot: { iron: 18, fuel:  8 },
  radar:         { iron: 22, fuel: 18 },
  fortress:      { iron: 100, fuel: 75 },
};

/**
 * Per-biome cost multipliers for sub-parcel improvements.
 * < 1.0 = discount (biome affinity), > 1.0 = premium (hostile terrain).
 * Only overrides listed; unlisted improvements default to 1.0×.
 */
export const BIOME_UPGRADE_DISCOUNTS: Record<BiomeType, Partial<Record<ImprovementType, number>>> = {
  // Volcanic: rich in minerals/crystal → cheaper blockchain nodes & power, but harsh on defense
  volcanic:  { electricity: 0.80, blockchain_node: 0.70, turret: 1.30, fortress: 1.20 },
  // Mountain: iron-rich → heavy defense is cheap, high-tech facilities expensive
  mountain:  { turret: 0.70, shield_gen: 0.70, fortress: 0.70, radar: 0.80, ai_lab: 1.30 },
  // Desert: fuel-rich → storage cheap, moisture-sensitive data centres expensive
  desert:    { storage_depot: 0.70, radar: 0.80, data_centre: 1.30, shield_gen: 1.20 },
  // Forest: biodiversity → AI labs cheap, turrets need extra clearing
  forest:    { ai_lab: 0.75, blockchain_node: 0.90, turret: 1.15 },
  // Plains: no terrain advantage (baseline)
  plains:    {},
  // Tundra: clear sightlines → radar cheap, shields struggle in cold
  tundra:    { radar: 0.70, storage_depot: 0.80, shield_gen: 1.20 },
  // Swamp: guerrilla terrain → turrets cheap, data centres need moisture protection
  swamp:     { turret: 0.75, storage_depot: 0.80, data_centre: 1.25 },
  // Water: natural cooling → compute facilities very cheap, heavy defense nearly impossible
  water:     { data_centre: 0.65, blockchain_node: 0.70, ai_lab: 0.80, turret: 1.40, fortress: 1.50 },
};

/** Returns the biome cost multiplier for an improvement type (defaults to 1.0 if no override). */
export function getBiomeUpgradeMultiplier(biome: BiomeType, improvementType: ImprovementType): number {
  return BIOME_UPGRADE_DISCOUNTS[biome]?.[improvementType] ?? 1.0;
}

// ─── Sub-Parcel Archetype System ─────────────────────────────────────────────
// Each sub-parcel can be assigned one of four strategic archetypes that define
// its role in the economy and unlock faction-specific bonuses.

export type SubParcelArchetype = "resource" | "trade" | "fortress" | "energy";

/**
 * Energy sub-parcel alignment sub-type (player-side specialization).
 * - helios:  grid efficiency — more power output per tick
 * - aegis:   shield uptime — recharge speed boost for fortress parcels
 * - nexus:   distribution range — powers more distant adjacent parcels
 */
export type EnergyAlignment = "helios" | "aegis" | "nexus";

/**
 * Faction bonus multipliers per archetype.
 * Key is faction name as stored in the factions system.
 */
export const ARCHETYPE_FACTION_BONUSES: Record<SubParcelArchetype, Partial<Record<string, number>>> = {
  resource: { SPECTRE: 0.15 },       // +15% extraction yield
  trade:    { SPECTRE: 0.20 },        // +20% market throughput
  fortress: { KRONOS: 0.25 },         // +25% composite defense rating
  energy:   { "NEXUS-7": 0.20 },     // +20% grid distribution range
};

/**
 * Max number of sub-parcels sharing the same archetype within a single 3×3 grid.
 * Prevents mono-stacking (e.g. all 9 as energy).
 */
export const MAX_SAME_ARCHETYPE_PER_GRID = 3;

/**
 * Fortress archetype level labels.
 * archetypeLevel 1 = Outpost, 2 = Garrison, 3 = Citadel.
 */
export const FORTRESS_LEVEL_NAMES: Record<number, string> = {
  1: "Outpost",
  2: "Garrison",
  3: "Citadel",
};

/**
 * Assign-archetype Zod schema for the API endpoint.
 */
export const assignArchetypeSchema = z.object({
  archetype:        z.enum(["resource", "trade", "fortress", "energy"]),
  archetypeLevel:   z.number().int().min(1).max(3).optional().default(1),
  energyAlignment:  z.enum(["helios", "aegis", "nexus"]).optional(),
});

export type AssignArchetypeAction = z.infer<typeof assignArchetypeSchema>;

export interface SubParcel {
  id: string;
  parentPlotId: number;      // FK → parcels.plotId
  subIndex: number;           // 0–8 (row-major in 3×3 grid)
  ownerId: string | null;
  ownerType: "player" | "ai" | null;
  improvements: Improvement[];
  resourceYieldFraction: number; // fraction of parent plot yield (default 1/9)
  purchasePriceFrontier: number;
  acquiredAt: number | null;     // timestamp when current owner claimed it
  activeBattleId: string | null;
  // ── Archetype fields ──────────────────────────────────────────────────────
  archetype: SubParcelArchetype | null;       // strategic role; null = unassigned
  archetypeLevel: number;                     // 1–3 (fortress tiers); 0 = unassigned
  energyAlignment: EnergyAlignment | null;    // only set when archetype === "energy"
}

// ─── Sub-Parcel Listings (Player-to-Player Trading) ──────────────────────────

export interface SubParcelListing {
  id: string;
  subParcelId: string;
  parentPlotId: number;
  subIndex: number;
  sellerId: string;
  sellerName: string;
  askPriceFrontier: number;
  status: "open" | "sold" | "cancelled";
  createdAt: number;
  buyerId: string | null;
  buyerName: string | null;
  soldAt: number | null;
}

export const createSubParcelListingSchema = z.object({
  subParcelId: z.string(),
  askPriceFrontier: z.number().int().min(1).max(100000),
});

export type CreateSubParcelListingAction = z.infer<typeof createSubParcelListingSchema>;

// ─── Sub-Parcel Attack Schema ─────────────────────────────────────────────────

export const attackSubParcelSchema = z.object({
  attackerParcelId: z.string(),
  commanderId: z.string().optional(),
  troops: z.number().int().min(1).max(10),
  iron: z.number().int().min(0),
  fuel: z.number().int().min(0),
  crystal: z.number().int().min(0),
});

export type AttackSubParcelAction = z.infer<typeof attackSubParcelSchema>;

// ─── Season System ────────────────────────────────────────────────────────────
// Seasons are ~90-day meta-layers. The world PERSISTS between seasons —
// ownership, sub-parcels, and improvements carry forward. Season end only
// takes a leaderboard snapshot and distributes FRONTIER reward tiers.

export type SeasonStatus = "active" | "settling" | "complete";

export interface Season {
  id: string;
  number: number;             // 1, 2, 3… incrementing
  name: string;               // e.g. "Season 1: First Colonists"
  startedAt: number;          // Unix ms
  endsAt: number;             // Unix ms
  status: SeasonStatus;
  /** Top player IDs by plots held at season end */
  winnerId: string | null;
  totalPlotsAtEnd: number | null;
  /** FRONTIER distributed to top-10 at season end */
  rewardPool: number;
}

export interface SeasonLeaderboardEntry extends LeaderboardEntry {
  seasonId: string;
  seasonNumber: number;
  rank: number;
  rewardFrontier: number;
}

// ─── calculateFrontierPerDay ──────────────────────────────────────────────────

// ─── Prediction Markets ───────────────────────────────────────────────────────

export type MarketStatus = "open" | "closed" | "resolved" | "cancelled";
export type MarketCategory = "battle" | "faction" | "season" | "orbital" | "economy";
export type MarketOutcome = "a" | "b";

export interface PredictionMarket {
  id: string;
  title: string;
  description: string;
  category: MarketCategory;
  resolutionCriteria: string;
  outcomeALabel: string;
  outcomeBLabel: string;
  tokenPoolA: number;
  tokenPoolB: number;
  status: MarketStatus;
  resolvesAt: number;
  resolvedAt: number | null;
  winningOutcome: MarketOutcome | null;
  createdBy: string;
  relatedEventId: string | null;
  createdAt: number;
}

export interface MarketPosition {
  id: string;
  marketId: string;
  playerId: string;
  outcome: MarketOutcome;
  amountWagered: number;
  claimed: boolean;
  createdAt: number;
}

export const MARKET_FEE_RATE = 0.05; // 5% protocol fee on winning pool

export const placeBetSchema = z.object({
  playerId: z.string(),
  outcome: z.enum(["a", "b"]),
  amount: z.number().int().min(1),
});

export const createMarketSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10),
  category: z.enum(["battle", "faction", "season", "orbital", "economy"]),
  resolutionCriteria: z.string().min(10),
  outcomeALabel: z.string().min(1).max(100).default("Yes"),
  outcomeBLabel: z.string().min(1).max(100).default("No"),
  resolvesAt: z.number().int().positive(),
  relatedEventId: z.string().optional(),
});

export const resolveMarketSchema = z.object({
  winningOutcome: z.enum(["a", "b"]),
});

export type PlaceBetAction = z.infer<typeof placeBetSchema>;
export type CreateMarketAction = z.infer<typeof createMarketSchema>;
export type ResolveMarketAction = z.infer<typeof resolveMarketSchema>;

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
