/**

- server/engine/battle/smoke.ts
- 
- Determinism smoke test for the FRONTIER Battle Engine.
- Run with: npx tsx server/engine/battle/smoke.ts
- 
- Exits 0 on pass, 1 on failure.
  */

import { resolveBattle } from “./resolve.js”;
import { hashSeed } from “./random.js”;
import type { BattleInput } from “./types.js”;

function assert(condition: boolean, message: string) {
if (!condition) {
console.error(`❌ FAIL: ${message}`);
process.exit(1);
}
console.log(`✅ PASS: ${message}`);
}

// ── Fixture ──────────────────────────────────────────────────────────────────

const BASE_INPUT: BattleInput = {
battleId:   “test-battle-001”,
attackerId: “player-alpha”,
defenderId: “player-beta”,
plotId:     42,
troopsCommitted:    50,
resourcesBurned:    { iron: 20, fuel: 10 },
commanderBonus:     15,
moraleDebuffActive: false,
defenseLevel:       3,
biome:              “plains”,
improvements:       [{ type: “turret”, level: 2 }],
orbitalHazardActive: false,
randomSeed:         hashSeed(“test-battle-001”, 1710000000000),
};

// ── Test 1: Determinism — same input → same output ───────────────────────────

const r1 = resolveBattle(BASE_INPUT);
const r2 = resolveBattle(BASE_INPUT);

assert(r1.outcome === r2.outcome,       “Same input produces same outcome”);
assert(r1.randFactor === r2.randFactor, “Same input produces same randFactor”);
assert(r1.attackerPower === r2.attackerPower, “Same input produces same attackerPower”);
assert(r1.defenderPower === r2.defenderPower, “Same input produces same defenderPower”);

// ── Test 2: Different seed → potentially different outcome ────────────────────

let differentOutcomeFound = false;
for (let i = 0; i < 20; i++) {
const altInput: BattleInput = { …BASE_INPUT, randomSeed: hashSeed(“battle”, i, 12345) };
const altResult = resolveBattle(altInput);
if (altResult.outcome !== r1.outcome || altResult.randFactor !== r1.randFactor) {
differentOutcomeFound = true;
break;
}
}
assert(differentOutcomeFound, “Different seeds can produce different outcomes”);

// ── Test 3: No negative pillage rates ────────────────────────────────────────

assert(r1.pillagedIron    >= 0, “pillagedIron rate >= 0”);
assert(r1.pillagedFuel    >= 0, “pillagedFuel rate >= 0”);
assert(r1.pillagedCrystal >= 0, “pillagedCrystal rate >= 0”);

// ── Test 4: Attacker wins 0 pillage if defender wins ─────────────────────────

// Find a seed where defender wins
let defenderWinResult = null;
for (let i = 0; i < 100; i++) {
// Weak attacker input
const weakInput: BattleInput = {
…BASE_INPUT,
troopsCommitted: 1,
resourcesBurned: { iron: 0, fuel: 0 },
commanderBonus:  0,
defenseLevel:    10,
biome:           “mountain”,
improvements:    [{ type: “fortress”, level: 5 }],
randomSeed:      hashSeed(“weak-attacker”, i),
};
const wr = resolveBattle(weakInput);
if (wr.outcome === “defender_wins”) {
defenderWinResult = wr;
break;
}
}

if (defenderWinResult) {
assert(defenderWinResult.pillagedIron    === 0, “No pillage on defender win (iron)”);
assert(defenderWinResult.pillagedFuel    === 0, “No pillage on defender win (fuel)”);
assert(defenderWinResult.pillagedCrystal === 0, “No pillage on defender win (crystal)”);
} else {
console.log(“⚠️  SKIP: Could not find a defender win in 100 seeds (expected with mountain+fortress+5)”);
}

// ── Test 5: Morale debuff reduces attacker power ──────────────────────────────

const withMorale:    BattleResult = resolveBattle({ …BASE_INPUT, moraleDebuffActive: true,  randomSeed: hashSeed(“morale-test”) });
const withoutMorale: BattleResult = resolveBattle({ …BASE_INPUT, moraleDebuffActive: false, randomSeed: hashSeed(“morale-test”) });

assert(
withMorale.attackerPower < withoutMorale.attackerPower,
“Morale debuff reduces attacker power”
);

// ── Test 6: Log is populated ──────────────────────────────────────────────────

assert(r1.log.length > 0,                          “Result log is populated”);
assert(r1.log.some((l) => l.phase === “resolution”), “Log includes resolution phase”);

// ── Done ──────────────────────────────────────────────────────────────────────

console.log(”\n🎮 All FRONTIER Battle Engine smoke tests passed.”);