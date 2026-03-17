# FRONTIER-AL — Development Roadmap

> Full development roadmap covering infrastructure, new features, and visual polish.
> Organized by phase with sub-categories for each work stream.

---

## Phase Overview

| Phase | Focus | Status |
|-------|-------|--------|
| [Phase 1](#phase-1-foundation-polish) | Foundation Polish | Current |
| [Phase 2](#phase-2-rare-minerals--loot-system) | Rare Minerals & Loot System | Planned |
| [Phase 3](#phase-3-landmarks) | Landmarks | Planned |
| [Phase 4](#phase-4-season-expansion) | Season Expansion | Planned |
| [Phase 5](#phase-5-sub-parcel-depth) | Sub-Parcel Depth | **In Progress** |
| [Phase 6](#phase-6-visual-polish) | Visual Polish | Planned |

---

## Phase 1: Foundation Polish

> Stabilize the codebase and refactor critical components before adding new features.

### 1.1 PlanetGlobe.tsx Refactor

Refactor the monolithic `PlanetGlobe.tsx` into focused, modular components.

**Target Structure:**

```
client/src/components/game/globe/
├── PlanetGlobe.tsx        → Orchestrator (~200 lines), wires props + renders children
├── GlobeParcels.tsx        → InstancedMesh creation, parcel transforms, setColorAt
├── GlobeAtmosphere.tsx     → Atmosphere shader and rendering
├── GlobeCloudLayer.tsx     → Cloud layer rotation and rendering
├── GlobeSelection.tsx      → Hover/selection state and visual feedback
└── GlobeEvents.tsx         → Event overlays (battles, orbital, commanders)

client/src/lib/globe/
├── globeTypes.ts           → ParcelVisualState, WorldZone, OwnershipType, ResourceType
├── globeConstants.ts       → Blend weights, pulse speeds, emissive strengths, border intensities
├── biomeColors.ts          → Biome → color mapping
├── ownershipColors.ts      → Owner → faction color mapping
├── activityColors.ts       → Battle pulse, mining pulse, launch pulse, commander pulse
├── resourceColors.ts       → Resource density visualization colors
├── eventColors.ts          → Storm glow, black hole glow, incursion flash, arena pulse
├── parcelVisualState.ts    → Convert raw game state → render-ready visual state
├── computeParcelColor.ts   → Five-layer blending: terrain + ownership + activity + resource + event
├── getActivityColor.ts     → Activity-specific color computation
├── getEventColor.ts        → Event-specific color computation
└── getResourceColor.ts     → Resource density color computation

client/src/hooks/
├── useGlobeInteractions.ts → Click, hover, selection handlers
├── useParcelAnimation.ts   → Parcel animation timing and interpolation
└── useGlobeCamera.ts       → Camera positioning, zoom, rotation
```

**Responsibilities:**

| Module | What Goes In |
|--------|-------------|
| `PlanetGlobe.tsx` | Scene container, prop wiring, child mounting. Orchestrator only. |
| `GlobeParcels.tsx` | InstancedMesh creation, parcel transforms, color updates, instance loop |
| `computeParcelColor.ts` | Five-layer blend: terrain + ownership + activity + resource + event weights |
| `getActivityColor.ts` | Battle pulse, mining pulse, launch pulse, commander pulse |
| `getEventColor.ts` | Storm glow, black hole glow, incursion flash, arena season pulse |
| `parcelVisualState.ts` | Convert raw game state → render-ready parcel visual state |
| `globeConstants.ts` | Blend weights, pulse speeds, emissive strengths, cloud rotation speed |

**Architecture Pattern:**

```
raw game state
→ parcelVisualState builder
→ computeParcelColor
→ GlobeParcels InstancedMesh update
→ optional event/selection overlays
```

**Sub-tasks:**
- [ ] Identify all current responsibilities in PlanetGlobe.tsx
- [ ] Extract pure logic (colors, constants, types) into `lib/globe/`
- [ ] Extract rendering sub-components (atmosphere, clouds, events)
- [ ] Extract interaction hooks (click, hover, camera)
- [ ] Verify no increase in draw calls
- [ ] Ensure InstancedMesh performance is maintained
- [ ] Reduce PlanetGlobe.tsx to 150–250 lines

### 1.2 Code Quality

- [ ] Audit and fix TypeScript strict mode warnings
- [ ] Remove unused imports and dead code
- [ ] Standardize error handling patterns across API routes
- [ ] Add missing Zod validation on remaining endpoints

### 1.3 Performance

- [ ] Profile InstancedMesh rendering at 21,000 instances
- [ ] Optimize WebSocket state diff broadcasting (send only changes)
- [ ] Audit TanStack Query cache invalidation patterns
- [ ] Review DB query performance for leaderboard computations

---

## Phase 2: Rare Minerals & Loot System

> Add new resource types and a reward system to deepen the economy.

### 2.1 Rare Mineral Types

- [ ] Define Xenorite, Void Shard, Plasma Core, Dark Matter in `schema.ts`
- [ ] Add biome-specific drop rate constants
- [ ] Add rare mineral vault storage (50 cap per type, separate from standard storage)
- [ ] Update mine action handler to roll for rare mineral drops
- [ ] Add Dark Matter drop trigger during orbital impact events
- [ ] Update player schema with rare mineral inventory fields
- [ ] Add DB migration for rare mineral columns

### 2.2 Loot Box System

- [ ] Define loot box tiers (Common, Rare, Epic, Legendary) in `schema.ts`
- [ ] Define drop tables with weighted random rewards per tier
- [ ] Add loot box inventory (max 20 unopened)
- [ ] Add drop triggers: mine action, battle victory, orbital impact event
- [ ] Create loot box opening API endpoint
- [ ] Add Legendary box crafting via Quantum Forge (Phase 3 dependency)
- [ ] DB migration for loot box inventory table

### 2.3 UI Components

- [ ] Rare mineral display in Resource HUD
- [ ] Rare mineral vault panel in Inventory
- [ ] Loot box inventory panel
- [ ] Loot box opening animation (animated reveal sequence)
- [ ] Drop notification toasts (with tier-appropriate styling)
- [ ] Mineral drop rate display in plot detail panel

### 2.4 Trading Integration

- [ ] Add rare mineral types to `TradeResource` union
- [ ] Update trade order schema to support mineral trades
- [ ] Add mineral trade UI in Trade Station

---

## Phase 3: Landmarks

> Four unique mega-structures that provide powerful, game-changing effects.

### 3.1 Landmark System Core

- [ ] Define landmark types and properties in `schema.ts`
- [ ] Add landmark construction prerequisites (plot count, facility requirements)
- [ ] Add per-player landmark limit tracking
- [ ] Create landmark construction API endpoint
- [ ] DB migration for landmarks table
- [ ] Add landmark ownership to player/parcel schemas

### 3.2 The Launchpad

- [ ] Implement satellite/drone cost reduction (-50%)
- [ ] Implement max slot increases (+1 satellite, +2 drones)
- [ ] Implement Deep Space Probe (24h cooldown, 5-plot radius reveal, 2h duration)
- [ ] Add probe deploy API endpoint and cooldown tracking

### 3.3 Orbital Alien Dome

- [ ] Implement server-wide singleton constraint (first to build claims it)
- [ ] Implement +100% FRNTR generation during active season
- [ ] Implement +10% defense bonus for nearby players (3-plot radius)
- [ ] Integrate with season end reward distribution (+5% bonus)
- [ ] Add Season Leaderboard hologram data endpoint

### 3.4 Quantum Forge

- [ ] Implement rare mineral refining (10:3 conversion ratio)
- [ ] Implement Legendary loot box crafting (48h cooldown)
- [ ] Implement +30% Crystal mining yield on forge plot
- [ ] Add refining and crafting API endpoints

### 3.5 Ancient Relay

- [ ] Implement instant resource teleport (collect all from any plot, anywhere)
- [ ] Implement +2 FRNTR/day passive generation
- [ ] Implement -25% attack cooldown for attacks from relay plot
- [ ] Implement Phantom commander detection (4-plot radius)

### 3.6 Landmark Visuals

- [ ] 3D landmark models for globe rendering
- [ ] Landmark construction animation
- [ ] Landmark glow effects on globe

---

## Phase 4: Season Expansion

> Deeper seasonal mechanics with three distinct phases and enhanced rewards.

### 4.1 Season Phases

- [ ] Implement three-phase season structure (Expansion/Conflict/Domination)
- [ ] Expansion Phase modifiers: -20% land prices, 2x welcome bonus
- [ ] Conflict Phase modifiers: -25% attack cooldown, 40% pillage rate, 2x orbital events
- [ ] Domination Phase modifiers: +50% global FRNTR, leaderboard lock at 24h
- [ ] Phase transition broadcast notifications (to all connected clients)
- [ ] Phase indicator in UI (countdown timer, phase name, active modifiers)

### 4.2 Season Rewards

- [ ] Implement top-10 reward distribution (30/20/12/8/6/5/5/5/5/4%)
- [ ] Season-exclusive cosmetic titles
- [ ] Season badges for top performers
- [ ] Season history and statistics tracking
- [ ] Post-season summary panel

### 4.3 Countdown System

- [ ] 24h / 6h / 1h countdown broadcast warnings
- [ ] Final 24h leaderboard position lock
- [ ] Season end ceremony animation

### 4.4 Dome Integration

- [ ] Orbital Alien Dome bonus activation during Domination phase
- [ ] Dome owner receives 5% of season reward pool
- [ ] Dome visual changes per season phase
- [ ] Season Nexus hologram updates with live leaderboard data

---

## Phase 5: Sub-Parcel Depth

> Expand the sub-parcel system with trading, improvements, and better visuals.

### 5.1 Sub-Parcel Trading

- [ ] Sub-parcel transfer between players
- [ ] Sub-parcel listing in Trade Station
- [x] Sub-parcel pricing model by biome and position (`purchasePriceFrontier` + 4-way revenue split)
- [ ] Transfer ownership API endpoints

### 5.2 Sub-Parcel Improvements

- [x] Individual sub-parcel defense improvements (`POST /api/sub-parcels/:id/build`)
- [x] Sub-parcel-specific facility bonuses (electricity, blockchain_node, data_centre, ai_lab)
- [x] Biome-based cost multipliers for all improvement types (`BIOME_UPGRADE_DISCOUNTS` in schema)
- [x] Biome discount/premium UI indicators in `SubParcelUpgradePanel`
- [x] Affordability enforcement in Buy button + upgrade buttons
- [ ] Independent sub-parcel battles
- [ ] Defense inheritance rules from parent plot

### 5.3 Sub-Parcel Visuals

- [ ] 3×3 grid overlay on globe (zoom-dependent visibility)
- [ ] Sub-parcel ownership coloring on globe
- [x] Sub-parcel detail panel in LandSheet (3×3 table + upgrade panel)
- [x] Biome badge in upgrade panel header

### 5.4 Sub-Parcel Balance

- [x] Cost scaling by biome — `BIOME_UPGRADE_DISCOUNTS` (discounts up to 35%, premiums up to 50%)
- [x] Full control bonus verification (+50% yield when owning all 9)
- [x] AI faction interaction with sub-parcels (AI cannot subdivide — enforced)
- [ ] Reconquest behavior for subdivided plots

### 5.5 Blockchain & Live World Integration

- [x] WebSocket broadcast on sub-parcel purchase (`sub_parcel_purchased` event)
- [x] WebSocket broadcast on sub-parcel upgrade (`sub_parcel_upgraded` event)
- [x] Upstash Redis world event stream for purchases + upgrades (`recordSubParcelWorldEvent`)
- [x] Algorand on-chain upgrade note recording (`server/services/chain/upgrades.ts`)
- [x] 4-way FRONTIER revenue split on purchase (30% treasury, 20% faction, 30% land tax, 20% burned)

---

## Phase 6: Visual Polish

> Five-layer color blending, event effects, and landmark rendering.

### 6.1 Five-Layer Parcel Color System

- [ ] Layer 1: Terrain (biome-based base color)
- [ ] Layer 2: Ownership (faction/player color overlay)
- [ ] Layer 3: Activity (battle, mining, launch, commander pulses)
- [ ] Layer 4: Resource (density heat-map overlay)
- [ ] Layer 5: Event (storm, hazard, arena effects)
- [ ] Configurable blend weights per layer
- [ ] Performance profiling at 21,000 instances

### 6.2 Event Visual Effects

- [ ] Storm belt visuals (rotating hazard zone)
- [ ] Orbital travel markers (satellite/drone paths)
- [ ] Black hole glow effects
- [ ] Incursion flash for AI attacks
- [ ] Arena season pulse during Domination phase

### 6.3 Landmark 3D Models

- [ ] Launchpad model (rocket pad with launch effects)
- [ ] Orbital Alien Dome model (translucent dome with hologram interior)
- [ ] Quantum Forge model (glowing forge with particle effects)
- [ ] Ancient Relay model (crystal spire with energy beams)
- [ ] LOD system for landmarks (detail reduces at distance)

### 6.4 Sub-Parcel Rendering

- [ ] 3×3 grid line overlay (visible at medium zoom)
- [ ] Per-sub-parcel ownership colors
- [ ] Sub-parcel selection highlight
- [ ] Sub-parcel battle indicators

### 6.5 UI Polish

- [ ] Rare mineral icons and color coding
- [ ] Loot box tier visual styling (Common gray, Rare blue, Epic purple, Legendary gold)
- [ ] Landmark construction progress bar
- [ ] Season phase transition animations
- [ ] Enhanced battle resolution replay viewer

---

## Implementation Notes

### Branch Strategy

| Branch | Content | Merge Target |
|--------|---------|-------------|
| `feature/globe-refactor` | Phase 1.1 — PlanetGlobe modularization | main |
| `feature/rare-minerals` | Phase 2.1–2.2 — Mineral types + loot boxes | main |
| `feature/loot-ui` | Phase 2.3–2.4 — Loot box UI + trading | main |
| `feature/landmarks` | Phase 3 — All four landmarks | main |
| `feature/seasons-v2` | Phase 4 — Season phases + rewards | main |
| `feature/sub-parcels-v2` | Phase 5 — Sub-parcel depth | main |
| `feature/visual-polish` | Phase 6 — Color system + effects | main |

### Key Principle

Each phase should result in a **stable, deployable build**. No phase should leave the game in a broken state. Test thoroughly after each branch merge.

### Dependencies

```
Phase 1 (Foundation) → Independent, do first
Phase 2 (Minerals)   → Independent of Phase 1
Phase 3 (Landmarks)  → Depends on Phase 2 (rare minerals as landmark costs)
Phase 4 (Seasons)    → Depends on Phase 3 (Orbital Dome integration)
Phase 5 (Sub-Parcels) → Independent of Phases 2-4
Phase 6 (Visuals)    → Depends on Phase 1 (globe refactor)
```

---

*FRONTIER-AL Roadmap — Last updated March 2026*
