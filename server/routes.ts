import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { mineActionSchema, upgradeActionSchema, attackActionSchema, buildActionSchema, purchaseActionSchema, collectActionSchema, claimFrontierActionSchema, mintAvatarActionSchema, specialAttackActionSchema, deployDroneActionSchema } from "@shared/schema";
import { z } from "zod";
import { initializeBlockchain, getFrontierAsaId, getAdminAddress, getAdminBalance, transferFrontierASA, isAddressOptedInToFrontier } from "./algorand";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  let blockchainReady = false;
  initializeBlockchain().then((result) => {
    blockchainReady = true;
    console.log(`Blockchain initialized: ASA=${result.asaId}, Admin=${result.adminAddress}, ALGO=${result.adminAlgo}`);
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

  app.get("/api/blockchain/opt-in-check/:address", async (req, res) => {
    try {
      const optedIn = await isAddressOptedInToFrontier(req.params.address);
      res.json({ optedIn, asaId: getFrontierAsaId() });
    } catch (error) {
      res.json({ optedIn: false, asaId: getFrontierAsaId() });
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
      res.json({ success: true });
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
      res.json({ success: true, parcel });
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

      const walletAddress = player.address;
      const asaId = getFrontierAsaId();

      if (!walletAddress || walletAddress === "PLAYER_WALLET" || walletAddress.startsWith("AI_")) {
        return res.status(400).json({ error: "Connect a wallet before claiming FRONTIER" });
      }

      if (asaId) {
        const optedIn = await isAddressOptedInToFrontier(walletAddress);
        if (!optedIn) {
          return res.status(400).json({ error: "You must opt-in to FRONTIER ASA before claiming" });
        }
      }

      const result = await storage.claimFrontier(action.playerId);
      let txId: string | undefined;

      if (asaId && result.amount > 0) {
        try {
          txId = await transferFrontierASA(walletAddress, result.amount);
          console.log(`FRONTIER ASA transfer: ${result.amount} to ${walletAddress}, TX: ${txId}`);
        } catch (transferErr) {
          console.error("ASA transfer failed, rolling back claim:", transferErr);
          await storage.restoreFrontier(action.playerId, result.amount);
          return res.status(500).json({ error: "On-chain transfer failed. Your FRONTIER has been restored." });
        }
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
