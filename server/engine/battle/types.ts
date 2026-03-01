/**

- server/engine/battle/types.ts
- 
- Pure, serializable types for the FRONTIER Battle Engine.
- No DB models, no algosdk, no Express — only data shapes.
  */

export type FactionId = string; // e.g. “NEXUS-7” | “KRONOS” | “VANGUARD” | “SPECTRE” | <playerId>
export type PlayerId  = string; // UUID or AI_ prefixed ID
export type PlotId    = number; // Integer plot identifier

export type BiomeType =
| “forest” | “desert” | “mountain” | “plains”
| “water”  | “tundra” | “volcanic” | “swamp”;

export type ImprovementType =
| “turret” | “shield_gen” | “fortress”
| “mine”   | “refinery”   | “solar_array”;

export interface BattleImprovement {
type:  ImprovementType;
level: number;
}

/**

- All inputs the battle engine needs to produce a deterministic result.
- Caller (route/storage) is responsible for loading these from DB.
  */
  export interface BattleInput {
  // Identity
  battleId:   string;
  attackerId: PlayerId;
  defenderId: PlayerId | null;
  plotId:     PlotId;

// Attacker stats
troopsCommitted:   number;
resourcesBurned:   { iron: number; fuel: number };
commanderBonus:    number; // already-resolved commander attack bonus (0 if none)
moraleDebuffActive: boolean;

// Defender stats
defenseLevel:    number;
biome:           BiomeType;
improvements:    BattleImprovement[];

// Orbital / external modifiers
orbitalHazardActive: boolean; // ORBITAL_TILE_HAZARD reduces defense

/**

- Deterministic seed. Caller should derive this from:
- hashSeed(battleId, startTs)
- so that the same battle always produces the same outcome.
  */
  randomSeed: number;
  }

export interface BattleLogEntry {
phase:   “power_calc” | “morale” | “terrain” | “resolution”;
message: string;
}

/**

- Fully deterministic result produced by resolveBattle().
- Contains everything the route needs to write back to the DB.
  */
  export interface BattleResult {
  winner:          “attacker” | “defender”;
  attackerPower:   number; // final adjusted power
  defenderPower:   number; // final adjusted power
  randFactor:      number; // -10 … +10
  outcome:         “attacker_wins” | “defender_wins”;

// Resource changes (positive = attacker gains / defender loses)
pillagedIron:    number;
pillagedFuel:    number;
pillagedCrystal: number;

log: BattleLogEntry[];
}