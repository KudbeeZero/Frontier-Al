import { randomUUID } from "crypto";
import type { WorldEvent, WorldEventType, WorldEventFilters } from "@shared/worldEvents";

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

export function seedDemoWorldEvents(): void {
  if (store.length >= 5) return;
  const now = Date.now();
  const h = 60 * 60 * 1000;
  const demos: Omit<WorldEvent, "id">[] = [
    { type: "land_claimed",      timestamp: now - h * 3,    lat: 23.5,  lng: -45.2, plotId: 4500,  playerId: "demo-1", metadata: { playerName: "NEXUS-7" } },
    { type: "battle_started",    timestamp: now - h * 2.5,  lat: -12.3, lng: 78.9,  severity: "high",   attackerPlotId: 5000, defenderPlotId: 5100, metadata: { attacker: "SPECTRE", defender: "NEXUS-7" } },
    { type: "battle_resolved",   timestamp: now - h * 2.4,  lat: -12.3, lng: 78.9,  plotId: 5100,  severity: "high",   metadata: { outcome: "attacker_wins", attacker: "SPECTRE" } },
    { type: "land_claimed",      timestamp: now - h * 2,    lat: 45.8,  lng: 12.5,  plotId: 8200,  playerId: "demo-2", metadata: { playerName: "KRONOS" } },
    { type: "scan_ping",         timestamp: now - h * 1.5,  lat: 45.0,  lng: 12.0,  playerId: "demo-1", metadata: { radius: 20 } },
    { type: "faction_movement",  timestamp: now - h * 1,    lat: 50.0,  lng: -20.0, factionId: "KRONOS",  metadata: { fromLat: 48.0, fromLng: -22.0 } },
    { type: "jammer_zone",       timestamp: now - h * 0.5,  endTimestamp: now + h,   lat: -5.0,  lng: -60.0, factionId: "SPECTRE",  severity: "medium", metadata: { radius: 15 } },
    { type: "battle_started",    timestamp: now - 20 * 60000, lat: -33.8, lng: 151.2, severity: "critical", attackerPlotId: 12000, defenderPlotId: 12100, metadata: { attacker: "VANGUARD", defender: "SPECTRE" } },
    { type: "battle_resolved",   timestamp: now - 10 * 60000, lat: -33.8, lng: 151.2, plotId: 12100, severity: "critical", metadata: { outcome: "defender_wins" } },
    { type: "land_claimed",      timestamp: now - 5 * 60000,  lat: 60.0,  lng: 100.0, plotId: 15000, playerId: "demo-3", metadata: { playerName: "VANGUARD" } },
    { type: "resource_pulse",    timestamp: now - 2 * 60000,  lat: 35.0,  lng: 55.0,  plotId: 9000,  metadata: { iron: 15, fuel: 8, crystal: 2 } },
  ];
  demos.forEach(e => appendWorldEvent(e));
}
