# Session: 2026-03-16 — Faction TODOs + Bug Fixes

**Branch:** `claude/session-notes-documentation-CBKys`

## What was built

### Bug Fix: Faction Tab Black Screen
- **Root cause:** `<ScrollArea className="flex-1">` inside `flex flex-col h-full` needed `min-h-0` to properly collapse within a flex column
- **Fix 1:** Added `overflow-hidden` + `min-h-0` to FactionPanel root div and ScrollArea (`client/src/components/game/FactionPanel.tsx`)
- **Fix 2:** Added `pb-16 overflow-hidden` to the fullscreen panel container in GameLayout so faction cards aren't hidden under the BottomNav (`client/src/components/game/GameLayout.tsx` line ~927)

### Session Notes Migration
- Created `session-notes/` as the canonical home for all session logs
- Migrated previous inline session from `CLAUDE.md` → `session-notes/2026-03-16-faction-alignment.md`
- Updated `CLAUDE.md` Session Notes section to reference the folder instead of storing content inline
- Updated `README.md` to include a **Developer Session Notes** section linking to `session-notes/`
- Updated `session-notes/README.md` index with new entries

### 24h Faction Switching Cooldown
- **Backend (`server/routes.ts`):** `POST /api/factions/:name/join` now enforces a 24h cooldown when switching factions (not first-time join). Returns `{ error, cooldownEndsAt }` on `400`
- **Frontend (`client/src/components/game/FactionPanel.tsx`):** Parses `cooldownEndsAt` from error response and shows a yellow countdown notice ("Faction switch on cooldown — available in Xh Ym")

### TopBar Faction Badge
- **`client/src/components/game/TopBar.tsx`:** Added `playerFactionId` prop; renders a color-coded faction badge pill (NEXUS-7=blue, KRONOS=green, VANGUARD=red, SPECTRE=yellow) next to WalletConnect when player is aligned
- **`client/src/components/game/GameLayout.tsx`:** Passes `player?.playerFactionId` to TopBar

### Faction Leaderboard in FactionPanel
- Added a **Territory Ranking** compact table at the top of the FactionPanel scroll area
- Shows rank, faction color dot, faction name, member count, territory % — sorted by territory descending
- Highlights the player's current faction row; reuses existing factions query data (no new API)

## Key files modified
- `client/src/components/game/FactionPanel.tsx`
- `client/src/components/game/GameLayout.tsx`
- `client/src/components/game/TopBar.tsx`
- `server/routes.ts`
- `CLAUDE.md`
- `README.md`
- `session-notes/README.md`
- `session-notes/2026-03-16-faction-alignment.md` (new)

## Deferred
- **Faction chat / coordination channel** — requires real-time messaging infrastructure
- **Yield bonuses for adjacent territory** — requires parcel adjacency map + yield engine changes
- **Distribute faction ASA tokens on join** — requires Algorand node + transaction signing context
