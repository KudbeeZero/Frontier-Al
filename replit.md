# FRONTIER - Algorand Strategy Game

## Overview
FRONTIER is a persistent hex-based war strategy game where players and AI factions compete for land, resources, and dominance on the Algorand blockchain (TestNet V1.1).

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Canvas-based HexGrid
- **Backend**: Node.js, Express, In-memory storage
- **Blockchain**: Algorand TestNet with Pera Wallet integration
  - AlgoSDK for transaction building
  - @perawallet/connect for wallet connection
  - AlgoNode cloud endpoints for TestNet
- **Styling**: Cyberpunk/Military sci-fi theme with Rajdhani + Inter fonts

## Algorand Integration
- **Network**: Algorand TestNet (chainId: 416002)
- **Wallet**: Pera Wallet (mobile + web)
- **Endpoints**:
  - Algod: https://testnet-api.algonode.cloud
  - Indexer: https://testnet-idx.algonode.cloud
- **Game Actions**: All game actions (mine, upgrade, attack, claim) can be recorded on-chain as zero-amount transactions with note data

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
│   │   ├── contexts/
│   │   │   └── WalletContext.tsx # Shared wallet state context
│   │   ├── hooks/
│   │   │   ├── useWallet.ts    # Re-exports wallet hook from context
│   │   │   ├── useBlockchainActions.ts # On-chain transaction signing
│   │   │   └── useGameState.ts # Game data fetching
│   │   ├── lib/
│   │   │   ├── algorand.ts     # Algorand SDK setup & transactions
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
- Algorand TestNet integration with Pera Wallet
- Blockchain transaction signing for game actions
- Real wallet balance display from TestNet

## Development
Run with: `npm run dev`
Server binds to port 5000
