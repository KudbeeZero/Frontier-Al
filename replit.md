# FRONTIER - Algorand Strategy Game

## Overview
FRONTIER is a persistent 2D map-based war strategy game where players and AI factions compete for 21,000 land plots, powered by the Algorand blockchain (TestNet). The game features wallet-gated gameplay, a two-tier economy (defense improvements cost iron/fuel, facilities cost FRONTIER tokens), and a clear color-coded map. It is designed for multi-chain portability and includes a mobile-first UI.

## User Preferences
The user wants the agent to focus on maintaining the project's core vision as a persistent 2D map-based war strategy game on Algorand. Prioritize features that enhance wallet-gated gameplay, the two-tier economy, and multi-chain portability. Any changes should align with the established cyberpunk/military sci-fi theme. For development, the user prefers adherence to the existing project structure and technological choices.

## System Architecture

### UI/UX Decisions
The game features a mobile-first UI with bottom navigation, using a cyberpunk/military sci-fi theme with Rajdhani and Inter fonts. The 2D map rendering uses an HTML Canvas with an equirectangular projection, displaying 3-layer planet textures (albedo, night lights, clouds). A 3D globe, built with Three.js and React Three Fiber, shows 21K instanced plot meshes. Key UI components include a `BottomNav`, `LandSheet` for plot actions, `LeaderboardPanel`, `BattlesPanel`, `InventoryPanel`, and `WalletConnect`. Visual effects include an animated star field with twinkling stars and an atmospheric blue glow.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS.
- **Backend**: Node.js, Express, utilizing in-memory storage for game state.
- **Map & Globe**: `FlatMap.tsx` handles the 2D canvas map, while `PlanetGlobe.tsx` (legacy) provides a 3D globe with instanced mesh rendering for plots.
- **Blockchain Integration**: Algorand TestNet, with dual wallet support (Pera + LUTE) using AlgoSDK, @perawallet/connect, and lute-connect. AlgoNode cloud endpoints are used for TestNet access.
- **State Management**: `WalletContext` for shared wallet state and React Query for game data fetching and mutations.
- **Algorand Transactions**: Client-side atomic transaction batching is implemented to group multiple game actions into a single wallet signature request.

### Feature Specifications
- **Land System**: 21,000 plots distributed using a Fibonacci sphere algorithm, each with a unique plotId, lat/lng, biome, and richness. Eight distinct biomes are assigned based on latitude and noise. Plots have deterministic names and belong to named sectors.
- **Resources**: Iron, Fuel, Crystal, and FRONTIER (ASA token) are core game resources.
- **FRONTIER Token Economy**: A 1 billion supply ASA token earned passively per owned plot, with biome-based earning rates. Claiming is an on-chain transaction.
- **Land Purchase**: Plots are purchased with ALGO, with biome-based pricing, requiring an on-chain transaction.
- **Game Actions**: Players can Mine, Upgrade, Build, Attack, Purchase land, Claim FRONTIER, and Collect All resources.
- **Improvements System**: Includes Turrets, Shield Generators, Mining Drills, Storage Depots, Radar Arrays, and Fortresses, each with specific defense, yield, or capacity benefits.
- **AI Factions**: Four distinct AI factions (NEXUS-7, KRONOS, VANGUARD, SPECTRE) with varying strategic behaviors, using spatial proximity for neighbor detection.
- **Commander Avatar System**: Players can mint multiple commander avatars (Sentinel, Phantom, Reaper) by burning FRONTIER tokens. Commanders provide ATK/DEF bonuses and special abilities.
- **Special Attacks**: Commanders enable unique abilities like Orbital Strike, EMP Blast, Siege Barrage, and Sabotage, costing FRONTIER and having cooldowns.
- **Recon Drones**: Players can deploy drones to scout enemy territory.
- **Gamertag System**: New players choose a gamertag validated server-side.
- **Orbital Satellites**: Animated surveillance satellites orbit the globe.

## External Dependencies

- **Blockchain**: Algorand TestNet (chainId: 416002, genesisID: testnet-v1.0)
- **Wallets**: Pera Wallet, LUTE Wallet
- **Algorand Endpoints**:
    - Algod: `https://testnet-api.algonode.cloud`
    - Indexer: `https://testnet-idx.algonode.cloud`
- **Algorand SDK**: `algosdk`
- **Wallet Connectors**: `@perawallet/connect`, `lute-connect`
- **Frontend Framework**: React 18
- **TypeScript**: For type safety
- **Build Tool**: Vite
- **Styling Framework**: TailwindCSS
- **3D Graphics**: Three.js, `@react-three/fiber`, `@react-three/drei`
- **Backend Framework**: Node.js, Express
- **Query Management**: React Query