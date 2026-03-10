/**
 * server/services/redis.ts
 *
 * Upstash Redis client for FRONTIER.
 * Used for:
 *   - World event persistence (survives server restarts)
 *   - Battle replay log storage (24-hour TTL)
 *
 * All exports fail silently if UPSTASH_REDIS_REST_URL is not set.
 * The game never depends on Redis being available — it is an enhancement layer only.
 */

import { Redis } from "@upstash/redis";

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
