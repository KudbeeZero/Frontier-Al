# Session Notes — 2026-03-17 — FRNTR Land Emissions Test Rate

## Task
Centralize FRNTR land emission config and raise testing rate to 50 FRNTR/day per parcel.

## Changes Made

### `shared/economy-config.ts` _(new file)_
- Central source of truth for all land emission constants
- `LAND_DAILY_FRNTR_RATE_TEST = 50` — active testing rate
- `LAND_DAILY_FRNTR_RATE_PROD = 1` — placeholder production rate
- `ECONOMY_MODE` — reads `process.env.ECONOMY_MODE`; defaults to `"testing"`
- `LAND_DAILY_FRNTR_RATE` — resolves to test or prod based on mode
- `EMISSION_CHECK_PARCEL_COUNTS = [1, 10, 100, 250]` — safety check parcel counts
- `projectedDailyEmissions(n)` — utility for payout demand projections

### `shared/schema.ts`
- Added `import { LAND_DAILY_FRNTR_RATE } from "./economy-config"`
- `calculateFrontierPerDay()` — base rate now `LAND_DAILY_FRNTR_RATE` instead of hardcoded `1`
- Facility bonuses (electricity +1, blockchain_node +2/3/4) remain additive on top of base

### `server/services/chain/client.ts`
- `getAdminBalance(frontierAsaId?)` — now accepts optional ASA ID and returns actual FRNTR balance from account assets array
- Previously always returned `frontierAsa: 0`

### `server/routes.ts`
- `/api/economics` — imports from `shared/economy-config`
- Queries `ownedParcelCount` from DB (player-owned parcels only)
- Adds payout safety warning log when daily demand > 10% of treasury balance
- Response now includes:
  - `economyMode` — "testing" or "production"
  - `emissionRatePerDay` — active base rate
  - `emissionRateTest` / `emissionRateProd` — both constants for UI
  - `ownedParcelCount` — current player-owned parcel count
  - `currentDailyBaseEmission` — demand at current parcel count
  - `projectedEmissions` — demand at 1 / 10 / 100 / 250 parcels

### `client/src/components/game/EconomicsPanel.tsx`
- Extended `EconomicsData` interface with new emission fields
- Added **Land Emission Rate** section above On-Chain Supply:
  - Active rate display (yellow, monospace)
  - Production rate display if in testing mode
  - Owned parcel count
  - Daily base demand
  - "TESTING MODE" badge on section header
  - Warning note that rate will be reduced for live launch

## Test Rate
**50 FRNTR/day** per parcel (base, before facility bonuses)

## Production Switch
Set `ECONOMY_MODE=production` in server environment to activate `LAND_DAILY_FRNTR_RATE_PROD`.

## Branch
`claude/centralize-frntr-emissions-E4ZDk`

## Assumptions
- Facility bonus values (+1 electricity, +2/3/4 blockchain_node) are intentionally preserved additive on the new 50 base
- `LAND_DAILY_FRNTR_RATE_PROD = 1` is a placeholder — the final live rate must be set before production launch
- Admin wallet FRNTR balance safety check uses 10% daily threshold as a conservative warning trigger
