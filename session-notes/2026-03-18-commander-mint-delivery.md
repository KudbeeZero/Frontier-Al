# 2026-03-18 — Commander Mint Delivery Fix

## Problem

Successful commander mint transactions completed but no NFT appeared in the user's wallet. The UI showed no claim button, no status indicator, and left users in an unknown state ("ghost mint").

## Root Cause Analysis

Three compounding bugs caused the broken pipeline:

### Bug 1 (CRITICAL) — API response missing `exists` and `status` fields

`GET /api/nft/commander/:commanderId` returned:
```json
{ "commanderId": "...", "assetId": 123, "mintedToAddress": "...", "mintedAt": 1234567890, "explorerUrl": "..." }
```

But `CommanderNftStatus` component checked `data?.exists` — which was always `undefined` → falsy → component **always rendered null**. The NFT status UI never showed.

### Bug 2 (CRITICAL) — No `status` field returned

Even if `exists` had been present, the component checked `data.status === "minted"` / `"delivered"` — but the API never sent a `status` field. The claim button could never appear.

### Bug 3 (MEDIUM) — No query invalidation + no polling

After `mintAvatarMutation.onSuccess`, the commander NFT query was never invalidated. With `staleTime: 30_000` and `retry: false`, the cached 404 would persist for 30 seconds and never refresh. Users had to manually reload the page.

## Architecture

The mint pipeline uses a **custody model**:
1. User pays FRNTR → in-game avatar created immediately
2. Backend fire-and-forget: admin wallet mints ASA on-chain
3. NFT held in admin custody until user opts-in to ASA
4. User clicks "Claim" → delivery endpoint transfers NFT to user's wallet
5. UI shows green "NFT" badge once delivered

This is correct and production-ready. No architecture change needed.

## Files Changed

| File | Change |
|------|--------|
| `server/routes.ts` | `GET /api/nft/commander/:commanderId` now returns `exists: true` + `status` field; also checks idempotency table to show `"minting"` while async is in-flight |
| `client/src/components/game/CommanderPanel.tsx` | `CommanderNftStatus` polls every 8s while `status === "minting"` or NFT not found; new "Minting…" spinner badge for in-flight state; correct status mapping |
| `client/src/components/game/GameLayout.tsx` | Invalidates commander NFT query on mint `onSuccess` to trigger immediate polling |

## Full Flow (Fixed)

```
User clicks Mint
  → API: POST /api/actions/mint-avatar
      → Creates in-game avatar (immediate)
      → Deducts FRNTR via clawback (fire-and-forget)
      → Returns { success: true, avatar: {...}, nft: { status: "minting" } }
      → Async: mintCommanderNft() → ASA created on-chain
      → DB updated: commanderNfts.assetId set, mintedToAddress = admin

Frontend (onSuccess):
  → Toast: "Commander Minted"
  → queryClient.invalidateQueries(["nft/commander", avatar.id])  ← NEW

CommanderNftStatus component:
  → Polls every 8s while status = "minting" or exists = false
  → Shows "Minting…" spinner badge  ← NEW
  → Once ASA confirmed: shows "ASA {id}" + Claim button

User clicks Claim:
  → POST /api/nft/deliver-commander/:commanderId { address }
  → Checks opt-in, auto-opts-in if needed
  → transferCommanderNft() → ASA sent to user wallet
  → DB: mintedToAddress updated to user wallet

UI: Green "NFT" badge shown. NFT visible in Pera/Lute/etc.
```

## Status Fields

| status | meaning |
|--------|---------|
| `"minting"` | Fire-and-forget async in-flight (idempotency table: pending) |
| `"minted"` | ASA created, held by admin (ready to claim) |
| `"delivered"` | ASA transferred to buyer's wallet |

## Branch

`claude/fix-commander-mint-delivery-J7kDI`

## Commit

`fix: commander mint delivery pipeline — NFT now visible in UI after mint`
