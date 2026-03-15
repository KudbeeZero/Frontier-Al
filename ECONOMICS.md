# FRONTIER Economics & Tokenomics

This document covers the complete financial model for the FRONTIER game economy — land pricing, sub-parcel fees, token flows, and the protocol treasury (central bank).

---

## 1. Parcel (Macro-Plot) Prices

Macro-plots are purchased with **ALGO** (Algorand native token), paid directly to the admin wallet. Prices are fixed by biome:

| Biome       | Price (ALGO) | Zone Name       | Notes                    |
|-------------|-------------|-----------------|--------------------------|
| Water       | 1.50 ALGO   | Aquatic Rift    | Highest strategic value  |
| Volcanic    | 1.00 ALGO   | Volcanic Core   | High yield, high risk    |
| Mountain    | 0.80 ALGO   | AI Nexus        |                          |
| Forest      | 0.50 ALGO   | Storm Belt      |                          |
| Tundra      | 0.40 ALGO   | Ice Sector      |                          |
| Plains      | 0.30 ALGO   | Launch District |                          |
| Swamp       | 0.30 ALGO   | Arena District  |                          |
| Desert      | 0.20 ALGO   | Canyon Zone     | Lowest base cost         |

**Payment flow:** Player sends ALGO to admin wallet on-chain → server confirms → DB records ownership → plot NFT (Algorand ASA) minted to player.

---

## 2. Sub-Parcel Prices

Sub-parcels are purchased with **FRONTIER (FRNTR)** tokens. Pricing is derived from the parent biome's ALGO cost:

```
price = max(10, min(100, round(algoBase × 50)))  FRONTIER
```

| Biome       | Base (ALGO) | Sub-Parcel Price (FRNTR) |
|-------------|------------|--------------------------|
| Water       | 1.50       | 75 FRNTR                 |
| Volcanic    | 1.00       | 50 FRNTR                 |
| Mountain    | 0.80       | 40 FRNTR                 |
| Forest      | 0.50       | 25 FRNTR                 |
| Tundra      | 0.40       | 20 FRNTR                 |
| Plains      | 0.30       | 15 FRNTR                 |
| Swamp       | 0.30       | 15 FRNTR                 |
| Desert      | 0.20       | 10 FRNTR (minimum)       |

**Prerequisites:** A player must hold a macro-plot for **4 hours** before they can subdivide it into 9 sub-parcels.

---

## 3. Sub-Parcel Fee Flow (70/30 Split)

When a player purchases a sub-parcel:

```
Total Cost = purchasePriceFrontier (15–75 FRNTR depending on biome)

  ↓ 70% → Macro-plot owner (FRONTIER credited to their in-game balance)
  ↓ 30% → Protocol treasury (recorded in treasury_ledger DB table)

  Special case: If the macro-plot has no owner (or buyer IS the owner),
  the owner's 70% is also routed to the protocol treasury.
```

**Example (Forest plot, 25 FRNTR sub-parcel):**
- Macro owner receives: 17.50 FRNTR
- Protocol treasury: 7.50 FRNTR

---

## 4. Protocol Treasury (Central Bank)

The protocol treasury accumulates FRONTIER fees from sub-parcel purchases. This implements a hybrid custody model:

### Architecture

| Layer | What | Where |
|-------|------|--------|
| Real-time tracking | `treasury_ledger` table in PostgreSQL | Server DB |
| On-chain settlement | Periodic batch transfer to admin wallet | Algorand |

### treasury_ledger Table

Each fee event creates a row:
- `event_type`: `sub_parcel_purchase` or `sub_parcel_purchase_no_owner`
- `amount_micro`: FRONTIER amount in micro units (1 FRNTR = 1,000,000 micro)
- `from_player_id`: buyer
- `settled`: false until on-chain batch runs
- `settle_tx_id`: Algorand txId when settled

### Settlement

Settlement runs automatically every **24 hours** (or manually via admin):
1. All unsettled rows summed
2. Admin wallet executes a self-transfer recording the amount on-chain
3. Rows marked `settled = true` with the Algorand txId

**Auto-settle threshold:** If unsettled balance exceeds **1,000 FRNTR**, settlement triggers immediately (on next purchase event).

---

## 5. FRONTIER Tokenomics

### Supply

| Metric | Value |
|--------|-------|
| Total Supply | 1,000,000,000 FRNTR (fixed, on-chain) |
| Decimals | 6 |
| On-chain ID | Algorand Standard Asset (ASA) |

### Generation (Inflows)

| Source | Rate |
|--------|------|
| Base plot ownership | 1 FRNTR/day per plot |
| + Electricity facility | +1 FRNTR/day |
| + Blockchain Node L1 | +2 FRNTR/day |
| + Blockchain Node L2 | +3 FRNTR/day |
| + Blockchain Node L3 | +4 FRNTR/day |
| Welcome bonus | 500 FRNTR (one-time) |

### Sinks (Burns / Protocol Fees)

| Sink | Cost |
|------|------|
| Electricity facility | 30 FRNTR |
| Blockchain Node L1–L3 | 120 / 270 / 480 FRNTR |
| Data Centre L1–L3 | 120 / 270 / 480 FRNTR |
| AI Lab L1–L3 | 120 / 270 / 480 FRNTR |
| Commander (Sentinel) | 50 FRNTR |
| Commander (Phantom) | 150 FRNTR |
| Commander (Reaper) | 400 FRNTR |
| Special attacks | 10–40 FRNTR |
| Recon drones | 20 FRNTR each |
| Orbital satellites | 50 FRNTR each |
| Landmarks | 400–800 FRNTR + rare minerals |
| Sub-parcel purchase (treasury) | 30% of purchase price |

---

## 6. Player Economics: Maximizing Yield

### Sub-Parcel Full Control Bonus

If one player owns **all 9 sub-parcels** of a subdivided plot:
- **+50% yield multiplier** (`SUB_PARCEL_FULL_CONTROL_BONUS = 1.5×`)
- Passive income for the macro-plot owner: 70% of each sub-parcel sale

### Strategy Summary

1. **Own a plot** → earn base 1 FRNTR/day
2. **Build Blockchain Node L3** → earn up to 4 FRNTR/day (+480 FRNTR cost)
3. **Hold 4h** → subdivide into 9 sub-parcels
4. **Other players buy sub-parcels** → you earn 70% of each fee
5. **Own all 9** → +50% yield bonus on the whole plot

### Economics API

Real-time token metrics are available at `GET /api/economics`:

```json
{
  "totalSupply": 1000000000,
  "treasury": 950000000,
  "circulating": 50000000,
  "inGameCirculating": 48750000,
  "totalBurned": 1250000,
  "protocolTreasuryUnsettled": 342.5,
  "protocolTreasuryTotal": 1027.5,
  "unitName": "FRNTR",
  "network": "Algorand TestNet"
}
```
