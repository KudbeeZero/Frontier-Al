# FRONTIER-AL — VERSION 3.0

**A persistent globe-based strategy game powered by the Algorand blockchain.**

Players and AI factions compete for control of a shared 21,000-plot world map rendered as a 3D rotating planet. Mine resources, build defenses, launch attacks, mint Commander avatars, and earn FRONTIER tokens on Algorand TestNet. Every plot purchase is recorded as a real Algorand ASA NFT. Every FRONTIER token claim triggers a live on-chain transfer.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTIER-AL v3.0                         │
├──────────────┬──────────────────────┬───────────────────────┤
│   Frontend   │       Backend        │      Blockchain       │
│  React/Vite  │  Express / Node.js   │  Algorand TestNet     │
│  Three.js    │  Drizzle / Postgres  │  AlgoSDK v3           │
│  AlgoSDK     │  storage.ts engine   │  Pera + LUTE wallets  │
└──────────────┴──────────────────────┴───────────────────────┘
```

### Shared Global World
- One canonical 21,000-plot map shared across all connected players
- Plot positions generated via Fibonacci sphere distribution — deterministic, reproducible
- 8 biomes assigned by latitude + plot-index noise: Forest, Desert, Mountain, Plains, Water, Tundra, Volcanic, Swamp
- Global AI factions (NEXUS-7, KRONOS, VANGUARD, SPECTRE) run server-side and are visible to all players

### Wallet-Scoped Ownership
- Each human player is identified by their Algorand wallet address
- Plots purchased by a wallet are owned by that wallet; ownership is stored in the PostgreSQL database and backed by a real on-chain Algorand ASA (NFT) per plot
- Player state (resources, commanders, drones, progress) is wallet-specific — no two wallets share a player record
- Tester fallback: if no wallet is connected, a `PLAYER_WALLET` placeholder address is used so the UI renders

### TestNet Operations
- All blockchain activity runs on **Algorand TestNet** (chainId: 416002)
- Each wallet's on-chain operations are independent: opt-in checks, ASA transfers, and NFT minting are all per-wallet
- Admin wallet (server-side) manages the FRONTIER ASA and mints plot NFTs on purchase
- Token minting supply is tied directly to the on-chain ASA total (1 billion units, 6 decimals)

### Production vs Development Database
| Mode | Storage | Persistence |
|------|---------|-------------|
| `DATABASE_URL` set | PostgreSQL via Drizzle ORM (`DbStorage`) | Persistent across restarts |
| `DATABASE_URL` absent | In-memory (`MemStorage`) | Lost on restart — dev/demo only |

Always provision a PostgreSQL database before any production deployment.

---

## Features

### 3D Globe & 2D Flat Map
- 21,000 land plots on a 3D rotating planet — GPU-accelerated via Three.js `InstancedMesh`
- Toggle between 3D globe view and 2D flat map (Pixi.js renderer)
- Color-coded territory ownership; orbital satellite + drone layers

### Algorand Blockchain Integration
- **Network**: Algorand TestNet (chainId: 416002)
- **FRONTIER Token**: ASA on TestNet — Asset ID `755818217`, 1 billion total supply (6 decimals)
- **Dual Wallet Support**: Pera Wallet (mobile + web) and LUTE Wallet (browser extension)
- **On-Chain Actions**: Territory purchases (ALGO payment), FRONTIER token claims (ASA transfer), Plot NFT minting
- **Off-Chain Actions**: Mining, upgrades, improvements, attacks — instant, no wallet signing required
- **Batched Transfers**: Up to 16 FRONTIER ASA transfers are grouped into Algorand atomic transaction groups, flushing on size (≥1 KB) or a 30-second timeout

### Token Economy
- FRONTIER tokens accumulate passively per owned plot based on biome and facility improvements
- Token minting supply derives directly from on-chain ASA total; treasury = admin balance
- In-game balance tracked in `frntr_balance_micro` (µFRNTR) to avoid floating-point drift
- Circulating supply = total supply − admin treasury; shown live in the Economics panel

| Resource | Description |
|----------|-------------|
| Iron | Primary resource — upgrades and attacks |
| Fuel | Secondary resource — operations |
| Crystal | Rare resource — rich territories |
| FRONTIER (FRNTR) | ASA token — earned passively per owned plot |

### Land Ownership & Plot NFTs
- Purchase unclaimed land with ALGO (biome-based pricing: 0.4–0.8 ALGO)
- Each plot purchase mints a real Algorand ASA NFT (`PLOT` unit, total=1, decimals=0, ARC-3 metadata)
- NFT metadata served at `GET /nft/metadata/:plotId` — includes biome, coordinates, richness
- If the buyer is not yet opted in to the plot ASA, the admin wallet holds it until opt-in
- Ownership record stored in `plot_nfts` table with `asset_id`, `minted_to_address`, `minted_at`

### Improvements System
| Improvement | Max Level | Effect |
|-------------|-----------|--------|
| Turret | 3 | +3 defense/level |
| Shield Generator | 2 | +5 defense/level |
| Mining Drill | 3 | +25% yield/level |
| Storage Depot | 3 | +100 capacity/level |
| Radar Array | 1 | See incoming attacks |
| Fortress | 1 | +8 defense, +50 capacity |

Facility improvements (Electricity, Blockchain Node, Data Centre, AI Lab) generate additional FRONTIER/day.

### Commander Avatars
Mint Commander NFTs by burning FRONTIER tokens:
| Tier | Cost | ATK Bonus | DEF Bonus |
|------|------|-----------|-----------|
| Sentinel | 50 FRNTR | Low | Medium |
| Phantom | 150 FRNTR | Medium | Medium |
| Reaper | 400 FRNTR | High | High |

### Special Attacks (Requires Commander)
- **Orbital Strike**: Heavy damage, halves target defense (Phantom/Reaper only)
- **EMP Blast**: Disables turrets and shields (all tiers)
- **Siege Barrage**: Area damage to target and nearby plots (Reaper only)
- **Sabotage**: Halves target mining yield (all tiers)

### Recon Drones & Orbital Satellites
- Drones: Cost 20 FRONTIER, max 5 per player, 15-minute scout duration
- Satellites: Cost FRONTIER to deploy, orbit for a fixed duration, provide yield bonuses

### AI Factions (Shared Global)
Four AI factions run on the server and are visible to all players simultaneously:
| Faction | Strategy |
|---------|----------|
| NEXUS-7 | Expansionist |
| KRONOS | Defensive |
| VANGUARD | Raider |
| SPECTRE | Economic |

AI turns run every 15 seconds via a server-side `setInterval`.

### Orbital Events
- Random impact events trigger every 5 minutes server-side
- Events have gameplay effects (resource bursts, tile hazards) and are persisted in the `orbital_events` table
- Cosmetic events are generated deterministically client-side — no database row required

### Mobile-First UI
- Bottom navigation: Map, Inventory, Battles, Rankings, Commander
- Bottom-sheet land detail panels with contextual actions
- Resource HUD overlay with daily FRNTR rate + pending accumulation indicator

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite 7, TailwindCSS 3 |
| 3D Rendering | Three.js, @react-three/fiber, @react-three/drei |
| 2D Rendering | Pixi.js 8 |
| Backend | Node.js 20, Express 5 |
| Database | PostgreSQL + Drizzle ORM (`drizzle-orm/node-postgres`) |
| Blockchain | Algorand TestNet — AlgoSDK v3, Pera Wallet, LUTE Wallet |
| Build | Vite (client), esbuild (server → `dist/index.cjs`) |
| Styling | Cyberpunk / Military sci-fi — Rajdhani + Inter fonts |

---

## Project Structure

```
client/src/
  components/game/     Game UI components (Globe, Map, Panels, HUDs)
  components/ui/       Shared Radix UI primitives (shadcn/ui)
  contexts/            WalletContext — wallet connection state
  hooks/               useGameState, useWallet, useBlockchainActions, useOrbitalEngine
  lib/                 algorand.ts (client SDK), queryClient.ts, utils.ts
  pages/               game.tsx (main), testnet.tsx, not-found.tsx

server/
  index.ts             Express app entry — port binding, middleware, static serving
  routes.ts            All API endpoints + background intervals
  storage.ts           DbStorage (Postgres) + MemStorage (in-memory fallback)
  algorand.ts          Admin wallet, ASA creation/transfer, NFT minting, batcher
  db.ts                pg Pool + Drizzle client (null when DATABASE_URL absent)
  db-schema.ts         Drizzle table definitions (parcels, players, battles, etc.)
  static.ts            Production static file serving (SPA fallback)
  sphereUtils.ts       Fibonacci sphere distribution, great-circle distance

shared/
  schema.ts            Types, Zod schemas, game constants (shared client + server)
  orbitalEngine.ts     Orbital event logic

script/
  build.ts             Build script: Vite (client) + esbuild (server)

dist/                  Build output (gitignored)
  public/              Vite client build
  index.cjs            esbuild server bundle
```

---

## Environment Variables

Create a `.env` file in the project root (never commit it):

```env
# ── Required ────────────────────────────────────────────────────────────────

# PostgreSQL connection string (Neon, Railway Postgres, Supabase, etc.)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Algorand admin wallet — used server-side to manage FRONTIER ASA + mint NFTs
ALGORAND_ADMIN_ADDRESS=YOUR_58_CHAR_ALGORAND_ADDRESS
ALGORAND_ADMIN_MNEMONIC=word1 word2 ... word25

# Canonical public URL of this deployment — baked into on-chain NFT metadata URLs
# Must be set BEFORE any plot NFT is minted (URL is permanent on-chain)
PUBLIC_BASE_URL=https://your-app.yourdomain.com

# ── Optional overrides (default to Algorand TestNet via algonode.cloud) ─────

# Server-side Algod node
ALGOD_URL=https://testnet-api.algonode.cloud

# Server-side Indexer node
INDEXER_URL=https://testnet-idx.algonode.cloud

# Network label embedded in on-chain transaction notes
ALGORAND_NETWORK=testnet

# Client-side Algod URL (baked into Vite bundle at build time)
VITE_ALGOD_URL=https://testnet-api.algonode.cloud

# Client-side Indexer URL (baked into Vite bundle at build time)
VITE_INDEXER_URL=https://testnet-idx.algonode.cloud

# Server port (defaults to 5000)
PORT=5000
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database (local or hosted — see deployment section)
- Algorand TestNet wallet: [Pera Wallet](https://perawallet.app) or [LUTE Wallet](https://lute.app)
- TestNet ALGO from the [Algorand TestNet Faucet](https://bank.testnet.algorand.network/)

### Development

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, admin mnemonic, etc.

# Push database schema (first time or after schema changes)
npm run db:push

# Start development server (client + server on port 5000)
npm run dev
```

In development, the Express server and Vite dev server run together on port 5000 via `tsx server/index.ts`. Hot module replacement is active for the client.

### Production Build

```bash
npm install
npm run build   # Builds client (dist/public/) + server (dist/index.cjs)
npm start       # NODE_ENV=production node dist/index.cjs
```

Server binds to `0.0.0.0:${PORT}` (default 5000). In production, Express serves the built client assets directly — no separate frontend server needed.

---

## API Reference

### Blockchain / Status
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/blockchain/status` | ASA ID, admin address, ALGO balance, readiness |
| `GET` | `/api/blockchain/opt-in-check/:address` | Whether address has opted into FRONTIER ASA |
| `GET` | `/api/economics` | Total supply, treasury, circulating, in-game metrics |

### Game State
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/game/state` | Full game state (parcels, players, battles, events) — polled every 5s |
| `GET` | `/api/game/parcel/:id` | Single parcel detail |
| `GET` | `/api/game/player/:id` | Player record by internal ID |
| `GET` | `/api/game/player-by-address/:address` | Wallet lookup / auto-create player |
| `GET` | `/api/game/leaderboard` | Rankings |
| `GET` | `/api/testnet/progress/:address` | Wallet's TestNet mission progress |

### Player Actions
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/actions/connect-wallet` | Register wallet address to player; grant welcome bonus |
| `POST` | `/api/actions/set-name` | Set gamer tag (validated against address) |
| `POST` | `/api/actions/mine` | Mine resources from owned plot |
| `POST` | `/api/actions/upgrade` | Upgrade base defense level |
| `POST` | `/api/actions/build` | Build an improvement on a plot |
| `POST` | `/api/actions/attack` | Deploy an attack against a target plot |
| `POST` | `/api/actions/purchase` | Purchase unclaimed land (requires ALGO tx) |
| `POST` | `/api/actions/collect` | Collect all stored plot resources |
| `POST` | `/api/actions/claim-frontier` | Claim accumulated FRONTIER tokens (triggers ASA transfer) |
| `POST` | `/api/actions/mint-avatar` | Mint Commander avatar (burns FRONTIER) |
| `POST` | `/api/actions/switch-commander` | Set active Commander |
| `POST` | `/api/actions/special-attack` | Execute a Commander special attack |
| `POST` | `/api/actions/deploy-drone` | Deploy a recon drone |
| `POST` | `/api/actions/deploy-satellite` | Deploy an orbital satellite |
| `POST` | `/api/testnet/progress` | Save wallet's TestNet mission completions |

### NFT Metadata
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/nft/metadata/:plotId` | ARC-3 JSON metadata for a plot NFT |
| `GET` | `/api/nft/plot/:plotId` | On-chain record (assetId, holder, mintedAt) |

### Server-Side Game Engine
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/game/resolve-battles` | Resolve pending battles (auto-called every 15s) |
| `POST` | `/api/game/ai-turn` | Run one AI faction turn (auto-called every 15s) |
| `GET` | `/api/orbital/active` | Active orbital impact events |
| `POST` | `/api/orbital/trigger` | Roll for a new impact event (auto-called every 5min) |
| `POST` | `/api/orbital/resolve/:id` | Mark an orbital event resolved + apply effects |

---

## Database Schema

Managed via Drizzle ORM. Apply with `npm run db:push` or generate migrations with `drizzle-kit generate`.

| Table | Purpose |
|-------|---------|
| `game_meta` | Singleton world state (initialized flag, turn counter) |
| `players` | One row per human or AI player (keyed by UUID; wallet address in `address` column) |
| `parcels` | One row per land plot (21,000 total; Fibonacci sphere coords, biome, owner, improvements) |
| `battles` | One row per battle event (attacker, defender, resolve timestamp, outcome) |
| `orbital_events` | Gameplay-affecting impact events with effects array |
| `game_events` | Log of in-game actions (mining, attacks, purchases) — latest 50 shown in UI |
| `plot_nfts` | Algorand ASA record per purchased plot (asset_id, holder, minted_at) |

---

## Wallet Connection Flow

1. User opens the app — `WalletContext` checks `localStorage` for a saved `frontier_wallet_type`
2. If saved, reconnection is attempted automatically (Pera: `reconnectSession`, LUTE: `connect`)
3. On successful connect: address saved to `localStorage`, balance fetched from Algod
4. Client calls `GET /api/game/player-by-address/:address` — creates a player record if first login, grants 500 FRONTIER welcome bonus
5. Welcome bonus ASA transfer fires in the background if the address is opted into FRONTIER ASA
6. If no wallet connected, a tester fallback player (`PLAYER_WALLET` address) is used so the UI is always functional

---

## Plot NFT Verification

Each purchased plot is minted as an Algorand ASA (total=1, decimals=0, ARC-3 metadata).

### Check NFT metadata
```bash
curl https://YOUR_DEPLOYMENT_URL/nft/metadata/1
```
Returns: `name`, `description`, `image` (biome SVG), `external_url`, `properties`.

### Query on-chain NFT record
```bash
curl https://YOUR_DEPLOYMENT_URL/api/nft/plot/1
```
Returns: `{ plotId, assetId, mintedToAddress, mintedAt, explorerUrl }`.

### View in Algorand explorer
```
https://allo.info/asset/<assetId>
```

### Check asset in wallet
1. Open Pera or LUTE connected to **Algorand TestNet**
2. Opt in to the asset using the `assetId` from `/api/nft/plot/:plotId`
3. Admin holds the NFT until opt-in is confirmed; after opt-in, a manual admin transfer delivers it

---

## Migration Audit — Replit → Production

### Migration Blockers (Resolved in v3.0)

| Item | Status | Notes |
|------|--------|-------|
| Hardcoded Replit URL in README | **Fixed** | All curl examples now use `YOUR_DEPLOYMENT_URL` placeholder |
| Port handling | **Clean** | Uses `process.env.PORT \|\| "5000"`, binds `0.0.0.0` |
| File system usage | **Clean** | Only `dist/` and `client/public/` path resolution — standard `process.cwd()` |
| Hostname assumptions | **Clean** | No hardcoded hostnames anywhere in server code |
| Replit-only config (`.replit`) | **Inert** | `.replit` file exists but is ignored outside Replit — safe to delete post-migration |
| Database externalized | **Clean** | `DATABASE_URL` env var; `MemStorage` fallback for development |
| Blockchain config externalized | **Clean** | All Algorand config via env vars with sensible defaults |
| Build process | **Clean** | `npm install && npm run build && npm start` — fully portable |
| Static serving | **Clean** | Express serves `dist/public/` in production — no platform-specific CDN needed |
| Vite dev proxy | **Note** | Dev mode proxies `/api` to `127.0.0.1:5001` — harmless in production (Vite not used) |

### Remaining Items Before Go-Live

| Item | Action Required |
|------|----------------|
| `PUBLIC_BASE_URL` | Set to the final deployment URL **before** any plots are purchased — baked permanently into on-chain NFT ASA metadata |
| PostgreSQL provisioned | Required for production; in-memory MemStorage does not persist |
| Admin wallet funded | Minimum ~1 ALGO on TestNet for ASA ops; fund from [faucet](https://bank.testnet.algorand.network/) |
| `.env.example` | Create for new contributors (never commit real `.env`) |

### Replit-Specific Files (Safe to Delete Post-Migration)
```
.replit                  # Replit run/deploy config
replit.md               # Replit project notes
```

---

## Deployment

### Railway (Recommended — `railway.toml` included)

```bash
# railway.toml already configured:
# build: npm install && npm run build
# start: npm start
```

Set environment variables in the Railway dashboard. Provision a Railway PostgreSQL plugin for `DATABASE_URL`.

### Render

1. New Web Service → connect repo
2. **Build command**: `npm install && npm run build`
3. **Start command**: `npm start`
4. **Environment**: Node 20, set all required env vars
5. Add a Render PostgreSQL database, copy connection string to `DATABASE_URL`

### DigitalOcean App Platform

1. New App → connect repo
2. Build command: `npm run build`
3. Run command: `npm start`
4. Add a DigitalOcean Managed PostgreSQL database

### Vercel (Frontend Only — Not Recommended)

The project is a unified Express + React server. Splitting frontend/backend for Vercel requires substantial refactoring and is not the recommended path. Use Railway or Render for the simplest migration.

---

## On-Chain Transaction Note Format (v1)

All transactions sent to Algorand use the prefix `FRNTR:` followed by structured JSON.

### FRONTIER Token Claim (server → chain)
```json
{
  "game": "FRONTIER",
  "v": 1,
  "type": "batch_claim",
  "amt": 33.47,
  "to": "ABCDEFGHIJ...",
  "batchIdx": 0,
  "batchSize": 1,
  "ts": 1740000000000,
  "network": "testnet"
}
```

### Game Action Batch (client → chain)
```json
{
  "game": "FRONTIER",
  "v": 1,
  "network": "testnet",
  "actions": [
    { "a": "mine", "p": 42, "t": 1740000000000, "m": { "fe": 8, "fu": 4, "cr": 1 } }
  ]
}
```

---

## License

Proprietary software. All rights reserved. See [LICENSE](LICENSE) for details.

No part of this software may be used, copied, modified, or distributed without prior written permission from KudbeeZero.
