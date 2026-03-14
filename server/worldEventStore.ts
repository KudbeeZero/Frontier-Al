import { randomUUID } from "crypto";
import type { WorldEvent, WorldEventFilters } from "@shared/worldEvents";
import { redisAppendWorldEvent, redisGetWorldEvents } from "./services/redis";

const MAX_EVENTS = 5000;
// In-memory store remains as the primary/fallback layer.
// Redis is written to in parallel for persistence across restarts.
const store: WorldEvent[] = [];

export function appendWorldEvent(
  event: Omit<WorldEvent, "id"> & { id?: string }
): WorldEvent {
  const full: WorldEvent = { ...event, id: event.id ?? randomUUID() };
  store.push(full);
  if (store.length > MAX_EVENTS) store.splice(0, store.length - MAX_EVENTS);
  // Fire-and-forget Redis write — never blocks game logic
  redisAppendWorldEvent(full as unknown as { id: string; timestamp: number; [key: string]: unknown }).catch(() => {});
  return full;
}

export function listWorldEvents(filters: WorldEventFilters = {}): WorldEvent[] {
  let result = [...store];
  if (filters.start !== undefined) result = result.filter(e => e.timestamp >= filters.start!);
  if (filters.end   !== undefined) result = result.filter(e => e.timestamp <= filters.end!);
  if (filters.types && filters.types.length > 0) {
    result = result.filter(e => filters.types!.includes(e.type));
  }
  result.sort((a, b) => b.timestamp - a.timestamp);
  if (filters.limit) result = result.slice(0, filters.limit);
  return result;
}

export function getRecentWorldEvents(ms = 15 * 60 * 1000): WorldEvent[] {
  return listWorldEvents({ start: Date.now() - ms, limit: 200 });
}

/**
 * Called once at server startup to hydrate the in-memory store from Redis.
 * This recovers world events that were written before the last restart.
 * Safe to call even if Redis is unavailable — returns immediately.
 */
export async function hydrateWorldEventsFromRedis(): Promise<void> {
  try {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const events = await redisGetWorldEvents(since);
    for (const e of events as WorldEvent[]) {
      if (e && e.id && !store.find((s) => s.id === e.id)) {
        store.push(e);
      }
    }
    store.sort((a, b) => a.timestamp - b.timestamp);
    if (store.length > MAX_EVENTS) store.splice(0, store.length - MAX_EVENTS);
    if (events.length > 0) {
      console.log(`[worldEventStore] Hydrated ${events.length} events from Redis`);
    }
  } catch {
    // Non-fatal — in-memory store starts empty if Redis unavailable
  }
}
