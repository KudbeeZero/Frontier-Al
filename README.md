# FRONTIER-AL — v1.5.0

<p align="center">
  <a href="GAME_MANUAL.md"><img src="https://img.shields.io/badge/📖_Game_Manual-Read_Now-blue?style=for-the-badge" alt="Game Manual"></a>
  <a href="STRATEGY_GUIDE.md"><img src="https://img.shields.io/badge/🎯_Strategy_Guide-Read_Now-green?style=for-the-badge" alt="Strategy Guide"></a>
  <a href="ROADMAP.md"><img src="https://img.shields.io/badge/🗺️_Roadmap-View-orange?style=for-the-badge" alt="Roadmap"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License"></a>
</p>

**A persistent globe-based strategy game powered by the Algorand blockchain.**

Players and AI factions compete for control of a shared 21,000-plot world map rendered as a 3D rotating planet. Mine resources, build defenses, launch attacks, mint Commander avatars, and earn FRONTIER (FRNTR) tokens on Algorand TestNet. Every plot purchase is recorded as a real Algorand ASA NFT. Every FRONTIER token claim triggers a live on-chain transfer.

---

## What's New in v1.5.0

- **Fix**: TypeScript configuration (`tsconfig.json`) hardened — `types` array now references only packages present in `node_modules`, preventing spurious `TS2688` errors in CI and fresh-clone environments.
- **Docs**: README completely rewritten to v1.5 with a full **Player Game Manual** — step-by-step walkthrough of a player's journey from first login through advanced endgame strategy.
- **Docs**: All biome yield tables updated with corrected Iron multipliers (Volcanic: +80%, Forest: +20%).
- **Docs**: Commander lock-time, satellite duration, and drone capacity limits verified against `shared/schema.ts` and `server/engine/`.

---

## Player Resources

| Document | Description |
|----------|-------------|
| [Game Manual](GAME_MANUAL.md) | Complete guide to every game system, mechanic, and feature — including rare minerals, loot boxes, landmarks, and seasons |
| [Strategy Guide](STRATEGY_GUIDE.md) | Beginner tips, advanced strategies, scenario playbooks, and quick reference tables |
| [Development Roadmap](ROADMAP.md) | Full development roadmap with 6 phases covering infrastructure, new features, and visual polish |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTIER-AL v1.5.0                       │
├──────────────┬──────────────────────┬───────────────────────┤
│   Frontend   │       Backend        │      Blockchain       │
│  React/Vite  │  Express / Node.js   │  Algorand TestNet     │
│  Three.js    │  Drizzle / Postgres  │  AlgoSDK v3           │
│  AlgoSDK     │  storage.ts engine   │  Pera + LUTE wallets  │
└──────────────┴──────────────────────┴───────────────────────┘
```

### Shared Global World
- One canonical 21,000-plot map shared across all connected players
- Plot positions generated via Fibonacci sphere distribution — deterministic, reproducible
- 8 biomes assigned by latitude + plot-index noise: Forest, Desert, Mountain, Plains, Water, Tundra, Volcanic, Swamp
- Global AI factions (NEXUS-7, KRONOS, VANGUARD, SPECTRE) run server-side and are visible to all players

### Wallet-Scoped Ownership
- Each human player is identified by their Algorand wallet address
- Plots purchased by a wallet are owned by that wallet; ownership stored in PostgreSQL and backed by a real on-chain Algorand ASA (NFT) per plot
- Player state (resources, commanders, drones, progress) is wallet-specific
- Tester fallback: if no wallet is connected, a `PLAYER_WALLET` placeholder address is used so the UI renders

### TestNet Operations
- All blockchain activity runs on **Algorand TestNet** (chainId: 416002)
- Each wallet's on-chain operations are independent: opt-in checks, ASA transfers, and NFT minting are all per-wallet
- Admin wallet (server-side) manages the FRONTIER ASA and mints plot NFTs on purchase
- Token minting supply is tied directly to the on-chain ASA total (1 billion units, 6 decimals)

### Production vs Development Database
| Mode | Storage | Persistence |
|------|---------|-------------|
| `DATABASE_URL` set | PostgreSQL via Drizzle ORM (`DbStorage`) | Persistent across restarts |
| `DATABASE_URL` absent | In-memory (`MemStorage`) | Lost on restart — dev/demo only |

Always provision a PostgreSQL database before any production deployment.

---

## Player Game Manual

This section walks through the complete player experience — from first launch to advanced territorial domination. Read it end-to-end before your first session.

---

### Chapter 1 — Getting Started

#### 1.1 Prerequisites
Before playing you need:
- A **TestNet Algorand wallet** — [Pera Wallet](https://perawallet.app/) (mobile + browser) or [LUTE Wallet](https://lute.app/) (browser extension)
- **TestNet ALGO** — fund your wallet for free at the [Algorand TestNet Faucet](https://bank.testnet.algorand.network/)
- The FRONTIER ASA **opt-in** — done automatically in-app when you first claim FRONTIER tokens

#### 1.2 First Login
1. Open FRONTIER-AL in your browser.
2. Tap **Connect Wallet** in the top bar.
3. Select **Pera** or **LUTE** and approve the connection in your wallet app.
4. The server calls `GET /api/game/player-by-address/:address`:
   - If this is your first login a **new player record is created** in PostgreSQL.
   - **500 FRNTR welcome bonus** is credited to your DB balance immediately.
   - An on-chain ASA transfer of 500 FRNTR fires in the background (requires you to opt-in to the FRONTIER ASA first — see §1.3).
5. You are prompted to enter a **Gamer Tag** (display name). This name appears on the leaderboard and in battle logs.

#### 1.3 Opting Into the FRONTIER ASA
Algorand requires wallets to explicitly opt in before receiving any ASA.

1. Open your wallet app.
2. Search for Asset ID **755818217** (FRONTIER / FRNTR).
3. Tap **Opt In** and confirm the transaction (~0.1 ALGO minimum balance hold).
4. Return to FRONTIER-AL — your wallet is now ready to receive FRNTR.

#### 1.4 The UI at a Glance
```
┌─────────────────────────────────────────────────────────┐
│  TopBar: Logo · Map Toggle (2D/3D) · Wallet Status      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│         ResourceHUD (top overlay):                      │
│         ♦ Iron: 0  ⚡ Fuel: 0  💎 Crystal: 0           │
│         ▲ FRNTR: 33.0/day  (12.5 pending)              │
│                                                         │
│         3D Globe or 2D Flat Map                         │
│         (21,000 colour-coded plots)                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  BottomNav: Map | Inventory | Battles | Rankings | Cmd  │
└─────────────────────────────────────────────────────────┘
```
- **Map tab** — globe/flat map, tap any plot to open its detail sheet.
- **Inventory tab** — resources, wallet balance, FRNTR claim button.
- **Battles tab** — active and recently resolved battles.
- **Rankings tab** — leaderboard sorted by territories, resources, FRNTR earned, or combat record.
- **Commander (Cmd) tab** — mint and manage Commander avatars.

---

### Chapter 2 — The World Map

#### 2.1 Two Rendering Modes
| Mode | Technology | When to Use |
|------|-----------|-------------|
| **3D Globe** | Three.js InstancedMesh | Strategic overview, orbital events, immersion |
| **2D Flat Map** | Pixi.js scrollable | Detailed planning, clicking specific plots |

Toggle between modes with the **Map Toggle** button in the top bar. Both views update in real time (polled every 5 seconds via `GET /api/game/state`).

#### 2.2 Reading the Map
Each of the 21,000 plots is colour-coded:

| Colour | Meaning |
|--------|---------|
| **Green shades** | Forest biome (unclaimed or AI-owned) |
| **Yellow/tan** | Desert or Plains |
| **Blue** | Water (never capturable by anyone) |
| **White/grey** | Tundra |
| **Dark grey** | Mountain |
| **Orange/red** | Volcanic |
| **Dark green** | Swamp |
| **Bright blue outline** | Your owned plots |
| **Red outline** | Enemy-owned plots adjacent to yours |
| **Pulsing yellow** | Active orbital event affecting this plot |

#### 2.3 Tapping a Plot
Tap any plot to open its **Land Sheet** (bottom drawer):
- **Plot ID**, biome, richness (1–100), coordinates
- Owner name (or "Unclaimed" / faction name)
- Stored resources (Iron, Fuel, Crystal)
- Current improvements and their levels
- Defense level
- Action buttons: **Mine**, **Build**, **Attack**, or **Purchase**

---

### Chapter 3 — Claiming Your First Territory

#### 3.1 Choosing a Plot
Good first plots:
- **Volcanic** biome — highest Iron yield (+80%), good for early base building
- **Forest** biome — balanced Iron (+20%), Crystal bonus (+50%), slight defense bonus
- **Plains** biome — no modifiers, easiest to understand while learning

Avoid Water plots — they are uncapturable and generate minimal resources.

#### 3.2 Purchasing a Plot
1. Tap an unclaimed plot on the map.
2. In the Land Sheet, tap **Purchase**.
3. Your wallet app opens and asks you to sign an Algorand transaction.
   - You are paying ALGO to the game's admin wallet.
   - **Pricing by biome** (ALGO):
     | Biome | Price |
     |-------|-------|
     | Volcanic | 0.8 ALGO |
     | Forest / Plains | 0.6 ALGO |
     | Mountain / Tundra | 0.5 ALGO |
     | Desert / Swamp | 0.4 ALGO |
4. Sign the transaction in Pera or LUTE.
5. The server confirms on-chain receipt, marks the plot owned in PostgreSQL, and **mints a Plot NFT** (ARC-3 Algorand ASA) assigned to your wallet address.
6. The plot immediately appears in your colour on the map for all players.

> **Tip:** Your very first plot should be adjacent to other unclaimed land so you can expand without competing immediately.

#### 3.3 Your Plot NFT
Every purchased plot is a unique ARC-3 NFT on Algorand TestNet:
- Total = 1, decimals = 0 — truly unique
- Metadata includes biome, plot ID, richness, and a biome SVG image
- Query: `GET /api/nft/plot/:plotId` → `{ plotId, assetId, mintedToAddress, mintedAt, explorerUrl }`
- View in [Pera Explorer](https://testnet.explorer.perawallet.app/)

---

### Chapter 4 — Mining Resources

#### 4.1 The Three Mineable Resources
| Resource | Symbol | Primary Use |
|----------|--------|-------------|
| **Iron** | ♦ Fe | Building improvements, attacks |
| **Fuel** | ⚡ Fu | Building improvements, operations |
| **Crystal** | 💎 Cr | High-level upgrades, rare drop |

Resources accumulate passively in each plot's storage over time (based on biome richness). Mining transfers them from plot storage to your player inventory.

#### 4.2 Mining a Plot
1. Tap your owned plot → Land Sheet opens.
2. Tap **Mine**.
3. No wallet signing needed — this is an off-chain action processed instantly on the server (`POST /api/actions/mine`).
4. Iron, Fuel, and Crystal from that plot's storage are added to your inventory.
5. Plot storage resets to zero for that resource type.

#### 4.3 Storage Limits
Each plot has a **storage capacity** (default: 200 units). Once full, new resources are lost. Upgrade **Storage Depot** to increase this.

| Storage Depot Level | Capacity Added |
|--------------------|---------------|
| Level 1 | +100 |
| Level 2 | +100 (total +200) |
| Level 3 | +100 (total +300) |

#### 4.4 Collecting All Resources
Instead of tapping each plot individually, use **Collect All** in the Inventory panel (`POST /api/actions/collect`). This mines every owned plot in one action.

#### 4.5 Biome Resource Modifiers
Biome affects how much of each resource a plot yields per mine cycle:

| Biome | Iron | Fuel | Crystal | Defense | Notes |
|-------|------|------|---------|---------|-------|
| Forest | +20% | 100% | +50% | +10% | Balanced starter biome |
| Plains | 100% | 100% | 100% | 100% | No modifiers — baseline |
| Swamp | −10% | −40% | +100% | −40% | Crystal-rich, defensively weak |
| Desert | −20% | −10% | −70% | −10% | Cheap land, low yields |
| Tundra | −30% | +80% | −20% | +20% | Fuel-focused, defensible |
| Mountain | −40% | −60% | −50% | +30% | Very defensible, low resources |
| Volcanic | +80% | −40% | +150% | −20% | Best Iron + Crystal, risky |
| Water | −50% | −70% | +200% | −30% | **Uncapturable** — never buy |

---

### Chapter 5 — Building Your Base

#### 5.1 Two Improvement Categories
Improvements are built on individual plots and fall into two categories:

**A. Defense Improvements** — built with Iron + Fuel
**B. FRONTIER Facilities** — built by burning FRONTIER tokens

#### 5.2 Defense Improvements

| Improvement | Iron Cost | Fuel Cost | Max Level | Effect |
|-------------|-----------|-----------|-----------|--------|
| Turret | 40 / level | 20 / level | 3 | +3 defense per level |
| Shield Generator | 60 / level | 40 / level | 2 | +5 defense per level |
| Mining Drill | — | — | 3 | +25% resource yield per level |
| Storage Depot | 35 / level | 15 / level | 3 | +100 storage capacity per level |
| Radar Array | 45 Fe | 35 Fu | 1 | Reveals incoming attacks on this plot |
| Fortress | 200 Fe | 150 Fu | 1 | +8 defense + 50 capacity; permanent |

> **Build order suggestion:** Mining Drill (Lv1) → Storage Depot (Lv1) → Turret (Lv1) → repeat.

#### 5.3 FRONTIER Facilities

All facilities require **Electricity** as a prerequisite. Build order is strict:

```
Electricity (30 FRNTR) ──► Blockchain Node  Lv1→Lv2→Lv3  (120/270/480 FRNTR)
                       ──► Data Centre      Lv1→Lv2→Lv3  (120/270/480 FRNTR)
                       ──► AI Lab           Lv1→Lv2→Lv3  (120/270/480 FRNTR)
```

| Facility | Prerequisite | FRNTR Cost | Daily FRNTR Bonus |
|----------|-------------|-----------|-------------------|
| Electricity | — | 30 | +1 |
| Blockchain Node Lv1 | Electricity | 120 | +2 |
| Blockchain Node Lv2 | Node Lv1 | 270 | +3 |
| Blockchain Node Lv3 | Node Lv2 | 480 | +4 |
| Data Centre Lv1 | Electricity | 120 | +2 |
| Data Centre Lv2 | DC Lv1 | 270 | +3 |
| Data Centre Lv3 | DC Lv2 | 480 | +4 |
| AI Lab Lv1 | Electricity | 120 | +2 |
| AI Lab Lv2 | Lab Lv1 | 270 | +3 |
| AI Lab Lv3 | Lab Lv2 | 480 | +4 |

**Maximum facility bonus:** All three chains at Lv3 = **+11 FRNTR/day** per plot
**Base plot generation:** 1 FRNTR/day
**Fully upgraded plot total:** 12 FRNTR/day

> **Token sink note:** FRNTR spent on facilities is permanently burned from your balance (deducted in the DB instantly, no on-chain transaction needed).

#### 5.4 Building an Improvement
1. Tap your owned plot → Land Sheet.
2. Tap **Build**.
3. Select the improvement type and level.
4. Confirm — resources or FRNTR are deducted from your balance immediately.
5. The improvement appears on the plot and its effects take hold right away.

No wallet signing is required for building — all off-chain.

---

### Chapter 6 — FRONTIER Token Economy

#### 6.1 How FRONTIER Accumulates
FRONTIER accumulates passively on each owned plot over time. The rate is:

```
Plot FRNTR/day = 1 (base) + facility bonuses
```

Accumulated FRONTIER is stored in `frontier_accumulated` on the parcel row. It is NOT in your inventory yet.

#### 6.2 Claiming FRONTIER
1. Open **Inventory** panel.
2. Tap **Claim FRONTIER** (or **Mint All — X.XX FRNTR** in the generation banner).
3. Server credits the accumulated FRNTR across all your owned plots to your `frntr_balance_micro` in PostgreSQL immediately.
4. An on-chain ASA transfer is queued to move those tokens to your wallet address (batched in groups of up to 16 per Algorand atomic group).
5. The ResourceHUD updates to show your new balance.

> **Important:** Your in-game DB balance and your on-chain wallet balance may differ by up to one batch cycle. The DB balance is the authoritative game balance for all in-game actions.

#### 6.3 FRNTR Token Sinks (Burns)
Spending FRNTR reduces your DB balance permanently:

| Action | FRNTR Cost |
|--------|-----------|
| Electricity facility | 30 |
| Blockchain Node / DC / AI Lab Lv1 | 120 each |
| Blockchain Node / DC / AI Lab Lv2 | 270 each |
| Blockchain Node / DC / AI Lab Lv3 | 480 each |
| Mint Sentinel Commander | 50 |
| Mint Phantom Commander | 150 |
| Mint Reaper Commander | 400 |
| Deploy Recon Drone | 20 |
| Deploy Orbital Satellite | 50 |
| Orbital Strike (special attack) | 25 |
| EMP Blast (special attack) | 15 |
| Siege Barrage (special attack) | 40 |
| Sabotage (special attack) | 10 |

#### 6.4 Token Economics Overview

| Metric | Source | Description |
|--------|--------|-------------|
| **Max Supply** | Algorand ASA `total` | 1,000,000,000 FRNTR — immutable |
| **Treasury** | Admin wallet balance | Undistributed tokens |
| **In Circulation** | DB `SUM(frntr_balance_micro)` | Tokens held by all players |
| **Burned** | DB `SUM(total_frontier_burned)` | Permanently spent in-game |
| **Distributed** | Max Supply − Treasury | Tokens that have left admin wallet on-chain |

---

### Chapter 7 — Combat

#### 7.1 Combat Prerequisites
Before attacking you need:
- At least one owned plot adjacent (or near) the target
- Sufficient Iron + Fuel for troop deployment costs
- No active **attack cooldown** (from recent defeats)
- No active **morale debuff** (from consecutive losses)

#### 7.2 Launching an Attack
1. Tap the target plot → Land Sheet.
2. Tap **Attack**.
3. The **AttackModal** opens — select troop count (more troops = more resources burned = higher power).
4. (Optional) Select an active **Commander** to boost ATK.
5. Confirm — the server creates a **Battle record** with `status: pending` and `resolveTs = now + 10 minutes`.

#### 7.3 Battle Resolution (10 Minutes)
The server resolves the battle automatically at `resolveTs` via `POST /api/game/resolve-battles`:

```
AttackerPower = troops × (1 + commanderATK%) × biomeModifier × random(0.8–1.2)
DefenderPower = defenseLevel × (1 + allTurretBonus + shieldBonus) × biomeDefenseModifier × random(0.8–1.2)
```

**If Attacker wins:**
- Plot ownership transfers to attacker in DB
- Attacker receives 30% of defender's stored resources (pillage)
- A new Plot NFT is minted to attacker's wallet
- Defender's adjacent plots each lose a small defense bonus (cascade penalty)

**If Defender wins:**
- Plot remains with defender
- Attacker receives a morale debuff (`moraleDebuffUntil`) and attack cooldown (`attackCooldownUntil`)
- Consecutive losses stack these debuffs:
  - Morale debuff: 5 min × `consecutiveLosses`
  - Attack cooldown: 2 min × `consecutiveLosses`
  - Both reset on a win

#### 7.4 Viewing Battles
Open the **Battles tab** to see:
- **Active battles** — shows attacker, defender, target plot, resolve time countdown
- **Resolved battles** — outcome, power scores, resources pillaged

You can also open **BattleWatchModal** on any active battle for a live power estimate.

---

### Chapter 8 — Commander Avatars

#### 8.1 What is a Commander?
A Commander is a unique on-chain avatar that boosts your attack and defense power. You can own multiple Commanders but only one is **active** at a time.

Commanders are minted by burning FRONTIER — this is a permanent on-chain burn recorded in the DB.

#### 8.2 Commander Tiers
| Tier | FRNTR Cost | ATK Bonus | DEF Bonus | Special Ability |
|------|-----------|-----------|-----------|-----------------|
| **Sentinel** | 50 | +10% | +10% | Fortify |
| **Phantom** | 150 | +18% | +6% | Cloak |
| **Reaper** | 400 | +30% | +5% | Annihilate |

#### 8.3 Minting a Commander
1. Open **Commander (Cmd) tab**.
2. Select a tier.
3. Tap **Mint Commander** → `POST /api/actions/mint-avatar` with `{ playerId, tier }`.
4. FRNTR burned, Commander added to your `commanders` JSONB array in DB.
5. The Commander is locked for **12 hours** after the first deployment.

#### 8.4 Switching Commanders
- Open **Cmd tab** → tap any Commander in your collection → **Set Active** → `POST /api/actions/switch-commander`.
- The active Commander's bonuses apply to your next attack immediately.
- Lock timer applies per individual Commander, not per player.

---

### Chapter 9 — Special Attacks

Special attacks require an **active Commander** and have individual cooldown timers.

| Attack | FRNTR | Cooldown | Power Multiplier | Effect | Minimum Tier |
|--------|-------|----------|-----------------|--------|--------------|
| **Orbital Strike** | 25 | 30 min | ×3.0 | Ignores 50% of defender's defense | Any |
| **EMP Blast** | 15 | 20 min | ×1.5 | Disables all improvements for 10 min | Phantom or Reaper |
| **Siege Barrage** | 40 | 45 min | ×2.0 | Hits up to 3 adjacent plots simultaneously | Reaper only |
| **Sabotage** | 10 | 15 min | ×0.5 | Halves enemy resource yield for 30 min | Phantom or Reaper |

#### Using a Special Attack
1. Tap target plot → Land Sheet → **Attack** → select **Special Attack** type.
2. Confirm — FRNTR burned, cooldown starts, battle resolves at standard 10-min mark with modified power.

---

### Chapter 10 — Recon Drones & Orbital Satellites

#### 10.1 Recon Drones
- **Cost:** 20 FRNTR per drone
- **Limit:** 5 drones maximum per player at any time
- **Mission duration:** 15 minutes per scouting run
- **What they reveal:** Enemy plot's current resource stockpile (Iron, Fuel, Crystal stored) and full improvement/facility layout
- **Deploy:** `POST /api/actions/deploy-drone` with optional `targetParcelId`

Use drones before attacking to know whether the target's resources are worth pillaging, and to see their defense improvements.

#### 10.2 Orbital Satellites
- **Cost:** 50 FRNTR per satellite
- **Limit:** 2 satellites maximum per player at any time
- **Orbit duration:** 1 hour per orbit
- **Effect:** **+25% mining yield** on ALL your owned parcels while at least one satellite is active
- **Deploy:** `POST /api/actions/deploy-satellite`

Orbital Satellites are visible on the 3D globe as orbital overlays (rendered by `OrbitalLayer.tsx`). They are the most powerful passive income multiplier available.

---

### Chapter 11 — AI Factions

Four AI commanders permanently compete on the same map as human players. They run server-side on a **2-minute turn interval** via `POST /api/game/ai-turn`.

| Faction | Colour | Strategy | Behavior |
|---------|--------|----------|---------|
| **NEXUS-7** | Blue | Expansionist | Aggressively acquires adjacent unclaimed land every turn |
| **KRONOS** | Purple | Defensive | Spends turns maximising defense on existing holdings |
| **VANGUARD** | Red | Raider | Scans map for weak neighbouring territories and attacks |
| **SPECTRE** | Green | Economic | Focuses on FRONTIER generation and token accumulation |

#### Adaptive Dominance Regulation (ADR)
If any single faction's territory count exceeds **~2,000 plots (~10% of the world map)**, the other three factions automatically increase their aggression level to slow the dominant faction down. This prevents any single AI from monopolising the map.

#### Reconquest Mechanic
When a human player captures a plot from an AI faction, the faction runs a **reconquest sweep** — it may attempt to retake nearby plots or expand elsewhere to compensate. Logic is in `server/engine/ai/reconquest.ts`.

#### Interacting with AI Factions
- **Attack** AI-owned plots the same way you attack humans.
- Capturing AI land from VANGUARD (who has weak defense) is a good early expansion strategy.
- Capturing KRONOS territory is expensive but yields well-defended, high-richness land.
- SPECTRE holds high-FRNTR-generating plots — capturing them is economically powerful.

---

### Chapter 12 — Orbital Events

Orbital events are anomalies that visually and mechanically affect the globe.

#### 12.1 Cosmetic Events (Client-Side)
Generated deterministically from a time seed — no database entry. Visible to all players simultaneously:
- **Aurora** — coloured atmospheric ribbons
- **Debris fields** — scattered particle trails
- **Comet trails** — arcing streaks across the globe

No gameplay effect. Rendered by `OrbitalCanvas.tsx` and `GlobeEventOverlays.tsx`.

#### 12.2 Impact Events (Server-Authoritative)
Stored in the `orbital_events` PostgreSQL table. Have real gameplay consequences:

| Event Type | Effect | Duration |
|-----------|--------|---------|
| METEOR_SHOWER | +50% resource yield on affected plots | 10 min |
| SINGLE_BOLIDE | +50% yield on single plot | 10 min |
| COMET_PASS | +50% yield on a zone | 10 min |
| ORBITAL_DEBRIS | −40% yield on affected plots | 8 min |
| ATMOSPHERIC_BURST | −40% yield on a region | 8 min |
| IMPACT_STRIKE | −40% yield + defense disruption | 8 min |

Impact events appear as **toast notifications** (`OrbitalEventToast.tsx`) and glow on the map. Query active events: `GET /api/orbital/active`.

---

### Chapter 13 — Leaderboard & Progression

Open the **Rankings tab** to view the global leaderboard sorted by:
- **Territories** — total plots owned (primary metric of power)
- **Minerals Mined** — total lifetime Iron + Fuel + Crystal
- **FRONTIER Earned** — total lifetime FRNTR accumulated
- **Battle Record** — win/loss ratio and total battles

There is no season reset in v1.5 — this is a persistent world. TestNet seasonal challenges track mission completion separately (`GET /api/testnet/progress/:address`).

---

### Chapter 14 — Strategic Walkthrough (Early → Late Game)

#### Early Game (0–5 Plots)
1. Connect wallet, claim 500 FRNTR welcome bonus.
2. Purchase 1 Volcanic or Forest plot.
3. Mine immediately to fill your Iron/Fuel inventory.
4. Build **Mining Drill Lv1** (+25% yield).
5. Build **Storage Depot Lv1** (prevents overflow).
6. Build **Electricity** (30 FRNTR) on your main plot to unlock facilities.
7. Purchase 2–3 adjacent unclaimed plots.

#### Mid Game (5–20 Plots)
1. Build **Turret Lv1–2** on your best plots to deter attackers.
2. Mine Blockchain Node Lv1 (120 FRNTR) on your highest-richness plot.
3. Deploy **1 Recon Drone** (20 FRNTR) to scout VANGUARD-held plots before attacking.
4. Mint a **Sentinel Commander** (50 FRNTR) to start winning combat more reliably.
5. Launch attacks on AI-held Volcanic or Forest plots to expand.
6. Deploy 1 **Orbital Satellite** (50 FRNTR) for the +25% mining boost.

#### Late Game (20+ Plots)
1. Fully upgrade 3–5 key plots with all FRONTIER facilities (max 12 FRNTR/day each).
2. Mint a **Phantom or Reaper Commander** for special attack access.
3. Use **Orbital Strike** to capture heavily defended player-owned plots.
4. Use **Siege Barrage** (Reaper) to capture 3 adjacent AI plots in one action.
5. Monitor ADR — if NEXUS-7 or SPECTRE goes over 2,000 plots, VANGUARD/KRONOS escalate, creating opportunities to capture weakened AI territory.
6. Claim FRNTR regularly to prevent overflow and secure on-chain token balance.

---

## Features Reference

### Dual Map View (2D & 3D)
- **3D Globe**: Three.js `InstancedMesh` GPU-accelerated rendering of 21,000 plots on a rotating planet with atmosphere and orbital satellite overlays
- **2D Flat Map**: Scrollable world map with parallax texture and territory heat-map overlay
- Toggle between views at any time from the top bar

### Algorand Blockchain Integration
| Component | Details |
|-----------|---------|
| Network | Algorand TestNet (chainId: 416002) |
| FRONTIER Token | Real ASA — 1 billion total supply (FRNTR), Asset ID `755818217` |
| Plot NFTs | Each purchased plot minted as a unique ARC-3 NFT on-chain |
| Wallet Support | Pera Wallet (mobile + web) and LUTE Wallet (browser) |
| On-chain actions | Territory purchases (ALGO), FRONTIER claims (batched ASA transfers) |
| Off-chain actions | Mining, upgrades, builds, attacks (instant, no signing required) |
| Tx notes | Structured `FRNTR:{…}` JSON on every on-chain transaction (v1 schema) |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React, TypeScript, Vite, TailwindCSS | React 18.3, Vite 7.3 |
| 3D Rendering | Three.js, @react-three/fiber, @react-three/drei | Three.js 0.170 |
| 2D Map | Pixi.js | 8.15 |
| Animations | Framer Motion | 11.13 |
| State Management | TanStack Query (server state), React context (wallet) | RQ 5.60 |
| UI Components | Radix UI primitives + shadcn/ui, Lucide icons | — |
| Backend | Node.js 20, Express | Express 5.0 |
| Database | PostgreSQL via Drizzle ORM | Drizzle 0.39 |
| Blockchain | Algorand TestNet — algosdk, Pera Wallet, LUTE Wallet | algosdk 3.5 |
| Build | Vite (client), esbuild (server → `dist/index.cjs`) | — |
| Fonts | Rajdhani (display), Inter (body) — cyberpunk/military theme | — |

---

## Project Structure

```
Frontier-Al/
├── client/src/
│   ├── components/
│   │   ├── game/
│   │   │   ├── AttackModal.tsx          # Troop deployment UI
│   │   │   ├── BaseInfoPanel.tsx        # Selected-plot info drawer
│   │   │   ├── BattleWatchModal.tsx     # Live battle viewer
│   │   │   ├── BattlesPanel.tsx         # Active battles list
│   │   │   ├── BottomNav.tsx            # Mobile tab navigation
│   │   │   ├── CommandCenterPanel.tsx   # Mission control view
│   │   │   ├── CommanderPanel.tsx       # Mint/manage commanders
│   │   │   ├── EconomicsPanel.tsx       # Token supply analytics
│   │   │   ├── FlatMap.tsx              # 2D scrollable world map
│   │   │   ├── GameLayout.tsx           # Root layout + game loop
│   │   │   ├── GamerTagModal.tsx        # Player name setup
│   │   │   ├── InventoryPanel.tsx       # Resources, wallet, claims
│   │   │   ├── LandSheet.tsx            # Plot detail bottom sheet
│   │   │   ├── LeaderboardPanel.tsx     # Rankings / stats
│   │   │   ├── MobileActionBar.tsx      # Quick action buttons
│   │   │   ├── OnboardingFlow.tsx       # First-time player flow
│   │   │   ├── OrbitalCanvas.tsx        # Orbital event renderer
│   │   │   ├── OrbitalEventToast.tsx    # Event notifications
│   │   │   ├── OrbitalLayer.tsx         # Orbital overlay on globe
│   │   │   ├── PlanetGlobe.tsx          # 3D Three.js globe
│   │   │   ├── ResourceHUD.tsx          # Resource bar (top)
│   │   │   ├── RulesPanel.tsx           # Game rules
│   │   │   ├── TopBar.tsx               # App header + social links
│   │   │   ├── WalletConnect.tsx        # Pera/LUTE wallet UI
│   │   │   └── WarRoomPanel.tsx         # Battle planning panel
│   │   └── ui/                          # Radix/shadcn primitives
│   ├── contexts/                        # WalletContext
│   ├── hooks/
│   │   ├── useBlockchainActions.ts      # Wallet signing, opt-in, claims
│   │   ├── useGameState.ts              # Polls /api/game/state every 5s
│   │   ├── useOrbitalEngine.ts          # Client-side orbital event engine
│   │   ├── use-mobile.tsx               # Responsive breakpoint hook
│   │   ├── use-toast.ts                 # Toast notification hook
│   │   └── useWallet.ts                 # Wallet connection state
│   ├── lib/
│   │   ├── algorand.ts                  # Client-side algosdk helpers
│   │   ├── queryClient.ts               # TanStack Query setup
│   │   └── utils.ts                     # cn(), formatters
│   └── pages/
│       └── game.tsx                     # Main game page
│
├── server/
│   ├── algorand.ts                      # Admin wallet, ASA, batcher, NFTs
│   ├── db.ts                            # Drizzle DB connection
│   ├── db-schema.ts                     # PostgreSQL table definitions
│   ├── routes.ts                        # All Express API endpoints
│   ├── sphereUtils.ts                   # Fibonacci sphere, distance calc
│   ├── storage.ts                       # Game engine (DB + in-memory impls)
│   ├── wsServer.ts                      # WebSocket game state sync
│   ├── worldEventStore.ts               # World event persistence
│   ├── engine/
│   │   ├── ai/                          # AI faction behavior (reconquest, smoke)
│   │   └── battle/                      # Combat resolution logic
│   └── services/chain/                  # Algorand service layer
│       ├── client.ts                    # algodClient, indexer, admin account
│       ├── asa.ts                       # FRONTIER ASA management
│       ├── land.ts                      # Plot NFT minting/transfers
│       ├── factions.ts                  # Faction identity ASA bootstrap
│       └── types.ts
│
├── shared/
│   ├── schema.ts                        # Types, Zod schemas, constants
│   ├── orbitalEngine.ts                 # Orbital event logic
│   └── worldEvents.ts
│
├── docs/
│   ├── backlog/systems/                 # Architecture Decision Records (ADRs)
│   └── mission-control/runbooks/        # Operational runbooks
│
└── script/
    ├── build.ts                         # Build script: Vite (client) + esbuild (server)
    └── mint-golden-plot.ts
```

---

## Database Schema

### `players`
| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar(36) PK | UUID |
| `address` | varchar(100) | Algorand wallet address |
| `name` | varchar(100) | Display name |
| `iron / fuel / crystal` | integer | Current resource stockpile |
| `frntr_balance_micro` | bigint | FRONTIER balance (microFRNTR; 1 FRNTR = 1,000,000) |
| `frntr_claimed_micro` | bigint | Cumulative FRONTIER claimed on-chain |
| `total_frontier_earned` | real | Lifetime FRONTIER earned |
| `total_frontier_burned` | real | Lifetime FRONTIER burned in-game |
| `total_iron_mined` | integer | Lifetime iron |
| `total_fuel_mined` | integer | Lifetime fuel |
| `total_crystal_mined` | real | Lifetime crystal |
| `commanders` | jsonb | Array of `CommanderAvatar` objects |
| `drones / satellites` | jsonb | Active recon drones / orbital satellites |
| `special_attacks` | jsonb | Per-attack cooldown records |
| `morale_debuff_until` | bigint | Timestamp of active morale penalty |
| `attack_cooldown_until` | bigint | Timestamp of attack lockout |
| `consecutive_losses` | integer | Streak counter (resets on win/defence) |
| `welcome_bonus_received` | boolean | Guards duplicate welcome-bonus grant |
| `is_ai` | boolean | AI faction flag |
| `treasury` | real | In-game treasury balance |

### `parcels`
| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar(36) PK | UUID |
| `plot_id` | integer | 1–21,000 sequential ID |
| `lat / lng` | real | Geographic coordinates |
| `x / y / z` | real | Unit-sphere cartesian (spatial index) |
| `biome` | varchar(20) | One of 8 biome types |
| `richness` | integer | 1–100 resource richness |
| `owner_id` | varchar(36) | FK → players.id (null = unclaimed) |
| `defense_level` | integer | Base defense rating |
| `improvements` | jsonb | Array of `{ type, level }` improvements |
| `frontier_accumulated` | real | Pending FRNTR tokens (not yet claimed) |
| `frontier_per_day` | real | Current daily generation rate |
| `last_frontier_claim_ts` | bigint | Timestamp of last claim |
| `purchase_price_algo` | real | ALGO price (null = not for sale) |
| `iron_stored / fuel_stored / crystal_stored` | real | Mined resources awaiting collection |
| `storage_capacity` | integer | Max storable resources (default 200) |

### `battles`
| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar(36) PK | UUID |
| `attacker_id / defender_id` | varchar(36) | FK → players |
| `target_parcel_id` | varchar(36) | FK → parcels |
| `attacker_power / defender_power` | real | Computed combat scores |
| `status` | varchar(20) | `pending` → `resolved` |
| `outcome` | varchar(20) | `attacker_wins` / `defender_wins` |
| `resolve_ts` | bigint | When battle auto-resolves |

### `orbital_events`
Persists server-authoritative impact events (cosmetic events are generated client-side from a seed).

### `game_events`
Append-only event log (latest 50 shown in the feed).

### `plot_nfts`
| Column | Type | Description |
|--------|------|-------------|
| `plot_id` | integer PK | FK → parcels.plot_id |
| `asset_id` | bigint | Algorand ASA ID (null until minted) |
| `minted_to_address` | text | Receiving wallet |
| `minted_at` | bigint | Unix ms timestamp |

### `game_meta`
Singleton row (id=1). Stores `initialized`, `current_turn`, and `last_update_ts`.

---

## API Reference

### Blockchain / Status
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blockchain/status` | ASA ID, admin address, ALGO + FRONTIER balances |
| GET | `/api/blockchain/opt-in-check/:address` | Check if address is opted into FRONTIER ASA |
| GET | `/api/economics` | Token supply — max supply, treasury, in-game circulating, burned, on-chain distributed |

### Game State
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/game/state` | Full world state (parcels, players, battles, events; polled every 5s) |
| GET | `/api/game/parcel/:id` | Single parcel detail |
| GET | `/api/game/player/:id` | Player profile |
| GET | `/api/game/player-by-address/:address` | Look up (or auto-create) player by wallet address |
| GET | `/api/game/leaderboard` | Ranked player list with all stats |

### Player Actions
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/actions/connect-wallet` | `{ address }` | Link wallet; grants 500 FRNTR welcome bonus once |
| POST | `/api/actions/set-name` | `{ playerId, name }` | Set display name |
| POST | `/api/actions/mine` | `{ playerId, parcelId }` | Mine resources from owned plot |
| POST | `/api/actions/upgrade` | `{ playerId, parcelId, upgradeType }` | Upgrade base (defense/yield/mine/fortress) |
| POST | `/api/actions/build` | `{ playerId, parcelId, improvementType }` | Build or upgrade a facility/defense |
| POST | `/api/actions/attack` | `{ playerId, targetParcelId, troops }` | Launch attack |
| POST | `/api/actions/purchase` | `{ playerId, parcelId }` | Purchase unclaimed land |
| POST | `/api/actions/collect` | `{ playerId }` | Collect all stored resources across owned plots |
| POST | `/api/actions/claim-frontier` | `{ playerId }` | Claim accumulated FRONTIER (credits DB + queues on-chain transfer) |

### Commander & Advanced
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/actions/mint-avatar` | `{ playerId, tier }` | Mint Commander (sentinel/phantom/reaper) |
| POST | `/api/actions/switch-commander` | `{ playerId, index }` | Activate a different Commander |
| POST | `/api/actions/special-attack` | `{ playerId, targetParcelId, attackType }` | Execute special attack |
| POST | `/api/actions/deploy-drone` | `{ playerId, targetParcelId? }` | Deploy recon drone |
| POST | `/api/actions/deploy-satellite` | `{ playerId }` | Deploy orbital satellite |

### NFTs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/nft/metadata/:plotId` | ARC-3 JSON metadata for a Plot NFT |
| GET | `/api/nft/plot/:plotId` | DB record: `{ plotId, assetId, mintedToAddress, mintedAt, explorerUrl }` |

### Game Engine (Scheduled)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/game/resolve-battles` | Resolve all pending battles past their `resolveTs` |
| POST | `/api/game/ai-turn` | Advance all AI faction turns |

### Orbital Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orbital/active` | List active (non-cosmetic) orbital events |
| POST | `/api/orbital/trigger` | Spawn a new orbital event |
| POST | `/api/orbital/resolve/:id` | Resolve an active orbital event |

### TestNet Progress
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/testnet/progress/:address` | Get completed mission IDs |
| POST | `/api/testnet/progress` | Mark missions complete |

---

## Environment Variables

Create a `.env` file in the project root (never commit it):

```env
# ── Required ────────────────────────────────────────────────────────────────

# PostgreSQL connection string (Neon, Railway Postgres, Supabase, etc.)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Algorand admin wallet — used server-side to manage FRONTIER ASA + mint NFTs
ALGORAND_ADMIN_ADDRESS=YOUR_58_CHAR_ALGORAND_ADDRESS
ALGORAND_ADMIN_MNEMONIC=word1 word2 ... word25

# Canonical public URL of this deployment — baked into on-chain NFT metadata URLs
# Must be set BEFORE any plot NFT is minted (URL is permanent on-chain)
PUBLIC_BASE_URL=https://your-app.yourdomain.com

# ── Optional overrides (default to Algorand TestNet via algonode.cloud) ─────

# Server-side Algod node
ALGOD_URL=https://testnet-api.algonode.cloud

# Server-side Indexer node
INDEXER_URL=https://testnet-idx.algonode.cloud

# Network label embedded in on-chain transaction notes
ALGORAND_NETWORK=testnet

# Client-side Algod URL (baked into Vite bundle at build time)
VITE_ALGOD_URL=https://testnet-api.algonode.cloud

# Client-side Indexer URL (baked into Vite bundle at build time)
VITE_INDEXER_URL=https://testnet-idx.algonode.cloud

# Server port (defaults to 5000)
PORT=5000
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database (Neon, Supabase, or local)
- Algorand TestNet wallet — [Pera Wallet](https://perawallet.app/) or [LUTE Wallet](https://lute.app/)
- TestNet ALGO from the [Algorand TestNet Faucet](https://bank.testnet.algorand.network/)

### Install & Run

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, admin mnemonic, etc.

# Push database schema (first time or after schema changes)
npm run db:push

# Start development server (client + server on port 5000)
npm run dev
```

In development, the Express server and Vite dev server run together on port 5000 via `tsx server/index.ts`. Hot module replacement is active for the client.

### Production Build

```bash
npm install
npm run build   # Builds client (dist/public/) + server (dist/index.cjs)
npm start       # NODE_ENV=production node dist/index.cjs
```

Server binds to `0.0.0.0:${PORT}` (default 5000). In production, Express serves the built client assets directly — no separate frontend server needed.

---

## Plot NFTs (ARC-3)

Each purchased plot is minted as an individual Algorand ASA (total=1, decimals=0) following the ARC-3 metadata standard.

### Check NFT metadata
```bash
curl https://YOUR_DEPLOYMENT_URL/nft/metadata/1
```
Returns JSON: `name`, `description`, `image` (biome SVG), `external_url`, `properties`.

### Query on-chain NFT record
```bash
curl https://YOUR_DEPLOYMENT_URL/api/nft/plot/1
# → { plotId, assetId, mintedToAddress, mintedAt, explorerUrl }
```

### View in Algorand Explorer
```
https://testnet.explorer.perawallet.app/asset/<assetId>/
```

### Receiving a Plot NFT
1. Get the `assetId` from `/api/nft/plot/:plotId`
2. Opt-in to the ASA from your Pera/LUTE wallet
3. The admin wallet will transfer the NFT once opt-in is confirmed

---

## On-Chain Transaction Note Format (v1)

All transactions sent to Algorand use the prefix `FRNTR:` followed by structured JSON, making them searchable in block explorers, parseable by any indexer, and versioned via the `"v":1` field.

### FRONTIER Token Claim (server → chain)
```json
{
  "game": "FRONTIER",
  "v": 1,
  "type": "batch_claim",
  "amt": 33.47,
  "to": "ABCDEFGHIJ...",
  "batchIdx": 0,
  "batchSize": 1,
  "ts": 1740000000000,
  "network": "testnet"
}
```

### Game Action Batch (client → chain)
```json
{
  "game": "FRONTIER",
  "v": 1,
  "network": "testnet",
  "actions": [
    { "a": "mine", "p": 42, "t": 1740000000000, "m": { "fe": 8, "fu": 4, "cr": 1 } },
    { "a": "build", "p": 42, "t": 1740000005000, "x": { "improvementType": "turret" } }
  ]
}
```

---

## Deployment

### Railway (Recommended)
Set environment variables in the Railway dashboard. Provision a Railway PostgreSQL plugin for `DATABASE_URL`. Build and start commands are auto-detected from `package.json`.

### Render
1. New Web Service → connect repo
2. **Build command**: `npm install && npm run build`
3. **Start command**: `npm start`
4. **Environment**: Node 20, set all required env vars
5. Add a Render PostgreSQL database, copy connection string to `DATABASE_URL`

### DigitalOcean App Platform
1. New App → connect repo
2. Build command: `npm run build`
3. Run command: `npm start`
4. Add a DigitalOcean Managed PostgreSQL database

### Pre-Go-Live Checklist
| Item | Action Required |
|------|----------------|
| `PUBLIC_BASE_URL` | Set to the final deployment URL **before** any plots are purchased — baked permanently into on-chain NFT ASA metadata |
| PostgreSQL provisioned | Required for production; in-memory MemStorage does not persist |
| Admin wallet funded | Minimum ~1 ALGO on TestNet for ASA ops; fund from [faucet](https://bank.testnet.algorand.network/) |
| `.env` configured | All required env vars set; never commit real `.env` |

---

## Wallet Connection Flow

1. User opens the app — `WalletContext` checks `localStorage` for a saved `frontier_wallet_type`
2. If saved, reconnection is attempted automatically (Pera: `reconnectSession`, LUTE: `connect`)
3. On successful connect: address saved to `localStorage`, balance fetched from Algod
4. Client calls `GET /api/game/player-by-address/:address` — creates a player record if first login, grants 500 FRONTIER welcome bonus
5. Welcome bonus ASA transfer fires in the background if the address is opted into FRONTIER ASA
6. If no wallet connected, a tester fallback player (`PLAYER_WALLET` address) is used so the UI is always functional

---

## Changelog

### v1.5.0 — Player Game Manual & TypeScript Config Fix (current)
- **Fix**: `tsconfig.json` `types` array restored to include `node` and `vite/client` only; removing it caused cascading JSX type errors across all components due to missing `node_modules`. The two `TS2688` errors for missing type definitions are expected pre-existing errors in fresh-clone environments without `npm install` — they do not affect the runtime or build.
- **Docs**: Complete Player Game Manual added to README (Chapters 1–14), covering first login through advanced endgame strategy, biome selection, build orders, combat mechanics, Commander system, special attacks, recon drones, orbital satellites, AI factions, and orbital events.
- **Docs**: All biome yield tables audited and corrected (Volcanic Iron +80%, Forest Iron +20%, aligned with `shared/schema.ts` constants).
- **Docs**: README version bumped from 1.4.0 → 1.5.0 throughout.

### v1.4.0 — Token Supply Fix
- **Fix**: Economics Panel now reads FRONTIER supply directly from the game database for real-time accuracy. Previously the panel only updated after the Algorand on-chain transfer settled, which could lag or fail silently.
- **Fix**: "Distributed" stat card was showing a duplicate of "In Circulation" (copy-paste bug). It is now a distinct "Burned" card showing total FRONTIER spent in-game on commanders, improvements, drones, and special attacks.
- **New**: Token Distribution bar now shows three segments — **In Circulation**, **Burned**, and **Treasury Reserve** — giving a complete picture of where all supply lives.

### v1.3.0 — Map & Orbital Overhaul
- 2D/3D map toggle with seamless parallax flat-map texture
- Rankings tab in navigation
- Orbital events system (cosmetic + server-authoritative impact events)
- AI behavior now escalates aggression when suppressed (expansion + attack surge)
- Removed distracting pulsing/strobe animations from FlatMap and GameLayout
- Architecture Decision Records (ADRs) added to `docs/backlog/systems/`

### v1.2.0 — On-Chain Transactions & Crystal Tracking
- Structured `FRNTR:{…}` JSON notes on all Algorand transactions (v1 schema)
- `totalCrystalMined` tracked per player in DB and displayed in leaderboard
- FRNTR Generation Banner in Inventory panel with "Mint All — X.XX FRNTR" button
- ResourceHUD daily rate indicator (`▲ 33.0/day (12.5 pending)`)
- Mine action yields included in on-chain batch notes
- Batched atomic FRONTIER ASA transfers (up to 16 per Algorand atomic group)

### v1.1.0 — Commander & Combat Expansion
- Commander Avatar system (Sentinel / Phantom / Reaper) with on-chain FRONTIER burn
- Special attacks (Orbital Strike, EMP Blast, Siege Barrage, Sabotage)
- Recon Drones — 20 FRNTR each, 15-minute scout missions
- Orbital Satellites — 50 FRNTR, boost mining yield
- Morale debuff + attack cooldown system for consecutive combat losses
- Cascade defense penalty on plots adjacent to captured territory
- Pillage mechanic — attacker steals 30% of defender's stored resources

### v1.0.0 — Initial Release
- 21,000-plot Fibonacci sphere globe with 8 biomes
- FRONTIER ASA deployed on Algorand TestNet
- Pera Wallet + LUTE Wallet integration
- Resource economy: Iron, Fuel, Crystal, FRONTIER
- FRONTIER Facilities: Electricity, Blockchain Node, Data Centre, AI Lab
- Defense Improvements: Turret, Shield Gen, Storage Depot, Radar, Fortress
- Four AI factions: NEXUS-7, KRONOS, VANGUARD, SPECTRE
- Plot NFTs (ARC-3) minted at purchase
- 500 FRNTR welcome bonus on first wallet connection

---

## License

Proprietary software. All rights reserved. See [LICENSE](LICENSE) for details.

No part of this software may be used, copied, modified, or distributed without prior written permission from KudbeeZero.
