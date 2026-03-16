import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer", "crypto", "stream", "events", "util", "process"],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  root: path.resolve(__dirname, "client"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
      protocol: "wss",
    },
    proxy: {
      "/api": {
        target: "http://0.0.0.0:5000",
        changeOrigin: true,
      },
      "/nft": {
        target: "http://0.0.0.0:5000",
        changeOrigin: true,
      },
      "/faction": {
        target: "http://0.0.0.0:5000",
        changeOrigin: true,
      },
    },
  },
});
