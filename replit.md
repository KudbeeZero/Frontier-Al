# FRONTIER V1.1 - Algorand Strategy Game

## Overview
FRONTIER is a persistent hex-based war strategy game where players and AI factions compete for land, resources, and dominance on the Algorand blockchain (TestNet V1.1). Features mobile-first UI with bottom navigation, bottom-sheet land details, leaderboard, onboarding flow, and improvements/turrets system.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **3D Rendering**: Three.js (v0.170), @react-three/fiber (v8.17), @react-three/drei (v9.114)
- **Backend**: Node.js, Express, In-memory storage
- **Blockchain**: Algorand TestNet with dual wallet support (Pera + LUTE)
  - AlgoSDK for transaction building
  - @perawallet/connect for Pera Wallet connection
  - lute-connect for LUTE Wallet connection
  - AlgoNode cloud endpoints for TestNet
  - ASA (Algorand Standard Asset) support for Iron/Fuel/Crystal tokens
- **Styling**: Cyberpunk/Military sci-fi theme with Rajdhani + Inter fonts

## Algorand Integration
- **Network**: Algorand TestNet (chainId: 416002, genesisID: testnet-v1.0)
- **Wallets**: Pera Wallet (mobile + web) and LUTE Wallet (browser-based)
- **Endpoints**:
  - Algod: https://testnet-api.algonode.cloud
  - Indexer: https://testnet-idx.algonode.cloud
- **Game Actions**: All game actions (mine, upgrade, attack, claim, purchase, build) can be recorded on-chain as zero-amount transactions with note data
- **ASA Support**: Functions for opt-in, balance checking, and resource token management (FRONTIER-IRON, FRONTIER-FUEL, FRONTIER-CRYSTAL)
- **On-chain actions**: Territory claims, attacks, purchases (recorded on Algorand)
- **Off-chain actions**: Upgrades, builds, storage management (server-side only for speed)

## Project Structure
```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── game/
│   │   │   │   ├── PlanetGlobe.tsx      # 3D rotating globe with Three.js (replaces flat HexGrid on map tab)
│   │   │   │   ├── HexGrid.tsx         # Legacy Canvas hex map (kept as fallback)
│   │   │   │   ├── GameLayout.tsx       # Main game layout orchestrating all panels
│   │   │   │   ├── BottomNav.tsx        # Mobile bottom navigation (Map/Inventory/Battles/Rankings/Rules)
│   │   │   │   ├── LandSheet.tsx        # Bottom sheet land popup with mine/upgrade/build/attack/buy actions
│   │   │   │   ├── LeaderboardPanel.tsx # Player rankings with territory/mining/combat stats
│   │   │   │   ├── BattlesPanel.tsx     # Active/recent battles with progress timers
│   │   │   │   ├── InventoryPanel.tsx   # Player resources, Collect All, owned territories list
│   │   │   │   ├── RulesPanel.tsx       # How to play guide
│   │   │   │   ├── OnboardingFlow.tsx   # Step-by-step tutorial for new players
│   │   │   │   ├── BaseInfoPanel.tsx    # Desktop selected tile info
│   │   │   │   ├── WarRoomPanel.tsx     # Desktop battles & AI activity
│   │   │   │   ├── ResourceHUD.tsx      # Resource display overlay
│   │   │   │   ├── WalletConnect.tsx    # Wallet connection UI
│   │   │   │   ├── TopBar.tsx           # Header with logo
│   │   │   │   └── AttackModal.tsx      # Attack deployment dialog
│   │   │   └── ui/                      # Shadcn components
│   │   ├── contexts/
│   │   │   └── WalletContext.tsx         # Shared wallet state context
│   │   ├── hooks/
│   │   │   ├── useWallet.ts             # Re-exports wallet hook from context
│   │   │   ├── useBlockchainActions.ts  # On-chain transaction signing
│   │   │   └── useGameState.ts          # Game data fetching + mutations (mine/upgrade/attack/build/purchase/collect)
│   │   ├── lib/
│   │   │   ├── algorand.ts             # Algorand SDK setup, transactions, ASA support
│   │   │   ├── hexMath.ts              # Hex grid math utilities
│   │   │   └── queryClient.ts          # React Query setup
│   │   └── pages/
│   │       └── game.tsx                # Main game page
├── server/
│   ├── routes.ts                       # API endpoints (mine/upgrade/attack/build/purchase/collect)
│   ├── storage.ts                      # In-memory game state with all game logic
│   └── hexUtils.ts                     # Server-side hex utilities
└── shared/
    └── schema.ts                       # Shared types, schemas, game constants
```

## Game Mechanics

### Resources
- **Iron**: Primary resource for upgrades and attacks
- **Fuel**: Secondary resource for operations
- **Crystal**: Rare resource from rich territories

### Timing
- **Mining Cooldown**: 5 minutes
- **Battle Duration**: 10 minutes
- **AI Cycle**: Every 15 seconds
- **Storage Capacity**: 200 base, expandable via Storage Depot improvement

### Actions
- **Mine**: Extract resources from owned territory (5-min cooldown)
- **Upgrade**: Improve defense, yield, or add fortress upgrades
- **Build**: Construct improvements (turret, shield_gen, mine_drill, storage_depot, radar, fortress)
- **Attack**: Deploy troops against enemy or unclaimed territory (10-min resolution)
- **Purchase**: Buy unclaimed land with Iron/Fuel (biome-based pricing)
- **Collect All**: Gather stored resources from all owned tiles at once

### Improvements System
- **Turret** (max lv3): +3 defense per level
- **Shield Generator** (max lv2): +5 defense per level
- **Mining Drill** (max lv3): +25% yield per level
- **Storage Depot** (max lv3): +100 capacity per level
- **Radar Array** (max lv1): See incoming attacks
- **Fortress** (max lv1): +8 defense, +50 capacity

### AI Factions
- **NEXUS-7**: Expansionist behavior
- **KRONOS**: Defensive focus
- **VANGUARD**: Raider tactics
- **SPECTRE**: Economic optimization

## API Endpoints
- `GET /api/game/state` - Full game state (polled every 5s)
- `GET /api/game/parcel/:id` - Single parcel info
- `GET /api/game/player/:id` - Player info
- `GET /api/game/leaderboard` - Leaderboard rankings
- `POST /api/actions/mine` - Mine resources
- `POST /api/actions/upgrade` - Upgrade base
- `POST /api/actions/attack` - Deploy attack
- `POST /api/actions/build` - Build improvement
- `POST /api/actions/purchase` - Purchase land
- `POST /api/actions/collect` - Collect all resources

## Design Guidelines
See `design_guidelines.md` for detailed cyberpunk military theme specifications.

## Recent Changes (V1.1)
- Mobile-first UI with bottom navigation adapted from Zero Colony patterns
- Bottom sheet land popup replacing desktop-only panels on mobile
- Leaderboard panel with territory/mining/combat statistics
- Battles panel with live progress timers and battle history
- Inventory panel with Collect All functionality
- Rules/How to Play panel
- Step-by-step onboarding tutorial flow
- Improvements/turrets system (6 building types with levels)
- Land purchasing with biome-based pricing
- Storage capacity system with visual bars on hex tiles
- Improvement icons rendered on hex tiles (turret=triangle, shield=diamond, etc.)
- Expanded hex map (radius 5 = 91 tiles)
- Faster game mechanics (5-min mining, 10-min battles, 15-sec AI)
- ASA token support for on-chain resource persistence
- On-chain vs off-chain action separation

## Development
Run with: `npm run dev`
Server binds to port 5000
