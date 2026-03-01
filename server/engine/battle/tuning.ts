/**
 * server/engine/battle/tuning.ts
 *
 * Centralised numeric constants for the FRONTIER Battle Engine.
 * Change these to re-balance the game without touching resolve.ts.
 */

// ── Power Multipliers ────────────────────────────────────────────────────────

/** Troops-to-power conversion: each troop contributes this much attacker power. */
export const TROOPS_POWER_FACTOR = 10;

/** Iron burned → attacker power contribution per unit. */
export const IRON_POWER_FACTOR = 0.5;

/** Fuel burned → attacker power contribution per unit. */
export const FUEL_POWER_FACTOR = 0.8;

/** Base defense level multiplier. */
export const BASE_DEFENSE_POWER = 15;

/** Each improvement level of turret / shield_gen / fortress adds this much defense power. */
export const IMPROVEMENT_DEFENSE_PER_LEVEL = 5;

// ── Morale ───────────────────────────────────────────────────────────────────

/** Attacker power is reduced by this fraction when morale debuff is active (0.0–1.0). */
export const MORALE_ATTACK_PENALTY = 0.15;

// ── Terrain ──────────────────────────────────────────────────────────────────

export const BIOME_DEFENSE_MOD: Record<string, number> = {
  mountain:  1.4,
  volcanic:  1.3,
  tundra:    1.2,
  forest:    1.1,
  swamp:     1.1,
  plains:    1.0,
  desert:    0.9,
  water:     0.5, // effectively un-capturable via normal battle
};

// ── Randomness ───────────────────────────────────────────────────────────────

/**
 * randFactor range: attacker power is multiplied by (1 + randFactor/100).
 * Range is [-RAND_FACTOR_MAX, +RAND_FACTOR_MAX].
 */
export const RAND_FACTOR_MAX = 10;

// ── Pillage ──────────────────────────────────────────────────────────────────

/** Fraction of stored resources attacker claims on victory (0.0–1.0). */
export const PILLAGE_RATE = 0.3;

// ── Orbital Hazard ───────────────────────────────────────────────────────────

/** Defense reduction when ORBITAL_TILE_HAZARD is active on the target plot. */
export const ORBITAL_HAZARD_DEFENSE_PENALTY = 0.2;

// ── AI Faction Presets ───────────────────────────────────────────────────────
// These are fed into BattleInput.commanderBonus when AI attacks.

export const AI_FACTION_PRESETS: Record<string, { attackModifier: number; defenseModifier: number }> = {
  "NEXUS-7":  { attackModifier: 1.2, defenseModifier: 1.0 }, // expansionist
  "KRONOS":   { attackModifier: 0.9, defenseModifier: 1.3 }, // defensive
  "VANGUARD": { attackModifier: 1.3, defenseModifier: 0.9 }, // raider
  "SPECTRE":  { attackModifier: 1.0, defenseModifier: 1.0 }, // economic
};
