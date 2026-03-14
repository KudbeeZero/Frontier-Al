import { randomUUID } from "crypto";
import type { Player } from "@shared/schema";
import {
  TOTAL_PLOTS,
  LAND_PURCHASE_ALGO,
  BASE_STORAGE_CAPACITY,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  gameMeta,
  players as playersTable,
  parcels as parcelsTable,
  gameEvents as gameEventsTable,
  aiFactionIdentities as aiFactionIdentitiesTable,
} from "../db-schema";
import { generateFibonacciSphere } from "../sphereUtils";
import { biomeFromLatitude, latLngToXYZ } from "./game-rules";

type DB = typeof db;

/**
 * One-time world seed: schema migrations + parcel/player creation.
 * Idempotent — checks game_meta.initialized before doing any work.
 */
export async function seedDatabase(db: DB): Promise<void> {
  // ── Schema migrations (safe to run on every startup) ─────────────────────
  // Add columns introduced after the initial DB release so that existing
  // deployments self-heal without requiring a manual `drizzle-kit push`.

  // NFT tracking table — created here so no separate migration step is needed.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS plot_nfts (
      plot_id           INT PRIMARY KEY,
      asset_id          BIGINT,
      minted_to_address TEXT,
      minted_at         BIGINT
    )
  `);

  // Orbital events table — persists server-authoritative impact events.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS orbital_events (
      id               VARCHAR(36) PRIMARY KEY,
      type             VARCHAR(30) NOT NULL,
      cosmetic         BOOLEAN NOT NULL DEFAULT FALSE,
      start_at         BIGINT NOT NULL,
      end_at           BIGINT NOT NULL,
      seed             INT NOT NULL DEFAULT 0,
      intensity        REAL NOT NULL DEFAULT 0.5,
      trajectory       JSONB NOT NULL DEFAULT '{}',
      target_parcel_id VARCHAR(36),
      effects          JSONB NOT NULL DEFAULT '[]',
      resolved         BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mint_idempotency (
      key         TEXT PRIMARY KEY,
      status      VARCHAR(10) NOT NULL DEFAULT 'pending',
      asset_id    BIGINT,
      tx_id       TEXT,
      created_at  BIGINT NOT NULL,
      updated_at  BIGINT NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS orbital_events_active_idx
      ON orbital_events (resolved, end_at)
  `);

  // Trade Station orders table — peer-to-peer resource exchange.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS trade_orders (
      id             VARCHAR(36) PRIMARY KEY,
      offerer_id     VARCHAR(36) NOT NULL,
      offerer_name   VARCHAR(100) NOT NULL,
      give_resource  VARCHAR(20) NOT NULL,
      give_amount    INT NOT NULL,
      want_resource  VARCHAR(20) NOT NULL,
      want_amount    INT NOT NULL,
      status         VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at     BIGINT NOT NULL,
      filled_by_id   VARCHAR(36),
      filled_by_name VARCHAR(100),
      filled_at      BIGINT
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS trade_orders_status_idx
      ON trade_orders (status, created_at DESC)
  `);

  await db.execute(
    sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS total_crystal_mined REAL NOT NULL DEFAULT 0`
  );
  await db.execute(
    sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS morale_debuff_until BIGINT NOT NULL DEFAULT 0`
  );
  await db.execute(
    sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS attack_cooldown_until BIGINT NOT NULL DEFAULT 0`
  );
  await db.execute(
    sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS consecutive_losses INT NOT NULL DEFAULT 0`
  );

  // Influence columns — Foundation Pass
  await db.execute(
    sql`ALTER TABLE parcels ADD COLUMN IF NOT EXISTS influence INT NOT NULL DEFAULT 100`
  );
  await db.execute(
    sql`ALTER TABLE parcels ADD COLUMN IF NOT EXISTS influence_repair_rate REAL NOT NULL DEFAULT 2.0`
  );
  await db.execute(
    sql`ALTER TABLE battles ADD COLUMN IF NOT EXISTS crystal_burned INT NOT NULL DEFAULT 0`
  );
  await db.execute(
    sql`ALTER TABLE battles ADD COLUMN IF NOT EXISTS influence_damage INT NOT NULL DEFAULT 0`
  );

  // Check whether the world has already been seeded.
  const [meta] = await db
    .insert(gameMeta)
    .values({ id: 1, initialized: false, currentTurn: 1, lastUpdateTs: Date.now() })
    .onConflictDoNothing()
    .returning();

  const existing = meta
    ? meta
    : (await db.select().from(gameMeta).where(eq(gameMeta.id, 1)))[0];

  if (existing?.initialized) return; // already seeded in a previous process run

  console.log("DbStorage: seeding world for the first time…");

  await db.transaction(async (tx) => {
    const plotCoords = generateFibonacciSphere(TOTAL_PLOTS);
    const now = Date.now();

    // ── Seed parcels in 500-row batches ──────────────────────────────────
    const BATCH = 500;
    const rows = plotCoords.map((coord) => {
      const biome  = biomeFromLatitude(coord.lat, coord.plotId);
      const { x, y, z } = latLngToXYZ(coord.lat, coord.lng);
      return {
        id:                  randomUUID(),
        plotId:              coord.plotId,
        lat:                 coord.lat,
        lng:                 coord.lng,
        x, y, z,
        biome,
        richness:            Math.floor(Math.random() * 60) + 40,
        defenseLevel:        1,
        ironStored:          0,
        fuelStored:          0,
        crystalStored:       0,
        storageCapacity:     BASE_STORAGE_CAPACITY,
        lastMineTs:          0,
        yieldMultiplier:     1.0,
        improvements:        [] as object[],
        purchasePriceAlgo:   LAND_PURCHASE_ALGO[biome],
        frontierAccumulated: 0,
        lastFrontierClaimTs: now,
        frontierPerDay:      1,
        // reconquest fields default to null/0 in DB via schema defaults
      };
    });

    for (let i = 0; i < rows.length; i += BATCH) {
      await tx.insert(parcelsTable).values(rows.slice(i, i + BATCH));
      if ((i + BATCH) % 5000 === 0 || i + BATCH >= rows.length) {
        console.log(`  seeded ${Math.min(i + BATCH, rows.length)} / ${rows.length} parcels`);
      }
    }

    // ── Human player ─────────────────────────────────────────────────────
    const humanId = randomUUID();
    await tx.insert(playersTable).values({
      id:      humanId,
      address: "PLAYER_WALLET",
      name:    "Commander",
      iron:    200,
      fuel:    150,
      crystal: 50,
    });

    // Give the human player the first plot (plotId=1)
    await tx
      .update(parcelsTable)
      .set({ ownerId: humanId, ownerType: "player", defenseLevel: 3, purchasePriceAlgo: null, lastFrontierClaimTs: now })
      .where(eq(parcelsTable.plotId, 1));

    // ── AI players ───────────────────────────────────────────────────────
    const AI_NAMES     = ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"];
    const AI_BEHAVIORS: Player["aiBehavior"][] = ["expansionist", "defensive", "raider", "economic"];
    const AI_PLOTS     = [5250, 10500, 15750, 20000];

    for (let i = 0; i < 4; i++) {
      const aiId = randomUUID();
      await tx.insert(playersTable).values({
        id:                   aiId,
        address:              `AI_WALLET_${i}`,
        name:                 AI_NAMES[i],
        iron:                 150,
        fuel:                 100,
        crystal:              25,
        isAi:                 true,
        aiBehavior:           AI_BEHAVIORS[i],
        welcomeBonusReceived: true,
      });
      await tx
        .update(parcelsTable)
        .set({ ownerId: aiId, ownerType: "ai", defenseLevel: 2, purchasePriceAlgo: null, lastFrontierClaimTs: now })
        .where(eq(parcelsTable.plotId, AI_PLOTS[i]));
    }

    // ── Faction identity placeholder rows ────────────────────────────────
    // assetId is NULL here — the chain service fills it in during bootstrap.
    // These rows ensure the faction names exist in the table from day one.
    const FACTION_NAMES = ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"];
    for (const factionName of FACTION_NAMES) {
      await tx
        .insert(aiFactionIdentitiesTable)
        .values({ factionName })
        .onConflictDoNothing();
    }

    // ── Initial event & mark initialized ─────────────────────────────────
    await tx.insert(gameEventsTable).values({
      id:          randomUUID(),
      type:        "ai_action",
      playerId:    "system",
      description: "Game world initialized. 21,000 plots ready. Factions are mobilizing.",
      ts:          now,
    });

    await tx
      .update(gameMeta)
      .set({ initialized: true, lastUpdateTs: now })
      .where(eq(gameMeta.id, 1));
  });

  console.log("DbStorage: world seed complete.");
}
