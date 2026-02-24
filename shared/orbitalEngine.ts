/**
 * shared/orbitalEngine.ts
 *
 * Deterministic cosmetic orbital event generator.
 *
 * All clients derive the same cosmetic events from (epochIndex + WORLD_SEED)
 * using a seeded LCG (Linear Congruential Generator), so no server round-trip
 * is needed for purely visual effects.
 *
 * Server-authoritative impact events are persisted separately and fetched
 * via /api/orbital/active.
 */

import type { OrbitalEvent, OrbitalEventType } from "./schema";
import {
  ORBITAL_EPOCH_MS,
  ORBITAL_WORLD_SEED,
  ORBITAL_MAX_COSMETIC_PER_EPOCH,
} from "./schema";

// ── Seeded LCG ──────────────────────────────────────────────────────────────
// Park-Miller LCG — fast, deterministic, zero-dependency.
// Parameters from Numerical Recipes.

function lcgNext(state: number): number {
  // 32-bit LCG: multiplier 1664525, addend 1013904223 (Numerical Recipes)
  return ((state * 1664525 + 1013904223) >>> 0);
}

/** Returns a pseudo-random float [0, 1) from the given state, plus new state. */
function lcgFloat(state: number): [number, number] {
  const next = lcgNext(state);
  return [next / 0x100000000, next];
}

/** Returns a pseudo-random int [min, max) from the given state, plus new state. */
function lcgInt(state: number, min: number, max: number): [number, number] {
  const [f, next] = lcgFloat(state);
  return [Math.floor(f * (max - min)) + min, next];
}

// ── Cosmetic event types (no gameplay effect) ────────────────────────────────
const COSMETIC_TYPES: OrbitalEventType[] = [
  "METEOR_SHOWER",
  "SINGLE_BOLIDE",
  "COMET_PASS",
  "ORBITAL_DEBRIS",
  "ATMOSPHERIC_BURST",
];

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the epoch index for a given Unix-ms timestamp.
 * All clients compute the same value for the same wall-clock second.
 */
export function epochIndexForTime(nowMs: number): number {
  return Math.floor(nowMs / ORBITAL_EPOCH_MS);
}

/**
 * Build a deterministic seed for a given epoch.
 * epochIndex already bakes in the timestamp; XOR with WORLD_SEED for uniqueness.
 */
export function seedForEpoch(epochIndex: number): number {
  return (epochIndex ^ ORBITAL_WORLD_SEED) >>> 0;
}

/**
 * Generate the cosmetic orbital events for a given epoch.
 *
 * All clients calling this with the same epochIndex will receive identical
 * results — no network traffic required for visual-only effects.
 *
 * @param epochIndex - from epochIndexForTime(Date.now())
 * @returns Array of cosmetic OrbitalEvent objects, ready to render.
 */
export function generateCosmeticEvents(epochIndex: number): OrbitalEvent[] {
  let state = seedForEpoch(epochIndex);

  // Determine how many events this epoch (1 to MAX)
  let count: number;
  [count, state] = lcgInt(state, 1, ORBITAL_MAX_COSMETIC_PER_EPOCH + 1);

  const epochStart = epochIndex * ORBITAL_EPOCH_MS;
  const events: OrbitalEvent[] = [];

  for (let i = 0; i < count; i++) {
    // Pick event type
    let typeIdx: number;
    [typeIdx, state] = lcgInt(state, 0, COSMETIC_TYPES.length);
    const type = COSMETIC_TYPES[typeIdx];

    // Intensity 0.3–1.0
    let intensityRaw: number;
    [intensityRaw, state] = lcgFloat(state);
    const intensity = 0.3 + intensityRaw * 0.7;

    // Trajectory (random lat/lng across globe)
    let startLatRaw: number, startLngRaw: number, endLatRaw: number, endLngRaw: number;
    [startLatRaw, state] = lcgFloat(state);
    [startLngRaw, state] = lcgFloat(state);
    [endLatRaw,   state] = lcgFloat(state);
    [endLngRaw,   state] = lcgFloat(state);

    const startLat = startLatRaw * 180 - 90;
    const startLng = startLngRaw * 360 - 180;
    const endLat   = endLatRaw   * 180 - 90;
    const endLng   = endLngRaw   * 360 - 180;

    // Offset start within the epoch window (so events don't all begin at t=0)
    let offsetRaw: number;
    [offsetRaw, state] = lcgFloat(state);
    const startOffset = offsetRaw * (ORBITAL_EPOCH_MS * 0.8); // within first 80% of epoch

    // Duration: 4–18 seconds (visual trail lifespan)
    let durationRaw: number;
    [durationRaw, state] = lcgFloat(state);
    const durationMs = (4 + durationRaw * 14) * 1000;

    // Unique ID derived from epoch + index
    const id = `cosmetic-${epochIndex}-${i}`;

    events.push({
      id,
      type,
      cosmetic: true,
      startAt:  epochStart + startOffset,
      endAt:    epochStart + startOffset + durationMs,
      seed:     (state >>> 0), // snapshot of RNG state for this event
      intensity,
      trajectory: { startLat, startLng, endLat, endLng },
    });
  }

  console.log(
    `[ORBITAL-DEBUG] generateCosmeticEvents | epoch: ${epochIndex} | count: ${count} | types: [${events.map(e => e.type).join(",")}]`
  );

  return events;
}

/**
 * Return any cosmetic events that are "active" at the given timestamp.
 * Includes events from the current and previous epoch to handle boundary overlap.
 */
export function getActiveCosmeticEvents(nowMs: number): OrbitalEvent[] {
  const epochIdx = epochIndexForTime(nowMs);
  const current  = generateCosmeticEvents(epochIdx);
  const prev     = generateCosmeticEvents(epochIdx - 1); // events that started last epoch

  return [...prev, ...current].filter(
    (e) => e.startAt <= nowMs && e.endAt >= nowMs
  );
}

/**
 * Return the number of milliseconds until the next epoch boundary.
 * Useful for scheduling re-generation on the client.
 */
export function msUntilNextEpoch(nowMs: number): number {
  const epochIdx = epochIndexForTime(nowMs);
  return (epochIdx + 1) * ORBITAL_EPOCH_MS - nowMs;
}
