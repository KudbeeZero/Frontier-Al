import { randomUUID } from "crypto";
import type { WorldEvent, WorldEventFilters } from "@shared/worldEvents";

const MAX_EVENTS = 5000;
const store: WorldEvent[] = [];

export function appendWorldEvent(event: Omit<WorldEvent, "id"> & { id?: string }): WorldEvent {
  const full: WorldEvent = { ...event, id: event.id ?? randomUUID() };
  store.push(full);
  if (store.length > MAX_EVENTS) store.splice(0, store.length - MAX_EVENTS);
  return full;
}

export function listWorldEvents(filters: WorldEventFilters = {}): WorldEvent[] {
  let result = [...store];
  if (filters.start !== undefined) result = result.filter(e => e.timestamp >= filters.start!);
  if (filters.end !== undefined) result = result.filter(e => e.timestamp <= filters.end!);
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

