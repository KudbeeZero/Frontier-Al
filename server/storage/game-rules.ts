import { randomUUID } from "crypto";
import type {
  LandParcel,
  Player,
  Battle,
  GameEvent,
  BiomeType,
  Improvement,
  CommanderAvatar,
  SpecialAttackRecord,
  ReconDrone,
  OrbitalSatellite,
  LeaderboardEntry,
} from "@shared/schema";
import { parcels as parcelsTable, players as playersTable, battles as battlesTable, gameEvents as gameEventsTable } from "../db-schema";

export type ParcelRow  = typeof parcelsTable.$inferSelect;
export type PlayerRow  = typeof playersTable.$inferSelect;
export type BattleRow  = typeof battlesTable.$inferSelect;
export type EventRow   = typeof gameEventsTable.$inferSelect;

// ── Micro-FRONTIER helpers ───────────────────────────────────────────────────

export const MICRO = 1_000_000;
export function toMicroFRNTR(frntr: number): number { return Math.round(frntr * MICRO); }
export function fromMicroFRNTR(micro: number): number { return Math.floor(micro / MICRO * 100) / 100; }

// ── Biome assignment ─────────────────────────────────────────────────────────

export function biomeFromLatitude(lat: number, plotId: number): BiomeType {
  const absLat = Math.abs(lat);
  const noise = ((plotId * 7919) % 100) / 100;

  if (absLat > 75) return noise > 0.3 ? "tundra" : "mountain";
  if (absLat > 60) return noise > 0.6 ? "tundra" : noise > 0.3 ? "forest" : "mountain";
  if (absLat > 40) return noise > 0.5 ? "forest" : noise > 0.2 ? "plains" : "mountain";
  if (absLat > 20) {
    if (noise > 0.7) return "volcanic";
    if (noise > 0.4) return "plains";
    if (noise > 0.2) return "forest";
    return "swamp";
  }
  if (noise > 0.6) return "desert";
  if (noise > 0.3) return "plains";
  if (noise > 0.15) return "swamp";
  return "water";
}

// ── Coordinate helpers ───────────────────────────────────────────────────────

/** Convert lat/lng (degrees) to unit-sphere cartesian coords. */
export function latLngToXYZ(lat: number, lng: number): { x: number; y: number; z: number } {
  const φ = (lat * Math.PI) / 180;
  const λ = (lng * Math.PI) / 180;
  return {
    x: Math.cos(φ) * Math.cos(λ),
    y: Math.cos(φ) * Math.sin(λ),
    z: Math.sin(φ),
  };
}

// ── Row-to-domain-object converters ─────────────────────────────────────────

export function rowToParcel(row: ParcelRow): LandParcel {
  return {
    id:                  row.id,
    plotId:              row.plotId,
    lat:                 row.lat,
    lng:                 row.lng,
    biome:               row.biome as BiomeType,
    richness:            row.richness,
    ownerId:             row.ownerId ?? null,
    ownerType:           (row.ownerType ?? null) as "player" | "ai" | null,
    defenseLevel:        row.defenseLevel,
    ironStored:          row.ironStored,
    fuelStored:          row.fuelStored,
    crystalStored:       row.crystalStored,
    storageCapacity:     row.storageCapacity,
    lastMineTs:          Number(row.lastMineTs),
    activeBattleId:      row.activeBattleId ?? null,
    yieldMultiplier:      row.yieldMultiplier,
    improvements:         (row.improvements ?? []) as Improvement[],
    purchasePriceAlgo:   row.purchasePriceAlgo ?? null,
    frontierAccumulated: row.frontierAccumulated,
    lastFrontierClaimTs: Number(row.lastFrontierClaimTs),
    frontierPerDay:      row.frontierPerDay,
    influence:           row.influence,
    influenceRepairRate: row.influenceRepairRate,
    capturedFromFaction: (row as any).capturedFromFaction ?? null,
    capturedAt:          (row as any).capturedAt ? Number((row as any).capturedAt) : null,
    handoverCount:       (row as any).handoverCount ?? 0,
  };
}

export function rowToPlayer(row: PlayerRow, ownedParcelIds: string[]): Player {
  const commanders = (row.commanders ?? []) as CommanderAvatar[];
  return {
    id:                   row.id,
    address:              row.address,
    name:                 row.name,
    iron:                 row.iron,
    fuel:                 row.fuel,
    crystal:              row.crystal,
    frontier:             fromMicroFRNTR(row.frntrBalanceMicro),
    ownedParcels:         ownedParcelIds,
    isAI:                 row.isAi,
    aiBehavior:           (row.aiBehavior ?? undefined) as Player["aiBehavior"],
    totalIronMined:       row.totalIronMined,
    totalFuelMined:       row.totalFuelMined,
    totalCrystalMined:    row.totalCrystalMined,
    totalFrontierEarned:  row.totalFrontierEarned,
    totalFrontierBurned:  row.totalFrontierBurned,
    attacksWon:           row.attacksWon,
    attacksLost:          row.attacksLost,
    territoriesCaptured:  row.territoriesCaptured,
    commanders,
    activeCommanderIndex: row.activeCommanderIndex,
    commander:            commanders[row.activeCommanderIndex] ?? null,
    specialAttacks:       (row.specialAttacks ?? []) as SpecialAttackRecord[],
    drones:               (row.drones ?? []) as ReconDrone[],
    satellites:           (row.satellites ?? []) as OrbitalSatellite[],
    welcomeBonusReceived: row.welcomeBonusReceived,
    moraleDebuffUntil:    row.moraleDebuffUntil ?? 0,
    attackCooldownUntil:  row.attackCooldownUntil ?? 0,
    consecutiveLosses:    row.consecutiveLosses ?? 0,
    testnetProgress:      (row.testnetProgress ?? []) as string[],
  };
}

export function rowToBattle(row: BattleRow): Battle {
  return {
    id:               row.id,
    attackerId:       row.attackerId,
    defenderId:       row.defenderId ?? null,
    targetParcelId:   row.targetParcelId,
    attackerPower:    row.attackerPower,
    defenderPower:    row.defenderPower,
    troopsCommitted:  row.troopsCommitted,
    resourcesBurned:  row.resourcesBurned as { iron: number; fuel: number },
    startTs:          Number(row.startTs),
    resolveTs:        Number(row.resolveTs),
    status:           row.status as "pending" | "resolved",
    outcome:          (row.outcome ?? undefined) as Battle["outcome"],
    randFactor:       row.randFactor ?? undefined,
    crystalBurned:    row.crystalBurned,
    influenceDamage:  row.influenceDamage,
    commanderId:      (row as any).commanderId ?? undefined,
    sourceParcelId:   (row as any).sourceParcelId ?? undefined,
  };
}

export function rowToEvent(row: EventRow): GameEvent {
  return {
    id:          row.id,
    type:        row.type as GameEvent["type"],
    playerId:    row.playerId,
    parcelId:    row.parcelId ?? undefined,
    battleId:    row.battleId ?? undefined,
    description: row.description,
    timestamp:   Number(row.ts),
  };
}

export function computeLeaderboard(playerRows: PlayerRow[], parcelRows: Pick<ParcelRow, "ownerId">[]): LeaderboardEntry[] {
  const countByOwner = new Map<string, number>();
  for (const p of parcelRows) {
    if (p.ownerId) countByOwner.set(p.ownerId, (countByOwner.get(p.ownerId) ?? 0) + 1);
  }
  return playerRows
    .map((r) => ({
      playerId:            r.id,
      name:                r.name,
      address:             r.address,
      territories:         countByOwner.get(r.id) ?? 0,
      totalIronMined:      r.totalIronMined,
      totalFuelMined:      r.totalFuelMined,
      totalCrystalMined:   r.totalCrystalMined,
      totalFrontierEarned: r.totalFrontierEarned,
      attacksWon:          r.attacksWon,
      attacksLost:         r.attacksLost,
      isAI:                r.isAi,
    }))
    .sort((a, b) => b.territories - a.territories || b.totalFrontierEarned - a.totalFrontierEarned);
}
