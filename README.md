# FRONTIER V1.2

**A persistent globe-based strategy game powered by the Algorand blockchain.**

Players and AI factions compete for control of 21,000 land plots on a 3D rotating planet. Mine resources, build defenses, launch attacks, mint Commander avatars, and earn FRONTIER tokens on Algorand TestNet.

---

## Features

### 3D Globe Warfare
- 21,000 land plots distributed across a 3D rotating planet using Fibonacci sphere distribution
- 8 biomes: Forest, Desert, Mountain, Plains, Water, Tundra, Volcanic, Swamp
- Real-time territory control with color-coded ownership
- Square plot rendering via InstancedMesh for high-performance GPU-accelerated display

### Algorand Blockchain Integration
- **Network**: Algorand TestNet (chainId: 416002)
- **FRONTIER Token**: Real ASA on TestNet (Asset ID: 755818217), 1 billion total supply
- **Dual Wallet Support**: Pera Wallet (mobile + web) and LUTE Wallet (browser-based)
- **On-Chain Actions**: Territory purchases (ALGO), FRONTIER token claims (ASA transfers)
- **Off-Chain Actions**: Mining, upgrades, builds, attacks (instant, no wallet signing required)

### Resource Economy
| Resource | Description |
|----------|-------------|
| Iron | Primary resource for upgrades and attacks |
| Fuel | Secondary resource for operations |
| Crystal | Rare resource from rich territories |
| FRONTIER | ASA token earned passively per owned plot (0.5-1.5/hr based on biome) |

### Land Ownership
- Purchase unclaimed land with ALGO (biome-based pricing: 0.4-0.8 ALGO)
- Each plot generates passive FRONTIER tokens based on biome type and improvements
- Improvement bonuses stack: Turret (+10%), Shield Generator (+15%), Mining Drill (+25%), Storage Depot (+5%), Radar (+10%), Fortress (+20%)

### Improvements System
| Improvement | Max Level | Effect |
|-------------|-----------|--------|
| Turret | 3 | +3 defense/level, +10% FRONTIER/level |
| Shield Generator | 2 | +5 defense/level, +15% FRONTIER/level |
| Mining Drill | 3 | +25% yield/level, +25% FRONTIER/level |
| Storage Depot | 3 | +100 capacity/level, +5% FRONTIER/level |
| Radar Array | 1 | See incoming attacks, +10% FRONTIER |
| Fortress | 1 | +8 defense, +50 capacity, +20% FRONTIER |

### Commander Avatars
Mint unique Commander NFTs by burning FRONTIER tokens:
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

### Recon Drones
- Deploy drones to scout enemy territory
- Cost: 20 FRONTIER each, max 5 per player
- Scout duration: 15 minutes with resource discovery reports

### AI Factions
Four AI factions compete alongside human players:
| Faction | Strategy |
|---------|----------|
| NEXUS-7 | Expansionist |
| KRONOS | Defensive |
| VANGUARD | Raider |
| SPECTRE | Economic |

### Mobile-First UI
- Bottom navigation with Map, Inventory, Battles, Rankings, and Commander tabs
- Bottom-sheet land detail panels with contextual actions
- Resource HUD overlay
- Responsive design for all screen sizes

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| 3D Rendering | Three.js, @react-three/fiber, @react-three/drei |
| Backend | Node.js, Express |
| Blockchain | Algorand TestNet (AlgoSDK, Pera Wallet, LUTE Wallet) |
| Styling | Cyberpunk/Military sci-fi theme (Rajdhani + Inter fonts) |

---

## Project Structure

```
client/src/
  components/game/     Game UI components (Globe, LandSheet, Panels, etc.)
  components/ui/       Shared UI components
  contexts/            Wallet state context
  hooks/               Game state, wallet, blockchain action hooks
  lib/                 Algorand SDK setup, query client, utilities
  pages/               Route pages

server/
  algorand.ts          Admin wallet, ASA management, token transfers
  routes.ts            API endpoints for all game actions
  sphereUtils.ts       Fibonacci sphere distribution, distance calculations
  storage.ts           In-memory game state engine (21K plots, AI cycles)

shared/
  schema.ts            Types, schemas, game constants
```

---

## API Reference

### Game State
- `GET /api/game/state` - Full game state (polled every 5s)
- `GET /api/game/parcel/:id` - Single parcel info
- `GET /api/game/player/:id` - Player info
- `GET /api/game/leaderboard` - Rankings

### Actions
- `POST /api/actions/mine` - Mine resources from owned territory
- `POST /api/actions/upgrade` - Upgrade base defenses
- `POST /api/actions/build` - Build improvements
- `POST /api/actions/attack` - Deploy attack against target
- `POST /api/actions/purchase` - Purchase land (requires ALGO)
- `POST /api/actions/collect` - Collect all stored resources
- `POST /api/actions/claim-frontier` - Claim accumulated FRONTIER tokens

### Commander & Special
- `POST /api/actions/mint-avatar` - Mint Commander avatar
- `POST /api/actions/special-attack` - Execute special attack
- `POST /api/actions/deploy-drone` - Deploy recon drone

### Blockchain
- `GET /api/blockchain/status` - Blockchain status, ASA ID, balances
- `GET /api/blockchain/opt-in-check/:address` - Check FRONTIER ASA opt-in status

---

## Getting Started

### Prerequisites
- Node.js 20+
- Algorand TestNet wallet (Pera or LUTE)
- TestNet ALGO for land purchases (available from [Algorand TestNet Faucet](https://bank.testnet.algorand.network/))

### Environment Variables
The following secrets must be configured:
- `ALGORAND_ADMIN_ADDRESS` - Admin wallet address for FRONTIER ASA management
- `ALGORAND_ADMIN_MNEMONIC` - Admin wallet mnemonic (25-word phrase)
- `SESSION_SECRET` - Express session secret

### Run Development Server
```bash
npm run dev
```
Server binds to port 5000. The frontend and backend are served from the same port.

---

## License

This is proprietary software. All rights reserved. See [LICENSE](LICENSE) for details.

No part of this software may be used, copied, modified, or distributed without prior written permission from KudbeeZero.
