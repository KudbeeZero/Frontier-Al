/**
 * shared/economy-config.ts
 *
 * Central source of truth for FRONTIER (FRNTR) land emission rates.
 *
 * ⚠ TESTING PHASE NOTE:
 *   LAND_DAILY_FRNTR_RATE_TEST = 50 FRNTR/day is intentionally elevated
 *   for the current testing / staging / mainnet-test rollout.
 *   It is NOT the intended live production rate.
 *
 * To switch to production rates:
 *   Set ECONOMY_MODE=production in the server environment.
 *   Then configure LAND_DAILY_FRNTR_RATE_PROD to the final live value.
 */

/** Base FRNTR/day per owned parcel during testing phase. */
export const LAND_DAILY_FRNTR_RATE_TEST = 50;

/** Base FRNTR/day per owned parcel for live production. Placeholder — finalize before launch. */
export const LAND_DAILY_FRNTR_RATE_PROD = 1;

/**
 * Active economy mode.
 *
 * - Server: reads process.env.ECONOMY_MODE ("production" | anything else → "testing")
 * - Client: always "testing" (safe fallback; mode display comes from API response)
 */
export const ECONOMY_MODE: "testing" | "production" =
  typeof process !== "undefined" && process?.env?.ECONOMY_MODE === "production"
    ? "production"
    : "testing";

/**
 * Currently active base emission rate (FRNTR/day per parcel, before facility bonuses).
 * Resolves to LAND_DAILY_FRNTR_RATE_TEST unless ECONOMY_MODE=production is set.
 */
export const LAND_DAILY_FRNTR_RATE: number =
  ECONOMY_MODE === "production" ? LAND_DAILY_FRNTR_RATE_PROD : LAND_DAILY_FRNTR_RATE_TEST;

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
