# FRONTIER-AL: True Player Freedom + Real Consequence Engine
## Status: BACKLOG — Version 2.0 Concept

## Context

FRONTIER-AL is a persistent 3D planetary strategy game with 21,000 land plots, blockchain-backed NFT ownership on Algorand, 4 autonomous AI factions, and seasonal competition. Players currently have solid sandbox freedom (mine, build, attack, trade) but lack:
- **Identity** — who you ARE as a player (beyond just Commander choice)
- **Political agency** — formal alliances, treaties, governance
- **Deep consequences** — ripple effects, lasting legacy, world-shaping impact
- **Narrative resonance** — the world doesn't remember or react to your deeds
- **Economic depth** — no corporations, cartels, debt, or infrastructure ownership

This plan introduces **6 interlocking systems** that transform FRONTIER-AL into a game where every choice echoes — across territory, economy, politics, and lore.

---

## System 1: Player Archetype System

**What it is**: Each player chooses one of 8 deep archetypes at season start. The archetype defines who you ARE — exclusive mechanics, tradeoffs, and interaction rules with other archetypes.

| Archetype | Philosophy | Exclusive Mechanic | Gains | Sacrifices |
|---|---|---|---|---|
| **WARLORD** | Territory through force | Multi-front war declarations, battle formations | +20% attack power, "Total War" declaration (3x pillage) | -25% yield, cannot found corporations |
| **MERCHANT** | Wealth through trade | Found corporations, set market taxes, debt instruments | Trade fee income from Market Hubs, cartel access | -15% attack, defense-only combat |
| **ARCHITECT** | Shape the world itself | Terraform actions, relay networks, landmark upgrades | +30% infrastructure build speed, world-vote proposals | Highest resource costs, no raiding |
| **DIPLOMAT** | Power through relationships | Draft server-enforced treaties, double-weight world votes, federation charters | Betrayal detection passive (1h warning) | Reputation decay 2x, betrayal penalty permanent |
| **PROPHET** | Knowledge is power | 3x drone duration, intercept trade orders, predict orbital events 30min early | Auction intel to highest bidder | No combat bonuses, +50% resource cost for direct attacks |
| **SABOTEUR** | Chaos as strategy | Covert improvement corruption, plant false trade orders, false-flag attacks | 40% chance undetected ops, Phantom Commander synergy | Max 12 plots, no fortress building |
| **SOVEREIGN** | Rule through governance | Declare player-governed Regions (20+ contiguous plots), set taxes/laws | Tax income from region players, veto on regional world votes | Must maintain 60% approval rating |
| **SCAVENGER** | Thrive where others burn | 2x pillage on abandoned plots (7+ days unowned), disaster-site 3x mining | No attack cooldown after abandoned plot raids | Max 2 alliances, other archetypes share less intel |

**New files:**
- `server/engine/archetypes/archetypeEngine.ts` — perk resolution, bonus application
- `server/engine/archetypes/types.ts` — ArchetypeDefinition interfaces
- `shared/archetypes.ts` — archetype constants, perk trees

**New DB tables:** `player_archetypes` (id, playerId, archetype, seasonId, prestige, archetypeXp, perks)
**Modify:** `players` table — add `archetypeId`, `reputationScore` (0-1000, default 500)

---

## System 2: Real Consequence Engine

**What it is**: A 4-layer cascade that makes every action echo across time.

### Layer 1 — Immediate
- Battle outcomes already exist; extend `BattleResult` with `consequenceLog`
- New: "Decisive Victory" (>2x power) → next attack this session costs 50% less resources

### Layer 2 — Ripple (30-min propagation)
- After any plot capture: run `propagateConsequences()` — adjacent friendly plots get +10% yield (morale), loser's adjacent plots get cascade defense penalty (already exists, extend it)
- 5+ captures in same biome within 24h → "Contested Zone" biome-wide debuff fires

### Layer 3 — Legacy (persists across seasons)
- Season-end snapshot assigns permanent **Titles** (e.g. "The Conqueror", "The Betrayer", "The Builder")
- Titles are cosmetic + minor permanent stat buff

### Layer 4 — World-Shaping (collective threshold triggers)
- 30+ players mine same biome in 7 days → Biome Depletion Event (richness -20% permanently)
- 10+ Warlords declare war same season → "Age of War" global modifier (+10% attack, -10% yield)
- 500+ FRONTIER burned in one day → Token Burn Event supply scarcity bonus

### Reputation System
- Range 0–1000, starts at 500
- Key deltas: betray ally (-150), honor treaty (+25), false-flag revealed (-200), terraform biome (+50)
- Gate below 200: cannot join federations, "Dishonorable" badge
- Gate above 800: "Renowned" — passive +5 plot defense, better trade rates
- AI factions react: KRONOS never initiates against >700 rep players

**New files:**
- `server/engine/consequences/propagate.ts`
- `server/engine/consequences/reputation.ts`
- `server/engine/consequences/worldThreshold.ts`
- `server/engine/consequences/legacyAward.ts`

**New DB tables:** `consequence_log`, `regional_pressure`, `player_legacy`

---

## System 3: Political Freedom System

**What it is**: Formal political structures with server-enforced rules.

### Political Entities
- **Alliances** — 2-8 players, non-aggression + resource sharing
- **Federations** — 3-20 players, shared governance, mutual defense
- **Empires** — 1 Sovereign + vassals, hierarchical tax flow

### Treaty Enforcement
Treaties are **server-enforced constraints** — not honor-based. A signed NAP means the server rejects the attack request with `TREATY_VIOLATION_BLOCKED`. To break it:
1. Player explicitly breaks treaty
2. Reputation -150 fires
3. Global broadcast: "PLAYER X has betrayed ALLIANCE Y"
4. 72-hour alliance lockout
5. Betrayed party gets "Righteous War" buff (+20% attack against betrayer for 48h)

### Player-Governed Regions (Sovereign archetype)
- Sovereign with 20+ contiguous plots declares a Region
- Sets: entry tax (% of resources mined by non-citizens), war status, citizen laws
- Laws are JSON-encoded server-validated passive modifiers (e.g. "no turrets above level 2")

### World Voting
- 50 FRONTIER to submit a proposal
- 72h voting period, simple majority of active players (logged in last 7 days)
- Diplomats cast 2 votes
- Types: `terraform_biome`, `declare_world_event`, `extend_season`, `open_new_region`, `ban_player_vote`

**New files:**
- `server/engine/politics/allianceEngine.ts`
- `server/engine/politics/treatyEnforcer.ts` — called by `routes.ts` before attack processing
- `server/engine/politics/voteEngine.ts`
- `server/engine/politics/regionGovernor.ts`

**New DB tables:** `political_entities`, `treaties`, `world_votes`, `regions`

---

## System 4: Emergent Narrative Engine

**What it is**: The world remembers. Player deeds become permanent lore.

### Chronicle System (4 tiers)
- `FOOTNOTE` — stored, not broadcast
- `NOTABLE` — broadcast to nearby players
- `HISTORIC` — global broadcast, stored in Chronicle feed
- `LEGEND` — permanent lore entry, player enters Hall of Legends

**Auto-triggered events:**
- First colonist, first betrayal, first 100-plot empire, first landmark claimed → HISTORIC
- Player losing all plots in one day (tragic arc), defeating all 4 AI factions → LEGEND candidates
- `chronicleDetector.checkForChronicle(event)` called after every significant action (same pattern as existing `appendWorldEvent`)

### Legends System
When a Legend deed fires:
1. `legendTitle` field populated on player record
2. Permanent `chronicle_entries` row created (never deleted)
3. Player appears in "Hall of Legends" UI panel
4. Plot globe aura (gold shimmer) on owned plots
5. AI factions react — NEXUS-7 preferentially targets Legends to "prove dominance"

### Prophecy System
Server broadcasts upcoming crises 24–48h before they fire:
- "The volcanic biome grows restless" → 48h before Biome Pressure Event
- "A shadow fleet approaches sector 7" → VANGUARD AI raid incoming
- "The Crystal Veins are fracturing" → Crystal biome depletion incoming
- Prophets receive these 30 minutes earlier, can sell the intel

**New files:**
- `server/engine/narrative/chronicleDetector.ts`
- `server/engine/narrative/prophecyEngine.ts`
- `server/engine/narrative/legendRegistry.ts`

**New DB tables:** `chronicle_entries` (extends existing `game_events`), `prophecies`

---

## System 5: Economic Freedom

**What it is**: Player-founded corporations, cartels, debt instruments, and infrastructure ownership.

### Corporations (Merchant archetype)
- Up to 5 members, shared treasury (all resource types)
- Members pledge % of their yield to corporate treasury
- Corporations build Infrastructure that individual players cannot
- Issues dividends based on contribution score

### Resource Cartels
- A Corporation controlling >40% of a single resource in a biome can declare a Cartel
- Server enforces floor price on trades (rejects orders below floor from cartel members)
- Other players can organize counter-coalitions
- Cartel declaration requires a World Vote (public, transparent)

### Debt/Credit System
- P2P loans: lender specifies amount, resource type, deadline, interest (0-50%), collateral (plot ID)
- Default: collateral plot auto-transfers to lender (server-enforced)
- Debt status publicly visible on player profile

### Infrastructure Ownership
Built by Architect archetype and Corporations:
- **Market Hub** (500 Iron, 300 Fuel, 200 Crystal, 1000 FRNTR): 3% fee on trades in 3x3 zone
- **Relay Network** (100 Iron, 50 Fuel, 50 FRNTR per node): -10% mine cooldown along relay, resource flow automation
- **Road** (200 Iron, 100 Fuel): -15% attack travel cost between owned plots

**New files:**
- `server/engine/economy/corporationEngine.ts`
- `server/engine/economy/cartelEngine.ts`
- `server/engine/economy/debtEngine.ts`
- `server/engine/economy/infrastructureEngine.ts`

**New DB tables:** `corporations`, `cartels`, `debt_contracts`, `infrastructure`

---

## System 6: Freedom to Reshape the World

**What it is**: The most radical freedom — collective player action permanently alters the planet.

### Terraforming (Architect archetype + World Vote required)
1. Architect proposes terraform targeting 5+ contiguous plots
2. 72h World Vote
3. If passed: a Terraform Project opens requiring pooled resource contributions from all participants
4. Progress visible on globe as biome color-shift animation
5. When threshold reached: biome changes **permanently** (persists across seasons)
6. Partial funding (50-99%): "Transitional" biome state with mixed bonuses

### Planetary Disasters
Triggered by collective player behavior, announced via Prophecy System:
- **Biome Depletion** — 30+ players mine same biome in 7 days → richness -20% permanent
- **Volcanic Eruption** — 5+ Warlords war in volcanic biome → 48h all plots -50% defense
- **Resource Collapse** — cartel hoards >60% of one resource → production halves 2 weeks
- **Dimensional Rift** — World Vote opens rift → new rare mineral deposit appears, 3 plots become uninhabitable for 1 season
- **Avert mechanic**: Players pool resources before fire time to prevent disaster; contributors gain reputation + Chronicle entry

### Sealed Zones
- Two hidden zones of ~500 plots each, pre-generated but invisible on globe
- A World Vote can open a Sealed Zone:
  - 500 plots reveal with animated globe animation
  - 2x richness, no existing defenses
  - 72h land rush, then normal purchase rules
  - Unique "Void" biome — highest dark matter concentration

**New files:**
- `server/engine/world/terraformEngine.ts`
- `server/engine/world/disasterEngine.ts`
- `server/engine/world/sealedZoneManager.ts`

**New DB tables:** `terraform_projects`, `planetary_disasters`, `sealed_zones`
**Modify `parcels` table**: add `terraformState`, `originalBiome`, `disasterHazardUntil`, `sealedZoneId`

---

## Integration Points (Existing Files Modified)

### `server/routes.ts`
- Add pre-check: `treatyEnforcer.checkViolation(attackerId, targetOwnerId)` before attack processing
- Add `chronicleDetector.checkForChronicle(event)` after significant actions
- Add new route groups:
  - `POST /api/archetypes/choose` + `GET /api/archetypes/:playerId`
  - `POST /api/politics/alliance/create`, `/treaty/sign`, `/treaty/break`, `/region/declare`, `/vote/submit`, `/vote/cast`
  - `POST /api/economy/corporation/found`, `/cartel/declare`, `/debt/issue`, `/infrastructure/build`
  - `POST /api/world/terraform/propose`, `/disaster/avert`
  - `GET /api/chronicle/entries`, `/chronicle/legends`, `/prophecies/active`

### `server/engine/battle/types.ts`
Add optional fields to `BattleInput`:
```typescript
archetypeAttackBonus?: number;   // WARLORD archetype
archetypePenalty?: number;       // MERCHANT archetype
treatyBlocked?: boolean;         // from treatyEnforcer pre-check
```

### `server/engine/season/manager.ts`
Add season-end hooks:
- `legacyAward.processSeasonEnd(seasonId)` → assign permanent titles
- `chronicleDetector.recordSeasonLegends(seasonId)` → mint Legend entries
- `cartelEngine.expireCartels(seasonId)` → cartels reset each season

### `shared/schema.ts`
Add new types: `ArchetypeType`, `PoliticalEntityType`, `TreatyType`, `ChronicleEntryTier`, `DisasterType`, `InfrastructureType`
Extend `GameState` with: `activePoliticalEntities`, `activeTreaties`, `activeDisasters`, `activeProphecies`, `openWorldVotes`, `chronicleRecent`

---

## New UI Components

All follow existing React component patterns in `client/src/components/`:

- `archetypes/ArchetypeChooser.tsx` — season-start modal
- `politics/AlliancePanel.tsx`, `TreatyModal.tsx`, `VotingBooth.tsx`, `RegionDeclarer.tsx`
- `economy/CorporationDashboard.tsx`, `DebtMarket.tsx`, `InfrastructureBuilder.tsx`
- `narrative/ChroniclePanel.tsx`, `ProphecyAlert.tsx`, `LegendHall.tsx`
- `world/TerraformProgress.tsx`, `DisasterAlert.tsx`, `SealedZoneReveal.tsx`
- `reputation/ReputationBadge.tsx`, `ReputationHistory.tsx`

Globe rendering extensions (existing globe component):
- Political entity territory overlays using `flagColor`
- Terraform transition animations on `terraformState = 'transitional'` parcels
- Red pulsing overlay on disaster hazard zones
- Grayed sealed zone outlines until revealed

---

## Implementation Sequencing

**Phase 1 — Foundation** (DB + types, no breaking changes)
1. Drizzle migrations for all new tables + additive columns on `players`/`parcels`
2. New types in `shared/schema.ts` + `shared/archetypes.ts`
3. `archetypeEngine.ts` + `/api/archetypes/choose` route
4. Basic reputation system (score storage + delta calculation)

**Phase 2 — Politics + Consequences**
1. `treatyEnforcer.ts` — wire into existing attack route as pre-check
2. `allianceEngine.ts` + basic alliance routes
3. `propagate.ts` — wire into existing battle resolution route
4. `chronicleDetector.ts` — wire into existing `appendWorldEvent` flow

**Phase 3 — Economics**
1. `corporationEngine.ts` + corporation routes
2. `debtEngine.ts` + debt market routes
3. `infrastructureEngine.ts` + build routes + Market Hub fee injection into trade execution

**Phase 4 — Narrative**
1. `prophecyEngine.ts` — extend season manager tick loop
2. `legendRegistry.ts` — wire into chronicle detector
3. Chronicle + Prophecy + Legend UI components

**Phase 5 — World Reshaping**
1. `terraformEngine.ts` + world vote integration
2. `disasterEngine.ts` — add to consequence threshold tracker
3. `sealedZoneManager.ts` + globe reveal animation
4. Full world UI component suite

**Phase 6 — Polish + Balance**
1. Archetype interaction matrix testing (especially Warlord vs. Diplomat vs. Saboteur)
2. Reputation economy balance (delta magnitudes)
3. Cartel anti-monopoly safeguards
4. Globe visualization for all new systems

---

---

## Execution Note

This entire document is a **v2.0 backlog concept**. No implementation is happening now. When ready to build, the recommended start point is Phase 1 (DB migrations + types only — zero breaking changes to existing gameplay). Each phase is independently deliverable.

---

## Verification

- Archetype choice: `POST /api/archetypes/choose` returns archetype object; attacking as MERCHANT returns 403
- Treaty enforcement: Sign NAP, attempt attack → `TREATY_VIOLATION_BLOCKED`; explicit break → reputation delta broadcast
- Consequence propagation: Win battle → adjacent friendly plots show +10% yield in game state within 30 min
- Chronicle: First player to 100 plots triggers HISTORIC event broadcast via WebSocket
- Reputation gates: Player at 150 rep cannot POST to `/api/politics/alliance/create`
- Terraform: World Vote passes → `terraform_projects` row created; resource contributions update progress; parcel `biome` field changes on completion
- Disaster avert: `planetary_disasters.avertProgress` increments with each contribution; if threshold met before `firesAt`, `averted = true`
- Sealed Zone: World Vote opens zone → `sealed_zones.status = 'open'` → WebSocket broadcasts globe reveal event
