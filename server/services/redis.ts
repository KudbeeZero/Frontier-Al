/**
 * server/services/redis.ts
 *
 * Upstash Redis client for FRONTIER.
 * Used for:
 *   - World event persistence (survives server restarts)
 *   - Battle replay log storage (24-hour TTL)
 *   - Per-parcel plot animations (optional TTL)
 *
 * All exports fail silently if UPSTASH_REDIS_REST_URL is not set.
 * The game never depends on Redis being available — it is an enhancement layer only.
 */

import { Redis } from "@upstash/redis";
import type { ParcelAnimation } from "../../shared/schema";

const BATTLE_REPLAY_TTL_S  = 86_400;
const WORLD_EVENT_TTL_S    = 86_400;
const WORLD_EVENT_ZSET_KEY = "frontier:world_events";
const MAX_ZSET_MEMBERS     = 2000;

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    _redis = new Redis({ url, token });
    return _redis;
  } catch {
    return null;
  }
}

// ── Battle Replay ────────────────────────────────────────────────────────────

export interface BattleReplayRecord {
  battleId:      string;
  attackerName:  string;
  defenderName:  string;
  attackerPower: number;
  defenderPower: number;
  randFactor:    number;
  outcome:       "attacker_wins" | "defender_wins";
  plotId:        number;
  biome:         string;
  pillagedIron:  number;
  pillagedFuel:  number;
  pillagedCrystal: number;
  resolvedAt:    number;
  log: Array<{ phase: string; message: string }>;
}

export async function saveBattleReplay(record: BattleReplayRecord): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(
      `frontier:battle:replay:${record.battleId}`,
      JSON.stringify(record),
      { ex: BATTLE_REPLAY_TTL_S }
    );
  } catch {
    // Non-fatal — game continues without replay storage
  }
}

export async function getBattleReplay(battleId: string): Promise<BattleReplayRecord | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get<string>(`frontier:battle:replay:${battleId}`);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw as BattleReplayRecord;
  } catch {
    return null;
  }
}

// ── World Event Persistence ──────────────────────────────────────────────────

export async function redisAppendWorldEvent(event: {
  id: string;
  timestamp: number;
  [key: string]: unknown;
}): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.zadd(WORLD_EVENT_ZSET_KEY, {
      score: event.timestamp,
      member: JSON.stringify(event),
    });
    await r.zremrangebyrank(WORLD_EVENT_ZSET_KEY, 0, -(MAX_ZSET_MEMBERS + 1));
    await r.expire(WORLD_EVENT_ZSET_KEY, WORLD_EVENT_TTL_S);
  } catch {
    // Non-fatal
  }
}

export async function redisGetWorldEvents(
  startTs: number,
  endTs: number = Date.now()
): Promise<unknown[]> {
  const r = getRedis();
  if (!r) return [];
  try {
    const members = await r.zrange(
      WORLD_EVENT_ZSET_KEY,
      startTs,
      endTs,
      { byScore: true }
    );
    return (members as string[]).map((m) => {
      try { return JSON.parse(m); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Sub-Parcel World Events ───────────────────────────────────────────────────

export interface SubParcelWorldEvent {
  type: "sub_parcel_purchased" | "sub_parcel_upgraded";
  plotId: number;
  subIndex: number;
  biome: string;
  playerId: string;
  improvementType?: string;
  level?: number;
  price?: number;
}

/**
 * Records a sub-parcel purchase or upgrade event in the Upstash world event
 * stream so it appears in the live world activity feed.
 * Non-fatal — silently ignored if Redis is unavailable.
 */
export async function recordSubParcelWorldEvent(event: SubParcelWorldEvent): Promise<void> {
  await redisAppendWorldEvent({
    id:        `sp-${event.plotId}-${event.subIndex}-${Date.now()}`,
    timestamp: Date.now(),
    ...event,
  });
}

// ── Parcel Animations ─────────────────────────────────────────────────────────

function parcelAnimKey(plotId: number): string {
  return `frontier:parcel:anim:${plotId}`;
}

export async function setParcelAnimation(
  plotId: number,
  anim: ParcelAnimation,
  ttlSeconds?: number
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const opts = ttlSeconds ? { ex: ttlSeconds } : undefined;
    await r.set(parcelAnimKey(plotId), JSON.stringify(anim), opts);
  } catch {
    // Non-fatal
  }
}

export async function getParcelAnimation(plotId: number): Promise<ParcelAnimation | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get<string>(parcelAnimKey(plotId));
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw as ParcelAnimation;
  } catch {
    return null;
  }
}

export async function clearParcelAnimation(plotId: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(parcelAnimKey(plotId));
  } catch {
    // Non-fatal
  }
}

export async function getParcelAnimations(
  plotIds: number[]
): Promise<Record<number, ParcelAnimation>> {
  const r = getRedis();
  if (!r || plotIds.length === 0) return {};
  try {
    const keys = plotIds.map(parcelAnimKey);
    const values = await r.mget<string[]>(...keys);
    const result: Record<number, ParcelAnimation> = {};
    for (let i = 0; i < plotIds.length; i++) {
      const raw = values[i];
      if (!raw) continue;
      try {
        result[plotIds[i]] = typeof raw === "string" ? JSON.parse(raw) : raw as ParcelAnimation;
      } catch {
        // skip malformed entry
      }
    }
    return result;
  } catch {
    return {};
  }
}
