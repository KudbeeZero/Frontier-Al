# FRONTIER Chain Services Audit

**Scope:** [`server/services/chain/*`](../../server/services/chain) + cross-referenced
route handlers in [`server/routes.ts`](../../server/routes.ts).
**Live deployment:** ASA `755818217` on Algorand testnet (admin
`ZK55X7SGIGMLGORVNJHHPTYZMZOGSQNVROBHX7N27X6ZEQRHAZ2UPKOXQU`), faction ASAs
756388635 / 756388636 / 756388647 / 756388648.
**Mode:** Analysis only — no source files modified.

---

## 1. Executive Summary

- ✅ Algorand client wrapper, FRONTIER ASA bootstrap, faction-identity ASA
  bootstrap and Plot/Commander NFT mint+custody+delivery code are **structurally
  sound** and correctly idempotent. The live testnet ASAs were minted by this
  code path.
- ❌ **SEV1 — plot purchase is fully gratis.** The route
  [`POST /api/actions/purchase`](../../server/routes.ts:1352) never calls
  [`verifyAlgoPayment()`](../../server/services/chain/commander.ts:182). The
  buyer is not required to submit an ALGO payment txId; ownership is granted on
  a `playerId+parcelId` request alone. `verifyAlgoPayment` and
  `forwardLiquiditySplit` are imported but unreferenced.
- ❌ **SEV1 — FRNTR burn (clawback) silently fails.** The FRONTIER ASA was
  created without a `clawback` address (see
  [`getOrCreateFrontierAsa`](../../server/services/chain/asa.ts:117) →
  [`createAsa`](../../server/services/chain/asa.ts:74) — `clawback` param is
  never set). Every in-game spend that calls
  [`fireBurn`](../../server/routes.ts:121) → `clawbackFrontierAsa` will be
  rejected on-chain (`asset clawback not allowed`). DB balances drift from
  on-chain reality.
- ⚠ **SEV2 — claim-frontier never charges anything on-chain when ASA is
  unset.** Branch in [route](../../server/routes.ts:1523) silently credits
  in-game balance only, even for a real wallet, if `getFrontierAsaId()`
  returns `null` (e.g. cold-start race).
- ⚠ **SEV2 —
  [`recordUpgradeOnChain`](../../server/services/chain/upgrades.ts:28) passes
  `admin.addr` (Address object) as `sender`/`receiver`** to
  `makePaymentTxnWithSuggestedParamsFromObject` instead of `.toString()` like
  every other module — likely throws under algosdk v3.

Mining is not a chain operation — FRNTR is issued only via `claim-frontier`
based on per-parcel time-accrual, so the user-reported "mining" issue is in
the yield/claim path, not in `mineResources` itself.

---

## 2. Per-File Matrix

### [`chain/types.ts`](../../server/services/chain/types.ts)
| | |
|---|---|
| **Purpose** | Pure TS types: `AssetId`, `MintLandParams`, `MintResult`, `MintIdempotencyKey`. |
| **API surface** | Types only; no runtime exports. |
| **Deps** | None. |
| ✅ | Clean separation, no algosdk import. |
| ⚠ | `MintCommanderParams` is defined inline in `commander.ts` rather than here. |
| ❌ | None. |

### [`chain/client.ts`](../../server/services/chain/client.ts)
| | |
|---|---|
| **Purpose** | Lazy algod/indexer/admin singletons, RPC timing wrapper, `getNetwork`, `getAdminBalance`. |
| **API** | `getAlgodClient`, `getIndexerClient`, `getAdminAccount`, `getAdminAddress`, `getAdminBalance`, `getNetwork`, `assertChainConfig`, `logAlgorandRpcStats`. |
| **Deps** | `algosdk`, env vars `ALGOD_URL`, `INDEXER_URL`, `ALGORAND_ADMIN_MNEMONIC`, `ALGORAND_ADMIN_ADDRESS`, `ALGORAND_NETWORK`. |
| ✅ | Lazy construction lets startup proceed without chain creds. RPC timing diagnostics good. Address mismatch warning at line 161-166. |
| ⚠ | `withRpcTiming` is defined but only used inside `getAdminBalance` — RPC stats are sparse. `setInterval` at [client.ts:76](../../server/services/chain/client.ts:76) leaks in tests (no `unref`). |
| ❌ | None blocking. |

### [`chain/asa.ts`](../../server/services/chain/asa.ts)
| | |
|---|---|
| **Purpose** | FRONTIER ASA bootstrap, lookup, transfer batching, clawback. |
| **API** | `getOrCreateFrontierAsa`, `lookupAsaByCreator`, `isAddressOptedIn`, `batchedTransferFrontierAsa`, `clawbackFrontierAsa`, `transferAsa`, `getFrontierAsaId`, `setFrontierAsaId`. |
| **Deps** | `algosdk`, `chain/client`. |
| ✅ | Idempotent bootstrap with `FORCE_NEW_ASA` guardrail. 16-tx atomic batching for FRNTR transfers reduces fees. |
| ⚠ | `_sendAtomicTransfers` returns `txns.map(t => t.txID())` for individual ids — fine, but we only `waitForConfirmation` on the first one. Sub-tx-id resolution after group submission is correct in algosdk but not asserted here. |
| ❌ | **Created ASA never sets `clawback` (or `freeze`)**, see [createAsa params construction at asa.ts:80-94](../../server/services/chain/asa.ts:80) and [getOrCreateFrontierAsa at asa.ts:150-157](../../server/services/chain/asa.ts:150) — `clawback` param is omitted, defaulting to undefined. Therefore [`clawbackFrontierAsa`](../../server/services/chain/asa.ts:285) will always fail on-chain for the live ASA `755818217`. (See SEV1 #1 below.) |
| ❌ | `lookupAsaByCreator` does not paginate — Algorand returns up to 1000 created assets per call. After mass faction-mint experiments this could miss records. SEV3. |

### [`chain/treasury.ts`](../../server/services/chain/treasury.ts)
| | |
|---|---|
| **Purpose** | Periodic settlement of accumulated DB-tracked treasury fees as an admin self-transfer with a note. |
| **API** | `settleTreasury`, `maybeAutoSettle`, `startTreasurySettlementScheduler`. |
| ✅ | 24h scheduler, threshold-based auto-settle, idempotent — only marks rows after on-chain confirm. |
| ⚠ | `startTreasurySettlementScheduler` is **defined but never invoked** anywhere in the codebase. Verified by file usage — no caller exists. SEV2. |
| ⚠ | `maybeAutoSettle` likewise never called. The "hybrid central bank" model exists in code only. |

### [`chain/factions.ts`](../../server/services/chain/factions.ts)
| | |
|---|---|
| **Purpose** | Mint and persist the four faction identity ASAs. |
| **API** | `bootstrapFactionIdentities`, `getFactionAsaId`, `getAllFactionAsaIds`, `FACTION_DEFINITIONS`. |
| ✅ | DB-cache-then-chain-recover-then-mint flow at [factions.ts:201-267](../../server/services/chain/factions.ts:201) is correct & idempotent. Live ASAs match. Retry/backoff for cold-start algod timeouts. |
| ⚠ | `aiFactionIdentities.factionName` is the conflict target — relies on a unique constraint that is implicit; verify schema. |
| ❌ | None. |

### [`chain/commander.ts`](../../server/services/chain/commander.ts)
| | |
|---|---|
| **Purpose** | Commander NFT mint, transfer, payment verification, liquidity split. |
| **API** | `mintCommanderNft`, `transferCommanderNft`, `forwardLiquiditySplit`, `verifyAlgoPayment`. |
| ✅ | 32-byte name limit respected ([commander.ts:54](../../server/services/chain/commander.ts:54)). Mainnet/testnet freeze-clawback split is sane. |
| ⚠ | `verifyAlgoPayment` does `await import("./client")` inline ([commander.ts:189](../../server/services/chain/commander.ts:189)) — works but indicates the import was added late and not refactored. SEV3. |
| ❌ | `verifyAlgoPayment` and `forwardLiquiditySplit` are **never called** from any route. Both functions are dead code as the wiring stands. SEV1 (relative to the documented economy). |

### [`chain/land.ts`](../../server/services/chain/land.ts)
| | |
|---|---|
| **Purpose** | Plot NFT mint and admin→buyer delivery. |
| **API** | `mintLandNft`, `transferLandNft`, `attemptDelivery`. |
| ✅ | Custody-then-deliver pattern is correct (buyer cannot opt-in to a not-yet-existing ASA). |
| ⚠ | `attemptDelivery` is defined but never called in routes — `/api/nft/deliver/:plotId` calls `transferLandNft` directly ([routes.ts:561](../../server/routes.ts:561)). The retry-loop framing in the doc-comment is aspirational. |
| ❌ | None. |

### [`chain/upgrades.ts`](../../server/services/chain/upgrades.ts)
| | |
|---|---|
| **Purpose** | Fire-and-forget zero-value self-pay note recording sub-parcel upgrade events. |
| ❌ | [upgrades.ts:41-42](../../server/services/chain/upgrades.ts:41) passes `admin.addr` (Address object) for `sender`/`receiver`. Every other module uses `admin.addr.toString()`. In algosdk v3 this throws `address must be a string`. The function is fire-and-forget so the failure is silent — but no on-chain upgrade notes are landing. SEV2. |
| ❌ | Caller isn't visible from the audited routes (see SEV2 below) — function may be dead anyway. |

### [`chain/battleNotes.ts`](../../server/services/chain/battleNotes.ts)
| | |
|---|---|
| **Purpose** | Encode/decode FRNTR-prefixed battle JSON note bytes for transactions. |
| **API** | `buildBattleNote`, `parseBattleNote`. |
| ✅ | Pure, easily unit-tested. |
| ⚠ | Likewise, no caller of `buildBattleNote` is wired into any battle/claim path — battle FRNTR transfers go through `batchedTransferFrontierAsa` which uses its own `batch_claim` note format. SEV3. |

---

## 3. Per-Flow Trace

### 3.1 Wallet connect — `POST /api/actions/connect-wallet`

[`routes.ts:847-884`](../../server/routes.ts:847) → flow:

1. Validate `playerId`, `address` (`algosdk.isValidAddress`).
2. `storage.updatePlayerAddress(playerId, address)` (DB).
3. `storage.getPlayer(playerId)` to read `welcomeBonusReceived`.
4. If first connect: `storage.grantWelcomeBonus(playerId)` (DB +500 FRNTR balance).
5. If `getFrontierAsaId()` & address is real:
   `isAddressOptedIn(address)` → `algod.accountInformation(address).do()`.
6. If opted in: `batchedTransferFrontierAsa(address, 500)` →
   `algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject` → atomic group of
   ≤16, `algod.sendRawTransaction`, `waitForConfirmation`.
7. Response `{ success, welcomeBonus, welcomeBonusTxId }`.

**Notes.** If buyer hasn't yet opted in, the in-game 500 FRNTR is granted but
no on-chain transfer fires; subsequent claims will not retry the welcome bonus.
See [`/api/game/player-by-address/:address` at routes.ts:933](../../server/routes.ts:933) for the
parallel flow used by the wallet-first onboarding path.

### 3.2 FRNTR token claim — `POST /api/actions/claim-frontier`

[`routes.ts:1505-1551`](../../server/routes.ts:1505) → flow:

1. Validate body via `claimFrontierActionSchema`.
2. Fetch player; check `walletAddress` is real.
3. **Step 1 (pre-credit opt-in gate)** — if `asaId && isRealWallet`:
   `isAddressOptedIn(walletAddress)`. If not opted-in → return
   `{ success: false, reason: "wallet_not_opted_in" }` with HTTP 200.
4. **Step 2** — `storage.claimFrontier(playerId)` ([storage/db.ts:843-893](../../server/storage/db.ts:843))
   iterates owned parcels, computes `frontierPerDay × elapsedDays`, updates
   `frntrBalanceMicro` and resets `lastFrontierClaimTs`.
5. **Step 3** — fire-and-forget `batchedTransferFrontierAsa(walletAddress,
   amount)`.
6. Respond immediately `{ success, claimed:{amount}, txId:undefined, asaId }`.

**Note that `txId` in the response is always `undefined`** — the on-chain
transfer is queued, not awaited. Client can never display a txid synchronously.

### 3.3 Plot purchase — `POST /api/actions/purchase`

[`routes.ts:1352-1489`](../../server/routes.ts:1352) → flow:

1. Validate body via `purchaseActionSchema` — `{ playerId, parcelId }`. **No
   `algoPaymentTxId` field.** [shared/schema.ts:497-500](../../shared/schema.ts:497).
2. First-plot check: free; subsequent plots require a connected (valid)
   wallet — but **no payment**.
3. `storage.purchaseLand(action)` ([storage/db.ts:1048-1098](../../server/storage/db.ts:1048))
   sets `parcels.ownerId`, `purchasePriceAlgo := null`, `lastFrontierClaimTs`,
   bumps `players.territoriesCaptured`.
4. Idempotency-guarded fire-and-forget mint:
   `mintLandNft({plotId, receiverAddress, metadataBaseUrl})` →
   create-ASA tx → `waitForConfirmation` → upsert
   `plot_nfts` + mark `mint_idempotency` confirmed.
5. Response `{ success, parcel, nft:{ status:"minting" } }`.

`verifyAlgoPayment` and `forwardLiquiditySplit` are **never invoked**. The
buyer's ALGO balance is unchanged.

### 3.4 Plot NFT delivery — `POST /api/nft/deliver/:plotId`

[`routes.ts:521-574`](../../server/routes.ts:521):

1. Validate `plotId`, `address`.
2. Read `plot_nfts` row; require `assetId` set and `mintedToAddress === admin`.
3. `isAddressOptedIn(address, assetId)` — if false return `{ success:false,
   reason:"not_opted_in", hint:"opt_in_required" }`.
4. `transferLandNft({assetId, toAddress: address})` →
   `algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject` → send →
   `waitForConfirmation`.
5. Update `plot_nfts.minted_to_address := address`.
6. Respond `{ success, plotId, assetId, txId, explorerUrl }`.

### 3.5 Commander mint — `POST /api/actions/mint-avatar`

[`routes.ts:1553-1697`](../../server/routes.ts:1553):

1. `assertPlayerOwnership` → `mintAvatarActionSchema.parse({ playerId, tier })`.
   No txId in schema.
2. FRNTR cost lookup via `COMMANDER_INFO[tier].mintCostFrontier`. If
   `playerFrntr < frntrCost` → 402.
3. `storage.mintAvatar(action)` (DB record of in-game commander avatar).
4. `fireBurn(address, frntrCost, …)` → `clawbackFrontierAsa` (**fails silently
   under SEV1 #1**).
5. Respond `{ success, avatar, frntrCost, currency:"FRNTR", nft:{status:"minting"} }`.
6. Post-response idempotency-guarded
   `mintCommanderNft({commanderId, tier, receiverAddress, metadataBaseUrl})` →
   create-ASA → upsert `commander_nfts` + idempotency confirmed.

The `COMMANDER_ALGO_NETWORK_FEE` (0.001 ALGO) advertised by
[`/api/nft/commander-price/:tier`](../../server/routes.ts:661) is **not collected
from the buyer** — admin pays its own network fee. Acceptable per
`economy-config.ts` doc-comment, but may confuse client UX.

### 3.6 Mining yield → token issuance — `POST /api/actions/mine`

[`routes.ts:1239-1271`](../../server/routes.ts:1239) +
[`storage/db.ts:646-745`](../../server/storage/db.ts:646):

1. Validate via `mineActionSchema`.
2. `storage.mineResources(action)` adds `iron/fuel/crystal` to parcel storage,
   updates `richness`, `influence`, `lastMineTs`. **No FRNTR is issued.**
3. Append `resource_pulse` world event.
4. Response `{ success, yield:{iron,fuel,crystal,mineralDrops} }`.

FRNTR enters circulation only via:
- **Welcome bonus** — `grantWelcomeBonus` adds 500 FRNTR DB-side, optionally
  `batchedTransferFrontierAsa` on-chain.
- **Time accrual** — `claimFrontier` iterates owned parcels and computes
  `frontierPerDay(improvements) × elapsedDays`. The improvements (electricity,
  blockchain_node, data_centre, ai_lab) are the actual emission drivers.
- **Battle/raid rewards** — internal `storage` paths (not audited here).

Therefore the user complaint *"FRNTR token mining"* is best read as:
**FRNTR per-day yield from owned parcels** is computed in
[`calculateFrontierPerDay`](../../server/storage/db.ts:862) and depends on the
parcel having `improvements` and `influence ≥ INFLUENCE_YIELD_THRESHOLD`. Bare
parcels with no buildings will accrue 0 FRNTR. This is by design but easy to
misinterpret as "mining is broken".

---

## 4. Defect List

### SEV1 — blocks user-facing flow

1. **FRONTIER ASA was created without a clawback address; every `fireBurn`
   silently fails on-chain.**
   File: [`chain/asa.ts:117-157`](../../server/services/chain/asa.ts:117) and
   [`chain/asa.ts:285-324`](../../server/services/chain/asa.ts:285).
   `getOrCreateFrontierAsa` calls `createAsa` without a `clawback` field;
   `createAsa` passes that undefined through to
   `makeAssetCreateTxnWithSuggestedParamsFromObject`. Live ASA `755818217`
   therefore has no clawback role, so `clawbackFrontierAsa` returns
   `txn.dead.transaction` errors. DB balance falls but on-chain wallet keeps
   tokens.

2. **Plot purchase does not require or verify any ALGO payment.**
   File: [`routes.ts:1352-1489`](../../server/routes.ts:1352);
   schema [`shared/schema.ts:497-500`](../../shared/schema.ts:497).
   `verifyAlgoPayment` from
   [`chain/commander.ts:182`](../../server/services/chain/commander.ts:182) is
   imported in `routes.ts:22` but never called. ECONOMICS spec
   (`LAND_PURCHASE_ALGO_ACTIVE`) declares 0.1 ALGO/biome charge that is never
   collected.

### SEV2 — silent data inconsistency

3. **`recordUpgradeOnChain` passes algosdk `Address` instead of string.**
   [`chain/upgrades.ts:41-42`](../../server/services/chain/upgrades.ts:41).
   Likely throws `Invalid address` under algosdk ≥ 2.7. Caller(s)
   (sub-parcel upgrade path, not in audited routes) will silently fail.

4. **Treasury settlement scheduler is dead code.**
   `startTreasurySettlementScheduler` and `maybeAutoSettle` in
   [`chain/treasury.ts`](../../server/services/chain/treasury.ts) have no
   callers anywhere. The "hybrid central bank" never runs; protocol fees
   accumulate in DB indefinitely.

5. **Battle-note builder is dead code.**
   [`chain/battleNotes.ts:56`](../../server/services/chain/battleNotes.ts:56)
   `buildBattleNote` has no callers. Battle-derived FRNTR transfers re-use the
   generic `batch_claim` note in `_sendAtomicTransfers`, which doesn't include
   `factionAsaId` — the on-chain auditability claim in the module doc is unmet.

6. **`claim-frontier` skips on-chain transfer if `asaId` is null at request
   time, but credits DB anyway.**
   [`routes.ts:1535`](../../server/routes.ts:1535). On a cold-start race the
   user gets DB FRNTR with no eventual on-chain transfer (no retry queue).

7. **First-plot opt-in welcome bonus has no retry path.**
   [`routes.ts:861-878`](../../server/routes.ts:861). If user wasn't opted in
   at first connect, the 500 FRNTR is granted in DB only and never settled
   on-chain afterward.

### SEV3 — robustness / edge cases

8. **`lookupAsaByCreator` does not paginate** ([asa.ts:36](../../server/services/chain/asa.ts:36)).
   Algorand returns ≤1000 created assets/page; high-volume admin accounts could
   miss the FRONTIER ASA.

9. **`forwardLiquiditySplit` dead code.**
   [`chain/commander.ts:143`](../../server/services/chain/commander.ts:143).
   `LIQUIDITY_WALLET` env var is documented but the function is never wired
   anywhere.

10. **Top-level `algodClient` / `indexerClient` in routes.ts.**
    [`routes.ts:113-114`](../../server/routes.ts:113) constructs eagerly even
    when chain creds are absent (lazy underneath OK, but contradicts the
    "lazy" design of the chain module).

11. **`/api/economics` reports treasury 0 silently** when admin not opted in
    to FRONTIER ASA ([routes.ts:246-256](../../server/routes.ts:246)) — only a
    `console.warn`. Externally exposed metric is misleading.

12. **`setInterval` for RPC stat logging never `unref()`d**
    ([client.ts:76](../../server/services/chain/client.ts:76)) — keeps Node
    event loop alive in unit tests.

13. **`commander.ts` dynamic import.**
    [`commander.ts:189`](../../server/services/chain/commander.ts:189) does
    `await import("./client")` inside a hot path; should be a top-level import.

14. **`batchedTransferFrontierAsa` only `waitForConfirmation` on first txid**
    ([asa.ts:261](../../server/services/chain/asa.ts:261)). Atomic groups
    confirm together so this is correct in practice, but the per-tx ids
    returned are not individually verified before resolving the caller's
    promise.

---

## 5. Fix Plan

Grouped into batches. Each batch is a discrete subtask the orchestrator can
hand to Code mode.

### Batch A — Restore FRNTR economics (SEV1 #1, SEV2 #6,#7)
1. **`chain/asa.ts`**: Add `clawback: account.addr.toString()` (and probably
   `freeze`) to `getOrCreateFrontierAsa`'s `createAsa({...})` call.
   *Why:* Required for `clawbackFrontierAsa` to succeed.
   *Outcome:* Newly-minted ASAs have admin clawback role.
   ⚠ **Live ASA `755818217` is immutable** — clawback cannot be retro-added.
   Either (a) decommission and re-mint a new FRONTIER ASA (`FORCE_NEW_ASA=true`,
   migrate balances) or (b) abandon the clawback model and switch to a
   "spend = transfer to admin" model where the player wallet signs the burn
   themselves. Open question — see §6.
2. **`routes.ts:1535`**: queue a retry job (DB row in
   `pending_frntr_transfers`) when `asaId` is null at claim time so cold-start
   races eventually settle.
3. **`routes.ts:861-878`** + `routes.ts:947-963`: persist a
   `pending_welcome_bonus` flag and re-attempt the on-chain transfer on
   subsequent `/api/blockchain/status` polls or on next `claim-frontier`.

### Batch B — Wire plot-purchase ALGO payment (SEV1 #2)
4. **`shared/schema.ts:497`**: extend `purchaseActionSchema` with
   `algoPaymentTxId: z.string().min(50)` (and possibly `expectedMicroAlgo`).
5. **`routes.ts:1352`**: before `storage.purchaseLand`, look up biome cost from
   `LAND_PURCHASE_ALGO_ACTIVE`, call
   `verifyAlgoPayment({ txId, expectedSender: player.address,
   minMicroAlgo: cost*1e6 })`. Reject 402 on failure. Persist `algoPaymentTxId`
   on the parcel/ledger.
6. (Optional) Wire `forwardLiquiditySplit` in the success path if liquidity
   split is part of the economy.
7. **Client**: PeraWalletConnect signs payment txn → submits → posts `txId` to
   `/api/actions/purchase`. (Out of audit scope, but the orchestrator should
   add a UI subtask.)

### Batch C — Activate dormant chain features (SEV2 #4,#5)
8. **`server/index.ts`** (or wherever bootstrap runs): import
   `startTreasurySettlementScheduler({ getUnsettledTreasuryRows,
   getTreasuryBalance, markTreasurySettled })` and call once on startup.
9. **Battle/raid storage code**: replace generic-note transfers with calls to
   `buildBattleNote(...)`. Re-use `batchedTransferFrontierAsa` but allow a
   per-call note override (small refactor: `queue(toAddress, amount, note?)`).

### Batch D — Robustness fixes (SEV2 #3, SEV3 #8,#9,#10,#11,#12,#13,#14)
10. **`chain/upgrades.ts:41-42`**: change `admin.addr` →
    `admin.addr.toString()` and use the same `withRpcTiming` wrapper.
11. **`chain/asa.ts:36`**: paginate `accountInformation` if `created-assets`
    length === page size, or use Indexer `searchForAssets` filtered by
    creator.
12. **`chain/commander.ts:189`**: hoist `getAdminAddress` import to the top
    of the file.
13. **`chain/client.ts:76`**: add `.unref()` to the `setInterval`.
14. **`routes.ts:113-114`**: drop the eager top-level singletons; call
    `getAlgodClient()` / `getIndexerClient()` inside handlers that use them
    (only `/api/economics`).
15. **`routes.ts:246-256`**: surface treasury-not-opted-in as a structured
    field in the JSON response (`{ adminOptedIn: false }`).

---

## 6. Open Questions for User

1. **Is the live ASA `755818217` final, or can we re-mint with a clawback
   role?** Without clawback, `fireBurn` cannot work — we must either re-mint
   (breaking existing testnet balances) or pivot to a buyer-signed burn model.
2. **Is `claim-frontier` supposed to mint new tokens or transfer from the
   admin treasury?** The current code transfers from admin (treasury model);
   total supply is fixed at 1B. Confirm this matches intent.
3. **Plot purchase: does the buyer pre-sign an ALGO payment in their wallet
   and send `txId`, or do you intend a different flow (e.g. atomic group
   pre-prepared by server)?** Affects `Batch B` design.
4. **Should `COMMANDER_ALGO_NETWORK_FEE` (0.001 ALGO) be charged to the buyer
   or absorbed by admin?** Current code says absorbed; UI implies charged.
5. **Is `recordUpgradeOnChain` actively desired?** No callers were found in
   the audited routes — confirm before fixing.
6. **Liquidity split (`forwardLiquiditySplit` + `LIQUIDITY_WALLET`)** — is it
   live policy or aspirational? Determines whether Batch B step 6 is needed.
