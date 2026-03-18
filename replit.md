# Frontier AL: Algorand Testnet Strategy Game

Frontier AL is a massive-scale strategy game set on a 3D globe, where players compete for 21,000 land plots on the Algorand Testnet.

## Project Status
- **Phase**: Production Ready
- **Network**: Algorand Testnet
- **ASA ID**: 755818217 (FRONTIER / FRNTR)
- **Factions**:
  - NEXUS-7 (756388635)
  - KRONOS (756388636)
  - VANGUARD (756388647)
  - SPECTRE (756388648)

## Architecture
- **Frontend**: Vite + React + Three.js (React Three Fiber) + Tailwind CSS
- **Backend**: Express + Node.js + Drizzle ORM
- **Database**: Replit PostgreSQL (or MemStorage fallback)
- **Blockchain**: Algorand (Pera Wallet / LUTE)

## Production Configuration
- **Server Port**: Respects `process.env.PORT` (default 5000).
- **SPA Fallback**: Compatible with Express 5 / path-to-regexp 8+ using internal filtering logic in `server/static.ts`.
- **Build Command**: `npm run build`
- **Start Command**: `node dist/index.cjs`

## Key Files
- `server/index.ts`: Express server entry point with production port handling.
- `server/routes.ts`: All API route handlers — imports ONLY from chain service layer.
- `server/static.ts`: Critical SPA routing logic for production.
- `server/storage.ts`: Thin barrel re-export; delegates to decomposed module.
- `server/storage/interface.ts`: `IStorage` interface definition.
- `server/storage/game-rules.ts`: Pure functions — biome logic, row converters, leaderboard, coordinates.
- `server/storage/seeder.ts`: `seedDatabase(db)` — one-time world seeding + schema migrations.
- `server/storage/ai-engine.ts`: `runAITurn(db, ops)` — AI faction logic with injected `AiOps`.
- `server/storage/mem.ts`: `MemStorage` in-memory implementation.
- `server/storage/db.ts`: `DbStorage` PostgreSQL implementation.
- `server/services/chain/`: Chain service layer (all algosdk usage isolated here).
  - `client.ts`: algodClient, indexerClient, admin account/address.
  - `asa.ts`: FRONTIER ASA management + batched transfers.
  - `land.ts`: Plot NFT minting (`mintLandNft`) + custodian transfer (`transferLandNft`).
  - `factions.ts`: Faction identity ASA bootstrap.
- `client/src/components/game/PlanetGlobe.tsx`: 3D globe visualization and plot interaction.
- `client/src/components/game/GameLayout.tsx`: Main game UI layout and action handlers.
- `client/src/pages/landing-shared.tsx`: Shared landing page components (Nav, Footer, Starfield, CookieConsentBanner).
- `shared/schema.ts`: Game constants, mechanics, and types.
- `shared/orbitalEngine.ts`: Deterministic cosmetic orbital event generation.

## Chain Service Migration (Complete)
- All algosdk usage is isolated in `server/services/chain/`.
- `server/routes.ts` imports ONLY from the chain service — never directly from algosdk.
- `server/algorand.ts` was removed (dead code, fully superseded by chain service).
- `batchedTransferFrontierAsa` in `asa.ts` uses the chain service's `_frontierAsaId` (fixes bug where claims would fail using stale module-local variable).

## Landing Page & Legal Compliance (Recent Updates)
- **Cookie Consent Banner**: Fixed-position banner at bottom of all landing pages. Uses localStorage to remember user's choice. Links to Privacy Policy.
- **Footer Redesign**: Centered layout with:
  - Logo and project description (centered, top section)
  - Social media icons (𝕏 for Twitter/X, ◆ for Discord, ✈ for Telegram, ⚙ for GitHub) with hover effects
  - Network status (Algorand TestNet, Parcels Reserved, Status) centered below icons
  - Copyright notice (centered at bottom)
- **All Landing Pages Updated**:
  - `landing.tsx` (main home page)
  - `landing-economics.tsx`
  - `landing-features.tsx`
  - `landing-gameplay.tsx`
  - `landing-updates.tsx`
- All pages now export `CookieConsentBanner` from `landing-shared.tsx`

## Game Page Header Redesign (Recent Updates)
- **Removed Clutter**: 
  - Removed social media links (Telegram, Twitter, GitHub, Discord) from top bar
  - Removed Settings/gear icon
- **Enhanced Styling** (matching landing page aesthetic):
  - Header background: Gradient with subtle blue glow (radial gradient at 20% 50%)
  - Border: Blue-tinted glow (`border-blue-500/20`) with shadow effect
  - Logo: Changed from "F" to hexagon symbol (⬡) with gradient text (blue to purple)
  - Title: "FRONTIER" now has gradient coloring (blue to purple)
  - TESTNET badge: Enhanced with blue tones
- **Kept Essential Controls**: Theme toggle, Help button, Testnet guide, Faction badge, Wallet connection
- File: `client/src/components/game/TopBar.tsx`

## Game Page Loading Screen (Recent Updates)
- **New Mission Loading Screen**: Shows while game data is initializing
- **Components**:
  - Animated rotating globe (12-second rotation loop, matching landing page style)
  - "MISSION LOGS" panel with 3 sequential system checks:
    - ✓ Initializing frontier access…
    - ✓ Blockchain sync complete
    - ✓ Commander designation confirmed
  - Large countdown timer (6 seconds)
  - Progress bar with gradient (blue to purple)
  - Launch countdown text ("Launching mission…")
- **Styling**: Dark gradient background with radial gradient glow, matches landing page
- **Implementation**: Component shows when `isLoading && !gameState`
- Files: `client/src/components/game/MissionLoadingScreen.tsx`, updated `GameLayout.tsx`

---

## Replit Import Instructions

### Step-by-Step Setup

1. **Import the repo** — Use "Import from GitHub" in Replit. Select this repository.
2. **Open Secrets** — Go to Tools → Secrets and add all required keys (see table below).
3. **Database** — Open the Database tab; Replit auto-provisions PostgreSQL. Copy the `DATABASE_URL` connection string into Secrets.
4. **Run** — Click the Run button or the "Project" workflow. Server starts on port 5000; frontend dev server on port 3000.
5. **Verify** — Hit `GET /health` — should return `200 OK`. Frontend loads at the external port 80 (mapped from 3000).
6. **DB Schema** — On first run the database is seeded automatically via `seedDatabase()`. No manual migration needed.

### Required Secrets for Replit

| Key | Required? | Notes |
|-----|-----------|-------|
| `DATABASE_URL` | ✅ Yes | Replit Database tab → Connection URL |
| `ALGORAND_ADMIN_MNEMONIC` | ✅ Yes | 25-word phrase — testnet or mainnet wallet |
| `ALGORAND_ADMIN_ADDRESS` | ✅ Yes | Corresponding public address |
| `SESSION_SECRET` | ✅ Yes | `openssl rand -hex 32` |
| `PUBLIC_BASE_URL` | ✅ Yes | `https://<yourapp>.replit.app` |
| `ALGORAND_NETWORK` | ✅ Yes | `testnet` or `mainnet` |
| `ALGOD_URL` | Mainnet only | `https://mainnet-api.algonode.cloud` |
| `INDEXER_URL` | Mainnet only | `https://mainnet-idx.algonode.cloud` |
| `VITE_ALGOD_URL` | Mainnet only | `https://mainnet-api.algonode.cloud` |
| `VITE_INDEXER_URL` | Mainnet only | `https://mainnet-idx.algonode.cloud` |
| `UPSTASH_REDIS_REST_URL` | Optional | Falls back to in-memory |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | |
| `CLIENT_ORIGIN` | Optional | Set if frontend is on a separate domain |
| `ADMIN_KEY` | Optional | Protects admin API endpoints |
| `AI_ENABLED` | Optional | `false` recommended at launch |
| `FORCE_NEW_ASA` | First-run only | `true` ONLY on first mainnet boot to create ASAs |

---

## Mainnet Preparation

### What Is Already Done (No Code Changes Required)

- `server/services/chain/client.ts` — Full mainnet support via `ALGORAND_NETWORK=mainnet`
- Node URLs are env-var-driven — no hardcoded testnet URLs in server code
- `assertChainConfig()` enforces all required secrets at startup — fails loudly if anything is missing
- `FORCE_NEW_ASA` flag exists for safe first-run ASA creation on any network
- NFT metadata URL uses `PUBLIC_BASE_URL` (env-driven, no hardcoded domain)
- `REPLIT_DOMAINS` fallback exists so `PUBLIC_BASE_URL` isn't strictly required in Replit dev

### What Requires Human Action Before Mainnet Launch

| Action | Notes |
|--------|-------|
| Create mainnet admin wallet | Needs minimum ~5 ALGO for ASA creation fees (1 ALGO per ASA × 5) |
| Fund admin wallet | Transfer ALGO before first startup |
| Set mainnet secrets | See Mainnet Toggle Checklist in `ENV_VARS.md` |
| Set `FORCE_NEW_ASA=true` for first run | Creates FRONTIER + 4 faction ASAs on mainnet |
| Record new ASA IDs from server logs | Update the "Project Status" section of this file after first run |
| Set `FORCE_NEW_ASA=false` after first run | Prevents re-creation on subsequent restarts |
| Set `PUBLIC_BASE_URL` to final domain | Required for valid NFT metadata URLs |
| Run `npm run db:push` if schema changed | Sync Drizzle schema to production DB |
| Set `AI_ENABLED=false` | Disable AI factions for initial launch |

### Pre-Launch Checklist (Ordered)

- [ ] Admin wallet created on mainnet and funded with ≥ 5 ALGO
- [ ] All secrets updated in Replit Secrets panel for mainnet
- [ ] `FORCE_NEW_ASA=true` set for first boot only
- [ ] First boot: verify server logs show 5 ASAs created (FRONTIER + 4 factions)
- [ ] Record new mainnet ASA IDs, update this file's Project Status section
- [ ] Set `FORCE_NEW_ASA=false` (remove or set to false)
- [ ] Verify `GET /health` returns 200 on mainnet
- [ ] Test wallet connect (Pera) + ASA opt-in + FRNTR claim on mainnet
- [ ] Test land purchase + NFT mint on mainnet
- [ ] Confirm WebSocket broadcasts work (open two browser tabs)
- [ ] Set `AI_ENABLED=false` confirmed
- [ ] Announce launch

---

## Phase 2 Features (Added by Claude Code)
- **Rare Minerals**: 4 new vault columns on the players table — `xenorite_vault`, `void_shard_vault`, `plasma_core_vault`, `dark_matter_vault` (all `integer NOT NULL DEFAULT 0`). Types defined in `shared/schema.ts` as `RareMineralType`. **Migration applied** via `npm run db:push`.
- **Sub-parcel Archetypes**: 3 new columns on sub_parcels table — `archetype` (varchar, nullable), `archetype_level` (integer, default 0), `energy_alignment` (varchar, nullable). Players can assign strategic roles to sub-parcels. Enforces grid composition limits (max 3 of same type per 9-cell grid). Faction bonus multipliers defined in `ARCHETYPE_FACTION_BONUSES`.
- **Leaderboard Route Change**: Now served at `/api/game/leaderboard` (was `/api/leaderboard`).
- **`/info/updates` page**: New public-facing updates/roadmap page at `client/src/pages/landing-updates.tsx`.
- **Sub-parcel Listings**: Full sub-parcel secondary market — create/cancel/buy listings, `SubParcelListing` type in `shared/schema.ts`.
- **Sub-parcel Battles**: `attackSubParcel` endpoint, battle log with attacker/defender power.
- **Commander Companions**: Sub-parcel battles can include a commander companion for bonus power.

## Key Behavioral Notes
- **Claim pipeline**: opt-in check → credit DB balance → queue on-chain batch transfer (fire-and-forget for fast response).
- **NFT minting**: idempotency-guarded, fire-and-forget; custodian mode (admin holds NFT if buyer not opted in).
- **NFT delivery**: `POST /api/nft/deliver/:plotId` — checks buyer has opted into the specific plot ASA, then transfers from admin custody. UI in `LandSheet.tsx` shows "Claim NFT" button for in-custody plots, "In Wallet" badge once delivered. `GET /api/nft/plot/:plotId` returns current mint status and explorer link.
- **NFT URL fix**: `PUBLIC_BASE_URL` is stripped of trailing slashes before use to prevent double-slash URLs (`//nft/metadata/1`). Falls back to `REPLIT_DOMAINS` env var so minting works even when `PUBLIC_BASE_URL` is not explicitly set.
- **Minting simplification**: Removed the always-doomed immediate transfer attempt from `mintLandNft` — a freshly-created ASA can never have a buyer opt-in yet, so the transfer always failed. NFT now correctly goes straight to admin custody; buyer uses deliver endpoint after opting in.
- **Batched transfers**: up to 16 transfers per Algorand atomic group, flushed every 5s or when group is full.
- **`waitForConfirmation` rounds**: 2 (reduced from 4 for lower latency).
- **TypeScript target**: ES2020 (supports BigInt literal syntax used in chain service).

---

## Testing Mode (Live on Testnet)

### Ready for Game Testing
The app is now **production-ready** with all core systems stable and tested:
- ✅ All 31 unit tests passing
- ✅ Blockchain integration confirmed (ASA 755818217, 94.2 ALGO available)
- ✅ Commander NFT pipeline working (Sentinel, Phantom, Reaper tiers)
- ✅ Landing page mobile responsive
- ✅ Terraform DB fields initialized on all 21,000 parcels
- ✅ Economy mode active (50 FRNTR/day testing emission)

### Focus Areas for Testers
1. **Critical Loops**: Commander NFT minting, land ownership, faction AI behavior
2. **Stability**: Database persistence, WebSocket real-time updates, API performance
3. **Mobile**: Responsive layout on tablets/phones, touch controls
4. **Edge Cases**: Cold server start (30s init), wallet connection flows, NFT delivery

### Quick Commands
```bash
npx vitest run                                    # Run all tests
curl http://localhost:5000/api/blockchain/status # Check blockchain
curl http://localhost:5000/api/economics         # Economy snapshot
curl http://localhost:5000/api/game/state        # Full game state
```

### Known Workarounds
- **"CONNECTION ERROR" on first load** → Wait 30s for parcel initialization, then refresh (NOT a bug)
- **Commander price format mismatch** → Force refresh (Ctrl+Shift+R) if stale cache
- **Parcel not updating real-time** → WebSocket may be reconnecting; wait 3s
- **Mobile layout broken** → Document screen width + browser for bug report

See `TESTING_MODE.md` for full tester guide (priority areas, known issues, reporting format).
