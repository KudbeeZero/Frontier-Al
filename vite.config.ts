// vite.config.ts — COMPLETE REPLACEMENT (Replit-safe, WalletConnect/algosdk-safe)

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";
import { fileURLToPath } from "url";

// Equivalent to __dirname in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, "client"),

  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true,
      // Keep this list tight (these are the usual suspects for algosdk/walletconnect)
      include: ["buffer", "process", "util", "events", "stream", "crypto"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),

      // Critical browser polyfill aliases
      buffer: "buffer/",
      process: "process/browser",
    },
  },

  define: {
    // Critical: fixes libs that expect Node "global"
    global: "globalThis",
  },

  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },

  build: {
    outDir: path.resolve(__dirname, "dist", "public"),
    emptyOutDir: true,
  },

  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    fs: { strict: true, deny: ["**/.*"] },
    proxy: {
      // IMPORTANT: your Vite dev server is already on 5000; proxying to 5000 can loop.
      // If your backend is NOT on a different port, remove this proxy.
      "/api": {
        target: "http://0.0.0.0:3000",
        changeOrigin: true,
      },
    },
  },
});