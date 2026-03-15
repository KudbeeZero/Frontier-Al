# FRONTIER-AL — v1.4.0

<p align="center">
  <a href="GAME_MANUAL.md"><img src="https://img.shields.io/badge/📖_Game_Manual-Read_Now-blue?style=for-the-badge" alt="Game Manual"></a>
  <a href="STRATEGY_GUIDE.md"><img src="https://img.shields.io/badge/🎯_Strategy_Guide-Read_Now-green?style=for-the-badge" alt="Strategy Guide"></a>
  <a href="ROADMAP.md"><img src="https://img.shields.io/badge/🗺️_Roadmap-View-orange?style=for-the-badge" alt="Roadmap"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License"></a>
</p>

**A persistent globe-based strategy game powered by the Algorand blockchain.**

Players and AI factions compete for control of a shared 21,000-plot world map rendered as a 3D rotating planet. Mine resources, build defenses, launch attacks, mint Commander avatars, and earn FRONTIER (FRNTR) tokens on Algorand TestNet. Every plot purchase is recorded as a real Algorand ASA NFT. Every FRONTIER token claim triggers a live on-chain transfer.

---

## What's New in v1.4.0

- **Fix**: Economics Panel now reads FRONTIER supply directly from the game database for real-time accuracy. Previously the panel only updated after the Algorand on-chain transfer settled, which could lag or fail silently.
- **Fix**: "Distributed" stat card was showing a duplicate of "In Circulation" (copy-paste bug). It is now a distinct "Burned" card showing total FRONTIER spent in-game on commanders, improvements, drones, and special attacks.
- **New**: Token Distribution bar now shows three segments — **In Circulation**, **Burned**, and **Treasury Reserve** — giving a complete picture of where all supply lives.

---

## Player Resources

| Document | Description |
|----------|-------------|
| [Game Manual](GAME_MANUAL.md) | Complete guide to every game system, mechanic, and feature — including rare minerals, loot boxes, landmarks, and seasons |
| [Strategy Guide](STRATEGY_GUIDE.md) | Beginner tips, advanced strategies, scenario playbooks, and quick reference tables |
| [Development Roadmap](ROADMAP.md) | Full development roadmap with 6 phases covering infrastructure, new features, and visual polish |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTIER-AL v1.4.0                       │
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
- Plots purchased by a wallet are owned by that wallet; ownership stored in PostgreSQL and backed by a real on-chain Algorand ASA (NFT) per plot
- Player state (resources, commanders, drones, progress) is wallet-specific
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

### Dual Map View (2D & 3D)
- **3D Globe**: Three.js `InstancedMesh` GPU-accelerated rendering of 21,000 plots on a rotating planet with atmosphere and orbital satellite overlays
- **2D Flat Map**: Scrollable world map with parallax texture and territory heat-map overlay
- Toggle between views at any time from the top bar

### Algorand Blockchain Integration
| Component | Details |
|-----------|---------|
| Network | Algorand TestNet (chainId: 416002) |
| FRONTIER Token | Real ASA — 1 billion total supply (FRNTR), Asset ID `755818217` |
| Plot NFTs | Each purchased plot minted as a unique ARC-3 NFT on-chain |
| Wallet Support | Pera Wallet (mobile + web) and LUTE Wallet (browser) |
| On-chain actions | Territory purchases (ALGO), FRONTIER claims (batched ASA transfers) |
| Off-chain actions | Mining, upgrades, builds, attacks (instant, no signing required) |
| Tx notes | Structured `FRNTR:{…}` JSON on every on-chain transaction (v1 schema) |

### Resource Economy
| Resource | Generation | Use |
|----------|-----------|-----|
| **Iron** | Mined from owned plots | Upgrades, attacks, improvements |
| **Fuel** | Mined from owned plots | Operations, improvements |
| **Crystal** | Rare biome bonus during mining | High-level upgrades |
| **FRONTIER (FRNTR)** | Passive per owned plot + facilities | Commanders, drones, satellites, special attacks, FRONTIER facilities |

### Land System — 21,000 Plots
Plots are distributed over the globe using a Fibonacci sphere algorithm for near-uniform density.

**Biomes & Properties**

| Biome | Resource Yield | Defense Modifier | FRNTR/day (base) |
|-------|---------------|-----------------|------------------|
| Forest | +20% | +10% | 1 |
| Plains | 100% | 100% | 1 |
| Swamp | −10% | −40% | 1 |
| Desert | −20% | −10% | 1 |
| Tundra | −30% | +20% | 1 |
| Mountain | −40% | +30% | 1 |
| Volcanic | +50% | −20% | 1 |
| Water | −50% | −30% | 1 (uncapturable) |

**Land Purchase** (ALGO pricing by biome):
- Volcanic: 0.8 ALGO | Forest/Plains: 0.6 ALGO | Mountain/Tundra: 0.5 ALGO | Desert/Swamp: 0.4 ALGO

### FRONTIER Token Generation
Every owned plot earns a baseline **1 FRNTR/day**. FRONTIER Facilities (requiring FRNTR to build) boost this significantly:

| Facility | Prerequisite | Cost (FRNTR) | Bonus (FRNTR/day) |
|----------|-------------|-------------|-------------------|
| Electricity (Lv1) | — | 30 | +1 |
| Blockchain Node (Lv1–3) | Electricity | 120 / 270 / 480 | +2 / +3 / +4 |
| Data Centre (Lv1–3) | Electricity | 120 / 270 / 480 | +2 / +3 / +4 |
| AI Lab (Lv1–3) | Electricity | 120 / 270 / 480 | +2 / +3 / +4 |

A fully-upgraded plot (all three facility chains at Lv3) generates **12 FRNTR/day**.

### Defense Improvements (Iron + Fuel)
| Improvement | Cost | Max Level | Effect |
|-------------|------|-----------|--------|
| Turret | 40 Fe, 20 Fu | 3 | +3 defense per level |
| Shield Generator | 60 Fe, 40 Fu | 2 | +5 defense per level |
| Mining Drill | — | 3 | +25% yield per level |
| Storage Depot | 35 Fe, 15 Fu | 3 | +100 capacity per level |
| Radar Array | 45 Fe, 35 Fu | 1 | See incoming attacks |
| Fortress | 200 Fe, 150 Fu | 1 | +8 defense, +50 capacity |

### Commander Avatars
Mint unique on-chain Commanders by burning FRONTIER tokens. Up to one active Commander per player; multiple can be collected.

| Tier | Cost | ATK Bonus | DEF Bonus | Special Ability |
|------|------|-----------|-----------|-----------------|
| Sentinel | 50 FRNTR | +10% | +10% | Fortify |
| Phantom | 150 FRNTR | +18% | +6% | Cloak |
| Reaper | 400 FRNTR | +30% | +5% | Annihilate |

Commanders are locked for **12 hours** after deployment.

### Special Attacks (Requires Commander)
| Attack | Cost | Cooldown | Damage | Effect | Required Tier |
|--------|------|----------|--------|--------|---------------|
| Orbital Strike | 25 FRNTR | 30 min | ×3.0 | Ignores 50% defense | Any |
| EMP Blast | 15 FRNTR | 20 min | ×1.5 | Disables improvements 10 min | Phantom, Reaper |
| Siege Barrage | 40 FRNTR | 45 min | ×2.0 | Hits up to 3 adjacent plots | Reaper only |
| Sabotage | 10 FRNTR | 15 min | ×0.5 | Halves enemy yield 30 min | Phantom, Reaper |

### Recon Drones
- Cost: **20 FRNTR** per drone
- Maximum: **5** drones per player
- Duration: **15 minutes** per scout mission
- Discovers enemy resource stockpiles and improvement layouts

### Orbital Satellites
- Cost: **50 FRNTR** to deploy
- Maximum: **2** satellites per player
- Duration: **1 hour** per orbit
- Boost: **+25% mining yield** on all owned parcels while active

### Combat System
- Battles resolve server-side with a power formula factoring biome defense modifiers, turret bonuses, Commander ATK/DEF bonuses, and a random factor
- Victory: attacker captures the territory and pillages **30%** of stored resources
- Loss: morale debuff (stacks up to 5 minutes × consecutive losses), attack cooldown (2 min × consecutive losses), cascade defense penalty on adjacent plots

### Orbital Events
Procedurally-generated events visible on both the 3D globe and 2D map:
- **Cosmetic**: Aurora effects, debris fields, comet trails (deterministic from seed, no DB required)
- **Impact events**: Server-authoritative, stored in `orbital_events` table, affect targeted parcels

### AI Factions
Four AI commanders compete alongside human players using adaptive behavior:

| Faction | Strategy | Behavior |
|---------|----------|---------|
| NEXUS-7 | Expansionist | Aggressively acquires adjacent unclaimed land |
| KRONOS | Defensive | Maximizes defenses on existing holdings |
| VANGUARD | Raider | Prioritizes attacking weak neighboring territories |
| SPECTRE | Economic | Focuses on FRONTIER generation and token accumulation |

AI turns run on a server-side interval (every 2 minutes). When suppressed, AI factions escalate attack posture.

**Adaptive Dominance Regulation (ADR):** If any single AI faction exceeds ~2,000 plots (~10% of the map), the remaining factions automatically increase aggression to prevent runaway dominance.

### Mobile-First UI
- Bottom navigation: Map, Inventory, Battles, Rankings, Commander
- Bottom-sheet land detail panels with contextual actions
- Resource HUD overlay with daily FRNTR rate + pending accumulation indicator

---

## Token Economics (v1.4.0)

The FRONTIER token supply is modelled across two layers:

| Metric | Source | Description |
|--------|--------|-------------|
| **Max Supply** | Algorand ASA `total` field | 1,000,000,000 FRNTR — immutable, set at ASA creation |
| **Treasury** | Admin's Algorand wallet balance | Undistributed tokens held by the game admin |
| **In Circulation** | DB: `SUM(frntr_balance_micro)` | Tokens actively held by all players right now |
| **Burned** | DB: `SUM(total_frontier_burned)` | Tokens permanently spent in-game (commanders, facilities, drones, attacks) |
| **Distributed (on-chain)** | `Max Supply − Treasury` | Tokens that have left the admin wallet on-chain |

> **Why two layers?** On-chain transfers are batched and fire-and-forget. The DB layer reflects the game's source-of-truth balances immediately, even before an Algorand block confirms.

### Token Sinks (Burns)
Tokens are deducted from the player's `frntr_balance_micro` in the DB at the moment of action — no on-chain transaction required for burns:
- FRONTIER Facilities (Electricity, Blockchain Node, Data Centre, AI Lab)
- Commander minting (50–400 FRNTR per tier)
- Special attacks (10–40 FRNTR per attack)
- Recon Drones (20 FRNTR each)
- Orbital Satellites (50 FRNTR)

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React, TypeScript, Vite, TailwindCSS | React 18.3, Vite 7.3 |
| 3D Rendering | Three.js, @react-three/fiber, @react-three/drei | Three.js 0.170 |
| 2D Map | Pixi.js | 8.15 |
| Animations | Framer Motion | 11.13 |
| State Management | TanStack Query (server state), React context (wallet) | RQ 5.60 |
| UI Components | Radix UI primitives + shadcn/ui, Lucide icons | — |
| Backend | Node.js 20, Express | Express 5.0 |
| Database | PostgreSQL via Drizzle ORM | Drizzle 0.39 |
| Blockchain | Algorand TestNet — algosdk, Pera Wallet, LUTE Wallet | algosdk 3.5 |
| Build | Vite (client), esbuild (server → `dist/index.cjs`) | — |
| Fonts | Rajdhani (display), Inter (body) — cyberpunk/military theme | — |

---

## Project Structure

```
Frontier-Al/
├── client/src/
│   ├── components/
│   │   ├── game/
│   │   │   ├── AttackModal.tsx          # Troop deployment UI
│   │   │   ├── BaseInfoPanel.tsx        # Selected-plot info drawer
│   │   │   ├── BattleWatchModal.tsx     # Live battle viewer
│   │   │   ├── BattlesPanel.tsx         # Active battles list
│   │   │   ├── BottomNav.tsx            # Mobile tab navigation
│   │   │   ├── CommandCenterPanel.tsx   # Mission control view
│   │   │   ├── CommanderPanel.tsx       # Mint/manage commanders
│   │   │   ├── EconomicsPanel.tsx       # Token supply analytics
│   │   │   ├── FlatMap.tsx              # 2D scrollable world map
│   │   │   ├── GameLayout.tsx           # Root layout + game loop
│   │   │   ├── GamerTagModal.tsx        # Player name setup
│   │   │   ├── InventoryPanel.tsx       # Resources, wallet, claims
│   │   │   ├── LandSheet.tsx            # Plot detail bottom sheet
│   │   │   ├── LeaderboardPanel.tsx     # Rankings / stats
│   │   │   ├── MobileActionBar.tsx      # Quick action buttons
│   │   │   ├── OnboardingFlow.tsx       # First-time player flow
│   │   │   ├── OrbitalCanvas.tsx        # Orbital event renderer
│   │   │   ├── OrbitalEventToast.tsx    # Event notifications
│   │   │   ├── OrbitalLayer.tsx         # Orbital overlay on globe
│   │   │   ├── PlanetGlobe.tsx          # 3D Three.js globe
│   │   │   ├── ResourceHUD.tsx          # Resource bar (top)
│   │   │   ├── RulesPanel.tsx           # Game rules
│   │   │   ├── TopBar.tsx               # App header + social links
│   │   │   ├── WalletConnect.tsx        # Pera/LUTE wallet UI
│   │   │   └── WarRoomPanel.tsx         # Battle planning panel
│   │   └── ui/                          # Radix/shadcn primitives
│   ├── contexts/                        # WalletContext
│   ├── hooks/
│   │   ├── useBlockchainActions.ts      # Wallet signing, opt-in, claims
│   │   ├── useGameState.ts              # Polls /api/game/state every 5s
│   │   ├── useOrbitalEngine.ts          # Client-side orbital event engine
│   │   ├── use-mobile.tsx               # Responsive breakpoint hook
│   │   ├── use-toast.ts                 # Toast notification hook
│   │   └── useWallet.ts                 # Wallet connection state
│   ├── lib/
│   │   ├── algorand.ts                  # Client-side algosdk helpers
│   │   ├── queryClient.ts               # TanStack Query setup
│   │   └── utils.ts                     # cn(), formatters
│   └── pages/
│       └── game.tsx                     # Main game page
│
├── server/
│   ├── algorand.ts                      # Admin wallet, ASA, batcher, NFTs
│   ├── db.ts                            # Drizzle DB connection
│   ├── db-schema.ts                     # PostgreSQL table definitions
│   ├── routes.ts                        # All Express API endpoints
│   ├── sphereUtils.ts                   # Fibonacci sphere, distance calc
│   ├── storage.ts                       # Game engine (DB + in-memory impls)
│   ├── wsServer.ts                      # WebSocket game state sync
│   ├── worldEventStore.ts               # World event persistence
│   ├── engine/
│   │   ├── ai/                          # AI faction behavior (reconquest, smoke)
│   │   └── battle/                      # Combat resolution logic
│   └── services/chain/                  # Algorand service layer
│       ├── client.ts                    # algodClient, indexer, admin account
│       ├── asa.ts                       # FRONTIER ASA management
│       ├── land.ts                      # Plot NFT minting/transfers
│       ├── factions.ts                  # Faction identity ASA bootstrap
│       └── types.ts
│
├── shared/
│   ├── schema.ts                        # Types, Zod schemas, constants
│   ├── orbitalEngine.ts                 # Orbital event logic
│   └── worldEvents.ts
│
├── docs/
│   ├── backlog/systems/                 # Architecture Decision Records (ADRs)
│   └── mission-control/runbooks/        # Operational runbooks
│
└── script/
    ├── build.ts                         # Build script: Vite (client) + esbuild (server)
    └── mint-golden-plot.ts
```

---

## Database Schema

### `players`
| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar(36) PK | UUID |
| `address` | varchar(100) | Algorand wallet address |
| `name` | varchar(100) | Display name |
| `iron / fuel / crystal` | integer | Current resource stockpile |
| `frntr_balance_micro` | bigint | FRONTIER balance (microFRNTR; 1 FRNTR = 1,000,000) |
| `frntr_claimed_micro` | bigint | Cumulative FRONTIER claimed on-chain |
| `total_frontier_earned` | real | Lifetime FRONTIER earned |
| `total_frontier_burned` | real | Lifetime FRONTIER burned in-game |
| `total_iron_mined` | integer | Lifetime iron |
| `total_fuel_mined` | integer | Lifetime fuel |
| `total_crystal_mined` | real | Lifetime crystal |
| `commanders` | jsonb | Array of `CommanderAvatar` objects |
| `drones / satellites` | jsonb | Active recon drones / orbital satellites |
| `special_attacks` | jsonb | Per-attack cooldown records |
| `morale_debuff_until` | bigint | Timestamp of active morale penalty |
| `attack_cooldown_until` | bigint | Timestamp of attack lockout |
| `consecutive_losses` | integer | Streak counter (resets on win/defence) |
| `welcome_bonus_received` | boolean | Guards duplicate welcome-bonus grant |
| `is_ai` | boolean | AI faction flag |
| `treasury` | real | In-game treasury balance |

### `parcels`
| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar(36) PK | UUID |
| `plot_id` | integer | 1–21,000 sequential ID |
| `lat / lng` | real | Geographic coordinates |
| `x / y / z` | real | Unit-sphere cartesian (spatial index) |
| `biome` | varchar(20) | One of 8 biome types |
| `richness` | integer | 1–100 resource richness |
| `owner_id` | varchar(36) | FK → players.id (null = unclaimed) |
| `defense_level` | integer | Base defense rating |
| `improvements` | jsonb | Array of `{ type, level }` improvements |
| `frontier_accumulated` | real | Pending FRNTR tokens (not yet claimed) |
| `frontier_per_day` | real | Current daily generation rate |
| `last_frontier_claim_ts` | bigint | Timestamp of last claim |
| `purchase_price_algo` | real | ALGO price (null = not for sale) |
| `iron_stored / fuel_stored / crystal_stored` | real | Mined resources awaiting collection |
| `storage_capacity` | integer | Max storable resources (default 200) |

### `battles`
| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar(36) PK | UUID |
| `attacker_id / defender_id` | varchar(36) | FK → players |
| `target_parcel_id` | varchar(36) | FK → parcels |
| `attacker_power / defender_power` | real | Computed combat scores |
| `status` | varchar(20) | `pending` → `resolved` |
| `outcome` | varchar(20) | `attacker_wins` / `defender_wins` |
| `resolve_ts` | bigint | When battle auto-resolves |

### `orbital_events`
Persists server-authoritative impact events (cosmetic events are generated client-side from a seed).

### `game_events`
Append-only event log (latest 50 shown in the feed).

### `plot_nfts`
| Column | Type | Description |
|--------|------|-------------|
| `plot_id` | integer PK | FK → parcels.plot_id |
| `asset_id` | bigint | Algorand ASA ID (null until minted) |
| `minted_to_address` | text | Receiving wallet |
| `minted_at` | bigint | Unix ms timestamp |

### `game_meta`
Singleton row (id=1). Stores `initialized`, `current_turn`, and `last_update_ts`.

---

## API Reference

### Blockchain / Status
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blockchain/status` | ASA ID, admin address, ALGO + FRONTIER balances |
| GET | `/api/blockchain/opt-in-check/:address` | Check if address is opted into FRONTIER ASA |
| GET | `/api/economics` | Token supply — max supply, treasury, in-game circulating, burned, on-chain distributed |

### Game State
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/game/state` | Full world state (parcels, players, battles, events; polled every 5s) |
| GET | `/api/game/parcel/:id` | Single parcel detail |
| GET | `/api/game/player/:id` | Player profile |
| GET | `/api/game/player-by-address/:address` | Look up (or auto-create) player by wallet address |
| GET | `/api/game/leaderboard` | Ranked player list with all stats |

### Player Actions
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/actions/connect-wallet` | `{ address }` | Link wallet; grants 500 FRNTR welcome bonus once |
| POST | `/api/actions/set-name` | `{ playerId, name }` | Set display name |
| POST | `/api/actions/mine` | `{ playerId, parcelId }` | Mine resources from owned plot |
| POST | `/api/actions/upgrade` | `{ playerId, parcelId, upgradeType }` | Upgrade base (defense/yield/mine/fortress) |
| POST | `/api/actions/build` | `{ playerId, parcelId, improvementType }` | Build or upgrade a facility/defense |
| POST | `/api/actions/attack` | `{ playerId, targetParcelId, troops }` | Launch attack |
| POST | `/api/actions/purchase` | `{ playerId, parcelId }` | Purchase unclaimed land |
| POST | `/api/actions/collect` | `{ playerId }` | Collect all stored resources across owned plots |
| POST | `/api/actions/claim-frontier` | `{ playerId }` | Claim accumulated FRONTIER (credits DB + queues on-chain transfer) |

### Commander & Advanced
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/actions/mint-avatar` | `{ playerId, tier }` | Mint Commander (sentinel/phantom/reaper) |
| POST | `/api/actions/switch-commander` | `{ playerId, index }` | Activate a different Commander |
| POST | `/api/actions/special-attack` | `{ playerId, targetParcelId, attackType }` | Execute special attack |
| POST | `/api/actions/deploy-drone` | `{ playerId, targetParcelId? }` | Deploy recon drone |
| POST | `/api/actions/deploy-satellite` | `{ playerId }` | Deploy orbital satellite |

### NFTs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/nft/metadata/:plotId` | ARC-3 JSON metadata for a Plot NFT |
| GET | `/api/nft/plot/:plotId` | DB record: `{ plotId, assetId, mintedToAddress, mintedAt, explorerUrl }` |

### Game Engine (Scheduled)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/game/resolve-battles` | Resolve all pending battles past their `resolveTs` |
| POST | `/api/game/ai-turn` | Advance all AI faction turns |

### Orbital Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orbital/active` | List active (non-cosmetic) orbital events |
| POST | `/api/orbital/trigger` | Spawn a new orbital event |
| POST | `/api/orbital/resolve/:id` | Resolve an active orbital event |

### TestNet Progress
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/testnet/progress/:address` | Get completed mission IDs |
| POST | `/api/testnet/progress` | Mark missions complete |

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
- PostgreSQL database (Neon, Supabase, or local)
- Algorand TestNet wallet — [Pera Wallet](https://perawallet.app/) or [LUTE Wallet](https://lute.app/)
- TestNet ALGO from the [Algorand TestNet Faucet](https://bank.testnet.algorand.network/)

### Install & Run

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

## Plot NFTs (ARC-3)

Each purchased plot is minted as an individual Algorand ASA (total=1, decimals=0) following the ARC-3 metadata standard.

### Check NFT metadata
```bash
curl https://YOUR_DEPLOYMENT_URL/nft/metadata/1
```
Returns JSON: `name`, `description`, `image` (biome SVG), `external_url`, `properties`.

### Query on-chain NFT record
```bash
curl https://YOUR_DEPLOYMENT_URL/api/nft/plot/1
# → { plotId, assetId, mintedToAddress, mintedAt, explorerUrl }
```

### View in Algorand Explorer
```
https://testnet.explorer.perawallet.app/asset/<assetId>/
```

### Receiving a Plot NFT
1. Get the `assetId` from `/api/nft/plot/:plotId`
2. Opt-in to the ASA from your Pera/LUTE wallet
3. The admin wallet will transfer the NFT once opt-in is confirmed

---

## On-Chain Transaction Note Format (v1)

All transactions sent to Algorand use the prefix `FRNTR:` followed by structured JSON, making them searchable in block explorers, parseable by any indexer, and versioned via the `"v":1` field.

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
    { "a": "mine", "p": 42, "t": 1740000000000, "m": { "fe": 8, "fu": 4, "cr": 1 } },
    { "a": "build", "p": 42, "t": 1740000005000, "x": { "improvementType": "turret" } }
  ]
}
```

---

## Deployment

### Railway (Recommended)
Set environment variables in the Railway dashboard. Provision a Railway PostgreSQL plugin for `DATABASE_URL`. Build and start commands are auto-detected from `package.json`.

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

### Pre-Go-Live Checklist
| Item | Action Required |
|------|----------------|
| `PUBLIC_BASE_URL` | Set to the final deployment URL **before** any plots are purchased — baked permanently into on-chain NFT ASA metadata |
| PostgreSQL provisioned | Required for production; in-memory MemStorage does not persist |
| Admin wallet funded | Minimum ~1 ALGO on TestNet for ASA ops; fund from [faucet](https://bank.testnet.algorand.network/) |
| `.env` configured | All required env vars set; never commit real `.env` |

---

## Wallet Connection Flow

1. User opens the app — `WalletContext` checks `localStorage` for a saved `frontier_wallet_type`
2. If saved, reconnection is attempted automatically (Pera: `reconnectSession`, LUTE: `connect`)
3. On successful connect: address saved to `localStorage`, balance fetched from Algod
4. Client calls `GET /api/game/player-by-address/:address` — creates a player record if first login, grants 500 FRONTIER welcome bonus
5. Welcome bonus ASA transfer fires in the background if the address is opted into FRONTIER ASA
6. If no wallet connected, a tester fallback player (`PLAYER_WALLET` address) is used so the UI is always functional

---

## Changelog

### v1.4.0 — Token Supply Fix (current)
- **Fix**: `/api/economics` now queries PostgreSQL for in-game token metrics (`inGameCirculating` = sum of all player `frntr_balance_micro`; `totalBurned` = sum of all `total_frontier_burned`). Supply data is accurate the instant a claim or burn occurs, regardless of on-chain settlement latency.
- **Fix**: `EconomicsPanel` "Distributed" stat was duplicating "In Circulation". Replaced with a "Burned" card showing tokens spent in-game.
- **New**: Token distribution bar now has three segments — In Circulation (green), Burned (red), Treasury Reserve (yellow).

### v1.3.0 — Map & Orbital Overhaul
- 2D/3D map toggle with seamless parallax flat-map texture
- Rankings tab in navigation
- Orbital events system (cosmetic + server-authoritative impact events)
- AI behavior now escalates aggression when suppressed (expansion + attack surge)
- Removed distracting pulsing/strobe animations from FlatMap and GameLayout
- Architecture Decision Records (ADRs) added to `docs/backlog/systems/`

### v1.2.0 — On-Chain Transactions & Crystal Tracking
- Structured `FRNTR:{…}` JSON notes on all Algorand transactions (v1 schema)
- `totalCrystalMined` tracked per player in DB and displayed in leaderboard
- FRNTR Generation Banner in Inventory panel with "Mint All — X.XX FRNTR" button
- ResourceHUD daily rate indicator (`▲ 33.0/day (12.5 pending)`)
- Mine action yields included in on-chain batch notes
- Batched atomic FRONTIER ASA transfers (up to 16 per Algorand atomic group)

### v1.1.0 — Commander & Combat Expansion
- Commander Avatar system (Sentinel / Phantom / Reaper) with on-chain FRONTIER burn
- Special attacks (Orbital Strike, EMP Blast, Siege Barrage, Sabotage)
- Recon Drones — 20 FRNTR each, 15-minute scout missions
- Orbital Satellites — 50 FRNTR, boost mining yield
- Morale debuff + attack cooldown system for consecutive combat losses
- Cascade defense penalty on plots adjacent to captured territory
- Pillage mechanic — attacker steals 30% of defender's stored resources

### v1.0.0 — Initial Release
- 21,000-plot Fibonacci sphere globe with 8 biomes
- FRONTIER ASA deployed on Algorand TestNet
- Pera Wallet + LUTE Wallet integration
- Resource economy: Iron, Fuel, Crystal, FRONTIER
- FRONTIER Facilities: Electricity, Blockchain Node, Data Centre, AI Lab
- Defense Improvements: Turret, Shield Gen, Storage Depot, Radar, Fortress
- Four AI factions: NEXUS-7, KRONOS, VANGUARD, SPECTRE
- Plot NFTs (ARC-3) minted at purchase
- 500 FRNTR welcome bonus on first wallet connection

---

## License

Proprietary software. All rights reserved. See [LICENSE](LICENSE) for details.

No part of this software may be used, copied, modified, or distributed without prior written permission from KudbeeZero.
