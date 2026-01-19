# FRONTIER - Algorand Strategy Game

## Overview
FRONTIER is a persistent hex-based war strategy game where players and AI factions compete for land, resources, and dominance on the Algorand blockchain (TestNet V1.1).

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Canvas-based HexGrid
- **Backend**: Node.js, Express, In-memory storage
- **Blockchain**: Algorand TestNet (ready for integration with AlgoSDK, Pera Wallet)
- **Styling**: Cyberpunk/Military sci-fi theme with Rajdhani + Inter fonts

## Project Structure
```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── game/           # Game-specific components
│   │   │   │   ├── HexGrid.tsx       # Canvas hex map
│   │   │   │   ├── BaseInfoPanel.tsx # Selected tile info
│   │   │   │   ├── WarRoomPanel.tsx  # Battles & AI activity
│   │   │   │   ├── ResourceHUD.tsx   # Resource display
│   │   │   │   ├── WalletConnect.tsx # Wallet connection UI
│   │   │   │   ├── TopBar.tsx        # Header with logo
│   │   │   │   ├── AttackModal.tsx   # Attack deployment
│   │   │   │   └── GameLayout.tsx    # Main game layout
│   │   │   └── ui/             # Shadcn components
│   │   ├── hooks/
│   │   │   ├── useWallet.ts    # Wallet state management
│   │   │   └── useGameState.ts # Game data fetching
│   │   ├── lib/
│   │   │   ├── hexMath.ts      # Hex grid math utilities
│   │   │   └── queryClient.ts  # React Query setup
│   │   └── pages/
│   │       └── game.tsx        # Main game page
├── server/
│   ├── routes.ts               # API endpoints
│   ├── storage.ts              # In-memory game state
│   └── hexUtils.ts             # Server-side hex utilities
└── shared/
    └── schema.ts               # Shared TypeScript types
```

## Game Mechanics

### Resources
- **Iron**: Primary resource for upgrades and attacks
- **Fuel**: Secondary resource for operations
- **Crystal**: Premium resource (future use)

### Actions
- **Mine**: Extract resources from owned territory (1-hour cooldown)
- **Upgrade**: Improve base defense, yield, or add improvements
- **Attack**: Deploy troops against enemy or unclaimed territory

### AI Factions
- **NEXUS-7**: Expansionist behavior
- **KRONOS**: Defensive focus
- **VANGUARD**: Raider tactics
- **SPECTRE**: Economic optimization

## API Endpoints
- `GET /api/game/state` - Full game state
- `GET /api/game/parcel/:id` - Single parcel info
- `GET /api/game/player/:id` - Player info
- `POST /api/actions/mine` - Mine resources
- `POST /api/actions/upgrade` - Upgrade base
- `POST /api/actions/attack` - Deploy attack

## Design Guidelines
See `design_guidelines.md` for detailed cyberpunk military theme specifications.

## Recent Changes
- Initial MVP implementation with full hex grid map
- Canvas-based rendering for hex tiles with biome colors
- Complete game UI with panels, HUD, and modals
- Backend with in-memory storage and game logic
- AI faction simulation running in background

## Development
Run with: `npm run dev`
Server binds to port 5000
