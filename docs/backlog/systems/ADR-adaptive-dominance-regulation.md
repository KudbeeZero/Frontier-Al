# System: Adaptive Dominance Regulation (ADR)

## Purpose
Prevent AI snowballing (especially when player population is low) by dynamically shifting AI aggression, targeting, and expansion behavior to restore balance.

## Core Concepts
- Dominance detection (plots owned %, absolute plots, growth rate)
- Suppression Mode (hysteresis thresholds)
- Target priority against dominant AI
- Controlled expansion + economy constraints (treasury/budget)
- Telemetry + world messaging

## Backlog (Epics / Tickets)

### ADR-0: Dominance detection + mode switching
- Inputs: NEXUS-7 plot count, % of total plots, growth rate, active wallets
- Trigger: enter suppression at > 2000 plots (or > X%); exit below 1500 plots
- Hysteresis required (separate enter/exit thresholds)

### ADR-1: KRONOS aggression ramp vs dominant AI
- Attack frequency multiplier (e.g., 1.5x in suppression)
- Strength multiplier (e.g., +20% in suppression)
- Prioritize dominant AI plots within range

### ADR-2: KRONOS expansion behavior (buy plots)
- Buy up to MAX_PURCHASES_PER_TICK (e.g., 2) while in suppression
- Only buy unowned (or AI-neutral) plots
- Budget/treasury gating + plot cost

### ADR-3: Range + direction bias
- Scan range multiplier in suppression (e.g., 1.25x)
- Direction cone bias toward dominant AI territory (centroid-to-centroid or nearest target)

### ADR-4: Economy safety rails
- Treasury income per tick
- Cooldowns + caps to prevent spam
- Optional: "war tax" on dominant AI

### ADR-5: Telemetry + world events
- Log ADR state transitions
- Optional in-world banner: "KRONOS Counteroffensive Protocol"

## Notes
Keep ADR logic isolated from wallet/player-specific state. Main map remains shared; ADR only changes AI behavior.
