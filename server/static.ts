import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // This is where your built client ends up (Replit template convention)
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // ✅ ALSO serve raw client/public assets (where your /nft/biomes/*.svg live)
  // This is safe in production too, and fixes SVG requests returning index.html.
  const clientPublicPath = path.resolve(process.cwd(), "client", "public");
  if (fs.existsSync(clientPublicPath)) {
    app.use(express.static(clientPublicPath));
  }

  // Serve the built app bundle (index.html + assets)
  app.use(express.static(distPath));

  // SPA fallback: if nothing matched above, return index.html
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}