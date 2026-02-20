# FRONTIER V1.1 - Algorand Strategy Game

## Overview
FRONTIER is a persistent globe-based war strategy game where players and AI factions compete for 21,000 land plots on a 3D rotating planet, powered by the Algorand blockchain (TestNet V1.1). Features mobile-first UI with bottom navigation, bottom-sheet land details, leaderboard, onboarding flow, improvements/turrets system, and FRONTIER token economy.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **3D Rendering**: Three.js (v0.170), @react-three/fiber (v8.17), @react-three/drei (v9.114)
- **Backend**: Node.js, Express, In-memory storage
- **Blockchain**: Algorand TestNet with dual wallet support (Pera + LUTE)
  - AlgoSDK for transaction building
  - @perawallet/connect for Pera Wallet connection
  - lute-connect for LUTE Wallet connection
  - AlgoNode cloud endpoints for TestNet
  - FRONTIER ASA token (1B total supply, earned passively per plot)
- **Styling**: Cyberpunk/Military sci-fi theme with Rajdhani + Inter fonts

## Algorand Integration
- **Network**: Algorand TestNet (chainId: 416002, genesisID: testnet-v1.0)
- **Wallets**: Pera Wallet (mobile + web) and LUTE Wallet (browser-based)
- **Endpoints**:
  - Algod: https://testnet-api.algonode.cloud
  - Indexer: https://testnet-idx.algonode.cloud
- **FRONTIER Token**: ASA token with 1B total supply, earned passively per owned plot (rate varies by biome)
- **Land Purchase**: Costs ALGO (real value), biome-based pricing (0.4-0.8 ALGO)
- **On-chain actions**: Territory claims, attacks, purchases, FRONTIER claims (recorded on Algorand)
- **Off-chain actions**: Upgrades, builds, mining, storage management (server-side only for speed)

## Project Structure
```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── game/
│   │   │   │   ├── PlanetGlobe.tsx      # 3D rotating globe with Three.js + InstancedMesh (21K plots)
│   │   │   │   ├── GameLayout.tsx       # Main game layout orchestrating all panels
│   │   │   │   ├── BottomNav.tsx        # Mobile bottom navigation (Map/Inventory/Battles/Rankings/Rules)
│   │   │   │   ├── LandSheet.tsx        # Bottom sheet land popup with mine/upgrade/build/attack/buy actions
│   │   │   │   ├── LeaderboardPanel.tsx # Player rankings with territory/mining/combat stats
│   │   │   │   ├── BattlesPanel.tsx     # Active/recent battles with progress timers
│   │   │   │   ├── InventoryPanel.tsx   # Player resources, FRONTIER balance, Collect All, owned territories
│   │   │   │   ├── RulesPanel.tsx       # How to play guide
│   │   │   │   ├── OnboardingFlow.tsx   # Step-by-step tutorial for new players
│   │   │   │   ├── BaseInfoPanel.tsx    # Desktop selected tile info
│   │   │   │   ├── WarRoomPanel.tsx     # Desktop battles & AI activity
│   │   │   │   ├── ResourceHUD.tsx      # Resource display overlay (Iron, Fuel, Crystal, FRONTIER)
│   │   │   │   ├── WalletConnect.tsx    # Wallet connection UI
│   │   │   │   ├── TopBar.tsx           # Header with logo
│   │   │   │   ├── MobileActionBar.tsx  # Mobile action bar for selected plot
│   │   │   │   └── AttackModal.tsx      # Attack deployment dialog
│   │   │   └── ui/                      # Shadcn components
│   │   ├── contexts/
│   │   │   └── WalletContext.tsx         # Shared wallet state context
│   │   ├── hooks/
│   │   │   ├── useWallet.ts             # Re-exports wallet hook from context
│   │   │   ├── useBlockchainActions.ts  # On-chain transaction signing (ALGO payments, FRONTIER claims)
│   │   │   └── useGameState.ts          # Game data fetching + mutations (mine/upgrade/attack/build/purchase/collect/claim)
│   │   ├── lib/
│   │   │   ├── algorand.ts             # Algorand SDK setup, transactions, FRONTIER ASA support
│   │   │   └── queryClient.ts          # React Query setup
│   │   └── pages/
│   │       └── game.tsx                # Main game page
├── server/
│   ├── routes.ts                       # API endpoints (mine/upgrade/attack/build/purchase/collect/claim)
│   ├── storage.ts                      # In-memory game state with 21K plots, Fibonacci sphere distribution
│   └── sphereUtils.ts                  # Fibonacci sphere distribution, distance calculations
└── shared/
    └── schema.ts                       # Shared types, schemas, game constants (plotId-based)
```

## Game Mechanics

### Land System
- **21,000 plots** distributed across the planet using Fibonacci sphere algorithm
- Each plot has: plotId (1-21000), lat/lng coordinates, biome, richness (40-100)
- **8 Biomes**: forest, desert, mountain, plains, water, tundra, volcanic, swamp
- Biomes assigned by latitude bands + deterministic noise

### Resources
- **Iron**: Primary resource for upgrades and attacks
- **Fuel**: Secondary resource for operations
- **Crystal**: Rare resource from rich territories
- **FRONTIER**: ASA token earned passively per owned plot (0.5-1.5/hr based on biome)

### FRONTIER Token Economy
- **Total Supply**: 1,000,000,000 (1 billion)
- **Earning**: Each owned plot passively accumulates FRONTIER per hour
- **Rates by biome**: volcanic (1.5/hr), mountain (1.0/hr), forest/plains/swamp (0.7/hr), desert/tundra (0.7/hr), water (0.5/hr)
- **Claiming**: Players claim accumulated FRONTIER via on-chain transaction
- **Mining Drill bonus**: +25% FRONTIER rate per mining drill level

### Land Purchase
- Costs **ALGO** (real value), not in-game resources
- Biome-based pricing: water/tundra/swamp (0.4 ALGO), forest/desert/plains (0.5 ALGO), mountain/volcanic (0.8 ALGO)
- Requires ALGO payment transaction signed by wallet

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
- **Purchase**: Buy unclaimed land with ALGO (biome-based pricing)
- **Claim FRONTIER**: Collect accumulated FRONTIER tokens from owned plots
- **Collect All**: Gather stored resources from all owned tiles at once

### Improvements System
- **Turret** (max lv3): +3 defense per level
- **Shield Generator** (max lv2): +5 defense per level
- **Mining Drill** (max lv3): +25% yield per level, +25% FRONTIER rate per level
- **Storage Depot** (max lv3): +100 capacity per level
- **Radar Array** (max lv1): See incoming attacks
- **Fortress** (max lv1): +8 defense, +50 capacity

### AI Factions
- **NEXUS-7**: Expansionist behavior
- **KRONOS**: Defensive focus
- **VANGUARD**: Raider tactics
- **SPECTRE**: Economic optimization
- AI factions use spatial proximity (nearest plots within ~15 degrees) for neighbor detection

## API Endpoints
- `GET /api/game/state` - Full game state with all 21K plots (polled every 5s)
- `GET /api/game/parcel/:id` - Single parcel info
- `GET /api/game/player/:id` - Player info
- `GET /api/game/leaderboard` - Leaderboard rankings
- `POST /api/actions/mine` - Mine resources
- `POST /api/actions/upgrade` - Upgrade base
- `POST /api/actions/attack` - Deploy attack
- `POST /api/actions/build` - Build improvement
- `POST /api/actions/purchase` - Purchase land (ALGO payment)
- `POST /api/actions/collect` - Collect all resources
- `POST /api/actions/claim-frontier` - Claim accumulated FRONTIER tokens

## Design Guidelines
See `design_guidelines.md` for detailed cyberpunk military theme specifications.

### Commander Avatar System
- **3 Tiers**: Sentinel (50 FRNTR), Phantom (150 FRNTR), Reaper (400 FRNTR)
- Each commander has ATK/DEF bonuses, special ability, and random stat roll on mint
- One commander per player, minted by burning FRONTIER tokens
- Commander images: sentinel (blue soldier), phantom (purple soldier), reaper (orange skull)

### Special Attacks (requires Commander)
- **Orbital Strike**: Heavy damage, halves target defense (30 FRNTR, 45min cooldown, Phantom/Reaper)
- **EMP Blast**: Disables turrets/shields, -2 defense (15 FRNTR, 20min cooldown, all tiers)
- **Siege Barrage**: Area damage to target + nearby plots (40 FRNTR, 45min cooldown, Reaper only)
- **Sabotage**: Halves target mining yield (10 FRNTR, 15min cooldown, all tiers)
- Available in LandSheet expanded view when targeting enemy territory

### Recon Drones
- Cost 20 FRONTIER each, max 5 per player
- Scout enemy territory for 15 minutes, report discovered resources
- Deployed from Commander panel

### API Endpoints (new)
- `POST /api/actions/mint-avatar` - Mint commander avatar (burns FRONTIER)
- `POST /api/actions/special-attack` - Execute special attack on enemy plot
- `POST /api/actions/deploy-drone` - Deploy recon drone

### UI Updates
- Commander tab in bottom navigation (replaced Rules tab)
- CommanderPanel: mint avatars, view stats, manage drones
- LandSheet: special attack buttons when expanded on enemy territory
- FRONTIER burn tracking (totalFrontierBurned on player)

## Recent Changes (V1.1 -> V1.2)
- **21,000 plots**: Replaced hex grid with Fibonacci sphere distribution (plotId 1-21000)
- **3D Globe**: InstancedMesh rendering for all 21K plots simultaneously (single GPU draw call)
- **Square Plots**: PlaneGeometry (squares) instead of circles, with dynamic zoom-based scaling (0.6x-2.5x)
- **FRONTIER Token**: Real ASA on Algorand TestNet (ASA ID: 755818217), 1B supply, 6 decimals
- **Server-side Algorand**: server/algorand.ts handles admin wallet, ASA creation, token transfers
- **ASA Opt-In Flow**: Banner prompts connected wallets to opt-in to FRONTIER ASA before claiming
- **Real ASA Transfers**: FRONTIER claim triggers admin-signed ASA transfer to player wallet
- **ALGO Land Purchase**: Land costs real ALGO sent to admin treasury wallet
- **Biome-based pricing**: Different ALGO costs per biome type
- **Spatial AI neighbors**: AI factions use lat/lng proximity instead of hex adjacency
- **Social Media Icons**: Telegram, X/Twitter, GitHub, Discord in TopBar
- Mobile-first UI with bottom navigation
- Bottom sheet land popup with ALGO purchase, FRONTIER claim display
- Inventory panel with FRONTIER balance and claim button
- ResourceHUD showing Iron, Fuel, Crystal, and FRONTIER
- Leaderboard tracking FRONTIER earned

## Blockchain API Endpoints
- `GET /api/blockchain/status` - Blockchain status (ASA ID, admin address, balances)
- `GET /api/blockchain/opt-in-check/:address` - Check if address opted into FRONTIER ASA

## Key Files (Blockchain)
- `server/algorand.ts` - Server-side Algorand: admin wallet, ASA creation, transfers, opt-in checks
- `client/src/lib/algorand.ts` - Client-side Algorand: wallet signing, ASA helpers, blockchain status fetch

## Development
Run with: `npm run dev`
Server binds to port 5000
