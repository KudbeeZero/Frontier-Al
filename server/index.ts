import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    // In development, Vite runs separately on port 5000
    // This server only serves the API on port 5001
    // If you need Vite middleware for development, use the setupVite function
    // const { setupVite } = await import("./vite");
    // await setupVite(httpServer, app);
  }

  // Determine the port:
  // 1. Use API_PORT if set (for development API server)
  // 2. Use PORT if set (for explicit override)
  // 3. Use 5001 in development, 5000 in production
  const defaultPort = process.env.NODE_ENV === "production" ? 5000 : 5001;
  const port = parseInt(
    process.env.API_PORT || process.env.PORT || defaultPort.toString(),
    10,
  );
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      // Warn early so misconfigured deployments are caught at boot, not at first NFT mint.
      if (process.env.NODE_ENV === "production") {
        if (!process.env.PUBLIC_BASE_URL) {
          log("WARNING: PUBLIC_BASE_URL is not set — NFT image/metadata URLs will use the request host as a per-request fallback. Set PUBLIC_BASE_URL to the canonical public URL of this deployment.");
        } else {
          log(`PUBLIC_BASE_URL = ${process.env.PUBLIC_BASE_URL}`);
        }
      }
    },
  );
})();
