/**
 * server/engine/season/manager.ts
 *
 * Season lifecycle manager for Frontier-AL.
 *
 * Seasons are persistent meta-layers (~90 days by default). Unlike Zero Colonies'
 * hard-reset rounds, the Frontier-AL world CONTINUES between seasons — ownership,
 * sub-parcels, and improvements carry forward. A season end only:
 *   1. Snapshots the leaderboard
 *   2. Distributes FRONTIER reward tiers to top players
 *   3. Records the winner in the `seasons` table
 *
 * The manager runs a periodic check loop that broadcasts warnings as seasons
 * approach their end time, and triggers settlement when they expire.
 */

import type { IStorage } from "../../storage/interface";
import type { Season } from "@shared/schema";
import { broadcastRaw, markDirty } from "../../wsServer";

const CHECK_INTERVAL_MS  = 60_000;  // check every 60 seconds
const WARN_THRESHOLD_MS  = 60 * 60 * 1000;   // broadcast 1h warning
const WARN_THRESHOLD_6H  = 6 * 60 * 60 * 1000;  // broadcast 6h warning
const WARN_THRESHOLD_24H = 24 * 60 * 60 * 1000; // broadcast 24h warning

/** Reward pool fractions for top-10 season finishers */
const REWARD_TIERS = [0.30, 0.20, 0.12, 0.08, 0.06, 0.05, 0.05, 0.05, 0.05, 0.04];

let _storage: IStorage | null = null;
let _checkTimer: ReturnType<typeof setInterval> | null = null;
/** Tracks which warning thresholds we've already fired for the current season. */
const _warnedThresholds = new Set<string>();

export function initSeasonManager(storage: IStorage): void {
  _storage = storage;

  _checkTimer = setInterval(async () => {
    if (!_storage) return;
    try {
      await _tick();
    } catch (err) {
      console.warn("[season] tick error:", err instanceof Error ? err.message : err);
    }
  }, CHECK_INTERVAL_MS);

  console.log(`[season] Season manager started (check every ${CHECK_INTERVAL_MS / 1000}s)`);
}

export function stopSeasonManager(): void {
  if (_checkTimer) {
    clearInterval(_checkTimer);
    _checkTimer = null;
  }
}

async function _tick(): Promise<void> {
  if (!_storage) return;
  const season = await _storage.getCurrentSeason();
  if (!season) return;

  const now = Date.now();
  const remaining = season.endsAt - now;

  if (remaining <= 0) {
    // Season has expired — settle it
    console.log(`[season] Season "${season.name}" has ended. Settling…`);
    _warnedThresholds.clear();
    const settled = await _storage.settleCurrentSeason();
    if (settled) {
      broadcastRaw({
        type: "season_ended",
        payload: {
          season: settled,
          message: `Season "${settled.name}" has concluded! The leaderboard has been finalised.`,
        },
      });
      markDirty();
    }
    return;
  }

  // Broadcast countdown warnings (fire once per threshold per season)
  for (const [threshold, label] of [
    [WARN_THRESHOLD_24H, "24h"],
    [WARN_THRESHOLD_6H,  "6h"],
    [WARN_THRESHOLD_MS,  "1h"],
  ] as [number, string][]) {
    const key = `${season.id}:${label}`;
    if (remaining <= threshold && !_warnedThresholds.has(key)) {
      _warnedThresholds.add(key);
      broadcastRaw({
        type: "season_warning",
        payload: {
          seasonId:  season.id,
          seasonName: season.name,
          remaining,
          label,
          message:   `⚠️ Season "${season.name}" ends in ${label}! Secure your territories.`,
        },
      });
      console.log(`[season] ${label} warning broadcast for season "${season.name}"`);
    }
  }
}

/**
 * Calculate FRONTIER rewards for a given reward pool and leaderboard.
 * Returns array of { playerId, rewardFrontier } for top-10.
 */
export function computeSeasonRewards(
  rewardPool: number,
  leaderboard: { playerId: string; territories: number }[]
): { playerId: string; rewardFrontier: number }[] {
  return leaderboard.slice(0, REWARD_TIERS.length).map((entry, i) => ({
    playerId:      entry.playerId,
    rewardFrontier: Math.floor(rewardPool * REWARD_TIERS[i]),
  }));
}
