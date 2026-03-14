# FRONTIER — v1.4.0

**A persistent globe-based strategy game powered by the Algorand blockchain.**

Players and AI factions compete for control of 21,000 land plots on a 3D rotating planet. Mine resources, build defenses, launch attacks, mint Commander avatars, deploy recon drones, and earn real FRONTIER (FRNTR) tokens on Algorand TestNet.

---

## What's New in v1.4.0

### Token Supply Bug Fix
- **Fixed**: Minting (claiming) FRONTIER tokens now immediately reflects in the Economics Panel. Previously, the panel only updated after the on-chain Algorand transfer settled — which could lag or fail silently. The panel now reads directly from the game database for accurate, real-time supply data.
- **Fixed**: The "Distributed" stat card was showing the same value as "In Circulation" (copy-paste bug). It is now a distinct "Burned" card showing the total FRONTIER spent in-game on commanders, improvements, drones, and special attacks.
- **New**: The Token Distribution bar now shows three segments — **In Circulation**, **Burned**, and **Treasury Reserve** — giving a complete picture of where all supply lives.

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
| FRONTIER Token | Real ASA — 1 billion total supply (FRNTR) |
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
- Boosts mining yield on all owned parcels while active
- Tracked per-player in the DB; visible in the Commander panel

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

> **Why two layers?** On-chain transfers are batched and fire-and-forget. The DB layer reflects the game's source-of-truth balances immediately, even before an Algorand block confirms. The `/api/economics` endpoint queries both and returns all metrics.

### Token Sinks (Burns)
Tokens are deducted from the player's `frntr_balance_micro` in the DB at the moment of action — no on-chain transaction is required for burns:
- FRONTIER Facilities (Electricity, Blockchain Node, Data Centre, AI Lab)
- Commander minting (50–400 FRNTR per tier)
- Special attacks (10–40 FRNTR per attack)
- Recon Drones (20 FRNTR each)
- Orbital Satellites (50 FRNTR)

### On-Chain Transaction Format (v1)
All Algorand transactions carry structured `FRNTR:{…}` JSON notes for indexer discoverability:

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

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 5, TailwindCSS |
| 3D Rendering | Three.js, @react-three/fiber, @react-three/drei |
| 2D Map | Custom canvas with Fibonacci plot projection |
| State Management | TanStack Query (server state), React context (wallet) |
| UI Components | Radix UI primitives + shadcn/ui, Lucide icons |
| Backend | Node.js 20, Express |
| Database | PostgreSQL via Drizzle ORM |
| Blockchain | Algorand TestNet (algosdk v2, Pera Wallet, LUTE Wallet) |
| Fonts | Rajdhani (display), Inter (body) — cyberpunk/military theme |

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
│   └── storage.ts                       # Game engine (DB + in-memory impls)
│
├── shared/
│   └── schema.ts                        # Types, Zod schemas, constants
│
└── docs/
    ├── backlog/systems/                  # Architecture Decision Records (ADRs)
    └── mission-control/runbooks/         # Operational runbooks
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
| GET | `/nft/metadata/:plotId` | ARC-3 JSON metadata for a Plot NFT (used by wallets/marketplaces) |
| GET | `/api/nft/plot/:plotId` | DB record: `{ plotId, assetId, mintedToAddress, mintedAt, explorerUrl }` |

### Game Engine (Server-to-Server / Scheduled)
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

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database (Neon, Supabase, or local)
- Algorand TestNet wallet — [Pera Wallet](https://perawallet.app/) or [LUTE Wallet](https://lute.app/)
- TestNet ALGO: [Algorand TestNet Faucet](https://bank.testnet.algorand.network/)

### Environment Variables

**Required:**
```env
ALGORAND_ADMIN_ADDRESS=   # Admin wallet address (holds FRONTIER ASA + sends token claims)
ALGORAND_ADMIN_MNEMONIC=  # 25-word mnemonic for the admin wallet
DATABASE_URL=             # PostgreSQL connection string (e.g. postgresql://user:pass@host/db)
PUBLIC_BASE_URL=          # Public URL of your deployment (e.g. https://yourapp.replit.app)
                          # Baked into on-chain NFT metadata at mint time — required in production
```

**Optional (defaults to Algorand TestNet public nodes):**
```env
ALGOD_URL=       # Server-side algod node.  Default: https://testnet-api.algonode.cloud
INDEXER_URL=     # Server-side indexer.    Default: https://testnet-idx.algonode.cloud
VITE_ALGOD_URL=  # Client-side algod (build-time). Default: same as ALGOD_URL
VITE_INDEXER_URL=# Client-side indexer (build-time). Default: same as INDEXER_URL
```

### Install & Run

```bash
npm install          # Install all dependencies
npm run db:push      # Push Drizzle schema to PostgreSQL
npm run dev          # Start dev server on port 5000 (frontend + backend)
```

### Build for Production

```bash
npm run build        # Vite build → dist/
npm run start        # Start production server
```

---

## Plot NFTs (ARC-3)

Each purchased plot is minted as an individual Algorand ASA (total=1, decimals=0) following the ARC-3 metadata standard.

### Check NFT metadata
```bash
curl https://<your-deployment>/nft/metadata/1
```
Returns JSON: `name`, `description`, `image` (biome SVG), `external_url`, `properties`.

### Query on-chain NFT record
```bash
curl https://<your-deployment>/api/nft/plot/1
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

## Changelog

### v1.4.0 — Token Supply Fix (current)
- **Fix**: `/api/economics` now queries PostgreSQL for in-game token metrics (`inGameCirculating` = sum of all player `frntr_balance_micro`; `totalBurned` = sum of all `total_frontier_burned`). Supply data is now accurate the instant a claim or burn occurs, regardless of on-chain settlement latency.
- **Fix**: `EconomicsPanel` "Distributed" stat was duplicating "In Circulation" (showed `circulating` in both cards). Replaced with a "Burned" card showing tokens spent in-game.
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
