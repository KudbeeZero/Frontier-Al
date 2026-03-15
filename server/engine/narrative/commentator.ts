/**
 * server/engine/narrative/commentator.ts
 *
 * Live narrative commentary engine for Frontier-AL streaming mode.
 *
 * Converts raw game events into human-readable, broadcast-friendly strings
 * displayed in the stream overlay's live ticker and saved to game_events.narrative_text.
 *
 * Called at event creation time from routes.ts / storage/db.ts.
 */

import type { BiomeType } from "@shared/schema";

export type NarrativeEventType =
  | "battle_started"
  | "battle_won"
  | "battle_lost"
  | "land_purchased"
  | "land_subdivided"
  | "sub_parcel_purchased"
  | "faction_expansion"
  | "faction_suppressed"
  | "orbital_impact"
  | "orbital_resource_burst"
  | "season_start"
  | "season_warning"
  | "season_end"
  | "player_milestone"
  | "ai_reconquest";

export interface NarrativeContext {
  type: NarrativeEventType;
  actorName?: string;       // who did the action
  targetName?: string;      // who / what was acted upon
  plotId?: number;
  biome?: BiomeType;
  territoriesHeld?: number;  // current territory count of actor
  worldPercent?: number;     // actor's % of total world
  factionName?: string;
  resourceAmount?: number;
  seasonName?: string;
  remainingLabel?: string;   // "24h", "6h", "1h"
}

/**
 * Generate a human-readable narrative string for a game event.
 * Returns null if the event type has no narrative configured.
 */
export function buildNarrative(ctx: NarrativeContext): string | null {
  const actor  = ctx.actorName ?? "A colonist";
  const target = ctx.targetName ?? "an opponent";
  const biome  = ctx.biome ? biomeLabel(ctx.biome) : "territory";
  const pct    = ctx.worldPercent !== undefined ? ` (${ctx.worldPercent.toFixed(1)}% of the world)` : "";
  const terr   = ctx.territoriesHeld !== undefined ? ` — now controls ${ctx.territoriesHeld} plots${pct}` : "";

  switch (ctx.type) {
    case "battle_started":
      return `⚔️ ${actor} launches an assault on ${target}'s ${biome} plot #${ctx.plotId ?? "?"}!`;

    case "battle_won":
      return `🏆 ${actor} captures ${target}'s ${biome} plot #${ctx.plotId ?? "?"}${terr}`;

    case "battle_lost":
      return `💀 ${actor} repelled by ${target} defending ${biome} plot #${ctx.plotId ?? "?"}`;

    case "land_purchased":
      return `🌍 ${actor} claims unclaimed ${biome} territory at plot #${ctx.plotId ?? "?"}${terr}`;

    case "land_subdivided":
      return `🏗️ ${actor} subdivides ${biome} plot #${ctx.plotId ?? "?"} into 9 sub-parcels — rare economic play!`;

    case "sub_parcel_purchased":
      return `📦 ${actor} acquires a sub-parcel in plot #${ctx.plotId ?? "?"} (${biome})`;

    case "faction_expansion":
      return `🤖 ${ctx.factionName ?? "An AI faction"} expands aggressively${terr}`;

    case "faction_suppressed":
      return `✊ ${actor} pushes back ${ctx.factionName ?? "AI forces"} — faction influence contained`;

    case "orbital_impact":
      return `🌋 Orbital impact detected at plot #${ctx.plotId ?? "?"}! ${biome} sector disrupted`;

    case "orbital_resource_burst":
      return `⚡ Resource surge at plot #${ctx.plotId ?? "?"}! ${biome} yields spiking for 10 minutes`;

    case "season_start":
      return `🚀 ${ctx.seasonName ?? "A new season"} has begun — the world expands! Claim your territory.`;

    case "season_warning":
      return `⚠️ ${ctx.seasonName ?? "Current season"} ends in ${ctx.remainingLabel ?? "soon"}! Final push underway.`;

    case "season_end":
      return `🏅 ${ctx.seasonName ?? "Season"} concluded! ${actor} emerges as the dominant force${terr}`;

    case "player_milestone":
      return `📈 ${actor} crosses ${ctx.territoriesHeld} plots${pct} — a major colonization milestone!`;

    case "ai_reconquest":
      return `🔄 ${ctx.factionName ?? "AI faction"} reconquest underway — reclaiming captured territories`;

    default:
      return null;
  }
}

function biomeLabel(biome: BiomeType): string {
  const labels: Record<BiomeType, string> = {
    forest:   "Storm Belt",
    desert:   "Canyon Zone",
    mountain: "AI Nexus",
    plains:   "Launch District",
    water:    "Aquatic Rift",
    tundra:   "Ice Sector",
    volcanic: "Volcanic Core",
    swamp:    "Arena District",
  };
  return labels[biome] ?? biome;
}

/**
 * Check if the player just crossed a notable milestone (50, 100, 250, 500, 1000 plots)
 * and return the milestone count, or null if no milestone was crossed.
 */
export function detectMilestone(prevCount: number, newCount: number): number | null {
  const milestones = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  for (const m of milestones) {
    if (prevCount < m && newCount >= m) return m;
  }
  return null;
}
