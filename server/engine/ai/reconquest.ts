/**
 * server/engine/ai/reconquest.ts
 *
 * FRONTIER AI Reconquest Engine — pure functions, no I/O.
 */

export const RECONQUEST_GRACE_PERIOD_MS     = 6  * 60 * 60 * 1000; // 6 hours
export const RECONQUEST_ATTEMPT_WINDOW_MS   = 48 * 60 * 60 * 1000; // 48 hours
export const RECONQUEST_COST_ESCALATION     = 0.25; // per handover exchange
export const MIN_TERRITORIES_FOR_RECONQUEST = 3;

export type AiBehavior = "expansionist" | "defensive" | "raider" | "economic";

export interface FactionReconquestProfile {
  readinessThreshold:         number;
  aggressionModifier:         number;
  isRaider:                   boolean;
  prefersRichPlots:           boolean;
  minDefenseBeforeReconquest: number;
}

export const FACTION_PROFILES: Record<string, FactionReconquestProfile> = {
  "NEXUS-7": {
    readinessThreshold:         0.6,
    aggressionModifier:         1.3,
    isRaider:                   false,
    prefersRichPlots:           false,
    minDefenseBeforeReconquest: 2,
  },
  "KRONOS": {
    readinessThreshold:         1.2,
    aggressionModifier:         0.6,
    isRaider:                   false,
    prefersRichPlots:           false,
    minDefenseBeforeReconquest: 5,
  },
  "VANGUARD": {
    readinessThreshold:         0.5,
    aggressionModifier:         1.4,
    isRaider:                   true,
    prefersRichPlots:           false,
    minDefenseBeforeReconquest: 1,
  },
  "SPECTRE": {
    readinessThreshold:         0.8,
    aggressionModifier:         1.0,
    isRaider:                   false,
    prefersRichPlots:           true,
    minDefenseBeforeReconquest: 3,
  },
};

export interface ContestedPlot {
  parcelId:            string;
  plotId:              number;
  richness:            number;
  capturedFromFaction: string;
  capturedAt:          number;
  handoverCount:       number;
  currentDefenseLevel: number;
}

export interface AiFactionState {
  id:                  string;
  name:                string;
  behavior:            AiBehavior;
  iron:                number;
  fuel:                number;
  ownedTerritoryCount: number;
  averageDefenseLevel: number;
  moraleDebuffUntil:   number;
  attackCooldownUntil: number;
}

export interface ReconquestDecision {
  shouldAttempt:   boolean;
  targetParcelId:  string | null;
  troopsCommitted: number;
  resourcesBurned: { iron: number; fuel: number };
  reason:          string;
  isRaid:          boolean;
}

export function evaluateReconquest(
  ai:             AiFactionState,
  contested:      ContestedPlot[],
  now:            number,
  randomValue:    number,
  attackBaseCost: { iron: number; fuel: number },
): ReconquestDecision {
  const NO: ReconquestDecision = {
    shouldAttempt: false, targetParcelId: null,
    troopsCommitted: 0, resourcesBurned: { iron: 0, fuel: 0 },
    reason: "no_action", isRaid: false,
  };

  const profile = FACTION_PROFILES[ai.name] ?? FACTION_PROFILES["NEXUS-7"];

  if (ai.ownedTerritoryCount < MIN_TERRITORIES_FOR_RECONQUEST)
    return { ...NO, reason: "insufficient_territory" };
  if (ai.attackCooldownUntil > now)
    return { ...NO, reason: "attack_cooldown_active" };
  if (ai.moraleDebuffUntil > now)
    return { ...NO, reason: "morale_debuff_active" };
  if (ai.averageDefenseLevel < profile.minDefenseBeforeReconquest)
    return { ...NO, reason: "fortifying_home_first" };

  const totalResources  = ai.iron + ai.fuel;
  const attackCostTotal = attackBaseCost.iron + attackBaseCost.fuel;
  const threshold       = (profile.readinessThreshold / profile.aggressionModifier) * attackCostTotal;

  if (totalResources < threshold)
    return { ...NO, reason: "building_resources" };

  const eligible = contested.filter((p) => {
    const age = now - p.capturedAt;
    return age >= RECONQUEST_GRACE_PERIOD_MS &&
           age <= RECONQUEST_GRACE_PERIOD_MS + RECONQUEST_ATTEMPT_WINDOW_MS;
  });

  if (eligible.length === 0)
    return { ...NO, reason: "no_eligible_plots" };

  // SPECTRE prefers richest plot; others pick randomly
  let target: ContestedPlot;
  if (profile.prefersRichPlots) {
    const sorted = [...eligible].sort((a, b) => b.richness - a.richness);
    if (sorted[0].richness < 60) return { ...NO, reason: "low_richness_not_worth_it" };
    target = sorted[0];
  } else {
    target = eligible[Math.floor(randomValue * eligible.length)];
  }

  // Escalate cost each time the plot has changed hands
  const escalation      = 1 + target.handoverCount * RECONQUEST_COST_ESCALATION;
  const troopsCommitted = Math.max(1, Math.floor((ai.iron / attackBaseCost.iron) * profile.aggressionModifier * escalation));
  const ironBurn        = Math.min(ai.iron, Math.floor(attackBaseCost.iron * escalation * profile.aggressionModifier));
  const fuelBurn        = Math.min(ai.fuel, Math.floor(attackBaseCost.fuel * escalation * profile.aggressionModifier));

  return {
    shouldAttempt:   true,
    targetParcelId:  target.parcelId,
    troopsCommitted,
    resourcesBurned: { iron: ironBurn, fuel: fuelBurn },
    reason:          profile.isRaider
      ? `${ai.name} raids plot #${target.plotId} for resources`
      : `${ai.name} reconquering lost plot #${target.plotId} (exchange #${target.handoverCount + 1})`,
    isRaid: profile.isRaider,
  };
}

export function shouldAbandonAfterCapture(factionName: string): boolean {
  return FACTION_PROFILES[factionName]?.isRaider ?? false;
}

/** Defense level a human needs to permanently deter further reconquest attempts. */
export function deterrenceThreshold(factionName: string, handoverCount: number): number {
  const profile = FACTION_PROFILES[factionName] ?? FACTION_PROFILES["NEXUS-7"];
  return Math.max(1, (profile.minDefenseBeforeReconquest + 2) - Math.floor(handoverCount * 0.5));
}
