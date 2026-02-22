# FRONTIER — Change Log & Status

## Session: organize-mining-transactions-eKu3t
**Date:** 2026-02-21
**Branch:** `claude/organize-mining-transactions-eKu3t`

---

## What Was Done

### 1. Organized & Enriched On-Chain Transaction Data

**Problem:** Transaction notes sent to the Algorand chain were minimal plain-text strings (e.g., `"FRONTIER claim: 33"`) with no structure, no versioning, and no way to parse them programmatically.

**Changes Made:**

#### `server/algorand.ts`
- `transferFrontierASA()` — note now sends structured JSON:
  ```
  FRNTR:{"game":"FRONTIER","v":1,"type":"claim","amt":33,"to":"ADDR...","ts":1234567890,"network":"testnet"}
  ```
- `sendAtomicFrontierTransfers()` (used for batch claims) — each transaction in the atomic group now includes:
  ```
  FRNTR:{"game":"FRONTIER","v":1,"type":"batch_claim","amt":33,"to":"ADDR...","batchIdx":0,"batchSize":3,"ts":...,"network":"testnet"}
  ```
- `FrontierTransferBatcher.estimatedBytes()` — size estimate updated to reflect the new larger JSON notes so batches stay within Algorand's 1 KB limit.

#### `client/src/lib/algorand.ts`
- All on-chain note prefixes changed from `FRONTIER:` → `FRNTR:` for consistency with the ASA unit name.
- `createGameActionTransaction()` — structured note:
  ```
  FRNTR:{"game":"FRONTIER","v":1,"action":"mine","plotId":42,"player":"ABCDEF12","ts":...,"network":"testnet"}
  ```
- `createPurchaseWithAlgoTransaction()` — includes `algoAmount` and abbreviated player address.
- `createClaimFrontierTransaction()` — includes token amount and player address.
- Batch action envelope (`_encodeBatch`) upgraded from minimal `FB:[...]` to:
  ```
  FRNTR:{"game":"FRONTIER","v":1,"network":"testnet","actions":[...]}
  ```
- `BatchedAction` interface gains optional `m` field for mineral yields on mine actions: `{ fe: number, fu: number, cr: number }`.
- `enqueueGameAction()` now accepts an optional `minerals` parameter to embed actual extracted amounts in the on-chain log.

---

### 2. Crystal Mining Now Fully Tracked

**Problem:** `totalCrystalMined` was missing from the player model. Only iron and fuel were tracked at the lifetime level, so there was no record of how much crystal any player had extracted from the Earth over their session.

**Changes Made:**

#### `shared/schema.ts`
- Added `totalCrystalMined: number` to the `Player` interface.
- Added `totalCrystalMined: number` to the `LeaderboardEntry` interface.

#### `server/db-schema.ts`
- Added `totalCrystalMined: real("total_crystal_mined").notNull().default(0)` column to the `players` table.

#### `server/storage.ts`
- Player initialization (human + all 4 AI factions) sets `totalCrystalMined: 0`.
- `mineResources()` now tracks: `player.totalCrystalMined += finalCrystal`.
- Mining game event description enriched:
  ```
  "Commander mined 8 iron, 4 fuel, 1 crystal from plot #42 [volcanic] (richness: 87)"
  ```
  Previously it omitted crystal and richness entirely.
- `getLeaderboard()` now includes `totalCrystalMined` in every entry.

---

### 3. Cumulative Daily FRNTR Accumulation — Top-of-Menu Banner

**Problem:** Players had no clear at-a-glance view of how much FRONTIER token they were generating per day across all their plots, or how much had built up pending a claim. The "Claim FRNTR" button gave no indication of the pending amount.

**Changes Made:**

#### `client/src/components/game/InventoryPanel.tsx`
- Added a prominent **FRNTR Generation Banner** at the very top of the Inventory panel (above wallet balances), visible as soon as you own any land.
- Banner shows two large numbers:
  - **FRNTR / Day** — total daily generation rate summed across all owned plots.
  - **Accumulated** — total FRNTR pending a claim right now (all plots summed).
- **"Mint All — X.XX FRNTR"** button replaces the old plain "Claim FRNTR" button in the banner. The button:
  - Shows the exact pending amount in the label (e.g., `Mint All — 33.47 FRNTR`).
  - Is disabled with `"No FRNTR to Mint Yet"` text when nothing has accumulated.
  - Notes inline that large claims are sent in max-size Algorand atomic batches.
- Added a **Lifetime Mineral Extraction** row beneath wallet balances showing `totalIronMined`, `totalFuelMined`, and `totalCrystalMined` from the player's lifetime stats.
- The collect-minerals button label is now more explicit: `Collect Minerals — +8Fe +4Fu +1Cr` (abbreviated units).
- Removed the old bottom-of-header "Earning X FRNTR/day" text line — that info now lives in the banner.

---

### 4. ResourceHUD Daily Rate Indicator

**Problem:** The top-of-screen resource bar showed the player's current FRNTR wallet balance but gave no indication of how fast it was growing.

**Changes Made:**

#### `client/src/components/game/ResourceHUD.tsx`
- Added `frontierDailyRate?: number` and `frontierPending?: number` props.
- Below the FRNTR balance on desktop (sm+ breakpoint), a small sub-label now shows:
  ```
  ▲ 33.0/day  (12.5 pending)
  ```
- The pending amount shows in yellow when non-zero.

#### `client/src/components/game/GameLayout.tsx`
- Computes `frontierDailyRate` and `frontierPending` from `gameState.parcels` filtered to the current player's owned plots and passes them to `<ResourceHUD />`.
- Mine action callback updated: `queueMineAction` is now called **after** the server confirms the mining result, so the actual mineral yields `{ iron, fuel, crystal }` are included in the on-chain batch note rather than zeros.
- Mining toast description now shows the specific yields: `"+8 Iron, +4 Fuel, +1 Crystal"`.

---

## File Status

| File | Status | What Changed |
|------|--------|-------------|
| `shared/schema.ts` | **Updated** | Added `totalCrystalMined` to `Player` + `LeaderboardEntry` interfaces |
| `server/db-schema.ts` | **Updated** | Added `total_crystal_mined` column to `players` table |
| `server/storage.ts` | **Updated** | Crystal tracking in `mineResources()`, enriched event descriptions, leaderboard entry includes crystal |
| `server/algorand.ts` | **Updated** | Structured JSON notes for all FRONTIER ASA transfers; consistent `FRNTR:` prefix |
| `client/src/lib/algorand.ts` | **Updated** | Structured `FRNTR:` prefix on all on-chain notes; `BatchedAction` gains mineral field `m`; `enqueueGameAction` accepts minerals param |
| `client/src/hooks/useBlockchainActions.ts` | **Updated** | `queueMineAction` accepts optional `{ iron, fuel, crystal }` mineral yields |
| `client/src/components/game/InventoryPanel.tsx` | **Updated** | FRNTR Generation Banner, Mint All button, lifetime mineral stats panel |
| `client/src/components/game/ResourceHUD.tsx` | **Updated** | Daily rate + pending indicator below FRNTR balance |
| `client/src/components/game/GameLayout.tsx` | **Updated** | Passes daily rate + pending to `ResourceHUD`; mine yields logged post-confirmation |

---

## Live Status

| Layer | Status |
|-------|--------|
| **Algorand TestNet** | Live — FRONTIER ASA deployed at asset ID `755818217` on TestNet |
| **Backend API** | Live — Express server serves all endpoints; blockchain init runs on startup |
| **Frontend** | Live — React/Vite client served from same server |
| **Database** | In-memory (`MemStorage`) — persists only for server lifetime; DB schema (`db-schema.ts`) defines the Drizzle/Postgres schema for when a Postgres instance is wired in |
| **Wallet Support** | Pera Wallet + LUTE Wallet on Algorand TestNet |
| **Token Minting** | Server-side batched ASA transfers (up to 16 per atomic group) run when player claims FRONTIER |

> **Note on `totalCrystalMined` DB column:** The Drizzle schema has been updated to include the new column. If a live Postgres database is in use, run a migration (`ALTER TABLE players ADD COLUMN total_crystal_mined REAL NOT NULL DEFAULT 0`) or re-run the schema push (`drizzle-kit push`) to apply it. The in-memory `MemStorage` used in development picks it up automatically.

---

## On-Chain Transaction Note Format (v1)

All transactions sent to Algorand now use the prefix `FRNTR:` followed by a JSON payload. This makes them:
- Searchable in block explorers by note prefix
- Parseable by any indexer or analytics tool
- Versioned via the `"v":1` field for forward compatibility

### Mine Action Batch (client → chain)
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

### FRNTR Claim (server → chain)
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
