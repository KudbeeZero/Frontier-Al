import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Vite build output (Replit production)
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to run npm run build`,
    );
  }

  // Serve raw public assets too (SVGs/icons) if present
  const clientPublicPath = path.resolve(process.cwd(), "client", "public");
  if (fs.existsSync(clientPublicPath)) {
    app.use(express.static(clientPublicPath));
  }

  // Serve built assets
  app.use(express.static(distPath));

  // SPA fallback (must be last)
  app.use("/{*splat}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}