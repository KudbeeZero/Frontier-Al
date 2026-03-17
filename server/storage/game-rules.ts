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
  SubParcel,
} from "@shared/schema";
import {
  SUB_PARCEL_HOLD_HOURS,
  SUB_PARCEL_COUNT,
  SUB_PARCEL_YIELD_FRACTION,
  LAND_PURCHASE_ALGO,
  ARCHETYPE_FACTION_BONUSES,
  MAX_SAME_ARCHETYPE_PER_GRID,
} from "@shared/schema";
import { parcels as parcelsTable, players as playersTable, battles as battlesTable, gameEvents as gameEventsTable, subParcels as subParcelsTable } from "../db-schema";

export type ParcelRow     = typeof parcelsTable.$inferSelect;
export type PlayerRow     = typeof playersTable.$inferSelect;
export type BattleRow     = typeof battlesTable.$inferSelect;
export type EventRow      = typeof gameEventsTable.$inferSelect;
export type SubParcelRow  = typeof subParcelsTable.$inferSelect;

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
    hazardLevel:         (row as any).hazardLevel ?? 0,
    stability:           (row as any).stability ?? 100,
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
    playerFactionId:      (row as any).playerFactionId ?? null,
    factionJoinedAt:      (row as any).factionJoinedAt ? Number((row as any).factionJoinedAt) : null,
    xenoriteVault:        (row as any).xenoriteVault   ?? 0,
    voidShardVault:       (row as any).voidShardVault  ?? 0,
    plasmaCoreVault:      (row as any).plasmaCoreVault ?? 0,
    darkMatterVault:      (row as any).darkMatterVault ?? 0,
    lootBoxes:            [],
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

// ── Sub-Parcel Helpers ───────────────────────────────────────────────────────

export function rowToSubParcel(row: SubParcelRow): SubParcel {
  return {
    id:                    row.id,
    parentPlotId:          row.parentPlotId,
    subIndex:              row.subIndex,
    ownerId:               row.ownerId ?? null,
    ownerType:             (row.ownerType ?? null) as "player" | "ai" | null,
    improvements:          (row.improvements ?? []) as Improvement[],
    resourceYieldFraction: row.resourceYieldFraction,
    purchasePriceFrontier: row.purchasePriceFrontier,
    acquiredAt:            row.acquiredAt ? Number(row.acquiredAt) : null,
    activeBattleId:        row.activeBattleId ?? null,
    archetype:             (row.archetype ?? null) as import("../../shared/schema").SubParcelArchetype | null,
    archetypeLevel:        row.archetypeLevel ?? 0,
    energyAlignment:       (row.energyAlignment ?? null) as import("../../shared/schema").EnergyAlignment | null,
  };
}

// ─── Archetype Assignment Rules ───────────────────────────────────────────────

/**
 * Validates whether a player can assign the given archetype to a sub-parcel.
 * Returns null if allowed, or an error string explaining the rejection.
 *
 * Rules:
 * 1. Player must own the sub-parcel
 * 2. Max MAX_SAME_ARCHETYPE_PER_GRID of the same archetype in the 9-cell grid
 * 3. Fortress archetype level must be 1–3
 * 4. energyAlignment only valid when archetype === "energy"
 */
export function canAssignArchetype(
  subParcel: SubParcel,
  grid: SubParcel[],
  playerId: string,
  archetype: import("../../shared/schema").SubParcelArchetype,
  archetypeLevel: number,
  energyAlignment?: import("../../shared/schema").EnergyAlignment
): string | null {
  if (subParcel.ownerId !== playerId) return "You don't own this sub-parcel";

  const sameCount = grid.filter(
    sp => sp.id !== subParcel.id && sp.archetype === archetype
  ).length;
  if (sameCount >= MAX_SAME_ARCHETYPE_PER_GRID) {
    return `Maximum ${MAX_SAME_ARCHETYPE_PER_GRID} ${archetype} parcels allowed per grid`;
  }

  if (archetype === "fortress" && (archetypeLevel < 1 || archetypeLevel > 3)) {
    return "Fortress level must be 1 (Outpost), 2 (Garrison), or 3 (Citadel)";
  }

  if (energyAlignment && archetype !== "energy") {
    return "energyAlignment can only be set on energy archetypes";
  }

  return null;
}

/**
 * Returns the faction bonus multiplier for a given archetype + faction combination.
 * e.g. KRONOS player with fortress archetype → 0.25 (25% defense bonus)
 */
export function computeArchetypeFactionBonus(
  archetype: import("../../shared/schema").SubParcelArchetype,
  factionName: string | null | undefined
): number {
  if (!factionName) return 0;
  return ARCHETYPE_FACTION_BONUSES[archetype]?.[factionName] ?? 0;
}

/**
 * Inspects a 9-cell grid and returns dependency status:
 * - fortressOnline: true if at least one energy parcel exists adjacent to fortress parcels
 * - resourcePowered: true if at least one energy parcel exists to power resource extraction
 *
 * Used by the game engine to apply offline penalties for unpowered structures.
 */
export function computeGridPowerDependency(grid: SubParcel[]): {
  fortressOnline: boolean;
  resourcePowered: boolean;
} {
  const hasEnergy   = grid.some(sp => sp.archetype === "energy");
  const hasFortress = grid.some(sp => sp.archetype === "fortress");
  const hasResource = grid.some(sp => sp.archetype === "resource");
  return {
    fortressOnline:  hasFortress ? hasEnergy : true,  // no fortress = no penalty
    resourcePowered: hasResource ? hasEnergy : true,  // no resource = no penalty
  };
}

/**
 * Returns null if the player can subdivide this parcel, or an error string explaining why not.
 *
 * Rules:
 * 1. Player must own the macro-plot (ownerType = "player")
 * 2. Player must have held it for at least SUB_PARCEL_HOLD_HOURS
 * 3. Plot must not already be subdivided (no existing sub-parcel rows)
 * 4. Plot must not have an active battle
 */
export function canSubdivideParcel(
  parcel: LandParcel,
  playerId: string,
  alreadySubdivided: boolean,
  nowMs: number
): string | null {
  if (parcel.ownerId !== playerId) return "You do not own this plot";
  if (parcel.ownerType !== "player") return "Only human players can subdivide plots";
  if (parcel.activeBattleId) return "Cannot subdivide a plot with an active battle";
  if (alreadySubdivided) return "This plot is already subdivided";

  const holdMs = SUB_PARCEL_HOLD_HOURS * 60 * 60 * 1000;
  const heldSince = parcel.capturedAt ?? parcel.lastFrontierClaimTs;
  if (nowMs - heldSince < holdMs) {
    const remainingHours = ((holdMs - (nowMs - heldSince)) / 3_600_000).toFixed(1);
    return `Must hold this plot for ${SUB_PARCEL_HOLD_HOURS}h before subdividing (${remainingHours}h remaining)`;
  }

  return null; // allowed
}

/**
 * Calculate the FRONTIER purchase price for a sub-parcel based on the parent
 * plot's biome. Volcanic/mountain/water plots cost more per sub-parcel.
 */
export function computeSubParcelPrice(biome: BiomeType): number {
  // Scale from Algo price: multiply by 50 and cap between 10–100 FRONTIER
  const algoBase = LAND_PURCHASE_ALGO[biome] ?? 0.3;
  return Math.max(10, Math.min(100, Math.round(algoBase * 50)));
}

/**
 * Build the 9 sub-parcel insert rows for a freshly subdivided macro-plot.
 * The parent plot owner gets sub-parcel 4 (center of the 3×3 grid) for free.
 */
export function buildSubParcelRows(
  parentPlot: LandParcel,
  ownerId: string,
  nowMs: number
): SubParcelRow[] {
  const price = computeSubParcelPrice(parentPlot.biome as BiomeType);
  return Array.from({ length: SUB_PARCEL_COUNT }, (_, i) => ({
    id:                    randomUUID(),
    parentPlotId:          parentPlot.plotId,
    subIndex:              i,
    ownerId:               i === 4 ? ownerId : null,  // center cell given to subdivider
    ownerType:             i === 4 ? ("player" as const) : null,
    improvements:          [],
    resourceYieldFraction: SUB_PARCEL_YIELD_FRACTION,
    purchasePriceFrontier: price,
    acquiredAt:            i === 4 ? nowMs : null,
    activeBattleId:        null,
    createdAt:             nowMs,
    archetype:             null,
    archetypeLevel:        0,
    energyAlignment:       null,
  }));
}
