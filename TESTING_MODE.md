# FRONTIER: Game Testing Mode - Comprehensive Guide

## Overview
Frontier AL is now live on Algorand Testnet and ready for game testing. This guide covers all systems, known behaviors, and how to report issues.

## Current System Status

### Production Ready
- ✅ **All 31 unit tests passing** — TypeScript clean, no errors
- ✅ **Blockchain confirmed** — ASA 755818217 (FRONTIER token)
- ✅ **Network**: Algorand TestNet
- ✅ **Economy mode**: `testing` (50 FRNTR/day emission)
- ✅ **Commander tiers** fully functional: Sentinel (10 FRNTR), Phantom (25 FRNTR), Reaper (50 FRNTR)

### Deployed Components
1. **3D Globe** — 21,000 hexagonal parcels, clickable selection
2. **Wallet Integration** — PERA, DEFLY, KIBISIS, LUTE wallets
3. **Land Ownership System** — NFT minting + delivery pipeline
4. **AI Factions** — NEXUS-7, KRONOS, VANGUARD, SPECTRE
5. **Resource Economy** — Iron, fuel, crystal, food, daily emissions
6. **Battle System** — Territory conflicts, damage tracking
7. **Terraform System** — 6 DB fields for land evolution
8. **Tutorial System** — Interactive onboarding with skip option
9. **Landing Page** — Mobile responsive (scales from desktop → phone)

---

## Testing Focus Areas

### 🔴 Priority 1: Critical Game Loops (Must Pass)

#### 1.1 Commander NFT Minting
**Goal**: Verify NFT purchase and mint flow works end-to-end

**Steps**:
1. Open landing page
2. Click "▶ Enter Game"
3. Connect wallet (Pera recommended for testnet)
4. Navigate to **Commander** tab (top-right panel)
5. Click "Mint Sentinel" button (10 FRNTR + 0.001 ALGO fee)
6. Confirm wallet transaction
7. **Expected**: NFT appears in Commander panel with ID, image, transfer history

**Success Criteria**:
- [ ] Pricing displays correctly (10 FRNTR for Sentinel, 25 for Phantom, 50 for Reaper)
- [ ] Wallet transaction shows both FRNTR cost + ALGO network fee
- [ ] NFT appears in UI within 3 seconds of confirmation
- [ ] Can see NFT in Pera Wallet app under "Assets"

**Report If**:
- Price shows wrong format (e.g., "USD" instead of "FRNTR")
- NFT doesn't appear after transaction confirms
- Transaction fails with cryptic error
- Wallet gets charged but NFT never mints

---

#### 1.2 Land Plot Ownership
**Goal**: Verify parcel selection, purchase, and on-chain transfer

**Steps**:
1. Click any unowned parcel (white/gray hexagon)
2. Click "Buy Plot" button
3. Enter amount or use preset
4. Confirm wallet transaction
5. **Expected**: Parcel changes color to player's faction color; ownership persists on reload

**Success Criteria**:
- [ ] Parcel visually highlights when selected
- [ ] Buy button shows correct ALGO cost
- [ ] After purchase, parcel color changes instantly
- [ ] Refresh page → parcel still owned (database persistent)
- [ ] Owner name appears in parcel details panel

**Report If**:
- Parcel doesn't change color after purchase
- Ownership reverts on page reload (database issue)
- Transaction confirms but ownership doesn't update
- UI shows parcel owned by different player

---

#### 1.3 AI Faction Behavior
**Goal**: Observe AI factions expanding territory autonomously

**Steps**:
1. Play for ~2 minutes
2. Watch globe for faction color changes
3. Open "World Events" panel
4. Check "Leaderboard" for resource rankings

**Success Criteria**:
- [ ] AI factions claim parcels without player input
- [ ] Faction colors spread visibly across globe
- [ ] Each faction has ~20-30% of parcels claimed
- [ ] World Events log shows faction actions (e.g., "NEXUS-7 claimed 47 parcels")
- [ ] Leaderboard updates in real-time

**Report If**:
- AI factions don't claim any parcels (stuck)
- Only one faction expands (others broken)
- Faction claims parcels in impossible patterns (spatial logic issue)
- Leaderboard shows wrong faction values

---

### 🟡 Priority 2: Ecosystem Stability (Should Not Break)

#### 2.1 Database Persistence
**Test**: State survives browser close/reopen

1. Claim 3 parcels
2. Note your parcel IDs
3. Close browser completely
4. Reopen app
5. **Expected**: All 3 parcels still owned, same faction color

**Report If**:
- Parcels revert to unowned
- Ownership switches to different faction
- Parcel details missing (terraform fields blank)

---

#### 2.2 WebSocket Real-Time Updates
**Test**: Multi-player actions appear instantly

1. Open game in **two browser tabs** (same player)
2. In Tab A: Claim a parcel
3. In Tab B: **Without refreshing**, watch globe
4. **Expected**: Parcel color changes instantly in Tab B

**Report If**:
- Parcel doesn't update in other tab (need manual refresh)
- Update shows with >5s delay
- Connection drops/reconnects constantly in console

---

#### 2.3 API Performance
**Test**: Endpoints respond quickly

Run these commands and note response times:
```bash
# Should respond <100ms
curl -w "Time: %{time_total}s\n" http://localhost:5000/api/game/state

# Should respond <50ms
curl -w "Time: %{time_total}s\n" http://localhost:5000/api/blockchain/status

# Should respond <200ms (first time), <50ms after
curl -w "Time: %{time_total}s\n" http://localhost:5000/api/economics
```

**Report If**:
- Any endpoint >500ms response time
- Repeated 5xx errors in console
- Blockchain status shows `ready: false`

---

### 🟢 Priority 3: Mobile Experience (Nice to Have)

#### 3.1 Landing Page Responsiveness
**Test**: Page scales correctly on mobile sizes

1. Open landing page
2. Resize browser:
   - **Desktop** (1200px+) — Planet 320px, Rocket visible to right
   - **Tablet** (768px) — Planet 240px, Rocket scaled down
   - **Phone** (480px) — Planet 200px, Rocket stacked below

3. **Expected**: Planet always visible, Rocket always present, text readable

**Report If**:
- Planet overflows screen (horizontal scroll needed)
- Rocket hidden or clipped
- Text too small to read (<12px)
- Hero section has weird layout (gap too wide)

---

#### 3.2 Game 3D Viewport on Mobile
**Test**: Globe renders and rotates on mobile browser

1. Open game on iPhone/Android
2. Tap to select a parcel
3. Rotate device (landscape)
4. **Expected**: Globe visible, responsive to touch, parcels clickable

**Report If**:
- Black screen (WebGL disabled)
- Globe doesn't rotate smoothly (<15 FPS)
- Touch selection doesn't work

---

## Known Issues & Workarounds

### ⚠️ Server Cold Start (30-second delay)
**Symptom**: First page load shows "CONNECTION ERROR" for ~20-30 seconds

**Why**: Server initializes 21,000 parcels from database on startup

**Workaround**: 
1. Wait 30 seconds
2. Refresh page (F5)
3. Game loads normally

**This is NOT a bug** — initialization time is expected on cold start

---

### ⚠️ WebGL in Replit Screenshots
**Symptom**: Replit "Take Screenshot" shows black game screen

**Why**: Screenshot tool doesn't support WebGL rendering

**Reality**: All real browsers (Chrome, Safari, Firefox, etc.) render the 3D globe perfectly

**Fix**: Use your actual browser, not the screenshot tool

---

### ⚠️ Stale Cache on Commander Prices
**Symptom**: Price displays old format (e.g., "USD" instead of "FRNTR")

**Why**: Browser cached an old version of the page

**Fix**: Force refresh
- **Windows/Linux**: Ctrl+Shift+R
- **Mac**: Cmd+Shift+R

---

### ⚠️ Parcel Not Updating Real-Time
**Symptom**: Claimed a parcel in Tab A; Tab B still shows it as unowned (without refresh)

**Why**: WebSocket reconnecting or message lost in transit

**Fix**: Wait 3 seconds, then refresh Tab B. If still broken, file a bug.

---

### ⚠️ Tutorial Shows "Waiting for Action"
**Symptom**: Can't get past "Select a Plot" step

**Why**: Tutorial expects you to actually click a parcel and select it

**Fix**: Either:
1. **Skip the step**: Click "Skip Step →" button
2. **Complete the action**: Click any parcel, then click the selection in the details panel

---

## Bug Reporting Guide

### When You Find a Bug, Provide:

1. **Exact steps to reproduce** (numbered list)
2. **Expected vs actual** (what should happen vs what did happen)
3. **Browser + screen size** (e.g., "Chrome on iPhone 12, 390px")
4. **Console errors** (F12 → Console tab → copy red text)
5. **Network errors** (F12 → Network tab → look for red 5xx or failed requests)
6. **Time of occurrence** (so we can cross-reference server logs)

### Example Bug Report ✅
```
TITLE: Commander Phantom tier shows wrong price

STEPS:
1. Open game
2. Go to Commander tab
3. Look at Phantom row
4. Price shows "25 USD" instead of "25 FRNTR"

EXPECTED:
Price shows "25 FRNTR + 0.001 ALGO"

ACTUAL:
Price shows "25 USD" (and ALGO fee missing)

BROWSER:
Chrome on MacBook Pro, 1440px wide

CONSOLE ERRORS:
None visible

NETWORK:
GET /api/nft/commander-price/phantom returns:
{
  "frntrCost": 25,
  "algoNetworkFee": 0.001,
  ...
}
(Correct response, so it's a UI bug)

TIME:
2026-03-17 23:45:00 UTC
```

---

## Testing Checklist

### Day 1: Core Loops
- [ ] Connect wallet successfully
- [ ] Purchase Commander NFT (all 3 tiers)
- [ ] Claim plot and verify ownership
- [ ] See NFT appear in Commander panel
- [ ] Refresh page → data persists

### Day 2: Multiplayer
- [ ] Open game in 2 tabs
- [ ] Claim plot in Tab A
- [ ] Verify plot updates instantly in Tab B (no refresh needed)
- [ ] Check WebSocket console (F12 → Network → WS) — no errors

### Day 3: AI & Factions
- [ ] Play 5 minutes, watch AI factions expand
- [ ] Check Leaderboard — all 4 factions have >10% territory
- [ ] Check World Events — see at least 5 faction actions logged

### Day 4: Mobile
- [ ] Test landing page on phone (portrait)
- [ ] Test game viewport on tablet (landscape)
- [ ] Test parcel selection on mobile (tap/touch)

### Day 5: Edge Cases
- [ ] Leave game idle 10 minutes, come back → state correct
- [ ] Toggle dark/light mode → UI still readable
- [ ] Switch wallets → player switches correctly
- [ ] Run `npx vitest run` → all 31 tests pass

---

## Quick Reference: API Endpoints

```bash
# Check if server is alive
curl http://localhost:5000/api/blockchain/status

# Get current economy stats
curl http://localhost:5000/api/economics

# Get full game state (21,000 parcels)
curl http://localhost:5000/api/game/state

# Get commander pricing (all tiers)
curl http://localhost:5000/api/nft/commander-price/sentinel
curl http://localhost:5000/api/nft/commander-price/phantom
curl http://localhost:5000/api/nft/commander-price/reaper

# Get parcel details by ID
curl http://localhost:5000/api/plots/1/state

# Get player info
curl http://localhost:5000/api/players/current

# Run tests
npx vitest run
```

---

## Reach Out If

- Game doesn't load after 60 seconds (skip 30s cold-start rule)
- Same error happens twice in a row (not a one-off network hiccup)
- Data loss occurs (parcels disappear, wallet balance wrong)
- Game crashes (JavaScript error, not connection timeout)
- Performance degrades (frame rate <10 FPS, >5s lag)

**Contact**: DM [@ascendancyalgox](https://x.com/ascendancyalgox) on X with the bug report template above.

---

## Summary
Frontier AL is ready for comprehensive testing. Focus on core game loops, watch for data persistence issues, and report any crashes or unexpected behavior. Happy testing!
