import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { mineActionSchema, upgradeActionSchema, attackActionSchema, buildActionSchema, purchaseActionSchema, collectActionSchema, claimFrontierActionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
      const result = await storage.claimFrontier(action.playerId);
      res.json({ success: true, claimed: result });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Claim failed" });
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
