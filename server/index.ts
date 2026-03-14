import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { hydrateWorldEventsFromRedis } from "./worldEventStore";
import { warmUpDb } from "./db";
import { assertChainConfig } from "./services/chain/client";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { storage } from "./storage";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // 1. Healthcheck route (Task 1 & 2)
  // Respond 200 to "/" and "/health" for Replit production healthchecks
  app.get("/health", (_req, res) => {
    res.status(200).send("OK");
  });

  app.get("/", (req, res, next) => {
    // Return a plain text response for healthcheck requests to "/"
    // but only if it's not a browser request for the HTML app
    if (process.env.NODE_ENV === "production") {
      const isHtmlRequest = req.headers.accept?.includes("text/html");
      const userAgent = (req.headers["user-agent"] || "").toLowerCase();
      const isReplitHealthcheck = !userAgent || userAgent.includes("replit") || userAgent.includes("healthcheck") || userAgent.includes("uptimerobot");

      if (!isHtmlRequest || isReplitHealthcheck) {
        return res.status(200).send("Frontier server running");
      }
    }
    next();
  });

  assertChainConfig();
  const { initWsServer } = await import("./wsServer");
  initWsServer(httpServer, storage);
  // Wake up Neon DB before accepting traffic (handles cold-start timeouts)
  await warmUpDb();
  // Hydrate world event feed from Redis (no-op if Redis unavailable)
  await hydrateWorldEventsFromRedis();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
