import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { mineActionSchema, upgradeActionSchema, attackActionSchema, buildActionSchema, purchaseActionSchema, collectActionSchema, claimFrontierActionSchema, mintAvatarActionSchema, specialAttackActionSchema, deployDroneActionSchema, deploySatelliteActionSchema } from "@shared/schema";
import { z } from "zod";
import { initializeBlockchain, getFrontierAsaId, getAdminAddress, getAdminBalance, transferFrontierASA, isAddressOptedInToFrontier, batchedTransferFrontierASA, mintPlotNftToAddress, algodClient, indexerClient } from "./algorand";
import { db } from "./db";
import { parcels as parcelsTable, plotNfts as plotNftsTable } from "./db-schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  let blockchainReady = false;
  initializeBlockchain().then((result) => {
    blockchainReady = result.asaId !== null;
    console.log(`Blockchain initialized: ASA=${result.asaId}, Admin=${result.adminAddress}, ALGO=${result.adminAlgo}`);
    if (!blockchainReady) {
      console.warn("Blockchain initialization incomplete: ASA not created (check ALGO balance and env vars).");
    }
  }).catch((err) => {
    console.error("Blockchain init failed:", err);
  });

  app.get("/api/blockchain/status", async (_req, res) => {
    try {
      const asaId = getFrontierAsaId();
      const adminAddress = getAdminAddress();
      const balance = await getAdminBalance();
      res.json({
        ready: blockchainReady,
        frontierAsaId: asaId,
        adminAddress,
        adminAlgoBalance: balance.algo,
        adminFrontierBalance: balance.frontierAsa,
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
      const rawAdminBalance: number = Number(adminAsset?.amount ?? 0);
      const treasury = rawAdminBalance / divisor;

      const circulating = Math.round((totalSupply - treasury) * 100) / 100;

      res.json({
        asaId,
        adminAddress: adminAddr,
        totalSupply,
        treasury: Math.round(treasury * 100) / 100,
        circulating,
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
      const optedIn = await isAddressOptedInToFrontier(req.params.address, queryAsaId);
      res.json({ optedIn, asaId: getFrontierAsaId() });
    } catch (error) {
      res.json({ optedIn: false, asaId: getFrontierAsaId() });
    }
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
            const optedIn = await isAddressOptedInToFrontier(address);
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
          isAddressOptedInToFrontier(address)
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
        // Check if already minted (idempotency guard)
        const [existingNft] = await db
          .select()
          .from(plotNftsTable)
          .where(eq(plotNftsTable.plotId, parcel.plotId));

        if (existingNft?.assetId) {
          nftAssetId = Number(existingNft.assetId);
          console.log(
            `[purchase] plotId=${parcel.plotId} NFT already exists, assetId=${nftAssetId}`
          );
        } else {
          // Fire-and-forget: mint in background, don't block response
          mintPlotNftToAddress(parcel.plotId, buyerAddress)
            .then(({ assetId }) => {
              console.log(
                `[purchase] plotId=${parcel.plotId} NFT minted, assetId=${assetId}`
              );
            })
            .catch((err) => {
              console.error(
                `[purchase] NFT minting failed for plotId=${parcel.plotId}:`,
                err instanceof Error ? err.message : err
              );
            });
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
        isAddressOptedInToFrontier(walletAddress).then((optedIn) => {
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

  setInterval(async () => {
    try {
      await storage.resolveBattles();
      await storage.runAITurn();
    } catch (error) {
      console.error("Background task error:", error);
    }
  }, 15000);

  return httpServer;
}
