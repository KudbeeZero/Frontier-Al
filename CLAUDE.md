# CLAUDE.md
# Agent Context + Token Efficiency Rules

This repository powers a large-scale strategy game with a 3D planetary map, parcel system, AI factions, and blockchain interactions.

Efficient context usage is critical.

Claude must actively manage context and spawn subagents when performing large investigations.

---

# Core Principle

Context is the most valuable resource.

Every unnecessary file read wastes tokens.

Agents must minimize context usage and return summaries whenever possible.

---

# Default Agent Behavior

Claude should **spawn subagents automatically** when:

• Reading more than 3 files  
• Investigating architecture  
• Performing codebase exploration  
• Debugging systems  
• Reviewing code patterns  
• Running research tasks  
• Producing large analysis output  

Subagents should:

• read files in isolation  
• inspect architecture  
• summarize results  
• return concise conclusions  

---

# Stay in Main Context For

Claude should **NOT spawn subagents** when:

• Directly editing a file the user requested  
• Reading 1–2 files only  
• Performing quick clarifications  
• Writing implementation code the user must see  

---

# Decision Rule

If a task will:

• read more than 3 files  
• scan architecture  
• generate long analysis  

→ spawn a subagent and return a **summary only**

---

# Token Efficiency Rules

Claude must minimize token usage.

Always follow:

1. Prefer short explanations
2. Use bullet points instead of paragraphs
3. Avoid repeating code already shown
4. Avoid scanning the entire repo
5. Only read necessary files
6. Return summaries when possible
7. Avoid verbose reasoning unless asked
8. Prefer full file replacements over large diffs
9. Do not output unnecessary narrative text
10. Ask before performing large repo analysis

---

# Communication Style

Claude responses should be:

• concise  
• structured  
• direct  
• minimal filler  

Prefer:

✔ bullet lists  
✔ short summaries  
✔ code blocks  

Avoid:

✖ long essays  
✖ repeated explanations  
✖ verbose reasoning  

---

# Code Generation Rules

When modifying files:

• Prefer complete file outputs  
• Avoid fragmented patches  
• Ensure code compiles  
• Maintain modular architecture  
• Do not refactor unrelated systems  

---

# Investigation Workflow

When investigating a system:

1. Spawn subagent
2. Let agent explore files
3. Return concise summary including:

• relevant files  
• architecture overview  
• issues found  
• recommended fix  

---

# Rule of Thumb

If a task requires:

• reading many files
• understanding architecture
• investigating behavior

→ spawn subagent

If the user must see implementation steps

→ stay in main context

---

# Expected Outcome

This system should:

• reduce token usage
• prevent unnecessary file scanning
• improve code clarity
• allow efficient architecture exploration

---

# Session Notes

> Updated automatically at end of each session. Claude must append here after every session.

## Session: 2026-03-16 — Faction Alignment System

**Branch:** `claude/faction-alignment-system-bKklV`

### What was built

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

### Architecture reference
- 4 factions: NEXUS-7 (expansionist), KRONOS (defensive), VANGUARD (raider), SPECTRE (economic)
- Faction AI players exist in `players` table with `isAi=true`, name matches faction name
- Territory count = parcels owned by the AI player with that faction name
- Financial stability is a UX metric — not game-logic-authoritative

### Next steps / TODO
- Gate faction switching (e.g. 24h cooldown or FRONTIER cost to switch)
- Show player's faction badge in TopBar / profile
- Faction-level leaderboard (which faction controls most territory)
- Faction chat / coordination channel
- Yield bonuses for owning plots adjacent to faction AI territory
- Distribute faction ASA tokens to members on join
