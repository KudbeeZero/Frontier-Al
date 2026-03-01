/**

- server/db-schema.ts
- 
- Drizzle ORM table definitions for Frontier-AI.
- All business-logic types live in shared/schema.ts; this file only
- concerns itself with SQL structure and indexes.
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
} from “drizzle-orm/pg-core”;

// ─── plot_nfts ─────────────────────────────────────────────────────────────
// Tracks on-chain Algorand ASA (NFT) minting state per plot.
// asset_id is NULL until the plot NFT is minted; minted_to_address is the
// Algorand wallet that holds the NFT.  This table is append-light: one row
// per plot, upserted at purchase time and updated when minting succeeds.
export const plotNfts = pgTable(“plot_nfts”, {
plotId:          integer(“plot_id”).primaryKey(),
assetId:         bigint(“asset_id”, { mode: “number” }),          // NULL until minted on-chain
mintedToAddress: text(“minted_to_address”),                        // Algorand wallet address
mintedAt:        bigint(“minted_at”, { mode: “number” }),          // Unix ms timestamp of mint
});

// ─── mint_idempotency ──────────────────────────────────────────────────────────
// Prevents double-minting when a player clicks “purchase” twice in rapid succession.
// Key format: “mint:{playerId}:{plotId}”
// Status lifecycle: pending → confirmed | failed
// Routes MUST check for an existing “pending” or “confirmed” row before submitting
// a new on-chain transaction.

export const mintIdempotency = pgTable(“mint_idempotency”, {
key:       text(“key”).primaryKey(),                                   // “mint:{playerId}:{plotId}”
status:    varchar(“status”, { length: 10 }).notNull().default(“pending”), // pending|confirmed|failed
assetId:   bigint(“asset_id”,  { mode: “number” }),                    // filled on confirmed
txId:      text(“tx_id”),                                              // on-chain txId on confirmed
createdAt: bigint(“created_at”, { mode: “number” }).notNull(),
updatedAt: bigint(“updated_at”, { mode: “number” }).notNull(),
});

// ─── ai_faction_identities ────────────────────────────────────────────────────
// One row per AI faction. Records the on-chain Algorand ASA that serves as
// that faction’s permanent identity token. Minted once at world init.
// assetId is NULL until the ASA is confirmed on-chain.
// This table is append-only after world seed — never deleted, never updated
// except to record the confirmed assetId and txId.

export const aiFactionIdentities = pgTable(“ai_faction_identities”, {
factionName:  varchar(“faction_name”, { length: 20 }).primaryKey(), // “NEXUS-7” etc.
assetId:      bigint(“asset_id”,  { mode: “number” }),              // NULL until minted
mintTxId:     text(“mint_tx_id”),                                   // Algorand txId of create
mintedAt:     bigint(“minted_at”, { mode: “number” }),              // Unix ms
explorerUrl:  text(“explorer_url”),                                 // e.g. https://allo.info/asset/X
});

// ─── game_meta ────────────────────────────────────────────────────────────────
// Singleton row (id=1) that records whether the world has been seeded and
// stores the current turn counter / last-update timestamp.

export const gameMeta = pgTable(“game_meta”, {
id:            integer(“id”).primaryKey().default(1),
initialized:   boolean(“initialized”).notNull().default(false),
currentTurn:   integer(“current_turn”).notNull().default(1),
lastUpdateTs:  bigint(“last_update_ts”, { mode: “number” }).notNull().default(0),
});

// ─── players ──────────────────────────────────────────────────────────────────
// One row per human or AI player.  Complex sub-objects (commanders, drones,
// specialAttacks) are stored as JSONB columns.

export const players = pgTable(“players”, {
id:                   varchar(“id”, { length: 36 }).primaryKey(),
address:              varchar(“address”, { length: 100 }).notNull().default(“PLAYER_WALLET”),
name:                 varchar(“name”, { length: 100 }).notNull(),
iron:                 integer(“iron”).notNull().default(0),
fuel:                 integer(“fuel”).notNull().default(0),
crystal:              integer(“crystal”).notNull().default(0),
frontier:             integer(“frontier”).notNull().default(0),
isAi:                 boolean(“is_ai”).notNull().default(false),
aiBehavior:           varchar(“ai_behavior”, { length: 20 }),
totalIronMined:       integer(“total_iron_mined”).notNull().default(0),
totalFuelMined:       integer(“total_fuel_mined”).notNull().default(0),
totalCrystalMined:    real(“total_crystal_mined”).notNull().default(0),
totalFrontierEarned:  real(“total_frontier_earned”).notNull().default(0),
totalFrontierBurned:  real(“total_frontier_burned”).notNull().default(0),
attacksWon:           integer(“attacks_won”).notNull().default(0),
attacksLost:          integer(“attacks_lost”).notNull().default(0),
territoriesCaptured:  integer(“territories_captured”).notNull().default(0),
commanders:           jsonb(“commanders”).$type<object[]>().notNull().default([]),
activeCommanderIndex: integer(“active_commander_index”).notNull().default(0),
specialAttacks:       jsonb(“special_attacks”).$type<object[]>().notNull().default([]),
drones:               jsonb(“drones”).$type<object[]>().notNull().default([]),
satellites:           jsonb(“satellites”).$type<object[]>().notNull().default([]),
welcomeBonusReceived: boolean(“welcome_bonus_received”).notNull().default(false),
frntrBalanceMicro:    bigint(“frntr_balance_micro”, { mode: “number” }).notNull().default(0),
frntrReadyMicro:      bigint(“frntr_ready_micro”,   { mode: “number” }).notNull().default(0),
frntrClaimedMicro:    bigint(“frntr_claimed_micro”,  { mode: “number” }).notNull().default(0),
/** Timestamp (ms) until which morale debuff is active — reduces attack power. */
moraleDebuffUntil:    bigint(“morale_debuff_until”, { mode: “number” }).notNull().default(0),
/** Timestamp (ms) until which new attacks cannot be launched (cooldown). */
attackCooldownUntil:  bigint(“attack_cooldown_until”, { mode: “number” }).notNull().default(0),
/** Running count of consecutive territory losses; resets on a successful defence. */
consecutiveLosses:    integer(“consecutive_losses”).notNull().default(0),
testnetProgress:      jsonb(“testnet_progress”).$type<string[]>().notNull().default([]),
treasury:             real(“treasury”).notNull().default(1000.0),
});

// ─── parcels ──────────────────────────────────────────────────────────────────
// One row per land plot (21,000 total).  x/y/z store the unit-sphere
// cartesian coordinates derived from lat/lng at seed time.

export const parcels = pgTable(
“parcels”,
{
id:                   varchar(“id”, { length: 36 }).primaryKey(),
plotId:               integer(“plot_id”).notNull(),
lat:                  real(“lat”).notNull(),
lng:                  real(“lng”).notNull(),
// Unit-sphere cartesian coords (derived from lat/lng at seed time).
// Stored for efficient nearest-neighbour spatial index queries.
x:                    real(“x”).notNull().default(0),
y:                    real(“y”).notNull().default(0),
z:                    real(“z”).notNull().default(0),
biome:                varchar(“biome”, { length: 20 }).notNull(),
richness:             integer(“richness”).notNull(),
ownerId:              varchar(“owner_id”, { length: 36 }),
ownerType:            varchar(“owner_type”, { length: 10 }),
defenseLevel:         integer(“defense_level”).notNull().default(1),
ironStored:           real(“iron_stored”).notNull().default(0),
fuelStored:           real(“fuel_stored”).notNull().default(0),
crystalStored:        real(“crystal_stored”).notNull().default(0),
storageCapacity:      integer(“storage_capacity”).notNull().default(200),
lastMineTs:           bigint(“last_mine_ts”, { mode: “number” }).notNull().default(0),
activeBattleId:       varchar(“active_battle_id”, { length: 36 }),
yieldMultiplier:      real(“yield_multiplier”).notNull().default(1.0),
improvements:         jsonb(“improvements”).$type<object[]>().notNull().default([]),
purchasePriceAlgo:    real(“purchase_price_algo”),
frontierAccumulated:  real(“frontier_accumulated”).notNull().default(0),
lastFrontierClaimTs:  bigint(“last_frontier_claim_ts”, { mode: “number” }).notNull().default(0),
frontierPerDay:       real(“frontier_per_day”).notNull().default(1),

```
// ── Reconquest Tracking ────────────────────────────────────────────────
// Set when a human player captures a plot previously owned by an AI faction.
// Drives the AI reconquest engine decision logic.
capturedFromFaction:  varchar("captured_from_faction", { length: 20 }),  // e.g. "NEXUS-7"
capturedAt:           bigint("captured_at",  { mode: "number" }),         // Unix ms of capture
handoverCount:        integer("handover_count").notNull().default(0),     // exchanges between same player+faction
```

},
(t) => ({
/** Fast lookup of all plots owned by a given player. */
ownerIdIdx: index(“parcels_owner_id_idx”).on(t.ownerId),
/** Spatial index on unit-sphere cartesian coords for proximity queries. */
coordsIdx:  index(“parcels_coords_idx”).on(t.x, t.y, t.z),
})
);

// ─── battles ──────────────────────────────────────────────────────────────────

export const battles = pgTable(
“battles”,
{
id:               varchar(“id”, { length: 36 }).primaryKey(),
attackerId:       varchar(“attacker_id”, { length: 36 }).notNull(),
defenderId:       varchar(“defender_id”, { length: 36 }),
targetParcelId:   varchar(“target_parcel_id”, { length: 36 }).notNull(),
attackerPower:    real(“attacker_power”).notNull(),
defenderPower:    real(“defender_power”).notNull(),
troopsCommitted:  integer(“troops_committed”).notNull(),
resourcesBurned:  jsonb(“resources_burned”).$type<{ iron: number; fuel: number }>().notNull(),
startTs:          bigint(“start_ts”, { mode: “number” }).notNull(),
resolveTs:        bigint(“resolve_ts”, { mode: “number” }).notNull(),
status:           varchar(“status”, { length: 20 }).notNull().default(“pending”),
outcome:          varchar(“outcome”, { length: 20 }),
randFactor:       real(“rand_factor”),
commanderId:      varchar(“commander_id”, { length: 36 }),
},
(t) => ({
/** Used by resolveBattles() to efficiently find pending battles past their resolveTs. */
statusResolveIdx: index(“battles_status_resolve_idx”).on(t.status, t.resolveTs),
attackerIdx:      index(“battles_attacker_idx”).on(t.attackerId),
defenderIdx:      index(“battles_defender_idx”).on(t.defenderId),
})
);

// ─── orbital_events ───────────────────────────────────────────────────────────
// Persists server-authoritative IMPACT events (cosmetic-only events are
// generated deterministically on the client; no DB row required for those).

export const orbitalEvents = pgTable(
“orbital_events”,
{
id:            varchar(“id”, { length: 36 }).primaryKey(),
type:          varchar(“type”, { length: 30 }).notNull(),
cosmetic:      boolean(“cosmetic”).notNull().default(false),
startAt:       bigint(“start_at”,  { mode: “number” }).notNull(),
endAt:         bigint(“end_at”,    { mode: “number” }).notNull(),
seed:          integer(“seed”).notNull().default(0),
intensity:     real(“intensity”).notNull().default(0.5),
trajectory:    jsonb(“trajectory”).$type<object>().notNull(),
targetParcelId: varchar(“target_parcel_id”, { length: 36 }),
effects:       jsonb(“effects”).$type<object[]>().notNull().default([]),
resolved:      boolean(“resolved”).notNull().default(false),
},
(t) => ({
activeIdx: index(“orbital_events_active_idx”).on(t.resolved, t.endAt),
})
);

// ─── game_events ──────────────────────────────────────────────────────────────

export const gameEvents = pgTable(
“game_events”,
{
id:          varchar(“id”, { length: 36 }).primaryKey(),
type:        varchar(“type”, { length: 30 }).notNull(),
playerId:    varchar(“player_id”, { length: 36 }).notNull(),
parcelId:    varchar(“parcel_id”, { length: 36 }),
battleId:    varchar(“battle_id”, { length: 36 }),
description: text(“description”).notNull(),
ts:          bigint(“ts”, { mode: “number” }).notNull(),
},
(t) => ({
/** Efficient DESC scan for the latest 50 events shown in the UI. */
tsIdx: index(“game_events_ts_idx”).on(t.ts),
})
);