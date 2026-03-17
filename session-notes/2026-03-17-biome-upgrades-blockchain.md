# Session Notes — 2026-03-17 (Biome Upgrades + Blockchain Integration)

## Summary
Continued Phase 5 (Sub-Parcel Depth) momentum. This session wired biome-differentiated upgrade costs, blockchain on-chain recording, Upstash world event persistence, and real-time WebSocket label updates across the full stack.

---

## Changes Made

### `shared/schema.ts`
- Added `BIOME_UPGRADE_DISCOUNTS: Record<BiomeType, Partial<Record<ImprovementType, number>>>` — per-biome cost multipliers for all sub-parcel improvements
  - Discounts: up to 35% off (e.g. water biome → data_centre 0.65×, blockchain_node 0.70×)
  - Premiums: up to 50% above base (e.g. water biome → fortress 1.50×)
  - Biome flavour aligns with existing `biomeBonuses` (volcanic = mineral-rich, mountain = defense, desert = fuel/storage, etc.)
- Added `getBiomeUpgradeMultiplier(biome, improvementType): number` — pure helper for frontend and backend to compute the same cost

### `server/storage/db.ts`
- Updated `buildSubParcelImprovement()` to:
  - Fetch parent plot's biome inside the transaction
  - Apply `getBiomeUpgradeMultiplier(biome, type)` to facility FRNTR cost and defense iron/fuel cost
  - Use `Math.ceil()` for cost rounding to avoid fractions
- Added `BiomeType` import

### `server/services/chain/upgrades.ts` *(new file)*
- `recordUpgradeOnChain(params: UpgradeNoteParams): Promise<string>`
  - Zero-value Algorand admin self-transfer with JSON note payload
  - Non-blocking; callers use `.catch(() => {})` for fire-and-forget
  - Note format: `{ frontier: "sub_parcel_upgrade", plotId, subIndex, biome, improvementType, level, playerId, ts }`

### `server/services/redis.ts`
- Added `SubParcelWorldEvent` interface
- Added `recordSubParcelWorldEvent(event)` — appends to `frontier:world_events` sorted set with 24h TTL
- Used by both purchase and build routes

### `server/routes.ts`
- Updated `POST /api/sub-parcels/:id/purchase`:
  - Fires `broadcastRaw({ type: "sub_parcel_purchased", subParcelId, parentPlotId, subIndex, ownerId })` via WebSocket
  - Calls `recordSubParcelWorldEvent(...)` (fire-and-forget)
- Updated `POST /api/sub-parcels/:id/build`:
  - Fires `broadcastRaw({ type: "sub_parcel_upgraded", subParcelId, parentPlotId, subIndex, improvementType, level, ownerId })` via WebSocket
  - Calls `recordSubParcelWorldEvent(...)` (fire-and-forget)
  - Calls `recordUpgradeOnChain(...)` (fire-and-forget)
- Added imports: `recordSubParcelWorldEvent`, `recordUpgradeOnChain`

### `client/src/components/game/LandSheet.tsx`
- `SubParcelUpgradePanel` now accepts `biome: BiomeType` prop
- Biome badge shown in panel header (coloured with `biomeColors[biome]`)
- Facility buttons: show biome-adjusted cost, strikethrough original if discounted, green `↓X%` or amber `↑X%` indicator
- Defense buttons: same biome-adjusted cost display
- Both button types show `"Insufficient FRNTR"` / `"Insufficient resources"` inline when player can't afford
- `SubParcelGrid` Buy button:
  - Shows price inline (`Buy 25F`) instead of just "Buy"
  - Disabled (with title tooltip) when player lacks funds
  - `canAffordBuy` computed client-side for instant feedback
- Passes `biome={parcel.biome}` down to `SubParcelUpgradePanel`
- Imports added: `BiomeType`, `getBiomeUpgradeMultiplier`

---

## Current Phase 5 Status

| Feature | Status |
|---------|--------|
| Purchase sub-parcels (FRNTR) | ✅ Done |
| 4-way revenue split on purchase | ✅ Done |
| Build facility improvements | ✅ Done |
| Build defense improvements | ✅ Done |
| Biome cost multipliers (backend) | ✅ Done this session |
| Biome discount/premium UI | ✅ Done this session |
| Affordability enforcement in UI | ✅ Done this session |
| WebSocket broadcast on purchase/build | ✅ Done this session |
| Upstash world event stream (sub-parcels) | ✅ Done this session |
| Algorand on-chain upgrade recording | ✅ Done this session |
| Sub-parcel trading (transfer) | ⬜ Planned |
| Independent sub-parcel battles | ⬜ Planned |
| 3×3 globe overlay | ⬜ Planned |
| Reconquest for subdivided plots | ⬜ Planned |

---

## Next Steps

1. **Sub-parcel battles** — independent attack/defend mechanic per sub-parcel
2. **Reconquest** — when a subdivided plot is captured, what happens to sub-parcel ownership?
3. **Globe overlay** — 3×3 grid rendered on zoomed globe, colour-coded by owner
4. **Sub-parcel trading** — list/buy/transfer sub-parcels via Trade Station
5. **Biome in world events** — resolve actual biome string server-side (currently sends `"unknown"`)

---

## Branch
`claude/biome-upgrades-blockchain-CMDO8`
