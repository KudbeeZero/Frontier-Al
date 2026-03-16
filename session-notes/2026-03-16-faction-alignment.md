# Session: 2026-03-16 — Faction Alignment System

**Branch:** `claude/faction-alignment-system-bKklV`

## What was built

**Backend:**
- Added `player_faction_id VARCHAR(20)` and `faction_joined_at BIGINT` to `players` table
- Migration in `server/storage/seeder.ts` (idempotent `ALTER TABLE IF NOT EXISTS`)
- Also added `migrations/0001_faction_alignment.sql` for reference
- Updated `server/storage/game-rules.ts` `rowToPlayer()` to map new fields
- Updated `shared/schema.ts` `Player` interface with `playerFactionId` and `factionJoinedAt`
- Replaced `/api/factions` with enriched version including live stats: `memberCount`, `territoryCount`, `iron`, `fuel`, `treasury`
- Added `POST /api/factions/:name/join` — player aligns with a faction
- Added `POST /api/factions/leave` — player leaves faction (unaligned)
- Added `GET /api/factions/:name/members` — returns member roster for a faction

**Frontend:**
- Created `client/src/components/game/FactionPanel.tsx` — full faction UI with:
  - Per-faction cards: lore, behavior badge, member count, territory plots
  - **Territory Control** bar (% of 21,000 total plots)
  - **Financial Stability** composite score (territory 50% + treasury 30% + resources 20%)
  - Join / Leave buttons with loading states
  - On-chain ASA badge
- Added `"factions"` tab to `BottomNav` (in overflow menu, with Flag icon)
- Wired `FactionPanel` into `GameLayout`:
  - Mobile fullscreen panel (overflow tab)
  - Desktop right sidebar tab (alongside War Room, Rankings, Trade)

## Architecture reference
- 4 factions: NEXUS-7 (expansionist), KRONOS (defensive), VANGUARD (raider), SPECTRE (economic)
- Faction AI players exist in `players` table with `isAi=true`, name matches faction name
- Territory count = parcels owned by the AI player with that faction name
- Financial stability is a UX metric — not game-logic-authoritative

## Key files
- `server/routes.ts` — faction endpoints (lines 633–800)
- `server/services/chain/factions.ts` — FACTION_DEFINITIONS, ASA IDs
- `server/storage/game-rules.ts` — rowToPlayer() mapping
- `shared/schema.ts` — Player interface
- `client/src/components/game/FactionPanel.tsx` — faction UI
- `client/src/components/game/GameLayout.tsx` — faction tab wiring
- `client/src/components/game/BottomNav.tsx` — nav tab definition
- `migrations/0001_faction_alignment.sql` — DB migration reference

## Next steps / TODO
- [x] Fix faction tab black screen (CSS flex/ScrollArea height bug) — done in session 2026-03-16-faction-todos
- [ ] Gate faction switching (24h cooldown) — done in session 2026-03-16-faction-todos
- [ ] Show player's faction badge in TopBar / profile — done in session 2026-03-16-faction-todos
- [ ] Faction-level leaderboard — done in session 2026-03-16-faction-todos
- [ ] Faction chat / coordination channel
- [ ] Yield bonuses for owning plots adjacent to faction AI territory
- [ ] Distribute faction ASA tokens to members on join
