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
- `server/storage.ts`: Game state (DB storage + MemStorage fallback).
- `server/services/chain/`: Chain service layer (all algosdk usage isolated here).
  - `client.ts`: algodClient, indexerClient, admin account/address.
  - `asa.ts`: FRONTIER ASA management + batched transfers.
  - `land.ts`: Plot NFT minting (`mintLandNft`) + custodian transfer (`transferLandNft`).
  - `factions.ts`: Faction identity ASA bootstrap.
- `client/src/components/game/PlanetGlobe.tsx`: 3D globe visualization and plot interaction.
- `client/src/components/game/GameLayout.tsx`: Main game UI layout and action handlers.
- `shared/schema.ts`: Game constants, mechanics, and types.
- `shared/orbitalEngine.ts`: Deterministic cosmetic orbital event generation.

## Chain Service Migration (Complete)
- All algosdk usage is isolated in `server/services/chain/`.
- `server/routes.ts` imports ONLY from the chain service — never directly from algosdk.
- `server/algorand.ts` was removed (dead code, fully superseded by chain service).
- `batchedTransferFrontierAsa` in `asa.ts` uses the chain service's `_frontierAsaId` (fixes bug where claims would fail using stale module-local variable).

## Key Behavioral Notes
- **Claim pipeline**: opt-in check → credit DB balance → queue on-chain batch transfer (fire-and-forget for fast response).
- **NFT minting**: idempotency-guarded, fire-and-forget; custodian mode (admin holds NFT if buyer not opted in).
- **NFT delivery**: `POST /api/nft/deliver/:plotId` — checks buyer has opted into the specific plot ASA, then transfers from admin custody. UI in `LandSheet.tsx` shows "Claim NFT" button for in-custody plots, "In Wallet" badge once delivered. `GET /api/nft/plot/:plotId` returns current mint status and explorer link.
- **NFT URL fix**: `PUBLIC_BASE_URL` is stripped of trailing slashes before use to prevent double-slash URLs (`//nft/metadata/1`). Falls back to `REPLIT_DOMAINS` env var so minting works even when `PUBLIC_BASE_URL` is not explicitly set.
- **Minting simplification**: Removed the always-doomed immediate transfer attempt from `mintLandNft` — a freshly-created ASA can never have a buyer opt-in yet, so the transfer always failed. NFT now correctly goes straight to admin custody; buyer uses deliver endpoint after opting in.
- **Batched transfers**: up to 16 transfers per Algorand atomic group, flushed every 5s or when group is full.
- **`waitForConfirmation` rounds**: 2 (reduced from 4 for lower latency).
- **TypeScript target**: ES2020 (supports BigInt literal syntax used in chain service).
