import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to run npm run build`,
    );
  }

  const clientPublicPath = path.resolve(process.cwd(), "client", "public");
  if (fs.existsSync(clientPublicPath)) {
    app.use(express.static(clientPublicPath));
  }

  app.use(express.static(distPath));

  // Express 5 compatibility: Use a middleware for catch-all SPA fallback
  // instead of a string pattern that triggers path-to-regexp errors.
  app.get("*", (req, res, next) => {
    const pathName = req.path;
    // Skip fallback for API, faction metadata, NFT metadata, and files with extensions
    if (
      pathName.startsWith("/api") ||
      pathName.startsWith("/faction") ||
      pathName.startsWith("/nft") ||
      pathName.split("/").pop()?.includes(".")
    ) {
      return next();
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
