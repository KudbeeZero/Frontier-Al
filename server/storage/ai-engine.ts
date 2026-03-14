import { randomUUID } from "crypto";
import type {
  GameEvent,
  MineAction,
  UpgradeAction,
  AttackAction,
  PurchaseAction,
} from "@shared/schema";
import {
  MINE_COOLDOWN_MS,
  UPGRADE_COSTS,
  ATTACK_BASE_COST,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  gameMeta,
  players as playersTable,
  parcels as parcelsTable,
} from "../db-schema";
import { sphereDistance } from "../sphereUtils";
import {
  evaluateReconquest,
  shouldAbandonAfterCapture,
  FACTION_PROFILES,
  type AiFactionState,
  type ContestedPlot,
} from "../engine/ai/reconquest.js";
import { rowToPlayer, rowToParcel } from "./game-rules";

type DB = typeof db;

export type AiOps = {
  mineResources:  (action: MineAction)    => Promise<any>;
  collectAll:     (playerId: string)       => Promise<any>;
  purchaseLand:   (action: PurchaseAction) => Promise<any>;
  deployAttack:   (action: AttackAction)   => Promise<any>;
  upgradeBase:    (action: UpgradeAction)  => Promise<any>;
  addEvent:       (event: Omit<GameEvent, "id"> & { id?: string }) => Promise<void>;
};

/**
 * AI turn logic extracted from DbStorage.
 * Caller is responsible for calling initialize() before invoking this function.
 */
export async function runAITurn(db: DB, ops: AiOps): Promise<GameEvent[]> {
  if (process.env.AI_ENABLED !== 'true') return [];
  const now = Date.now();
  const newEvents: GameEvent[] = [];

  const [allAiPlayers, allParcels] = await Promise.all([
    db.select().from(playersTable).where(eq(playersTable.isAi, true)),
    db.select().from(parcelsTable),
  ]);

  const parcelById   = new Map(allParcels.map((p) => [p.id, p]));
  const ownerMap     = new Map<string, string[]>();
  for (const p of allParcels) {
    if (p.ownerId) {
      if (!ownerMap.has(p.ownerId)) ownerMap.set(p.ownerId, []);
      ownerMap.get(p.ownerId)!.push(p.id);
    }
  }

  for (const aiRow of allAiPlayers) {
    if (Math.random() > 0.4) continue;

    const ai = rowToPlayer(aiRow, ownerMap.get(aiRow.id) ?? []);
    const ownedParcels = ai.ownedParcels
      .map((id) => parcelById.get(id))
      .filter((p): p is typeof allParcels[0] => !!p)
      .map(rowToParcel);

    // Mine if cooldown elapsed
    for (const parcel of ownedParcels) {
      if (now - parcel.lastMineTs >= MINE_COOLDOWN_MS) {
        try { await ops.mineResources({ playerId: ai.id, parcelId: parcel.id }); } catch {}
        break;
      }
    }

    // Collect if stored resources are large
    for (const parcel of ownedParcels) {
      if (parcel.ironStored + parcel.fuelStored + parcel.crystalStored > 50) {
        try { await ops.collectAll(ai.id); } catch {}
        break;
      }
    }

    // Special KRONOS logic: Expansion toward NEXUS-7
    if (ai.name === "KRONOS") {
      const nexus = allAiPlayers.find(p => p.name === "NEXUS-7");
      const nexusPlots = nexus ? ownerMap.get(nexus.id) ?? [] : [];
      const isSuppression = nexusPlots.length > 1500;

      if (isSuppression) {
        const MAX_PURCHASES = 2;
        let purchased = 0;
        const range = 0.08 * 1.25;

        let targetPlot: ReturnType<typeof rowToParcel> | undefined;
        if (nexusPlots.length > 0) {
          const firstNexus = parcelById.get(nexusPlots[0]);
          if (firstNexus) targetPlot = rowToParcel(firstNexus);
        }

        for (const parcel of ownedParcels) {
          if (purchased >= MAX_PURCHASES) break;
          const nearby = allParcels.filter((p) => {
            if (p.ownerId || p.purchasePriceAlgo === null || p.biome === "water") return false;
            return sphereDistance(parcel.lat, parcel.lng, p.lat, p.lng) < range;
          });

          if (nearby.length > 0) {
            const sorted = nearby.map(p => {
              let score = sphereDistance(parcel.lat, parcel.lng, p.lat, p.lng);
              if (targetPlot) {
                const vToNexus = { lat: targetPlot.lat - parcel.lat, lng: targetPlot.lng - parcel.lng };
                const vToPlot = { lat: p.lat - parcel.lat, lng: p.lng - parcel.lng };
                const dot = vToNexus.lat * vToPlot.lat + vToNexus.lng * vToPlot.lng;
                const mag1 = Math.sqrt(vToNexus.lat ** 2 + vToNexus.lng ** 2);
                const mag2 = Math.sqrt(vToPlot.lat ** 2 + vToPlot.lng ** 2);
                const cosTheta = dot / (mag1 * mag2 || 1);
                if (cosTheta > Math.cos((35 * Math.PI) / 180)) score -= 0.1;
              }
              return { p, score };
            }).sort((a, b) => a.score - b.score);

            for (const entry of sorted) {
              if (purchased >= MAX_PURCHASES) break;
              const cost = entry.p.purchasePriceAlgo ?? 0.5;
              if ((ai.treasury ?? 0) < cost) break;

              if (process.env.AI_ENABLED === 'true') {
                try {
                  await ops.purchaseLand({ playerId: ai.id, parcelId: entry.p.id });
                  purchased++;

                  // Deduct from treasury
                  await db.update(playersTable)
                    .set({ treasury: sql`${playersTable.treasury} - ${cost}` })
                    .where(eq(playersTable.id, ai.id));

                  const evt: GameEvent = {
                    id: randomUUID(), type: "ai_action", playerId: ai.id, parcelId: entry.p.id,
                    description: `${ai.name} expanded toward NEXUS-7 territory (Cost: ${cost} ALGO)`, timestamp: now,
                  };
                  await ops.addEvent(evt);
                  newEvents.push(evt);
                } catch {}
              }
            }
          }
        }
      }
    }

    // Normal Expand
    if (ai.aiBehavior === "expansionist" || ai.aiBehavior === "economic") {
      if (Math.random() > 0.5) {
        for (const parcel of ownedParcels) {
          const nearby = allParcels.filter((p) => {
            if (p.ownerId || p.purchasePriceAlgo === null || p.biome === "water") return false;
            return sphereDistance(parcel.lat, parcel.lng, p.lat, p.lng) < 0.08;
          });
          if (nearby.length > 0) {
            const target = nearby[Math.floor(Math.random() * nearby.length)];
            if (process.env.AI_ENABLED === 'true') {
              try {
                await ops.purchaseLand({ playerId: ai.id, parcelId: target.id });
                const desc = `${ai.name} purchased new territory`;
                const evt: GameEvent = {
                  id: randomUUID(), type: "ai_action", playerId: ai.id, parcelId: target.id,
                  description: desc, timestamp: now,
                };
                await ops.addEvent(evt);
                newEvents.push(evt);
              } catch {}
            }
            break;
          }
        }
      }
    }

    // Attack
    if (ai.aiBehavior === "expansionist" || ai.aiBehavior === "raider") {
      const inCooldown = ai.attackCooldownUntil && now < ai.attackCooldownUntil;
      if (!inCooldown) {
        let range = 0.11;
        let priorityTargetId: string | undefined;

        // KRONOS: Anti-Nexus scaler
        if (ai.name === "KRONOS") {
          const nexus = allAiPlayers.find(p => p.name === "NEXUS-7");
          const nexusPlots = nexus ? ownerMap.get(nexus.id) ?? [] : [];
          if (nexusPlots.length > 600) {
            range *= 1.25;
            for (const parcel of ownedParcels) {
              const inRangeNexus = nexusPlots.find(nid => {
                const np = parcelById.get(nid);
                return np && sphereDistance(parcel.lat, parcel.lng, np.lat, np.lng) < range;
              });
              if (inRangeNexus) {
                priorityTargetId = inRangeNexus;
                break;
              }
            }
          }
        }

        // VANGUARD: Dedicated Nexus Hunter
        if (ai.name === "VANGUARD") {
          const nexus = allAiPlayers.find(p => p.name === "NEXUS-7");
          const nexusPlots = nexus ? ownerMap.get(nexus.id) ?? [] : [];
          if (nexusPlots.length > 250) {
            range *= 1.4;
            for (const parcel of ownedParcels) {
              const inRangeNexus = nexusPlots.find(nid => {
                const np = parcelById.get(nid);
                return np && sphereDistance(parcel.lat, parcel.lng, np.lat, np.lng) < range;
              });
              if (inRangeNexus) {
                priorityTargetId = inRangeNexus;
                break;
              }
            }
          }
        }

        const canAttack = ai.iron >= ATTACK_BASE_COST.iron && ai.fuel >= ATTACK_BASE_COST.fuel;
        const moraleDebuffed = ai.moraleDebuffUntil && now < ai.moraleDebuffUntil;

        // Vanguard is more aggressive
        const attackThreshold =
          ai.name === "VANGUARD"
            ? (moraleDebuffed ? 0.45 : 0.25)
            : (moraleDebuffed ? 0.6 : 0.4);

        if (canAttack && Math.random() > attackThreshold) {
          if (priorityTargetId) {
            if (process.env.AI_ENABLED === 'true') {
              try {
                await ops.deployAttack({
                  attackerId: ai.id,
                  targetParcelId: priorityTargetId,
                  troopsCommitted: ai.name === "VANGUARD" ? 2 : 1,
                  resourcesBurned: { iron: ATTACK_BASE_COST.iron, fuel: ATTACK_BASE_COST.fuel },
                });

                const desc =
                  ai.name === "VANGUARD"
                    ? `${ai.name} executed Nexus strike`
                    : `${ai.name} launched suppression strike`;

                const evt: GameEvent = {
                  id: randomUUID(),
                  type: "ai_action",
                  playerId: ai.id,
                  parcelId: priorityTargetId!,
                  description: desc,
                  timestamp: now,
                };

                await ops.addEvent(evt);
                newEvents.push(evt);
              } catch {}
            }
          } else {
            for (const parcel of ownedParcels) {
              const targets = allParcels.filter((p) => {
                if (!p.ownerId || p.ownerId === ai.id || p.activeBattleId || p.biome === "water") return false;
                return sphereDistance(parcel.lat, parcel.lng, p.lat, p.lng) < range;
              });

              if (targets.length > 0) {
                const attackTarget = targets[Math.floor(Math.random() * targets.length)];
                if (process.env.AI_ENABLED === 'true') {
                  try {
                    await ops.deployAttack({
                      attackerId: ai.id,
                      targetParcelId: attackTarget.id,
                      troopsCommitted: ai.name === "VANGUARD" ? 2 : 1,
                      resourcesBurned: {
                        iron: ATTACK_BASE_COST.iron,
                        fuel: ATTACK_BASE_COST.fuel,
                      },
                    });

                    const desc = `${ai.name} deployed troops`;

                    const evt: GameEvent = {
                      id: randomUUID(),
                      type: "ai_action",
                      playerId: ai.id,
                      parcelId: attackTarget.id,
                      description: desc,
                      timestamp: now,
                    };

                    await ops.addEvent(evt);
                    newEvents.push(evt);
                  } catch {}
                }
                break;
              }
            }
          }
        }
      }
    }

    // Upgrade defense
    if (ai.aiBehavior === "defensive") {
      if (process.env.AI_ENABLED === 'true') {
        for (const parcel of ownedParcels) {
          if (parcel.defenseLevel < 5 && ai.iron >= UPGRADE_COSTS.defense.iron && ai.fuel >= UPGRADE_COSTS.defense.fuel) {
            try {
              await ops.upgradeBase({ playerId: ai.id, parcelId: parcel.id, upgradeType: "defense" });
            } catch {}
            break;
          }
        }
      }
    }

    // ── AI Reconquest ──────────────────────────────────────────────────────
    // Find plots this faction previously owned that a human has captured.
    // The engine decides whether to attempt a takeback this tick.
    const contestedPlots: ContestedPlot[] = allParcels
      .filter((p) =>
        p.ownerType === "player" &&                          // currently human-owned
        (p as any).capturedFromFaction === ai.name &&        // was taken from this AI
        (p as any).capturedAt != null                        // has a capture timestamp
      )
      .map((p): ContestedPlot => ({
        parcelId:            p.id,
        plotId:              p.plotId,
        richness:            p.richness,
        capturedFromFaction: (p as any).capturedFromFaction,
        capturedAt:          Number((p as any).capturedAt),
        handoverCount:       (p as any).handoverCount ?? 0,
        currentDefenseLevel: p.defenseLevel,
      }));

    if (contestedPlots.length > 0) {
      const avgDefense = ownedParcels.length > 0
        ? ownedParcels.reduce((s, p) => s + p.defenseLevel, 0) / ownedParcels.length
        : 0;

      const factionState: AiFactionState = {
        id:                  ai.id,
        name:                ai.name,
        behavior:            (ai.aiBehavior ?? "expansionist") as AiFactionState["behavior"],
        iron:                ai.iron,
        fuel:                ai.fuel,
        ownedTerritoryCount: ownedParcels.length,
        averageDefenseLevel: avgDefense,
        moraleDebuffUntil:   ai.moraleDebuffUntil ?? 0,
        attackCooldownUntil: ai.attackCooldownUntil ?? 0,
      };

      const decision = evaluateReconquest(
        factionState,
        contestedPlots,
        now,
        Math.random(),         // caller injects randomness
        ATTACK_BASE_COST,
      );

      if (decision.shouldAttempt && decision.targetParcelId) {
        if (process.env.AI_ENABLED === 'true') {
          try {
            await ops.deployAttack({
              attackerId:      ai.id,
              targetParcelId:  decision.targetParcelId,
              troopsCommitted: decision.troopsCommitted,
              resourcesBurned: decision.resourcesBurned,
            });

            const evt: GameEvent = {
              id:          randomUUID(),
              type:        "ai_action",
              playerId:    ai.id,
              parcelId:    decision.targetParcelId,
              description: decision.reason,
              timestamp:   now,
            };
            await ops.addEvent(evt);
            newEvents.push(evt);
          } catch (err) {
            console.warn(`[AI-RECONQUEST] ${ai.name} reconquest attempt failed:`, err instanceof Error ? err.message : err);
          }
        }
      }

      // ── Post-battle VANGUARD raid release ─────────────────────────────
      if (ai.name === "VANGUARD" && shouldAbandonAfterCapture("VANGUARD")) {
        const justConquered = allParcels.filter((p) =>
          p.ownerId === ai.id &&
          (p as any).capturedFromFaction === "VANGUARD" &&
          (p as any).capturedAt != null &&
          (now - Number((p as any).capturedAt)) < 15 * 60 * 1000
        );
        for (const raidPlot of justConquered) {
          if (process.env.AI_ENABLED === 'true') {
            try {
              await db.update(parcelsTable)
                .set({
                  ownerId:              null,
                  ownerType:            null,
                  purchasePriceAlgo:    0.5,
                  capturedFromFaction:  null,
                  capturedAt:           null,
                } as any)
                .where(eq(parcelsTable.id, raidPlot.id));

              const evt: GameEvent = {
                id:          randomUUID(),
                type:        "ai_action",
                playerId:    ai.id,
                parcelId:    raidPlot.id,
                description: `${ai.name} raided plot #${raidPlot.plotId} and withdrew`,
                timestamp:   now,
              };
              await ops.addEvent(evt);
              newEvents.push(evt);
            } catch {}
          }
        }
      }
    }
  }

  // Bump turn counter
  await db.update(gameMeta)
    .set({ currentTurn: sql`${gameMeta.currentTurn} + 1`, lastUpdateTs: now })
    .where(eq(gameMeta.id, 1));

  return newEvents;
}
