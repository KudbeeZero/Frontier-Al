export type WorldEventType =
  | "land_claimed"
  | "battle_started"
  | "battle_resolved"
  | "commander_deployed"
  | "scan_ping"
  | "jammer_zone"
  | "faction_movement"
  | "resource_pulse";

export interface WorldEvent {
  id: string;
  type: WorldEventType;
  timestamp: number;
  endTimestamp?: number;
  plotId?: number;
  attackerPlotId?: number;
  defenderPlotId?: number;
  lat: number;
  lng: number;
  altitude?: number;
  factionId?: string;
  playerId?: string;
  severity?: "low" | "medium" | "high" | "critical";
  visibility?: "public" | "faction" | "player";
  metadata: Record<string, unknown>;
}

export interface WorldEventFilters {
  start?: number;
  end?: number;
  types?: WorldEventType[];
  limit?: number;
}
