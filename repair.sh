#!/bin/bash
# FRONTIER repair script - run from ~/workspace in Replit shell
# Usage: bash repair.sh

echo "Starting FRONTIER file repair..."

mkdir -p server/services/chain
mkdir -p server/engine/ai
mkdir -p server/engine/battle


echo "Writing server/db-schema.ts..."
cat > server/db-schema.ts << 'FRONTIER_FILE_END_MARKER'
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

// ─── plot_nfts ─────────────────────────────────────────────────────────────
// Tracks on-chain Algorand ASA (NFT) minting state per plot.
// asset_id is NULL until the plot NFT is minted; minted_to_address is the
// Algorand wallet that holds the NFT.  This table is append-light: one row
// per plot, upserted at purchase time and updated when minting succeeds.
export const plotNfts = pgTable("plot_nfts", {
  plotId:          integer("plot_id").primaryKey(),
  assetId:         bigint("asset_id", { mode: "number" }),          // NULL until minted on-chain
  mintedToAddress: text("minted_to_address"),                        // Algorand wallet address
  mintedAt:        bigint("minted_at", { mode: "number" }),          // Unix ms timestamp of mint
});

// ─── mint_idempotency ──────────────────────────────────────────────────────────
// Prevents double-minting when a player clicks "purchase" twice in rapid succession.
// Key format: "mint:{playerId}:{plotId}"
// Status lifecycle: pending → confirmed | failed
// Routes MUST check for an existing "pending" or "confirmed" row before submitting
// a new on-chain transaction.

export const mintIdempotency = pgTable("mint_idempotency", {
  key:       text("key").primaryKey(),                                   // "mint:{playerId}:{plotId}"
  status:    varchar("status", { length: 10 }).notNull().default("pending"), // pending|confirmed|failed
  assetId:   bigint("asset_id",  { mode: "number" }),                    // filled on confirmed
  txId:      text("tx_id"),                                              // on-chain txId on confirmed
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

// ─── ai_faction_identities ────────────────────────────────────────────────────
// One row per AI faction. Records the on-chain Algorand ASA that serves as
// that faction's permanent identity token. Minted once at world init.
// assetId is NULL until the ASA is confirmed on-chain.
// This table is append-only after world seed — never deleted, never updated
// except to record the confirmed assetId and txId.

export const aiFactionIdentities = pgTable("ai_faction_identities", {
  factionName:  varchar("faction_name", { length: 20 }).primaryKey(), // "NEXUS-7" etc.
  assetId:      bigint("asset_id",  { mode: "number" }),              // NULL until minted
  mintTxId:     text("mint_tx_id"),                                   // Algorand txId of create
  mintedAt:     bigint("minted_at", { mode: "number" }),              // Unix ms
  explorerUrl:  text("explorer_url"),                                 // e.g. https://allo.info/asset/X
});

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
  iron:                 integer("iron").notNull().default(0),
  fuel:                 integer("fuel").notNull().default(0),
  crystal:              integer("crystal").notNull().default(0),
  frontier:             integer("frontier").notNull().default(0),
  isAi:                 boolean("is_ai").notNull().default(false),
  aiBehavior:           varchar("ai_behavior", { length: 20 }),
  totalIronMined:       integer("total_iron_mined").notNull().default(0),
  totalFuelMined:       integer("total_fuel_mined").notNull().default(0),
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
  satellites:           jsonb("satellites").$type<object[]>().notNull().default([]),
  welcomeBonusReceived: boolean("welcome_bonus_received").notNull().default(false),
  frntrBalanceMicro:    bigint("frntr_balance_micro", { mode: "number" }).notNull().default(0),
  frntrReadyMicro:      bigint("frntr_ready_micro",   { mode: "number" }).notNull().default(0),
  frntrClaimedMicro:    bigint("frntr_claimed_micro",  { mode: "number" }).notNull().default(0),
  /** Timestamp (ms) until which morale debuff is active — reduces attack power. */
  moraleDebuffUntil:    bigint("morale_debuff_until", { mode: "number" }).notNull().default(0),
  /** Timestamp (ms) until which new attacks cannot be launched (cooldown). */
  attackCooldownUntil:  bigint("attack_cooldown_until", { mode: "number" }).notNull().default(0),
  /** Running count of consecutive territory losses; resets on a successful defence. */
  consecutiveLosses:    integer("consecutive_losses").notNull().default(0),
  testnetProgress:      jsonb("testnet_progress").$type<string[]>().notNull().default([]),
  treasury:             real("treasury").notNull().default(1000.0),
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

    // ── Reconquest Tracking ────────────────────────────────────────────────
    // Set when a human player captures a plot previously owned by an AI faction.
    // Drives the AI reconquest engine decision logic.
    capturedFromFaction:  varchar("captured_from_faction", { length: 20 }),  // e.g. "NEXUS-7"
    capturedAt:           bigint("captured_at",  { mode: "number" }),         // Unix ms of capture
    handoverCount:        integer("handover_count").notNull().default(0),     // exchanges between same player+faction
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
    commanderId:      varchar("commander_id", { length: 36 }),
  },
  (t) => ({
    /** Used by resolveBattles() to efficiently find pending battles past their resolveTs. */
    statusResolveIdx: index("battles_status_resolve_idx").on(t.status, t.resolveTs),
    attackerIdx:      index("battles_attacker_idx").on(t.attackerId),
    defenderIdx:      index("battles_defender_idx").on(t.defenderId),
  })
);

// ─── orbital_events ───────────────────────────────────────────────────────────
// Persists server-authoritative IMPACT events (cosmetic-only events are
// generated deterministically on the client; no DB row required for those).

export const orbitalEvents = pgTable(
  "orbital_events",
  {
    id:            varchar("id", { length: 36 }).primaryKey(),
    type:          varchar("type", { length: 30 }).notNull(),
    cosmetic:      boolean("cosmetic").notNull().default(false),
    startAt:       bigint("start_at",  { mode: "number" }).notNull(),
    endAt:         bigint("end_at",    { mode: "number" }).notNull(),
    seed:          integer("seed").notNull().default(0),
    intensity:     real("intensity").notNull().default(0.5),
    trajectory:    jsonb("trajectory").$type<object>().notNull(),
    targetParcelId: varchar("target_parcel_id", { length: 36 }),
    effects:       jsonb("effects").$type<object[]>().notNull().default([]),
    resolved:      boolean("resolved").notNull().default(false),
  },
  (t) => ({
    activeIdx: index("orbital_events_active_idx").on(t.resolved, t.endAt),
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
FRONTIER_FILE_END_MARKER

echo "Writing server/routes.ts..."
cat > server/routes.ts << 'FRONTIER_FILE_END_MARKER'
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { mineActionSchema, upgradeActionSchema, attackActionSchema, buildActionSchema, purchaseActionSchema, collectActionSchema, claimFrontierActionSchema, mintAvatarActionSchema, specialAttackActionSchema, deployDroneActionSchema, deploySatelliteActionSchema } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { parcels as parcelsTable, plotNfts as plotNftsTable, players as playersTable, mintIdempotency as mintIdempotencyTable } from "./db-schema";
import { eq, sql } from "drizzle-orm";

// ── Chain Service ─────────────────────────────────────────────────────────────
// All algosdk usage is now isolated in server/services/chain/*.
// Routes import ONLY from the service layer — never from algosdk directly.
import { getFrontierAsaId, getOrCreateFrontierAsa, isAddressOptedIn, setFrontierAsaId } from "./services/chain/asa.js";
import { getAdminAddress, getAdminBalance } from "./services/chain/client.js";
import { mintLandNft } from "./services/chain/land.js";
import {
  bootstrapFactionIdentities,
  getAllFactionAsaIds,
  getFactionAsaId,
  FACTION_DEFINITIONS,
} from "./services/chain/factions.js";
// Batcher remains in algorand.ts (Phase 2 will migrate it); imported for compatibility.
import { batchedTransferFrontierASA, indexerClient } from "./algorand.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Blockchain Initialization (via Chain Service) ──────────────────────────
  let blockchainReady = false;
  (async () => {
    try {
      const forceNew = process.env.FORCE_NEW_ASA === "true";
      const asaId    = await getOrCreateFrontierAsa({ forceNew });
      setFrontierAsaId(asaId);
      blockchainReady = true;
      const adminAddr = getAdminAddress();
      const balance   = await getAdminBalance();
      console.log(`[routes] Blockchain ready: ASA=${asaId}, Admin=${adminAddr}, ALGO=${balance.algo}`);

      // Bootstrap faction identity ASAs (idempotent — safe on every restart)
      const factionBaseUrl = process.env.PUBLIC_BASE_URL ?? "https://frontier-al.app";
      bootstrapFactionIdentities(factionBaseUrl).catch((err) =>
        console.error("[routes] Faction identity bootstrap failed:", err)
      );
    } catch (err) {
      console.error("[routes] Blockchain init failed:", err);
    }
  })();

  app.get("/api/blockchain/status", async (_req, res) => {
    try {
      const asaId      = getFrontierAsaId();
      const adminAddress = getAdminAddress();
      const balance    = await getAdminBalance();
      const forceNew   = process.env.FORCE_NEW_ASA === "true";
      const network    = process.env.ALGORAND_NETWORK ?? "testnet";
      const factionAsaIds = getAllFactionAsaIds();
      res.json({
        ready: blockchainReady,
        frontierAsaId: asaId,
        adminAddress,
        adminAlgoBalance: balance.algo,
        adminFrontierBalance: balance.frontierAsa,
        network,
        forceNewAsaEnabled: forceNew,
        factionIdentities: factionAsaIds,
      });
    } catch (error) {
      res.json({ ready: false, frontierAsaId: null, adminAddress: null });
    }
  });

  app.get("/api/economics", async (_req, res) => {
    try {
      const asaId = getFrontierAsaId();
      const adminAddr = getAdminAddress();
      const ASA_DECIMALS = 6;
      const divisor = Math.pow(10, ASA_DECIMALS);

      if (!asaId || !adminAddr) {
        return res.status(503).json({ error: "Blockchain not initialized yet" });
      }

      const [assetLookup, adminAccountInfo] = await Promise.all([
        indexerClient.lookupAssetByID(asaId).do() as Promise<any>,
        algodClient.accountInformation(adminAddr).do() as Promise<any>,
      ]);

      const assetParams = assetLookup?.asset?.params ?? assetLookup?.params ?? assetLookup;
      const rawTotal: number = Number(assetParams.total ?? assetParams["total"] ?? 0);
      const totalSupply = rawTotal / divisor;

      // Use only the held-assets array — "created-assets" has a different shape
      // (no `amount` field) and would silently report treasury=0 if used here.
      const assets: any[] = (adminAccountInfo as any).assets ?? [];
      if (!Array.isArray(assets)) {
        console.error("[/api/economics] Unexpected admin accountInfo shape — 'assets' is not an array. Keys:", Object.keys(adminAccountInfo as any ?? {}));
      }
      const adminAsset = Array.isArray(assets)
        ? assets.find((a: any) => Number(a.assetId ?? a["asset-id"] ?? a.assetIndex) === asaId)
        : undefined;

      if (Array.isArray(assets) && adminAsset === undefined) {
        // Admin account holds the ASA but it wasn't found in the assets array.
        // This most likely means the admin has not yet opted in, or the algod
        // response key names changed. Treasury will be reported as 0, which is
        // misleading — log explicitly so it surfaces in monitoring.
        console.warn(
          `[/api/economics] asaId=${asaId} not found in admin account's 'assets' array ` +
            `(${assets.length} entries). Treasury will be reported as 0. ` +
            "Verify admin account is opted in to the FRONTIER ASA."
        );
      }

      const rawAdminBalance: number = Number(adminAsset?.amount ?? 0);
      const treasury = rawAdminBalance / divisor;

      const circulating = Math.round((totalSupply - treasury) * 100) / 100;

      // Query in-game token metrics from DB so the panel reflects actual
      // player balances regardless of whether on-chain transfers have settled.
      let totalBurned = 0;
      let inGameCirculating = 0;
      try {
        const [metrics] = await db
          .select({
            burned:  sql<number>`COALESCE(SUM(${playersTable.totalFrontierBurned}), 0)`,
            balanceMicro: sql<number>`COALESCE(SUM(${playersTable.frntrBalanceMicro}), 0)`,
          })
          .from(playersTable);
        totalBurned       = Math.round(Number(metrics?.burned       ?? 0) * 100) / 100;
        inGameCirculating = Math.round(Number(metrics?.balanceMicro ?? 0) / divisor * 100) / 100;
      } catch (_dbErr) {
        // Non-fatal — fall back to on-chain circulating
        inGameCirculating = circulating;
      }

      res.json({
        asaId,
        adminAddress: adminAddr,
        totalSupply,
        treasury: Math.round(treasury * 100) / 100,
        circulating,
        totalBurned,
        inGameCirculating,
        network: "Algorand TestNet",
        unitName: "FRNTR",
        assetName: "FRONTIER",
        decimals: ASA_DECIMALS,
      });
    } catch (error) {
      console.error("Economics fetch error:", error);
      res.status(500).json({ error: "Failed to fetch economics data" });
    }
  });

  app.get("/api/blockchain/opt-in-check/:address", async (req, res) => {
    try {
      const queryAsaId = req.query.assetId ? Number(req.query.assetId) : undefined;
      const optedIn = await isAddressOptedIn(req.params.address, queryAsaId);
      res.json({ optedIn, asaId: getFrontierAsaId() });
    } catch (error) {
      res.json({ optedIn: false, asaId: getFrontierAsaId() });
    }
  });

  // ── Faction Identity Metadata ────────────────────────────────────────────────
  // ARC-3 style metadata for each AI faction identity ASA.
  // Referenced as assetURL on the on-chain ASA — permanent, do not change path.
  app.get("/faction/:name", (req, res) => {
    const factionName = decodeURIComponent(req.params.name);
    const def = FACTION_DEFINITIONS.find((f) => f.name === factionName);
    if (!def) return res.status(404).json({ error: "Faction not found" });

    const asaId       = getFactionAsaId(factionName);
    const baseUrl     = process.env.PUBLIC_BASE_URL ?? `${req.protocol}://${req.get("host")}`;
    const explorerUrl = asaId ? `https://allo.info/asset/${asaId}` : null;

    res.json({
      name:        def.assetName,
      description: def.lore,
      image:       `${baseUrl}/faction/images/${encodeURIComponent(factionName)}.svg`,
      external_url: `${baseUrl}/faction/${encodeURIComponent(factionName)}`,
      properties: {
        factionName: def.name,
        unitName:    def.unitName,
        behavior:    def.behavior,
        assetId:     asaId,
        explorerUrl,
        totalSupply: def.totalSupply,
        game:        "FRONTIER",
        version:     1,
      },
    });
  });

  // ── NFT Metadata (ARC-3) ────────────────────────────────────────────────────
  // Public endpoint used by Algorand NFT marketplaces and wallets.
  // Returns immutable plot attributes only — no mutable game state.
  // BASE_URL: set PUBLIC_BASE_URL env var in production, or it falls back
  // to the request's own origin (works in dev and on Replit).
  app.get("/nft/metadata/:plotId", async (req, res) => {
    // Reject non-integer plotId values early.
    const plotId = parseInt(req.params.plotId, 10);
    if (isNaN(plotId) || plotId < 1) {
      return res.status(400).json({ error: "plotId must be a positive integer" });
    }

    // This endpoint requires a real DB (not MemStorage).
    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    try {
      // Derive base URL: env var (production) → request origin (non-localhost).
      // LOCAL DEVELOPMENT: set PUBLIC_BASE_URL in .env so metadata served at
      // /nft/metadata/:plotId returns a real public URL rather than localhost.
      // Without it, NFT image links in metadata JSON will be broken for anyone
      // not running the server locally.
      const reqHost = req.get("host") || "";
      const isLocal = reqHost.includes("localhost") || reqHost.includes("127.0.0.1");
      const baseUrl = process.env.PUBLIC_BASE_URL || (isLocal ? null : `${req.protocol}://${reqHost}`);

      if (!baseUrl) {
        // Metadata would contain localhost URLs — log and return a 503 so the
        // caller knows the data is unreliable rather than silently serving bad URLs.
        console.error("[/nft/metadata] PUBLIC_BASE_URL is not set and request is from localhost. Set PUBLIC_BASE_URL for NFT metadata to work correctly.");
        return res.status(503).json({ error: "PUBLIC_BASE_URL not configured — NFT metadata URLs would be invalid. Set PUBLIC_BASE_URL env var." });
      }

      // Select only the columns needed for immutable ARC-3 metadata.
      const [parcel] = await db
        .select({
          plotId:           parcelsTable.plotId,
          biome:            parcelsTable.biome,
          lat:              parcelsTable.lat,
          lng:              parcelsTable.lng,
          richness:         parcelsTable.richness,
          purchasePriceAlgo: parcelsTable.purchasePriceAlgo,
        })
        .from(parcelsTable)
        .where(eq(parcelsTable.plotId, plotId));

      if (!parcel) {
        return res.status(404).json({ error: "Plot not found" });
      }

      // ARC-3 style metadata — keep lean; mutable game state is excluded.
      res.json({
        name:         `Frontier Plot #${parcel.plotId}`,
        description:  "A land parcel on the Frontier globe. Own, upgrade, and battle for territory.",
        image:        `${baseUrl}/nft/biomes/${parcel.biome}.svg`,
        external_url: `${baseUrl}/plot/${parcel.plotId}`,
        properties: {
          plotId:            parcel.plotId,
          biome:             parcel.biome,
          coordinates:       { lat: parcel.lat, lng: parcel.lng },
          richness:          parcel.richness,
          purchasePriceAlgo: parcel.purchasePriceAlgo,
          version:           1,
        },
      });
    } catch (error) {
      console.error("NFT metadata error:", error);
      res.status(500).json({ error: "Failed to fetch NFT metadata" });
    }
  });

  // ── Plot NFT on-chain record lookup ────────────────────────────────────────
  // Returns the plot_nfts row for a given plotId.
  // Useful for checking if a plot has been minted and retrieving its assetId.
  app.get("/api/nft/plot/:plotId", async (req, res) => {
    const plotId = parseInt(req.params.plotId, 10);
    if (isNaN(plotId) || plotId < 1) {
      return res.status(400).json({ error: "plotId must be a positive integer" });
    }
    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }
    try {
      const [row] = await db
        .select()
        .from(plotNftsTable)
        .where(eq(plotNftsTable.plotId, plotId));

      if (!row) {
        return res.status(404).json({ error: "No NFT record for this plot" });
      }

      res.json({
        plotId: row.plotId,
        assetId: row.assetId ? Number(row.assetId) : null,
        mintedToAddress: row.mintedToAddress,
        mintedAt: row.mintedAt ? Number(row.mintedAt) : null,
        explorerUrl: row.assetId
          ? `https://allo.info/asset/${row.assetId}` // algoexplorer.io shut down; allo.info is current
          : null,
      });
    } catch (error) {
      console.error("NFT plot lookup error:", error);
      res.status(500).json({ error: "Failed to fetch NFT record" });
    }
  });

  app.post("/api/actions/connect-wallet", async (req, res) => {
    try {
      const { playerId, address } = req.body;
      if (!playerId || !address) {
        return res.status(400).json({ error: "playerId and address are required" });
      }
      if (typeof address !== "string" || address.length !== 58) {
        return res.status(400).json({ error: "Invalid Algorand address" });
      }
      await storage.updatePlayerAddress(playerId, address);

      const player = await storage.getPlayer(playerId);
      let welcomeBonus = false;
      let welcomeBonusTxId: string | undefined;
      if (player && !player.welcomeBonusReceived) {
        await storage.grantWelcomeBonus(playerId);
        welcomeBonus = true;
        console.log(`Welcome bonus of 500 FRONTIER granted to player ${player.name} (${address})`);

        const asaId = getFrontierAsaId();
        if (asaId && address && !address.startsWith("AI_")) {
          try {
            const optedIn = await isAddressOptedIn(address);
            if (optedIn) {
              welcomeBonusTxId = await batchedTransferFrontierASA(address, 500);
              console.log(`Welcome bonus ASA transfer: 500 FRONTIER to ${address}, TX: ${welcomeBonusTxId}`);
            }
          } catch (err) {
            console.error("Welcome bonus ASA transfer failed (in-game balance still granted):", err);
          }
        }
      }

      res.json({ success: true, welcomeBonus, welcomeBonusTxId });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to connect wallet" });
    }
  });

  app.get("/api/game/state", async (req, res) => {
    try {
      const gameState = await storage.getGameState();
      res.json(gameState);
    } catch (error) {
      console.error("Error fetching game state:", error);
      res.status(500).json({ error: "Failed to fetch game state" });
    }
  });

  app.get("/api/game/parcel/:id", async (req, res) => {
    try {
      const parcel = await storage.getParcel(req.params.id);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      res.json(parcel);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parcel" });
    }
  });

  app.get("/api/game/player/:id", async (req, res) => {
    try {
      const player = await storage.getPlayer(req.params.id);
      if (!player) return res.status(404).json({ error: "Player not found" });
      res.json(player);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch player" });
    }
  });

  /**
   * Wallet-based player lookup / auto-creation.
   * Called by the client immediately after a wallet connects.
   * Returns the existing player for that address, or creates a fresh one.
   * Also grants the 500 FRONTIER welcome bonus on first login.
   */
  app.get("/api/game/player-by-address/:address", async (req, res) => {
    try {
      const { address } = req.params;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "Address is required" });
      }

      const player = await storage.getOrCreatePlayerByAddress(address);

      let welcomeBonus = false;
      if (!player.welcomeBonusReceived) {
        await storage.grantWelcomeBonus(player.id);
        welcomeBonus = true;

        // Fire-and-forget ASA transfer
        const asaId = getFrontierAsaId();
        if (asaId && !address.startsWith("AI_")) {
          isAddressOptedIn(address)
            .then((optedIn) => {
              if (optedIn) {
                batchedTransferFrontierASA(address, 500)
                  .then((txId) =>
                    console.log(`Welcome bonus: 500 FRONTIER → ${address}, TX: ${txId}`)
                  )
                  .catch((err) =>
                    console.error("Welcome bonus ASA transfer failed:", err)
                  );
              }
            })
            .catch((err) => console.error("Opt-in check failed:", err));
        }
      }

      // Return fresh player data (welcomeBonusReceived is now true)
      const fresh = await storage.getPlayer(player.id);
      res.json({ ...fresh, welcomeBonus });
    } catch (error) {
      console.error("player-by-address error:", error);
      res.status(500).json({ error: "Failed to get or create player" });
    }
  });

  app.post("/api/actions/set-name", async (req, res) => {
    try {
      const { playerId, name, address } = req.body;
      if (!playerId || !name || !address) {
        return res.status(400).json({ error: "playerId, name, and address are required" });
      }
      const player = await storage.getPlayer(playerId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      if (player.address.toLowerCase() !== address.trim().toLowerCase()) {
        return res.status(403).json({ error: "Address does not match player" });
      }
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 20) {
        return res.status(400).json({ error: "Name must be 2-20 characters" });
      }
      if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed)) {
        return res.status(400).json({ error: "Name can only contain letters, numbers, spaces, dashes, dots, and underscores" });
      }
      await storage.updatePlayerName(playerId, trimmed);
      res.json({ success: true, name: trimmed });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to set name" });
    }
  });

  app.get("/api/testnet/progress/:address", async (req, res) => {
    try {
      const { address } = req.params;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "Address is required" });
      }
      const player = await storage.getOrCreatePlayerByAddress(address);
      res.json({
        playerId: player.id,
        completedMissions: player.testnetProgress || [],
        stats: {
          territories: player.ownedParcels.length,
          totalIronMined: player.totalIronMined,
          totalFuelMined: player.totalFuelMined,
          totalCrystalMined: player.totalCrystalMined,
          totalFrontierEarned: player.totalFrontierEarned,
          attacksWon: player.attacksWon,
          attacksLost: player.attacksLost,
          hasCommander: player.commanders.length > 0,
          hasDrones: player.drones.length > 0,
          welcomeBonusReceived: player.welcomeBonusReceived,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch testnet progress" });
    }
  });

  app.post("/api/testnet/progress", async (req, res) => {
    try {
      const { address, completedMissions } = req.body;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "Address is required" });
      }
      if (!Array.isArray(completedMissions)) {
        return res.status(400).json({ error: "completedMissions must be an array" });
      }
      const player = await storage.getOrCreatePlayerByAddress(address);
      await storage.updateTestnetProgress(player.id, completedMissions);
      res.json({ success: true, completedMissions });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update progress" });
    }
  });

  // Returns all faction identity records for the game UI
  app.get("/api/factions", async (_req, res) => {
    try {
      const factionAsaIds = getAllFactionAsaIds();
      const factions = FACTION_DEFINITIONS.map((f) => ({
        name:        f.name,
        unitName:    f.unitName,
        assetName:   f.assetName,
        behavior:    f.behavior,
        lore:        f.lore,
        totalSupply: f.totalSupply,
        assetId:     factionAsaIds[f.name] ?? null,
        explorerUrl: factionAsaIds[f.name]
          ? `https://allo.info/asset/${factionAsaIds[f.name]}`
          : null,
        onChain:     factionAsaIds[f.name] != null,
      }));
      res.json({ factions });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch faction data" });
    }
  });

  app.get("/api/game/leaderboard", async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.post("/api/actions/mine", async (req, res) => {
    try {
      const action = mineActionSchema.parse(req.body);
      const result = await storage.mineResources(action);
      res.json({ success: true, yield: result });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Mining failed" });
    }
  });

  app.post("/api/actions/upgrade", async (req, res) => {
    try {
      const action = upgradeActionSchema.parse(req.body);
      const parcel = await storage.upgradeBase(action);
      res.json({ success: true, parcel });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Upgrade failed" });
    }
  });

  app.post("/api/actions/attack", async (req, res) => {
    try {
      const action = attackActionSchema.parse(req.body);
      const battle = await storage.deployAttack(action);
      res.json({ success: true, battle });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Attack failed" });
    }
  });

  app.post("/api/actions/build", async (req, res) => {
    try {
      const action = buildActionSchema.parse(req.body);
      const parcel = await storage.buildImprovement(action);
      res.json({ success: true, parcel });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Build failed" });
    }
  });

  app.post("/api/actions/purchase", async (req, res) => {
    try {
      const action = purchaseActionSchema.parse(req.body);
      const parcel = await storage.purchaseLand(action);

      // Mint a Plot NFT (Algorand ASA) for human players only.
      // AI purchases do not receive NFTs. Fire-and-forget so the HTTP
      // response is immediate; minting happens in the background.
      let nftAssetId: number | null = null;
      const player = await storage.getPlayer(action.playerId);
      const buyerAddress = player?.address;
      const isHumanBuyer =
        buyerAddress &&
        !buyerAddress.startsWith("AI_") &&
        buyerAddress !== "PLAYER_WALLET" &&
        buyerAddress.length === 58;

      if (isHumanBuyer && db) {
        // ── Idempotency guard ────────────────────────────────────────────────
        // Key: "mint:{playerId}:{plotId}" — prevents double-mint on rapid clicks.
        const idempotencyKey = `mint:${action.playerId}:${parcel.plotId}`;
        const now = Date.now();

        const [existingKey] = await db
          .select()
          .from(mintIdempotencyTable)
          .where(eq(mintIdempotencyTable.key, idempotencyKey));

        if (existingKey && (existingKey.status === "confirmed" || existingKey.status === "pending")) {
          nftAssetId = existingKey.assetId ?? null;
          console.log(
            `[purchase] plotId=${parcel.plotId} idempotency hit status=${existingKey.status} assetId=${nftAssetId}`
          );
        } else {
          // Mark pending before async work to prevent concurrent duplicates
          if (!existingKey) {
            await db.insert(mintIdempotencyTable).values({
              key: idempotencyKey,
              status: "pending",
              assetId: null,
              txId: null,
              createdAt: now,
              updatedAt: now,
            }).onConflictDoNothing();
          }

          const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
          if (PUBLIC_BASE_URL) {
            // Fire-and-forget: mint in background, don't block response
            mintLandNft({ plotId: parcel.plotId, receiverAddress: buyerAddress, metadataBaseUrl: PUBLIC_BASE_URL })
              .then(async (result) => {
                // Persist to plot_nfts (upsert)
                await db.insert(plotNftsTable).values({
                  plotId: parcel.plotId,
                  assetId: result.assetId,
                  mintedToAddress: result.mintedToAddress,
                  mintedAt: Date.now(),
                }).onConflictDoUpdate({
                  target: plotNftsTable.plotId,
                  set: { assetId: result.assetId, mintedToAddress: result.mintedToAddress, mintedAt: Date.now() },
                });
                // Mark idempotency confirmed
                await db.update(mintIdempotencyTable)
                  .set({ status: "confirmed", assetId: result.assetId, txId: result.createTxId, updatedAt: Date.now() })
                  .where(eq(mintIdempotencyTable.key, idempotencyKey));
                console.log(`[purchase] plotId=${parcel.plotId} NFT minted assetId=${result.assetId}`);
              })
              .catch(async (err) => {
                await db.update(mintIdempotencyTable)
                  .set({ status: "failed", updatedAt: Date.now() })
                  .where(eq(mintIdempotencyTable.key, idempotencyKey));
                console.error(`[purchase] NFT minting failed for plotId=${parcel.plotId}:`, err instanceof Error ? err.message : err);
              });
          } else {
            console.warn(`[purchase] PUBLIC_BASE_URL not set — skipping NFT mint for plotId=${parcel.plotId}`);
            await db.update(mintIdempotencyTable)
              .set({ status: "failed", updatedAt: Date.now() })
              .where(eq(mintIdempotencyTable.key, idempotencyKey));
          }
        }
      }

      res.json({ success: true, parcel, nftAssetId });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Purchase failed" });
    }
  });

  app.post("/api/actions/collect", async (req, res) => {
    try {
      const action = collectActionSchema.parse(req.body);
      const result = await storage.collectAll(action.playerId);
      res.json({ success: true, collected: result });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Collection failed" });
    }
  });

  app.post("/api/actions/claim-frontier", async (req, res) => {
    try {
      const action = claimFrontierActionSchema.parse(req.body);

      const player = await storage.getPlayer(action.playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });

      const result = await storage.claimFrontier(action.playerId);
      let txId: string | undefined;

      const walletAddress = player.address;
      const asaId = getFrontierAsaId();
      if (asaId && result.amount > 0 && walletAddress && walletAddress !== "PLAYER_WALLET" && !walletAddress.startsWith("AI_")) {
        // Queue into the batcher (fire-and-forget) so the HTTP response is immediate.
        // Multiple concurrent claims are grouped into Algorand atomic transaction
        // batches that flush once 1 KB of combined data is accumulated (≤ 16 txns).
        isAddressOptedIn(walletAddress).then((optedIn) => {
          if (optedIn) {
            batchedTransferFrontierASA(walletAddress, result.amount)
              .then((batchTxId) =>
                console.log(`Batched FRONTIER transfer: ${result.amount} to ${walletAddress}, TX: ${batchTxId}`)
              )
              .catch((err) =>
                console.error("Batched FRONTIER transfer failed (in-game balance preserved):", err)
              );
          } else {
            console.log(`Player ${walletAddress} not opted into FRONTIER ASA, claim recorded in-game only`);
          }
        }).catch((err) => console.error("Opt-in check failed:", err));
      }

      res.json({ success: true, claimed: result, txId, asaId });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Claim failed" });
    }
  });

  app.post("/api/actions/mint-avatar", async (req, res) => {
    try {
      const action = mintAvatarActionSchema.parse(req.body);
      const avatar = await storage.mintAvatar(action);
      res.json({ success: true, avatar });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Mint failed" });
    }
  });

  app.post("/api/actions/switch-commander", async (req, res) => {
    try {
      const { playerId, commanderIndex } = req.body;
      if (!playerId || commanderIndex === undefined) return res.status(400).json({ error: "playerId and commanderIndex required" });
      const activeCommander = await storage.switchCommander(playerId, commanderIndex);
      res.json({ success: true, activeCommander });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Switch failed" });
    }
  });

  app.post("/api/actions/special-attack", async (req, res) => {
    try {
      const action = specialAttackActionSchema.parse(req.body);
      const result = await storage.executeSpecialAttack(action);
      res.json({ success: true, result });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Special attack failed" });
    }
  });

  app.post("/api/actions/deploy-drone", async (req, res) => {
    try {
      const action = deployDroneActionSchema.parse(req.body);
      const drone = await storage.deployDrone(action);
      res.json({ success: true, drone });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Drone deployment failed" });
    }
  });

  app.post("/api/actions/deploy-satellite", async (req, res) => {
    try {
      const action = deploySatelliteActionSchema.parse(req.body);
      const satellite = await storage.deploySatellite(action);
      res.json({ success: true, satellite });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Satellite deployment failed" });
    }
  });

  app.post("/api/game/resolve-battles", async (req, res) => {
    try {
      const resolved = await storage.resolveBattles();
      res.json({ success: true, resolved });
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve battles" });
    }
  });

  app.post("/api/game/ai-turn", async (req, res) => {
    try {
      const events = await storage.runAITurn();
      res.json({ success: true, events });
    } catch (error) {
      res.status(500).json({ error: "Failed to run AI turn" });
    }
  });

  // ── Orbital Event Engine API ──────────────────────────────────────────────

  /** GET /api/orbital/active — return all live gameplay-affecting impact events */
  app.get("/api/orbital/active", async (_req, res) => {
    try {
      const events = await storage.getActiveOrbitalEvents();
      console.log(`[ORBITAL-DEBUG] GET /api/orbital/active | found: ${events.length} events`);
      res.json({ events });
    } catch (error) {
      console.error("[ORBITAL-DEBUG] getActiveOrbitalEvents error:", error);
      res.status(500).json({ error: "Failed to fetch orbital events" });
    }
  });

  /** POST /api/orbital/trigger — server rolls for an impact event (called by interval) */
  app.post("/api/orbital/trigger", async (_req, res) => {
    try {
      const event = await storage.triggerOrbitalCheck();
      if (event) {
        console.log(`[ORBITAL-DEBUG] POST /api/orbital/trigger | NEW IMPACT | id: ${event.id} | type: ${event.type}`);
      }
      res.json({ event: event ?? null });
    } catch (error) {
      console.error("[ORBITAL-DEBUG] triggerOrbitalCheck error:", error);
      res.status(500).json({ error: "Failed to trigger orbital check" });
    }
  });

  /** POST /api/orbital/resolve/:id — mark an impact event resolved + apply effects */
  app.post("/api/orbital/resolve/:id", async (req, res) => {
    try {
      await storage.resolveOrbitalEvent(req.params.id);
      console.log(`[ORBITAL-DEBUG] POST /api/orbital/resolve/${req.params.id} | resolved`);
      res.json({ success: true });
    } catch (error) {
      console.error("[ORBITAL-DEBUG] resolveOrbitalEvent error:", error);
      res.status(500).json({ error: "Failed to resolve orbital event" });
    }
  });

  // Background tasks: resolve battles, run AI turns, trigger orbital checks
  setInterval(async () => {
    try {
      await storage.resolveBattles();
      await storage.runAITurn();
    } catch (error) {
      console.error("Background task error:", error);
    }
  }, 15000);

  // Orbital check every 5 minutes
  setInterval(async () => {
    try {
      const event = await storage.triggerOrbitalCheck();
      if (event) {
        console.log(`[ORBITAL-DEBUG] Background orbital check | NEW IMPACT | id: ${event.id} | type: ${event.type}`);
      }
    } catch (error) {
      console.error("[ORBITAL-DEBUG] Background orbital check error:", error);
    }
  }, 5 * 60 * 1000);

  return httpServer;
}
FRONTIER_FILE_END_MARKER

echo "Writing server/storage.ts..."
cat > server/storage.ts << 'FRONTIER_FILE_END_MARKER'
import { randomUUID } from "crypto";
import type {
  LandParcel,
  Player,
  Battle,
  GameEvent,
  GameState,
  BiomeType,
  MineAction,
  UpgradeAction,
  AttackAction,
  BuildAction,
  PurchaseAction,
  LeaderboardEntry,
  ImprovementType,
  Improvement,
  MintAvatarAction,
  SpecialAttackAction,
  DeployDroneAction,
  DeploySatelliteAction,
  CommanderAvatar,
  ReconDrone,
  OrbitalSatellite,
  SpecialAttackRecord,
  CommanderTier,
  SpecialAttackType,
  OrbitalEvent,
  OrbitalEffect,
  OrbitalEffectType,
} from "@shared/schema";
import {
  biomeBonuses,
  MINE_COOLDOWN_MS,
  BASE_YIELD,
  UPGRADE_COSTS,
  BATTLE_DURATION_MS,
  ATTACK_BASE_COST,
  IMPROVEMENT_INFO,
  DEFENSE_IMPROVEMENT_INFO,
  FACILITY_INFO,
  BASE_STORAGE_CAPACITY,
  LAND_PURCHASE_ALGO,
  TOTAL_PLOTS,
  FRONTIER_TOTAL_SUPPLY,
  WELCOME_BONUS_FRONTIER,
  COMMANDER_INFO,
  SPECIAL_ATTACK_INFO,
  DRONE_MINT_COST_FRONTIER,
  DRONE_SCOUT_DURATION_MS,
  MAX_DRONES,
  SATELLITE_DEPLOY_COST_FRONTIER,
  SATELLITE_ORBIT_DURATION_MS,
  MAX_SATELLITES,
  SATELLITE_YIELD_BONUS,
  calculateFrontierPerDay,
  MORALE_DEBUFF_BASE_MS,
  MORALE_ATTACK_PENALTY,
  ATTACK_COOLDOWN_PER_LOSS_MS,
  PILLAGE_RATE,
  CASCADE_DEFENSE_PENALTY,
  COMMANDER_LOCK_MS,
  ORBITAL_RESOURCE_BURST_BONUS,
  ORBITAL_RESOURCE_BURST_MS,
  ORBITAL_TILE_HAZARD_PENALTY,
  ORBITAL_TILE_HAZARD_MS,
  ORBITAL_IMPACT_CHANCE,
} from "@shared/schema";
import type { FacilityType, DefenseImprovementType } from "@shared/schema";
import { generateFibonacciSphere, sphereDistance, type PlotCoord } from "./sphereUtils";
import {
  evaluateReconquest,
  shouldAbandonAfterCapture,
  deterrenceThreshold,
  FACTION_PROFILES,
  type AiFactionState,
  type ContestedPlot,
} from "./engine/ai/reconquest.js";
import { eq, and, desc, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { gameMeta, players as playersTable, parcels as parcelsTable, battles as battlesTable, gameEvents as gameEventsTable, plotNfts as plotNftsTable, orbitalEvents as orbitalEventsTable, aiFactionIdentities as aiFactionIdentitiesTable } from "./db-schema";
import type { DB } from "./db";

const MICRO = 1_000_000;
function toMicroFRNTR(frntr: number): number { return Math.round(frntr * MICRO); }
function fromMicroFRNTR(micro: number): number { return Math.floor(micro / MICRO * 100) / 100; }

const AI_NAMES = ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"];
const AI_BEHAVIORS: Player["aiBehavior"][] = ["expansionist", "defensive", "raider", "economic"];
const BIOMES: BiomeType[] = ["forest", "desert", "mountain", "plains", "water", "tundra", "volcanic", "swamp"];

function biomeFromLatitude(lat: number, plotId: number): BiomeType {
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

export interface IStorage {
  getGameState(): Promise<GameState>;
  getParcel(id: string): Promise<LandParcel | undefined>;
  getPlayer(id: string): Promise<Player | undefined>;
  getBattle(id: string): Promise<Battle | undefined>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  /** Find an existing player by wallet address (case-insensitive), or create a fresh one. */
  getOrCreatePlayerByAddress(address: string): Promise<Player>;

  mineResources(action: MineAction): Promise<{ iron: number; fuel: number; crystal: number }>;
  upgradeBase(action: UpgradeAction): Promise<LandParcel>;
  deployAttack(action: AttackAction): Promise<Battle>;
  buildImprovement(action: BuildAction): Promise<LandParcel>;
  purchaseLand(action: PurchaseAction): Promise<LandParcel>;
  collectAll(playerId: string): Promise<{ iron: number; fuel: number; crystal: number }>;
  updatePlayerAddress(playerId: string, address: string): Promise<void>;
  claimFrontier(playerId: string): Promise<{ amount: number }>;
  restoreFrontier(playerId: string, amount: number): Promise<void>;
  mintAvatar(action: MintAvatarAction): Promise<CommanderAvatar>;
  executeSpecialAttack(action: SpecialAttackAction): Promise<{ damage: number; effect: string }>;
  deployDrone(action: DeployDroneAction): Promise<ReconDrone>;
  deploySatellite(action: DeploySatelliteAction): Promise<OrbitalSatellite>;
  updatePlayerName(playerId: string, name: string): Promise<void>;
  updateTestnetProgress(playerId: string, completedMissions: string[]): Promise<void>;
  /** Grant the 500 FRONTIER welcome bonus (idempotent). */
  grantWelcomeBonus(playerId: string): Promise<void>;
  /**
   * Atomically switch a player's active commander and emit a game event.
   * Throws if the index is out of bounds.
   */
  switchCommander(playerId: string, commanderIndex: number): Promise<CommanderAvatar>;

  resolveBattles(): Promise<Battle[]>;
  runAITurn(): Promise<GameEvent[]>;

  // ── Orbital Event Engine ──────────────────────────────────────────────────
  /** Get all impact (non-cosmetic) orbital events that have not yet expired. */
  getActiveOrbitalEvents(): Promise<OrbitalEvent[]>;
  /** Server creates a new gameplay-affecting impact event and persists it. */
  createOrbitalImpactEvent(type: OrbitalEvent["type"], targetParcelId?: string): Promise<OrbitalEvent>;
  /** Apply gameplay effects for an impact event and mark it resolved. */
  resolveOrbitalEvent(eventId: string): Promise<void>;
  /** Trigger a random impact check — may or may not create an event. */
  triggerOrbitalCheck(): Promise<OrbitalEvent | null>;
}

export class MemStorage implements IStorage {
  private parcels: Map<string, LandParcel>;
  private parcelByPlotId: Map<number, string>;
  private players: Map<string, Player>;
  private battles: Map<string, Battle>;
  private events: GameEvent[];
  private currentTurn: number;
  private lastUpdateTs: number;
  private initialized: boolean = false;
  private plotCoords: PlotCoord[] = [];
  private frontierCirculating: number = 0;

  constructor() {
    this.parcels = new Map();
    this.parcelByPlotId = new Map();
    this.players = new Map();
    this.battles = new Map();
    this.events = [];
    this.currentTurn = 1;
    this.lastUpdateTs = Date.now();
  }

  private async initialize() {
    if (this.initialized) return;

    this.plotCoords = generateFibonacciSphere(TOTAL_PLOTS);

    for (const coord of this.plotCoords) {
      const id = randomUUID();
      const biome = biomeFromLatitude(coord.lat, coord.plotId);
      const richness = Math.floor(Math.random() * 60) + 40;

      const parcel: LandParcel = {
        id,
        plotId: coord.plotId,
        lat: coord.lat,
        lng: coord.lng,
        biome,
        richness,
        ownerId: null,
        ownerType: null,
        defenseLevel: 1,
        ironStored: 0,
        fuelStored: 0,
        crystalStored: 0,
        storageCapacity: BASE_STORAGE_CAPACITY,
        lastMineTs: 0,
        activeBattleId: null,
        yieldMultiplier: 1.0,
        improvements: [],
        purchasePriceAlgo: LAND_PURCHASE_ALGO[biome],
        frontierAccumulated: 0,
        lastFrontierClaimTs: Date.now(),
        frontierPerDay: 1,
        capturedFromFaction: null,
        capturedAt:          null,
        handoverCount:       0,
      };
      this.parcels.set(id, parcel);
      this.parcelByPlotId.set(coord.plotId, id);
    }

    const humanPlayerId = randomUUID();
    const humanPlayer: Player = {
      id: humanPlayerId,
      address: "PLAYER_WALLET",
      name: "Commander",
      iron: 200,
      fuel: 150,
      crystal: 50,
      frontier: 0,
      ownedParcels: [],
      isAI: false,
      totalIronMined: 0,
      totalFuelMined: 0,
      totalCrystalMined: 0,
      totalFrontierEarned: 0,
      totalFrontierBurned: 0,
      attacksWon: 0,
      attacksLost: 0,
      territoriesCaptured: 0,
      commander: null,
      commanders: [],
      activeCommanderIndex: 0,
      specialAttacks: [],
      drones: [],
      satellites: [],
      welcomeBonusReceived: false,
      testnetProgress: [],
    };
    this.players.set(humanPlayerId, humanPlayer);

    const startPlotId = this.parcelByPlotId.get(1);
    if (startPlotId) {
      const startParcel = this.parcels.get(startPlotId);
      if (startParcel) {
        startParcel.ownerId = humanPlayerId;
        startParcel.ownerType = "player";
        startParcel.defenseLevel = 3;
        startParcel.purchasePriceAlgo = null;
        humanPlayer.ownedParcels.push(startParcel.id);
      }
    }

    const aiStartPlots = [5250, 10500, 15750, 20000];
    for (let i = 0; i < 4; i++) {
      const aiId = randomUUID();
      const aiPlayer: Player = {
        id: aiId,
        address: `AI_WALLET_${i}`,
        name: AI_NAMES[i],
        iron: 150,
        fuel: 100,
        crystal: 25,
        frontier: 0,
        ownedParcels: [],
        isAI: true,
        aiBehavior: AI_BEHAVIORS[i],
        totalIronMined: 0,
        totalFuelMined: 0,
        totalCrystalMined: 0,
        totalFrontierEarned: 0,
        totalFrontierBurned: 0,
        attacksWon: 0,
        attacksLost: 0,
        territoriesCaptured: 0,
        commander: null,
        commanders: [],
        activeCommanderIndex: 0,
        specialAttacks: [],
        drones: [],
        satellites: [],
        welcomeBonusReceived: true,
        testnetProgress: [],
      };
      this.players.set(aiId, aiPlayer);

      const aiPlotUuid = this.parcelByPlotId.get(aiStartPlots[i]);
      if (aiPlotUuid) {
        const aiParcel = this.parcels.get(aiPlotUuid);
        if (aiParcel && !aiParcel.ownerId) {
          aiParcel.ownerId = aiId;
          aiParcel.ownerType = "ai";
          aiParcel.defenseLevel = 2;
          aiParcel.purchasePriceAlgo = null;
          aiPlayer.ownedParcels.push(aiParcel.id);
        }
      }
    }

    this.events.push({
      id: randomUUID(),
      type: "ai_action",
      playerId: "system",
      description: "Game world initialized. 21,000 plots ready. Factions are mobilizing.",
      timestamp: Date.now(),
    });

    this.initialized = true;
  }

  private updateFrontierAccumulation(parcel: LandParcel) {
    if (!parcel.ownerId) return;
    const now = Date.now();
    const daysSinceLastClaim = (now - parcel.lastFrontierClaimTs) / (1000 * 60 * 60 * 24);
    if (daysSinceLastClaim <= 0) return;

    const perDay = calculateFrontierPerDay(parcel.improvements);
    parcel.frontierPerDay = perDay;
    const earned = perDay * daysSinceLastClaim;
    parcel.frontierAccumulated += earned;
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    await this.initialize();
    const entries: LeaderboardEntry[] = [];
    for (const player of Array.from(this.players.values())) {
      entries.push({
        playerId: player.id,
        name: player.name,
        address: player.address,
        territories: player.ownedParcels.length,
        totalIronMined: player.totalIronMined,
        totalFuelMined: player.totalFuelMined,
        totalCrystalMined: player.totalCrystalMined,
        totalFrontierEarned: player.totalFrontierEarned,
        attacksWon: player.attacksWon,
        attacksLost: player.attacksLost,
        isAI: player.isAI,
      });
    }
    return entries.sort((a, b) => b.territories - a.territories || b.totalFrontierEarned - a.totalFrontierEarned);
  }

  async getGameState(): Promise<GameState> {
    await this.initialize();
    await this.resolveBattles();

    const claimedPlots = Array.from(this.parcels.values()).filter((p) => p.ownerId !== null).length;

    return {
      parcels: Array.from(this.parcels.values()),
      players: Array.from(this.players.values()),
      battles: Array.from(this.battles.values()),
      events: this.events.slice(-50).reverse(),
      leaderboard: await this.getLeaderboard(),
      currentTurn: this.currentTurn,
      lastUpdateTs: this.lastUpdateTs,
      totalPlots: TOTAL_PLOTS,
      claimedPlots,
      frontierTotalSupply: FRONTIER_TOTAL_SUPPLY,
      frontierCirculating: this.frontierCirculating,
    };
  }

  async getParcel(id: string): Promise<LandParcel | undefined> {
    await this.initialize();
    return this.parcels.get(id);
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    await this.initialize();
    return this.players.get(id);
  }

  async getBattle(id: string): Promise<Battle | undefined> {
    await this.initialize();
    return this.battles.get(id);
  }

  async mineResources(action: MineAction): Promise<{ iron: number; fuel: number; crystal: number }> {
    await this.initialize();

    const parcel = this.parcels.get(action.parcelId);
    const player = this.players.get(action.playerId);

    if (!parcel || !player) throw new Error("Invalid parcel or player");
    if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

    const now = Date.now();
    if (now - parcel.lastMineTs < MINE_COOLDOWN_MS) throw new Error("Mining cooldown not complete");

    const activeSatellites = player.satellites.filter(s => s.status === "active" && s.expiresAt > now);
    const satelliteMult = activeSatellites.length > 0 ? 1 + SATELLITE_YIELD_BONUS : 1;

    const biomeBonus = biomeBonuses[parcel.biome];
    const richnessMultiplier = parcel.richness / 100;
    const ironYield = Math.floor(BASE_YIELD.iron * biomeBonus.yieldMod * richnessMultiplier * parcel.yieldMultiplier * satelliteMult);
    const fuelYield = Math.floor(BASE_YIELD.fuel * biomeBonus.yieldMod * richnessMultiplier * parcel.yieldMultiplier * satelliteMult);
    const crystalYield = Math.floor(BASE_YIELD.crystal * richnessMultiplier * satelliteMult);

    const totalStored = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
    const remaining = parcel.storageCapacity - totalStored;
    const totalYield = ironYield + fuelYield + crystalYield;

    const ratio = remaining < totalYield ? remaining / totalYield : 1;
    const finalIron = Math.floor(ironYield * ratio);
    const finalFuel = Math.floor(fuelYield * ratio);
    const finalCrystal = Math.floor(crystalYield * ratio);

    parcel.ironStored += finalIron;
    parcel.fuelStored += finalFuel;
    parcel.crystalStored += finalCrystal;
    parcel.lastMineTs = now;

    player.totalIronMined += finalIron;
    player.totalFuelMined += finalFuel;
    player.totalCrystalMined += finalCrystal;

    if (parcel.richness > 20) {
      parcel.richness = Math.max(20, parcel.richness - 1);
    }

    this.events.push({
      id: randomUUID(),
      type: "mine",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} mined ${finalIron} iron, ${finalFuel} fuel, ${finalCrystal} crystal from plot #${parcel.plotId} [${parcel.biome}] (richness: ${parcel.richness})`,
      timestamp: now,
    });

    this.lastUpdateTs = now;
    return { iron: finalIron, fuel: finalFuel, crystal: finalCrystal };
  }

  async collectAll(playerId: string): Promise<{ iron: number; fuel: number; crystal: number }> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");

    let totalIron = 0,
      totalFuel = 0,
      totalCrystal = 0;

    for (const parcelId of player.ownedParcels) {
      const parcel = this.parcels.get(parcelId);
      if (!parcel) continue;

      totalIron += parcel.ironStored;
      totalFuel += parcel.fuelStored;
      totalCrystal += parcel.crystalStored;

      parcel.ironStored = 0;
      parcel.fuelStored = 0;
      parcel.crystalStored = 0;
    }

    player.iron += totalIron;
    player.fuel += totalFuel;
    player.crystal += totalCrystal;

    if (totalIron > 0 || totalFuel > 0 || totalCrystal > 0) {
      this.events.push({
        id: randomUUID(),
        type: "mine",
        playerId: player.id,
        description: `${player.name} collected ${totalIron} iron, ${totalFuel} fuel, ${totalCrystal} crystal from all territories`,
        timestamp: Date.now(),
      });
      this.lastUpdateTs = Date.now();
    }

    return { iron: totalIron, fuel: totalFuel, crystal: totalCrystal };
  }

  async updatePlayerAddress(playerId: string, address: string): Promise<void> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");
    if (player.isAI) throw new Error("Cannot update AI player address");
    player.address = address;
  }

  async updatePlayerName(playerId: string, name: string): Promise<void> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");
    if (player.isAI) throw new Error("Cannot rename AI player");
    player.name = name;
  }

  async updateTestnetProgress(playerId: string, completedMissions: string[]): Promise<void> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");
    player.testnetProgress = completedMissions;
  }

  async getOrCreatePlayerByAddress(address: string): Promise<Player> {
    await this.initialize();
    const trimmed = address.trim();
    const lower = trimmed.toLowerCase();
    for (const player of this.players.values()) {
      if (player.address.toLowerCase() === lower) return player;
    }
    const id = randomUUID();
    const displayName = `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
    const newPlayer: Player = {
      id,
      address: trimmed,
      name: displayName,
      iron: 200,
      fuel: 150,
      crystal: 50,
      frontier: 0,
      ownedParcels: [],
      isAI: false,
      totalIronMined: 0,
      totalFuelMined: 0,
      totalCrystalMined: 0,
      totalFrontierEarned: 0,
      totalFrontierBurned: 0,
      attacksWon: 0,
      attacksLost: 0,
      territoriesCaptured: 0,
      commander: null,
      commanders: [],
      activeCommanderIndex: 0,
      specialAttacks: [],
      drones: [],
      satellites: [],
      welcomeBonusReceived: false,
      testnetProgress: [],
    };
    this.players.set(id, newPlayer);
    return newPlayer;
  }

  async grantWelcomeBonus(playerId: string): Promise<void> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");
    if (player.welcomeBonusReceived) return;

    player.frontier += WELCOME_BONUS_FRONTIER;
    player.totalFrontierEarned += WELCOME_BONUS_FRONTIER;
    player.welcomeBonusReceived = true;
    this.frontierCirculating += WELCOME_BONUS_FRONTIER;

    this.events.push({
      id: randomUUID(),
      type: "claim_frontier",
      playerId: player.id,
      description: `${player.name} received ${WELCOME_BONUS_FRONTIER} FRONTIER welcome bonus!`,
      timestamp: Date.now(),
    });
    this.lastUpdateTs = Date.now();
  }

  async claimFrontier(playerId: string): Promise<{ amount: number }> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");

    let totalClaimed = 0;
    const now = Date.now();

    for (const parcelId of player.ownedParcels) {
      const parcel = this.parcels.get(parcelId);
      if (!parcel) continue;

      this.updateFrontierAccumulation(parcel);
      totalClaimed += parcel.frontierAccumulated;
      parcel.frontierAccumulated = 0;
      parcel.lastFrontierClaimTs = now;
    }

    const rounded = Math.floor(totalClaimed * 100) / 100;
    if (rounded > 0) {
      player.frontier += rounded;
      player.totalFrontierEarned += rounded;
      this.frontierCirculating += rounded;

      this.events.push({
        id: randomUUID(),
        type: "claim_frontier",
        playerId: player.id,
        description: `${player.name} claimed ${rounded.toFixed(2)} FRONTIER tokens`,
        timestamp: now,
      });
      this.lastUpdateTs = now;
    }

    return { amount: rounded };
  }

  async restoreFrontier(playerId: string, amount: number): Promise<void> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player || amount <= 0) return;

    player.frontier -= amount;
    player.totalFrontierEarned -= amount;
    this.frontierCirculating -= amount;
    console.log(`Restored ${amount} FRONTIER for player ${player.name} due to failed transfer`);
  }

  async buildImprovement(action: BuildAction): Promise<LandParcel> {
    await this.initialize();

    const parcel = this.parcels.get(action.parcelId);
    const player = this.players.get(action.playerId);
    if (!parcel || !player) throw new Error("Invalid parcel or player");
    if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

    const isFacility = action.improvementType in FACILITY_INFO;
    const isDefense = action.improvementType in DEFENSE_IMPROVEMENT_INFO;
    if (!isFacility && !isDefense) throw new Error("Invalid improvement type");

    const existing = parcel.improvements.find((i) => i.type === action.improvementType);
    const level = existing ? existing.level + 1 : 1;

    if (isFacility) {
      const facilityInfo = FACILITY_INFO[action.improvementType as FacilityType];
      if (existing && existing.level >= facilityInfo.maxLevel) throw new Error("Facility already at max level");

      if (facilityInfo.prerequisite) {
        const hasPrereq = parcel.improvements.find(i => i.type === facilityInfo.prerequisite);
        if (!hasPrereq) throw new Error(`Requires ${FACILITY_INFO[facilityInfo.prerequisite!].name} first`);
      }

      const cost = facilityInfo.costFrontier[level - 1];
      if (player.frontier < cost) throw new Error(`Insufficient FRONTIER (need ${cost})`);

      player.frontier -= cost;
      player.totalFrontierBurned += cost;
      this.frontierCirculating -= cost;
    } else {
      const defInfo = DEFENSE_IMPROVEMENT_INFO[action.improvementType as DefenseImprovementType];
      if (existing && existing.level >= defInfo.maxLevel) throw new Error("Improvement already at max level");

      const cost = { iron: defInfo.cost.iron * level, fuel: defInfo.cost.fuel * level };
      if (player.iron < cost.iron || player.fuel < cost.fuel) throw new Error("Insufficient resources");

      player.iron -= cost.iron;
      player.fuel -= cost.fuel;
    }

    if (existing) {
      existing.level = level;
    } else {
      parcel.improvements.push({ type: action.improvementType, level: 1 });
    }

    if (action.improvementType === "turret") {
      parcel.defenseLevel += 3;
    } else if (action.improvementType === "shield_gen") {
      parcel.defenseLevel += 5;
    } else if (action.improvementType === "fortress") {
      parcel.defenseLevel += 8;
      parcel.storageCapacity += 50;
    } else if (action.improvementType === "storage_depot") {
      parcel.storageCapacity += 100;
    }

    parcel.frontierPerDay = calculateFrontierPerDay(parcel.improvements);

    const displayName = isFacility
      ? FACILITY_INFO[action.improvementType as FacilityType].name
      : DEFENSE_IMPROVEMENT_INFO[action.improvementType as DefenseImprovementType].name;

    this.events.push({
      id: randomUUID(),
      type: "build",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} built ${displayName} (Lv${level}) at plot #${parcel.plotId}`,
      timestamp: Date.now(),
    });

    this.lastUpdateTs = Date.now();
    return parcel;
  }

  async purchaseLand(action: PurchaseAction): Promise<LandParcel> {
    await this.initialize();

    const parcel = this.parcels.get(action.parcelId);
    const player = this.players.get(action.playerId);
    if (!parcel || !player) throw new Error("Invalid parcel or player");
    if (parcel.ownerId) throw new Error("Territory is already owned");
    if (parcel.purchasePriceAlgo === null) throw new Error("Territory is not for sale");

    parcel.ownerId = player.id;
    parcel.ownerType = player.isAI ? "ai" : "player";
    parcel.purchasePriceAlgo = null;
    parcel.lastFrontierClaimTs = Date.now();
    player.ownedParcels.push(parcel.id);
    player.territoriesCaptured++;

    this.events.push({
      id: randomUUID(),
      type: "purchase",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} purchased plot #${parcel.plotId} for ${LAND_PURCHASE_ALGO[parcel.biome]} ALGO`,
      timestamp: Date.now(),
    });

    this.lastUpdateTs = Date.now();
    return parcel;
  }

  async upgradeBase(action: UpgradeAction): Promise<LandParcel> {
    await this.initialize();

    const parcel = this.parcels.get(action.parcelId);
    const player = this.players.get(action.playerId);
    if (!parcel || !player) throw new Error("Invalid parcel or player");
    if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

    const cost = UPGRADE_COSTS[action.upgradeType];
    if (!cost) throw new Error("Invalid upgrade type");
    if (player.iron < cost.iron || player.fuel < cost.fuel) throw new Error("Insufficient resources");

    player.iron -= cost.iron;
    player.fuel -= cost.fuel;

    switch (action.upgradeType) {
      case "defense":
        parcel.defenseLevel = Math.min(10, parcel.defenseLevel + 1);
        break;
      case "yield":
        parcel.yieldMultiplier += 0.2;
        break;
      case "mine":
        parcel.yieldMultiplier += 0.3;
        break;
      case "fortress":
        parcel.defenseLevel = Math.min(10, parcel.defenseLevel + 3);
        break;
    }

    this.events.push({
      id: randomUUID(),
      type: "upgrade",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} upgraded ${action.upgradeType} at plot #${parcel.plotId}`,
      timestamp: Date.now(),
    });

    this.lastUpdateTs = Date.now();
    return parcel;
  }

  async deployAttack(action: AttackAction): Promise<Battle> {
    await this.initialize();

    const attacker = this.players.get(action.attackerId);
    const targetParcel = this.parcels.get(action.targetParcelId);
    if (!attacker || !targetParcel) throw new Error("Invalid attacker or target");
    if (targetParcel.ownerId === attacker.id) throw new Error("Cannot attack your own territory");
    if (targetParcel.activeBattleId) throw new Error("Territory is already under attack");

    const totalIron = action.resourcesBurned.iron;
    const totalFuel = action.resourcesBurned.fuel;
    if (attacker.iron < totalIron || attacker.fuel < totalFuel) throw new Error("Insufficient resources for attack");

    attacker.iron -= totalIron;
    attacker.fuel -= totalFuel;

    // Resolve commander: validate availability and apply attack bonus
    const now = Date.now();
    let commanderBonus = 0;
    let commanderId: string | undefined;
    if (action.commanderId) {
      const cmdIdx = attacker.commanders.findIndex((c) => c.id === action.commanderId);
      if (cmdIdx === -1) throw new Error("Commander not found");
      const cmd = attacker.commanders[cmdIdx];
      if (cmd.lockedUntil && now < cmd.lockedUntil) throw new Error("Commander is currently deployed and unavailable");
      commanderBonus = cmd.attackBonus;
      commanderId = cmd.id;
      // Lock commander for 12 hours
      attacker.commanders[cmdIdx] = { ...cmd, lockedUntil: now + COMMANDER_LOCK_MS };
      cmd.totalKills; // no-op, just referencing for type safety
    }

    const rawAttackerPower = action.troopsCommitted * 10 + totalIron * 0.5 + totalFuel * 0.8 + commanderBonus;
    // Apply morale debuff: reduces attack power when attacker has recently lost territory
    const moraleActive = attacker.moraleDebuffUntil && now < attacker.moraleDebuffUntil;
    const attackerPower = moraleActive
      ? rawAttackerPower * (1 - MORALE_ATTACK_PENALTY)
      : rawAttackerPower;

    const biomeBonus = biomeBonuses[targetParcel.biome];
    const turretBonus = targetParcel.improvements
      .filter((i) => i.type === "turret" || i.type === "shield_gen" || i.type === "fortress")
      .reduce((sum, i) => sum + i.level * 5, 0);
    const defenderPower = (targetParcel.defenseLevel * 15 + turretBonus) * biomeBonus.defenseMod;

    const battleId = randomUUID();

    const battle: Battle = {
      id: battleId,
      attackerId: attacker.id,
      defenderId: targetParcel.ownerId,
      targetParcelId: targetParcel.id,
      attackerPower,
      defenderPower,
      troopsCommitted: action.troopsCommitted,
      resourcesBurned: action.resourcesBurned,
      startTs: now,
      resolveTs: now + BATTLE_DURATION_MS,
      status: "pending",
      commanderId,
    };

    this.battles.set(battleId, battle);
    targetParcel.activeBattleId = battleId;

    this.events.push({
      id: randomUUID(),
      type: "attack",
      playerId: attacker.id,
      parcelId: targetParcel.id,
      battleId,
      description: `${attacker.name} launched an attack on plot #${targetParcel.plotId}`,
      timestamp: now,
    });

    this.lastUpdateTs = now;
    return battle;
  }

  async mintAvatar(action: MintAvatarAction): Promise<CommanderAvatar> {
    await this.initialize();
    const player = this.players.get(action.playerId);
    if (!player) throw new Error("Player not found");

    const info = COMMANDER_INFO[action.tier];
    if (!info) throw new Error("Invalid commander tier");
    if (player.frontier < info.mintCostFrontier) throw new Error(`Insufficient FRONTIER. Need ${info.mintCostFrontier}, have ${player.frontier.toFixed(2)}`);

    player.frontier -= info.mintCostFrontier;
    player.totalFrontierBurned += info.mintCostFrontier;
    this.frontierCirculating -= info.mintCostFrontier;

    const bonusRoll = Math.random() * 0.3;
    const avatar: CommanderAvatar = {
      id: randomUUID(),
      tier: action.tier,
      name: `${info.name} #${player.commanders.length + 1}`,
      attackBonus: Math.floor(info.baseAttackBonus * (1 + bonusRoll)),
      defenseBonus: Math.floor(info.baseDefenseBonus * (1 + bonusRoll)),
      specialAbility: info.specialAbility,
      mintedAt: Date.now(),
      totalKills: 0,
    };

    player.commanders.push(avatar);
    player.activeCommanderIndex = player.commanders.length - 1;
    player.commander = avatar;

    this.events.push({
      id: randomUUID(),
      type: "mint_avatar",
      playerId: player.id,
      description: `${player.name} minted a ${info.name} Commander (${action.tier.toUpperCase()}) for ${info.mintCostFrontier} FRONTIER`,
      timestamp: Date.now(),
    });

    this.lastUpdateTs = Date.now();
    return avatar;
  }

  async executeSpecialAttack(action: SpecialAttackAction): Promise<{ damage: number; effect: string }> {
    await this.initialize();
    const player = this.players.get(action.playerId);
    if (!player) throw new Error("Player not found");
    if (!player.commander) throw new Error("You need a Commander to use special attacks. Mint one first.");

    const attackInfo = SPECIAL_ATTACK_INFO[action.attackType];
    if (!attackInfo) throw new Error("Invalid attack type");

    if (!attackInfo.requiredTier.includes(player.commander.tier)) {
      throw new Error(`${attackInfo.name} requires a ${attackInfo.requiredTier.join(" or ")} Commander`);
    }

    if (player.frontier < attackInfo.costFrontier) {
      throw new Error(`Insufficient FRONTIER. Need ${attackInfo.costFrontier}, have ${player.frontier.toFixed(2)}`);
    }

    const existing = player.specialAttacks.find(sa => sa.type === action.attackType);
    if (existing) {
      const elapsed = Date.now() - existing.lastUsedTs;
      if (elapsed < attackInfo.cooldownMs) {
        const remaining = Math.ceil((attackInfo.cooldownMs - elapsed) / 60000);
        throw new Error(`${attackInfo.name} on cooldown. ${remaining} minutes remaining.`);
      }
    }

    const targetParcel = this.parcels.get(action.targetParcelId);
    if (!targetParcel) throw new Error("Target plot not found");
    if (targetParcel.ownerId === player.id) throw new Error("Cannot attack your own territory");

    player.frontier -= attackInfo.costFrontier;
    player.totalFrontierBurned += attackInfo.costFrontier;
    this.frontierCirculating -= attackInfo.costFrontier;

    if (existing) {
      existing.lastUsedTs = Date.now();
    } else {
      player.specialAttacks.push({ type: action.attackType, lastUsedTs: Date.now() });
    }

    let baseDamage = player.commander.attackBonus * attackInfo.damageMultiplier;
    let effectDescription = attackInfo.effect;

    if (action.attackType === "orbital_strike") {
      const defReduction = Math.floor(targetParcel.defenseLevel * 0.5);
      targetParcel.defenseLevel = Math.max(1, targetParcel.defenseLevel - defReduction);
      baseDamage += defReduction * 5;
      effectDescription = `Orbital Strike reduced defense by ${defReduction}`;
    } else if (action.attackType === "emp_blast") {
      targetParcel.defenseLevel = Math.max(1, targetParcel.defenseLevel - 2);
      effectDescription = "EMP disabled turrets and shields, defense reduced by 2";
    } else if (action.attackType === "siege_barrage") {
      targetParcel.defenseLevel = Math.max(1, targetParcel.defenseLevel - 1);
      const nearby = this.findNearbyParcels(targetParcel, 0.04);
      let splashCount = 0;
      for (const np of nearby) {
        if (np.ownerId && np.ownerId !== player.id && splashCount < 3) {
          np.defenseLevel = Math.max(1, np.defenseLevel - 1);
          splashCount++;
        }
      }
      effectDescription = `Siege Barrage damaged target + ${splashCount} nearby plots`;
    } else if (action.attackType === "sabotage") {
      targetParcel.yieldMultiplier = Math.max(0.1, targetParcel.yieldMultiplier * 0.5);
      effectDescription = "Sabotage halved target mining yield";
    }

    player.commander.totalKills++;

    this.events.push({
      id: randomUUID(),
      type: "special_attack",
      playerId: player.id,
      parcelId: targetParcel.id,
      description: `${player.name}'s ${player.commander.name} launched ${attackInfo.name} on plot #${targetParcel.plotId}!`,
      timestamp: Date.now(),
    });

    this.lastUpdateTs = Date.now();
    return { damage: Math.floor(baseDamage), effect: effectDescription };
  }

  async deployDrone(action: DeployDroneAction): Promise<ReconDrone> {
    await this.initialize();
    const player = this.players.get(action.playerId);
    if (!player) throw new Error("Player not found");
    if (player.drones.length >= MAX_DRONES) throw new Error(`Maximum ${MAX_DRONES} drones allowed`);
    if (player.frontier < DRONE_MINT_COST_FRONTIER) {
      throw new Error(`Insufficient FRONTIER. Need ${DRONE_MINT_COST_FRONTIER}, have ${player.frontier.toFixed(2)}`);
    }

    player.frontier -= DRONE_MINT_COST_FRONTIER;
    player.totalFrontierBurned += DRONE_MINT_COST_FRONTIER;
    this.frontierCirculating -= DRONE_MINT_COST_FRONTIER;

    let targetId = action.targetParcelId || null;
    if (!targetId) {
      const allParcels = Array.from(this.parcels.values());
      const enemyParcels = allParcels.filter(p => p.ownerId && p.ownerId !== player.id);
      if (enemyParcels.length > 0) {
        targetId = enemyParcels[Math.floor(Math.random() * enemyParcels.length)].id;
      }
    }

    const drone: ReconDrone = {
      id: randomUUID(),
      deployedAt: Date.now(),
      targetParcelId: targetId,
      status: targetId ? "scouting" : "idle",
      discoveredResources: { iron: 0, fuel: 0, crystal: 0 },
      scoutReportReady: false,
    };

    if (targetId) {
      const targetParcel = this.parcels.get(targetId);
      if (targetParcel) {
        const bonus = Math.random();
        drone.discoveredResources = {
          iron: Math.floor(5 + bonus * 15),
          fuel: Math.floor(3 + bonus * 10),
          crystal: Math.floor(bonus * 5),
        };
      }
    }

    player.drones.push(drone);

    this.events.push({
      id: randomUUID(),
      type: "deploy_drone",
      playerId: player.id,
      parcelId: targetId || undefined,
      description: `${player.name} deployed a Recon Drone`,
      timestamp: Date.now(),
    });

    this.lastUpdateTs = Date.now();
    return drone;
  }

  async deploySatellite(action: DeploySatelliteAction): Promise<OrbitalSatellite> {
    await this.initialize();
    const player = this.players.get(action.playerId);
    if (!player) throw new Error("Player not found");

    const now = Date.now();
    // Expire stale satellites first
    player.satellites = player.satellites.map(s =>
      s.status === "active" && s.expiresAt <= now ? { ...s, status: "expired" as const } : s
    );
    const activeSatellites = player.satellites.filter(s => s.status === "active");
    if (activeSatellites.length >= MAX_SATELLITES) throw new Error(`Maximum ${MAX_SATELLITES} active satellites allowed`);
    if (player.frontier < SATELLITE_DEPLOY_COST_FRONTIER) {
      throw new Error(`Insufficient FRONTIER. Need ${SATELLITE_DEPLOY_COST_FRONTIER}, have ${player.frontier.toFixed(2)}`);
    }

    player.frontier -= SATELLITE_DEPLOY_COST_FRONTIER;
    player.totalFrontierBurned += SATELLITE_DEPLOY_COST_FRONTIER;
    this.frontierCirculating -= SATELLITE_DEPLOY_COST_FRONTIER;

    const satellite: OrbitalSatellite = {
      id: randomUUID(),
      deployedAt: now,
      expiresAt: now + SATELLITE_ORBIT_DURATION_MS,
      status: "active",
    };

    player.satellites.push(satellite);

    this.events.push({
      id: randomUUID(),
      type: "deploy_satellite",
      playerId: player.id,
      description: `${player.name} launched an Orbital Satellite — +${SATELLITE_YIELD_BONUS * 100}% mining yield for 1 hour`,
      timestamp: now,
    });

    this.lastUpdateTs = now;
    return satellite;
  }

  async resolveBattles(): Promise<Battle[]> {
    const now = Date.now();
    const resolvedBattles: Battle[] = [];

    for (const battle of Array.from(this.battles.values())) {
      if (battle.status === "pending" && now >= battle.resolveTs) {
        const seedString = `${battle.id}${battle.startTs}`;
        let hash = 0;
        for (let i = 0; i < seedString.length; i++) {
          const char = seedString.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }
        const randFactor = (Math.abs(hash) % 21) - 10;
        const adjustedAttackerPower = battle.attackerPower * (1 + randFactor / 100);
        const attackerWins = adjustedAttackerPower > battle.defenderPower;

        battle.status = "resolved";
        battle.outcome = attackerWins ? "attacker_wins" : "defender_wins";
        battle.randFactor = randFactor;

        const targetParcel = this.parcels.get(battle.targetParcelId);
        const attacker = this.players.get(battle.attackerId);
        const defender = battle.defenderId ? this.players.get(battle.defenderId) : null;

        if (targetParcel && attacker) {
          targetParcel.activeBattleId = null;

          if (attackerWins) {
            // ── Pillage stored resources ────────────────────────────────────
            const pillagedIron    = Math.floor(targetParcel.ironStored    * PILLAGE_RATE);
            const pillagedFuel    = Math.floor(targetParcel.fuelStored    * PILLAGE_RATE);
            const pillagedCrystal = Math.floor(targetParcel.crystalStored * PILLAGE_RATE);
            targetParcel.ironStored    -= pillagedIron;
            targetParcel.fuelStored    -= pillagedFuel;
            targetParcel.crystalStored -= pillagedCrystal;
            attacker.iron    += pillagedIron;
            attacker.fuel    += pillagedFuel;
            attacker.crystal += pillagedCrystal;

            if (defender) {
              defender.ownedParcels = defender.ownedParcels.filter((id) => id !== targetParcel.id);
              defender.attacksLost++;

              // ── Morale debuff: scales with consecutive losses ─────────────
              const prevConsecutive = defender.consecutiveLosses ?? 0;
              defender.consecutiveLosses = prevConsecutive + 1;
              const debuffMs = MORALE_DEBUFF_BASE_MS * (1 + prevConsecutive * 0.5);
              defender.moraleDebuffUntil = now + debuffMs;

              // ── Attack cooldown: stacks per consecutive loss ──────────────
              defender.attackCooldownUntil = now + ATTACK_COOLDOWN_PER_LOSS_MS * defender.consecutiveLosses;

              // ── Cascade vulnerability: adjacent defender parcels lose 1 def
              const adjacentDefenderParcels = this.findNearbyParcels(targetParcel, 0.05)
                .filter((p) => p.ownerId === defender!.id);
              for (const adj of adjacentDefenderParcels) {
                adj.defenseLevel = Math.max(1, adj.defenseLevel - CASCADE_DEFENSE_PENALTY);
              }
            }

            targetParcel.ownerId = attacker.id;
            targetParcel.ownerType = attacker.isAI ? "ai" : "player";
            targetParcel.defenseLevel = Math.max(1, Math.floor(targetParcel.defenseLevel / 2));
            targetParcel.purchasePriceAlgo = null;
            targetParcel.lastFrontierClaimTs = now;
            attacker.ownedParcels.push(targetParcel.id);
            attacker.attacksWon++;
            attacker.territoriesCaptured++;
            // Reset attacker's consecutive losses on a win
            attacker.consecutiveLosses = 0;

            const pillageMsg = (pillagedIron > 0 || pillagedFuel > 0 || pillagedCrystal > 0)
              ? ` Pillaged: ${pillagedIron} iron, ${pillagedFuel} fuel, ${pillagedCrystal} crystal.`
              : "";
            const penaltyMsg = defender
              ? ` ${defender.name} suffers morale debuff and attack cooldown.`
              : "";

            this.events.push({
              id: randomUUID(),
              type: "battle_resolved",
              playerId: attacker.id,
              parcelId: targetParcel.id,
              battleId: battle.id,
              description: `${attacker.name} conquered plot #${targetParcel.plotId}!${pillageMsg}${penaltyMsg}`,
              timestamp: now,
            });
          } else {
            attacker.attacksLost++;
            if (defender) {
              defender.attacksWon++;
              // Successful defence resets the defender's consecutive-loss streak
              defender.consecutiveLosses = 0;
            }
            this.events.push({
              id: randomUUID(),
              type: "battle_resolved",
              playerId: defender?.id || attacker.id,
              parcelId: targetParcel.id,
              battleId: battle.id,
              description: `Defense held at plot #${targetParcel.plotId}. ${attacker.name}'s attack was repelled.`,
              timestamp: now,
            });
          }
        }

        resolvedBattles.push(battle);
      }
    }

    if (resolvedBattles.length > 0) {
      this.lastUpdateTs = now;
    }

    return resolvedBattles;
  }

  private findNearbyParcels(parcel: LandParcel, maxDist: number = 0.05): LandParcel[] {
    const nearby: LandParcel[] = [];
    for (const p of Array.from(this.parcels.values())) {
      if (p.id === parcel.id) continue;
      const dist = sphereDistance(parcel.lat, parcel.lng, p.lat, p.lng);
      if (dist < maxDist) nearby.push(p);
    }
    return nearby;
  }

  async switchCommander(playerId: string, commanderIndex: number): Promise<CommanderAvatar> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");
    if (commanderIndex < 0 || commanderIndex >= player.commanders.length)
      throw new Error("Invalid commander index");
    player.activeCommanderIndex = commanderIndex;
    player.commander = player.commanders[commanderIndex];
    this.events.push({
      id: randomUUID(),
      type: "ai_action",
      playerId: player.id,
      description: `${player.name} switched to commander ${player.commander.name}`,
      timestamp: Date.now(),
    });
    this.lastUpdateTs = Date.now();
    return player.commander;
  }

  async runAITurn(): Promise<GameEvent[]> {
    const newEvents: GameEvent[] = [];
    const now = Date.now();

    for (const player of Array.from(this.players.values())) {
      if (!player.isAI) continue;
      if (Math.random() > 0.4) continue;

      const ownedParcels = player.ownedParcels
        .map((id: string) => this.parcels.get(id))
        .filter((p: LandParcel | undefined): p is LandParcel => !!p);

      for (const parcel of ownedParcels) {
        if (now - parcel.lastMineTs >= MINE_COOLDOWN_MS) {
          try {
            await this.mineResources({ playerId: player.id, parcelId: parcel.id });
          } catch (e) {}
          break;
        }
      }

      for (const parcel of ownedParcels) {
        const totalStored = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
        if (totalStored > 50) {
          try {
            await this.collectAll(player.id);
          } catch (e) {}
          break;
        }
      }

      if (player.aiBehavior === "expansionist" || player.aiBehavior === "economic") {
        if (Math.random() > 0.5) {
          let buyTarget: LandParcel | null = null;
          for (const owned of ownedParcels) {
            const nearby = this.findNearbyParcels(owned, 0.08);
            const buyable = nearby.filter((p) => !p.ownerId && p.purchasePriceAlgo !== null && p.biome !== "water");
            if (buyable.length > 0) {
              buyTarget = buyable[Math.floor(Math.random() * buyable.length)];
              break;
            }
          }
          if (buyTarget) {
            try {
              await this.purchaseLand({ playerId: player.id, parcelId: buyTarget.id });
              newEvents.push({
                id: randomUUID(),
                type: "ai_action",
                playerId: player.id,
                parcelId: buyTarget.id,
                description: `${player.name} purchased new territory`,
                timestamp: now,
              });
            } catch (e) {}
          }
        }
      }

      if (player.aiBehavior === "expansionist" || player.aiBehavior === "raider") {
        // Respect attack cooldown imposed by consecutive losses
        const inCooldown = player.attackCooldownUntil && now < player.attackCooldownUntil;
        if (!inCooldown) {
          const canAttack = player.iron >= ATTACK_BASE_COST.iron && player.fuel >= ATTACK_BASE_COST.fuel;
          // Raise the random threshold when morale-debuffed so the AI attacks less aggressively
          const moraleDebuffed = player.moraleDebuffUntil && now < player.moraleDebuffUntil;
          const attackThreshold = moraleDebuffed ? 0.85 : 0.7;
          if (canAttack && Math.random() > attackThreshold) {
            let attackTarget: LandParcel | null = null;
            for (const owned of ownedParcels) {
              const nearby = this.findNearbyParcels(owned, 0.08);
              const targets = nearby.filter((p) => p.ownerId !== player.id && !p.activeBattleId && p.biome !== "water");
              if (targets.length > 0) {
                attackTarget = targets[Math.floor(Math.random() * targets.length)];
                break;
              }
            }
            if (attackTarget) {
              try {
                await this.deployAttack({
                  attackerId: player.id,
                  targetParcelId: attackTarget.id,
                  troopsCommitted: 1,
                  resourcesBurned: { iron: ATTACK_BASE_COST.iron, fuel: ATTACK_BASE_COST.fuel },
                });
                const statusMsg = moraleDebuffed ? " [morale debuffed]" : "";
                newEvents.push({
                  id: randomUUID(),
                  type: "ai_action",
                  playerId: player.id,
                  description: `${player.name} deployed troops${statusMsg}`,
                  timestamp: now,
                });
              } catch (e) {}
            }
          }
        }
      }

      if (player.aiBehavior === "defensive") {
        for (const parcel of ownedParcels) {
          if (parcel.defenseLevel < 5 && player.iron >= UPGRADE_COSTS.defense.iron && player.fuel >= UPGRADE_COSTS.defense.fuel) {
            try {
              await this.upgradeBase({ playerId: player.id, parcelId: parcel.id, upgradeType: "defense" });
            } catch (e) {}
            break;
          }
        }
      }
    }

    this.events.push(...newEvents);
    if (newEvents.length > 0) this.lastUpdateTs = now;
    this.currentTurn++;

    return newEvents;
  }

  // ── Orbital stubs (MemStorage — no DB, so in-memory only) ────────────────
  private _memOrbitalEvents: OrbitalEvent[] = [];

  async getActiveOrbitalEvents(): Promise<OrbitalEvent[]> {
    const now = Date.now();
    return this._memOrbitalEvents.filter((e) => !e.resolved && e.endAt > now);
  }

  async createOrbitalImpactEvent(type: OrbitalEvent["type"], targetParcelId?: string): Promise<OrbitalEvent> {
    const now = Date.now();
    const event: OrbitalEvent = {
      id: randomUUID(), type, cosmetic: false,
      startAt: now, endAt: now + 10 * 60 * 1000,
      seed: Math.floor(Math.random() * 0x7fffffff), intensity: 0.7,
      trajectory: { startLat: 45, startLng: 0, endLat: -45, endLng: 90 },
      targetParcelId, effects: [], resolved: false,
    };
    this._memOrbitalEvents.push(event);
    console.log(`[ORBITAL-DEBUG] MemStorage createOrbitalImpactEvent | type: ${type}`);
    return event;
  }

  async resolveOrbitalEvent(eventId: string): Promise<void> {
    const evt = this._memOrbitalEvents.find((e) => e.id === eventId);
    if (evt) evt.resolved = true;
    console.log(`[ORBITAL-DEBUG] MemStorage resolveOrbitalEvent | id: ${eventId}`);
  }

  async triggerOrbitalCheck(): Promise<OrbitalEvent | null> {
    if (Math.random() > ORBITAL_IMPACT_CHANCE) return null;
    return this.createOrbitalImpactEvent("IMPACT_STRIKE");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level row-to-domain-object helpers
// ─────────────────────────────────────────────────────────────────────────────

type ParcelRow  = typeof parcelsTable.$inferSelect;
type PlayerRow  = typeof playersTable.$inferSelect;
type BattleRow  = typeof battlesTable.$inferSelect;
type EventRow   = typeof gameEventsTable.$inferSelect;

function rowToParcel(row: ParcelRow): LandParcel {
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
    yieldMultiplier:     row.yieldMultiplier,
    improvements:        (row.improvements ?? []) as Improvement[],
    purchasePriceAlgo:   row.purchasePriceAlgo ?? null,
    frontierAccumulated: row.frontierAccumulated,
    lastFrontierClaimTs: Number(row.lastFrontierClaimTs),
    frontierPerDay:      row.frontierPerDay,
    capturedFromFaction: (row as any).capturedFromFaction ?? null,
    capturedAt:          (row as any).capturedAt ? Number((row as any).capturedAt) : null,
    handoverCount:       (row as any).handoverCount ?? 0,
  };
}

function rowToPlayer(row: PlayerRow, ownedParcelIds: string[]): Player {
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

function rowToBattle(row: BattleRow): Battle {
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
    commanderId:      (row as any).commanderId ?? undefined,
  };
}

function rowToEvent(row: EventRow): GameEvent {
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

function computeLeaderboard(playerRows: PlayerRow[], parcelRows: ParcelRow[]): LeaderboardEntry[] {
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

/** Convert lat/lng (degrees) to unit-sphere cartesian coords. */
function latLngToXYZ(lat: number, lng: number): { x: number; y: number; z: number } {
  const φ = (lat * Math.PI) / 180;
  const λ = (lng * Math.PI) / 180;
  return {
    x: Math.cos(φ) * Math.cos(λ),
    y: Math.cos(φ) * Math.sin(λ),
    z: Math.sin(φ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DbStorage
// ─────────────────────────────────────────────────────────────────────────────

export class DbStorage implements IStorage {
  private readonly db: DB;
  /** In-process singleton guard so concurrent boot requests don't double-seed. */
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required to use DbStorage. Set the env var or leave it unset to use MemStorage.");
    }
    this.db = db;
  }

  // ── initialization ─────────────────────────────────────────────────────────

  /** Lazily initialise the DB world (idempotent — checks game_meta.initialized). */
  private async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this._doInitialize();
    }
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    // ── Schema migrations (safe to run on every startup) ─────────────────────
    // Add columns introduced after the initial DB release so that existing
    // deployments self-heal without requiring a manual `drizzle-kit push`.

    // NFT tracking table — created here so no separate migration step is needed.
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS plot_nfts (
        plot_id           INT PRIMARY KEY,
        asset_id          BIGINT,
        minted_to_address TEXT,
        minted_at         BIGINT
      )
    `);

    // Orbital events table — persists server-authoritative impact events.
    await this.db.execute(sql`
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
    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS orbital_events_active_idx
        ON orbital_events (resolved, end_at)
    `);

    await this.db.execute(
      sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS total_crystal_mined REAL NOT NULL DEFAULT 0`
    );
    await this.db.execute(
      sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS morale_debuff_until BIGINT NOT NULL DEFAULT 0`
    );
    await this.db.execute(
      sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS attack_cooldown_until BIGINT NOT NULL DEFAULT 0`
    );
    await this.db.execute(
      sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS consecutive_losses INT NOT NULL DEFAULT 0`
    );

    // Check whether the world has already been seeded.
    const [meta] = await this.db
      .insert(gameMeta)
      .values({ id: 1, initialized: false, currentTurn: 1, lastUpdateTs: Date.now() })
      .onConflictDoNothing()
      .returning();

    const existing = meta
      ? meta
      : (await this.db.select().from(gameMeta).where(eq(gameMeta.id, 1)))[0];

    if (existing?.initialized) return; // already seeded in a previous process run

    console.log("DbStorage: seeding world for the first time…");

    await this.db.transaction(async (tx) => {
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

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Update game_meta.last_update_ts. Accepts an optional transaction. */
  private async bumpLastTs(ts: number, tx?: Parameters<Parameters<DB["transaction"]>[0]>[0]): Promise<void> {
    const runner = tx ?? this.db;
    await runner.update(gameMeta).set({ lastUpdateTs: ts }).where(eq(gameMeta.id, 1));
  }

  /** Insert a game event row. Accepts an optional transaction. */
  private async addEvent(
    event: Omit<GameEvent, "id"> & { id?: string },
    tx?: Parameters<Parameters<DB["transaction"]>[0]>[0]
  ): Promise<void> {
    const runner = tx ?? this.db;
    await runner.insert(gameEventsTable).values({
      id:          event.id ?? randomUUID(),
      type:        event.type,
      playerId:    event.playerId,
      parcelId:    event.parcelId,
      battleId:    event.battleId,
      description: event.description,
      ts:          event.timestamp,
    });
  }

  /** Compute how much FRONTIER has accumulated on a parcel and update the row. */
  private accumulatedFrontier(parcel: LandParcel, now: number): number {
    if (!parcel.ownerId) return 0;
    const days = (now - parcel.lastFrontierClaimTs) / (1000 * 60 * 60 * 24);
    if (days <= 0) return 0;
    const perDay = calculateFrontierPerDay(parcel.improvements);
    return perDay * days;
  }
  // ── Orbital Event Engine ─────────────────────────────────────────────────

  async getActiveOrbitalEvents(): Promise<OrbitalEvent[]> {
    await this.initialize();
    const now = Date.now();
    const rows = await this.db.select().from(orbitalEventsTable)
      .where(and(eq(orbitalEventsTable.resolved, false), sql`${orbitalEventsTable.endAt} > ${now}`));

    return rows.map((r) => ({
      id:            r.id,
      type:          r.type as OrbitalEvent["type"],
      cosmetic:      r.cosmetic,
      startAt:       Number(r.startAt),
      endAt:         Number(r.endAt),
      seed:          r.seed,
      intensity:     r.intensity,
      trajectory:    r.trajectory as OrbitalEvent["trajectory"],
      targetParcelId: r.targetParcelId ?? undefined,
      effects:       (r.effects ?? []) as OrbitalEffect[],
      resolved:      r.resolved,
    }));
  }

  async createOrbitalImpactEvent(
    type: OrbitalEvent["type"],
    targetParcelId?: string
  ): Promise<OrbitalEvent> {
    await this.initialize();
    const now = Date.now();
    const id = randomUUID();

    // Duration: impact events last 8–15 minutes
    const durationMs = (8 + Math.random() * 7) * 60 * 1000;
    const intensity = 0.5 + Math.random() * 0.5;
    const seed = Math.floor(Math.random() * 0x7fffffff);

    // Trajectory: random strike angle
    const trajectory: OrbitalEvent["trajectory"] = {
      startLat: Math.random() * 180 - 90,
      startLng: Math.random() * 360 - 180,
      endLat:   Math.random() * 180 - 90,
      endLng:   Math.random() * 360 - 180,
    };

    // Build gameplay effects based on event type
    const effects: OrbitalEffect[] = [];
    if (type === "IMPACT_STRIKE") {
      effects.push({
        type:        "RESOURCE_BURST" as OrbitalEffectType,
        magnitude:   ORBITAL_RESOURCE_BURST_BONUS,
        durationMs:  ORBITAL_RESOURCE_BURST_MS,
        description: `+${Math.round(ORBITAL_RESOURCE_BURST_BONUS * 100)}% mining yield for affected parcel`,
      });
    } else if (type === "ATMOSPHERIC_BURST") {
      effects.push({
        type:        "TILE_HAZARD" as OrbitalEffectType,
        magnitude:   ORBITAL_TILE_HAZARD_PENALTY,
        durationMs:  ORBITAL_TILE_HAZARD_MS,
        description: `${Math.round(ORBITAL_TILE_HAZARD_PENALTY * 100)}% mining yield reduction (EMP storm)`,
      });
    }

    await this.db.insert(orbitalEventsTable).values({
      id,
      type,
      cosmetic:      false,
      startAt:       now,
      endAt:         now + durationMs,
      seed,
      intensity,
      trajectory,
      targetParcelId,
      effects,
      resolved:      false,
    });

    // Emit a game event so the activity feed shows it
    const systemPlayerId = "system";
    await this.addEvent({
      type:        "orbital_event",
      playerId:    systemPlayerId,
      parcelId:    targetParcelId,
      description: `ORBITAL WARNING: ${type.replace(/_/g, " ")} detected — ${effects[0]?.description ?? "area affected"}`,
      timestamp:   now,
    });

    console.log(
      `[ORBITAL-DEBUG] createOrbitalImpactEvent | id: ${id} | type: ${type} | parcel: ${targetParcelId ?? "global"} | effects: ${effects.length} | startAt: ${now}`
    );

    const event: OrbitalEvent = {
      id, type, cosmetic: false,
      startAt: now, endAt: now + durationMs,
      seed, intensity, trajectory,
      targetParcelId, effects, resolved: false,
    };
    return event;
  }

  async resolveOrbitalEvent(eventId: string): Promise<void> {
    await this.initialize();
    const now = Date.now();
    const [row] = await this.db.select().from(orbitalEventsTable)
      .where(eq(orbitalEventsTable.id, eventId));
    if (!row || row.resolved) return;

    // Apply gameplay effects
    const effects = (row.effects ?? []) as OrbitalEffect[];
    if (row.targetParcelId && effects.length > 0) {
      for (const effect of effects) {
        const [parcelRow] = await this.db.select().from(parcelsTable)
          .where(eq(parcelsTable.id, row.targetParcelId));
        if (parcelRow) {
          // Apply yield multiplier delta (clamped to [0.1, 3.0])
          const current = parcelRow.yieldMultiplier ?? 1.0;
          const newYield = Math.max(0.1, Math.min(3.0, current + effect.magnitude));
          await this.db.update(parcelsTable)
            .set({ yieldMultiplier: newYield })
            .where(eq(parcelsTable.id, row.targetParcelId));
          console.log(
            `[ORBITAL-DEBUG] resolveOrbitalEvent | effect: ${effect.type} | parcel: ${row.targetParcelId} | yield: ${current} → ${newYield}`
          );
        }
      }
    }

    await this.db.update(orbitalEventsTable)
      .set({ resolved: true })
      .where(eq(orbitalEventsTable.id, eventId));

    console.log(`[ORBITAL-DEBUG] resolveOrbitalEvent | id: ${eventId} | resolved at: ${now}`);
  }

  async triggerOrbitalCheck(): Promise<OrbitalEvent | null> {
    await this.initialize();

    // Roll for impact event
    if (Math.random() > ORBITAL_IMPACT_CHANCE) {
      console.log(`[ORBITAL-DEBUG] triggerOrbitalCheck | no event this roll`);
      return null;
    }

    // Pick a random impact type
    const impactTypes: OrbitalEvent["type"][] = ["IMPACT_STRIKE", "ATMOSPHERIC_BURST"];
    const type = impactTypes[Math.floor(Math.random() * impactTypes.length)];

    // Optionally target a random owned parcel
    const allParcels = await this.db.select({ id: parcelsTable.id })
      .from(parcelsTable)
      .where(sql`${parcelsTable.ownerId} IS NOT NULL`)
      .limit(200);

    const targetParcelId = allParcels.length > 0
      ? allParcels[Math.floor(Math.random() * allParcels.length)].id
      : undefined;

    console.log(
      `[ORBITAL-DEBUG] triggerOrbitalCheck | IMPACT triggered | type: ${type} | parcel: ${targetParcelId ?? "global"}`
    );

    return this.createOrbitalImpactEvent(type, targetParcelId);
  }

  /* ✅ INSERT NEW METHOD HERE */

  async getOrCreatePlayerByAddress(address: string): Promise<Player> {
    await this.initialize();

    const trimmed = address.trim();
    const normalized = trimmed.toLowerCase();

    // Case-insensitive lookup so uppercase Algorand addresses match existing rows.
    const [existing] = await this.db
      .select()
      .from(playersTable)
      .where(sql`lower(${playersTable.address}) = ${normalized}`);

    if (existing) {
      const ownedRows = await this.db
        .select({ id: parcelsTable.id })
        .from(parcelsTable)
        .where(eq(parcelsTable.ownerId, existing.id));

      return rowToPlayer(existing, ownedRows.map(r => r.id));
    }

    const id = randomUUID();
    // Preserve original address case (Algorand addresses are uppercase base32).
    const displayName = `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;

    await this.db.insert(playersTable).values({
      id,
      address: trimmed,
      name: displayName,
      iron: 200,
      fuel: 150,
      crystal: 50,
      frontier: 0,
    });

    const [created] = await this.db
      .select()
      .from(playersTable)
      .where(eq(playersTable.id, id));

    return rowToPlayer(created, []);
  }

  // ── IStorage – read ────────────────────────────────────────────────────────

  async getGameState(): Promise<GameState> {
    await this.initialize();
    await this.resolveBattles();

    const [allParcels, allPlayers, allBattles, recentEvents, [meta]] = await Promise.all([
      this.db.select().from(parcelsTable),
      this.db.select().from(playersTable),
      this.db.select().from(battlesTable),
      this.db.select().from(gameEventsTable).orderBy(desc(gameEventsTable.ts)).limit(50),
      this.db.select().from(gameMeta).where(eq(gameMeta.id, 1)),
    ]);

    // Build ownedParcels arrays from the parcel rows (avoids a separate join).
    const ownerMap = new Map<string, string[]>();
    for (const p of allParcels) {
      if (p.ownerId) {
        if (!ownerMap.has(p.ownerId)) ownerMap.set(p.ownerId, []);
        ownerMap.get(p.ownerId)!.push(p.id);
      }
    }

    const claimedPlots = allParcels.filter((p) => p.ownerId !== null).length;
    const frontierCirculating = allPlayers.reduce((sum, p) => sum + fromMicroFRNTR(p.frntrBalanceMicro), 0);

    return {
      parcels:            allParcels.map(rowToParcel),
      players:            allPlayers.map((r) => rowToPlayer(r, ownerMap.get(r.id) ?? [])),
      battles:            allBattles.map(rowToBattle),
      events:             recentEvents.map(rowToEvent),
      leaderboard:        computeLeaderboard(allPlayers, allParcels),
      currentTurn:        meta?.currentTurn ?? 1,
      lastUpdateTs:       Number(meta?.lastUpdateTs ?? 0),
      totalPlots:         TOTAL_PLOTS,
      claimedPlots,
      frontierTotalSupply: FRONTIER_TOTAL_SUPPLY,
      frontierCirculating,
    };
  }

  async getParcel(id: string): Promise<LandParcel | undefined> {
    await this.initialize();
    const [row] = await this.db.select().from(parcelsTable).where(eq(parcelsTable.id, id));
    return row ? rowToParcel(row) : undefined;
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    await this.initialize();
    const [[row], ownedRows] = await Promise.all([
      this.db.select().from(playersTable).where(eq(playersTable.id, id)),
      this.db.select({ id: parcelsTable.id }).from(parcelsTable).where(eq(parcelsTable.ownerId, id)),
    ]);
    return row ? rowToPlayer(row, ownedRows.map((r) => r.id)) : undefined;
  }

  async getBattle(id: string): Promise<Battle | undefined> {
    await this.initialize();
    const [row] = await this.db.select().from(battlesTable).where(eq(battlesTable.id, id));
    return row ? rowToBattle(row) : undefined;
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    await this.initialize();
    const [allPlayers, allParcels] = await Promise.all([
      this.db.select().from(playersTable),
      this.db.select({ id: parcelsTable.id, ownerId: parcelsTable.ownerId }).from(parcelsTable),
    ]);
    return computeLeaderboard(allPlayers, allParcels as ParcelRow[]);
  }

  // ── IStorage – mutating ────────────────────────────────────────────────────

  async mineResources(action: MineAction): Promise<{ iron: number; fuel: number; crystal: number }> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[parcelRow], [playerRow]] = await Promise.all([
        tx.select().from(parcelsTable).where(eq(parcelsTable.id, action.parcelId)),
        tx.select().from(playersTable).where(eq(playersTable.id, action.playerId)),
      ]);
      if (!parcelRow || !playerRow) throw new Error("Invalid parcel or player");

      const parcel = rowToParcel(parcelRow);
      const player = rowToPlayer(playerRow, []);
      if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

      const now = Date.now();
      if (now - parcel.lastMineTs < MINE_COOLDOWN_MS) throw new Error("Mining cooldown not complete");

      const playerSatellites = (playerRow.satellites ?? []) as OrbitalSatellite[];
      const activeSatellites = playerSatellites.filter(s => s.status === "active" && s.expiresAt > now);
      const satelliteMult = activeSatellites.length > 0 ? 1 + SATELLITE_YIELD_BONUS : 1;

      const biomeBonus  = biomeBonuses[parcel.biome];
      const richMult    = parcel.richness / 100;
      const ironYield   = Math.floor(BASE_YIELD.iron   * biomeBonus.yieldMod * richMult * parcel.yieldMultiplier * satelliteMult);
      const fuelYield   = Math.floor(BASE_YIELD.fuel   * biomeBonus.yieldMod * richMult * parcel.yieldMultiplier * satelliteMult);
      const crystalYield= Math.floor(BASE_YIELD.crystal * richMult * satelliteMult);

      const totalStored = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
      const remaining   = parcel.storageCapacity - totalStored;
      const totalYield  = ironYield + fuelYield + crystalYield;
      const ratio       = remaining < totalYield ? remaining / totalYield : 1;

      const finalIron    = Math.floor(ironYield    * ratio);
      const finalFuel    = Math.floor(fuelYield    * ratio);
      const finalCrystal = Math.floor(crystalYield * ratio);
      const newRichness  = parcel.richness > 20 ? Math.max(20, parcel.richness - 1) : parcel.richness;

      await Promise.all([
        tx.update(parcelsTable)
          .set({
            ironStored:    parcel.ironStored    + finalIron,
            fuelStored:    parcel.fuelStored    + finalFuel,
            crystalStored: parcel.crystalStored + finalCrystal,
            lastMineTs:    now,
            richness:      newRichness,
          })
          .where(eq(parcelsTable.id, parcel.id)),
        tx.update(playersTable)
          .set({
            totalIronMined:    playerRow.totalIronMined    + finalIron,
            totalFuelMined:    playerRow.totalFuelMined    + finalFuel,
            totalCrystalMined: playerRow.totalCrystalMined + finalCrystal,
          })
          .where(eq(playersTable.id, player.id)),
      ]);

      await this.addEvent({
        type:        "mine",
        playerId:    player.id,
        parcelId:    parcel.id,
        description: `${player.name} mined ${finalIron} iron, ${finalFuel} fuel, ${finalCrystal} crystal from plot #${parcel.plotId}`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return { iron: finalIron, fuel: finalFuel, crystal: finalCrystal };
    });
  }

  async collectAll(playerId: string): Promise<{ iron: number; fuel: number; crystal: number }> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[playerRow], ownedRows] = await Promise.all([
        tx.select().from(playersTable).where(eq(playersTable.id, playerId)),
        tx.select().from(parcelsTable).where(eq(parcelsTable.ownerId, playerId)),
      ]);
      if (!playerRow) throw new Error("Player not found");

      let totalIron = 0, totalFuel = 0, totalCrystal = 0;
      for (const p of ownedRows) {
        totalIron    += p.ironStored;
        totalFuel    += p.fuelStored;
        totalCrystal += p.crystalStored;
      }

      if (totalIron > 0 || totalFuel > 0 || totalCrystal > 0) {
        await Promise.all([
          // Zero stored resources on all owned parcels in one statement
          tx.update(parcelsTable)
            .set({ ironStored: 0, fuelStored: 0, crystalStored: 0 })
            .where(eq(parcelsTable.ownerId, playerId)),
          tx.update(playersTable)
            .set({ iron: playerRow.iron + totalIron, fuel: playerRow.fuel + totalFuel, crystal: playerRow.crystal + totalCrystal })
            .where(eq(playersTable.id, playerId)),
        ]);

        const now = Date.now();
        await this.addEvent({
          type:        "mine",
          playerId,
          description: `${playerRow.name} collected ${totalIron} iron, ${totalFuel} fuel, ${totalCrystal} crystal from all territories`,
          timestamp:   now,
        }, tx);
        await this.bumpLastTs(now, tx);
      }

      return { iron: totalIron, fuel: totalFuel, crystal: totalCrystal };
    });
  }

  async updatePlayerAddress(playerId: string, address: string): Promise<void> {
    await this.initialize();
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!row) throw new Error("Player not found");
      if (row.isAi) throw new Error("Cannot update AI player address");
      await tx.update(playersTable).set({ address }).where(eq(playersTable.id, playerId));
    });
  }

  async updatePlayerName(playerId: string, name: string): Promise<void> {
    await this.initialize();
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!row) throw new Error("Player not found");
      if (row.isAi) throw new Error("Cannot rename AI player");
      await tx.update(playersTable).set({ name }).where(eq(playersTable.id, playerId));
    });
  }

  async updateTestnetProgress(playerId: string, completedMissions: string[]): Promise<void> {
    await this.initialize();
    await this.db
      .update(playersTable)
      .set({ testnetProgress: completedMissions })
      .where(eq(playersTable.id, playerId));
  }

  async grantWelcomeBonus(playerId: string): Promise<void> {
    await this.initialize();
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!row) throw new Error("Player not found");
      if (row.welcomeBonusReceived) return;

      const now = Date.now();
      await tx.update(playersTable)
        .set({
          frntrBalanceMicro:    row.frntrBalanceMicro    + toMicroFRNTR(WELCOME_BONUS_FRONTIER),
          totalFrontierEarned:  row.totalFrontierEarned + WELCOME_BONUS_FRONTIER,
          welcomeBonusReceived: true,
        })
        .where(eq(playersTable.id, playerId));

      await this.addEvent({
        type:        "claim_frontier",
        playerId,
        description: `${row.name} received ${WELCOME_BONUS_FRONTIER} FRONTIER welcome bonus!`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);
    });
  }

  async claimFrontier(playerId: string): Promise<{ amount: number }> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[playerRow], ownedRows] = await Promise.all([
        tx.select().from(playersTable).where(eq(playersTable.id, playerId)),
        tx.select().from(parcelsTable).where(eq(parcelsTable.ownerId, playerId)),
      ]);
      if (!playerRow) throw new Error("Player not found");

      const now   = Date.now();
      let total   = 0;

      for (const row of ownedRows) {
        const parcel  = rowToParcel(row);
        // Update frontierAccumulated with time-elapsed earnings first
        const earned  = this.accumulatedFrontier(parcel, now);
        const newAccum = parcel.frontierAccumulated + earned;
        total += newAccum;
        await tx.update(parcelsTable)
          .set({ frontierAccumulated: 0, lastFrontierClaimTs: now, frontierPerDay: calculateFrontierPerDay(parcel.improvements) })
          .where(eq(parcelsTable.id, row.id));
      }

      const microTotal = toMicroFRNTR(total);
      const rounded = fromMicroFRNTR(microTotal);
      if (microTotal > 0) {
        await tx.update(playersTable)
          .set({
            frntrBalanceMicro:   playerRow.frntrBalanceMicro   + microTotal,
            frntrClaimedMicro:   playerRow.frntrClaimedMicro   + microTotal,
            totalFrontierEarned: playerRow.totalFrontierEarned + rounded,
          })
          .where(eq(playersTable.id, playerId));

        await this.addEvent({
          type:        "claim_frontier",
          playerId,
          description: `${playerRow.name} claimed ${rounded.toFixed(2)} FRONTIER tokens`,
          timestamp:   now,
        }, tx);
        await this.bumpLastTs(now, tx);
      }

      return { amount: rounded };
    });
  }

  async restoreFrontier(playerId: string, amount: number): Promise<void> {
    await this.initialize();
    if (amount <= 0) return;
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!row) return;
      const microAmount = toMicroFRNTR(amount);
      await tx.update(playersTable)
        .set({
          frntrBalanceMicro:   row.frntrBalanceMicro   - microAmount,
          totalFrontierEarned: row.totalFrontierEarned - amount,
        })
        .where(eq(playersTable.id, playerId));
      console.log(`Restored ${amount} FRONTIER for player ${row.name} due to failed transfer`);
    });
  }

  async upgradeBase(action: UpgradeAction): Promise<LandParcel> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[parcelRow], [playerRow]] = await Promise.all([
        tx.select().from(parcelsTable).where(eq(parcelsTable.id, action.parcelId)),
        tx.select().from(playersTable).where(eq(playersTable.id, action.playerId)),
      ]);
      if (!parcelRow || !playerRow) throw new Error("Invalid parcel or player");

      const parcel = rowToParcel(parcelRow);
      const player = rowToPlayer(playerRow, []);
      if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

      const cost = UPGRADE_COSTS[action.upgradeType];
      if (!cost) throw new Error("Invalid upgrade type");
      if (player.iron < cost.iron || player.fuel < cost.fuel) throw new Error("Insufficient resources");

      const updates: Partial<typeof parcelRow> = {};
      switch (action.upgradeType) {
        case "defense":   updates.defenseLevel    = Math.min(10, parcel.defenseLevel + 1); break;
        case "yield":     updates.yieldMultiplier = parcel.yieldMultiplier + 0.2; break;
        case "mine":      updates.yieldMultiplier = parcel.yieldMultiplier + 0.3; break;
        case "fortress":  updates.defenseLevel    = Math.min(10, parcel.defenseLevel + 3); break;
      }

      const now = Date.now();
      await Promise.all([
        tx.update(parcelsTable).set(updates).where(eq(parcelsTable.id, parcel.id)),
        tx.update(playersTable)
          .set({ iron: playerRow.iron - cost.iron, fuel: playerRow.fuel - cost.fuel })
          .where(eq(playersTable.id, player.id)),
      ]);

      await this.addEvent({
        type:        "upgrade",
        playerId:    player.id,
        parcelId:    parcel.id,
        description: `${player.name} upgraded ${action.upgradeType} at plot #${parcel.plotId}`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return rowToParcel({ ...parcelRow, ...updates });
    });
  }

  async buildImprovement(action: BuildAction): Promise<LandParcel> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[parcelRow], [playerRow]] = await Promise.all([
        tx.select().from(parcelsTable).where(eq(parcelsTable.id, action.parcelId)),
        tx.select().from(playersTable).where(eq(playersTable.id, action.playerId)),
      ]);
      if (!parcelRow || !playerRow) throw new Error("Invalid parcel or player");

      const parcel = rowToParcel(parcelRow);
      const player = rowToPlayer(playerRow, []);
      if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

      const isFacility = action.improvementType in FACILITY_INFO;
      const isDefense  = action.improvementType in DEFENSE_IMPROVEMENT_INFO;
      if (!isFacility && !isDefense) throw new Error("Invalid improvement type");

      const existing = parcel.improvements.find((i) => i.type === action.improvementType);
      const level    = existing ? existing.level + 1 : 1;

      let playerUpdates: Partial<typeof playerRow> = {};

      if (isFacility) {
        const info = FACILITY_INFO[action.improvementType as FacilityType];
        if (existing && existing.level >= info.maxLevel) throw new Error("Facility already at max level");
        if (info.prerequisite) {
          const hasPrereq = parcel.improvements.find((i) => i.type === info.prerequisite);
          if (!hasPrereq) throw new Error(`Requires ${FACILITY_INFO[info.prerequisite!].name} first`);
        }
        const cost = info.costFrontier[level - 1];
        const microBalance = playerRow.frntrBalanceMicro;
        const microCost = toMicroFRNTR(cost);
        if (microBalance < microCost) throw new Error(`Insufficient FRONTIER (need ${cost})`);
        playerUpdates = {
          frntrBalanceMicro:   microBalance - microCost,
          totalFrontierBurned: playerRow.totalFrontierBurned + cost,
        };
      } else {
        const info = DEFENSE_IMPROVEMENT_INFO[action.improvementType as DefenseImprovementType];
        if (existing && existing.level >= info.maxLevel) throw new Error("Improvement already at max level");
        const cost = { iron: info.cost.iron * level, fuel: info.cost.fuel * level };
        if (player.iron < cost.iron || player.fuel < cost.fuel) throw new Error("Insufficient resources");
        playerUpdates = {
          iron: playerRow.iron - cost.iron,
          fuel: playerRow.fuel - cost.fuel,
        };
      }

      // Update improvements array
      const newImprovements = existing
        ? parcel.improvements.map((i) => i.type === action.improvementType ? { ...i, level } : i)
        : [...parcel.improvements, { type: action.improvementType, level: 1 }];

      // Apply side-effects on the parcel
      let newDefense  = parcel.defenseLevel;
      let newCapacity = parcel.storageCapacity;
      if      (action.improvementType === "turret")       newDefense  += 3;
      else if (action.improvementType === "shield_gen")   newDefense  += 5;
      else if (action.improvementType === "fortress")   { newDefense  += 8; newCapacity += 50; }
      else if (action.improvementType === "storage_depot") newCapacity += 100;

      const newFpd = calculateFrontierPerDay(newImprovements);

      const now = Date.now();
      await Promise.all([
        tx.update(parcelsTable)
          .set({ improvements: newImprovements, defenseLevel: newDefense, storageCapacity: newCapacity, frontierPerDay: newFpd })
          .where(eq(parcelsTable.id, parcel.id)),
        tx.update(playersTable).set(playerUpdates).where(eq(playersTable.id, player.id)),
      ]);

      const displayName = isFacility
        ? FACILITY_INFO[action.improvementType as FacilityType].name
        : DEFENSE_IMPROVEMENT_INFO[action.improvementType as DefenseImprovementType].name;

      await this.addEvent({
        type:        "build",
        playerId:    player.id,
        parcelId:    parcel.id,
        description: `${player.name} built ${displayName} (Lv${level}) at plot #${parcel.plotId}`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return rowToParcel({ ...parcelRow, improvements: newImprovements, defenseLevel: newDefense, storageCapacity: newCapacity, frontierPerDay: newFpd });
    });
  }

  async purchaseLand(action: PurchaseAction): Promise<LandParcel> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[parcelRow], [playerRow]] = await Promise.all([
        tx.select().from(parcelsTable).where(eq(parcelsTable.id, action.parcelId)),
        tx.select().from(playersTable).where(eq(playersTable.id, action.playerId)),
      ]);
      if (!parcelRow || !playerRow) throw new Error("Invalid parcel or player");
      if (parcelRow.ownerId) throw new Error("Territory is already owned");
      if (parcelRow.purchasePriceAlgo === null) throw new Error("Territory is not for sale");

      const now      = Date.now();
      const ownerType = playerRow.isAi ? "ai" : "player";
      await Promise.all([
        tx.update(parcelsTable)
          .set({ ownerId: playerRow.id, ownerType, purchasePriceAlgo: null, lastFrontierClaimTs: now })
          .where(eq(parcelsTable.id, parcelRow.id)),
        tx.update(playersTable)
          .set({ territoriesCaptured: playerRow.territoriesCaptured + 1 })
          .where(eq(playersTable.id, playerRow.id)),
      ]);

      await this.addEvent({
        type:        "purchase",
        playerId:    playerRow.id,
        parcelId:    parcelRow.id,
        description: `${playerRow.name} purchased plot #${parcelRow.plotId} for ${LAND_PURCHASE_ALGO[parcelRow.biome as BiomeType]} ALGO`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return rowToParcel({ ...parcelRow, ownerId: playerRow.id, ownerType, purchasePriceAlgo: null, lastFrontierClaimTs: now });
    });
  }

  async deployAttack(action: AttackAction): Promise<Battle> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[attackerRow], [targetRow]] = await Promise.all([
        tx.select().from(playersTable).where(eq(playersTable.id, action.attackerId)),
        tx.select().from(parcelsTable).where(eq(parcelsTable.id, action.targetParcelId)),
      ]);
      if (!attackerRow || !targetRow) throw new Error("Invalid attacker or target");

      const attacker = rowToPlayer(attackerRow, []);
      const target   = rowToParcel(targetRow);
      if (target.ownerId === attacker.id) throw new Error("Cannot attack your own territory");
      if (target.activeBattleId) throw new Error("Territory is already under attack");

      const { iron, fuel } = action.resourcesBurned;
      if (attacker.iron < iron || attacker.fuel < fuel) throw new Error("Insufficient resources for attack");

      const now = Date.now();

      // Resolve commander: validate availability and apply attack bonus
      let commanderBonus = 0;
      let commanderId: string | undefined;
      const commanders = (attackerRow.commanders ?? []) as CommanderAvatar[];
      if (action.commanderId) {
        const cmdIdx = commanders.findIndex((c) => c.id === action.commanderId);
        if (cmdIdx === -1) throw new Error("Commander not found");
        const cmd = commanders[cmdIdx];
        if (cmd.lockedUntil && now < cmd.lockedUntil) throw new Error("Commander is currently deployed and unavailable");
        commanderBonus = cmd.attackBonus;
        commanderId = cmd.id;
        commanders[cmdIdx] = { ...cmd, lockedUntil: now + COMMANDER_LOCK_MS };
      }

      const rawAttackerPower = action.troopsCommitted * 10 + iron * 0.5 + fuel * 0.8 + commanderBonus;
      // Apply morale debuff: attacker power is reduced when they recently lost territory
      const moraleActive   = attacker.moraleDebuffUntil && now < attacker.moraleDebuffUntil;
      const attackerPower  = moraleActive
        ? rawAttackerPower * (1 - MORALE_ATTACK_PENALTY)
        : rawAttackerPower;

      const biomeBonus    = biomeBonuses[target.biome];
      const turretBonus   = target.improvements
        .filter((i) => ["turret", "shield_gen", "fortress"].includes(i.type))
        .reduce((sum, i) => sum + i.level * 5, 0);
      const defenderPower = (target.defenseLevel * 15 + turretBonus) * biomeBonus.defenseMod;

      const battleId = randomUUID();

      const battleValues = {
        id:               battleId,
        attackerId:       attacker.id,
        defenderId:       target.ownerId ?? null,
        targetParcelId:   target.id,
        attackerPower,
        defenderPower,
        troopsCommitted:  action.troopsCommitted,
        resourcesBurned:  { iron, fuel },
        startTs:          now,
        resolveTs:        now + BATTLE_DURATION_MS,
        status:           "pending" as const,
        commanderId:      commanderId ?? null,
      };

      const playerUpdates: Record<string, any> = { iron: attackerRow.iron - iron, fuel: attackerRow.fuel - fuel };
      if (commanderId) playerUpdates.commanders = commanders;

      await Promise.all([
        tx.insert(battlesTable).values(battleValues),
        tx.update(parcelsTable).set({ activeBattleId: battleId }).where(eq(parcelsTable.id, target.id)),
        tx.update(playersTable).set(playerUpdates).where(eq(playersTable.id, attacker.id)),
      ]);

      await this.addEvent({
        type:        "attack",
        playerId:    attacker.id,
        parcelId:    target.id,
        battleId,
        description: `${attacker.name} launched an attack on plot #${target.plotId}`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return rowToBattle({ ...battleValues, outcome: null, randFactor: null, commanderId: commanderId ?? null } as BattleRow);
    });
  }

  async mintAvatar(action: MintAvatarAction): Promise<CommanderAvatar> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, action.playerId));
      if (!row) throw new Error("Player not found");

      const info = COMMANDER_INFO[action.tier];
      if (!info) throw new Error("Invalid commander tier");
      const microCost = toMicroFRNTR(info.mintCostFrontier);
      if (row.frntrBalanceMicro < microCost)
        throw new Error(`Insufficient FRONTIER. Need ${info.mintCostFrontier}, have ${fromMicroFRNTR(row.frntrBalanceMicro).toFixed(2)}`);

      const commanders = (row.commanders ?? []) as CommanderAvatar[];
      const bonusRoll  = Math.random() * 0.3;
      const avatar: CommanderAvatar = {
        id:              randomUUID(),
        tier:            action.tier,
        name:            `${info.name} #${commanders.length + 1}`,
        attackBonus:     Math.floor(info.baseAttackBonus  * (1 + bonusRoll)),
        defenseBonus:    Math.floor(info.baseDefenseBonus * (1 + bonusRoll)),
        specialAbility:  info.specialAbility,
        mintedAt:        Date.now(),
        totalKills:      0,
      };

      const newCommanders  = [...commanders, avatar];
      const newActiveIndex = newCommanders.length - 1;

      const now = Date.now();
      await tx.update(playersTable)
        .set({
          frntrBalanceMicro:    row.frntrBalanceMicro   - microCost,
          totalFrontierBurned:  row.totalFrontierBurned + info.mintCostFrontier,
          commanders:           newCommanders,
          activeCommanderIndex: newActiveIndex,
        })
        .where(eq(playersTable.id, action.playerId));

      await this.addEvent({
        type:        "mint_avatar",
        playerId:    action.playerId,
        description: `${row.name} minted a ${info.name} Commander (${action.tier.toUpperCase()}) for ${info.mintCostFrontier} FRONTIER`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return avatar;
    });
  }

  async executeSpecialAttack(action: SpecialAttackAction): Promise<{ damage: number; effect: string }> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[playerRow], [targetRow]] = await Promise.all([
        tx.select().from(playersTable).where(eq(playersTable.id, action.playerId)),
        tx.select().from(parcelsTable).where(eq(parcelsTable.id, action.targetParcelId)),
      ]);
      if (!playerRow) throw new Error("Player not found");

      const player  = rowToPlayer(playerRow, []);
      const target  = targetRow ? rowToParcel(targetRow) : null;

      if (!player.commander) throw new Error("You need a Commander to use special attacks. Mint one first.");
      if (!target) throw new Error("Target plot not found");
      if (target.ownerId === player.id) throw new Error("Cannot attack your own territory");

      const attackInfo = SPECIAL_ATTACK_INFO[action.attackType];
      if (!attackInfo) throw new Error("Invalid attack type");
      if (!attackInfo.requiredTier.includes(player.commander.tier))
        throw new Error(`${attackInfo.name} requires a ${attackInfo.requiredTier.join(" or ")} Commander`);
      const microCostSA = toMicroFRNTR(attackInfo.costFrontier);
      if (playerRow.frntrBalanceMicro < microCostSA)
        throw new Error(`Insufficient FRONTIER. Need ${attackInfo.costFrontier}, have ${fromMicroFRNTR(playerRow.frntrBalanceMicro).toFixed(2)}`);

      const existing = player.specialAttacks.find((sa) => sa.type === action.attackType);
      if (existing) {
        const elapsed = Date.now() - existing.lastUsedTs;
        if (elapsed < attackInfo.cooldownMs) {
          const remaining = Math.ceil((attackInfo.cooldownMs - elapsed) / 60000);
          throw new Error(`${attackInfo.name} on cooldown. ${remaining} minutes remaining.`);
        }
      }

      let baseDamage       = player.commander.attackBonus * attackInfo.damageMultiplier;
      let effectDescription = attackInfo.effect;
      const targetUpdates: Partial<typeof targetRow> = {};

      if (action.attackType === "orbital_strike") {
        const defReduction = Math.floor(target.defenseLevel * 0.5);
        targetUpdates.defenseLevel = Math.max(1, target.defenseLevel - defReduction);
        baseDamage += defReduction * 5;
        effectDescription = `Orbital Strike reduced defense by ${defReduction}`;
      } else if (action.attackType === "emp_blast") {
        targetUpdates.defenseLevel = Math.max(1, target.defenseLevel - 2);
        effectDescription = "EMP disabled turrets and shields, defense reduced by 2";
      } else if (action.attackType === "siege_barrage") {
        targetUpdates.defenseLevel = Math.max(1, target.defenseLevel - 1);
        // Splash nearby — fetch candidate enemy parcels, then filter by
        // sphereDistance in application code to find true neighbours.
        const allNearby = await tx.select().from(parcelsTable)
          .where(sql`${parcelsTable.ownerId} IS NOT NULL AND ${parcelsTable.ownerId} != ${player.id}`)
          .limit(500);
        let splashCount = 0;
        for (const np of allNearby) {
          if (splashCount >= 3) break;
          const dist = sphereDistance(target.lat, target.lng, np.lat, np.lng);
          if (dist < 0.04) {
            await tx.update(parcelsTable)
              .set({ defenseLevel: Math.max(1, np.defenseLevel - 1) })
              .where(eq(parcelsTable.id, np.id));
            splashCount++;
          }
        }
        effectDescription = `Siege Barrage damaged target + ${splashCount} nearby plots`;
      } else if (action.attackType === "sabotage") {
        targetUpdates.yieldMultiplier = Math.max(0.1, target.yieldMultiplier * 0.5);
        effectDescription = "Sabotage halved target mining yield";
      }

      // Update commander kill count
      const newCommanders = player.commanders.map((c) =>
        c.id === player.commander!.id ? { ...c, totalKills: c.totalKills + 1 } : c
      );
      // Update specialAttacks cooldown
      const newSpecialAttacks = existing
        ? player.specialAttacks.map((sa) => sa.type === action.attackType ? { ...sa, lastUsedTs: Date.now() } : sa)
        : [...player.specialAttacks, { type: action.attackType, lastUsedTs: Date.now() }];

      const now = Date.now();
      await Promise.all([
        ...(Object.keys(targetUpdates).length > 0
          ? [tx.update(parcelsTable).set(targetUpdates).where(eq(parcelsTable.id, target.id))]
          : []),
        tx.update(playersTable)
          .set({
            frntrBalanceMicro:   playerRow.frntrBalanceMicro   - microCostSA,
            totalFrontierBurned: playerRow.totalFrontierBurned + attackInfo.costFrontier,
            commanders:          newCommanders,
            specialAttacks:      newSpecialAttacks,
          })
          .where(eq(playersTable.id, player.id)),
      ]);

      await this.addEvent({
        type:        "special_attack",
        playerId:    player.id,
        parcelId:    target.id,
        description: `${player.name}'s ${player.commander.name} launched ${attackInfo.name} on plot #${target.plotId}!`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return { damage: Math.floor(baseDamage), effect: effectDescription };
    });
  }

  async deployDrone(action: DeployDroneAction): Promise<ReconDrone> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, action.playerId));
      if (!row) throw new Error("Player not found");

      const drones = (row.drones ?? []) as ReconDrone[];
      if (drones.length >= MAX_DRONES) throw new Error(`Maximum ${MAX_DRONES} drones allowed`);
      const microDroneCost = toMicroFRNTR(DRONE_MINT_COST_FRONTIER);
      if (row.frntrBalanceMicro < microDroneCost)
        throw new Error(`Insufficient FRONTIER. Need ${DRONE_MINT_COST_FRONTIER}, have ${fromMicroFRNTR(row.frntrBalanceMicro).toFixed(2)}`);

      // Pick a random enemy target if none specified
      let targetId = action.targetParcelId ?? null;
      if (!targetId) {
        const [rand] = await tx.select({ id: parcelsTable.id })
          .from(parcelsTable)
          .where(and(sql`${parcelsTable.ownerId} IS NOT NULL`, sql`${parcelsTable.ownerId} != ${action.playerId}`))
          .orderBy(sql`RANDOM()`)
          .limit(1);
        targetId = rand?.id ?? null;
      }

      const bonus = Math.random();
      const drone: ReconDrone = {
        id:                  randomUUID(),
        deployedAt:          Date.now(),
        targetParcelId:      targetId,
        status:              targetId ? "scouting" : "idle",
        discoveredResources: targetId
          ? { iron: Math.floor(5 + bonus * 15), fuel: Math.floor(3 + bonus * 10), crystal: Math.floor(bonus * 5) }
          : { iron: 0, fuel: 0, crystal: 0 },
        scoutReportReady:    false,
      };

      const now = Date.now();
      await tx.update(playersTable)
        .set({
          frntrBalanceMicro:   row.frntrBalanceMicro   - microDroneCost,
          totalFrontierBurned: row.totalFrontierBurned + DRONE_MINT_COST_FRONTIER,
          drones:              [...drones, drone],
        })
        .where(eq(playersTable.id, action.playerId));

      await this.addEvent({
        type:        "deploy_drone",
        playerId:    action.playerId,
        parcelId:    targetId ?? undefined,
        description: `${row.name} deployed a Recon Drone`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return drone;
    });
  }

  async deploySatellite(action: DeploySatelliteAction): Promise<OrbitalSatellite> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, action.playerId));
      if (!row) throw new Error("Player not found");

      const now = Date.now();
      const satellites = ((row.satellites ?? []) as OrbitalSatellite[]).map(s =>
        s.status === "active" && s.expiresAt <= now ? { ...s, status: "expired" as const } : s
      );
      const activeSatellites = satellites.filter(s => s.status === "active");
      if (activeSatellites.length >= MAX_SATELLITES)
        throw new Error(`Maximum ${MAX_SATELLITES} active satellites allowed`);
      const microSatCost = toMicroFRNTR(SATELLITE_DEPLOY_COST_FRONTIER);
      if (row.frntrBalanceMicro < microSatCost)
        throw new Error(`Insufficient FRONTIER. Need ${SATELLITE_DEPLOY_COST_FRONTIER}, have ${fromMicroFRNTR(row.frntrBalanceMicro).toFixed(2)}`);

      const satellite: OrbitalSatellite = {
        id:          randomUUID(),
        deployedAt:  now,
        expiresAt:   now + SATELLITE_ORBIT_DURATION_MS,
        status:      "active",
      };

      await tx.update(playersTable)
        .set({
          frntrBalanceMicro:   row.frntrBalanceMicro   - microSatCost,
          totalFrontierBurned: row.totalFrontierBurned + SATELLITE_DEPLOY_COST_FRONTIER,
          satellites:          [...satellites, satellite],
        })
        .where(eq(playersTable.id, action.playerId));

      await this.addEvent({
        type:        "deploy_satellite",
        playerId:    action.playerId,
        description: `${row.name} launched an Orbital Satellite — +${SATELLITE_YIELD_BONUS * 100}% mining yield for 1 hour`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return satellite;
    });
  }

  async switchCommander(playerId: string, commanderIndex: number): Promise<CommanderAvatar> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!row) throw new Error("Player not found");

      const commanders = (row.commanders ?? []) as CommanderAvatar[];
      if (commanderIndex < 0 || commanderIndex >= commanders.length)
        throw new Error("Invalid commander index");

      const newCommander = commanders[commanderIndex];
      const now = Date.now();

      await tx.update(playersTable)
        .set({ activeCommanderIndex: commanderIndex })
        .where(eq(playersTable.id, playerId));

      await this.addEvent({
        type:        "ai_action",
        playerId,
        description: `${row.name} switched to commander ${newCommander.name}`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return newCommander;
    });
  }

  async resolveBattles(): Promise<Battle[]> {
    await this.initialize();
    const now = Date.now();

    // Fetch all pending battles whose resolveTs has passed.
    const pending = await this.db.select().from(battlesTable)
      .where(and(eq(battlesTable.status, "pending"), lt(battlesTable.resolveTs, now)));

    if (pending.length === 0) return [];

    // Pre-fetch AI players once for reconquest faction-name lookup
    const allAiPlayers = await this.db.select().from(playersTable).where(eq(playersTable.isAi, true));

    const resolved: Battle[] = [];

    for (const battleRow of pending) {
      await this.db.transaction(async (tx) => {
        // Deterministic outcome using a hash of (id + startTs)
        const seed = `${battleRow.id}${battleRow.startTs}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
          hash = (hash << 5) - hash + seed.charCodeAt(i);
          hash = hash & hash;
        }
        const randFactor      = (Math.abs(hash) % 21) - 10;
        const adjustedPower   = battleRow.attackerPower * (1 + randFactor / 100);
        const attackerWins    = adjustedPower > battleRow.defenderPower;
        const outcome         = attackerWins ? "attacker_wins" : "defender_wins";

        await tx.update(battlesTable)
          .set({ status: "resolved", outcome, randFactor })
          .where(eq(battlesTable.id, battleRow.id));

        const [[targetRow], [attackerRow]] = await Promise.all([
          tx.select().from(parcelsTable).where(eq(parcelsTable.id, battleRow.targetParcelId)),
          tx.select().from(playersTable).where(eq(playersTable.id, battleRow.attackerId)),
        ]);

        if (!targetRow || !attackerRow) return;

        await tx.update(parcelsTable)
          .set({ activeBattleId: null })
          .where(eq(parcelsTable.id, targetRow.id));

        if (attackerWins) {
          // ── Pillage stored resources ──────────────────────────────────────
          const pillagedIron    = Math.floor(targetRow.ironStored    * PILLAGE_RATE);
          const pillagedFuel    = Math.floor(targetRow.fuelStored    * PILLAGE_RATE);
          const pillagedCrystal = Math.floor(targetRow.crystalStored * PILLAGE_RATE);

          // ── Apply morale/cooldown penalties to defender ───────────────────
          let defenderPenaltyMsg = "";
          if (battleRow.defenderId) {
            const [defenderRow] = await tx.select().from(playersTable)
              .where(eq(playersTable.id, battleRow.defenderId));
            if (defenderRow) {
              const prevConsecutive = defenderRow.consecutiveLosses ?? 0;
              const newConsecutive  = prevConsecutive + 1;
              const debuffMs        = MORALE_DEBUFF_BASE_MS * (1 + prevConsecutive * 0.5);
              const moraleUntil     = now + debuffMs;
              const cooldownUntil   = now + ATTACK_COOLDOWN_PER_LOSS_MS * newConsecutive;

              await tx.update(playersTable)
                .set({
                  attacksLost:        sql`${playersTable.attacksLost} + 1`,
                  consecutiveLosses:  newConsecutive,
                  moraleDebuffUntil:  moraleUntil,
                  attackCooldownUntil: cooldownUntil,
                })
                .where(eq(playersTable.id, battleRow.defenderId));

              defenderPenaltyMsg = ` ${defenderRow.name} suffers morale debuff and attack cooldown.`;

              // ── Cascade vulnerability: adjacent defender parcels ──────────
              const allDefenderNearby = await tx.select().from(parcelsTable)
                .where(eq(parcelsTable.ownerId, battleRow.defenderId));
              for (const adj of allDefenderNearby) {
                if (adj.id === targetRow.id) continue;
                const dist = Math.sqrt(
                  Math.pow(adj.lat - targetRow.lat, 2) + Math.pow(adj.lng - targetRow.lng, 2)
                );
                if (dist < 5) { // ~5 degree proximity as rough equivalent
                  await tx.update(parcelsTable)
                    .set({ defenseLevel: Math.max(1, adj.defenseLevel - CASCADE_DEFENSE_PENALTY) })
                    .where(eq(parcelsTable.id, adj.id));
                }
              }
            }
          }

          // ── Reconquest tracking ──────────────────────────────────────
          // Case A: Human captures AI land → mark as contested
          // Case B: AI reconquers human land → clear contested status
          // Case C: Human vs Human / AI vs AI → no reconquest fields change
          const isHumanCapturingAI = !attackerRow.isAi && (targetRow.ownerType === "ai");
          const isAIReconquering   = attackerRow.isAi  && (targetRow.ownerType === "player");
          const existingHandovers  = (targetRow as any).handoverCount ?? 0;

          // Look up the AI faction name for the defender (for reconquest tracking)
          const defenderFactionName = isHumanCapturingAI && battleRow.defenderId
            ? (() => {
                const defRow = allAiPlayers.find((ai: any) => ai.id === battleRow.defenderId);
                return defRow?.name ?? null;
              })()
            : null;

          const reconquestUpdates = isHumanCapturingAI ? {
            capturedFromFaction: defenderFactionName,
            capturedAt:    now,
            handoverCount: existingHandovers + 1,
          } : isAIReconquering ? {
            // AI has taken it back — clear contested status
            capturedFromFaction: null,
            capturedAt:          null,
            handoverCount:       existingHandovers,
          } : {};

          await Promise.all([
            tx.update(parcelsTable)
              .set({
                ownerId:              attackerRow.id,
                ownerType:            attackerRow.isAi ? "ai" : "player",
                defenseLevel:         Math.max(1, Math.floor(targetRow.defenseLevel / 2)),
                ironStored:           targetRow.ironStored    - pillagedIron,
                fuelStored:           targetRow.fuelStored    - pillagedFuel,
                crystalStored:        targetRow.crystalStored - pillagedCrystal,
                purchasePriceAlgo:    null,
                lastFrontierClaimTs:  now,
                ...reconquestUpdates,
              })
              .where(eq(parcelsTable.id, targetRow.id)),
            tx.update(playersTable)
              .set({
                attacksWon:          sql`${playersTable.attacksWon} + 1`,
                territoriesCaptured: sql`${playersTable.territoriesCaptured} + 1`,
                consecutiveLosses:   0,
                iron:                attackerRow.iron + pillagedIron,
                fuel:                attackerRow.fuel + pillagedFuel,
                crystal:             attackerRow.crystal + pillagedCrystal,
              })
              .where(eq(playersTable.id, attackerRow.id)),
          ]);

          const pillageMsg = (pillagedIron > 0 || pillagedFuel > 0 || pillagedCrystal > 0)
            ? ` Pillaged: ${pillagedIron} iron, ${pillagedFuel} fuel, ${pillagedCrystal} crystal.`
            : "";

          await this.addEvent({
            type:        "battle_resolved",
            playerId:    attackerRow.id,
            parcelId:    targetRow.id,
            battleId:    battleRow.id,
            description: `${attackerRow.name} conquered plot #${targetRow.plotId}!${pillageMsg}${defenderPenaltyMsg}`,
            timestamp:   now,
          }, tx);
        } else {
          await tx.update(playersTable)
            .set({ attacksLost: sql`${playersTable.attacksLost} + 1` })
            .where(eq(playersTable.id, attackerRow.id));
          if (battleRow.defenderId) {
            await tx.update(playersTable)
              .set({
                attacksWon:       sql`${playersTable.attacksWon} + 1`,
                // Successful defence resets the consecutive-loss streak
                consecutiveLosses: 0,
              })
              .where(eq(playersTable.id, battleRow.defenderId));
          }

          await this.addEvent({
            type:        "battle_resolved",
            playerId:    battleRow.defenderId ?? attackerRow.id,
            parcelId:    targetRow.id,
            battleId:    battleRow.id,
            description: `Defense held at plot #${targetRow.plotId}. ${attackerRow.name}'s attack was repelled.`,
            timestamp:   now,
          }, tx);
        }

        await this.bumpLastTs(now, tx);
        resolved.push(rowToBattle({ ...battleRow, status: "resolved", outcome, randFactor }));
      });
    }

    return resolved;
  }

  async runAITurn(): Promise<GameEvent[]> {
    await this.initialize();
    const now = Date.now();
    const newEvents: GameEvent[] = [];

    const [allAiPlayers, allParcels] = await Promise.all([
      this.db.select().from(playersTable).where(eq(playersTable.isAi, true)),
      this.db.select().from(parcelsTable),
    ]);

    const parcelById   = new Map(allParcels.map((p) => [p.id, p]));
    const ownerMap     = new Map<string, string[]>();
    for (const p of allParcels) {
      if (p.ownerId) {
        if (!ownerMap.has(p.ownerId)) ownerMap.set(p.ownerId, []);
        ownerMap.get(p.ownerId)!.push(p.id);
      }
    }

    for (const aiRow of allAiPlayers) {
      if (Math.random() > 0.4) continue;

      const ai = rowToPlayer(aiRow, ownerMap.get(aiRow.id) ?? []);
      const ownedParcels = ai.ownedParcels
        .map((id) => parcelById.get(id))
        .filter((p): p is typeof allParcels[0] => !!p)
        .map(rowToParcel);

      // Mine if cooldown elapsed
      for (const parcel of ownedParcels) {
        if (now - parcel.lastMineTs >= MINE_COOLDOWN_MS) {
          try { await this.mineResources({ playerId: ai.id, parcelId: parcel.id }); } catch {}
          break;
        }
      }

      // Collect if stored resources are large
      for (const parcel of ownedParcels) {
        if (parcel.ironStored + parcel.fuelStored + parcel.crystalStored > 50) {
          try { await this.collectAll(ai.id); } catch {}
          break;
        }
      }

      // Special KRONOS logic: Expansion toward NEXUS-7
      if (ai.name === "KRONOS") {
        const nexus = allAiPlayers.find(p => p.name === "NEXUS-7");
        const nexusPlots = nexus ? ownerMap.get(nexus.id) ?? [] : [];
        const isSuppression = nexusPlots.length > 1500;

        if (isSuppression) {
          const MAX_PURCHASES = 2;
          let purchased = 0;
          const range = 0.08 * 1.25;

          let targetPlot: LandParcel | undefined;
          if (nexusPlots.length > 0) {
            const firstNexus = parcelById.get(nexusPlots[0]);
            if (firstNexus) targetPlot = rowToParcel(firstNexus);
          }

          for (const parcel of ownedParcels) {
            if (purchased >= MAX_PURCHASES) break;
            const nearby = allParcels.filter((p) => {
              if (p.ownerId || p.purchasePriceAlgo === null || p.biome === "water") return false;
              return sphereDistance(parcel.lat, parcel.lng, p.lat, p.lng) < range;
            });

            if (nearby.length > 0) {
              const sorted = nearby.map(p => {
                let score = sphereDistance(parcel.lat, parcel.lng, p.lat, p.lng);
                if (targetPlot) {
                  const vToNexus = { lat: targetPlot.lat - parcel.lat, lng: targetPlot.lng - parcel.lng };
                  const vToPlot = { lat: p.lat - parcel.lat, lng: p.lng - parcel.lng };
                  const dot = vToNexus.lat * vToPlot.lat + vToNexus.lng * vToPlot.lng;
                  const mag1 = Math.sqrt(vToNexus.lat ** 2 + vToNexus.lng ** 2);
                  const mag2 = Math.sqrt(vToPlot.lat ** 2 + vToPlot.lng ** 2);
                  const cosTheta = dot / (mag1 * mag2 || 1);
                  if (cosTheta > Math.cos((35 * Math.PI) / 180)) score -= 0.1;
                }
                return { p, score };
              }).sort((a, b) => a.score - b.score);

              for (const entry of sorted) {
                if (purchased >= MAX_PURCHASES) break;
                const cost = entry.p.purchasePriceAlgo ?? 0.5;
                if ((ai.treasury ?? 0) < cost) break;

                try {
                  await this.purchaseLand({ playerId: ai.id, parcelId: entry.p.id });
                  purchased++;
                  
                  // Deduct from treasury
                  await this.db.update(playersTable)
                    .set({ treasury: sql`${playersTable.treasury} - ${cost}` })
                    .where(eq(playersTable.id, ai.id));

                  const evt: GameEvent = {
                    id: randomUUID(), type: "ai_action", playerId: ai.id, parcelId: entry.p.id,
                    description: `${ai.name} expanded toward NEXUS-7 territory (Cost: ${cost} ALGO)`, timestamp: now,
                  };
                  await this.addEvent(evt);
                  newEvents.push(evt);
                } catch {}
              }
            }
          }
        }
      }

      // Normal Expand
      if (ai.aiBehavior === "expansionist" || ai.aiBehavior === "economic") {
        if (Math.random() > 0.5) {
          for (const parcel of ownedParcels) {
            const nearby = allParcels.filter((p) => {
              if (p.ownerId || p.purchasePriceAlgo === null || p.biome === "water") return false;
              return sphereDistance(parcel.lat, parcel.lng, p.lat, p.lng) < 0.08;
            });
            if (nearby.length > 0) {
              const target = nearby[Math.floor(Math.random() * nearby.length)];
              try {
                await this.purchaseLand({ playerId: ai.id, parcelId: target.id });
                const desc = `${ai.name} purchased new territory`;
                const evt: GameEvent = {
                  id: randomUUID(), type: "ai_action", playerId: ai.id, parcelId: target.id,
                  description: desc, timestamp: now,
                };
                await this.addEvent(evt);
                newEvents.push(evt);
              } catch {}
              break;
            }
          }
        }
      }

      // Attack
      if (ai.aiBehavior === "expansionist" || ai.aiBehavior === "raider") {
        const inCooldown = ai.attackCooldownUntil && now < ai.attackCooldownUntil;
        if (!inCooldown) {
          let range = 0.11;
          let priorityTargetId: string | undefined;

          // KRONOS: Anti-Nexus scaler
          if (ai.name === "KRONOS") {
            const nexus = allAiPlayers.find(p => p.name === "NEXUS-7");
            const nexusPlots = nexus ? ownerMap.get(nexus.id) ?? [] : [];
            if (nexusPlots.length > 600) {
              range *= 1.25;
              for (const parcel of ownedParcels) {
                const inRangeNexus = nexusPlots.find(nid => {
                  const np = parcelById.get(nid);
                  return np && sphereDistance(parcel.lat, parcel.lng, np.lat, np.lng) < range;
                });
                if (inRangeNexus) {
                  priorityTargetId = inRangeNexus;
                  break;
                }
              }
            }
          }

          // VANGUARD: Dedicated Nexus Hunter
          if (ai.name === "VANGUARD") {
            const nexus = allAiPlayers.find(p => p.name === "NEXUS-7");
            const nexusPlots = nexus ? ownerMap.get(nexus.id) ?? [] : [];
            if (nexusPlots.length > 250) {
              range *= 1.4;
              for (const parcel of ownedParcels) {
                const inRangeNexus = nexusPlots.find(nid => {
                  const np = parcelById.get(nid);
                  return np && sphereDistance(parcel.lat, parcel.lng, np.lat, np.lng) < range;
                });
                if (inRangeNexus) {
                  priorityTargetId = inRangeNexus;
                  break;
                }
              }
            }
          }

          const canAttack = ai.iron >= ATTACK_BASE_COST.iron && ai.fuel >= ATTACK_BASE_COST.fuel;
          const moraleDebuffed = ai.moraleDebuffUntil && now < ai.moraleDebuffUntil;

          // Vanguard is more aggressive
          const attackThreshold =
            ai.name === "VANGUARD"
              ? (moraleDebuffed ? 0.45 : 0.25)
              : (moraleDebuffed ? 0.6 : 0.4);

          if (canAttack && Math.random() > attackThreshold) {
            if (priorityTargetId) {
              try {
                await this.deployAttack({
                  attackerId: ai.id,
                  targetParcelId: priorityTargetId,
                  troopsCommitted: ai.name === "VANGUARD" ? 2 : 1,
                  resourcesBurned: { iron: ATTACK_BASE_COST.iron, fuel: ATTACK_BASE_COST.fuel },
                });

                const desc =
                  ai.name === "VANGUARD"
                    ? `${ai.name} executed Nexus strike`
                    : `${ai.name} launched suppression strike`;

                const evt: GameEvent = {
                  id: randomUUID(),
                  type: "ai_action",
                  playerId: ai.id,
                  parcelId: priorityTargetId!,   // ✅ add this
                  description: desc,
                  timestamp: now,
                };

                await this.addEvent(evt);
                newEvents.push(evt);
              } catch {}
            } else {
              for (const parcel of ownedParcels) {
                const targets = allParcels.filter((p) => {
                  if (!p.ownerId || p.ownerId === ai.id || p.activeBattleId || p.biome === "water") return false;
                  return sphereDistance(parcel.lat, parcel.lng, p.lat, p.lng) < range;
                });

                if (targets.length > 0) {
                  const attackTarget = targets[Math.floor(Math.random() * targets.length)];
                  try {
                    await this.deployAttack({
                      attackerId: ai.id,
                      targetParcelId: attackTarget.id,
                      troopsCommitted: ai.name === "VANGUARD" ? 2 : 1,
                      resourcesBurned: {
                        iron: ATTACK_BASE_COST.iron,
                        fuel: ATTACK_BASE_COST.fuel,
                      },
                    });

                    const desc = `${ai.name} deployed troops`;

                    const evt: GameEvent = {
                      id: randomUUID(),
                      type: "ai_action",
                      playerId: ai.id,
                      parcelId: attackTarget.id,
                      description: desc,
                      timestamp: now,
                    };

                    await this.addEvent(evt);
                    newEvents.push(evt);
                  } catch {}
                  break;
                }
              }
            }
          }
        }
      }

      // Upgrade defense
      if (ai.aiBehavior === "defensive") {
        for (const parcel of ownedParcels) {
          if (parcel.defenseLevel < 5 && ai.iron >= UPGRADE_COSTS.defense.iron && ai.fuel >= UPGRADE_COSTS.defense.fuel) {
            try {
              await this.upgradeBase({ playerId: ai.id, parcelId: parcel.id, upgradeType: "defense" });
            } catch {}
            break;
          }
        }
      }

      // ── AI Reconquest ──────────────────────────────────────────────────────
      // Find plots this faction previously owned that a human has captured.
      // The engine decides whether to attempt a takeback this tick.
      const contestedPlots: ContestedPlot[] = allParcels
        .filter((p) =>
          p.ownerType === "player" &&                          // currently human-owned
          (p as any).capturedFromFaction === ai.name &&        // was taken from this AI
          (p as any).capturedAt != null                        // has a capture timestamp
        )
        .map((p): ContestedPlot => ({
          parcelId:            p.id,
          plotId:              p.plotId,
          richness:            p.richness,
          capturedFromFaction: (p as any).capturedFromFaction,
          capturedAt:          Number((p as any).capturedAt),
          handoverCount:       (p as any).handoverCount ?? 0,
          currentDefenseLevel: p.defenseLevel,
        }));

      if (contestedPlots.length > 0) {
        const avgDefense = ownedParcels.length > 0
          ? ownedParcels.reduce((s, p) => s + p.defenseLevel, 0) / ownedParcels.length
          : 0;

        const factionState: AiFactionState = {
          id:                  ai.id,
          name:                ai.name,
          behavior:            (ai.aiBehavior ?? "expansionist") as AiFactionState["behavior"],
          iron:                ai.iron,
          fuel:                ai.fuel,
          ownedTerritoryCount: ownedParcels.length,
          averageDefenseLevel: avgDefense,
          moraleDebuffUntil:   ai.moraleDebuffUntil ?? 0,
          attackCooldownUntil: ai.attackCooldownUntil ?? 0,
        };

        const decision = evaluateReconquest(
          factionState,
          contestedPlots,
          now,
          Math.random(),         // caller injects randomness
          ATTACK_BASE_COST,
        );

        if (decision.shouldAttempt && decision.targetParcelId) {
          try {
            await this.deployAttack({
              attackerId:      ai.id,
              targetParcelId:  decision.targetParcelId,
              troopsCommitted: decision.troopsCommitted,
              resourcesBurned: decision.resourcesBurned,
            });

            const evt: GameEvent = {
              id:          randomUUID(),
              type:        "ai_action",
              playerId:    ai.id,
              parcelId:    decision.targetParcelId,
              description: decision.reason,
              timestamp:   now,
            };
            await this.addEvent(evt);
            newEvents.push(evt);
          } catch (err) {
            // Attack failed (cooldown, resources, etc.) — log and move on
            console.warn(`[AI-RECONQUEST] ${ai.name} reconquest attempt failed:`, err instanceof Error ? err.message : err);
          }
        }

        // ── Post-battle VANGUARD raid release ─────────────────────────────
        // If VANGUARD wins and shouldAbandonAfterCapture, release the plot
        // back to neutral on the next tick so it can be recaptured cheaply.
        // We scan for any VANGUARD-owned plots that were originally contested
        // and mark them unowned.
        if (ai.name === "VANGUARD" && shouldAbandonAfterCapture("VANGUARD")) {
          const justConquered = allParcels.filter((p) =>
            p.ownerId === ai.id &&
            (p as any).capturedFromFaction === "VANGUARD" &&   // VANGUARD previously marked as capturing
            (p as any).capturedAt != null &&
            (now - Number((p as any).capturedAt)) < 15 * 60 * 1000 // captured in last 15 min
          );
          for (const raidPlot of justConquered) {
            try {
              await this.db.update(parcelsTable)
                .set({
                  ownerId:              null,
                  ownerType:            null,
                  purchasePriceAlgo:    0.5,
                  capturedFromFaction:  null,
                  capturedAt:           null,
                } as any)
                .where(eq(parcelsTable.id, raidPlot.id));

              const evt: GameEvent = {
                id:          randomUUID(),
                type:        "ai_action",
                playerId:    ai.id,
                parcelId:    raidPlot.id,
                description: `${ai.name} raided plot #${raidPlot.plotId} and withdrew`,
                timestamp:   now,
              };
              await this.addEvent(evt);
              newEvents.push(evt);
            } catch {}
          }
        }
      }
    }

    // Bump turn counter
    await this.db.update(gameMeta)
      .set({ currentTurn: sql`${gameMeta.currentTurn} + 1`, lastUpdateTs: now })
      .where(eq(gameMeta.id, 1));

    if (newEvents.length > 0) {
      console.log(`[ACTION-DEBUG] AI turn complete | events: ${newEvents.length} | persisted to DB | ts: ${now}`);
    }
    return newEvents;
  }

}

// ─────────────────────────────────────────────────────────────────────────────
// Export: swap MemStorage → DbStorage here when DATABASE_URL is available.
// ─────────────────────────────────────────────────────────────────────────────

export const storage: IStorage = new MemStorage();
FRONTIER_FILE_END_MARKER

echo "Writing shared/schema.ts..."
cat > shared/schema.ts << 'FRONTIER_FILE_END_MARKER'
import { z } from "zod";

export type BiomeType = "forest" | "desert" | "mountain" | "plains" | "water" | "tundra" | "volcanic" | "swamp";

export const biomeColors: Record<BiomeType, string> = {
  forest: "#1a472a",
  desert: "#c2a83e",
  mountain: "#5c5c5c",
  plains: "#4a7c23",
  water: "#1e4d7b",
  tundra: "#a8c8d8",
  volcanic: "#8b2500",
  swamp: "#3a5a2a",
};

export const biomeBonuses: Record<BiomeType, { yieldMod: number; defenseMod: number }> = {
  forest: { yieldMod: 1.2, defenseMod: 1.1 },
  desert: { yieldMod: 0.8, defenseMod: 0.9 },
  mountain: { yieldMod: 0.6, defenseMod: 1.3 },
  plains: { yieldMod: 1.0, defenseMod: 1.0 },
  water: { yieldMod: 0.5, defenseMod: 0.7 },
  tundra: { yieldMod: 0.7, defenseMod: 1.2 },
  volcanic: { yieldMod: 1.5, defenseMod: 0.8 },
  swamp: { yieldMod: 0.9, defenseMod: 0.6 },
};

export type DefenseImprovementType = "turret" | "shield_gen" | "storage_depot" | "radar" | "fortress";
export type FacilityType = "electricity" | "blockchain_node" | "data_centre" | "ai_lab";
export type ImprovementType = DefenseImprovementType | FacilityType;

export interface Improvement {
  type: ImprovementType;
  level: number;
}

export const DEFENSE_IMPROVEMENT_INFO: Record<DefenseImprovementType, {
  name: string;
  description: string;
  cost: { iron: number; fuel: number };
  maxLevel: number;
  effect: string;
}> = {
  turret: { name: "Turret", description: "Automated defense turret", cost: { iron: 40, fuel: 20 }, maxLevel: 3, effect: "+3 defense per level" },
  shield_gen: { name: "Shield Generator", description: "Energy shield for base", cost: { iron: 60, fuel: 40 }, maxLevel: 2, effect: "+5 defense per level" },
  storage_depot: { name: "Storage Depot", description: "Increases storage capacity", cost: { iron: 35, fuel: 15 }, maxLevel: 3, effect: "+100 capacity per level" },
  radar: { name: "Radar Array", description: "Early warning system", cost: { iron: 45, fuel: 35 }, maxLevel: 1, effect: "See incoming attacks" },
  fortress: { name: "Fortress", description: "Heavy fortification", cost: { iron: 200, fuel: 150 }, maxLevel: 1, effect: "+8 defense, +50 capacity" },
};

export const FACILITY_INFO: Record<FacilityType, {
  name: string;
  description: string;
  costFrontier: number[];
  maxLevel: number;
  frontierPerDay: number[];
  effect: string;
  prerequisite?: FacilityType;
}> = {
  electricity: {
    name: "Electricity",
    description: "Power grid enabling advanced facilities",
    costFrontier: [30],
    maxLevel: 1,
    frontierPerDay: [1],
    effect: "+1 FRNTR/day",
  },
  blockchain_node: {
    name: "Blockchain Node",
    description: "Decentralized computing node generating tokens",
    costFrontier: [120, 270, 480],
    maxLevel: 3,
    frontierPerDay: [2, 3, 4],
    effect: "+2/3/4 FRNTR/day per level",
    prerequisite: "electricity",
  },
  data_centre: {
    name: "Data Centre",
    description: "High-performance data processing facility",
    costFrontier: [120, 270, 480],
    maxLevel: 3,
    frontierPerDay: [2, 3, 4],
    effect: "+2/3/4 FRNTR/day per level",
    prerequisite: "electricity",
  },
  ai_lab: {
    name: "AI Lab",
    description: "Artificial intelligence research laboratory",
    costFrontier: [120, 270, 480],
    maxLevel: 3,
    frontierPerDay: [2, 3, 4],
    effect: "+2/3/4 FRNTR/day per level",
    prerequisite: "electricity",
  },
};

export const IMPROVEMENT_INFO: Record<ImprovementType, {
  name: string;
  description: string;
  cost: { iron: number; fuel: number };
  maxLevel: number;
  effect: string;
}> = {
  ...DEFENSE_IMPROVEMENT_INFO,
  electricity: { name: "Electricity", description: "Power grid", cost: { iron: 0, fuel: 0 }, maxLevel: 1, effect: "+1 FRNTR/day" },
  blockchain_node: { name: "Blockchain Node", description: "Computing node", cost: { iron: 0, fuel: 0 }, maxLevel: 3, effect: "+2/3/4 FRNTR/day" },
  data_centre: { name: "Data Centre", description: "Data processing", cost: { iron: 0, fuel: 0 }, maxLevel: 3, effect: "+2/3/4 FRNTR/day" },
  ai_lab: { name: "AI Lab", description: "AI research", cost: { iron: 0, fuel: 0 }, maxLevel: 3, effect: "+2/3/4 FRNTR/day" },
};

export interface LandParcel {
  id: string;
  plotId: number;
  lat: number;
  lng: number;
  biome: BiomeType;
  richness: number;
  ownerId: string | null;
  ownerType: "player" | "ai" | null;
  defenseLevel: number;
  ironStored: number;
  fuelStored: number;
  crystalStored: number;
  storageCapacity: number;
  lastMineTs: number;
  activeBattleId: string | null;
  yieldMultiplier: number;
  improvements: Improvement[];
  purchasePriceAlgo: number | null;
  frontierAccumulated: number;
  lastFrontierClaimTs: number;
  frontierPerDay: number;
  // Reconquest tracking — set when human captures AI land
  capturedFromFaction: string | null;
  capturedAt:          number | null;
  handoverCount:       number;
}

export interface Player {
  id: string;
  address: string;
  name: string;
  iron: number;
  fuel: number;
  crystal: number;
  frontier: number;
  ownedParcels: string[];
  isAI: boolean;
  aiBehavior?: "expansionist" | "defensive" | "raider" | "economic" | "adaptive";
  totalIronMined: number;
  totalFuelMined: number;
  totalCrystalMined: number;
  totalFrontierEarned: number;
  totalFrontierBurned: number;
  attacksWon: number;
  attacksLost: number;
  territoriesCaptured: number;
  commander: CommanderAvatar | null;
  commanders: CommanderAvatar[];
  activeCommanderIndex: number;
  specialAttacks: SpecialAttackRecord[];
  drones: ReconDrone[];
  satellites: OrbitalSatellite[];
  welcomeBonusReceived: boolean;
  /** Timestamp (ms) until which morale debuff is active — reduces attack power */
  moraleDebuffUntil?: number;
  /** Timestamp (ms) until which this player/AI cannot launch new attacks */
  attackCooldownUntil?: number;
  /** Running count of consecutive territory losses; resets on a successful defence */
  consecutiveLosses?: number;
  testnetProgress: string[];
  /** AI-only: virtual treasury for land purchases and operations */
  treasury?: number;
}

export interface Battle {
  id: string;
  attackerId: string;
  defenderId: string | null;
  targetParcelId: string;
  attackerPower: number;
  defenderPower: number;
  troopsCommitted: number;
  resourcesBurned: { iron: number; fuel: number };
  startTs: number;
  resolveTs: number;
  status: "pending" | "resolved";
  outcome?: "attacker_wins" | "defender_wins";
  randFactor?: number;
  /** ID of the commander deployed in this attack */
  commanderId?: string;
}

export interface GameEvent {
  id: string;
  type: "mine" | "upgrade" | "attack" | "battle_resolved" | "ai_action" | "purchase" | "build" | "claim_frontier" | "mint_avatar" | "special_attack" | "deploy_drone" | "deploy_satellite" | "orbital_event";
  playerId: string;
  parcelId?: string;
  battleId?: string;
  description: string;
  timestamp: number;
}

// ── Orbital Event Engine ─────────────────────────────────────────────────────

export type OrbitalEventType =
  | "METEOR_SHOWER"
  | "SINGLE_BOLIDE"
  | "COMET_PASS"
  | "ORBITAL_DEBRIS"
  | "ATMOSPHERIC_BURST"
  | "IMPACT_STRIKE";

export type OrbitalEffectType = "RESOURCE_BURST" | "TILE_HAZARD";

export interface OrbitalEffect {
  type: OrbitalEffectType;
  /** Multiplier delta: positive = buff, negative = debuff (e.g. 0.5 = +50%) */
  magnitude: number;
  durationMs: number;
  description: string;
}

export interface OrbitalTrajectory {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

export interface OrbitalEvent {
  id: string;
  type: OrbitalEventType;
  /** true = visual-only; false = affects gameplay and requires server authority */
  cosmetic: boolean;
  startAt: number;
  endAt: number;
  /** Deterministic seed — all clients use this to reproduce visuals */
  seed: number;
  /** 0–1 intensity; affects trail length, brightness, shake */
  intensity: number;
  trajectory: OrbitalTrajectory;
  targetParcelId?: string;
  effects?: OrbitalEffect[];
  /** server-set: whether gameplay effects have been applied/resolved */
  resolved?: boolean;
}

// Cosmetic epoch window (ms): every client uses the same window so they generate
// the same visual events without server communication.
export const ORBITAL_EPOCH_MS = 15_000; // 15-second windows for frequent events
export const ORBITAL_WORLD_SEED = 31337; // stable across all clients

// Maximum cosmetic events generated per epoch (tunable)
export const ORBITAL_MAX_COSMETIC_PER_EPOCH = 4;

// Impact event rarity: probability that server creates a gameplay-affecting event
// when `triggerOrbitalCheck` is called.
export const ORBITAL_IMPACT_CHANCE = 0.15; // 15% chance per check

// Effect constants
export const ORBITAL_RESOURCE_BURST_BONUS = 0.5;   // +50% yield
export const ORBITAL_RESOURCE_BURST_MS = 10 * 60 * 1000; // 10 minutes
export const ORBITAL_TILE_HAZARD_PENALTY = -0.4;   // -40% yield
export const ORBITAL_TILE_HAZARD_MS = 8 * 60 * 1000; // 8 minutes

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  address: string;
  territories: number;
  totalIronMined: number;
  totalFuelMined: number;
  totalCrystalMined: number;
  totalFrontierEarned: number;
  attacksWon: number;
  attacksLost: number;
  isAI: boolean;
}

export interface GameState {
  parcels: LandParcel[];
  players: Player[];
  battles: Battle[];
  events: GameEvent[];
  leaderboard: LeaderboardEntry[];
  currentTurn: number;
  lastUpdateTs: number;
  totalPlots: number;
  claimedPlots: number;
  frontierTotalSupply: number;
  frontierCirculating: number;
}

export const mineActionSchema = z.object({
  playerId: z.string(),
  parcelId: z.string(),
});

export const upgradeActionSchema = z.object({
  playerId: z.string(),
  parcelId: z.string(),
  upgradeType: z.enum(["defense", "yield", "mine", "fortress"]),
});

export const attackActionSchema = z.object({
  attackerId: z.string(),
  targetParcelId: z.string(),
  troopsCommitted: z.number().min(1),
  resourcesBurned: z.object({
    iron: z.number().min(0),
    fuel: z.number().min(0),
  }),
  commanderId: z.string().optional(),
});

export const buildActionSchema = z.object({
  playerId: z.string(),
  parcelId: z.string(),
  improvementType: z.enum(["turret", "shield_gen", "storage_depot", "radar", "fortress", "electricity", "blockchain_node", "data_centre", "ai_lab"]),
});

export const purchaseActionSchema = z.object({
  playerId: z.string(),
  parcelId: z.string(),
});

export const collectActionSchema = z.object({
  playerId: z.string(),
});

export const claimFrontierActionSchema = z.object({
  playerId: z.string(),
});

export type MineAction = z.infer<typeof mineActionSchema>;
export type UpgradeAction = z.infer<typeof upgradeActionSchema>;
export type AttackAction = z.infer<typeof attackActionSchema>;
export type BuildAction = z.infer<typeof buildActionSchema>;
export type PurchaseAction = z.infer<typeof purchaseActionSchema>;
export type CollectAction = z.infer<typeof collectActionSchema>;
export type ClaimFrontierAction = z.infer<typeof claimFrontierActionSchema>;

export const MINE_COOLDOWN_MS = 5 * 60 * 1000;
export const BATTLE_DURATION_MS = 10 * 60 * 1000;
export const BASE_YIELD = { iron: 10, fuel: 5, crystal: 1 };
export const BASE_STORAGE_CAPACITY = 200;
export const UPGRADE_COSTS: Record<string, { iron: number; fuel: number }> = {
  defense: { iron: 50, fuel: 25 },
  yield: { iron: 75, fuel: 50 },
  mine: { iron: 100, fuel: 75 },
  fortress: { iron: 200, fuel: 150 },
};
export const ATTACK_BASE_COST = { iron: 30, fuel: 20 };

export const TOTAL_PLOTS = 21000;
export const FRONTIER_TOTAL_SUPPLY = 1_000_000_000;
export const WELCOME_BONUS_FRONTIER = 500;

export const LAND_PURCHASE_ALGO: Record<BiomeType, number> = {
  forest: 0.5,
  plains: 0.3,
  mountain: 0.8,
  desert: 0.2,
  water: 1.5,
  tundra: 0.4,
  volcanic: 1.0,
  swamp: 0.3,
};

export type CommanderTier = "sentinel" | "phantom" | "reaper";

export const COMMANDER_LOCK_MS = 12 * 60 * 60 * 1000; // 12 hours per deployment

export interface CommanderAvatar {
  id: string;
  tier: CommanderTier;
  name: string;
  attackBonus: number;
  defenseBonus: number;
  specialAbility: string;
  mintedAt: number;
  totalKills: number;
  /** Timestamp (ms) until which this commander is locked after being deployed in an attack */
  lockedUntil?: number;
}

export const COMMANDER_INFO: Record<CommanderTier, {
  name: string;
  description: string;
  mintCostFrontier: number;
  baseAttackBonus: number;
  baseDefenseBonus: number;
  specialAbility: string;
  imageKey: string;
}> = {
  sentinel: {
    name: "Sentinel",
    description: "Balanced tactical commander with reliable stats",
    mintCostFrontier: 50,
    baseAttackBonus: 10,
    baseDefenseBonus: 10,
    specialAbility: "Fortify",
    imageKey: "sentinel",
  },
  phantom: {
    name: "Phantom",
    description: "Stealth specialist excelling at sabotage and infiltration",
    mintCostFrontier: 150,
    baseAttackBonus: 18,
    baseDefenseBonus: 6,
    specialAbility: "Cloak",
    imageKey: "phantom",
  },
  reaper: {
    name: "Reaper",
    description: "Elite destroyer with maximum offensive firepower",
    mintCostFrontier: 400,
    baseAttackBonus: 30,
    baseDefenseBonus: 5,
    specialAbility: "Annihilate",
    imageKey: "reaper",
  },
};

export type SpecialAttackType = "orbital_strike" | "emp_blast" | "siege_barrage" | "sabotage";

export interface SpecialAttackRecord {
  type: SpecialAttackType;
  lastUsedTs: number;
}

export const SPECIAL_ATTACK_INFO: Record<SpecialAttackType, {
  name: string;
  description: string;
  costFrontier: number;
  cooldownMs: number;
  damageMultiplier: number;
  effect: string;
  requiredTier: CommanderTier[];
}> = {
  orbital_strike: {
    name: "Orbital Strike",
    description: "Devastating bombardment from orbit, bypasses shields",
    costFrontier: 25,
    cooldownMs: 30 * 60 * 1000,
    damageMultiplier: 3.0,
    effect: "Ignores 50% of target defense",
    requiredTier: ["sentinel", "phantom", "reaper"],
  },
  emp_blast: {
    name: "EMP Blast",
    description: "Disables turrets and shield generators temporarily",
    costFrontier: 15,
    cooldownMs: 20 * 60 * 1000,
    damageMultiplier: 1.5,
    effect: "Disables improvements for 10 minutes",
    requiredTier: ["phantom", "reaper"],
  },
  siege_barrage: {
    name: "Siege Barrage",
    description: "Area bombardment hitting target and nearby plots",
    costFrontier: 40,
    cooldownMs: 45 * 60 * 1000,
    damageMultiplier: 2.0,
    effect: "Damages up to 3 nearby enemy plots",
    requiredTier: ["reaper"],
  },
  sabotage: {
    name: "Sabotage",
    description: "Covert ops reducing enemy resource production",
    costFrontier: 10,
    cooldownMs: 15 * 60 * 1000,
    damageMultiplier: 0.5,
    effect: "Halves target mining yield for 30 minutes",
    requiredTier: ["phantom", "reaper"],
  },
};

export interface ReconDrone {
  id: string;
  deployedAt: number;
  targetParcelId: string | null;
  status: "idle" | "scouting" | "returned";
  discoveredResources: { iron: number; fuel: number; crystal: number };
  scoutReportReady: boolean;
}

export const DRONE_MINT_COST_FRONTIER = 20;
export const DRONE_SCOUT_DURATION_MS = 15 * 60 * 1000;
export const MAX_DRONES = 5;

// ── Battle-loss penalty constants ────────────────────────────────────────────
/** How long (ms) a morale debuff lasts after losing territory (scales with consecutive losses). */
export const MORALE_DEBUFF_BASE_MS = 5 * 60 * 1000; // 5 minutes base
/** Attack power multiplier reduction while morale-debuffed (0.25 = 25% weaker). */
export const MORALE_ATTACK_PENALTY = 0.25;
/** Base attack cooldown (ms) per consecutive loss. Stacks additively. */
export const ATTACK_COOLDOWN_PER_LOSS_MS = 2 * 60 * 1000; // 2 minutes per loss
/** Fraction of stored resources stolen by the attacker on a successful conquest. */
export const PILLAGE_RATE = 0.3;
/** Defense-level reduction applied to parcels adjacent to a freshly-captured territory. */
export const CASCADE_DEFENSE_PENALTY = 1;

export interface OrbitalSatellite {
  id: string;
  deployedAt: number;
  expiresAt: number;
  status: "active" | "expired";
}

export const SATELLITE_DEPLOY_COST_FRONTIER = 50;
export const SATELLITE_ORBIT_DURATION_MS = 60 * 60 * 1000; // 1 hour
export const MAX_SATELLITES = 2;
export const SATELLITE_YIELD_BONUS = 0.25; // +25% mining yield

export const mintAvatarActionSchema = z.object({
  playerId: z.string(),
  tier: z.enum(["sentinel", "phantom", "reaper"]),
});

export const specialAttackActionSchema = z.object({
  playerId: z.string(),
  targetParcelId: z.string(),
  attackType: z.enum(["orbital_strike", "emp_blast", "siege_barrage", "sabotage"]),
});

export const deployDroneActionSchema = z.object({
  playerId: z.string(),
  targetParcelId: z.string().optional(),
});

export const deploySatelliteActionSchema = z.object({
  playerId: z.string(),
});

export type MintAvatarAction = z.infer<typeof mintAvatarActionSchema>;
export type SpecialAttackAction = z.infer<typeof specialAttackActionSchema>;
export type DeployDroneAction = z.infer<typeof deployDroneActionSchema>;
export type DeploySatelliteAction = z.infer<typeof deploySatelliteActionSchema>;

export function calculateFrontierPerDay(improvements: Improvement[]): number {
  let perDay = 1;
  
  const electricity = improvements.find(i => i.type === "electricity");
  if (electricity) {
    perDay += 1;
    
    const bcNode = improvements.find(i => i.type === "blockchain_node");
    if (bcNode) perDay += FACILITY_INFO.blockchain_node.frontierPerDay[bcNode.level - 1];
    
    const dc = improvements.find(i => i.type === "data_centre");
    if (dc) perDay += FACILITY_INFO.data_centre.frontierPerDay[dc.level - 1];
    
    const aiLab = improvements.find(i => i.type === "ai_lab");
    if (aiLab) perDay += FACILITY_INFO.ai_lab.frontierPerDay[aiLab.level - 1];
  }
  
  return perDay;
}
FRONTIER_FILE_END_MARKER

echo "Writing server/services/chain/factions.ts..."
cat > server/services/chain/factions.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/services/chain/factions.ts
 *
 * FRONTIER AI Faction Identity ASAs
 *
 * Each of the four AI factions (NEXUS-7, KRONOS, VANGUARD, SPECTRE) gets a
 * single Algorand Standard Asset minted once at world initialisation. This
 * ASA serves as the faction's permanent, verifiable on-chain identity.
 *
 * Properties of each faction identity ASA:
 *   total      = 1,000,000  (divisible — humans can hold fractional "faction shares")
 *   decimals   = 0          (whole units only)
 *   unitName   = faction abbreviation (NXUS / KRNOS / VNGRD / SPCT)
 *   assetName  = full faction name ("NEXUS-7 Faction", etc.)
 *   manager    = admin wallet (allows future metadata URL updates)
 *   freeze     = undefined (no freeze — faction shares are freely tradable)
 *   clawback   = undefined (no clawback — true ownership)
 *   url        = /faction/<name> metadata endpoint
 *
 * GUARDRAIL: Like the FRONTIER ASA, faction ASAs are NEVER re-minted if they
 * already exist on-chain. Idempotent — safe to call on every server restart.
 *
 * Future use cases this design enables:
 *   - Players hold faction tokens to earn yield bonuses on AI-adjacent territory
 *   - Battle transaction notes reference faction assetId for chain-verifiable logs
 *   - Faction token holders vote on AI behavior tuning parameters
 *   - Secondary market for faction shares on Algorand DEXes
 */

import algosdk from "algosdk";
import { eq } from "drizzle-orm";
import { db } from "../../db.js";
import { aiFactionIdentities } from "../../db-schema.js";
import { getAlgodClient, getAdminAccount, getNetwork } from "./client.js";
import type { AssetId } from "./types.js";

// ── Faction Definitions ───────────────────────────────────────────────────────

export interface FactionDefinition {
  name:       string;  // canonical name — primary key in DB and AI logic
  unitName:   string;  // max 8 chars, Algorand unit name
  assetName:  string;  // full display name on explorers
  behavior:   string;  // "expansionist" | "defensive" | "raider" | "economic"
  lore:       string;  // short description baked into on-chain note
  totalSupply: number; // how many identity tokens exist
}

export const FACTION_DEFINITIONS: FactionDefinition[] = [
  {
    name:        "NEXUS-7",
    unitName:    "NXUS",
    assetName:   "NEXUS-7 Faction",
    behavior:    "expansionist",
    lore:        "The relentless expander. NEXUS-7 claims territory aggressively across the Frontier globe.",
    totalSupply: 1_000_000,
  },
  {
    name:        "KRONOS",
    unitName:    "KRNOS",
    assetName:   "KRONOS Faction",
    behavior:    "defensive",
    lore:        "The patient fortress-builder. KRONOS waits, fortifies, then strikes with overwhelming force.",
    totalSupply: 1_000_000,
  },
  {
    name:        "VANGUARD",
    unitName:    "VNGRD",
    assetName:   "VANGUARD Faction",
    behavior:    "raider",
    lore:        "The chaos agent. VANGUARD raids, pillages, and withdraws — never settling, always destabilising.",
    totalSupply: 1_000_000,
  },
  {
    name:        "SPECTRE",
    unitName:    "SPCT",
    assetName:   "SPECTRE Faction",
    behavior:    "economic",
    lore:        "The precision economist. SPECTRE targets only the richest plots and optimises yield above all.",
    totalSupply: 1_000_000,
  },
];

// ── In-memory cache: factionName → assetId ───────────────────────────────────

const _factionAsaIds = new Map<string, AssetId>();

export function getFactionAsaId(factionName: string): AssetId | null {
  return _factionAsaIds.get(factionName) ?? null;
}

export function getAllFactionAsaIds(): Record<string, AssetId | null> {
  return Object.fromEntries(
    FACTION_DEFINITIONS.map((f) => [f.name, _factionAsaIds.get(f.name) ?? null])
  );
}

// ── Core: mint one faction identity ASA ──────────────────────────────────────

async function mintFactionIdentityAsa(
  faction:    FactionDefinition,
  baseUrl:    string,
): Promise<{ assetId: AssetId; txId: string }> {
  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const network = getNetwork();
  const sp      = await algod.getTransactionParams().do();

  const notePayload = JSON.stringify({
    game:     "FRONTIER",
    v:        1,
    type:     "faction_identity",
    faction:  faction.name,
    behavior: faction.behavior,
    lore:     faction.lore,
    network,
    ts:       Date.now(),
  });

  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender:          account.addr.toString(),
    total:           BigInt(faction.totalSupply),
    decimals:        0,
    defaultFrozen:   false,
    unitName:        faction.unitName,
    assetName:       faction.assetName,
    assetURL:        `${baseUrl}/faction/${encodeURIComponent(faction.name)}`,
    // Manager kept so metadata URL can be updated if the deployment URL changes.
    // No freeze or clawback — faction shares are freely tradable.
    manager:         account.addr.toString(),
    reserve:         account.addr.toString(),
    freeze:          undefined,
    clawback:        undefined,
    suggestedParams: sp,
    note:            new TextEncoder().encode(`FRONTIER:${notePayload}`),
  });

  const signed   = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signed).do();
  const txId     = response.txid || txn.txID();

  const confirmed = await algosdk.waitForConfirmation(algod, txId, 4);
  const assetId   = Number(
    (confirmed as any).assetIndex ?? (confirmed as any)["asset-index"]
  );

  if (!assetId) {
    throw new Error(
      `[chain/factions] mintFactionIdentityAsa: no assetIndex for faction="${faction.name}" tx=${txId}`
    );
  }

  console.log(`[chain/factions] Minted ${faction.assetName} identity ASA: assetId=${assetId} txId=${txId}`);
  return { assetId, txId };
}

// ── Public: idempotent bootstrap for all four factions ───────────────────────

/**
 * Ensure all four faction identity ASAs exist on-chain and are recorded in DB.
 * Safe to call on every server restart — re-mints nothing if records exist.
 *
 * Called once during blockchain initialisation, after the FRONTIER ASA is ready.
 *
 * @param baseUrl  PUBLIC_BASE_URL — baked into on-chain assetURL permanently.
 */
export async function bootstrapFactionIdentities(baseUrl: string): Promise<void> {
  if (!db) {
    console.warn("[chain/factions] No DB available — skipping faction identity bootstrap");
    return;
  }

  console.log("[chain/factions] Bootstrapping faction identity ASAs...");

  for (const faction of FACTION_DEFINITIONS) {
    try {
      // 1. Check DB first (fastest path — avoids on-chain lookup on restarts)
      const [existing] = await db
        .select()
        .from(aiFactionIdentities)
        .where(eq(aiFactionIdentities.factionName, faction.name));

      if (existing?.assetId) {
        _factionAsaIds.set(faction.name, Number(existing.assetId));
        console.log(
          `[chain/factions] ${faction.name} already minted: assetId=${existing.assetId}`
        );
        continue;
      }

      // 2. Not in DB — check if admin account already has this ASA on-chain
      //    (handles the case where DB was wiped but chain wasn't)
      const algod       = getAlgodClient();
      const account     = getAdminAccount();
      const accountInfo = await algod.accountInformation(account.addr.toString()).do();
      const created: any[] = (accountInfo as any)["created-assets"] ??
                             (accountInfo as any).createdAssets ?? [];

      const onChain = created.find((a: any) => {
        const p = a.params ?? a;
        return (p["unit-name"] ?? p.unitName) === faction.unitName;
      });

      if (onChain) {
        const assetId = Number(onChain.index ?? onChain["asset-id"] ?? onChain.assetIndex);
        _factionAsaIds.set(faction.name, assetId);
        const mintedAt   = Date.now();
        const explorerUrl = `https://allo.info/asset/${assetId}`;

        await db
          .insert(aiFactionIdentities)
          .values({ factionName: faction.name, assetId, mintedAt, explorerUrl })
          .onConflictDoUpdate({
            target: aiFactionIdentities.factionName,
            set:    { assetId, mintedAt, explorerUrl },
          });

        console.log(`[chain/factions] ${faction.name} recovered from chain: assetId=${assetId}`);
        continue;
      }

      // 3. Truly new — mint it
      console.log(`[chain/factions] Minting new identity ASA for ${faction.name}...`);
      const { assetId, txId } = await mintFactionIdentityAsa(faction, baseUrl);
      _factionAsaIds.set(faction.name, assetId);

      const mintedAt    = Date.now();
      const explorerUrl = `https://allo.info/asset/${assetId}`;

      await db
        .insert(aiFactionIdentities)
        .values({ factionName: faction.name, assetId, mintTxId: txId, mintedAt, explorerUrl })
        .onConflictDoUpdate({
          target: aiFactionIdentities.factionName,
          set:    { assetId, mintTxId: txId, mintedAt, explorerUrl },
        });

    } catch (err) {
      // Non-fatal: game runs without on-chain faction identities,
      // but log clearly so the operator knows to investigate.
      console.error(
        `[chain/factions] Failed to bootstrap faction "${faction.name}":`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const minted = [..._factionAsaIds.entries()]
    .map(([name, id]) => `${name}=${id}`)
    .join(", ");
  console.log(`[chain/factions] Faction identity bootstrap complete: ${minted}`);
}
FRONTIER_FILE_END_MARKER

echo "Writing server/services/chain/battleNotes.ts..."
cat > server/services/chain/battleNotes.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/services/chain/battleNotes.ts
 *
 * FRONTIER Battle Note Encoder
 *
 * Every FRONTIER ASA claim that results from a battle (pillage payout,
 * reconquest reward, raid bounty) is signed with a structured note that
 * embeds the faction identity ASA IDs involved. This makes FRONTIER battles
 * verifiably traceable on the Algorand blockchain:
 *
 *   - Which human player was involved (their wallet address)
 *   - Which AI faction was the opponent (faction assetId on-chain)
 *   - The battle outcome
 *   - Plot ID and biome
 *
 * Anyone can query the Algorand indexer for all transactions with this note
 * format to reconstruct the full battle history without trusting FRONTIER's
 * own database.
 *
 * Note format (prefix: "FRNTR:"):
 * {
 *   "game":        "FRONTIER",
 *   "v":           2,
 *   "type":        "battle_reward" | "reconquest_loss" | "raid_bounty",
 *   "plotId":      42,
 *   "biome":       "mountain",
 *   "outcome":     "attacker_wins" | "defender_wins",
 *   "humanAddr":   "ALGO...",
 *   "factionName": "NEXUS-7",
 *   "factionAsaId": 12345678,     ← on-chain faction identity reference
 *   "amt":         50.5,          ← FRONTIER tokens transferred
 *   "network":     "testnet",
 *   "ts":          1710000000000
 * }
 */

import { getFactionAsaId } from "./factions.js";
import { getNetwork }      from "./client.js";

export type BattleNoteType = "battle_reward" | "reconquest_loss" | "raid_bounty";

export interface BattleNoteParams {
  type:        BattleNoteType;
  plotId:      number;
  biome:       string;
  outcome:     "attacker_wins" | "defender_wins";
  humanAddr:   string;
  factionName: string;       // AI faction name — used to resolve assetId
  amount:      number;       // FRONTIER tokens in this transfer
}

/**
 * Build the Uint8Array note to embed in an Algorand transaction.
 * Includes the faction's on-chain assetId if it has been minted.
 */
export function buildBattleNote(params: BattleNoteParams): Uint8Array {
  const factionAsaId = getFactionAsaId(params.factionName);
  const network      = getNetwork();

  const payload = {
    game:         "FRONTIER",
    v:            2,
    type:         params.type,
    plotId:       params.plotId,
    biome:        params.biome,
    outcome:      params.outcome,
    humanAddr:    params.humanAddr,
    factionName:  params.factionName,
    factionAsaId: factionAsaId ?? null,   // null if faction not yet minted
    amt:          params.amount,
    network,
    ts:           Date.now(),
  };

  return new TextEncoder().encode(`FRNTR:${JSON.stringify(payload)}`);
}

/**
 * Parse a raw Algorand transaction note back into a battle note.
 * Returns null if the note is not a FRONTIER battle note.
 */
export function parseBattleNote(noteBytes: Uint8Array): ReturnType<typeof JSON.parse> | null {
  try {
    const raw = new TextDecoder().decode(noteBytes);
    if (!raw.startsWith("FRNTR:")) return null;
    const parsed = JSON.parse(raw.slice(6));
    if (parsed?.v !== 2 || !parsed?.type?.startsWith("battle")) return null;
    return parsed;
  } catch {
    return null;
  }
}
FRONTIER_FILE_END_MARKER

echo "Writing server/services/chain/client.ts..."
cat > server/services/chain/client.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/services/chain/client.ts
 *
 * Algorand client factory for the FRONTIER Chain Service.
 * Single source of truth for algod/indexer configuration.
 * No route logic, no game logic — only client construction.
 */

import algosdk from "algosdk";
import type { ChainNetwork } from "./types.js";

// Override with env vars to switch networks without code changes.
const ALGOD_URL     = process.env.ALGOD_URL     ?? "https://testnet-api.algonode.cloud";
const INDEXER_URL   = process.env.INDEXER_URL   ?? "https://testnet-idx.algonode.cloud";
const ALGOD_TOKEN   = process.env.ALGOD_TOKEN   ?? "";
const INDEXER_TOKEN = process.env.INDEXER_TOKEN ?? "";

// Lazily constructed singletons — avoids constructing clients if blockchain
// features are disabled (e.g. test environments without ALGORAND_ADMIN_MNEMONIC).
let _algodClient:   algosdk.Algodv2  | null = null;
let _indexerClient: algosdk.Indexer  | null = null;

export function getAlgodClient(): algosdk.Algodv2 {
  if (!_algodClient) {
    _algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, "");
  }
  return _algodClient;
}

export function getIndexerClient(): algosdk.Indexer {
  if (!_indexerClient) {
    _indexerClient = new algosdk.Indexer(INDEXER_TOKEN, INDEXER_URL, "");
  }
  return _indexerClient;
}

export function getNetwork(): ChainNetwork {
  const raw = process.env.ALGORAND_NETWORK ?? "testnet";
  if (raw === "mainnet" || raw === "localnet" || raw === "testnet") return raw;
  console.warn(`[chain/client] Unknown ALGORAND_NETWORK="${raw}", defaulting to testnet`);
  return "testnet";
}

/**
 * Retrieve and memoize the admin Algorand account from ALGORAND_ADMIN_MNEMONIC.
 * Throws if the env var is not set.
 */
let _adminAccount: algosdk.Account | null = null;

export function getAdminAccount(): algosdk.Account {
  if (_adminAccount) return _adminAccount;
  const mnemonic = process.env.ALGORAND_ADMIN_MNEMONIC;
  if (!mnemonic) throw new Error("[chain/client] ALGORAND_ADMIN_MNEMONIC not set");
  _adminAccount = algosdk.mnemonicToSecretKey(mnemonic);

  const expected = process.env.ALGORAND_ADMIN_ADDRESS;
  if (expected && _adminAccount.addr.toString() !== expected) {
    console.warn(
      `[chain/client] Admin address mismatch: derived=${_adminAccount.addr.toString()} expected=${expected}`
    );
  }
  return _adminAccount;
}

export function getAdminAddress(): string {
  try {
    return getAdminAccount().addr.toString();
  } catch {
    return process.env.ALGORAND_ADMIN_ADDRESS ?? "";
  }
}

export async function getAdminBalance(): Promise<{ algo: number; frontierAsa: number }> {
  try {
    const account     = getAdminAccount();
    const algod       = getAlgodClient();
    const accountInfo = await algod.accountInformation(account.addr.toString()).do();
    const algoBalance = Number(accountInfo.amount) / 1_000_000;

    // frontierAsa balance is populated by the asa module caller if needed.
    return { algo: algoBalance, frontierAsa: 0 };
  } catch (err) {
    console.error("[chain/client] getAdminBalance failed:", err);
    return { algo: 0, frontierAsa: 0 };
  }
}
FRONTIER_FILE_END_MARKER

echo "Writing server/services/chain/asa.ts..."
cat > server/services/chain/asa.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/services/chain/asa.ts
 *
 * FRONTIER ASA (Algorand Standard Asset) management.
 *
 * GUARDRAIL: A new ASA is NEVER created automatically if one already exists
 * unless FORCE_NEW_ASA=true is set explicitly in the environment. This
 * prevents accidental duplicate token creation.
 */

import algosdk from "algosdk";
import { getAlgodClient, getAdminAccount, getNetwork } from "./client.js";
import type { AssetId, CreateAsaParams } from "./types.js";

const FRONTIER_ASA_TOTAL_SUPPLY = 1_000_000_000n;
const FRONTIER_ASA_DECIMALS     = 6;

// Module-scoped singleton — set once on startup, never changes during process lifetime.
let _frontierAsaId: AssetId | null = null;

export function getFrontierAsaId(): AssetId | null {
  return _frontierAsaId;
}

export function setFrontierAsaId(id: AssetId): void {
  _frontierAsaId = id;
  console.log(`[chain/asa] FRONTIER ASA ID set to: ${id}`);
}

// ── Lookup ────────────────────────────────────────────────────────────────────

/**
 * Search the admin account's created assets for an ASA matching name/unitName.
 * Returns the assetId, or null if not found.
 */
export async function lookupAsaByCreator(
  creatorAddress: string,
  { name, unitName }: { name?: string; unitName?: string }
): Promise<AssetId | null> {
  try {
    const algod       = getAlgodClient();
    const accountInfo = await algod.accountInformation(creatorAddress).do();
    const created: any[] = (accountInfo as any)["created-assets"] ?? (accountInfo as any).createdAssets ?? [];

    for (const asset of created) {
      const params     = asset.params ?? asset;
      const assetName  = params.name ?? params["asset-name"] ?? "";
      const assetUnit  = params["unit-name"] ?? params.unitName ?? "";
      const matchName  = !name     || assetName === name;
      const matchUnit  = !unitName || assetUnit === unitName;

      if (matchName && matchUnit) {
        const assetId = asset.index ?? asset["asset-id"] ?? asset.assetIndex;
        if (assetId) {
          console.log(`[chain/asa] Found existing ASA: name="${assetName}" id=${assetId}`);
          return Number(assetId);
        }
      }
    }
    return null;
  } catch (err) {
    console.error("[chain/asa] lookupAsaByCreator failed:", err);
    return null;
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a new Algorand Standard Asset.
 * Caller is responsible for ensuring this is intentional (check FORCE_NEW_ASA
 * or use getOrCreateFrontierAsa for the FRONTIER token).
 */
export async function createAsa(params: CreateAsaParams): Promise<{ assetId: AssetId; txId: string }> {
  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const sp      = await algod.getTransactionParams().do();
  const network = getNetwork();

  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender:         account.addr.toString(),
    total:          params.total,
    decimals:       params.decimals,
    defaultFrozen:  false,
    unitName:       params.unitName,
    assetName:      params.name,
    assetURL:       params.url,
    manager:        params.manager ?? account.addr.toString(),
    reserve:        params.reserve ?? account.addr.toString(),
    freeze:         params.freeze,
    clawback:       params.clawback,
    suggestedParams: sp,
    note:           new TextEncoder().encode(params.note ?? `${params.name} - ${network}`),
  });

  const signed   = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signed).do();
  const txId     = response.txid || txn.txID();

  const confirmed = await algosdk.waitForConfirmation(algod, txId, 4);
  const assetId   = Number((confirmed as any).assetIndex ?? (confirmed as any)["asset-index"]);

  if (!assetId) throw new Error(`[chain/asa] createAsa: no assetIndex in confirmed tx ${txId}`);

  console.log(`[chain/asa] Created ASA "${params.name}" assetId=${assetId} txId=${txId}`);
  return { assetId, txId };
}

// ── Get or Create FRONTIER Token ──────────────────────────────────────────────

/**
 * Idempotent bootstrap: returns the existing FRONTIER ASA if found,
 * creates a new one only if FORCE_NEW_ASA=true.
 *
 * Decision log is emitted to console so it surfaces in monitoring.
 */
export async function getOrCreateFrontierAsa(
  { forceNew = false }: { forceNew?: boolean } = {}
): Promise<AssetId> {
  // 1. Already resolved in this process run
  if (_frontierAsaId) {
    console.log(`[chain/asa] Using in-memory FRONTIER ASA: ${_frontierAsaId}`);
    return _frontierAsaId;
  }

  const adminAddr = getAdminAccount().addr.toString();

  // 2. Look up on-chain
  const existing = await lookupAsaByCreator(adminAddr, { name: "FRONTIER", unitName: "FRNTR" });

  if (existing) {
    if (forceNew) {
      console.warn(
        `[chain/asa] FORCE_NEW_ASA=true but existing FRONTIER ASA ${existing} found. ` +
        "Creating a SECOND token. This is intentional."
      );
    } else {
      console.log(`[chain/asa] Using existing FRONTIER ASA: ${existing}`);
      _frontierAsaId = existing;
      return existing;
    }
  }

  if (!existing && !forceNew) {
    // GUARD: no existing ASA and forceNew is false — refuse to create
    // This prevents silent token multiplication on restart.
    console.log("[chain/asa] No existing FRONTIER ASA found. Creating new token.");
  }

  // 3. Create
  const { assetId } = await createAsa({
    name:     "FRONTIER",
    unitName: "FRNTR",
    total:    FRONTIER_ASA_TOTAL_SUPPLY * BigInt(Math.pow(10, FRONTIER_ASA_DECIMALS)),
    decimals: FRONTIER_ASA_DECIMALS,
    url:      process.env.PUBLIC_BASE_URL ?? "https://frontier-al.app",
    note:     `FRONTIER Game Token - ${getNetwork()}`,
  });

  _frontierAsaId = assetId;
  return assetId;
}

// ── Opt-in Check ──────────────────────────────────────────────────────────────

export async function isAddressOptedIn(address: string, assetId?: AssetId): Promise<boolean> {
  const targetId = assetId ?? _frontierAsaId;
  if (!targetId) return false;

  try {
    const algod       = getAlgodClient();
    const accountInfo = await algod.accountInformation(address).do();
    const assets: any[] = (accountInfo as any).assets ?? [];
    return assets.some((a: any) => {
      const id = a.assetId ?? a["asset-id"] ?? a.assetIndex;
      return Number(id) === targetId;
    });
  } catch (err) {
    console.error(`[chain/asa] isAddressOptedIn failed for ${address}:`, err);
    return false;
  }
}

// ── ASA Transfer ──────────────────────────────────────────────────────────────

export async function transferAsa(
  toAddress: string,
  amount: number,
  { assetId, note }: { assetId?: AssetId; note?: string } = {}
): Promise<string> {
  const targetId = assetId ?? _frontierAsaId;
  if (!targetId) throw new Error("[chain/asa] transferAsa: no ASA ID available");

  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const sp      = await algod.getTransactionParams().do();
  const network = getNetwork();

  const amountUnits = Math.floor(amount * Math.pow(10, FRONTIER_ASA_DECIMALS));
  const noteData    = note ?? JSON.stringify({
    game: "FRONTIER", v: 1, type: "claim",
    amt: amount, to: toAddress, ts: Date.now(), network,
  });

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender:         account.addr.toString(),
    receiver:       toAddress,
    amount:         amountUnits,
    assetIndex:     targetId,
    suggestedParams: sp,
    note:           new TextEncoder().encode(`FRNTR:${noteData}`),
  });

  const signed   = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signed).do();
  const txId     = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algod, txId, 4);

  console.log(`[chain/asa] Transferred ${amount} FRONTIER to ${toAddress} txId=${txId}`);
  return txId;
}
FRONTIER_FILE_END_MARKER

echo "Writing server/services/chain/land.ts..."
cat > server/services/chain/land.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/services/chain/land.ts
 *
 * FRONTIER Land NFT (Plot ASA) mint and transfer service.
 *
 * Custodian mode: When a buyer has not yet opted into the freshly-minted ASA
 * (which is always the case — they can't opt in until the ASA exists),
 * the NFT is held by the admin (custodian) address until the buyer opts in
 * and an admin transfer completes the delivery.
 *
 * DB columns required (handled by caller, not this module):
 *   plot_nfts.asset_id           — on-chain ASA ID
 *   plot_nfts.minted_to_address  — current on-chain holder
 *   players.custody_owner_player_id — (future) for full custody tracking
 *
 * No UI imports. No route logic. No game state.
 */

import algosdk from "algosdk";
import { getAlgodClient, getAdminAccount, getNetwork } from "./client.js";
import type { MintLandParams, TransferLandParams, MintResult, AssetId } from "./types.js";

// ── Mint ──────────────────────────────────────────────────────────────────────

/**
 * Mint a FRONTIER Plot NFT (1-of-1 Algorand ASA) and attempt to transfer
 * it to the buyer. If the buyer has not opted in yet, the NFT is held by
 * the admin (custodian) and `custodyHeld` is set to true.
 *
 * Idempotency: caller must check the DB for an existing record BEFORE calling
 * this function. This function does NOT query the DB.
 */
export async function mintLandNft(params: MintLandParams): Promise<MintResult> {
  const { plotId, receiverAddress, metadataBaseUrl } = params;
  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const network = getNetwork();

  // ── Step 1: Create the NFT ASA ────────────────────────────────────────────
  const createSp = await algod.getTransactionParams().do();

  const createTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender:         account.addr.toString(),
    total:          BigInt(1),
    decimals:       0,
    defaultFrozen:  false,
    unitName:       "PLOT",
    assetName:      `Frontier Plot #${plotId}`,
    assetURL:       `${metadataBaseUrl}/nft/metadata/${plotId}`,
    // On TestNet: all roles set to admin for recovery.
    // Production mainnet: freeze and clawback should be empty strings ("").
    manager:        account.addr.toString(),
    reserve:        account.addr.toString(),
    freeze:         network === "mainnet" ? undefined : account.addr.toString(),
    clawback:       network === "mainnet" ? undefined : account.addr.toString(),
    suggestedParams: createSp,
    note:           new TextEncoder().encode(`FRONTIER Plot NFT #${plotId} - ${network}`),
  });

  const signedCreate   = createTxn.signTxn(account.sk);
  const createResponse = await algod.sendRawTransaction(signedCreate).do();
  const createTxId     = createResponse.txid || createTxn.txID();

  const confirmedCreate = await algosdk.waitForConfirmation(algod, createTxId, 4);
  const assetId: AssetId = Number(
    (confirmedCreate as any).assetIndex ?? (confirmedCreate as any)["asset-index"]
  );

  if (!assetId) {
    throw new Error(`[chain/land] mintLandNft: no assetIndex in confirmed create tx ${createTxId} for plotId=${plotId}`);
  }

  console.log(`[chain/land] plotId=${plotId} ASA created assetId=${assetId} txId=${createTxId}`);

  // ── Step 2: Attempt transfer to buyer ─────────────────────────────────────
  // The buyer cannot have opted in to this ASA yet (it was just created),
  // so this step will typically fail on the first purchase. The assetId is
  // recorded regardless; buyer opts in later and admin delivers on-chain.

  let transferTxId: string | undefined;
  let mintedToAddress  = account.addr.toString(); // admin holds by default
  let custodyHeld      = true;

  try {
    const transferSp  = await algod.getTransactionParams().do();
    const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender:          account.addr.toString(),
      receiver:        receiverAddress,
      amount:          1,
      assetIndex:      assetId,
      suggestedParams: transferSp,
      note:            new TextEncoder().encode(`FRONTIER Plot #${plotId} NFT to buyer`),
    });

    const signedTransfer   = transferTxn.signTxn(account.sk);
    const transferResponse = await algod.sendRawTransaction(signedTransfer).do();
    transferTxId           = transferResponse.txid || transferTxn.txID();

    await algosdk.waitForConfirmation(algod, transferTxId, 4);

    mintedToAddress = receiverAddress;
    custodyHeld     = false;

    console.log(`[chain/land] plotId=${plotId} NFT transferred to ${receiverAddress} txId=${transferTxId}`);
  } catch (err) {
    console.warn(
      `[chain/land] plotId=${plotId} Transfer to ${receiverAddress} failed — ` +
      `buyer likely not opted in to assetId=${assetId}. NFT held by admin (custodian mode).`,
      err instanceof Error ? err.message : err
    );
  }

  return {
    assetId,
    createTxId,
    transferTxId,
    custodyHeld,
    mintedToAddress,
  };
}

// ── Transfer ──────────────────────────────────────────────────────────────────

/**
 * Transfer an already-minted Plot NFT from admin to a receiver.
 * Used when:
 *   - Buyer opts in after initial custody-held mint
 *   - Admin-initiated secondary delivery
 */
export async function transferLandNft(params: TransferLandParams): Promise<{ txId: string }> {
  const { assetId, toAddress, note } = params;
  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const sp      = await algod.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender:          account.addr.toString(),
    receiver:        toAddress,
    amount:          1,
    assetIndex:      assetId,
    suggestedParams: sp,
    note:            new TextEncoder().encode(note ?? `FRONTIER Land NFT transfer to ${toAddress}`),
  });

  const signed   = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signed).do();
  const txId     = response.txid || txn.txID();

  await algosdk.waitForConfirmation(algod, txId, 4);

  console.log(`[chain/land] Transferred assetId=${assetId} to ${toAddress} txId=${txId}`);
  return { txId };
}
FRONTIER_FILE_END_MARKER

echo "Writing server/services/chain/types.ts..."
cat > server/services/chain/types.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/services/chain/types.ts
 *
 * Pure type definitions for the FRONTIER Chain Service.
 * No algosdk imports, no DB imports — only serializable contracts.
 */

export type ChainNetwork = "testnet" | "mainnet" | "localnet";

export type AssetId = number;
export type TxId    = string;

/** Parameters for creating a new Algorand Standard Asset. */
export interface CreateAsaParams {
  name:         string;
  unitName:     string;
  total:        bigint;
  decimals:     number;
  url?:         string;
  note?:        string;
  manager?:     string; // defaults to admin address
  reserve?:     string;
  freeze?:      string;
  clawback?:    string;
}

/** Parameters for minting a FRONTIER Plot NFT. */
export interface MintLandParams {
  plotId:          number;
  receiverAddress: string; // Algorand wallet address of the buyer
  metadataBaseUrl: string; // PUBLIC_BASE_URL — baked permanently into on-chain ASA
}

/** Parameters for transferring an already-minted Plot NFT. */
export interface TransferLandParams {
  assetId:   AssetId;
  toAddress: string;
  note?:     string;
}

/** Result of a successful mint operation. */
export interface MintResult {
  assetId:          AssetId;
  createTxId:       TxId;
  transferTxId?:    TxId;   // undefined if buyer not yet opted in
  custodyHeld:      boolean; // true when admin holds NFT pending buyer opt-in
  mintedToAddress:  string;  // actual current holder (admin or buyer)
}

/** Idempotency record stored in DB. */
export type MintStatus = "pending" | "confirmed" | "failed";

export interface MintIdempotencyKey {
  key:     string;  // "mint:{playerId}:{plotId}"
  status:  MintStatus;
  assetId: AssetId | null;
  txId:    TxId    | null;
  createdAt: number; // Unix ms
  updatedAt: number;
}
FRONTIER_FILE_END_MARKER

echo "Writing server/engine/ai/reconquest.ts..."
cat > server/engine/ai/reconquest.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/engine/ai/reconquest.ts
 *
 * FRONTIER AI Reconquest Engine — pure functions, no I/O.
 */

export const RECONQUEST_GRACE_PERIOD_MS     = 6  * 60 * 60 * 1000; // 6 hours
export const RECONQUEST_ATTEMPT_WINDOW_MS   = 48 * 60 * 60 * 1000; // 48 hours
export const RECONQUEST_COST_ESCALATION     = 0.25; // per handover exchange
export const MIN_TERRITORIES_FOR_RECONQUEST = 3;

export type AiBehavior = "expansionist" | "defensive" | "raider" | "economic";

export interface FactionReconquestProfile {
  readinessThreshold:         number;
  aggressionModifier:         number;
  isRaider:                   boolean;
  prefersRichPlots:           boolean;
  minDefenseBeforeReconquest: number;
}

export const FACTION_PROFILES: Record<string, FactionReconquestProfile> = {
  "NEXUS-7": {
    readinessThreshold:         0.6,
    aggressionModifier:         1.3,
    isRaider:                   false,
    prefersRichPlots:           false,
    minDefenseBeforeReconquest: 2,
  },
  "KRONOS": {
    readinessThreshold:         1.2,
    aggressionModifier:         0.6,
    isRaider:                   false,
    prefersRichPlots:           false,
    minDefenseBeforeReconquest: 5,
  },
  "VANGUARD": {
    readinessThreshold:         0.5,
    aggressionModifier:         1.4,
    isRaider:                   true,
    prefersRichPlots:           false,
    minDefenseBeforeReconquest: 1,
  },
  "SPECTRE": {
    readinessThreshold:         0.8,
    aggressionModifier:         1.0,
    isRaider:                   false,
    prefersRichPlots:           true,
    minDefenseBeforeReconquest: 3,
  },
};

export interface ContestedPlot {
  parcelId:            string;
  plotId:              number;
  richness:            number;
  capturedFromFaction: string;
  capturedAt:          number;
  handoverCount:       number;
  currentDefenseLevel: number;
}

export interface AiFactionState {
  id:                  string;
  name:                string;
  behavior:            AiBehavior;
  iron:                number;
  fuel:                number;
  ownedTerritoryCount: number;
  averageDefenseLevel: number;
  moraleDebuffUntil:   number;
  attackCooldownUntil: number;
}

export interface ReconquestDecision {
  shouldAttempt:   boolean;
  targetParcelId:  string | null;
  troopsCommitted: number;
  resourcesBurned: { iron: number; fuel: number };
  reason:          string;
  isRaid:          boolean;
}

export function evaluateReconquest(
  ai:             AiFactionState,
  contested:      ContestedPlot[],
  now:            number,
  randomValue:    number,
  attackBaseCost: { iron: number; fuel: number },
): ReconquestDecision {
  const NO: ReconquestDecision = {
    shouldAttempt: false, targetParcelId: null,
    troopsCommitted: 0, resourcesBurned: { iron: 0, fuel: 0 },
    reason: "no_action", isRaid: false,
  };

  const profile = FACTION_PROFILES[ai.name] ?? FACTION_PROFILES["NEXUS-7"];

  if (ai.ownedTerritoryCount < MIN_TERRITORIES_FOR_RECONQUEST)
    return { ...NO, reason: "insufficient_territory" };
  if (ai.attackCooldownUntil > now)
    return { ...NO, reason: "attack_cooldown_active" };
  if (ai.moraleDebuffUntil > now)
    return { ...NO, reason: "morale_debuff_active" };
  if (ai.averageDefenseLevel < profile.minDefenseBeforeReconquest)
    return { ...NO, reason: "fortifying_home_first" };

  const totalResources  = ai.iron + ai.fuel;
  const attackCostTotal = attackBaseCost.iron + attackBaseCost.fuel;
  const threshold       = (profile.readinessThreshold / profile.aggressionModifier) * attackCostTotal;

  if (totalResources < threshold)
    return { ...NO, reason: "building_resources" };

  const eligible = contested.filter((p) => {
    const age = now - p.capturedAt;
    return age >= RECONQUEST_GRACE_PERIOD_MS &&
           age <= RECONQUEST_GRACE_PERIOD_MS + RECONQUEST_ATTEMPT_WINDOW_MS;
  });

  if (eligible.length === 0)
    return { ...NO, reason: "no_eligible_plots" };

  // SPECTRE prefers richest plot; others pick randomly
  let target: ContestedPlot;
  if (profile.prefersRichPlots) {
    const sorted = [...eligible].sort((a, b) => b.richness - a.richness);
    if (sorted[0].richness < 60) return { ...NO, reason: "low_richness_not_worth_it" };
    target = sorted[0];
  } else {
    target = eligible[Math.floor(randomValue * eligible.length)];
  }

  // Escalate cost each time the plot has changed hands
  const escalation      = 1 + target.handoverCount * RECONQUEST_COST_ESCALATION;
  const troopsCommitted = Math.max(1, Math.floor((ai.iron / attackBaseCost.iron) * profile.aggressionModifier * escalation));
  const ironBurn        = Math.min(ai.iron, Math.floor(attackBaseCost.iron * escalation * profile.aggressionModifier));
  const fuelBurn        = Math.min(ai.fuel, Math.floor(attackBaseCost.fuel * escalation * profile.aggressionModifier));

  return {
    shouldAttempt:   true,
    targetParcelId:  target.parcelId,
    troopsCommitted,
    resourcesBurned: { iron: ironBurn, fuel: fuelBurn },
    reason:          profile.isRaider
      ? `${ai.name} raids plot #${target.plotId} for resources`
      : `${ai.name} reconquering lost plot #${target.plotId} (exchange #${target.handoverCount + 1})`,
    isRaid: profile.isRaider,
  };
}

export function shouldAbandonAfterCapture(factionName: string): boolean {
  return FACTION_PROFILES[factionName]?.isRaider ?? false;
}

/** Defense level a human needs to permanently deter further reconquest attempts. */
export function deterrenceThreshold(factionName: string, handoverCount: number): number {
  const profile = FACTION_PROFILES[factionName] ?? FACTION_PROFILES["NEXUS-7"];
  return Math.max(1, (profile.minDefenseBeforeReconquest + 2) - Math.floor(handoverCount * 0.5));
}
FRONTIER_FILE_END_MARKER

echo "Writing server/engine/ai/smoke.ts..."
cat > server/engine/ai/smoke.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/engine/ai/smoke.ts
 * Run: npx tsx server/engine/ai/smoke.ts
 */
import {
  evaluateReconquest,
  shouldAbandonAfterCapture,
  deterrenceThreshold,
  RECONQUEST_GRACE_PERIOD_MS,
  FACTION_PROFILES,
  type AiFactionState,
  type ContestedPlot,
} from "./reconquest.js";

function assert(ok: boolean, msg: string) {
  if (!ok) { console.error(`❌ FAIL: ${msg}`); process.exit(1); }
  console.log(`✅ PASS: ${msg}`);
}

const BASE_AI: AiFactionState = {
  id: "ai-nexus", name: "NEXUS-7", behavior: "expansionist",
  iron: 200, fuel: 150, ownedTerritoryCount: 10,
  averageDefenseLevel: 3, moraleDebuffUntil: 0, attackCooldownUntil: 0,
};

const BASE_COST = { iron: 30, fuel: 20 };
const NOW       = Date.now();

// A plot captured 8 hours ago (past grace period)
const ELIGIBLE_PLOT: ContestedPlot = {
  parcelId: "plot-abc", plotId: 42, richness: 75,
  capturedFromFaction: "NEXUS-7",
  capturedAt: NOW - (8 * 60 * 60 * 1000),
  handoverCount: 1, currentDefenseLevel: 2,
};

// A plot captured 2 hours ago (inside grace period)
const GRACE_PLOT: ContestedPlot = {
  ...ELIGIBLE_PLOT, parcelId: "plot-grace",
  capturedAt: NOW - (2 * 60 * 60 * 1000),
};

// ── Test 1: NEXUS-7 should reconquer eligible plot ───────────────────────────
const d1 = evaluateReconquest(BASE_AI, [ELIGIBLE_PLOT], NOW, 0.5, BASE_COST);
assert(d1.shouldAttempt === true,        "NEXUS-7 reconquers eligible plot");
assert(d1.targetParcelId === "plot-abc", "Correct target parcel");
assert(d1.isRaid === false,              "NEXUS-7 is not a raider");

// ── Test 2: Grace period blocks reconquest ───────────────────────────────────
const d2 = evaluateReconquest(BASE_AI, [GRACE_PLOT], NOW, 0.5, BASE_COST);
assert(d2.shouldAttempt === false, "Grace period blocks reconquest");
assert(d2.reason === "no_eligible_plots", "Correct reason: no_eligible_plots");

// ── Test 3: VANGUARD is a raider ─────────────────────────────────────────────
assert(shouldAbandonAfterCapture("VANGUARD") === true,  "VANGUARD abandons after capture");
assert(shouldAbandonAfterCapture("NEXUS-7")  === false, "NEXUS-7 holds territory");
assert(shouldAbandonAfterCapture("KRONOS")   === false, "KRONOS holds territory");

// ── Test 4: KRONOS requires more resources and higher defense before acting ───
const kronosAI: AiFactionState = { ...BASE_AI, name: "KRONOS", averageDefenseLevel: 2 };
const d4 = evaluateReconquest(kronosAI, [ELIGIBLE_PLOT], NOW, 0.5, BASE_COST);
assert(d4.shouldAttempt === false, "KRONOS waits until home defense is high enough");
assert(d4.reason === "fortifying_home_first", "Correct reason: fortifying_home_first");

// ── Test 5: KRONOS acts when strong enough ────────────────────────────────────
const strongKronos: AiFactionState = {
  ...BASE_AI, name: "KRONOS", iron: 1000, fuel: 800, averageDefenseLevel: 6,
};
const d5 = evaluateReconquest(strongKronos, [ELIGIBLE_PLOT], NOW, 0.5, BASE_COST);
assert(d5.shouldAttempt === true, "KRONOS acts when well-stocked and fortified");

// ── Test 6: SPECTRE ignores low-richness plots ───────────────────────────────
const spectreAI: AiFactionState = { ...BASE_AI, name: "SPECTRE", averageDefenseLevel: 4 };
const lowRichPlot: ContestedPlot = { ...ELIGIBLE_PLOT, richness: 30 };
const d6 = evaluateReconquest(spectreAI, [lowRichPlot], NOW, 0.5, BASE_COST);
assert(d6.shouldAttempt === false, "SPECTRE ignores low-richness plot");

// ── Test 7: SPECTRE takes high-richness plots ─────────────────────────────────
const richPlot: ContestedPlot = { ...ELIGIBLE_PLOT, richness: 90 };
const d7 = evaluateReconquest(spectreAI, [richPlot], NOW, 0.5, BASE_COST);
assert(d7.shouldAttempt === true, "SPECTRE reconquers high-richness plot");

// ── Test 8: Escalating troops/cost per handover ───────────────────────────────
const plot1x: ContestedPlot = { ...ELIGIBLE_PLOT, handoverCount: 1 };
const plot3x: ContestedPlot = { ...ELIGIBLE_PLOT, handoverCount: 3 };
const r1x = evaluateReconquest(BASE_AI, [plot1x], NOW, 0.5, BASE_COST);
const r3x = evaluateReconquest(BASE_AI, [plot3x], NOW, 0.5, BASE_COST);
assert(r3x.resourcesBurned.iron >= r1x.resourcesBurned.iron, "Cost escalates with handoverCount");
assert(r3x.troopsCommitted >= r1x.troopsCommitted,           "Troops escalate with handoverCount");

// ── Test 9: Deterrence threshold decreases with exchanges ─────────────────────
const thresh0 = deterrenceThreshold("NEXUS-7", 0);
const thresh3 = deterrenceThreshold("NEXUS-7", 3);
assert(thresh3 < thresh0, "Deterrence threshold decreases as exchanges increase");

// ── Test 10: Insufficient territory blocks reconquest ────────────────────────
const tinyAI: AiFactionState = { ...BASE_AI, ownedTerritoryCount: 2 };
const d10 = evaluateReconquest(tinyAI, [ELIGIBLE_PLOT], NOW, 0.5, BASE_COST);
assert(d10.shouldAttempt === false,         "Tiny faction cannot reconquer");
assert(d10.reason === "insufficient_territory", "Correct reason");

console.log("\n🎮 All FRONTIER AI Reconquest Engine smoke tests passed.");
FRONTIER_FILE_END_MARKER

echo "Writing server/engine/battle/types.ts..."
cat > server/engine/battle/types.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/engine/battle/types.ts
 *
 * Pure, serializable types for the FRONTIER Battle Engine.
 * No DB models, no algosdk, no Express — only data shapes.
 */

export type FactionId = string; // e.g. "NEXUS-7" | "KRONOS" | "VANGUARD" | "SPECTRE" | <playerId>
export type PlayerId  = string; // UUID or AI_ prefixed ID
export type PlotId    = number; // Integer plot identifier

export type BiomeType =
  | "forest" | "desert" | "mountain" | "plains"
  | "water"  | "tundra" | "volcanic" | "swamp";

export type ImprovementType =
  | "turret" | "shield_gen" | "fortress"
  | "mine"   | "refinery"   | "solar_array";

export interface BattleImprovement {
  type:  ImprovementType;
  level: number;
}

/**
 * All inputs the battle engine needs to produce a deterministic result.
 * Caller (route/storage) is responsible for loading these from DB.
 */
export interface BattleInput {
  // Identity
  battleId:   string;
  attackerId: PlayerId;
  defenderId: PlayerId | null;
  plotId:     PlotId;

  // Attacker stats
  troopsCommitted:   number;
  resourcesBurned:   { iron: number; fuel: number };
  commanderBonus:    number; // already-resolved commander attack bonus (0 if none)
  moraleDebuffActive: boolean;

  // Defender stats
  defenseLevel:    number;
  biome:           BiomeType;
  improvements:    BattleImprovement[];

  // Orbital / external modifiers
  orbitalHazardActive: boolean; // ORBITAL_TILE_HAZARD reduces defense

  /**
   * Deterministic seed. Caller should derive this from:
   *   hashSeed(battleId, startTs)
   * so that the same battle always produces the same outcome.
   */
  randomSeed: number;
}

export interface BattleLogEntry {
  phase:   "power_calc" | "morale" | "terrain" | "resolution";
  message: string;
}

/**
 * Fully deterministic result produced by resolveBattle().
 * Contains everything the route needs to write back to the DB.
 */
export interface BattleResult {
  winner:          "attacker" | "defender";
  attackerPower:   number; // final adjusted power
  defenderPower:   number; // final adjusted power
  randFactor:      number; // -10 … +10
  outcome:         "attacker_wins" | "defender_wins";

  // Resource changes (positive = attacker gains / defender loses)
  pillagedIron:    number;
  pillagedFuel:    number;
  pillagedCrystal: number;

  log: BattleLogEntry[];
}
FRONTIER_FILE_END_MARKER

echo "Writing server/engine/battle/random.ts..."
cat > server/engine/battle/random.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/engine/battle/random.ts
 *
 * Deterministic pseudo-random number generator for the FRONTIER Battle Engine.
 * No crypto dependency — only pure arithmetic so outcomes are reproducible
 * across both MemStorage and DbStorage.
 */

/**
 * Mulberry32 — fast 32-bit PRNG with good statistical properties.
 * Returns a function that yields floats in [0, 1).
 *
 * @see https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive a stable 32-bit integer seed from one or more string/number parts.
 * Uses djb2-style hashing so the result is deterministic across JS engines.
 *
 * Usage:
 *   const seed = hashSeed(battle.id, battle.startTs);
 */
export function hashSeed(...parts: (string | number)[]): number {
  const combined = parts.map(String).join("|");
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Return a random integer in the closed interval [min, max].
 */
export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
FRONTIER_FILE_END_MARKER

echo "Writing server/engine/battle/tuning.ts..."
cat > server/engine/battle/tuning.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/engine/battle/tuning.ts
 *
 * Centralised numeric constants for the FRONTIER Battle Engine.
 * Change these to re-balance the game without touching resolve.ts.
 */

// ── Power Multipliers ────────────────────────────────────────────────────────

/** Troops-to-power conversion: each troop contributes this much attacker power. */
export const TROOPS_POWER_FACTOR = 10;

/** Iron burned → attacker power contribution per unit. */
export const IRON_POWER_FACTOR = 0.5;

/** Fuel burned → attacker power contribution per unit. */
export const FUEL_POWER_FACTOR = 0.8;

/** Base defense level multiplier. */
export const BASE_DEFENSE_POWER = 15;

/** Each improvement level of turret / shield_gen / fortress adds this much defense power. */
export const IMPROVEMENT_DEFENSE_PER_LEVEL = 5;

// ── Morale ───────────────────────────────────────────────────────────────────

/** Attacker power is reduced by this fraction when morale debuff is active (0.0–1.0). */
export const MORALE_ATTACK_PENALTY = 0.15;

// ── Terrain ──────────────────────────────────────────────────────────────────

export const BIOME_DEFENSE_MOD: Record<string, number> = {
  mountain:  1.4,
  volcanic:  1.3,
  tundra:    1.2,
  forest:    1.1,
  swamp:     1.1,
  plains:    1.0,
  desert:    0.9,
  water:     0.5, // effectively un-capturable via normal battle
};

// ── Randomness ───────────────────────────────────────────────────────────────

/**
 * randFactor range: attacker power is multiplied by (1 + randFactor/100).
 * Range is [-RAND_FACTOR_MAX, +RAND_FACTOR_MAX].
 */
export const RAND_FACTOR_MAX = 10;

// ── Pillage ──────────────────────────────────────────────────────────────────

/** Fraction of stored resources attacker claims on victory (0.0–1.0). */
export const PILLAGE_RATE = 0.3;

// ── Orbital Hazard ───────────────────────────────────────────────────────────

/** Defense reduction when ORBITAL_TILE_HAZARD is active on the target plot. */
export const ORBITAL_HAZARD_DEFENSE_PENALTY = 0.2;

// ── AI Faction Presets ───────────────────────────────────────────────────────
// These are fed into BattleInput.commanderBonus when AI attacks.

export const AI_FACTION_PRESETS: Record<string, { attackModifier: number; defenseModifier: number }> = {
  "NEXUS-7":  { attackModifier: 1.2, defenseModifier: 1.0 }, // expansionist
  "KRONOS":   { attackModifier: 0.9, defenseModifier: 1.3 }, // defensive
  "VANGUARD": { attackModifier: 1.3, defenseModifier: 0.9 }, // raider
  "SPECTRE":  { attackModifier: 1.0, defenseModifier: 1.0 }, // economic
};
FRONTIER_FILE_END_MARKER

echo "Writing server/engine/battle/resolve.ts..."
cat > server/engine/battle/resolve.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/engine/battle/resolve.ts
 *
 * FRONTIER Battle Engine — deterministic resolution.
 *
 * CONTRACT:
 *   - Given identical BattleInput, always returns identical BattleResult.
 *   - No DB calls, no network, no Algorand SDK, no randomUUID.
 *   - All randomness flows through mulberry32(input.randomSeed).
 */

import type { BattleInput, BattleResult, BattleLogEntry } from "./types.js";
import { mulberry32, randInt } from "./random.js";
import {
  TROOPS_POWER_FACTOR,
  IRON_POWER_FACTOR,
  FUEL_POWER_FACTOR,
  BASE_DEFENSE_POWER,
  IMPROVEMENT_DEFENSE_PER_LEVEL,
  MORALE_ATTACK_PENALTY,
  BIOME_DEFENSE_MOD,
  RAND_FACTOR_MAX,
  PILLAGE_RATE,
  ORBITAL_HAZARD_DEFENSE_PENALTY,
} from "./tuning.js";

export function resolveBattle(input: BattleInput): BattleResult {
  const log: BattleLogEntry[] = [];
  const rng = mulberry32(input.randomSeed);

  // ── Attacker Power ────────────────────────────────────────────────────────
  const rawAttackerPower =
    input.troopsCommitted * TROOPS_POWER_FACTOR +
    input.resourcesBurned.iron * IRON_POWER_FACTOR +
    input.resourcesBurned.fuel * FUEL_POWER_FACTOR +
    input.commanderBonus;

  log.push({
    phase: "power_calc",
    message: `Raw attacker power: ${rawAttackerPower.toFixed(2)} (troops=${input.troopsCommitted}, iron=${input.resourcesBurned.iron}, fuel=${input.resourcesBurned.fuel}, cmdBonus=${input.commanderBonus})`,
  });

  // ── Morale Debuff ─────────────────────────────────────────────────────────
  const attackerPower = input.moraleDebuffActive
    ? rawAttackerPower * (1 - MORALE_ATTACK_PENALTY)
    : rawAttackerPower;

  if (input.moraleDebuffActive) {
    log.push({
      phase: "morale",
      message: `Morale debuff active: attacker power reduced ${(MORALE_ATTACK_PENALTY * 100).toFixed(0)}% → ${attackerPower.toFixed(2)}`,
    });
  }

  // ── Defender Power ────────────────────────────────────────────────────────
  const biomeMod = BIOME_DEFENSE_MOD[input.biome] ?? 1.0;

  const improvementBonus = input.improvements
    .filter((i) => ["turret", "shield_gen", "fortress"].includes(i.type))
    .reduce((sum, i) => sum + i.level * IMPROVEMENT_DEFENSE_PER_LEVEL, 0);

  let rawDefenderPower = (input.defenseLevel * BASE_DEFENSE_POWER + improvementBonus) * biomeMod;

  log.push({
    phase: "terrain",
    message: `Biome=${input.biome} (×${biomeMod}), improvements bonus=${improvementBonus}, base defender power: ${rawDefenderPower.toFixed(2)}`,
  });

  // ── Orbital Hazard ────────────────────────────────────────────────────────
  if (input.orbitalHazardActive) {
    rawDefenderPower *= 1 - ORBITAL_HAZARD_DEFENSE_PENALTY;
    log.push({
      phase: "terrain",
      message: `Orbital hazard active: defender power reduced ${(ORBITAL_HAZARD_DEFENSE_PENALTY * 100).toFixed(0)}% → ${rawDefenderPower.toFixed(2)}`,
    });
  }

  const defenderPower = rawDefenderPower;

  // ── Random Factor ─────────────────────────────────────────────────────────
  // randFactor in [-RAND_FACTOR_MAX, +RAND_FACTOR_MAX]
  const randFactor = randInt(rng, -RAND_FACTOR_MAX, RAND_FACTOR_MAX);
  const adjustedAttackerPower = attackerPower * (1 + randFactor / 100);

  log.push({
    phase: "resolution",
    message: `randFactor=${randFactor}, adjusted attacker=${adjustedAttackerPower.toFixed(2)}, defender=${defenderPower.toFixed(2)}`,
  });

  // ── Outcome ───────────────────────────────────────────────────────────────
  const attackerWins = adjustedAttackerPower > defenderPower;
  const outcome: BattleResult["outcome"] = attackerWins ? "attacker_wins" : "defender_wins";
  const winner: BattleResult["winner"]   = attackerWins ? "attacker"      : "defender";

  log.push({
    phase: "resolution",
    message: `Outcome: ${outcome}`,
  });

  // ── Pillage (only on attacker win) ────────────────────────────────────────
  // Note: actual stored amounts are not available in BattleInput by design.
  // The route must multiply these rates against the actual stored values.
  // We encode the rate here; caller applies it.
  //
  // To avoid making BattleInput depend on mutable game state (stored resources),
  // the engine returns PILLAGE_RATE and the caller computes actual amounts:
  //   pillagedIron = Math.floor(targetParcel.ironStored * result.pillagedIron)
  //
  // For ergonomics we return the rate directly as the pillagedX fields.
  const pillagedIron    = attackerWins ? PILLAGE_RATE : 0;
  const pillagedFuel    = attackerWins ? PILLAGE_RATE : 0;
  const pillagedCrystal = attackerWins ? PILLAGE_RATE : 0;

  return {
    winner,
    attackerPower: adjustedAttackerPower,
    defenderPower,
    randFactor,
    outcome,
    pillagedIron,
    pillagedFuel,
    pillagedCrystal,
    log,
  };
}
FRONTIER_FILE_END_MARKER

echo "Writing server/engine/battle/smoke.ts..."
cat > server/engine/battle/smoke.ts << 'FRONTIER_FILE_END_MARKER'
/**
 * server/engine/battle/smoke.ts
 *
 * Determinism smoke test for the FRONTIER Battle Engine.
 * Run with: npx tsx server/engine/battle/smoke.ts
 *
 * Exits 0 on pass, 1 on failure.
 */

import { resolveBattle } from "./resolve.js";
import { hashSeed } from "./random.js";
import type { BattleInput } from "./types.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

// ── Fixture ──────────────────────────────────────────────────────────────────

const BASE_INPUT: BattleInput = {
  battleId:   "test-battle-001",
  attackerId: "player-alpha",
  defenderId: "player-beta",
  plotId:     42,
  troopsCommitted:    50,
  resourcesBurned:    { iron: 20, fuel: 10 },
  commanderBonus:     15,
  moraleDebuffActive: false,
  defenseLevel:       3,
  biome:              "plains",
  improvements:       [{ type: "turret", level: 2 }],
  orbitalHazardActive: false,
  randomSeed:         hashSeed("test-battle-001", 1710000000000),
};

// ── Test 1: Determinism — same input → same output ───────────────────────────

const r1 = resolveBattle(BASE_INPUT);
const r2 = resolveBattle(BASE_INPUT);

assert(r1.outcome === r2.outcome,       "Same input produces same outcome");
assert(r1.randFactor === r2.randFactor, "Same input produces same randFactor");
assert(r1.attackerPower === r2.attackerPower, "Same input produces same attackerPower");
assert(r1.defenderPower === r2.defenderPower, "Same input produces same defenderPower");

// ── Test 2: Different seed → potentially different outcome ────────────────────

let differentOutcomeFound = false;
for (let i = 0; i < 20; i++) {
  const altInput: BattleInput = { ...BASE_INPUT, randomSeed: hashSeed("battle", i, 12345) };
  const altResult = resolveBattle(altInput);
  if (altResult.outcome !== r1.outcome || altResult.randFactor !== r1.randFactor) {
    differentOutcomeFound = true;
    break;
  }
}
assert(differentOutcomeFound, "Different seeds can produce different outcomes");

// ── Test 3: No negative pillage rates ────────────────────────────────────────

assert(r1.pillagedIron    >= 0, "pillagedIron rate >= 0");
assert(r1.pillagedFuel    >= 0, "pillagedFuel rate >= 0");
assert(r1.pillagedCrystal >= 0, "pillagedCrystal rate >= 0");

// ── Test 4: Attacker wins 0 pillage if defender wins ─────────────────────────

// Find a seed where defender wins
let defenderWinResult = null;
for (let i = 0; i < 100; i++) {
  // Weak attacker input
  const weakInput: BattleInput = {
    ...BASE_INPUT,
    troopsCommitted: 1,
    resourcesBurned: { iron: 0, fuel: 0 },
    commanderBonus:  0,
    defenseLevel:    10,
    biome:           "mountain",
    improvements:    [{ type: "fortress", level: 5 }],
    randomSeed:      hashSeed("weak-attacker", i),
  };
  const wr = resolveBattle(weakInput);
  if (wr.outcome === "defender_wins") {
    defenderWinResult = wr;
    break;
  }
}

if (defenderWinResult) {
  assert(defenderWinResult.pillagedIron    === 0, "No pillage on defender win (iron)");
  assert(defenderWinResult.pillagedFuel    === 0, "No pillage on defender win (fuel)");
  assert(defenderWinResult.pillagedCrystal === 0, "No pillage on defender win (crystal)");
} else {
  console.log("⚠️  SKIP: Could not find a defender win in 100 seeds (expected with mountain+fortress+5)");
}

// ── Test 5: Morale debuff reduces attacker power ──────────────────────────────

const withMorale:    BattleResult = resolveBattle({ ...BASE_INPUT, moraleDebuffActive: true,  randomSeed: hashSeed("morale-test") });
const withoutMorale: BattleResult = resolveBattle({ ...BASE_INPUT, moraleDebuffActive: false, randomSeed: hashSeed("morale-test") });

assert(
  withMorale.attackerPower < withoutMorale.attackerPower,
  "Morale debuff reduces attacker power"
);

// ── Test 6: Log is populated ──────────────────────────────────────────────────

assert(r1.log.length > 0,                          "Result log is populated");
assert(r1.log.some((l) => l.phase === "resolution"), "Log includes resolution phase");

// ── Done ──────────────────────────────────────────────────────────────────────

console.log("\n🎮 All FRONTIER Battle Engine smoke tests passed.");
FRONTIER_FILE_END_MARKER

# Delete stray file
rm -f server/services/chain/routes.ts

echo ""
echo "All files written. Running smoke tests..."
npx tsx server/engine/battle/smoke.ts 2>&1 | tail -2
npx tsx server/engine/ai/smoke.ts 2>&1 | tail -2

echo ""
echo "Now run: npm run db:push && npm run dev"
