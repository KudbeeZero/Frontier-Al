# FRONTIER-AL — Development Roadmap

> Full development roadmap covering infrastructure, new features, and visual polish.
> Organized by phase with sub-categories for each work stream.

---

## Current State (March 2026)

The game is fully playable. Core systems are live:

- **3D Globe** — WebGL planetary map with 500+ parcels, biome coloring, ownership overlays
- **Sub-Parcel System** — 3×3 grid per plot; purchase, improve, and trade individual sub-parcels
- **Commander NFTs** — Three tiers (Sentinel / Phantom / Reaper) minted as Algorand ASAs; horizontal card UI in Commander window with live cooldown countdown
- **AI Companions** — Iron Wolf 🐺 (Sentinel), Shadow Fox 🦊 (Phantom), Apex Raptor 🦅 (Reaper) — cosmetic companions shown on commander cards and in battle results
- **Commander Window as Battlefront Hub** — All attack functionality (plot attacks + sub-parcel attacks) consolidated in the Commander window; Battlefront panel with sub-parcel 3×3 target picker
- **Independent Sub-Parcel Battles** — Attack/defend individual sub-parcels via `POST /api/sub-parcels/:id/attack`; ownership transfers on win
- **Reconquest** — Winning a macro-plot battle bulk-transfers defender-owned sub-parcels to attacker; third-party sub-parcels untouched
- **Sub-Parcel Trading** — List/cancel/buy sub-parcels via Trade Station "Parcels" tab and LandSheet "List for Sale" UI
- **Real Biome in World Events** — Biome strings resolved server-side; no more "unknown" in event feeds
- **Recharts Data Visualizations** — EconomicsPanel now shows live Recharts PieChart (token distribution); AreaChart in EconomicsPanel and `/info/economics` landing page
- **Multi-Page Landing Site** — Pre-game informational site: `/` (home), `/info/economics`, `/info/gameplay`, `/info/features` — all with animated starfield, live data charts, and full navigation
- **Resource Economy** — Iron, Fuel, Crystal passive generation; biome-specific cost multipliers; 4-way FRONTIER revenue split on all transactions
- **Trade Station** — Player-to-player resource + sub-parcel marketplace
- **AI Factions** — Persistent AI opponents; claim, build, and attack autonomously

---

## Phase Overview

| Phase | Focus | Status |
|-------|-------|--------|
| [Phase 1](#phase-1-foundation-polish) | Foundation Polish | ✅ Complete |
| [Phase 2](#phase-2-rare-minerals--loot-system) | Rare Minerals & Loot System | 🚧 In Progress |
| [Phase 3](#phase-3-landmarks) | Landmarks | Planned |
| [Phase 4](#phase-4-season-expansion) | Season Expansion | Planned |
| [Phase 5](#phase-5-sub-parcel-depth) | Sub-Parcel Depth | ✅ Complete |
| [Phase 6](#phase-6-visual-polish) | Visual Polish | Planned |
| [Phase 7](#phase-7-community--season-systems) | Community & Season Systems | Planned |

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

## Phase 5: Sub-Parcel Depth ✅

> Expand the sub-parcel system with trading, improvements, independent battles, and better visuals.

### 5.1 Sub-Parcel Trading ✅

- [x] Sub-parcel listing in Trade Station (Parcels tab)
- [x] List for Sale UI in LandSheet with price input
- [x] Cancel Listing from LandSheet
- [x] Buy sub-parcel via Trade Station table
- [x] FRONTIER token transfer on purchase (atomic DB transaction)
- [x] Sub-parcel pricing model by biome and position (`purchasePriceFrontier` + 4-way revenue split)
- [x] Transfer ownership API endpoints (`/api/sub-parcels/listings` CRUD)

### 5.2 Sub-Parcel Improvements ✅

- [x] Individual sub-parcel defense improvements (`POST /api/sub-parcels/:id/build`)
- [x] Sub-parcel-specific facility bonuses (electricity, blockchain_node, data_centre, ai_lab)
- [x] Biome-based cost multipliers for all improvement types (`BIOME_UPGRADE_DISCOUNTS` in schema)
- [x] Biome discount/premium UI indicators in `SubParcelUpgradePanel`
- [x] Affordability enforcement in Buy button + upgrade buttons
- [x] Independent sub-parcel battles (`POST /api/sub-parcels/:id/attack`)
- [x] Defense inheritance from parent plot (sub-parcels use defenseLevel: 1 as base)

### 5.3 Sub-Parcel Visuals ✅

- [x] Sub-parcel detail panel in LandSheet (table + upgrade panel)
- [x] Biome badge in upgrade panel header
- [ ] 3×3 grid overlay on globe (zoom-dependent visibility) — deferred to Phase 6

### 5.4 Sub-Parcel Balance ✅

- [x] Cost scaling by biome — `BIOME_UPGRADE_DISCOUNTS` (discounts up to 35%, premiums up to 50%)
- [x] Full control bonus verification (+50% yield when owning all 9)
- [x] AI faction interaction with sub-parcels (AI cannot subdivide — enforced)
- [x] Reconquest behavior: attacker wins macro-plot → defender's sub-parcels bulk-transfer to attacker; third-party sub-parcels untouched

### 5.5 Blockchain & Live World Integration ✅

- [x] WebSocket broadcast on sub-parcel purchase (`sub_parcel_purchased` event)
- [x] WebSocket broadcast on sub-parcel upgrade (`sub_parcel_upgraded` event)
- [x] Upstash Redis world event stream for purchases + upgrades (`recordSubParcelWorldEvent`)
- [x] Algorand on-chain upgrade note recording (`server/services/chain/upgrades.ts`)
- [x] 4-way FRONTIER revenue split on purchase (30% treasury, 20% faction, 30% land tax, 20% burned)
- [x] Real biome strings in all world events (no more "unknown")

### 5.6 Commander & Battle UX ✅

- [x] Commander Window as Battlefront Hub — all attack functionality consolidated
- [x] Horizontal commander card strip with live countdown timers
- [x] AI Companion system: Iron Wolf 🐺 / Shadow Fox 🦊 / Apex Raptor 🦅 per tier
- [x] Sub-parcel 3×3 target picker in Battlefront panel
- [x] Battle result card with companion flavor message inline in Commander window

### 5.7 Data Visualizations ✅

- [x] Recharts PieChart in EconomicsPanel (token distribution)
- [x] Recharts AreaChart in `/info/economics` landing page (supply + burn trend)

### 5.8 Multi-Page Landing Site ✅

- [x] `/info/economics` — live FRNTR data, pie chart, area chart, stat cards, earn mechanics
- [x] `/info/gameplay` — game loop steps, commander tier table with companions, sub-parcel SVG diagram, season phases
- [x] `/info/features` — deep-dive feature cards (3D Globe, AI Factions, Algorand, Territory Wars, Resource Economy, Commander NFTs)
- [x] Shared `LandingNav` across all pages; "Enter Game →" CTA throughout

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
- [ ] Responsive polish: commander card snap-x scroll, landing page flex-col/flex-row, touch-action on all interactive cells

---

## Phase 7: Community & Season Systems

> Guild wars, seasonal sieges, leaderboard seasons, and social features.

### 7.1 Guilds

- [ ] Define guild schema: name, tag, leader, members, treasury
- [ ] Guild creation / invite / leave API endpoints
- [ ] Guild-shared resource pool and FRONTIER treasury
- [ ] Guild vs. Guild war declarations
- [ ] Guild leaderboard on landing site

### 7.2 Seasonal Sieges

- [ ] Designated siege zones per season (rotating map regions)
- [ ] Enhanced rewards for capturing siege zone parcels
- [ ] Siege-specific AI faction aggression
- [ ] Siege event broadcast to all connected clients

### 7.3 Leaderboard Seasons

- [ ] Season-scoped leaderboard (reset each season)
- [ ] All-time leaderboard (preserved across seasons)
- [ ] Top-player profiles with season history
- [ ] Season replay summary (top battles, most territory gained)

### 7.4 Social Features

- [ ] In-game messaging (parcel-to-parcel challenges)
- [ ] Battle replay sharing (shareable replay link)
- [ ] Commander showcase (public profile of minted NFTs)

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
| `feature/community` | Phase 7 — Guilds + leaderboard seasons | main |

### Key Principle

Each phase should result in a **stable, deployable build**. No phase should leave the game in a broken state. Test thoroughly after each branch merge.

### Dependencies

```
Phase 1 (Foundation) → Independent, do first
Phase 2 (Minerals)   → Independent of Phase 1
Phase 3 (Landmarks)  → Depends on Phase 2 (rare minerals as landmark costs)
Phase 4 (Seasons)    → Depends on Phase 3 (Orbital Dome integration)
Phase 5 (Sub-Parcels) → ✅ Complete
Phase 6 (Visuals)    → Depends on Phase 1 (globe refactor)
Phase 7 (Community)  → Depends on Phase 4 (Season systems)
```

---

*FRONTIER-AL Roadmap — Last updated March 2026*
