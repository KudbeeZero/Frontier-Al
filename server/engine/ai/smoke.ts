/**

- server/engine/ai/smoke.ts
- Run: npx tsx server/engine/ai/smoke.ts
  */
  import {
  evaluateReconquest,
  shouldAbandonAfterCapture,
  deterrenceThreshold,
  RECONQUEST_GRACE_PERIOD_MS,
  FACTION_PROFILES,
  type AiFactionState,
  type ContestedPlot,
  } from “./reconquest.js”;

function assert(ok: boolean, msg: string) {
if (!ok) { console.error(`❌ FAIL: ${msg}`); process.exit(1); }
console.log(`✅ PASS: ${msg}`);
}

const BASE_AI: AiFactionState = {
id: “ai-nexus”, name: “NEXUS-7”, behavior: “expansionist”,
iron: 200, fuel: 150, ownedTerritoryCount: 10,
averageDefenseLevel: 3, moraleDebuffUntil: 0, attackCooldownUntil: 0,
};

const BASE_COST = { iron: 30, fuel: 20 };
const NOW       = Date.now();

// A plot captured 8 hours ago (past grace period)
const ELIGIBLE_PLOT: ContestedPlot = {
parcelId: “plot-abc”, plotId: 42, richness: 75,
capturedFromFaction: “NEXUS-7”,
capturedAt: NOW - (8 * 60 * 60 * 1000),
handoverCount: 1, currentDefenseLevel: 2,
};

// A plot captured 2 hours ago (inside grace period)
const GRACE_PLOT: ContestedPlot = {
…ELIGIBLE_PLOT, parcelId: “plot-grace”,
capturedAt: NOW - (2 * 60 * 60 * 1000),
};

// ── Test 1: NEXUS-7 should reconquer eligible plot ───────────────────────────
const d1 = evaluateReconquest(BASE_AI, [ELIGIBLE_PLOT], NOW, 0.5, BASE_COST);
assert(d1.shouldAttempt === true,        “NEXUS-7 reconquers eligible plot”);
assert(d1.targetParcelId === “plot-abc”, “Correct target parcel”);
assert(d1.isRaid === false,              “NEXUS-7 is not a raider”);

// ── Test 2: Grace period blocks reconquest ───────────────────────────────────
const d2 = evaluateReconquest(BASE_AI, [GRACE_PLOT], NOW, 0.5, BASE_COST);
assert(d2.shouldAttempt === false, “Grace period blocks reconquest”);
assert(d2.reason === “no_eligible_plots”, “Correct reason: no_eligible_plots”);

// ── Test 3: VANGUARD is a raider ─────────────────────────────────────────────
assert(shouldAbandonAfterCapture(“VANGUARD”) === true,  “VANGUARD abandons after capture”);
assert(shouldAbandonAfterCapture(“NEXUS-7”)  === false, “NEXUS-7 holds territory”);
assert(shouldAbandonAfterCapture(“KRONOS”)   === false, “KRONOS holds territory”);

// ── Test 4: KRONOS requires more resources and higher defense before acting ───
const kronosAI: AiFactionState = { …BASE_AI, name: “KRONOS”, averageDefenseLevel: 2 };
const d4 = evaluateReconquest(kronosAI, [ELIGIBLE_PLOT], NOW, 0.5, BASE_COST);
assert(d4.shouldAttempt === false, “KRONOS waits until home defense is high enough”);
assert(d4.reason === “fortifying_home_first”, “Correct reason: fortifying_home_first”);

// ── Test 5: KRONOS acts when strong enough ────────────────────────────────────
const strongKronos: AiFactionState = {
…BASE_AI, name: “KRONOS”, iron: 1000, fuel: 800, averageDefenseLevel: 6,
};
const d5 = evaluateReconquest(strongKronos, [ELIGIBLE_PLOT], NOW, 0.5, BASE_COST);
assert(d5.shouldAttempt === true, “KRONOS acts when well-stocked and fortified”);

// ── Test 6: SPECTRE ignores low-richness plots ───────────────────────────────
const spectreAI: AiFactionState = { …BASE_AI, name: “SPECTRE”, averageDefenseLevel: 4 };
const lowRichPlot: ContestedPlot = { …ELIGIBLE_PLOT, richness: 30 };
const d6 = evaluateReconquest(spectreAI, [lowRichPlot], NOW, 0.5, BASE_COST);
assert(d6.shouldAttempt === false, “SPECTRE ignores low-richness plot”);

// ── Test 7: SPECTRE takes high-richness plots ─────────────────────────────────
const richPlot: ContestedPlot = { …ELIGIBLE_PLOT, richness: 90 };
const d7 = evaluateReconquest(spectreAI, [richPlot], NOW, 0.5, BASE_COST);
assert(d7.shouldAttempt === true, “SPECTRE reconquers high-richness plot”);

// ── Test 8: Escalating troops/cost per handover ───────────────────────────────
const plot1x: ContestedPlot = { …ELIGIBLE_PLOT, handoverCount: 1 };
const plot3x: ContestedPlot = { …ELIGIBLE_PLOT, handoverCount: 3 };
const r1x = evaluateReconquest(BASE_AI, [plot1x], NOW, 0.5, BASE_COST);
const r3x = evaluateReconquest(BASE_AI, [plot3x], NOW, 0.5, BASE_COST);
assert(r3x.resourcesBurned.iron >= r1x.resourcesBurned.iron, “Cost escalates with handoverCount”);
assert(r3x.troopsCommitted >= r1x.troopsCommitted,           “Troops escalate with handoverCount”);

// ── Test 9: Deterrence threshold decreases with exchanges ─────────────────────
const thresh0 = deterrenceThreshold(“NEXUS-7”, 0);
const thresh3 = deterrenceThreshold(“NEXUS-7”, 3);
assert(thresh3 < thresh0, “Deterrence threshold decreases as exchanges increase”);

// ── Test 10: Insufficient territory blocks reconquest ────────────────────────
const tinyAI: AiFactionState = { …BASE_AI, ownedTerritoryCount: 2 };
const d10 = evaluateReconquest(tinyAI, [ELIGIBLE_PLOT], NOW, 0.5, BASE_COST);
assert(d10.shouldAttempt === false,         “Tiny faction cannot reconquer”);
assert(d10.reason === “insufficient_territory”, “Correct reason”);

console.log(”\n🎮 All FRONTIER AI Reconquest Engine smoke tests passed.”);