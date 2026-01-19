import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { mineActionSchema, upgradeActionSchema, attackActionSchema } from "@shared/schema";
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
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      res.json(parcel);
    } catch (error) {
      console.error("Error fetching parcel:", error);
      res.status(500).json({ error: "Failed to fetch parcel" });
    }
  });

  app.get("/api/game/player/:id", async (req, res) => {
    try {
      const player = await storage.getPlayer(req.params.id);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      res.json(player);
    } catch (error) {
      console.error("Error fetching player:", error);
      res.status(500).json({ error: "Failed to fetch player" });
    }
  });

  app.post("/api/actions/mine", async (req, res) => {
    try {
      const action = mineActionSchema.parse(req.body);
      const result = await storage.mineResources(action);
      res.json({ success: true, yield: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error mining:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Mining failed" });
    }
  });

  app.post("/api/actions/upgrade", async (req, res) => {
    try {
      const action = upgradeActionSchema.parse(req.body);
      const parcel = await storage.upgradeBase(action);
      res.json({ success: true, parcel });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error upgrading:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Upgrade failed" });
    }
  });

  app.post("/api/actions/attack", async (req, res) => {
    try {
      const action = attackActionSchema.parse(req.body);
      const battle = await storage.deployAttack(action);
      res.json({ success: true, battle });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error attacking:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Attack failed" });
    }
  });

  app.post("/api/game/resolve-battles", async (req, res) => {
    try {
      const resolved = await storage.resolveBattles();
      res.json({ success: true, resolved });
    } catch (error) {
      console.error("Error resolving battles:", error);
      res.status(500).json({ error: "Failed to resolve battles" });
    }
  });

  app.post("/api/game/ai-turn", async (req, res) => {
    try {
      const events = await storage.runAITurn();
      res.json({ success: true, events });
    } catch (error) {
      console.error("Error running AI turn:", error);
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
  }, 30000);

  return httpServer;
}
