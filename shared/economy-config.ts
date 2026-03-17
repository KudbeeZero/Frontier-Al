/**
 * shared/economy-config.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FRONTIER-AL — Central Economy Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Single source of truth for all gameplay pricing and testing/production
 * economy values.
 *
 * ⚠ TESTING PHASE:
 *   All TEST values are intentionally low to allow partners to test core loops
 *   without wallet friction. Set ECONOMY_MODE=production to switch to live rates.
 *
 * Currency used per action:
 *   ALGO — unavoidable network transaction fees only (land purchase NFT mint).
 *          In testing mode, land prices are reduced to minimum viable amounts.
 *   FRNTR — primary in-game currency for all gameplay purchases.
 */

// ─── Economy Mode ─────────────────────────────────────────────────────────────

/**
 * Active economy mode.
 * - Server: reads process.env.ECONOMY_MODE ("production" | anything else → "testing")
 * - Client: always "testing" (safe fallback; mode display comes from API response)
 */
export const ECONOMY_MODE: "testing" | "production" =
  typeof process !== "undefined" && process?.env?.ECONOMY_MODE === "production"
    ? "production"
    : "testing";

// ─── Land Emission Rates (FRNTR / day per parcel) ────────────────────────────

/** Base FRNTR/day per owned parcel during testing phase. */
export const LAND_DAILY_FRNTR_RATE_TEST = 50;

/** Base FRNTR/day per owned parcel for live production. */
export const LAND_DAILY_FRNTR_RATE_PROD = 1;

/**
 * Currently active base emission rate.
 * Resolves to LAND_DAILY_FRNTR_RATE_TEST unless ECONOMY_MODE=production.
 */
export const LAND_DAILY_FRNTR_RATE: number =
  ECONOMY_MODE === "production" ? LAND_DAILY_FRNTR_RATE_PROD : LAND_DAILY_FRNTR_RATE_TEST;

// ─── Land Purchase Prices (ALGO) ─────────────────────────────────────────────
// ALGO is required for on-chain plot NFT minting — this is an unavoidable
// network cost. Testing prices are set to the absolute minimum viable amount.

/** Biome land purchase prices in ALGO — TESTING MODE (minimum viable). */
export const LAND_PURCHASE_ALGO_TEST: Record<string, number> = {
  forest:   0.1,
  plains:   0.1,
  mountain: 0.1,
  desert:   0.1,
  water:    0.1,
  tundra:   0.1,
  volcanic: 0.1,
  swamp:    0.1,
};

/** Biome land purchase prices in ALGO — PRODUCTION MODE. */
export const LAND_PURCHASE_ALGO_PROD: Record<string, number> = {
  forest:   0.5,
  plains:   0.3,
  mountain: 0.8,
  desert:   0.2,
  water:    1.5,
  tundra:   0.4,
  volcanic: 1.0,
  swamp:    0.3,
};

/** Active land purchase prices in ALGO. */
export const LAND_PURCHASE_ALGO_ACTIVE: Record<string, number> =
  ECONOMY_MODE === "production" ? LAND_PURCHASE_ALGO_PROD : LAND_PURCHASE_ALGO_TEST;

// ─── Commander Mint Prices ────────────────────────────────────────────────────
// Primary currency: FRNTR (in-game). No ALGO game-level charge for commanders.
// The minimal Algorand network fee (~0.001 ALGO) is the only on-chain cost
// and is handled automatically by the wallet; it is NOT a game-level charge.

/** Commander mint cost in FRNTR — TESTING MODE (affordable for partner testing). */
export const COMMANDER_MINT_FRNTR_TEST: Record<string, number> = {
  sentinel: 10,
  phantom:  25,
  reaper:   50,
};

/** Commander mint cost in FRNTR — PRODUCTION MODE. */
export const COMMANDER_MINT_FRNTR_PROD: Record<string, number> = {
  sentinel: 50,
  phantom:  150,
  reaper:   400,
};

/** Active commander mint cost in FRNTR. */
export const COMMANDER_MINT_FRNTR_ACTIVE: Record<string, number> =
  ECONOMY_MODE === "production" ? COMMANDER_MINT_FRNTR_PROD : COMMANDER_MINT_FRNTR_TEST;

/**
 * Commander ALGO network fee (unavoidable — covers NFT mint transaction fee).
 * This is intentionally tiny and covers only the Algorand network cost.
 * It is NOT a game-level price. Currency label: ALGO.
 */
export const COMMANDER_ALGO_NETWORK_FEE = 0.001;

// ─── Facility Build Costs (FRNTR) ─────────────────────────────────────────────

export interface FacilityCostConfig {
  frntr: number;
}

/** Facility costs in FRNTR — TESTING MODE. */
export const FACILITY_COSTS_TEST: Record<string, FacilityCostConfig> = {
  electricity:       { frntr: 5 },
  blockchain_node_1: { frntr: 15 },
  blockchain_node_2: { frntr: 30 },
  blockchain_node_3: { frntr: 50 },
  data_centre_1:     { frntr: 15 },
  data_centre_2:     { frntr: 30 },
  data_centre_3:     { frntr: 50 },
  ai_lab_1:          { frntr: 15 },
  ai_lab_2:          { frntr: 30 },
  ai_lab_3:          { frntr: 50 },
};

/** Facility costs in FRNTR — PRODUCTION MODE (matches schema.ts). */
export const FACILITY_COSTS_PROD: Record<string, FacilityCostConfig> = {
  electricity:       { frntr: 30 },
  blockchain_node_1: { frntr: 120 },
  blockchain_node_2: { frntr: 270 },
  blockchain_node_3: { frntr: 480 },
  data_centre_1:     { frntr: 120 },
  data_centre_2:     { frntr: 270 },
  data_centre_3:     { frntr: 480 },
  ai_lab_1:          { frntr: 120 },
  ai_lab_2:          { frntr: 270 },
  ai_lab_3:          { frntr: 480 },
};

/** Active facility costs. */
export const FACILITY_COSTS_ACTIVE: Record<string, FacilityCostConfig> =
  ECONOMY_MODE === "production" ? FACILITY_COSTS_PROD : FACILITY_COSTS_TEST;

// ─── Special Attack Costs (FRNTR) ─────────────────────────────────────────────

/** Special attack costs in FRNTR — TESTING MODE. */
export const SPECIAL_ATTACK_COSTS_TEST: Record<string, number> = {
  orbital_strike: 5,
  emp_blast:      3,
  siege_barrage:  8,
  sabotage:       2,
};

/** Special attack costs in FRNTR — PRODUCTION MODE (matches schema.ts). */
export const SPECIAL_ATTACK_COSTS_PROD: Record<string, number> = {
  orbital_strike: 25,
  emp_blast:      15,
  siege_barrage:  40,
  sabotage:       10,
};

/** Active special attack costs in FRNTR. */
export const SPECIAL_ATTACK_COSTS_ACTIVE: Record<string, number> =
  ECONOMY_MODE === "production" ? SPECIAL_ATTACK_COSTS_PROD : SPECIAL_ATTACK_COSTS_TEST;

// ─── Drone & Satellite Costs (FRNTR) ─────────────────────────────────────────

export const DRONE_COST_FRNTR_TEST = 2;
export const DRONE_COST_FRNTR_PROD = 20;
export const DRONE_COST_FRNTR_ACTIVE =
  ECONOMY_MODE === "production" ? DRONE_COST_FRNTR_PROD : DRONE_COST_FRNTR_TEST;

export const SATELLITE_COST_FRNTR_TEST = 5;
export const SATELLITE_COST_FRNTR_PROD = 50;
export const SATELLITE_COST_FRNTR_ACTIVE =
  ECONOMY_MODE === "production" ? SATELLITE_COST_FRNTR_PROD : SATELLITE_COST_FRNTR_TEST;

// ─── Emission Safety Checks ───────────────────────────────────────────────────

/**
 * Parcel counts used for projected emission safety checks.
 * Used by the admin safety log and the economics API endpoint.
 */
export const EMISSION_CHECK_PARCEL_COUNTS = [1, 10, 100, 250] as const;

/**
 * Returns projected daily FRNTR emissions for a given parcel count.
 * Uses base rate only — does not include per-parcel facility bonuses.
 */
export function projectedDailyEmissions(parcelCount: number): number {
  return parcelCount * LAND_DAILY_FRNTR_RATE;
}

// ─── Testing Economy Summary ──────────────────────────────────────────────────

/**
 * Human-readable summary of active testing economy config.
 * Used by admin/economics endpoints and UI display.
 */
export const TESTING_ECONOMY_SUMMARY = {
  mode: ECONOMY_MODE,
  landEmissionRatePerDay: LAND_DAILY_FRNTR_RATE,
  landPurchaseAlgo: LAND_PURCHASE_ALGO_ACTIVE,
  commanderMintFrntr: COMMANDER_MINT_FRNTR_ACTIVE,
  commanderAlgoNetworkFeeOnly: COMMANDER_ALGO_NETWORK_FEE,
  primaryCurrency: "FRNTR",
  unavoidableAlgoCost: "network fee only (~0.001 ALGO per transaction)",
  note: ECONOMY_MODE === "testing"
    ? "TESTING MODE: All prices reduced for partner testing. FRNTR is the primary gameplay currency."
    : "PRODUCTION MODE: Live tokenomics active.",
} as const;
