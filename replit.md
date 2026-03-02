# Frontier AL: Algorand Testnet Strategy Game

Frontier AL is a massive-scale strategy game set on a 3D globe, where players compete for 21,000 land plots on the Algorand Testnet.

## Project Status
- **Phase**: Production Ready
- **Network**: Algorand Testnet
- **ASA ID**: 755818217 (FRONTIER)
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
- `server/static.ts`: Critical SPA routing logic for production.
- `server/index.ts`: Express server entry point with production port handling.
- `client/src/components/game/PlanetGlobe.tsx`: 3D visualization and interaction logic.
- `shared/schema.ts`: Game constants, mechanics, and types.
