# FRONTIER — Production Deployment Guide

## Architecture overview

FRONTIER consists of two deployable units:

| Unit | What it is | Where to host |
|------|-----------|---------------|
| **Backend** | Node.js + Express HTTP + WebSocket server (`server/`) | Any host that supports **persistent processes + WebSockets** (Render, Fly.io, Replit, Railway, DigitalOcean, etc.) |
| **Frontend SPA** | Vite-built React app (`client/`) | Vercel (or any static CDN) |

> ⚠️ Vercel **cannot** run the backend. Its serverless functions have no support for the persistent WebSocket broadcast loop in `server/wsServer.ts`. The frontend must be told the backend URL via environment variables.

---

## Step 1 — Deploy the backend (Render example)

> Any host that runs `node` persistently works. Render's free tier is a good default. Fly.io and Railway are also popular.

### Render

1. Create a new **Web Service** on [render.com](https://render.com).
2. Connect your GitHub repo.
3. Set:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `NODE_ENV=production node dist/index.cjs`
   - **Environment**: Node
4. Add all the environment variables from `.env.example` under **Environment → Add Environment Variable**. Key ones:

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon / Railway Postgres connection string |
| `SESSION_SECRET` | ✅ | 32-byte random hex string |
| `ALGORAND_NETWORK` | ✅ | `testnet` or `mainnet` |
| `ALGORAND_ADMIN_MNEMONIC` | ✅ | 25-word mnemonic (store in Render secret) |
| `ALGORAND_ADMIN_ADDRESS` | ✅ | Corresponding address |
| `ALGOD_URL` | ✅ | e.g. `https://testnet-api.algonode.cloud` |
| `INDEXER_URL` | ✅ | e.g. `https://testnet-idx.algonode.cloud` |
| `UPSTASH_REDIS_REST_URL` | recommended | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | recommended | Upstash Redis token |
| `CLIENT_ORIGIN` | ✅ | Your Vercel frontend URL (see Step 3) |
| `PUBLIC_BASE_URL` | ✅ | Your Render backend URL |
| `NODE_ENV` | ✅ | `production` |
| `PORT` | optional | Render sets this automatically |

5. Deploy. Note the service URL — it will look like `https://frontier-api.onrender.com`.

---

## Step 2 — Deploy the frontend (Vercel)

1. Import the repo into [vercel.com](https://vercel.com).
2. Set the **Framework Preset** to **Vite** (auto-detected from `vercel.json`).
3. Set **Root Directory** to `Frontier-Al/` (if the repo root is the workspace, otherwise leave it as `.`).
4. Under **Project Settings → Environment Variables** add:

| Variable | Value |
|---|---|
| `VITE_API_URL` | Your backend URL without trailing slash, e.g. `https://frontier-api.onrender.com` |
| `VITE_WS_URL` | Same backend URL, e.g. `https://frontier-api.onrender.com` |

   > Note: `VITE_WS_URL` is intentionally the **https://** URL. The WebSocket hook in `useGameSocket.ts` replaces the scheme with `wss://` automatically.

5. Deploy.

---

## Step 3 — Wire CORS

Go back to your **backend** host and set:

```
CLIENT_ORIGIN=https://your-project.vercel.app
```

You can supply a comma-separated list if you want to allow Vercel preview URLs too:

```
CLIENT_ORIGIN=https://frontier.vercel.app,https://frontier-git-main.vercel.app
```

Redeploy the backend after this change.

---

## How the client resolves API & WebSocket URLs

### HTTP API calls
All `fetch("/api/...")` calls in the client go through two layers:

1. **`client/src/lib/polyfills.ts`** — a global `window.fetch` interceptor that prepends `VITE_API_URL` to any request whose path starts with `/api`, `/nft`, or `/faction`. Active only when `VITE_API_URL` is non-empty.
2. **`client/src/lib/queryClient.ts`** — `resolveApiUrl()` also prepends `VITE_API_URL` for the TanStack Query fetch functions.

In **local dev** (`VITE_API_URL` is not set) the Vite dev-server proxy in `vite.config.ts` forwards these relative paths to `:5000`. No changes needed.

### WebSocket
`client/src/hooks/useGameSocket.ts` already reads `VITE_WS_URL` and constructs the absolute WebSocket URL:
```ts
const wsBase = import.meta.env.VITE_WS_URL;
const url = wsBase
  ? `${wsBase}/ws`.replace(/^https?:\/\//, (m) => m === "https://" ? "wss://" : "ws://")
  : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
```

---

## Local development

```bash
cd Frontier-Al
cp .env.example .env   # fill in DATABASE_URL, ALGORAND_*, etc.
npm install
npm run dev            # starts server :5000 + Vite client :3000
```

Open `http://localhost:3000` — the Vite proxy handles `/api`, `/nft`, `/faction`, and `/ws` transparently.

---

## Environment variable summary

### Backend (server host)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon / Postgres connection string |
| `SESSION_SECRET` | Express session signing key |
| `ALGORAND_NETWORK` | `testnet` or `mainnet` |
| `ALGORAND_ADMIN_MNEMONIC` | Admin wallet mnemonic |
| `ALGORAND_ADMIN_ADDRESS` | Admin wallet address |
| `ALGOD_URL` | Algorand node RPC |
| `INDEXER_URL` | Algorand indexer RPC |
| `UPSTASH_REDIS_REST_URL` | Redis for event feed |
| `UPSTASH_REDIS_REST_TOKEN` | Redis token |
| `CLIENT_ORIGIN` | Comma-separated frontend URLs (CORS) |
| `PUBLIC_BASE_URL` | Backend's own public URL (for NFT metadata) |
| `NODE_ENV` | `production` |

### Frontend (Vercel build-time env vars)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend HTTP base URL (no trailing slash) |
| `VITE_WS_URL` | Backend WebSocket base URL (use https:// — wss:// inferred) |
