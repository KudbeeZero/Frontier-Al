/**
 * server/db-schema.ts
 *
 * Drizzle ORM table definitions for Frontier-AI.
 * All business-logic types live in shared/schema.ts; this file only
 * concerns itself with SQL structure and indexes.
 */

import {
  pgTable,
  varchar,
  integer,
  real,
  bigint,
  boolean,
  jsonb,
  text,
  index,
} from "drizzle-orm/pg-core";

// ─── game_meta ────────────────────────────────────────────────────────────────
// Singleton row (id=1) that records whether the world has been seeded and
// stores the current turn counter / last-update timestamp.

export const gameMeta = pgTable("game_meta", {
  id:            integer("id").primaryKey().default(1),
  initialized:   boolean("initialized").notNull().default(false),
  currentTurn:   integer("current_turn").notNull().default(1),
  lastUpdateTs:  bigint("last_update_ts", { mode: "number" }).notNull().default(0),
});

// ─── players ──────────────────────────────────────────────────────────────────
// One row per human or AI player.  Complex sub-objects (commanders, drones,
// specialAttacks) are stored as JSONB columns.

export const players = pgTable("players", {
  id:                   varchar("id", { length: 36 }).primaryKey(),
  address:              varchar("address", { length: 100 }).notNull().default("PLAYER_WALLET"),
  name:                 varchar("name", { length: 100 }).notNull(),
  iron:                 real("iron").notNull().default(0),
  fuel:                 real("fuel").notNull().default(0),
  crystal:              real("crystal").notNull().default(0),
  frontier:             real("frontier").notNull().default(0),
  isAi:                 boolean("is_ai").notNull().default(false),
  aiBehavior:           varchar("ai_behavior", { length: 20 }),
  totalIronMined:       real("total_iron_mined").notNull().default(0),
  totalFuelMined:       real("total_fuel_mined").notNull().default(0),
  totalCrystalMined:    real("total_crystal_mined").notNull().default(0),
  totalFrontierEarned:  real("total_frontier_earned").notNull().default(0),
  totalFrontierBurned:  real("total_frontier_burned").notNull().default(0),
  attacksWon:           integer("attacks_won").notNull().default(0),
  attacksLost:          integer("attacks_lost").notNull().default(0),
  territoriesCaptured:  integer("territories_captured").notNull().default(0),
  commanders:           jsonb("commanders").$type<object[]>().notNull().default([]),
  activeCommanderIndex: integer("active_commander_index").notNull().default(0),
  specialAttacks:       jsonb("special_attacks").$type<object[]>().notNull().default([]),
  drones:               jsonb("drones").$type<object[]>().notNull().default([]),
  welcomeBonusReceived: boolean("welcome_bonus_received").notNull().default(false),
});

// ─── parcels ──────────────────────────────────────────────────────────────────
// One row per land plot (21,000 total).  x/y/z store the unit-sphere
// cartesian coordinates derived from lat/lng at seed time.

export const parcels = pgTable(
  "parcels",
  {
    id:                   varchar("id", { length: 36 }).primaryKey(),
    plotId:               integer("plot_id").notNull(),
    lat:                  real("lat").notNull(),
    lng:                  real("lng").notNull(),
    // Unit-sphere cartesian coords (derived from lat/lng at seed time).
    // Stored for efficient nearest-neighbour spatial index queries.
    x:                    real("x").notNull().default(0),
    y:                    real("y").notNull().default(0),
    z:                    real("z").notNull().default(0),
    biome:                varchar("biome", { length: 20 }).notNull(),
    richness:             integer("richness").notNull(),
    ownerId:              varchar("owner_id", { length: 36 }),
    ownerType:            varchar("owner_type", { length: 10 }),
    defenseLevel:         integer("defense_level").notNull().default(1),
    ironStored:           real("iron_stored").notNull().default(0),
    fuelStored:           real("fuel_stored").notNull().default(0),
    crystalStored:        real("crystal_stored").notNull().default(0),
    storageCapacity:      integer("storage_capacity").notNull().default(200),
    lastMineTs:           bigint("last_mine_ts", { mode: "number" }).notNull().default(0),
    activeBattleId:       varchar("active_battle_id", { length: 36 }),
    yieldMultiplier:      real("yield_multiplier").notNull().default(1.0),
    improvements:         jsonb("improvements").$type<object[]>().notNull().default([]),
    purchasePriceAlgo:    real("purchase_price_algo"),
    frontierAccumulated:  real("frontier_accumulated").notNull().default(0),
    lastFrontierClaimTs:  bigint("last_frontier_claim_ts", { mode: "number" }).notNull().default(0),
    frontierPerDay:       real("frontier_per_day").notNull().default(1),
  },
  (t) => ({
    /** Fast lookup of all plots owned by a given player. */
    ownerIdIdx: index("parcels_owner_id_idx").on(t.ownerId),
    /** Spatial index on unit-sphere cartesian coords for proximity queries. */
    coordsIdx:  index("parcels_coords_idx").on(t.x, t.y, t.z),
  })
);

// ─── battles ──────────────────────────────────────────────────────────────────

export const battles = pgTable(
  "battles",
  {
    id:               varchar("id", { length: 36 }).primaryKey(),
    attackerId:       varchar("attacker_id", { length: 36 }).notNull(),
    defenderId:       varchar("defender_id", { length: 36 }),
    targetParcelId:   varchar("target_parcel_id", { length: 36 }).notNull(),
    attackerPower:    real("attacker_power").notNull(),
    defenderPower:    real("defender_power").notNull(),
    troopsCommitted:  integer("troops_committed").notNull(),
    resourcesBurned:  jsonb("resources_burned").$type<{ iron: number; fuel: number }>().notNull(),
    startTs:          bigint("start_ts", { mode: "number" }).notNull(),
    resolveTs:        bigint("resolve_ts", { mode: "number" }).notNull(),
    status:           varchar("status", { length: 20 }).notNull().default("pending"),
    outcome:          varchar("outcome", { length: 20 }),
    randFactor:       real("rand_factor"),
  },
  (t) => ({
    /** Used by resolveBattles() to efficiently find pending battles past their resolveTs. */
    statusResolveIdx: index("battles_status_resolve_idx").on(t.status, t.resolveTs),
    attackerIdx:      index("battles_attacker_idx").on(t.attackerId),
    defenderIdx:      index("battles_defender_idx").on(t.defenderId),
  })
);

// ─── game_events ──────────────────────────────────────────────────────────────

export const gameEvents = pgTable(
  "game_events",
  {
    id:          varchar("id", { length: 36 }).primaryKey(),
    type:        varchar("type", { length: 30 }).notNull(),
    playerId:    varchar("player_id", { length: 36 }).notNull(),
    parcelId:    varchar("parcel_id", { length: 36 }),
    battleId:    varchar("battle_id", { length: 36 }),
    description: text("description").notNull(),
    ts:          bigint("ts", { mode: "number" }).notNull(),
  },
  (t) => ({
    /** Efficient DESC scan for the latest 50 events shown in the UI. */
    tsIdx: index("game_events_ts_idx").on(t.ts),
  })
);
