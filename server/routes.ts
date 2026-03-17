import type { Express, Request, Response } from "express";
import { getBattleReplay, recordSubParcelWorldEvent } from "./services/redis";
import { createServer, type Server } from "http";
import algosdk from "algosdk";
import { storage } from "./storage";
import { mineActionSchema, upgradeActionSchema, attackActionSchema, buildActionSchema, purchaseActionSchema, collectActionSchema, claimFrontierActionSchema, mintAvatarActionSchema, specialAttackActionSchema, deployDroneActionSchema, deploySatelliteActionSchema, SlimGameState, createTradeOrderSchema, placeBetSchema, createMarketSchema, resolveMarketSchema } from "@shared/schema";
import { z } from "zod";
import { db, withDbRetry } from "./db";
import { parcels as parcelsTable, plotNfts as plotNftsTable, players as playersTable, mintIdempotency as mintIdempotencyTable, battles as battlesTable, gameEvents as gameEventsTable, gameMeta, tradeOrders as tradeOrdersTable, subParcels as subParcelsTable, orbitalEvents as orbitalEventsTable, commanderNfts as commanderNftsTable, commanderMintIdempotency as commanderMintIdempotencyTable } from "./db-schema";
import { eq, sql } from "drizzle-orm";
import { broadcastGameState, broadcastRaw, markDirty } from "./wsServer";
import { appendWorldEvent, listWorldEvents, getRecentWorldEvents } from "./worldEventStore";

// ── Chain Service ─────────────────────────────────────────────────────────────
// All algosdk usage is now isolated in server/services/chain/*.
// Routes import ONLY from the service layer — never from algosdk directly.
import { getFrontierAsaId, getOrCreateFrontierAsa, isAddressOptedIn, setFrontierAsaId, batchedTransferFrontierAsa, clawbackFrontierAsa } from "./services/chain/asa";
import { getAdminAddress, getAdminBalance, getAlgodClient, getIndexerClient } from "./services/chain/client";
import { mintLandNft, transferLandNft } from "./services/chain/land";
import { recordUpgradeOnChain } from "./services/chain/upgrades";
import { mintCommanderNft, transferCommanderNft, forwardLiquiditySplit, verifyAlgoPayment } from "./services/chain/commander";
import {
  bootstrapFactionIdentities,
  getAllFactionAsaIds,
  getFactionAsaId,
  FACTION_DEFINITIONS,
} from "./services/chain/factions";
import { fromMicroFRNTR } from "./storage/game-rules";

const algodClient    = getAlgodClient();
const indexerClient  = getIndexerClient();

/**
 * Fire-and-forget on-chain FRONTIER burn via clawback.
 * Only fires for real wallets (not AI, not placeholder addresses).
 * Game action is never blocked if this fails — DB is source of truth.
 */
function fireBurn(walletAddress: string, amount: number, note: string): void {
  const asaId = getFrontierAsaId();
  const isRealWallet =
    walletAddress &&
    walletAddress !== 'PLAYER_WALLET' &&
    !walletAddress.startsWith('AI_') &&
    algosdk.isValidAddress(walletAddress);

  if (!asaId || !isRealWallet || amount <= 0) return;

  clawbackFrontierAsa(walletAddress, amount, note)
    .then(txId => { if (txId) console.log(`[burn] ${amount} FRONTIER from ${walletAddress} txId=${txId}`); })
    .catch(err => console.error('[burn] clawback failed:', err));
}

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
      const factionBaseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
      if (!factionBaseUrl) throw new Error("[faction seed] PUBLIC_BASE_URL must be set — cannot seed faction metadata without a valid public URL");
      bootstrapFactionIdentities(factionBaseUrl).catch((err) =>
        console.error("[routes] Faction identity bootstrap failed:", err)
      );
    } catch (err) {
      console.error("[routes] Blockchain init failed:", err);
    }
  })();

  /**
   * Verifies the playerId in req.body exists in the DB and is not an AI player.
   * Returns the verified playerId or null (response already sent on failure).
   */
  async function assertPlayerOwnership(
    req: Request,
    res: Response,
    bodyPlayerId?: string
  ): Promise<string | null> {
    const targetId = bodyPlayerId ?? req.body?.playerId;

    if (!targetId || typeof targetId !== "string") {
      res.status(401).json({ error: "Player ID required" });
      return null;
    }

    const player = await storage.getPlayer(targetId).catch(() => null);
    if (!player) {
      res.status(404).json({ error: "Player not found" });
      return null;
    }
    if (player.isAI) {
      res.status(403).json({ error: "Forbidden" });
      return null;
    }

    return targetId;
  }

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

      // Treasury ledger balance from DB (protocol fees collected)
      let protocolTreasuryUnsettled = 0;
      let protocolTreasuryTotal     = 0;
      try {
        const bal = await storage.getTreasuryBalance();
        protocolTreasuryUnsettled = Math.round(fromMicroFRNTR(bal.unsettledMicro) * 100) / 100;
        protocolTreasuryTotal     = Math.round(fromMicroFRNTR(bal.totalMicro)     * 100) / 100;
      } catch (_e) { /* non-fatal */ }

      res.json({
        asaId,
        adminAddress: adminAddr,
        totalSupply,
        treasury: Math.round(treasury * 100) / 100,
        circulating,
        totalBurned,
        inGameCirculating,
        protocolTreasuryUnsettled,
        protocolTreasuryTotal,
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
      const rawBaseUrl = process.env.PUBLIC_BASE_URL || null;
      const baseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, "") : null;
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
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.json({
        name:         `Frontier Plot #${parcel.plotId}`,
        description:  `A ${parcel.biome} land parcel on the Frontier globe. Richness: ${parcel.richness}%. Own, mine, upgrade, and battle for territory on the Algorand blockchain.`,
        image:        `${baseUrl}/nft/biomes/${parcel.biome}.png`,
        external_url: `${baseUrl}/plot/${parcel.plotId}`,
        properties: {
          plotId:            parcel.plotId,
          biome:             parcel.biome,
          lat:               parcel.lat,
          lng:               parcel.lng,
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

  // Deliver a custody-held Plot NFT to its owner after they have opted in.
  // POST /api/nft/deliver/:plotId  body: { address: string }
  app.post("/api/nft/deliver/:plotId", async (req, res) => {
    const plotId = parseInt(req.params.plotId, 10);
    if (isNaN(plotId) || plotId < 1) {
      return res.status(400).json({ error: "plotId must be a positive integer" });
    }
    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    const { address } = req.body;
    if (!address || !algosdk.isValidAddress(address)) {
      return res.status(400).json({ error: "Valid Algorand address required in body.address" });
    }

    try {
      const [row] = await db.select().from(plotNftsTable).where(eq(plotNftsTable.plotId, plotId));

      if (!row) return res.status(404).json({ error: "No NFT record for this plot — not yet minted" });

      const assetId = row.assetId ? Number(row.assetId) : null;
      if (!assetId) return res.status(404).json({ error: "NFT not yet minted for this plot" });

      const adminAddr = getAdminAddress();
      if (row.mintedToAddress !== adminAddr) {
        return res.json({ success: false, reason: "not_in_custody", message: "NFT already delivered to buyer", assetId });
      }

      // Verify the caller's wallet has opted into this specific plot NFT ASA
      const optedIn = await isAddressOptedIn(address, assetId);
      if (!optedIn) {
        return res.json({
          success: false,
          reason: "not_opted_in",
          message: `Add asset ${assetId} to your Pera wallet to receive your Plot NFT. Your land ownership is already recorded.`,
          assetId,
          hint: "opt_in_required"
        });
      }

      // Transfer the NFT from admin to the buyer
      const { txId } = await transferLandNft({ assetId, toAddress: address });

      // Update the holder address in plot_nfts
      await db.update(plotNftsTable)
        .set({ mintedToAddress: address })
        .where(eq(plotNftsTable.plotId, plotId));

      console.log(`[nft/deliver] plotId=${plotId} assetId=${assetId} delivered to ${address} txId=${txId}`);
      res.json({ success: true, plotId, assetId, txId, explorerUrl: `https://allo.info/asset/${assetId}` });
    } catch (error) {
      console.error(`[nft/deliver] plotId=${plotId} error:`, error instanceof Error ? error.message : error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Delivery failed" });
    }
  });

  // ── Commander NFT Image Serving ─────────────────────────────────────────────
  // Serves Commander tier PNGs as stable public URLs baked into on-chain ASA metadata.
  // GET /nft/images/commander/:tier
  const COMMANDER_IMAGE_FILES: Record<string, string> = {
    sentinel: "image_1771570491560.png",
    phantom:  "image_1771570495782.png",
    reaper:   "image_1771570500912.png",
  };

  app.get("/nft/images/commander/:tier", (req, res) => {
    const { tier } = req.params;
    const filename = COMMANDER_IMAGE_FILES[tier];
    if (!filename) return res.status(404).json({ error: "Unknown commander tier" });

    const filePath = require("path").resolve(
      __dirname, "..", "client", "src", "assets", filename
    );
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(filePath);
  });

  // ── Commander NFT Metadata (ARC-3) ──────────────────────────────────────────
  // GET /nft/metadata/commander/:commanderId
  app.get("/nft/metadata/commander/:commanderId", async (req, res) => {
    const { commanderId } = req.params;
    if (!commanderId || commanderId.length < 8) {
      return res.status(400).json({ error: "Invalid commanderId" });
    }
    if (!db) return res.status(503).json({ error: "Database not available" });

    try {
      const rawBaseUrl = process.env.PUBLIC_BASE_URL || null;
      const baseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, "") : null;
      if (!baseUrl) {
        return res.status(503).json({ error: "PUBLIC_BASE_URL not configured — NFT metadata URLs would be invalid." });
      }

      // Look up the player whose commanders array contains this commanderId
      const { COMMANDER_INFO } = await import("@shared/schema");
      const players = await db.select({ id: playersTable.id, commanders: playersTable.commanders }).from(playersTable);
      let avatar: any = null;
      for (const p of players) {
        const cmds = (p.commanders as any[]) ?? [];
        const found = cmds.find((c: any) => c.id === commanderId);
        if (found) { avatar = found; break; }
      }

      if (!avatar) return res.status(404).json({ error: "Commander not found" });

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.json({
        name:         `Frontier Commander — ${avatar.name}`,
        description:  COMMANDER_INFO[avatar.tier as keyof typeof COMMANDER_INFO]?.description ?? `A ${avatar.tier} commander on the Frontier globe.`,
        image:        `${baseUrl}/nft/images/commander/${avatar.tier}`,
        external_url: `${baseUrl}/commander/${avatar.id}`,
        properties: {
          commanderId:    avatar.id,
          tier:           avatar.tier,
          name:           avatar.name,
          attackBonus:    avatar.attackBonus,
          defenseBonus:   avatar.defenseBonus,
          specialAbility: avatar.specialAbility,
          mintedAt:       avatar.mintedAt,
          version:        1,
        },
      });
    } catch (error) {
      console.error("[/nft/metadata/commander] error:", error);
      res.status(500).json({ error: "Failed to fetch Commander NFT metadata" });
    }
  });

  // ── Commander NFT Price ─────────────────────────────────────────────────────
  // GET /api/nft/commander-price/:tier
  // Returns the ALGO price for the given tier based on ALGO_USD_RATE env var.
  const COMMANDER_USD_PRICES: Record<string, number> = {
    sentinel: 1.50,
    phantom:  2.25,
    reaper:   3.25,
  };

  app.get("/api/nft/commander-price/:tier", (req, res) => {
    const { tier } = req.params;
    const usdPrice = COMMANDER_USD_PRICES[tier];
    if (usdPrice === undefined) return res.status(400).json({ error: "Unknown tier" });

    const algoUsdRate = parseFloat(process.env.ALGO_USD_RATE ?? "0.25");
    const algoPrice   = parseFloat((usdPrice / algoUsdRate).toFixed(6));
    const adminAddress = getAdminAddress();

    res.json({ tier, usdPrice, algoPrice, adminAddress });
  });

  // ── Commander NFT on-chain record lookup ────────────────────────────────────
  // GET /api/nft/commander/:commanderId
  app.get("/api/nft/commander/:commanderId", async (req, res) => {
    const { commanderId } = req.params;
    if (!commanderId) return res.status(400).json({ error: "commanderId required" });
    if (!db) return res.status(503).json({ error: "Database not available" });

    try {
      const [row] = await db.select().from(commanderNftsTable).where(eq(commanderNftsTable.commanderId, commanderId));
      if (!row) return res.status(404).json({ error: "No NFT record for this commander" });

      res.json({
        commanderId:     row.commanderId,
        assetId:         row.assetId ? Number(row.assetId) : null,
        mintedToAddress: row.mintedToAddress,
        mintedAt:        row.mintedAt ? Number(row.mintedAt) : null,
        explorerUrl:     row.assetId ? `https://allo.info/asset/${row.assetId}` : null,
      });
    } catch (error) {
      console.error("[api/nft/commander] lookup error:", error);
      res.status(500).json({ error: "Failed to fetch Commander NFT record" });
    }
  });

  // ── Commander NFT Delivery ──────────────────────────────────────────────────
  // POST /api/nft/deliver-commander/:commanderId  body: { address: string }
  app.post("/api/nft/deliver-commander/:commanderId", async (req, res) => {
    const { commanderId } = req.params;
    if (!commanderId) return res.status(400).json({ error: "commanderId required" });
    if (!db) return res.status(503).json({ error: "Database not available" });

    const { address } = req.body;
    if (!address || !algosdk.isValidAddress(address)) {
      return res.status(400).json({ error: "Valid Algorand address required in body.address" });
    }

    try {
      const [row] = await db.select().from(commanderNftsTable).where(eq(commanderNftsTable.commanderId, commanderId));
      if (!row) return res.status(404).json({ error: "No NFT record for this commander — not yet minted" });

      const assetId = row.assetId ? Number(row.assetId) : null;
      if (!assetId) return res.status(404).json({ error: "Commander NFT not yet minted" });

      const adminAddr = getAdminAddress();
      if (row.mintedToAddress !== adminAddr) {
        return res.json({ success: false, reason: "not_in_custody", message: "NFT already delivered to buyer", assetId });
      }

      const optedIn = await isAddressOptedIn(address, assetId);
      if (!optedIn) {
        return res.json({
          success:  false,
          reason:   "not_opted_in",
          message:  `Add asset ${assetId} to your Pera wallet to receive your Commander NFT.`,
          assetId,
          hint:     "opt_in_required",
        });
      }

      const { txId } = await transferCommanderNft({ assetId, toAddress: address });
      await db.update(commanderNftsTable)
        .set({ mintedToAddress: address })
        .where(eq(commanderNftsTable.commanderId, commanderId));

      console.log(`[nft/deliver-commander] commanderId=${commanderId} assetId=${assetId} delivered to ${address} txId=${txId}`);
      res.json({ success: true, commanderId, assetId, txId, explorerUrl: `https://allo.info/asset/${assetId}` });
    } catch (error) {
      console.error(`[nft/deliver-commander] commanderId=${commanderId} error:`, error instanceof Error ? error.message : error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Delivery failed" });
    }
  });

  app.post("/api/actions/connect-wallet", async (req, res) => {
    try {
      const { playerId, address } = req.body;
      if (!playerId || !address) {
        return res.status(400).json({ error: "playerId and address are required" });
      }
      if (!address || !algosdk.isValidAddress(address)) {
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
              welcomeBonusTxId = await batchedTransferFrontierAsa(address, 500);
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
      const gameState = await withDbRetry(() => storage.getGameState(), "getGameState");
      res.json(gameState);
      broadcastGameState(gameState);
    } catch (error) {
      console.error("Error fetching game state:", error);
      res.status(500).json({ error: "Failed to fetch game state" });
    }
  });

  app.get("/api/game/slim-state", async (req, res) => {
    try {
      const slimState = await withDbRetry(() => storage.getSlimGameState(), "getSlimGameState");
      res.json(slimState);
    } catch (error) {
      console.error("Error fetching slim game state:", error);
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
                batchedTransferFrontierAsa(address, 500)
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

  // Returns all faction identity records for the game UI, enriched with live stats
  app.get("/api/factions", async (_req, res) => {
    try {
      const factionAsaIds = getAllFactionAsaIds();

      // Aggregate member counts and territory counts from DB
      const [allHumanPlayers, allParcels, allAiPlayers] = await Promise.all([
        db.select({
          id: playersTable.id,
          playerFactionId: playersTable.playerFactionId,
        }).from(playersTable).where(eq(playersTable.isAi, false)),
        db.select({
          ownerId: parcelsTable.ownerId,
        }).from(parcelsTable),
        db.select({
          id: playersTable.id,
          name: playersTable.name,
          iron: playersTable.iron,
          fuel: playersTable.fuel,
          treasury: playersTable.treasury,
        }).from(playersTable).where(eq(playersTable.isAi, true)),
      ]);

      const memberCounts: Record<string, number> = {};
      for (const p of allHumanPlayers) {
        if (p.playerFactionId) {
          memberCounts[p.playerFactionId] = (memberCounts[p.playerFactionId] ?? 0) + 1;
        }
      }

      const territoryCounts: Record<string, number> = {};
      for (const parcel of allParcels) {
        if (parcel.ownerId) {
          territoryCounts[parcel.ownerId] = (territoryCounts[parcel.ownerId] ?? 0) + 1;
        }
      }

      // Map AI player IDs to faction names
      const aiPlayerByName: Record<string, { id: string; iron: number; fuel: number; treasury: number }> = {};
      for (const ai of allAiPlayers) {
        aiPlayerByName[ai.name] = {
          id: ai.id,
          iron: ai.iron,
          fuel: ai.fuel,
          treasury: ai.treasury ?? 0,
        };
      }

      const factions = FACTION_DEFINITIONS.map((f) => {
        const aiPlayer = aiPlayerByName[f.name];
        const aiTerritoryCount = aiPlayer ? (territoryCounts[aiPlayer.id] ?? 0) : 0;
        return {
          name:            f.name,
          unitName:        f.unitName,
          assetName:       f.assetName,
          behavior:        f.behavior,
          lore:            f.lore,
          totalSupply:     f.totalSupply,
          assetId:         factionAsaIds[f.name] ?? null,
          explorerUrl:     factionAsaIds[f.name]
            ? `https://allo.info/asset/${factionAsaIds[f.name]}`
            : null,
          onChain:         factionAsaIds[f.name] != null,
          // Live stats
          memberCount:     memberCounts[f.name] ?? 0,
          territoryCount:  aiTerritoryCount,
          iron:            aiPlayer?.iron ?? 0,
          fuel:            aiPlayer?.fuel ?? 0,
          treasury:        aiPlayer?.treasury ?? 0,
        };
      });
      res.json({ factions });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch faction data" });
    }
  });

  // Join (or switch) faction alignment for the current player
  app.post("/api/factions/:name/join", async (req, res) => {
    try {
      const factionName = decodeURIComponent(req.params.name);
      const { playerId } = req.body as { playerId?: string };

      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const def = FACTION_DEFINITIONS.find((f) => f.name === factionName);
      if (!def) return res.status(404).json({ error: "Faction not found" });

      // Ensure this is a human player
      const [playerRow] = await db
        .select({ id: playersTable.id, isAi: playersTable.isAi, playerFactionId: playersTable.playerFactionId, factionJoinedAt: playersTable.factionJoinedAt })
        .from(playersTable)
        .where(eq(playersTable.id, playerId));

      if (!playerRow) return res.status(404).json({ error: "Player not found" });
      if (playerRow.isAi) return res.status(400).json({ error: "AI players cannot join factions" });

      // Enforce 24h cooldown on faction switching (first-time joins are always allowed)
      const COOLDOWN_MS = 24 * 60 * 60 * 1000;
      if (playerRow.playerFactionId && playerRow.playerFactionId !== factionName) {
        const joinedAt = playerRow.factionJoinedAt ? Number(playerRow.factionJoinedAt) : 0;
        const elapsed = Date.now() - joinedAt;
        if (elapsed < COOLDOWN_MS) {
          return res.status(400).json({
            error: "Faction switch cooldown active",
            cooldownEndsAt: joinedAt + COOLDOWN_MS,
          });
        }
      }

      await db
        .update(playersTable)
        .set({
          playerFactionId: factionName,
          factionJoinedAt: BigInt(Date.now()),
        })
        .where(eq(playersTable.id, playerId));

      markDirty();
      res.json({ success: true, factionName, previousFaction: playerRow.playerFactionId ?? null });
    } catch (err) {
      res.status(500).json({ error: "Failed to join faction" });
    }
  });

  // Leave faction (set to unaligned)
  app.post("/api/factions/leave", async (req, res) => {
    try {
      const { playerId } = req.body as { playerId?: string };
      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const [playerRow] = await db
        .select({ id: playersTable.id, playerFactionId: playersTable.playerFactionId })
        .from(playersTable)
        .where(eq(playersTable.id, playerId));

      if (!playerRow) return res.status(404).json({ error: "Player not found" });

      await db
        .update(playersTable)
        .set({ playerFactionId: null, factionJoinedAt: null })
        .where(eq(playersTable.id, playerId));

      markDirty();
      res.json({ success: true, previousFaction: playerRow.playerFactionId ?? null });
    } catch (err) {
      res.status(500).json({ error: "Failed to leave faction" });
    }
  });

  // Get members for a specific faction
  app.get("/api/factions/:name/members", async (req, res) => {
    try {
      const factionName = decodeURIComponent(req.params.name);
      const def = FACTION_DEFINITIONS.find((f) => f.name === factionName);
      if (!def) return res.status(404).json({ error: "Faction not found" });

      const members = await db
        .select({
          id: playersTable.id,
          name: playersTable.name,
          factionJoinedAt: playersTable.factionJoinedAt,
          territoriesCaptured: playersTable.territoriesCaptured,
          attacksWon: playersTable.attacksWon,
        })
        .from(playersTable)
        .where(eq(playersTable.playerFactionId as any, factionName));

      res.json({
        factionName,
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          joinedAt: m.factionJoinedAt ? Number(m.factionJoinedAt) : null,
          territoriesCaptured: m.territoriesCaptured,
          attacksWon: m.attacksWon,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch faction members" });
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
      const verifiedId = await assertPlayerOwnership(req, res);
      if (!verifiedId) return;
      const action = mineActionSchema.parse(req.body);
      const result = await storage.mineResources(action);
      res.json({ success: true, yield: result });
      markDirty();
      try {
        const minedParcel = await storage.getParcel(action.parcelId);
        if (minedParcel) {
          appendWorldEvent({
            type: "resource_pulse",
            timestamp: Date.now(),
            lat: minedParcel.lat,
            lng: minedParcel.lng,
            plotId: minedParcel.plotId,
            playerId: action.playerId,
            severity: "low",
            metadata: {
              iron: result.iron,
              fuel: result.fuel,
              crystal: result.crystal,
              biome: minedParcel.biome,
            }
          });
        }
      } catch { /* non-critical */ }
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
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Upgrade failed" });
    }
  });

  app.post("/api/actions/attack", async (req, res) => {
    try {
      const verifiedId = await assertPlayerOwnership(req, res);
      if (!verifiedId) return;
      const action = attackActionSchema.parse(req.body);
      const battle = await storage.deployAttack(action);
      if (action.crystalBurned && action.crystalBurned > 0) {
        const attackPlayer = await storage.getPlayer(action.attackerId);
        if (attackPlayer) fireBurn(attackPlayer.address, action.crystalBurned, `Crystal burn battleId=${battle.id}`);
      }
      res.json({ success: true, battle });
      markDirty();
      // Log world event
      try {
        const targetParcelEvt = await storage.getParcel(action.targetParcelId);
        const attackerEvt = await storage.getPlayer(action.attackerId).catch(() => undefined);
        if (targetParcelEvt) {
          const defenderName = targetParcelEvt.ownerId
            ? (await storage.getPlayer(targetParcelEvt.ownerId).catch(() => undefined))?.name ?? "Unclaimed"
            : "Unclaimed";
          appendWorldEvent({
            type: "battle_started",
            timestamp: Date.now(),
            lat: targetParcelEvt.lat,
            lng: targetParcelEvt.lng,
            plotId: targetParcelEvt.plotId,
            defenderPlotId: targetParcelEvt.plotId,
            playerId: action.attackerId,
            severity: "high",
            metadata: {
              battleId: battle.id,
              attacker: attackerEvt?.name ?? "Unknown",
              defender: defenderName,
              biome: targetParcelEvt.biome,
            }
          });
        }
      } catch { /* non-critical */ }
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Attack failed" });
    }
  });

  app.post("/api/actions/build", async (req, res) => {
    try {
      const verifiedId = await assertPlayerOwnership(req, res);
      if (!verifiedId) return;
      const action = buildActionSchema.parse(req.body);
      const parcel = await storage.buildImprovement(action);
      const buildPlayer = await storage.getPlayer(action.playerId);
      if (buildPlayer) {
        const { FACILITY_INFO } = await import('@shared/schema');
        const info = FACILITY_INFO[action.improvementType as keyof typeof FACILITY_INFO];
        const built = parcel.improvements?.find((i: any) => i.type === action.improvementType);
        const level = built?.level ?? 1;
        const cost = info?.costFrontier?.[level - 1] ?? 0;
        if (cost > 0) fireBurn(buildPlayer.address, cost, `Build improvement plotId=${parcel.plotId}`);
      }
      res.json({ success: true, parcel });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Build failed" });
    }
  });

  app.post("/api/actions/purchase", async (req, res) => {
    try {
      const action = purchaseActionSchema.parse(req.body);

      // Validate player and wallet BEFORE executing the purchase.
      const player = await storage.getPlayer(action.playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });

      // Reject purchases from placeholder/unconnected wallet addresses.
      // This mirrors the client-side guard and cannot be bypassed by direct API calls.
      if (
        !player.address ||
        player.address === "PLAYER_WALLET" ||
        player.address.startsWith("AI_") ||
        !algosdk.isValidAddress(player.address)
      ) {
        return res.status(403).json({ error: "A connected Algorand wallet is required to purchase territory." });
      }

      const buyerAddress = player.address;
      const parcel = await storage.purchaseLand(action);
      console.log(`[mint-audit] purchase ok plotId=${parcel.plotId} buyer=${buyerAddress}`);
      const buyerForEvent = await storage.getPlayer(action.playerId).catch(() => null);
      appendWorldEvent({
        type: "land_claimed",
        timestamp: Date.now(),
        lat: parcel.lat,
        lng: parcel.lng,
        plotId: parcel.plotId,
        playerId: action.playerId,
        severity: "medium",
        metadata: { plotId: parcel.plotId, playerName: buyerForEvent?.name ?? "Unknown", biome: parcel.biome }
      });

      // Mint a Plot NFT (Algorand ASA) for human players only.
      let nftAssetId: number | null = null;
      const isHumanBuyer =
        buyerAddress &&
        !buyerAddress.startsWith("AI_") &&
        buyerAddress !== "PLAYER_WALLET" &&
        algosdk.isValidAddress(buyerAddress);

      if (isHumanBuyer && db) {
        // ── Idempotency guard ────────────────────────────────────────────────
        // Key: "mint:{playerId}:{plotId}" — prevents double-mint on rapid clicks.
        const idempotencyKey = `mint:${action.playerId}:${parcel.plotId}`;
        const now = Date.now();

        const [existingKey] = await db
          .select()
          .from(mintIdempotencyTable)
          .where(eq(mintIdempotencyTable.key, idempotencyKey));

        console.log(`[mint-audit] idempotency check plotId=${parcel.plotId} status=${existingKey?.status ?? 'new'}`);

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

          // Resolve the public base URL, stripping any trailing slash.
          // Falls back to REPLIT_DOMAINS (available in all Replit deployments) so
          // NFT metadata is always hosted at a reachable URL.
          const rawBase =
            process.env.PUBLIC_BASE_URL ||
            (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "");
          const PUBLIC_BASE_URL = rawBase.replace(/\/+$/, "");

          if (PUBLIC_BASE_URL) {
            // Fire-and-forget: mint in background, don't block response
            mintLandNft({ plotId: parcel.plotId, receiverAddress: buyerAddress, metadataBaseUrl: PUBLIC_BASE_URL })
              .then(async (result) => {
                console.log(`[mint-audit] minted plotId=${parcel.plotId} asaId=${result.assetId} txId=${result.createTxId}`);
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
                console.log(`[mint-audit] transfer queued plotId=${parcel.plotId} toAddress=${buyerAddress}`);
                console.log(`[purchase] plotId=${parcel.plotId} NFT minted assetId=${result.assetId}`);
              })
              .catch(async (err) => {
                console.error(`[mint-audit] FAIL plotId=${parcel.plotId}`, err);
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

      res.json({
        success: true,
        parcel,
        nft: {
          status: "minting",
          message: "Your Plot NFT is being minted. Add it to your Pera wallet once you receive the asset ID."
        }
      });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Purchase failed" });
    }
  });

  app.post("/api/actions/collect", async (req, res) => {
    try {
      const verifiedId = await assertPlayerOwnership(req, res);
      if (!verifiedId) return;
      const action = collectActionSchema.parse(req.body);
      const result = await storage.collectAll(action.playerId);
      res.json({ success: true, collected: result });
      markDirty();
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

      const walletAddress = player.address;
      const asaId = getFrontierAsaId();
      const isRealWallet =
        walletAddress &&
        walletAddress !== "PLAYER_WALLET" &&
        !walletAddress.startsWith("AI_");

      // Step 1: Check opt-in BEFORE crediting the DB balance.
      // Real wallets that haven't opted in cannot receive on-chain tokens,
      // so we refuse the claim entirely instead of silently crediting in-game
      // balance that can never be settled on-chain.
      if (asaId && isRealWallet) {
        const optedIn = await isAddressOptedIn(walletAddress);
        if (!optedIn) {
          return res.json({ success: false, reason: "wallet_not_opted_in" });
        }
      }

      // Step 2: Credit the DB balance only after confirming opt-in.
      const result = await storage.claimFrontier(action.playerId);
      let txId: string | undefined;

      // Step 3: Queue the on-chain transfer (fire-and-forget so response is immediate).
      if (asaId && result.amount > 0 && isRealWallet) {
        batchedTransferFrontierAsa(walletAddress, result.amount)
          .then((batchTxId) =>
            console.log(`Batched FRONTIER transfer: ${result.amount} to ${walletAddress}, TX: ${batchTxId}`)
          )
          .catch((err) =>
            console.error("Batched FRONTIER transfer failed (in-game balance preserved):", err)
          );
      }

      res.json({ success: true, claimed: result, txId, asaId });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Claim failed" });
    }
  });

  app.post("/api/actions/mint-avatar", async (req, res) => {
    try {
      const verifiedId = await assertPlayerOwnership(req, res);
      if (!verifiedId) return;
      const action = mintAvatarActionSchema.parse(req.body);

      // ── ALGO payment verification ──────────────────────────────────────────
      // algoPaymentTxId is optional: if absent (e.g. AI or dev mode), skip.
      const algoPaymentTxId: string | undefined = req.body.algoPaymentTxId;

      const mintPlayer = await storage.getPlayer(action.playerId);
      if (!mintPlayer) return res.status(404).json({ error: "Player not found" });

      const COMMANDER_USD_PRICES: Record<string, number> = { sentinel: 1.50, phantom: 2.25, reaper: 3.25 };
      const usdPrice    = COMMANDER_USD_PRICES[action.tier] ?? 0;
      const algoUsdRate = parseFloat(process.env.ALGO_USD_RATE ?? "0.25");
      const algoPrice   = usdPrice / algoUsdRate;
      const minMicroAlgo = Math.floor(algoPrice * 1_000_000);

      const isHumanPlayer =
        mintPlayer.address &&
        !mintPlayer.address.startsWith("AI_") &&
        mintPlayer.address !== "PLAYER_WALLET" &&
        algosdk.isValidAddress(mintPlayer.address);

      // If the player is human and a payment txId was provided, verify it on-chain.
      // If no txId provided for a human player, reject (payment required).
      if (isHumanPlayer && db) {
        if (!algoPaymentTxId) {
          return res.status(402).json({
            error: "ALGO payment required",
            algoPrice,
            minMicroAlgo,
            adminAddress: getAdminAddress(),
          });
        }

        // Guard against reuse of the same payment txId
        const [existingPayment] = await db
          .select()
          .from(commanderNftsTable)
          .where(eq(commanderNftsTable.algoPaymentTxId, algoPaymentTxId));
        if (existingPayment) {
          return res.status(409).json({ error: "Payment txId already used for another Commander mint" });
        }

        try {
          await verifyAlgoPayment({
            txId:           algoPaymentTxId,
            expectedSender: mintPlayer.address,
            minMicroAlgo,
          });
        } catch (payErr) {
          return res.status(402).json({ error: payErr instanceof Error ? payErr.message : "Payment verification failed" });
        }
      }

      // ── Mint in-game avatar ────────────────────────────────────────────────
      const avatar = await storage.mintAvatar(action);

      // ── FRONTIER token burn (existing mechanic) ────────────────────────────
      const { COMMANDER_INFO } = await import('@shared/schema');
      const cost = COMMANDER_INFO[action.tier as keyof typeof COMMANDER_INFO]?.mintCostFrontier ?? 0;
      if (cost > 0) fireBurn(mintPlayer.address, cost, `Commander mint tier=${action.tier}`);

      res.json({
        success: true,
        avatar,
        nft: isHumanPlayer && db
          ? { status: "minting", message: "Your Commander NFT is being minted. Check back shortly for the on-chain asset ID." }
          : undefined,
      });

      // ── Post-response: liquidity split + NFT mint (fire-and-forget) ────────
      if (isHumanPlayer && db && algoPaymentTxId) {
        // Forward 50% of received ALGO to LIQUIDITY_WALLET
        if (minMicroAlgo > 0) {
          forwardLiquiditySplit(
            Math.floor(minMicroAlgo * 0.5),
            `Commander NFT liquidity split tier=${action.tier} cmd=${avatar.id}`
          ).catch((err) => console.error("[mint-avatar] liquidity split failed:", err));
        }

        // ── Idempotency guard for NFT mint ──────────────────────────────────
        const idempotencyKey = `cmdr:mint:${action.playerId}:${avatar.id}`;
        const now = Date.now();

        const [existingKey] = await db
          .select()
          .from(commanderMintIdempotencyTable)
          .where(eq(commanderMintIdempotencyTable.key, idempotencyKey));

        if (!existingKey) {
          await db.insert(commanderMintIdempotencyTable).values({
            key: idempotencyKey,
            status: "pending",
            assetId: null,
            txId: null,
            createdAt: now,
            updatedAt: now,
          }).onConflictDoNothing();
        }

        if (!existingKey || existingKey.status === "failed") {
          const rawBase =
            process.env.PUBLIC_BASE_URL ||
            (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "");
          const PUBLIC_BASE_URL = rawBase.replace(/\/+$/, "");

          if (PUBLIC_BASE_URL) {
            mintCommanderNft({
              commanderId:     avatar.id,
              tier:            avatar.tier as "sentinel" | "phantom" | "reaper",
              receiverAddress: mintPlayer.address,
              metadataBaseUrl: PUBLIC_BASE_URL,
            })
              .then(async (result) => {
                await db!.insert(commanderNftsTable).values({
                  commanderId:     avatar.id,
                  assetId:         result.assetId,
                  mintedToAddress: result.mintedToAddress,
                  mintedAt:        Date.now(),
                  algoPaymentTxId: algoPaymentTxId ?? null,
                }).onConflictDoUpdate({
                  target: commanderNftsTable.commanderId,
                  set: {
                    assetId:         result.assetId,
                    mintedToAddress: result.mintedToAddress,
                    mintedAt:        Date.now(),
                    algoPaymentTxId: algoPaymentTxId ?? null,
                  },
                });
                await db!.update(commanderMintIdempotencyTable)
                  .set({ status: "confirmed", assetId: result.assetId, txId: result.createTxId, updatedAt: Date.now() })
                  .where(eq(commanderMintIdempotencyTable.key, idempotencyKey));
                console.log(`[mint-avatar] Commander NFT minted commanderId=${avatar.id} assetId=${result.assetId}`);
              })
              .catch(async (err) => {
                await db!.update(commanderMintIdempotencyTable)
                  .set({ status: "failed", updatedAt: Date.now() })
                  .where(eq(commanderMintIdempotencyTable.key, idempotencyKey));
                console.error(`[mint-avatar] Commander NFT mint failed commanderId=${avatar.id}:`, err instanceof Error ? err.message : err);
              });
          } else {
            console.warn(`[mint-avatar] PUBLIC_BASE_URL not set — skipping Commander NFT mint for commanderId=${avatar.id}`);
          }
        }
      }

      try {
        const mintPlayerEvt = await storage.getPlayer(action.playerId).catch(() => undefined);
        if (mintPlayerEvt) {
          appendWorldEvent({
            type: "commander_deployed",
            timestamp: Date.now(),
            lat: 0, lng: 0,
            playerId: action.playerId,
            severity: "medium",
            metadata: {
              playerName: mintPlayerEvt.name,
              tier: action.tier,
              commanderName: avatar.name,
            }
          });
        }
      } catch { /* non-critical */ }
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Mint failed" });
    }
  });

  app.post("/api/actions/switch-commander", async (req, res) => {
    try {
      const verifiedId = await assertPlayerOwnership(req, res);
      if (!verifiedId) return;
      const { playerId, commanderIndex } = req.body;
      if (!playerId || commanderIndex === undefined) return res.status(400).json({ error: "playerId and commanderIndex required" });
      const activeCommander = await storage.switchCommander(playerId, commanderIndex);
      res.json({ success: true, activeCommander });
      markDirty();
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Switch failed" });
    }
  });

  app.post("/api/actions/special-attack", async (req, res) => {
    try {
      const action = specialAttackActionSchema.parse(req.body);
      const result = await storage.executeSpecialAttack(action);
      res.json({ success: true, result });
      markDirty();
      try {
        const saParcel = await storage.getParcel(action.targetParcelId).catch(() => undefined);
        const saPlayer = await storage.getPlayer(action.playerId).catch(() => undefined);
        if (saParcel) {
          appendWorldEvent({
            type: "battle_started",
            timestamp: Date.now(),
            lat: saParcel.lat,
            lng: saParcel.lng,
            plotId: saParcel.plotId,
            playerId: action.playerId,
            severity: "high",
            metadata: {
              attackType: action.attackType,
              attacker: saPlayer?.name ?? "Unknown",
              defender: saParcel.ownerId
                ? (await storage.getPlayer(saParcel.ownerId).catch(() => undefined))?.name ?? "Unclaimed"
                : "Unclaimed",
              special: true,
            }
          });
        }
      } catch { /* non-critical */ }
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Special attack failed" });
    }
  });

  app.post("/api/actions/deploy-drone", async (req, res) => {
    try {
      const action = deployDroneActionSchema.parse(req.body);
      const drone = await storage.deployDrone(action);
      const dronePlayer = await storage.getPlayer(action.playerId);
      if (dronePlayer) {
        const { DRONE_MINT_COST_FRONTIER } = await import('@shared/schema');
        fireBurn(dronePlayer.address, DRONE_MINT_COST_FRONTIER, `Drone deploy`);
      }
      try {
        const dronePlayerEvt = await storage.getPlayer(action.playerId).catch(() => null);
        if (dronePlayerEvt) {
          appendWorldEvent({
            type: "scan_ping",
            timestamp: Date.now(),
            endTimestamp: Date.now() + 30 * 60_000,
            lat: 0, lng: 0,
            playerId: action.playerId,
            severity: "low",
            metadata: { playerName: dronePlayerEvt.name, source: "drone" }
          });
        }
      } catch { /* non-critical */ }
      res.json({ success: true, drone });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Drone deployment failed" });
    }
  });

  app.post("/api/actions/deploy-satellite", async (req, res) => {
    try {
      const action = deploySatelliteActionSchema.parse(req.body);
      const satellite = await storage.deploySatellite(action);
      const satPlayer = await storage.getPlayer(action.playerId);
      if (satPlayer) {
        const { SATELLITE_DEPLOY_COST_FRONTIER } = await import('@shared/schema');
        fireBurn(satPlayer.address, SATELLITE_DEPLOY_COST_FRONTIER, `Satellite deploy`);
      }
      res.json({ success: true, satellite });
      try {
        const satPlayerEvt = await storage.getPlayer(action.playerId).catch(() => undefined);
        appendWorldEvent({
          type: "scan_ping",
          timestamp: Date.now(),
          endTimestamp: Date.now() + 60 * 60_000,
          lat: 0,
          lng: 0,
          playerId: action.playerId,
          severity: "low",
          metadata: {
            playerName: satPlayerEvt?.name ?? "Unknown",
            source: "satellite",
          }
        });
      } catch { /* non-critical */ }
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Satellite deployment failed" });
    }
  });

  // ── GET /api/parcels/attackable ─────────────────────────────────────────────
  // Returns up to 50 parcels owned by other players, not under active battle,
  // sorted by total stored resources descending.
  // Optional query param: ?biome=forest
  app.get("/api/parcels/attackable", async (req, res) => {
    try {
      const { session } = req as any;
      const playerId = (session?.playerId as string) ?? "";
      const biomeFilter = req.query.biome as string | undefined;

      const rows = await withDbRetry(
        () =>
          db
            .select({
              id:             parcelsTable.id,
              plotId:         parcelsTable.plotId,
              biome:          parcelsTable.biome,
              ownerId:        parcelsTable.ownerId,
              defenseLevel:   parcelsTable.defenseLevel,
              lat:            parcelsTable.lat,
              lng:            parcelsTable.lng,
              ironStored:     parcelsTable.ironStored,
              fuelStored:     parcelsTable.fuelStored,
              crystalStored:  parcelsTable.crystalStored,
              activeBattleId: parcelsTable.activeBattleId,
            })
            .from(parcelsTable)
            .where(
              sql`
                ${parcelsTable.ownerId} IS NOT NULL
                AND ${parcelsTable.ownerId} != ${playerId}
                AND ${parcelsTable.activeBattleId} IS NULL
                ${biomeFilter ? sql`AND ${parcelsTable.biome} = ${biomeFilter}` : sql``}
              `
            )
            .orderBy(
              sql`(${parcelsTable.ironStored} + ${parcelsTable.fuelStored} + ${parcelsTable.crystalStored}) DESC`
            )
            .limit(50),
        "getAttackableParcels"
      );

      res.json({ parcels: rows });
    } catch (err) {
      console.error("[/api/parcels/attackable]", err);
      res.status(500).json({ error: "Failed to fetch attackable parcels" });
    }
  });

  // ── Admin key guard (used for internal/admin endpoints) ───────────────────
  function requireAdminKey(req: any, res: any): boolean {
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey) return true; // No key configured → allow (dev mode)
    const provided = (req.headers["x-admin-key"] as string) ?? (req.query.adminKey as string);
    if (provided !== adminKey) {
      res.status(403).json({ error: "Forbidden: invalid admin key" });
      return false;
    }
    return true;
  }

  app.post("/api/game/resolve-battles", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const resolved = await storage.resolveBattles();
      res.json({ success: true, resolved });
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve battles" });
    }
  });

  app.post("/api/game/ai-turn", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const events = await storage.runAITurn();
      res.json({ success: true, events });
    } catch (error) {
      res.status(500).json({ error: "Failed to run AI turn" });
    }
  });

  // ── Testnet Reset ─────────────────────────────────────────────────────────
  // Wipe all game data and re-seed from scratch. Testnet only.
  app.post("/api/game/reset", async (_req, res) => {
    if (!requireAdminKey(_req, res)) return;
    try {
      console.log("[RESET] Wiping game data for testnet reset…");
      // Clear all tables in dependency order
      await db.delete(subParcelsTable);
      await db.delete(tradeOrdersTable);
      await db.delete(orbitalEventsTable);
      await db.delete(gameEventsTable);
      await db.delete(battlesTable);
      await db.delete(plotNftsTable);
      await db.delete(mintIdempotencyTable);
      await db.delete(parcelsTable);
      await db.delete(playersTable);
      // Reset game_meta so seeder runs on next init
      await db.update(gameMeta).set({ initialized: false, currentTurn: 1, lastUpdateTs: 0 }).where(eq(gameMeta.id, 1));
      console.log("[RESET] All tables cleared. Re-seeding…");

      // Reset the storage init state and re-seed
      storage.resetInitState();
      await storage.initialize();

      // Broadcast fresh state
      const freshState = await storage.getGameState();
      broadcastGameState(freshState);

      console.log("[RESET] Testnet reset complete.");
      res.json({ success: true, message: "Game reset and re-seeded successfully", totalParcels: freshState.parcels.length });
    } catch (error) {
      console.error("[RESET] Error:", error);
      res.status(500).json({ error: "Failed to reset game" });
    }
  });

  // ── Orbital Event Engine API ──────────────────────────────────────────────

  /** GET /api/orbital/active — return all live gameplay-affecting impact events */
  app.get("/api/orbital/active", async (_req, res) => {
    try {
      const events = await storage.getActiveOrbitalEvents();
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
      res.json({ success: true });
    } catch (error) {
      console.error("[ORBITAL-DEBUG] resolveOrbitalEvent error:", error);
      res.status(500).json({ error: "Failed to resolve orbital event" });
    }
  });

  // World Intel API endpoints
  app.get("/api/world/events", async (req, res) => {
    try {
      const { start, end, types, limit } = req.query;
      const filters: import("@shared/worldEvents").WorldEventFilters = {};
      if (start)  filters.start  = Number(start);
      if (end)    filters.end    = Number(end);
      if (limit)  filters.limit  = Number(limit);
      if (types)  filters.types  = String(types).split(",") as import("@shared/worldEvents").WorldEventType[];
      res.json(listWorldEvents(filters));
    } catch { res.status(500).json({ error: "Failed to fetch world events" }); }
  });

  app.get("/api/world/events/recent", (_req, res) => {
    try { res.json(getRecentWorldEvents()); }
    catch { res.status(500).json({ error: "Failed to fetch recent events" }); }
  });

  // Battle replay — returns the stored replay record for a resolved battle.
  // Available for 24 hours after resolution. Returns 404 after expiry.
  app.get("/api/battle/replay/:battleId", async (req, res) => {
    try {
      const { battleId } = req.params;
      if (!battleId || typeof battleId !== "string") {
        return res.status(400).json({ error: "battleId is required" });
      }
      const replay = await getBattleReplay(battleId);
      if (!replay) {
        return res.status(404).json({
          error: "Replay not available",
          reason: "Battle replay expires after 24 hours or Redis is not configured"
        });
      }
      res.json(replay);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch battle replay" });
    }
  });


  // Staggered background tasks — avoids hammering Neon with simultaneous queries
  setInterval(async () => {
    try {
      const resolved = await withDbRetry(() => storage.resolveBattles(), "resolveBattles");
      if (resolved.length > 0) {
        for (const battle of resolved) {
          try {
            const parcel = await storage.getParcel(battle.targetParcelId);
            if (parcel) {
              const resolvedAttacker = await storage.getPlayer(battle.attackerId).catch(() => undefined);
              appendWorldEvent({
                type: "battle_resolved",
                timestamp: Date.now(),
                lat: parcel.lat,
                lng: parcel.lng,
                plotId: parcel.plotId,
                playerId: battle.attackerId,
                severity: battle.outcome === "attacker_wins" ? "high" : "medium",
                metadata: {
                  battleId: battle.id,
                  outcome: battle.outcome,
                  attacker: resolvedAttacker?.name ?? "Unknown",
                }
              });
            }
          } catch { /* non-critical */ }
        }
        markDirty();
      }
    } catch (error) {
      console.warn("Background task (battles):", error instanceof Error ? error.message : error);
    }
  }, 15000);

  setInterval(async () => {
    try {
      if (process.env.AI_ENABLED !== "false") {
        const aiEvents = await withDbRetry(() => storage.runAITurn(), "runAITurn");
        if (aiEvents && aiEvents.length > 0) markDirty();
      }
    } catch (error) {
      console.warn("Background task (AI):", error instanceof Error ? error.message : error);
    }
  }, 20000);

  // Orbital check every 5 minutes
  setInterval(async () => {
    try {
      const event = await withDbRetry(() => storage.triggerOrbitalCheck(), "triggerOrbitalCheck");
      if (event) {
        console.log(`[ORBITAL] new impact id=${event.id} type=${event.type}`);
        markDirty();
      }
    } catch (error) {
      console.warn("[ORBITAL] background check:", error instanceof Error ? error.message : error);
    }
  }, 5 * 60 * 1000);

  // ── Trade Station ────────────────────────────────────────────────────────────

  app.get("/api/trade/history", async (_req, res) => {
    try {
      const history = await withDbRetry(() => storage.getTradeHistory(50), "getTradeHistory");
      res.json(history);
    } catch (err) {
      console.error("[trade] getTradeHistory error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/trade/leaderboard", async (_req, res) => {
    try {
      const board = await withDbRetry(() => storage.getTradeLeaderboard(), "getTradeLeaderboard");
      res.json(board);
    } catch (err) {
      console.error("[trade] getTradeLeaderboard error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/trade/orders", async (_req, res) => {
    try {
      const orders = await withDbRetry(() => storage.getOpenTradeOrders(), "getOpenTradeOrders");
      res.json(orders);
    } catch (err) {
      console.error("[trade] getOpenTradeOrders error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/trade/orders", async (req, res) => {
    try {
      const { playerId } = req.body;
      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });

      const parsed = createTradeOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
      }
      const { giveResource, giveAmount, wantResource, wantAmount } = parsed.data;

      const order = await withDbRetry(() => storage.createTradeOrder({
        id:           crypto.randomUUID(),
        offererId:    playerId,
        offererName:  player.name,
        giveResource,
        giveAmount,
        wantResource,
        wantAmount,
        status:       "open",
        createdAt:    Date.now(),
        filledById:   null,
        filledAt:     null,
      }), "createTradeOrder");

      res.json(order);
    } catch (err) {
      console.error("[trade] createTradeOrder error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/trade/orders/:id", async (req, res) => {
    try {
      const { playerId } = req.body;
      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const result = await withDbRetry(
        () => storage.cancelTradeOrder(req.params.id, playerId),
        "cancelTradeOrder",
      );
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true });
    } catch (err) {
      console.error("[trade] cancelTradeOrder error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/trade/orders/:id/fill", async (req, res) => {
    try {
      const { playerId } = req.body;
      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const fillerPlayer = await storage.getPlayer(playerId);
      if (!fillerPlayer) return res.status(404).json({ error: "Player not found" });

      const result = await withDbRetry(
        () => storage.fillTradeOrder(req.params.id, playerId),
        "fillTradeOrder",
      );
      if (!result.success) return res.status(400).json({ error: result.error });

      // Broadcast TRADE_FILLED to all connected clients
      const trade = result.trade!;
      broadcastRaw({
        type:         "TRADE_FILLED",
        offererName:  trade.offererName,
        fillerName:   fillerPlayer.name,
        giveResource: trade.giveResource,
        giveAmount:   trade.giveAmount,
        wantResource: trade.wantResource,
        wantAmount:   trade.wantAmount,
      });

      markDirty();
      res.json({ success: true, trade });
    } catch (err) {
      console.error("[trade] fillTradeOrder error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Prediction Markets ────────────────────────────────────────────────────

  // Background resolver: close expired open markets every 60 seconds
  setInterval(async () => {
    try {
      await withDbRetry(() => storage.resolveExpiredMarkets(), "resolveExpiredMarkets");
    } catch (err) {
      console.warn("[markets] resolveExpiredMarkets:", err instanceof Error ? err.message : err);
    }
  }, 60_000);

  app.get("/api/markets", async (_req, res) => {
    try {
      const markets = await withDbRetry(() => storage.getOpenMarkets(), "getOpenMarkets");
      res.json(markets);
    } catch (err) {
      console.error("[markets] getOpenMarkets error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/markets/history", async (_req, res) => {
    try {
      const markets = await withDbRetry(() => storage.getAllMarkets(50), "getAllMarkets");
      res.json(markets);
    } catch (err) {
      console.error("[markets] getAllMarkets error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/markets/player/:playerId", async (req, res) => {
    const { playerId } = req.params;
    try {
      const positions = await withDbRetry(() => storage.getPlayerPositions(playerId), "getPlayerPositions");
      res.json(positions);
    } catch (err) {
      console.error("[markets] getPlayerPositions error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/markets/:id", async (req, res) => {
    try {
      const market = await withDbRetry(() => storage.getMarket(req.params.id), "getMarket");
      if (!market) return res.status(404).json({ error: "Market not found" });
      res.json(market);
    } catch (err) {
      console.error("[markets] getMarket error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/markets/:id/bet", async (req, res) => {
    try {
      const parsed = placeBetSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const { playerId, outcome, amount } = parsed.data;
      const result = await withDbRetry(() => storage.placeBet(req.params.id, playerId, outcome, amount), "placeBet");
      if ("error" in result) return res.status(400).json({ error: result.error });
      markDirty();
      res.json(result);
    } catch (err) {
      console.error("[markets] placeBet error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/markets/:id/claim", async (req, res) => {
    try {
      const { playerId } = req.body;
      if (!playerId) return res.status(400).json({ error: "playerId required" });
      const result = await withDbRetry(() => storage.claimWinnings(req.params.id, playerId), "claimWinnings");
      if ("error" in result) return res.status(400).json({ error: result.error });
      markDirty();
      res.json(result);
    } catch (err) {
      console.error("[markets] claimWinnings error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin-only routes
  app.post("/api/admin/markets", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const parsed = createMarketSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const market = await withDbRetry(() => storage.createMarket(parsed.data, "admin"), "createMarket");
      res.json(market);
    } catch (err) {
      console.error("[markets] createMarket error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/markets/:id/resolve", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const parsed = resolveMarketSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const result = await withDbRetry(() => storage.resolveMarket(req.params.id, parsed.data.winningOutcome), "resolveMarket");
      if ("error" in result) return res.status(400).json({ error: result.error });
      res.json(result);
    } catch (err) {
      console.error("[markets] resolveMarket error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/mint-status/:plotId", async (req, res) => {
    const adminKey = process.env.ADMIN_KEY;
    if (adminKey && req.query.adminKey !== adminKey) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const plotId = parseInt(req.params.plotId, 10);
    if (isNaN(plotId)) {
      return res.status(400).json({ error: "Invalid plotId" });
    }

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    try {
      const [nftRecord] = await db
        .select()
        .from(plotNftsTable)
        .where(eq(plotNftsTable.plotId, plotId));

      const idmpKey = `mint-plot-${plotId}`;
      const [idempotencyKey] = await db
        .select()
        .from(mintIdempotencyTable)
        .where(eq(mintIdempotencyTable.key, idmpKey));

      if (!nftRecord && !idempotencyKey) {
        return res.status(404).json({ error: "No mint record found for this plot" });
      }

      res.json({
        plotId,
        nftRecord: nftRecord || null,
        idempotencyKey: idempotencyKey || null,
      });
    } catch (error) {
      console.error(`[admin] mint-status error plotId=${plotId}`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Sub-Parcel Endpoints ───────────────────────────────────────────────────

  /** GET /api/plots/:plotId/sub-parcels — list sub-parcels for a macro-plot */
  app.get("/api/plots/:plotId/sub-parcels", async (req, res) => {
    const plotId = parseInt(req.params.plotId);
    if (!plotId || isNaN(plotId)) return res.status(400).json({ error: "Invalid plotId" });
    try {
      const subParcels = await storage.getSubParcels(plotId);
      res.json({ plotId, subParcels, isSubdivided: subParcels.length > 0 });
    } catch (err) {
      console.error("[sub-parcels] getSubParcels error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/plots/:plotId/subdivide — subdivide a macro-plot into 9 sub-parcels */
  app.post("/api/plots/:plotId/subdivide", async (req, res) => {
    const plotId = parseInt(req.params.plotId);
    const { playerId } = req.body;
    if (!plotId || isNaN(plotId)) return res.status(400).json({ error: "Invalid plotId" });
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    try {
      const result = await storage.subdivideParcel(plotId, playerId);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();
      res.json({ success: true, subParcels: result.subParcels });
    } catch (err) {
      console.error("[sub-parcels] subdivideParcel error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/sub-parcels/:subParcelId/purchase — buy an unowned sub-parcel */
  app.post("/api/sub-parcels/:subParcelId/purchase", async (req, res) => {
    const { subParcelId } = req.params;
    const { playerId } = req.body;
    if (!subParcelId) return res.status(400).json({ error: "Invalid subParcelId" });
    if (!playerId)    return res.status(400).json({ error: "playerId required" });
    try {
      const result = await storage.purchaseSubParcel(subParcelId, playerId);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();

      const sp = result.subParcel;
      // Broadcast real-time label update to all connected clients
      broadcastRaw({
        type:        "sub_parcel_purchased",
        subParcelId: sp.id,
        parentPlotId: sp.parentPlotId,
        subIndex:    sp.subIndex,
        ownerId:     playerId,
      });

      // Persist to Upstash world event stream (fire-and-forget)
      recordSubParcelWorldEvent({
        type:     "sub_parcel_purchased",
        plotId:   sp.parentPlotId,
        subIndex: sp.subIndex,
        biome:    "unknown", // biome resolved client-side from parent plot
        playerId,
        price:    sp.purchasePriceFrontier,
      }).catch(() => {});

      res.json({ success: true, subParcel: sp });
    } catch (err) {
      console.error("[sub-parcels] purchaseSubParcel error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/sub-parcels/:subParcelId/build — build or upgrade an improvement on an owned sub-parcel */
  app.post("/api/sub-parcels/:subParcelId/build", async (req, res) => {
    const { subParcelId } = req.params;
    const { playerId, improvementType } = req.body;
    if (!subParcelId)     return res.status(400).json({ error: "Invalid subParcelId" });
    if (!playerId)        return res.status(400).json({ error: "playerId required" });
    if (!improvementType) return res.status(400).json({ error: "improvementType required" });
    try {
      const result = await storage.buildSubParcelImprovement(subParcelId, playerId, improvementType);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();

      const sp = result.subParcel;
      const imp = sp.improvements?.find(i => i.type === improvementType);
      const newLevel = imp?.level ?? 1;

      // Broadcast real-time label update to all connected clients
      broadcastRaw({
        type:           "sub_parcel_upgraded",
        subParcelId:    sp.id,
        parentPlotId:   sp.parentPlotId,
        subIndex:       sp.subIndex,
        improvementType,
        level:          newLevel,
        ownerId:        playerId,
      });

      // Persist to Upstash world event stream (fire-and-forget)
      recordSubParcelWorldEvent({
        type:           "sub_parcel_upgraded",
        plotId:         sp.parentPlotId,
        subIndex:       sp.subIndex,
        biome:          "unknown", // biome is on parent plot; client resolves
        playerId,
        improvementType,
        level:          newLevel,
      }).catch(() => {});

      // Record on-chain via Algorand self-transfer note (fire-and-forget)
      recordUpgradeOnChain({
        plotId:         sp.parentPlotId,
        subIndex:       sp.subIndex,
        biome:          "unknown",
        improvementType,
        level:          newLevel,
        playerId,
      }).catch(() => {});

      res.json({ success: true, subParcel: sp });
    } catch (err) {
      console.error("[sub-parcels] buildSubParcelImprovement error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Season Endpoints ───────────────────────────────────────────────────────

  /** GET /api/season/current — get the active season info */
  app.get("/api/season/current", async (_req, res) => {
    try {
      const season = await storage.getCurrentSeason();
      res.json({ season });
    } catch (err) {
      console.error("[season] getCurrentSeason error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /api/season/history — get all past seasons */
  app.get("/api/season/history", async (_req, res) => {
    try {
      const seasons = await storage.getSeasonHistory();
      res.json({ seasons });
    } catch (err) {
      console.error("[season] getSeasonHistory error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/admin/season/start — start a new season (admin only) */
  app.post("/api/admin/season/start", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    const { name, daysLen } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    try {
      const season = await storage.startSeason(name, daysLen ?? 90);
      markDirty();
      res.json({ success: true, season });
    } catch (err: any) {
      console.error("[season] startSeason error", err);
      res.status(400).json({ error: err.message ?? "Failed to start season" });
    }
  });

  /** POST /api/admin/season/settle — settle the current season */
  app.post("/api/admin/season/settle", async (_req, res) => {
    if (!requireAdminKey(_req, res)) return;
    try {
      const season = await storage.settleCurrentSeason();
      if (!season) return res.status(404).json({ error: "No active season to settle" });
      markDirty();
      res.json({ success: true, season });
    } catch (err) {
      console.error("[season] settleCurrentSeason error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return httpServer;
}
