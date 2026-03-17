# Session: Testing Economy Unlock — FRNTR-First Pricing
**Date:** 2026-03-17
**Branch:** `claude/frntr-testing-economy-3UuXz`

---

## Objective
Remove pricing friction blocking partner testing. Make all core gameplay actions affordable using FRNTR. Remove excessive ALGO requirements for commander minting.

---

## Changes Made

### `shared/economy-config.ts` (expanded)
- Added centralized testing + production price configs for:
  - Commander mint (FRNTR): Sentinel 10, Phantom 25, Reaper 50 (testing) / 50, 150, 400 (prod)
  - Land purchase (ALGO): All biomes → 0.1 ALGO (testing) / biome-specific (prod)
  - Facility build costs (FRNTR): ~1/8 of production values in testing
  - Special attack costs (FRNTR): ~1/5 of production values in testing
  - Drone/satellite costs
  - `COMMANDER_ALGO_NETWORK_FEE = 0.001` — only unavoidable Algorand fee documented
  - `TESTING_ECONOMY_SUMMARY` object exported for API/UI display
- All active pricing resolves from `ECONOMY_MODE` (env var, default: "testing")

### `shared/schema.ts`
- `LAND_PURCHASE_ALGO` now driven by `LAND_PURCHASE_ALGO_ACTIVE` from economy-config
- `COMMANDER_INFO[tier].mintCostFrontier` now driven by `COMMANDER_MINT_FRNTR_ACTIVE` from economy-config
- No hardcoded prices remain in schema.ts for these fields

### `server/routes.ts`
- Added imports: `COMMANDER_MINT_FRNTR_ACTIVE`, `COMMANDER_ALGO_NETWORK_FEE`, `LAND_PURCHASE_ALGO_ACTIVE`, `TESTING_ECONOMY_SUMMARY`
- `GET /api/nft/commander-price/:tier`: Now returns `frntrCost`, `algoNetworkFee`, `economyMode`, `currency: "FRNTR"` — no more USD/ALGO pricing
- `POST /api/actions/mint-avatar`: Removed ALGO payment gate (`algoPaymentTxId` requirement). Now validates FRNTR balance instead. NFT mint still fires post-response. Liquidity split removed (no ALGO payment to split).
- `GET /api/economics`: Now includes `testingPrices: TESTING_ECONOMY_SUMMARY` in response

### `client/src/components/game/GameLayout.tsx`
- `handleMintAvatar`: Removed ALGO payment flow (`sendPaymentTransaction`). Now fetches `/api/nft/commander-price/:tier` for FRNTR cost display only. Passes `{ playerId, tier }` to mutation (no `algoPaymentTxId`).
- Toast messages updated to show FRNTR cost and testing mode label
- Added `BookOpen` icon import

### `client/src/hooks/useTutorial.ts`
- Added `resetAndOpen()` function: clears localStorage tutorial completion flag, resets step to 0, opens tutorial
- Exported `resetAndOpen` from hook return value

### `client/src/components/game/EconomicsPanel.tsx`
- Added `TestingPrices` interface to match API response
- Added `testingPrices?` field to `EconomicsData` interface
- Added "Testing Economy Prices" section showing:
  - Commander mint costs per tier (FRNTR)
  - Land purchase price (ALGO, minimum)
  - Commander network fee (ALGO network only)
  - Mode note
- Updated Token Sinks section to show accurate testing prices

### `client/src/components/game/GameLayout.tsx` (tutorial button)
- Added `TUTORIAL` button, lower-left, `z-40`, glass-morphism style
- Calls `tutorial.resetAndOpen()` on click
- Visible on mobile (above BottomNav) and desktop
- `data-testid="button-tutorial-restart"`

### `client/src/pages/landing-updates.tsx`
- Added 4 new "complete" update entries for the testing economy changes
- Testing Economy Unlock, Centralized Economy Config, Tutorial Restart Button, Economics Panel Clarity

---

## Testing Economy Summary (Active)

| Action | Currency | Testing Price | Production Price |
|--------|----------|---------------|-----------------|
| Commander — Sentinel | FRNTR | 10 | 50 |
| Commander — Phantom | FRNTR | 25 | 150 |
| Commander — Reaper | FRNTR | 50 | 400 |
| Land purchase (any biome) | ALGO | 0.1 | 0.2–1.5 (biome) |
| Commander NFT network fee | ALGO | 0.001 (unavoidable) | 0.001 |
| Orbital Strike | FRNTR | 5 | 25 |
| EMP Blast | FRNTR | 3 | 15 |
| Siege Barrage | FRNTR | 8 | 40 |
| Sabotage | FRNTR | 2 | 10 |
| Recon Drone | FRNTR | 2 | 20 |
| Orbital Satellite | FRNTR | 5 | 50 |

## FRNTR as Primary Currency
- Commander minting: FRNTR only (no ALGO game charge)
- Facility builds: FRNTR (costs reduced ~1/8 in testing)
- Special attacks: FRNTR (costs reduced ~1/5 in testing)
- Land emission: 50 FRNTR/day per parcel (testing rate)

## Unavoidable ALGO Cost
- Algorand network fee: ~0.001 ALGO per on-chain transaction (handled by wallet automatically)
- Land purchase NFT mint: 0.1 ALGO minimum (testing) — this is the only "game" ALGO charge

## What Still Needs Work
- Facility FRNTR costs in schema.ts are not yet dynamically driven from economy-config (they use hardcoded values in FACILITY_UPGRADES const) — testing mode prices are lower from economy-config but schema.ts FACILITY_UPGRADES still has old values. This affects the build UI cost display.
- Production tokenomics not finalized — `LAND_DAILY_FRNTR_RATE_PROD = 1` is placeholder
- `algoPaymentTxId` DB column still exists — can be cleaned up in future migration
