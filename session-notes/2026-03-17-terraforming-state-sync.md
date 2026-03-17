# Session: Terraforming State Sync — 2026-03-17

**Branch:** `claude/terraforming-state-sync-fmFyy`
**Task:** Implement terraforming so the same land NFT identity is preserved after a terraform operation. No burn/remint required.

---

## Architecture Decision

**Chosen Path:** Update same land asset / backend-canonical state.

The `/nft/metadata/:plotId` endpoint was already **dynamic** — it reads from the DB at request time. This means:
- Biome changes in DB → metadata endpoint returns updated biome automatically
- Same ASA, same `assetURL`, same wallet-linked identity
- No burn/remint needed

The `metadataVersion` field lets indexers detect when content has changed, even though the URL is stable.

---

## Files Modified

| File | Change |
|------|--------|
| `migrations/0002_terraform_state.sql` | New migration: 6 terraform tracking columns on `parcels` |
| `server/db-schema.ts` | Added 6 columns to `parcels` Drizzle schema |
| `shared/schema.ts` | Added 6 fields to `LandParcel` interface |
| `server/storage/game-rules.ts` | `rowToParcel` maps all new fields |
| `server/storage/db.ts` | `terraformParcel` sets all tracking fields, derives status |
| `server/routes.ts` | Metadata endpoint returns terraform state, Cache-Control reduced |
| `client/src/terraforming.ts` | `TerraformState` extended; `applyTerraform` updates tracking |
| `client/src/components/game/LandSheet.tsx` | Terraform status badge + post-action confirmation banner |
| `CHANGES.md` | Session documented |

---

## New DB Columns (parcels table)

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `terraform_status` | varchar(20) | 'none' | 'none' \| 'active' \| 'degraded' |
| `terraformed_at` | bigint | null | Unix ms of last terraform action |
| `terraform_level` | integer | 0 | Cumulative action count |
| `terraform_type` | varchar(30) | null | Last action type string |
| `metadata_version` | integer | 1 | Increments on every state change |
| `visual_state_revision` | integer | 0 | Increments on biome/visual changes |

---

## Terraform NFT Strategy: No Burn/Remint

- Same ASA identity after every terraform operation
- Metadata URL baked at mint time; content is live from DB
- `metadataVersion` in ARC-3 properties tracks content version for indexers
- Cache-Control reduced to 1h so wallets pick up biome changes within the hour
- Burn/remint path documented but deliberately not implemented

## Status Derivation

`terraformStatus` is computed server-side from current `hazardLevel` and `stability`:
- `hazardLevel > 60` OR `stability < 30` → `"degraded"`
- otherwise → `"active"`
- `"none"` is the initial state for untouched plots

---

## UI Changes

- Biome zone header now shows `Lvl N Terraformed` or `Lvl N ⚠ Degraded` badge
- Terraform info row: last action type, date, hazard%, stability%
- Post-terraform confirmation banner: `Desert → Forest Lvl 2` style display

---

## Future Upgrade Paths

- ARC-69 note-field metadata for zero-latency on-chain state (no cache issue)
- Richer biome transition animations using `visualStateRevision` as trigger
- Terraform level gating for higher-tier upgrades
- Optional collectible tier NFTs at high terraform levels
