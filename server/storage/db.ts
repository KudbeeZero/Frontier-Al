import { randomUUID } from "crypto";
import { saveBattleReplay, type BattleReplayRecord, getParcelAnimations } from "../services/redis";
import type {
  LandParcel,
  Player,
  Battle,
  GameEvent,
  GameState,
  BiomeType,
  MineAction,
  UpgradeAction,
  AttackAction,
  BuildAction,
  PurchaseAction,
  LeaderboardEntry,
  Improvement,
  MintAvatarAction,
  SpecialAttackAction,
  DeployDroneAction,
  DeploySatelliteAction,
  CommanderAvatar,
  ReconDrone,
  OrbitalSatellite,
  OrbitalEvent,
  OrbitalEffect,
  OrbitalEffectType,
  SlimGameState,
  SlimParcel,
  SlimPlayer,
  SpecialAttackRecord,
  CommanderTier,
} from "@shared/schema";
import {
  biomeBonuses,
  MINE_COOLDOWN_MS,
  BASE_YIELD,
  UPGRADE_COSTS,
  BATTLE_DURATION_MS,
  ATTACK_BASE_COST,
  DEFENSE_IMPROVEMENT_INFO,
  FACILITY_INFO,
  BASE_STORAGE_CAPACITY,
  LAND_PURCHASE_ALGO,
  TOTAL_PLOTS,
  FRONTIER_TOTAL_SUPPLY,
  WELCOME_BONUS_FRONTIER,
  COMMANDER_INFO,
  SPECIAL_ATTACK_INFO,
  DRONE_MINT_COST_FRONTIER,
  MAX_DRONES,
  SATELLITE_DEPLOY_COST_FRONTIER,
  SATELLITE_ORBIT_DURATION_MS,
  MAX_SATELLITES,
  SATELLITE_YIELD_BONUS,
  calculateFrontierPerDay,
  MORALE_DEBUFF_BASE_MS,
  MORALE_ATTACK_PENALTY,
  ATTACK_COOLDOWN_PER_LOSS_MS,
  PILLAGE_RATE,
  CASCADE_DEFENSE_PENALTY,
  COMMANDER_LOCK_MS,
  ORBITAL_RESOURCE_BURST_BONUS,
  ORBITAL_RESOURCE_BURST_MS,
  ORBITAL_TILE_HAZARD_PENALTY,
  ORBITAL_TILE_HAZARD_MS,
  ORBITAL_IMPACT_CHANCE,
} from "@shared/schema";
import type { FacilityType, DefenseImprovementType, ImprovementType } from "@shared/schema";
import { SUB_PARCEL_FACILITY_COSTS, SUB_PARCEL_DEFENSE_COSTS } from "@shared/schema";
import { sphereDistance } from "../sphereUtils";
import {
  evaluateReconquest,
  shouldAbandonAfterCapture,
  type AiFactionState,
  type ContestedPlot,
} from "../engine/ai/reconquest.js";
import {
  BASE_INFLUENCE_DAMAGE,
  INFLUENCE_DAMAGE_REDUCTION_PER_LEVEL,
  MIN_INFLUENCE_DAMAGE,
  INFLUENCE_YIELD_THRESHOLD,
} from "../engine/battle/tuning.js";
import { eq, and, desc, lt, sql, sum } from "drizzle-orm";
import { db } from "../db";
import {
  gameMeta,
  players as playersTable,
  parcels as parcelsTable,
  battles as battlesTable,
  gameEvents as gameEventsTable,
  orbitalEvents as orbitalEventsTable,
  tradeOrders as tradeOrdersTable,
  subParcels as subParcelsTable,
  seasons as seasonsTable,
  treasuryLedger as treasuryLedgerTable,
  predictionMarkets as predictionMarketsTable,
  marketPositions as marketPositionsTable,
  type TradeOrder,
  type InsertTradeOrder,
} from "../db-schema";
import {
  rowToParcel,
  rowToPlayer,
  rowToBattle,
  rowToEvent,
  rowToSubParcel,
  computeLeaderboard,
  canSubdivideParcel,
  buildSubParcelRows,
  computeSubParcelPrice,
  fromMicroFRNTR,
  toMicroFRNTR,
  type ParcelRow,
  type BattleRow,
} from "./game-rules";
import type { SubParcel, Season, PredictionMarket, MarketPosition, MarketOutcome, CreateMarketAction } from "@shared/schema";
import { MARKET_FEE_RATE } from "@shared/schema";
import {
  SUB_PARCEL_HOLD_HOURS,
  SUB_PARCEL_FULL_CONTROL_BONUS,
  SUB_PARCEL_COUNT,
} from "@shared/schema";
import { seedDatabase } from "./seeder";
import { runAITurn as runAITurnFn } from "./ai-engine";
import { buildBattleNote } from "../services/chain/battleNotes";
import { buildNarrative, detectMilestone } from "../engine/narrative/commentator";
import type { IStorage } from "./interface";

type DB = typeof db;

export class DbStorage implements IStorage {
  private readonly db: DB;
  /** In-process singleton guard so concurrent boot requests don't double-seed. */
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required to use DbStorage. Set the env var or leave it unset to use MemStorage.");
    }
    this.db = db;
  }

  // ── initialization ─────────────────────────────────────────────────────────

  /** Lazily initialise the DB world (idempotent — checks game_meta.initialized). */
  async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = seedDatabase(this.db);
    }
    return this.initPromise;
  }

  /** Reset initialization state so seedDatabase runs again on next access. */
  resetInitState(): void {
    this.initPromise = null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Update game_meta.last_update_ts. Accepts an optional transaction. */
  private async bumpLastTs(ts: number, tx?: Parameters<Parameters<DB["transaction"]>[0]>[0]): Promise<void> {
    const runner = tx ?? this.db;
    await runner.update(gameMeta).set({ lastUpdateTs: ts }).where(eq(gameMeta.id, 1));
  }

  /** Insert a game event row. Accepts an optional transaction. */
  private async addEvent(
    event: Omit<GameEvent, "id"> & { id?: string },
    tx?: Parameters<Parameters<DB["transaction"]>[0]>[0]
  ): Promise<void> {
    const runner = tx ?? this.db;
    await runner.insert(gameEventsTable).values({
      id:          event.id ?? randomUUID(),
      type:        event.type,
      playerId:    event.playerId,
      parcelId:    event.parcelId,
      battleId:    event.battleId,
      description: event.description,
      ts:          event.timestamp,
    });
  }

  /**
   * Applies passive influence repair to all parcels owned by human players
   * that are below 100 and have not been repaired recently.
   * Called from the game tick — safe to run every 15 seconds (rate-limited
   * internally by influenceRepairRate which is points-per-DAY).
   */
  private async repairInfluence(now: number): Promise<void> {
    const damaged = await this.db
      .select()
      .from(parcelsTable)
      .where(
        and(
          eq(parcelsTable.ownerType, "player"),
          sql`${parcelsTable.influence} < 100`
        )
      );

    if (damaged.length === 0) return;

    const MS_PER_DAY = 86_400_000;

    for (const row of damaged) {
      // Use lastMineTs as the elapsed reference — it reflects actual player
      // activity. Falls back to lastFrontierClaimTs for plots never mined.
      const lastActivity = Math.max(
        Number(row.lastMineTs) || 0,
        Number(row.lastFrontierClaimTs) || 0
      );
      const elapsedMs = now - lastActivity;
      if (elapsedMs <= 0) continue;

      // 24 pts/day = 1 pt/hr passive repair.
      // One lost battle (15 dmg) fully repairs in ~15 hrs idle.
      const repairRate = (row as any).influenceRepairRate ?? 24.0;
      const repairAmount = (elapsedMs / MS_PER_DAY) * repairRate;
      const currentInfluence = (row as any).influence ?? 100;
      const newInfluence = Math.min(100, currentInfluence + repairAmount);

      if (newInfluence - currentInfluence >= 0.5) {
        await this.db
          .update(parcelsTable)
          .set({ influence: Math.round(newInfluence) })
          .where(eq(parcelsTable.id, row.id));
      }
    }
  }

  /** Compute how much FRONTIER has accumulated on a parcel and update the row. */
  private accumulatedFrontier(parcel: LandParcel, now: number): number {
    if (!parcel.ownerId) return 0;
    const days = (now - parcel.lastFrontierClaimTs) / (1000 * 60 * 60 * 24);
    if (days <= 0) return 0;
    const perDay = calculateFrontierPerDay(parcel.improvements);
    return perDay * days;
  }

  // ── Orbital Event Engine ─────────────────────────────────────────────────

  async getActiveOrbitalEvents(): Promise<OrbitalEvent[]> {
    await this.initialize();
    const now = Date.now();
    const rows = await this.db.select().from(orbitalEventsTable)
      .where(and(eq(orbitalEventsTable.resolved, false), sql`${orbitalEventsTable.endAt} > ${now}`));

    return rows.map((r) => ({
      id:            r.id,
      type:          r.type as OrbitalEvent["type"],
      cosmetic:      r.cosmetic,
      startAt:       Number(r.startAt),
      endAt:         Number(r.endAt),
      seed:          r.seed,
      intensity:     r.intensity,
      trajectory:    r.trajectory as OrbitalEvent["trajectory"],
      targetParcelId: r.targetParcelId ?? undefined,
      effects:       (r.effects ?? []) as OrbitalEffect[],
      resolved:      r.resolved,
    }));
  }

  async createOrbitalImpactEvent(
    type: OrbitalEvent["type"],
    targetParcelId?: string
  ): Promise<OrbitalEvent> {
    await this.initialize();
    const now = Date.now();
    const id = randomUUID();

    // Duration: impact events last 8–15 minutes
    const durationMs = Math.floor((8 + Math.random() * 7) * 60 * 1000);
    const intensity = 0.5 + Math.random() * 0.5;
    const seed = Math.floor(Math.random() * 0x7fffffff);

    // Trajectory: random strike angle
    const trajectory: OrbitalEvent["trajectory"] = {
      startLat: Math.random() * 180 - 90,
      startLng: Math.random() * 360 - 180,
      endLat:   Math.random() * 180 - 90,
      endLng:   Math.random() * 360 - 180,
    };

    // Build gameplay effects based on event type
    const effects: OrbitalEffect[] = [];
    if (type === "IMPACT_STRIKE") {
      effects.push({
        type:        "RESOURCE_BURST" as OrbitalEffectType,
        magnitude:   ORBITAL_RESOURCE_BURST_BONUS,
        durationMs:  ORBITAL_RESOURCE_BURST_MS,
        description: `+${Math.round(ORBITAL_RESOURCE_BURST_BONUS * 100)}% mining yield for affected parcel`,
      });
    } else if (type === "ATMOSPHERIC_BURST") {
      effects.push({
        type:        "TILE_HAZARD" as OrbitalEffectType,
        magnitude:   ORBITAL_TILE_HAZARD_PENALTY,
        durationMs:  ORBITAL_TILE_HAZARD_MS,
        description: `${Math.round(ORBITAL_TILE_HAZARD_PENALTY * 100)}% mining yield reduction (EMP storm)`,
      });
    }

    await this.db.insert(orbitalEventsTable).values({
      id,
      type,
      cosmetic:      false,
      startAt:       now,
      endAt:         now + durationMs,
      seed,
      intensity,
      trajectory,
      targetParcelId,
      effects,
      resolved:      false,
    });

    // Emit a game event so the activity feed shows it
    const systemPlayerId = "system";
    await this.addEvent({
      type:        "orbital_event",
      playerId:    systemPlayerId,
      parcelId:    targetParcelId,
      description: `ORBITAL WARNING: ${type.replace(/_/g, " ")} detected — ${effects[0]?.description ?? "area affected"}`,
      timestamp:   now,
    });

    const event: OrbitalEvent = {
      id, type, cosmetic: false,
      startAt: now, endAt: now + durationMs,
      seed, intensity, trajectory,
      targetParcelId, effects, resolved: false,
    };
    return event;
  }

  async resolveOrbitalEvent(eventId: string): Promise<void> {
    await this.initialize();
    const now = Date.now();
    const [row] = await this.db.select().from(orbitalEventsTable)
      .where(eq(orbitalEventsTable.id, eventId));
    if (!row || row.resolved) return;

    // Apply gameplay effects
    const effects = (row.effects ?? []) as OrbitalEffect[];
    if (row.targetParcelId && effects.length > 0) {
      for (const effect of effects) {
        const [parcelRow] = await this.db.select().from(parcelsTable)
          .where(eq(parcelsTable.id, row.targetParcelId));
        if (parcelRow) {
          // Apply yield multiplier delta (clamped to [0.1, 3.0])
          const current = parcelRow.yieldMultiplier ?? 1.0;
          const newYield = Math.max(0.1, Math.min(3.0, current + effect.magnitude));
          await this.db.update(parcelsTable)
            .set({ yieldMultiplier: newYield })
            .where(eq(parcelsTable.id, row.targetParcelId));
          console.log(
            `[ORBITAL-DEBUG] resolveOrbitalEvent | effect: ${effect.type} | parcel: ${row.targetParcelId} | yield: ${current} → ${newYield}`
          );
        }
      }
    }

    await this.db.update(orbitalEventsTable)
      .set({ resolved: true })
      .where(eq(orbitalEventsTable.id, eventId));
  }

  async triggerOrbitalCheck(): Promise<OrbitalEvent | null> {
    await this.initialize();

    // Roll for impact event
    if (Math.random() > ORBITAL_IMPACT_CHANCE) {
      return null;
    }

    // Pick a random impact type
    const impactTypes: OrbitalEvent["type"][] = ["IMPACT_STRIKE", "ATMOSPHERIC_BURST"];
    const type = impactTypes[Math.floor(Math.random() * impactTypes.length)];

    // Optionally target a random owned parcel
    const allParcels = await this.db.select({ id: parcelsTable.id })
      .from(parcelsTable)
      .where(sql`${parcelsTable.ownerId} IS NOT NULL`)
      .limit(200);

    const targetParcelId = allParcels.length > 0
      ? allParcels[Math.floor(Math.random() * allParcels.length)].id
      : undefined;

    console.log(
      `[ORBITAL-DEBUG] triggerOrbitalCheck | IMPACT triggered | type: ${type} | parcel: ${targetParcelId ?? "global"}`
    );

    return this.createOrbitalImpactEvent(type, targetParcelId);
  }

  async getOrCreatePlayerByAddress(address: string): Promise<Player> {
    await this.initialize();

    const trimmed = address.trim();
    const normalized = trimmed.toLowerCase();

    // Case-insensitive lookup so uppercase Algorand addresses match existing rows.
    const [existing] = await this.db
      .select()
      .from(playersTable)
      .where(sql`lower(${playersTable.address}) = ${normalized}`);

    if (existing) {
      const ownedRows = await this.db
        .select({ id: parcelsTable.id })
        .from(parcelsTable)
        .where(eq(parcelsTable.ownerId, existing.id));

      return rowToPlayer(existing, ownedRows.map(r => r.id));
    }

    const id = randomUUID();
    // Preserve original address case (Algorand addresses are uppercase base32).
    const displayName = `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;

    await this.db.insert(playersTable).values({
      id,
      address: trimmed,
      name: displayName,
      iron: 200,
      fuel: 150,
      crystal: 50,
      frontier: 0,
    });

    const [created] = await this.db
      .select()
      .from(playersTable)
      .where(eq(playersTable.id, id));

    return rowToPlayer(created, []);
  }

  // ── IStorage – read ────────────────────────────────────────────────────────

  async getGameState(): Promise<GameState> {
    await this.initialize();
    await this.resolveBattles();

    const [allParcels, allPlayers, allBattles, recentEvents, [meta], allSubParcels] = await Promise.all([
      this.db.select().from(parcelsTable),
      this.db.select().from(playersTable),
      this.db.select().from(battlesTable),
      this.db.select().from(gameEventsTable).orderBy(desc(gameEventsTable.ts)).limit(50),
      this.db.select().from(gameMeta).where(eq(gameMeta.id, 1)),
      this.db.select({
        parentPlotId: subParcelsTable.parentPlotId,
        subIndex:     subParcelsTable.subIndex,
        ownerId:      subParcelsTable.ownerId,
      }).from(subParcelsTable),
    ]);

    // Build sub-parcel map: parentPlotId → array of 9 owner ids
    const subParcelMap = new Map<number, (string | null)[]>();
    for (const sp of allSubParcels) {
      if (!subParcelMap.has(sp.parentPlotId)) {
        subParcelMap.set(sp.parentPlotId, new Array(9).fill(null));
      }
      subParcelMap.get(sp.parentPlotId)![sp.subIndex] = sp.ownerId ?? null;
    }

    // Build ownedParcels arrays from the parcel rows (avoids a separate join).
    const ownerMap = new Map<string, string[]>();
    for (const p of allParcels) {
      if (p.ownerId) {
        if (!ownerMap.has(p.ownerId)) ownerMap.set(p.ownerId, []);
        ownerMap.get(p.ownerId)!.push(p.id);
      }
    }

    const claimedPlots = allParcels.filter((p) => p.ownerId !== null).length;
    const frontierCirculating = allPlayers.reduce((sum, p) => sum + fromMicroFRNTR(p.frntrBalanceMicro), 0);

    return {
      parcels: allParcels.map(r => {
        const parcel = rowToParcel(r);
        const ownerIds = subParcelMap.get(r.plotId);
        if (ownerIds) {
          parcel.isSubdivided = true;
          parcel.subParcelOwnerIds = ownerIds;
        }
        return parcel;
      }),
      players:            allPlayers.map((r) => rowToPlayer(r, ownerMap.get(r.id) ?? [])),
      battles:            allBattles.map(rowToBattle),
      events:             recentEvents.map(rowToEvent),
      leaderboard:        computeLeaderboard(allPlayers, allParcels),
      currentTurn:        meta?.currentTurn ?? 1,
      lastUpdateTs:       Number(meta?.lastUpdateTs ?? 0),
      totalPlots:         TOTAL_PLOTS,
      claimedPlots,
      frontierTotalSupply: FRONTIER_TOTAL_SUPPLY,
      frontierCirculating,
    };
  }

  async getSlimGameState(): Promise<SlimGameState> {
    await this.initialize();

    const [allParcels, allPlayers, pendingBattles, recentBattles, [meta]] = await Promise.all([
      this.db
        .select({
          id:             parcelsTable.id,
          plotId:         parcelsTable.plotId,
          lat:            parcelsTable.lat,
          lng:            parcelsTable.lng,
          biome:          parcelsTable.biome,
          ownerId:        parcelsTable.ownerId,
          activeBattleId: parcelsTable.activeBattleId,
        })
        .from(parcelsTable),
      this.db
        .select({
          id:      playersTable.id,
          name:    playersTable.name,
          address: playersTable.address,
          isAi:    playersTable.isAi,
        })
        .from(playersTable),
      this.db
        .select()
        .from(battlesTable)
        .where(eq(battlesTable.status, "pending")),
      this.db
        .select()
        .from(battlesTable)
        .where(eq(battlesTable.status, "resolved"))
        .orderBy(desc(battlesTable.resolveTs))
        .limit(20),
      this.db.select().from(gameMeta).where(eq(gameMeta.id, 1)),
    ]);

    const claimedPlots = allParcels.filter(p => p.ownerId !== null).length;
    const allPlayersFull = await this.db.select().from(playersTable);
    const frontierCirculating = allPlayersFull.reduce(
      (sum, p) => sum + fromMicroFRNTR(p.frntrBalanceMicro), 0
    );

    const ownedPlotIds = allParcels.filter(p => p.ownerId).map(p => p.plotId);
    const [animationMap, allSubParcels] = await Promise.all([
      getParcelAnimations(ownedPlotIds),
      this.db.select({
        parentPlotId: subParcelsTable.parentPlotId,
        subIndex:     subParcelsTable.subIndex,
        ownerId:      subParcelsTable.ownerId,
      }).from(subParcelsTable),
    ]);

    // Build map: parentPlotId → array of 9 owner ids (null if unowned)
    const subParcelMap = new Map<number, (string | null)[]>();
    for (const sp of allSubParcels) {
      if (!subParcelMap.has(sp.parentPlotId)) {
        subParcelMap.set(sp.parentPlotId, new Array(9).fill(null));
      }
      subParcelMap.get(sp.parentPlotId)![sp.subIndex] = sp.ownerId ?? null;
    }

    const now = Date.now();
    const slimParcels: SlimParcel[] = allParcels.map(r => {
      const anim = animationMap[r.plotId];
      const activeAnim = anim && (!anim.endTs || now < anim.endTs) ? anim : undefined;
      const ownerIds = subParcelMap.get(r.plotId);
      return {
        id:             r.id,
        plotId:         r.plotId,
        lat:            r.lat,
        lng:            r.lng,
        biome:          r.biome as BiomeType,
        ownerId:        r.ownerId ?? null,
        activeBattleId: r.activeBattleId ?? null,
        ...(activeAnim ? { animation: activeAnim } : {}),
        ...(ownerIds ? { isSubdivided: true, subParcelOwnerIds: ownerIds } : {}),
      };
    });

    const slimPlayers: SlimPlayer[] = allPlayers.map(r => ({
      id:      r.id,
      name:    r.name,
      address: r.address,
      isAI:    r.isAi,
    }));

    const battles = [...pendingBattles, ...recentBattles].map(rowToBattle);

    const allParcelsFull = await this.db.select().from(parcelsTable);
    const leaderboard = computeLeaderboard(allPlayersFull, allParcelsFull);

    // Include current season for countdown timer in HUD
    const currentSeason = await this.getCurrentSeason();

    return {
      parcels:            slimParcels,
      players:            slimPlayers,
      battles,
      leaderboard,
      claimedPlots,
      frontierCirculating,
      lastUpdateTs:       Number(meta?.lastUpdateTs ?? 0),
      seasonEndsAt:       currentSeason?.endsAt ?? null,
      seasonName:         currentSeason?.name ?? null,
    };
  }

  async getParcel(id: string): Promise<LandParcel | undefined> {
    await this.initialize();
    const [row] = await this.db.select().from(parcelsTable).where(eq(parcelsTable.id, id));
    return row ? rowToParcel(row) : undefined;
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    await this.initialize();
    const [[row], ownedRows] = await Promise.all([
      this.db.select().from(playersTable).where(eq(playersTable.id, id)),
      this.db.select({ id: parcelsTable.id }).from(parcelsTable).where(eq(parcelsTable.ownerId, id)),
    ]);
    return row ? rowToPlayer(row, ownedRows.map((r) => r.id)) : undefined;
  }

  async getBattle(id: string): Promise<Battle | undefined> {
    await this.initialize();
    const [row] = await this.db.select().from(battlesTable).where(eq(battlesTable.id, id));
    return row ? rowToBattle(row) : undefined;
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    await this.initialize();
    const [allPlayers, allParcels] = await Promise.all([
      this.db.select().from(playersTable),
      this.db.select({ id: parcelsTable.id, ownerId: parcelsTable.ownerId }).from(parcelsTable),
    ]);
    return computeLeaderboard(allPlayers, allParcels as ParcelRow[]);
  }

  // ── IStorage – mutating ────────────────────────────────────────────────────

  async mineResources(action: MineAction): Promise<{ iron: number; fuel: number; crystal: number }> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[parcelRow], [playerRow]] = await Promise.all([
        tx.select().from(parcelsTable).where(eq(parcelsTable.id, action.parcelId)),
        tx.select().from(playersTable).where(eq(playersTable.id, action.playerId)),
      ]);
      if (!parcelRow || !playerRow) throw new Error("Invalid parcel or player");

      const parcel = rowToParcel(parcelRow);
      const player = rowToPlayer(playerRow, []);
      if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

      const now = Date.now();
      // AI Lab reduces mine cooldown by 30s per level (max 90s reduction at level 3)
      const aiLab = parcel.improvements.find(i => i.type === "ai_lab");
      const cooldownReductionMs = aiLab ? aiLab.level * 30_000 : 0;
      const effectiveCooldownMs = Math.max(60_000, MINE_COOLDOWN_MS - cooldownReductionMs);
      if (now - parcel.lastMineTs < effectiveCooldownMs) throw new Error("Mining cooldown not complete");

      const playerSatellites = (playerRow.satellites ?? []) as OrbitalSatellite[];
      const activeSatellites = playerSatellites.filter(s => s.status === "active" && s.expiresAt > now);
      const satelliteMult = activeSatellites.length > 0 ? 1 + SATELLITE_YIELD_BONUS : 1;

      const biomeBonus   = biomeBonuses[parcel.biome];
      const richMult     = parcel.richness / 100;
      const influenceMult = (parcel.influence ?? 100) / 100;
      const ironYield    = Math.floor(BASE_YIELD.iron    * biomeBonus.ironMod    * richMult * influenceMult * parcel.yieldMultiplier * satelliteMult);
      const fuelYield    = Math.floor(BASE_YIELD.fuel    * biomeBonus.fuelMod    * richMult * influenceMult * parcel.yieldMultiplier * satelliteMult);
      const crystalYield = Math.floor(BASE_YIELD.crystal * biomeBonus.crystalMod * richMult * influenceMult * parcel.yieldMultiplier * satelliteMult);

      const totalStored = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
      const remaining   = parcel.storageCapacity - totalStored;
      const totalYield  = ironYield + fuelYield + crystalYield;
      const ratio       = remaining < totalYield ? remaining / totalYield : 1;

      const finalIron    = Math.floor(ironYield    * ratio);
      const finalFuel    = Math.floor(fuelYield    * ratio);
      const finalCrystal = Math.floor(crystalYield * ratio);

      // Richness depletes by 0.5 per mine (applied every other mine via floor).
      // Floor raised to 40 so depleted plots still feel worth mining.
      const newRichness = parcel.richness > 40
        ? Math.max(40, Math.floor(parcel.richness - 0.5))
        : parcel.richness;

      // Active influence repair: each mine restores +2 influence (capped at 100).
      const currentInfluence = parcel.influence ?? 100;
      const newInfluence = Math.min(100, currentInfluence + 2);

      await Promise.all([
        tx.update(parcelsTable)
          .set({
            ironStored:    parcel.ironStored    + finalIron,
            fuelStored:    parcel.fuelStored    + finalFuel,
            crystalStored: parcel.crystalStored + finalCrystal,
            lastMineTs:    now,
            richness:      newRichness,
            influence:     newInfluence,
          })
          .where(eq(parcelsTable.id, parcel.id)),
        tx.update(playersTable)
          .set({
            totalIronMined:    playerRow.totalIronMined    + finalIron,
            totalFuelMined:    playerRow.totalFuelMined    + finalFuel,
            totalCrystalMined: playerRow.totalCrystalMined + finalCrystal,
          })
          .where(eq(playersTable.id, player.id)),
      ]);

      console.log(`[mine] plotId=${parcel.plotId} iron=${finalIron} fuel=${finalFuel} crystal=${finalCrystal} stored`);

      await this.addEvent({
        type:        "mine",
        playerId:    player.id,
        parcelId:    parcel.id,
        description: `${player.name} mined ${finalIron} iron, ${finalFuel} fuel, ${finalCrystal} crystal from plot #${parcel.plotId}`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return { iron: finalIron, fuel: finalFuel, crystal: finalCrystal };
    });
  }

  async collectAll(playerId: string): Promise<{ iron: number; fuel: number; crystal: number }> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const playerRows = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!playerRows.length) throw new Error("Player not found");
      const playerRow = playerRows[0];

      const ownedParcels = await tx.select().from(parcelsTable).where(eq(parcelsTable.ownerId, playerId));
      let totalIron = 0;
      let totalFuel = 0;
      let totalCrystal = 0;

      for (const parcel of ownedParcels) {
        totalIron += parcel.ironStored || 0;
        totalFuel += parcel.fuelStored || 0;
        totalCrystal += parcel.crystalStored || 0;
      }

      if (totalIron > 0 || totalFuel > 0 || totalCrystal > 0) {
        await Promise.all([
          tx.update(parcelsTable)
            .set({ ironStored: 0, fuelStored: 0, crystalStored: 0 })
            .where(eq(parcelsTable.ownerId, playerId)),
          tx.update(playersTable)
            .set({ iron: playerRow.iron + totalIron, fuel: playerRow.fuel + totalFuel, crystal: playerRow.crystal + totalCrystal })
            .where(eq(playersTable.id, playerId)),
        ]);

        const now = Date.now();
        await this.addEvent({
          type:        "mine",
          playerId,
          description: `${playerRow.name} collected ${totalIron} iron, ${totalFuel} fuel, ${totalCrystal} crystal from all territories`,
          timestamp:   now,
        }, tx);
        await this.bumpLastTs(now, tx);
      }

      return { iron: totalIron, fuel: totalFuel, crystal: totalCrystal };
    });
  }

  async updatePlayerAddress(playerId: string, address: string): Promise<void> {
    await this.initialize();
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!row) throw new Error("Player not found");
      if (row.isAi) throw new Error("Cannot update AI player address");
      await tx.update(playersTable).set({ address }).where(eq(playersTable.id, playerId));
    });
  }

  async updatePlayerName(playerId: string, name: string): Promise<void> {
    await this.initialize();
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!row) throw new Error("Player not found");
      if (row.isAi) throw new Error("Cannot rename AI player");
      await tx.update(playersTable).set({ name }).where(eq(playersTable.id, playerId));
    });
  }

  async updateTestnetProgress(playerId: string, completedMissions: string[]): Promise<void> {
    await this.initialize();
    await this.db
      .update(playersTable)
      .set({ testnetProgress: completedMissions })
      .where(eq(playersTable.id, playerId));
  }

  async grantWelcomeBonus(playerId: string): Promise<void> {
    await this.initialize();
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!row) throw new Error("Player not found");
      if (row.welcomeBonusReceived) return;

      const now = Date.now();
      await tx.update(playersTable)
        .set({
          frntrBalanceMicro:    row.frntrBalanceMicro    + toMicroFRNTR(WELCOME_BONUS_FRONTIER),
          totalFrontierEarned:  row.totalFrontierEarned + WELCOME_BONUS_FRONTIER,
          welcomeBonusReceived: true,
        })
        .where(eq(playersTable.id, playerId));

      await this.addEvent({
        type:        "claim_frontier",
        playerId,
        description: `${row.name} received ${WELCOME_BONUS_FRONTIER} FRONTIER welcome bonus!`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);
    });
  }

  async claimFrontier(playerId: string): Promise<{ amount: number }> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[playerRow], ownedRows] = await Promise.all([
        tx.select().from(playersTable).where(eq(playersTable.id, playerId)),
        tx.select().from(parcelsTable).where(eq(parcelsTable.ownerId, playerId)),
      ]);
      if (!playerRow) throw new Error("Player not found");

      const now   = Date.now();
      let total   = 0;

      for (const row of ownedRows) {
        const parcel  = rowToParcel(row);
        // Parcels below the influence threshold generate no FRNTR until repaired
        const influenceOk = (parcel.influence ?? 100) >= INFLUENCE_YIELD_THRESHOLD;
        if (!influenceOk) continue;
        // Calculate earned frontier from time elapsed since last claim
        const days = (now - parcel.lastFrontierClaimTs) / (1000 * 60 * 60 * 24);
        const perDay = calculateFrontierPerDay(parcel.improvements);
        const earned = perDay * days;
        const newAccum = parcel.frontierAccumulated + earned;
        total += newAccum;
        await tx.update(parcelsTable)
          .set({ frontierAccumulated: 0, lastFrontierClaimTs: now, frontierPerDay: calculateFrontierPerDay(parcel.improvements) })
          .where(eq(parcelsTable.id, row.id));
      }

      const microTotal = toMicroFRNTR(total);
      const rounded = fromMicroFRNTR(microTotal);
      if (microTotal > 0) {
        await tx.update(playersTable)
          .set({
            frntrBalanceMicro:   playerRow.frntrBalanceMicro   + microTotal,
            frntrClaimedMicro:   playerRow.frntrClaimedMicro   + microTotal,
            totalFrontierEarned: playerRow.totalFrontierEarned + rounded,
          })
          .where(eq(playersTable.id, playerId));

        await this.addEvent({
          type:        "claim_frontier",
          playerId,
          description: `${playerRow.name} claimed ${rounded.toFixed(2)} FRONTIER tokens`,
          timestamp:   now,
        }, tx);
        await this.bumpLastTs(now, tx);
      }

      return { amount: rounded };
    });
  }

  async restoreFrontier(playerId: string, amount: number): Promise<void> {
    await this.initialize();
    if (amount <= 0) return;
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!row) return;
      const microAmount = toMicroFRNTR(amount);
      await tx.update(playersTable)
        .set({
          frntrBalanceMicro:   row.frntrBalanceMicro   - microAmount,
          totalFrontierEarned: row.totalFrontierEarned - amount,
        })
        .where(eq(playersTable.id, playerId));
      console.log(`Restored ${amount} FRONTIER for player ${row.name} due to failed transfer`);
    });
  }

  async upgradeBase(action: UpgradeAction): Promise<LandParcel> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[parcelRow], [playerRow]] = await Promise.all([
        tx.select().from(parcelsTable).where(eq(parcelsTable.id, action.parcelId)),
        tx.select().from(playersTable).where(eq(playersTable.id, action.playerId)),
      ]);
      if (!parcelRow || !playerRow) throw new Error("Invalid parcel or player");

      const parcel = rowToParcel(parcelRow);
      const player = rowToPlayer(playerRow, []);
      if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

      const cost = UPGRADE_COSTS[action.upgradeType];
      if (!cost) throw new Error("Invalid upgrade type");
      if (player.iron < cost.iron || player.fuel < cost.fuel) throw new Error("Insufficient resources");

      const updates: Partial<typeof parcelRow> = {};
      switch (action.upgradeType) {
        case "defense": updates.defenseLevel       = Math.min(10, parcel.defenseLevel + 1); break;
        case "yield":   updates.yieldMultiplier   = parcel.yieldMultiplier + 0.2; break;
        case "mine":    updates.richness           = Math.min(100, parcel.richness + 10); break;
        case "bunker":  updates.influenceRepairRate = (parcel.influenceRepairRate ?? 24) + 5; break;
      }

      const now = Date.now();
      await Promise.all([
        tx.update(parcelsTable).set(updates).where(eq(parcelsTable.id, parcel.id)),
        tx.update(playersTable)
          .set({ iron: playerRow.iron - cost.iron, fuel: playerRow.fuel - cost.fuel })
          .where(eq(playersTable.id, player.id)),
      ]);

      await this.addEvent({
        type:        "upgrade",
        playerId:    player.id,
        parcelId:    parcel.id,
        description: `${player.name} upgraded ${action.upgradeType} at plot #${parcel.plotId}`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return rowToParcel({ ...parcelRow, ...updates });
    });
  }

  async buildImprovement(action: BuildAction): Promise<LandParcel> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[parcelRow], [playerRow]] = await Promise.all([
        tx.select().from(parcelsTable).where(eq(parcelsTable.id, action.parcelId)),
        tx.select().from(playersTable).where(eq(playersTable.id, action.playerId)),
      ]);
      if (!parcelRow || !playerRow) throw new Error("Invalid parcel or player");

      const parcel = rowToParcel(parcelRow);
      const player = rowToPlayer(playerRow, []);
      if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

      const isFacility = action.improvementType in FACILITY_INFO;
      const isDefense  = action.improvementType in DEFENSE_IMPROVEMENT_INFO;
      if (!isFacility && !isDefense) throw new Error("Invalid improvement type");

      const existing = parcel.improvements.find((i) => i.type === action.improvementType);
      const level    = existing ? existing.level + 1 : 1;

      let playerUpdates: Partial<typeof playerRow> = {};

      if (isFacility) {
        const info = FACILITY_INFO[action.improvementType as FacilityType];
        if (existing && existing.level >= info.maxLevel) throw new Error("Facility already at max level");
        if (info.prerequisite) {
          const hasPrereq = parcel.improvements.find((i) => i.type === info.prerequisite);
          if (!hasPrereq) throw new Error(`Requires ${FACILITY_INFO[info.prerequisite!].name} first`);
        }
        const cost = info.costFrontier[level - 1];
        const microBalance = playerRow.frntrBalanceMicro;
        const microCost = toMicroFRNTR(cost);
        if (microBalance < microCost) throw new Error(`Insufficient FRONTIER (need ${cost})`);
        playerUpdates = {
          frntrBalanceMicro:   microBalance - microCost,
          totalFrontierBurned: playerRow.totalFrontierBurned + cost,
        };
      } else {
        const info = DEFENSE_IMPROVEMENT_INFO[action.improvementType as DefenseImprovementType];
        if (existing && existing.level >= info.maxLevel) throw new Error("Improvement already at max level");
        const cost = { iron: info.cost.iron * level, fuel: info.cost.fuel * level };
        if (player.iron < cost.iron || player.fuel < cost.fuel) throw new Error("Insufficient resources");
        playerUpdates = {
          iron: playerRow.iron - cost.iron,
          fuel: playerRow.fuel - cost.fuel,
        };
      }

      // Update improvements array
      const newImprovements = existing
        ? parcel.improvements.map((i) => i.type === action.improvementType ? { ...i, level } : i)
        : [...parcel.improvements, { type: action.improvementType, level: 1 }];

      // Apply side-effects on the parcel
      let newDefense   = parcel.defenseLevel;
      let newCapacity  = parcel.storageCapacity;
      let newYieldMult = parcel.yieldMultiplier;
      if      (action.improvementType === "turret")        newDefense   += 3;
      else if (action.improvementType === "shield_gen")    newDefense   += 5;
      else if (action.improvementType === "fortress")    { newDefense   += 8; newCapacity += 50; }
      else if (action.improvementType === "storage_depot") newCapacity  += 200;
      else if (action.improvementType === "data_centre")   newYieldMult += 0.05;

      const newFpd = calculateFrontierPerDay(newImprovements);

      const now = Date.now();
      await Promise.all([
        tx.update(parcelsTable)
          .set({ improvements: newImprovements, defenseLevel: newDefense, storageCapacity: newCapacity, yieldMultiplier: newYieldMult, frontierPerDay: newFpd })
          .where(eq(parcelsTable.id, parcel.id)),
        tx.update(playersTable).set(playerUpdates).where(eq(playersTable.id, player.id)),
      ]);

      const displayName = isFacility
        ? FACILITY_INFO[action.improvementType as FacilityType].name
        : DEFENSE_IMPROVEMENT_INFO[action.improvementType as DefenseImprovementType].name;

      await this.addEvent({
        type:        "build",
        playerId:    player.id,
        parcelId:    parcel.id,
        description: `${player.name} built ${displayName} (Lv${level}) at plot #${parcel.plotId}`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return rowToParcel({ ...parcelRow, improvements: newImprovements, defenseLevel: newDefense, storageCapacity: newCapacity, yieldMultiplier: newYieldMult, frontierPerDay: newFpd });
    });
  }

  async purchaseLand(action: PurchaseAction): Promise<LandParcel> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[parcelRow], [playerRow]] = await Promise.all([
        tx.select().from(parcelsTable).where(eq(parcelsTable.id, action.parcelId)),
        tx.select().from(playersTable).where(eq(playersTable.id, action.playerId)),
      ]);
      if (!parcelRow || !playerRow) throw new Error("Invalid parcel or player");
      if (parcelRow.ownerId) throw new Error("Territory is already owned");
      if (parcelRow.purchasePriceAlgo === null) throw new Error("Territory is not for sale");

      const now      = Date.now();
      const ownerType = playerRow.isAi ? "ai" : "player";
      await Promise.all([
        tx.update(parcelsTable)
          .set({ ownerId: playerRow.id, ownerType, purchasePriceAlgo: null, lastFrontierClaimTs: now })
          .where(eq(parcelsTable.id, parcelRow.id)),
        tx.update(playersTable)
          .set({ territoriesCaptured: playerRow.territoriesCaptured + 1 })
          .where(eq(playersTable.id, playerRow.id)),
      ]);

      await this.addEvent({
        type:        "purchase",
        playerId:    playerRow.id,
        parcelId:    parcelRow.id,
        description: `${playerRow.name} purchased plot #${parcelRow.plotId} for ${LAND_PURCHASE_ALGO[parcelRow.biome as BiomeType]} ALGO`,
        timestamp:   now,
      }, tx);

      // ── Milestone detection (logging only) ──────────────────────────────
      try {
        const prev = playerRow.territoriesCaptured ?? 0;
        const next  = prev + 1;
        const milestone = detectMilestone(prev, next);
        if (milestone) {
          const milestoneNarrative = buildNarrative({
            type: "player_milestone",
            actorName: playerRow.name,
            territoriesHeld: milestone,
            worldPercent: (milestone / 21000) * 100,
          });
          if (milestoneNarrative) console.log("[narrative]", milestoneNarrative);
        }
      } catch { /* non-blocking */ }

      await this.bumpLastTs(now, tx);

      return rowToParcel({ ...parcelRow, ownerId: playerRow.id, ownerType, purchasePriceAlgo: null, lastFrontierClaimTs: now });
    });
  }

  async deployAttack(action: AttackAction): Promise<Battle> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[attackerRow], [targetRow]] = await Promise.all([
        tx.select().from(playersTable).where(eq(playersTable.id, action.attackerId)),
        tx.select().from(parcelsTable).where(eq(parcelsTable.id, action.targetParcelId)),
      ]);
      if (!attackerRow || !targetRow) throw new Error("Invalid attacker or target");

      const attacker = rowToPlayer(attackerRow, []);
      const target   = rowToParcel(targetRow);
      if (target.ownerId === attacker.id) throw new Error("Cannot attack your own territory");
      if (target.activeBattleId) throw new Error("Territory is already under attack");

      // ── Commander gate ────────────────────────────────────────────────────
      const attackerCommanders = (attackerRow.commanders ?? []) as CommanderAvatar[];
      if (!attackerRow.isAi && attackerCommanders.length === 0) {
        throw new Error("A Commander is required to launch an attack. Mint one from the Commander panel.");
      }

      // ── Concurrent attack cap ─────────────────────────────────────────────
      if (!attackerRow.isAi) {
        const TIER_RANK: Record<string, number> = { sentinel: 1, phantom: 2, reaper: 3 };
        const highestTier = attackerCommanders.reduce((best, c) => {
          return (TIER_RANK[c.tier] ?? 0) > (TIER_RANK[best] ?? 0) ? c.tier : best;
        }, "sentinel" as string);
        const maxConcurrent = COMMANDER_INFO[highestTier as CommanderTier]?.maxConcurrentAttacks ?? 1;

        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(battlesTable)
          .where(
            and(
              eq(battlesTable.attackerId, attacker.id),
              eq(battlesTable.status, "pending")
            )
          );

        if (count >= maxConcurrent) {
          throw new Error(
            `Attack limit reached. Your ${highestTier} Commander allows ${maxConcurrent} simultaneous attack${maxConcurrent > 1 ? "s" : ""}. Wait for a battle to resolve.`
          );
        }
      }

      const { iron, fuel } = action.resourcesBurned;
      const crystal = action.crystalBurned ?? 0;
      if (attacker.iron < iron || attacker.fuel < fuel) throw new Error("Insufficient resources for attack");
      if (attacker.crystal < crystal) throw new Error("Insufficient crystal for attack");

      const now = Date.now();

      // Resolve commander: validate availability and apply attack bonus
      let commanderBonus = 0;
      let commanderId: string | undefined;
      const commanders = (attackerRow.commanders ?? []) as CommanderAvatar[];
      if (action.commanderId) {
        const cmdIdx = commanders.findIndex((c) => c.id === action.commanderId);
        if (cmdIdx === -1) throw new Error("Commander not found");
        const cmd = commanders[cmdIdx];
        if (cmd.lockedUntil && now < cmd.lockedUntil) throw new Error("Commander is currently deployed and unavailable");
        commanderBonus = cmd.attackBonus;
        commanderId = cmd.id;
        commanders[cmdIdx] = { ...cmd, lockedUntil: now + COMMANDER_LOCK_MS };
      }

      // Radar Array: reduces incoming attacker power by 10% if defender has one built
      const hasRadar = target.improvements.some(i => i.type === "radar");
      const radarMod = hasRadar ? 0.9 : 1.0;
      const rawAttackerPower = (action.troopsCommitted * 10 + iron * 0.5 + fuel * 0.8 + crystal * 1.2 + commanderBonus) * radarMod;
      // Apply morale debuff: attacker power is reduced when they recently lost territory
      const moraleActive   = attacker.moraleDebuffUntil && now < attacker.moraleDebuffUntil;
      const attackerPower  = moraleActive
        ? rawAttackerPower * (1 - MORALE_ATTACK_PENALTY)
        : rawAttackerPower;

      const biomeBonus    = biomeBonuses[target.biome];
      const turretBonus   = target.improvements
        .filter((i) => ["turret", "shield_gen", "fortress"].includes(i.type))
        .reduce((sum, i) => sum + i.level * 5, 0);
      const defenderPower = (target.defenseLevel * 15 + turretBonus) * biomeBonus.defenseMod;

      const battleId = randomUUID();

      const battleValues = {
        id:               battleId,
        attackerId:       attacker.id,
        defenderId:       target.ownerId ?? null,
        targetParcelId:   target.id,
        attackerPower,
        defenderPower,
        troopsCommitted:  action.troopsCommitted,
        resourcesBurned:  { iron, fuel },
        crystalBurned:    crystal,
        influenceDamage:  0,
        startTs:          now,
        resolveTs:        now + BATTLE_DURATION_MS,
        status:           "pending" as const,
        commanderId:      commanderId ?? null,
        sourceParcelId:   action.sourceParcelId ?? null,
      };

      const playerUpdates: Record<string, any> = { iron: attackerRow.iron - iron, fuel: attackerRow.fuel - fuel, crystal: attackerRow.crystal - crystal };
      if (commanderId) playerUpdates.commanders = commanders;

      await Promise.all([
        tx.insert(battlesTable).values(battleValues),
        tx.update(parcelsTable).set({ activeBattleId: battleId }).where(eq(parcelsTable.id, target.id)),
        tx.update(playersTable).set(playerUpdates).where(eq(playersTable.id, attacker.id)),
      ]);

      await this.addEvent({
        type:        "attack",
        playerId:    attacker.id,
        parcelId:    target.id,
        battleId,
        description: `${attacker.name} launched an attack on plot #${target.plotId}`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return rowToBattle({ ...battleValues, outcome: null, randFactor: null, commanderId: commanderId ?? null } as BattleRow);
    });
  }

  async mintAvatar(action: MintAvatarAction): Promise<CommanderAvatar> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, action.playerId));
      if (!row) throw new Error("Player not found");

      const info = COMMANDER_INFO[action.tier];
      if (!info) throw new Error("Invalid commander tier");
      const microCost = toMicroFRNTR(info.mintCostFrontier);
      if (row.frntrBalanceMicro < microCost)
        throw new Error(`Insufficient FRONTIER. Need ${info.mintCostFrontier}, have ${fromMicroFRNTR(row.frntrBalanceMicro).toFixed(2)}`);

      const commanders = (row.commanders ?? []) as CommanderAvatar[];
      const bonusRoll  = Math.random() * 0.3;
      const avatar: CommanderAvatar = {
        id:              randomUUID(),
        tier:            action.tier,
        name:            `${info.name} #${commanders.length + 1}`,
        attackBonus:     Math.floor(info.baseAttackBonus  * (1 + bonusRoll)),
        defenseBonus:    Math.floor(info.baseDefenseBonus * (1 + bonusRoll)),
        specialAbility:  info.specialAbility,
        mintedAt:        Date.now(),
        totalKills:      0,
      };

      const newCommanders  = [...commanders, avatar];
      const newActiveIndex = newCommanders.length - 1;

      const now = Date.now();
      await tx.update(playersTable)
        .set({
          frntrBalanceMicro:    row.frntrBalanceMicro   - microCost,
          totalFrontierBurned:  row.totalFrontierBurned + info.mintCostFrontier,
          commanders:           newCommanders,
          activeCommanderIndex: newActiveIndex,
        })
        .where(eq(playersTable.id, action.playerId));

      await this.addEvent({
        type:        "mint_avatar",
        playerId:    action.playerId,
        description: `${row.name} minted a ${info.name} Commander (${action.tier.toUpperCase()}) for ${info.mintCostFrontier} FRONTIER`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return avatar;
    });
  }

  async executeSpecialAttack(action: SpecialAttackAction): Promise<{ damage: number; effect: string }> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[playerRow], [targetRow]] = await Promise.all([
        tx.select().from(playersTable).where(eq(playersTable.id, action.playerId)),
        tx.select().from(parcelsTable).where(eq(parcelsTable.id, action.targetParcelId)),
      ]);
      if (!playerRow) throw new Error("Player not found");

      const player  = rowToPlayer(playerRow, []);
      const target  = targetRow ? rowToParcel(targetRow) : null;

      if (!player.commander) throw new Error("You need a Commander to use special attacks. Mint one first.");
      if (!target) throw new Error("Target plot not found");
      if (target.ownerId === player.id) throw new Error("Cannot attack your own territory");

      const attackInfo = SPECIAL_ATTACK_INFO[action.attackType];
      if (!attackInfo) throw new Error("Invalid attack type");
      if (!attackInfo.requiredTier.includes(player.commander.tier))
        throw new Error(`${attackInfo.name} requires a ${attackInfo.requiredTier.join(" or ")} Commander`);
      const microCostSA = toMicroFRNTR(attackInfo.costFrontier);
      if (playerRow.frntrBalanceMicro < microCostSA)
        throw new Error(`Insufficient FRONTIER. Need ${attackInfo.costFrontier}, have ${fromMicroFRNTR(playerRow.frntrBalanceMicro).toFixed(2)}`);

      const existing = player.specialAttacks.find((sa) => sa.type === action.attackType);
      if (existing) {
        const elapsed = Date.now() - existing.lastUsedTs;
        if (elapsed < attackInfo.cooldownMs) {
          const remaining = Math.ceil((attackInfo.cooldownMs - elapsed) / 60000);
          throw new Error(`${attackInfo.name} on cooldown. ${remaining} minutes remaining.`);
        }
      }

      let baseDamage       = player.commander.attackBonus * attackInfo.damageMultiplier;
      let effectDescription = attackInfo.effect;
      const targetUpdates: Partial<typeof targetRow> = {};

      if (action.attackType === "orbital_strike") {
        const defReduction = Math.floor(target.defenseLevel * 0.5);
        targetUpdates.defenseLevel = Math.max(1, target.defenseLevel - defReduction);
        baseDamage += defReduction * 5;
        effectDescription = `Orbital Strike reduced defense by ${defReduction}`;
      } else if (action.attackType === "emp_blast") {
        targetUpdates.defenseLevel = Math.max(1, target.defenseLevel - 2);
        effectDescription = "EMP disabled turrets and shields, defense reduced by 2";
      } else if (action.attackType === "siege_barrage") {
        targetUpdates.defenseLevel = Math.max(1, target.defenseLevel - 1);
        // Splash nearby — fetch candidate enemy parcels, then filter by
        // sphereDistance in application code to find true neighbours.
        const allNearby = await tx.select().from(parcelsTable)
          .where(sql`${parcelsTable.ownerId} IS NOT NULL AND ${parcelsTable.ownerId} != ${player.id}`)
          .limit(500);
        let splashCount = 0;
        for (const np of allNearby) {
          if (splashCount >= 3) break;
          const dist = sphereDistance(target.lat, target.lng, np.lat, np.lng);
          if (dist < 0.04) {
            await tx.update(parcelsTable)
              .set({ defenseLevel: Math.max(1, np.defenseLevel - 1) })
              .where(eq(parcelsTable.id, np.id));
            splashCount++;
          }
        }
        effectDescription = `Siege Barrage damaged target + ${splashCount} nearby plots`;
      } else if (action.attackType === "sabotage") {
        targetUpdates.yieldMultiplier = Math.max(0.1, target.yieldMultiplier * 0.5);
        effectDescription = "Sabotage halved target mining yield";
      }

      // Update commander kill count
      const newCommanders = player.commanders.map((c) =>
        c.id === player.commander!.id ? { ...c, totalKills: c.totalKills + 1 } : c
      );
      // Update specialAttacks cooldown
      const newSpecialAttacks = existing
        ? player.specialAttacks.map((sa) => sa.type === action.attackType ? { ...sa, lastUsedTs: Date.now() } : sa)
        : [...player.specialAttacks, { type: action.attackType, lastUsedTs: Date.now() }];

      const now = Date.now();
      await Promise.all([
        ...(Object.keys(targetUpdates).length > 0
          ? [tx.update(parcelsTable).set(targetUpdates).where(eq(parcelsTable.id, target.id))]
          : []),
        tx.update(playersTable)
          .set({
            frntrBalanceMicro:   playerRow.frntrBalanceMicro   - microCostSA,
            totalFrontierBurned: playerRow.totalFrontierBurned + attackInfo.costFrontier,
            commanders:          newCommanders,
            specialAttacks:      newSpecialAttacks,
          })
          .where(eq(playersTable.id, player.id)),
      ]);

      await this.addEvent({
        type:        "special_attack",
        playerId:    player.id,
        parcelId:    target.id,
        description: `${player.name}'s ${player.commander.name} launched ${attackInfo.name} on plot #${target.plotId}!`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return { damage: Math.floor(baseDamage), effect: effectDescription };
    });
  }

  async deployDrone(action: DeployDroneAction): Promise<ReconDrone> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, action.playerId));
      if (!row) throw new Error("Player not found");

      const drones = (row.drones ?? []) as ReconDrone[];
      if (drones.length >= MAX_DRONES) throw new Error(`Maximum ${MAX_DRONES} drones allowed`);
      const microDroneCost = toMicroFRNTR(DRONE_MINT_COST_FRONTIER);
      if (row.frntrBalanceMicro < microDroneCost)
        throw new Error(`Insufficient FRONTIER. Need ${DRONE_MINT_COST_FRONTIER}, have ${fromMicroFRNTR(row.frntrBalanceMicro).toFixed(2)}`);

      // Pick a random enemy target if none specified
      let targetId = action.targetParcelId ?? null;
      if (!targetId) {
        const [rand] = await tx.select({ id: parcelsTable.id })
          .from(parcelsTable)
          .where(and(sql`${parcelsTable.ownerId} IS NOT NULL`, sql`${parcelsTable.ownerId} != ${action.playerId}`))
          .orderBy(sql`RANDOM()`)
          .limit(1);
        targetId = rand?.id ?? null;
      }

      const bonus = Math.random();
      const drone: ReconDrone = {
        id:                  randomUUID(),
        deployedAt:          Date.now(),
        targetParcelId:      targetId,
        status:              targetId ? "scouting" : "idle",
        discoveredResources: targetId
          ? { iron: Math.floor(5 + bonus * 15), fuel: Math.floor(3 + bonus * 10), crystal: Math.floor(bonus * 5) }
          : { iron: 0, fuel: 0, crystal: 0 },
        scoutReportReady:    false,
      };

      const now = Date.now();
      await tx.update(playersTable)
        .set({
          frntrBalanceMicro:   row.frntrBalanceMicro   - microDroneCost,
          totalFrontierBurned: row.totalFrontierBurned + DRONE_MINT_COST_FRONTIER,
          drones:              [...drones, drone],
        })
        .where(eq(playersTable.id, action.playerId));

      await this.addEvent({
        type:        "deploy_drone",
        playerId:    action.playerId,
        parcelId:    targetId ?? undefined,
        description: `${row.name} deployed a Recon Drone`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return drone;
    });
  }

  async deploySatellite(action: DeploySatelliteAction): Promise<OrbitalSatellite> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, action.playerId));
      if (!row) throw new Error("Player not found");

      const now = Date.now();
      const satellites = ((row.satellites ?? []) as OrbitalSatellite[]).map(s =>
        s.status === "active" && s.expiresAt <= now ? { ...s, status: "expired" as const } : s
      );
      const activeSatellites = satellites.filter(s => s.status === "active");
      if (activeSatellites.length >= MAX_SATELLITES)
        throw new Error(`Maximum ${MAX_SATELLITES} active satellites allowed`);
      const microSatCost = toMicroFRNTR(SATELLITE_DEPLOY_COST_FRONTIER);
      if (row.frntrBalanceMicro < microSatCost)
        throw new Error(`Insufficient FRONTIER. Need ${SATELLITE_DEPLOY_COST_FRONTIER}, have ${fromMicroFRNTR(row.frntrBalanceMicro).toFixed(2)}`);

      const satellite: OrbitalSatellite = {
        id:          randomUUID(),
        deployedAt:  now,
        expiresAt:   now + SATELLITE_ORBIT_DURATION_MS,
        status:      "active",
      };

      await tx.update(playersTable)
        .set({
          frntrBalanceMicro:   row.frntrBalanceMicro   - microSatCost,
          totalFrontierBurned: row.totalFrontierBurned + SATELLITE_DEPLOY_COST_FRONTIER,
          satellites:          [...satellites, satellite],
        })
        .where(eq(playersTable.id, action.playerId));

      await this.addEvent({
        type:        "deploy_satellite",
        playerId:    action.playerId,
        description: `${row.name} launched an Orbital Satellite — +${SATELLITE_YIELD_BONUS * 100}% mining yield for 1 hour`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return satellite;
    });
  }

  async switchCommander(playerId: string, commanderIndex: number): Promise<CommanderAvatar> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!row) throw new Error("Player not found");

      const commanders = (row.commanders ?? []) as CommanderAvatar[];
      if (commanderIndex < 0 || commanderIndex >= commanders.length)
        throw new Error("Invalid commander index");

      const newCommander = commanders[commanderIndex];
      const now = Date.now();

      await tx.update(playersTable)
        .set({ activeCommanderIndex: commanderIndex })
        .where(eq(playersTable.id, playerId));

      await this.addEvent({
        type:        "ai_action",
        playerId,
        description: `${row.name} switched to commander ${newCommander.name}`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return newCommander;
    });
  }

  async resolveBattles(): Promise<Battle[]> {
    await this.initialize();
    const now = Date.now();

    // Fetch all pending battles whose resolveTs has passed.
    const pending = await this.db.select().from(battlesTable)
      .where(and(eq(battlesTable.status, "pending"), lt(battlesTable.resolveTs, now)));

    if (pending.length === 0) return [];

    // Pre-fetch AI players once for reconquest faction-name lookup
    const allAiPlayers = await this.db.select().from(playersTable).where(eq(playersTable.isAi, true));

    const resolved: Battle[] = [];

    for (const battleRow of pending) {
      await this.db.transaction(async (tx) => {
        // Deterministic outcome using a hash of (id + startTs)
        const seed = `${battleRow.id}${battleRow.startTs}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
          hash = (hash << 5) - hash + seed.charCodeAt(i);
          hash = hash & hash;
        }
        const randFactor      = (Math.abs(hash) % 21) - 10;
        const adjustedPower   = battleRow.attackerPower * (1 + randFactor / 100);
        const attackerWins    = adjustedPower > battleRow.defenderPower;
        const outcome         = attackerWins ? "attacker_wins" : "defender_wins";

        const [[targetRow], [attackerRow]] = await Promise.all([
          tx.select().from(parcelsTable).where(eq(parcelsTable.id, battleRow.targetParcelId)),
          tx.select().from(playersTable).where(eq(playersTable.id, battleRow.attackerId)),
        ]);

        if (!targetRow || !attackerRow) return;

        // ── Influence damage calculation ──────────────────────────────────────
        const totalDefenseLevels = ((targetRow.improvements ?? []) as any[])
          .filter((i: any) => ["turret", "shield_gen", "fortress"].includes(i.type))
          .reduce((sum: number, i: any) => sum + (i.level ?? 1), 0);
        const rawInfluenceDamage = attackerWins
          ? Math.max(
              MIN_INFLUENCE_DAMAGE,
              Math.round(BASE_INFLUENCE_DAMAGE * (1 - totalDefenseLevels * INFLUENCE_DAMAGE_REDUCTION_PER_LEVEL))
            )
          : 0;
        const currentInfluence = (targetRow as any).influence ?? 100;
        const newInfluence = attackerWins
          ? Math.max(0, currentInfluence - rawInfluenceDamage)
          : currentInfluence;

        await tx.update(battlesTable)
          .set({ status: "resolved", outcome, randFactor, influenceDamage: rawInfluenceDamage })
          .where(eq(battlesTable.id, battleRow.id));

        await tx.update(parcelsTable)
          .set({ activeBattleId: null })
          .where(eq(parcelsTable.id, targetRow.id));

        if (attackerWins) {
          // ── Pillage stored resources ──────────────────────────────────────
          const pillagedIron    = Math.floor(targetRow.ironStored    * PILLAGE_RATE);
          const pillagedFuel    = Math.floor(targetRow.fuelStored    * PILLAGE_RATE);
          const pillagedCrystal = Math.floor(targetRow.crystalStored * PILLAGE_RATE);

          // ── Apply morale/cooldown penalties to defender ───────────────────
          let defenderPenaltyMsg = "";
          if (battleRow.defenderId) {
            const [defenderRow] = await tx.select().from(playersTable)
              .where(eq(playersTable.id, battleRow.defenderId));
            if (defenderRow) {
              const prevConsecutive = defenderRow.consecutiveLosses ?? 0;
              const newConsecutive  = prevConsecutive + 1;
              const debuffMs        = MORALE_DEBUFF_BASE_MS * (1 + prevConsecutive * 0.5);
              const moraleUntil     = now + debuffMs;
              const cooldownUntil   = now + ATTACK_COOLDOWN_PER_LOSS_MS * newConsecutive;

              await tx.update(playersTable)
                .set({
                  attacksLost:        sql`${playersTable.attacksLost} + 1`,
                  consecutiveLosses:  newConsecutive,
                  moraleDebuffUntil:  moraleUntil,
                  attackCooldownUntil: cooldownUntil,
                })
                .where(eq(playersTable.id, battleRow.defenderId));

              defenderPenaltyMsg = ` ${defenderRow.name} suffers morale debuff and attack cooldown.`;

              // ── Cascade vulnerability: adjacent defender parcels ──────────
              const allDefenderNearby = await tx.select().from(parcelsTable)
                .where(eq(parcelsTable.ownerId, battleRow.defenderId));
              for (const adj of allDefenderNearby) {
                if (adj.id === targetRow.id) continue;
                const dist = Math.sqrt(
                  Math.pow(adj.lat - targetRow.lat, 2) + Math.pow(adj.lng - targetRow.lng, 2)
                );
                if (dist < 5) { // ~5 degree proximity as rough equivalent
                  await tx.update(parcelsTable)
                    .set({ defenseLevel: Math.max(1, adj.defenseLevel - CASCADE_DEFENSE_PENALTY) })
                    .where(eq(parcelsTable.id, adj.id));
                }
              }
            }
          }

          // ── Reconquest tracking ──────────────────────────────────────
          const isHumanCapturingAI = !attackerRow.isAi && (targetRow.ownerType === "ai");
          const isAIReconquering   = attackerRow.isAi  && (targetRow.ownerType === "player");
          const existingHandovers  = (targetRow as any).handoverCount ?? 0;

          // Look up the AI faction name for the defender (for reconquest tracking)
          const defenderFactionName = isHumanCapturingAI && battleRow.defenderId
            ? (() => {
                const defRow = allAiPlayers.find((ai: any) => ai.id === battleRow.defenderId);
                return defRow?.name ?? null;
              })()
            : null;

          const reconquestUpdates = isHumanCapturingAI ? {
            capturedFromFaction: defenderFactionName,
            capturedAt:    now,
            handoverCount: existingHandovers + 1,
          } : isAIReconquering ? {
            // AI has taken it back — clear contested status
            capturedFromFaction: null,
            capturedAt:          null,
            handoverCount:       existingHandovers,
          } : {};

          await Promise.all([
            tx.update(parcelsTable)
              .set({
                ownerId:              attackerRow.id,
                ownerType:            attackerRow.isAi ? "ai" : "player",
                defenseLevel:         Math.max(1, Math.floor(targetRow.defenseLevel / 2)),
                ironStored:           targetRow.ironStored    - pillagedIron,
                fuelStored:           targetRow.fuelStored    - pillagedFuel,
                crystalStored:        targetRow.crystalStored - pillagedCrystal,
                influence:            newInfluence,
                purchasePriceAlgo:    null,
                lastFrontierClaimTs:  now,
                ...reconquestUpdates,
              })
              .where(eq(parcelsTable.id, targetRow.id)),
            tx.update(playersTable)
              .set({
                attacksWon:          sql`${playersTable.attacksWon} + 1`,
                territoriesCaptured: sql`${playersTable.territoriesCaptured} + 1`,
                consecutiveLosses:   0,
                iron:                attackerRow.iron + pillagedIron,
                fuel:                attackerRow.fuel + pillagedFuel,
                crystal:             attackerRow.crystal + pillagedCrystal,
              })
              .where(eq(playersTable.id, attackerRow.id)),
          ]);

          const pillageMsg = (pillagedIron > 0 || pillagedFuel > 0 || pillagedCrystal > 0)
            ? ` Pillaged: ${pillagedIron} iron, ${pillagedFuel} fuel, ${pillagedCrystal} crystal.`
            : "";

          await this.addEvent({
            type:        "battle_resolved",
            playerId:    attackerRow.id,
            parcelId:    targetRow.id,
            battleId:    battleRow.id,
            description: `${attackerRow.name} conquered plot #${targetRow.plotId}!${pillageMsg}${defenderPenaltyMsg}`,
            timestamp:   now,
          }, tx);
        } else {
          await tx.update(playersTable)
            .set({ attacksLost: sql`${playersTable.attacksLost} + 1` })
            .where(eq(playersTable.id, attackerRow.id));
          if (battleRow.defenderId) {
            await tx.update(playersTable)
              .set({
                attacksWon:       sql`${playersTable.attacksWon} + 1`,
                // Successful defence resets the consecutive-loss streak
                consecutiveLosses: 0,
              })
              .where(eq(playersTable.id, battleRow.defenderId));
          }

          await this.addEvent({
            type:        "battle_resolved",
            playerId:    battleRow.defenderId ?? attackerRow.id,
            parcelId:    targetRow.id,
            battleId:    battleRow.id,
            description: `Defense held at plot #${targetRow.plotId}. ${attackerRow.name}'s attack was repelled.`,
            timestamp:   now,
          }, tx);
        }

        // ── Battle note (non-blocking, AI battle contexts only) ──────────
        try {
          const isAiBattle = attackerRow.isAi || (targetRow.ownerType === "ai");
          if (isAiBattle) {
            const humanAddr = !attackerRow.isAi ? (attackerRow as any).address ?? "" : "";
            const aiFactionName = attackerRow.isAi
              ? attackerRow.name
              : (allAiPlayers.find((ai: any) => ai.id === battleRow.defenderId)?.name ?? "Unknown");
            const battleNote = buildBattleNote({
              type: "battle_reward",
              plotId: targetRow.plotId,
              biome: targetRow.biome,
              outcome,
              humanAddr,
              factionName: aiFactionName,
              amount: 0,
            });
            console.log("[chain/battle] note:", new TextDecoder().decode(battleNote));
          }
        } catch { /* non-blocking */ }

        // ── Narrative commentary (logging only) ──────────────────────────
        try {
          const defName = battleRow.defenderId
            ? (allAiPlayers.find((p: any) => p.id === battleRow.defenderId)?.name ?? "Defender")
            : "Unowned";
          const narrativeText = buildNarrative({
            type: attackerWins ? "battle_won" : "battle_lost",
            actorName: attackerRow.name,
            targetName: defName,
            plotId: targetRow.plotId,
            biome: targetRow.biome as BiomeType,
            territoriesHeld: attackerRow.territoriesCaptured ?? 0,
          });
          if (narrativeText) console.log("[narrative]", narrativeText);
        } catch { /* non-blocking */ }

        // ── Save replay to Redis (fire-and-forget, 24-hour TTL) ──────────
        const replayRecord: BattleReplayRecord = {
          battleId:       battleRow.id,
          attackerName:   attackerRow.name,
          defenderName:   battleRow.defenderId
            ? (allAiPlayers.find((p: any) => p.id === battleRow.defenderId)?.name ?? "Defender")
            : "Unclaimed",
          attackerPower:  battleRow.attackerPower * (1 + randFactor / 100),
          defenderPower:  battleRow.defenderPower,
          randFactor,
          outcome:        outcome as "attacker_wins" | "defender_wins",
          plotId:         targetRow.plotId,
          biome:          targetRow.biome,
          pillagedIron:   attackerWins ? Math.floor(targetRow.ironStored    * PILLAGE_RATE) : 0,
          pillagedFuel:   attackerWins ? Math.floor(targetRow.fuelStored    * PILLAGE_RATE) : 0,
          pillagedCrystal: attackerWins ? Math.floor(targetRow.crystalStored * PILLAGE_RATE) : 0,
          resolvedAt:     now,
          log: [
            { phase: "power_calc", message: `Attacker power: ${(battleRow.attackerPower * (1 + randFactor / 100)).toFixed(2)} vs Defender power: ${battleRow.defenderPower.toFixed(2)}` },
            { phase: "resolution", message: `Rand factor: ${randFactor > 0 ? "+" : ""}${randFactor}% — Outcome: ${outcome}` },
            attackerWins
              ? { phase: "resolution", message: `${attackerRow.name} conquered plot #${targetRow.plotId}. Pillaged ${Math.floor(targetRow.ironStored * PILLAGE_RATE)} iron, ${Math.floor(targetRow.fuelStored * PILLAGE_RATE)} fuel.` }
              : { phase: "resolution", message: `Defense held at plot #${targetRow.plotId}. ${attackerRow.name}'s attack was repelled.` },
          ],
        };
        saveBattleReplay(replayRecord).catch(() => {});

        await this.bumpLastTs(now, tx);
        resolved.push(rowToBattle({ ...battleRow, status: "resolved", outcome, randFactor }));
      });
    }

    // Passive influence repair — runs on the same cadence as battle resolution
    await this.repairInfluence(now);
    return resolved;
  }

  async runAITurn(): Promise<GameEvent[]> {
    if (process.env.AI_ENABLED !== 'true') return [];
    await this.initialize();
    return runAITurnFn(this.db, {
      mineResources:  (a) => this.mineResources(a),
      collectAll:     (id) => this.collectAll(id),
      purchaseLand:   (a) => this.purchaseLand(a),
      deployAttack:   (a) => this.deployAttack(a),
      upgradeBase:    (a) => this.upgradeBase(a),
      addEvent:       (e) => this.addEvent(e),
    });
  }

  // ── Trade Station ────────────────────────────────────────────────────────────

  async getOpenTradeOrders(): Promise<TradeOrder[]> {
    await this.initialize();
    return this.db
      .select()
      .from(tradeOrdersTable)
      .where(eq(tradeOrdersTable.status, "open"))
      .orderBy(desc(tradeOrdersTable.createdAt));
  }

  async createTradeOrder(order: InsertTradeOrder): Promise<TradeOrder> {
    await this.initialize();
    const [row] = await this.db
      .insert(tradeOrdersTable)
      .values(order)
      .returning();
    return row;
  }

  async cancelTradeOrder(
    orderId: string,
    playerId: string,
  ): Promise<{ success: boolean; error?: string }> {
    await this.initialize();
    const [order] = await this.db
      .select()
      .from(tradeOrdersTable)
      .where(eq(tradeOrdersTable.id, orderId));

    if (!order) return { success: false, error: "Order not found" };
    if (order.offererId !== playerId) return { success: false, error: "Not your order" };
    if (order.status !== "open") return { success: false, error: "Order is not open" };

    await this.db
      .update(tradeOrdersTable)
      .set({ status: "cancelled" })
      .where(eq(tradeOrdersTable.id, orderId));

    return { success: true };
  }

  async getTradeHistory(limit = 50): Promise<TradeOrder[]> {
    await this.initialize();
    return this.db
      .select()
      .from(tradeOrdersTable)
      .where(eq(tradeOrdersTable.status, "filled"))
      .orderBy(desc(tradeOrdersTable.filledAt))
      .limit(limit);
  }

  async getTradeLeaderboard(): Promise<{ playerId: string; name: string; tradesPosted: number; tradesFilled: number }[]> {
    await this.initialize();
    const allOrders = await this.db.select().from(tradeOrdersTable);

    const map = new Map<string, { name: string; tradesPosted: number; tradesFilled: number }>();

    for (const row of allOrders) {
      // Count as posted for the offerer
      if (!map.has(row.offererId)) {
        map.set(row.offererId, { name: row.offererName, tradesPosted: 0, tradesFilled: 0 });
      }
      map.get(row.offererId)!.tradesPosted += 1;

      // Count as filled for the filler (only for filled orders)
      if (row.status === "filled" && row.filledById) {
        if (!map.has(row.filledById)) {
          map.set(row.filledById, { name: row.filledByName ?? row.filledById, tradesPosted: 0, tradesFilled: 0 });
        } else if (row.filledByName && !map.get(row.filledById)!.name) {
          map.get(row.filledById)!.name = row.filledByName;
        }
        map.get(row.filledById)!.tradesFilled += 1;
      }
    }

    return Array.from(map.entries())
      .map(([playerId, v]) => ({ playerId, ...v }))
      .sort((a, b) => (b.tradesPosted + b.tradesFilled) - (a.tradesPosted + a.tradesFilled))
      .slice(0, 20);
  }

  async fillTradeOrder(
    orderId: string,
    fillerId: string,
  ): Promise<{ success: boolean; error?: string; trade?: TradeOrder }> {
    await this.initialize();
    let result: { success: boolean; error?: string; trade?: TradeOrder } = { success: false };

    await this.db.transaction(async (tx) => {
      // 1. Fetch and validate the order
      const [order] = await tx
        .select()
        .from(tradeOrdersTable)
        .where(eq(tradeOrdersTable.id, orderId));

      if (!order) { result = { success: false, error: "Order not found" }; return; }
      if (order.status !== "open") { result = { success: false, error: "Order is no longer open" }; return; }
      if (order.offererId === fillerId) { result = { success: false, error: "Cannot fill your own order" }; return; }

      // 2. Fetch both players
      const [offererRow] = await tx
        .select()
        .from(playersTable)
        .where(eq(playersTable.id, order.offererId));
      const [fillerRow] = await tx
        .select()
        .from(playersTable)
        .where(eq(playersTable.id, fillerId));

      if (!offererRow) { result = { success: false, error: "Offerer not found" }; return; }
      if (!fillerRow)  { result = { success: false, error: "Filler not found" };  return; }

      // 3. Verify balances — resource columns are iron/fuel/crystal/frontier (all integers)
      const resourceCols = { iron: playersTable.iron, fuel: playersTable.fuel, crystal: playersTable.crystal, frontier: playersTable.frontier } as const;
      type ResKey = keyof typeof resourceCols;
      const giveCol = resourceCols[order.giveResource as ResKey];
      const wantCol = resourceCols[order.wantResource as ResKey];

      const offererBalance = (offererRow as unknown as Record<string, number>)[order.giveResource] ?? 0;
      const fillerBalance  = (fillerRow  as unknown as Record<string, number>)[order.wantResource] ?? 0;

      if (offererBalance < order.giveAmount) {
        result = { success: false, error: "Offerer no longer has enough resources" };
        return;
      }
      if (fillerBalance < order.wantAmount) {
        result = { success: false, error: "Insufficient resources to fill this order" };
        return;
      }

      // 4. Deduct giveResource from offerer, credit wantResource to offerer
      await tx.update(playersTable)
        .set({
          [order.giveResource]: sql`${giveCol} - ${order.giveAmount}`,
          [order.wantResource]: sql`${wantCol} + ${order.wantAmount}`,
        })
        .where(eq(playersTable.id, order.offererId));

      // 5. Deduct wantResource from filler, credit giveResource to filler
      await tx.update(playersTable)
        .set({
          [order.wantResource]: sql`${wantCol} - ${order.wantAmount}`,
          [order.giveResource]: sql`${giveCol} + ${order.giveAmount}`,
        })
        .where(eq(playersTable.id, fillerId));

      // 6. Mark order filled — persist filler identity for history / leaderboard
      const now = Date.now();
      const [filled] = await tx.update(tradeOrdersTable)
        .set({ status: "filled", filledById: fillerId, filledByName: fillerRow.name, filledAt: now })
        .where(eq(tradeOrdersTable.id, orderId))
        .returning();

      result = { success: true, trade: filled };
    });

    return result;
  }

  // ── Sub-Parcel Methods ─────────────────────────────────────────────────────

  async getSubParcels(parentPlotId: number): Promise<SubParcel[]> {
    await this.initialize();
    const rows = await this.db
      .select()
      .from(subParcelsTable)
      .where(eq(subParcelsTable.parentPlotId, parentPlotId));
    return rows.map(rowToSubParcel);
  }

  async isSubdivided(parentPlotId: number): Promise<boolean> {
    await this.initialize();
    const [row] = await this.db
      .select({ id: subParcelsTable.id })
      .from(subParcelsTable)
      .where(eq(subParcelsTable.parentPlotId, parentPlotId))
      .limit(1);
    return !!row;
  }

  async subdivideParcel(plotId: number, playerId: string): Promise<{ subParcels: SubParcel[]; error?: string }> {
    await this.initialize();

    // Load the parcel
    const [parcelRow] = await this.db
      .select()
      .from(parcelsTable)
      .where(eq(parcelsTable.plotId, plotId));
    if (!parcelRow) return { subParcels: [], error: "Plot not found" };

    const parcel = rowToParcel(parcelRow);
    const alreadySubdivided = await this.isSubdivided(plotId);
    const now = Date.now();

    const validationError = canSubdivideParcel(parcel, playerId, alreadySubdivided, now);
    if (validationError) return { subParcels: [], error: validationError };

    const rows = buildSubParcelRows(parcel, playerId, now);
    const inserted = await this.db
      .insert(subParcelsTable)
      .values(rows)
      .returning();

    // Log event
    await this.db.insert(gameEventsTable).values({
      id:          randomUUID(),
      type:        "build",
      playerId,
      parcelId:    parcelRow.id,
      description: `Plot #${plotId} subdivided into ${SUB_PARCEL_COUNT} sub-parcels`,
      narrativeText: `🏗️ A colonist subdivides Plot #${plotId} — ${SUB_PARCEL_COUNT - 1} sub-parcels now available for purchase!`,
      ts:          now,
    });

    return { subParcels: inserted.map(rowToSubParcel) };
  }

  async purchaseSubParcel(subParcelId: string, playerId: string): Promise<{ subParcel: SubParcel; error?: string }> {
    await this.initialize();

    const [row] = await this.db
      .select()
      .from(subParcelsTable)
      .where(eq(subParcelsTable.id, subParcelId));
    if (!row) return { subParcel: null as any, error: "Sub-parcel not found" };
    if (row.ownerId) return { subParcel: rowToSubParcel(row), error: "Sub-parcel already owned" };

    // Deduct FRONTIER from player
    const [playerRow] = await this.db
      .select()
      .from(playersTable)
      .where(eq(playersTable.id, playerId));
    if (!playerRow) return { subParcel: null as any, error: "Player not found" };

    const playerFrontier = fromMicroFRNTR(playerRow.frntrBalanceMicro);
    if (playerFrontier < row.purchasePriceFrontier) {
      return { subParcel: null as any, error: `Insufficient FRONTIER — need ${row.purchasePriceFrontier}, have ${playerFrontier.toFixed(2)}` };
    }

    const now = Date.now();
    const costMicro = toMicroFRNTR(row.purchasePriceFrontier);

    // 4-way revenue split:
    //   30% → protocol treasury
    //   20% → buyer's faction leader (AI player whose name = parcel.capturedFromFaction)
    //   30% → center sub-parcel (subIndex=4) owner as land tax
    //   20% → burned (not credited anywhere)
    const treasuryShareMicro = Math.floor(costMicro * 0.30);
    const factionShareMicro  = Math.floor(costMicro * 0.20);
    const landTaxMicro       = Math.floor(costMicro * 0.30);
    // remaining 20% is burned (costMicro - treasuryShareMicro - factionShareMicro - landTaxMicro)

    // Fetch parent macro-plot for faction info
    const [parcelRow] = await this.db
      .select({ capturedFromFaction: parcelsTable.capturedFromFaction })
      .from(parcelsTable)
      .where(eq(parcelsTable.plotId, row.parentPlotId));
    const capturedFromFaction = parcelRow?.capturedFromFaction ?? null;

    // Look up faction leader (AI player matching the faction name)
    let factionLeaderId: string | null = null;
    if (capturedFromFaction) {
      const [factionRow] = await this.db
        .select({ id: playersTable.id })
        .from(playersTable)
        .where(sql`lower(${playersTable.name}) = lower(${capturedFromFaction}) and ${playersTable.isAi} = true`)
        .limit(1);
      factionLeaderId = factionRow?.id ?? null;
    }

    // Look up center sub-parcel (subIndex=4) owner for land tax
    const [centerRow] = await this.db
      .select({ ownerId: subParcelsTable.ownerId })
      .from(subParcelsTable)
      .where(sql`${subParcelsTable.parentPlotId} = ${row.parentPlotId} and ${subParcelsTable.subIndex} = 4`)
      .limit(1);
    const centerOwnerId = centerRow?.ownerId ?? null;

    const [updated] = await this.db
      .update(subParcelsTable)
      .set({ ownerId: playerId, ownerType: "player", acquiredAt: now })
      .where(eq(subParcelsTable.id, subParcelId))
      .returning();

    // Deduct full cost from buyer
    await this.db
      .update(playersTable)
      .set({ frntrBalanceMicro: sql`${playersTable.frntrBalanceMicro} - ${costMicro}` })
      .where(eq(playersTable.id, playerId));

    // 30% → protocol treasury
    await this.recordTreasuryFee(treasuryShareMicro, playerId, "sub_parcel_purchase");

    // 20% → faction leader (or treasury if none found)
    if (factionLeaderId) {
      await this.db
        .update(playersTable)
        .set({ frntrBalanceMicro: sql`${playersTable.frntrBalanceMicro} + ${factionShareMicro}` })
        .where(eq(playersTable.id, factionLeaderId));
    } else {
      await this.recordTreasuryFee(factionShareMicro, playerId, "sub_parcel_purchase_no_faction");
    }

    // 30% → center sub-parcel owner as land tax (skip/burn if no owner or buyer is center owner)
    if (centerOwnerId && centerOwnerId !== playerId) {
      await this.db
        .update(playersTable)
        .set({ frntrBalanceMicro: sql`${playersTable.frntrBalanceMicro} + ${landTaxMicro}` })
        .where(eq(playersTable.id, centerOwnerId));
    }
    // remaining 20% is burned by omission

    return { subParcel: rowToSubParcel(updated) };
  }

  async buildSubParcelImprovement(subParcelId: string, playerId: string, improvementType: ImprovementType): Promise<{ subParcel: SubParcel; error?: string }> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[spRow], [playerRow]] = await Promise.all([
        tx.select().from(subParcelsTable).where(eq(subParcelsTable.id, subParcelId)),
        tx.select().from(playersTable).where(eq(playersTable.id, playerId)),
      ]);
      if (!spRow) return { subParcel: null as any, error: "Sub-parcel not found" };
      if (!playerRow) return { subParcel: null as any, error: "Player not found" };
      if (spRow.ownerId !== playerId) return { subParcel: null as any, error: "You don't own this sub-parcel" };

      const currentImprovements: Improvement[] = Array.isArray(spRow.improvements) ? (spRow.improvements as Improvement[]) : [];
      const existing = currentImprovements.find(i => i.type === improvementType);

      const isFacility = improvementType in FACILITY_INFO;
      const isDefense  = improvementType in DEFENSE_IMPROVEMENT_INFO;
      if (!isFacility && !isDefense) return { subParcel: null as any, error: "Invalid improvement type" };

      const level = existing ? existing.level + 1 : 1;
      let playerUpdates: Partial<typeof playerRow> = {};

      if (isFacility) {
        const info = FACILITY_INFO[improvementType as FacilityType];
        if (existing && existing.level >= info.maxLevel) return { subParcel: null as any, error: "Facility already at max level" };
        if (info.prerequisite && !currentImprovements.find(i => i.type === info.prerequisite)) {
          return { subParcel: null as any, error: `Requires ${FACILITY_INFO[info.prerequisite!].name} first` };
        }
        const cost = SUB_PARCEL_FACILITY_COSTS[improvementType as FacilityType][level - 1];
        const microCost = toMicroFRNTR(cost);
        if (playerRow.frntrBalanceMicro < microCost) return { subParcel: null as any, error: `Insufficient FRONTIER (need ${cost})` };
        playerUpdates = {
          frntrBalanceMicro:   playerRow.frntrBalanceMicro - microCost,
          totalFrontierBurned: playerRow.totalFrontierBurned + cost,
        };
      } else {
        const info = DEFENSE_IMPROVEMENT_INFO[improvementType as DefenseImprovementType];
        if (existing && existing.level >= info.maxLevel) return { subParcel: null as any, error: "Improvement already at max level" };
        const cost = { iron: SUB_PARCEL_DEFENSE_COSTS[improvementType as DefenseImprovementType].iron * level,
                       fuel: SUB_PARCEL_DEFENSE_COSTS[improvementType as DefenseImprovementType].fuel * level };
        if (playerRow.iron < cost.iron || playerRow.fuel < cost.fuel) return { subParcel: null as any, error: "Insufficient resources" };
        playerUpdates = { iron: playerRow.iron - cost.iron, fuel: playerRow.fuel - cost.fuel };
      }

      const newImprovements = existing
        ? currentImprovements.map(i => i.type === improvementType ? { ...i, level } : i)
        : [...currentImprovements, { type: improvementType, level: 1 }];

      const [[updatedSp]] = await Promise.all([
        tx.update(subParcelsTable).set({ improvements: newImprovements }).where(eq(subParcelsTable.id, subParcelId)).returning(),
        tx.update(playersTable).set(playerUpdates).where(eq(playersTable.id, playerId)),
      ]);

      return { subParcel: rowToSubParcel(updatedSp) };
    });
  }

  // ── Treasury Methods ────────────────────────────────────────────────────────

  async recordTreasuryFee(amountMicro: number, fromPlayerId: string | null, eventType: string): Promise<void> {
    await this.initialize();
    await this.db.insert(treasuryLedgerTable).values({
      id:           randomUUID(),
      eventType,
      amountMicro,
      fromPlayerId: fromPlayerId ?? undefined,
      settled:      false,
      createdAt:    Date.now(),
    });
  }

  async getTreasuryBalance(): Promise<{ unsettledMicro: number; totalMicro: number }> {
    await this.initialize();
    const [unsettledRow] = await this.db
      .select({ total: sum(treasuryLedgerTable.amountMicro) })
      .from(treasuryLedgerTable)
      .where(eq(treasuryLedgerTable.settled, false));
    const [totalRow] = await this.db
      .select({ total: sum(treasuryLedgerTable.amountMicro) })
      .from(treasuryLedgerTable);
    return {
      unsettledMicro: Number(unsettledRow?.total ?? 0),
      totalMicro:     Number(totalRow?.total ?? 0),
    };
  }

  async getUnsettledTreasuryRows(): Promise<{ id: string; amountMicro: number }[]> {
    await this.initialize();
    return this.db
      .select({ id: treasuryLedgerTable.id, amountMicro: treasuryLedgerTable.amountMicro })
      .from(treasuryLedgerTable)
      .where(eq(treasuryLedgerTable.settled, false));
  }

  async markTreasurySettled(ids: string[], txId: string): Promise<void> {
    await this.initialize();
    if (ids.length === 0) return;
    for (const id of ids) {
      await this.db
        .update(treasuryLedgerTable)
        .set({ settled: true, settleTxId: txId })
        .where(eq(treasuryLedgerTable.id, id));
    }
  }

  // ── Season Methods ─────────────────────────────────────────────────────────

  async getCurrentSeason(): Promise<Season | null> {
    await this.initialize();
    const [row] = await this.db
      .select()
      .from(seasonsTable)
      .where(eq(seasonsTable.status, "active"))
      .orderBy(desc(seasonsTable.number))
      .limit(1);
    if (!row) return null;
    return {
      id:             row.id,
      number:         row.number,
      name:           row.name,
      startedAt:      Number(row.startedAt),
      endsAt:         Number(row.endsAt),
      status:         row.status as Season["status"],
      winnerId:       row.winnerId ?? null,
      totalPlotsAtEnd: row.totalPlotsAtEnd ?? null,
      rewardPool:     row.rewardPool,
    };
  }

  async startSeason(name: string, daysLen = 90): Promise<Season> {
    await this.initialize();

    // Ensure no active season
    const existing = await this.getCurrentSeason();
    if (existing) throw new Error("A season is already active");

    // Determine next season number
    const [lastRow] = await this.db
      .select({ number: seasonsTable.number })
      .from(seasonsTable)
      .orderBy(desc(seasonsTable.number))
      .limit(1);
    const number = (lastRow?.number ?? 0) + 1;

    const now = Date.now();
    const endsAt = now + daysLen * 24 * 60 * 60 * 1000;

    const [row] = await this.db
      .insert(seasonsTable)
      .values({ id: randomUUID(), number, name, startedAt: now, endsAt, status: "active", rewardPool: 0, leaderboardSnapshot: [] })
      .returning();

    return {
      id: row.id, number: row.number, name: row.name,
      startedAt: Number(row.startedAt), endsAt: Number(row.endsAt),
      status: "active", winnerId: null, totalPlotsAtEnd: null, rewardPool: row.rewardPool,
    };
  }

  async settleCurrentSeason(): Promise<Season | null> {
    await this.initialize();
    const current = await this.getCurrentSeason();
    if (!current) return null;

    const allPlayersFull = await this.db.select().from(playersTable);
    const allParcelsFull = await this.db.select().from(parcelsTable);
    const leaderboard = computeLeaderboard(allPlayersFull, allParcelsFull);
    const claimedPlots = allParcelsFull.filter(p => p.ownerId).length;
    const winnerId = leaderboard[0]?.playerId ?? null;

    const [row] = await this.db
      .update(seasonsTable)
      .set({
        status: "complete",
        winnerId,
        totalPlotsAtEnd: claimedPlots,
        leaderboardSnapshot: leaderboard.slice(0, 10) as object[],
      })
      .where(eq(seasonsTable.id, current.id))
      .returning();

    return {
      id: row.id, number: row.number, name: row.name,
      startedAt: Number(row.startedAt), endsAt: Number(row.endsAt),
      status: "complete", winnerId: row.winnerId ?? null,
      totalPlotsAtEnd: row.totalPlotsAtEnd ?? null, rewardPool: row.rewardPool,
    };
  }

  async getSeasonHistory(): Promise<Season[]> {
    await this.initialize();
    const rows = await this.db
      .select()
      .from(seasonsTable)
      .orderBy(seasonsTable.number);
    return rows.map(row => ({
      id: row.id, number: row.number, name: row.name,
      startedAt: Number(row.startedAt), endsAt: Number(row.endsAt),
      status: row.status as Season["status"],
      winnerId: row.winnerId ?? null, totalPlotsAtEnd: row.totalPlotsAtEnd ?? null, rewardPool: row.rewardPool,
    }));
  }

  // ── Prediction Markets ─────────────────────────────────────────────────────

  private rowToMarket(row: typeof predictionMarketsTable.$inferSelect): PredictionMarket {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category as PredictionMarket["category"],
      resolutionCriteria: row.resolutionCriteria,
      outcomeALabel: row.outcomeALabel,
      outcomeBLabel: row.outcomeBLabel,
      tokenPoolA: row.tokenPoolA,
      tokenPoolB: row.tokenPoolB,
      status: row.status as PredictionMarket["status"],
      resolvesAt: Number(row.resolvesAt),
      resolvedAt: row.resolvedAt ? Number(row.resolvedAt) : null,
      winningOutcome: (row.winningOutcome as MarketOutcome) ?? null,
      createdBy: row.createdBy,
      relatedEventId: row.relatedEventId ?? null,
      createdAt: Number(row.createdAt),
    };
  }

  private rowToPosition(row: typeof marketPositionsTable.$inferSelect): MarketPosition {
    return {
      id: row.id,
      marketId: row.marketId,
      playerId: row.playerId,
      outcome: row.outcome as MarketOutcome,
      amountWagered: row.amountWagered,
      claimed: row.claimed,
      createdAt: Number(row.createdAt),
    };
  }

  async getOpenMarkets(): Promise<PredictionMarket[]> {
    await this.initialize();
    const rows = await this.db
      .select()
      .from(predictionMarketsTable)
      .where(eq(predictionMarketsTable.status, "open"))
      .orderBy(desc(predictionMarketsTable.resolvesAt));
    return rows.map(r => this.rowToMarket(r));
  }

  async getAllMarkets(limit = 50): Promise<PredictionMarket[]> {
    await this.initialize();
    const rows = await this.db
      .select()
      .from(predictionMarketsTable)
      .orderBy(desc(predictionMarketsTable.createdAt))
      .limit(limit);
    return rows.map(r => this.rowToMarket(r));
  }

  async getMarket(id: string): Promise<PredictionMarket | undefined> {
    await this.initialize();
    const [row] = await this.db
      .select()
      .from(predictionMarketsTable)
      .where(eq(predictionMarketsTable.id, id));
    return row ? this.rowToMarket(row) : undefined;
  }

  async createMarket(action: CreateMarketAction, createdBy = "admin"): Promise<PredictionMarket> {
    await this.initialize();
    const now = Date.now();
    const [row] = await this.db
      .insert(predictionMarketsTable)
      .values({
        id: randomUUID(),
        title: action.title,
        description: action.description,
        category: action.category,
        resolutionCriteria: action.resolutionCriteria,
        outcomeALabel: action.outcomeALabel ?? "Yes",
        outcomeBLabel: action.outcomeBLabel ?? "No",
        tokenPoolA: 0,
        tokenPoolB: 0,
        status: "open",
        resolvesAt: action.resolvesAt,
        relatedEventId: action.relatedEventId ?? null,
        createdBy,
        createdAt: now,
      })
      .returning();
    return this.rowToMarket(row);
  }

  async placeBet(
    marketId: string,
    playerId: string,
    outcome: MarketOutcome,
    amount: number,
  ): Promise<{ position: MarketPosition; market: PredictionMarket } | { error: string }> {
    await this.initialize();

    const [marketRow] = await this.db
      .select()
      .from(predictionMarketsTable)
      .where(eq(predictionMarketsTable.id, marketId));
    if (!marketRow) return { error: "Market not found" };
    if (marketRow.status !== "open") return { error: "Market is not open for betting" };
    if (Number(marketRow.resolvesAt) <= Date.now()) return { error: "Market has expired" };

    const [playerRow] = await this.db
      .select()
      .from(playersTable)
      .where(eq(playersTable.id, playerId));
    if (!playerRow) return { error: "Player not found" };
    if (playerRow.isAi) return { error: "AI players cannot place bets" };
    if (playerRow.frontier < amount) return { error: "Insufficient FRONTIER balance" };

    // Deduct from player
    await this.db
      .update(playersTable)
      .set({ frontier: playerRow.frontier - amount })
      .where(eq(playersTable.id, playerId));

    // Update pool
    const poolField = outcome === "a" ? { tokenPoolA: marketRow.tokenPoolA + amount } : { tokenPoolB: marketRow.tokenPoolB + amount };
    const [updatedMarket] = await this.db
      .update(predictionMarketsTable)
      .set(poolField)
      .where(eq(predictionMarketsTable.id, marketId))
      .returning();

    // Create position
    const [posRow] = await this.db
      .insert(marketPositionsTable)
      .values({
        id: randomUUID(),
        marketId,
        playerId,
        outcome,
        amountWagered: amount,
        claimed: false,
        createdAt: Date.now(),
      })
      .returning();

    return { position: this.rowToPosition(posRow), market: this.rowToMarket(updatedMarket) };
  }

  async claimWinnings(marketId: string, playerId: string): Promise<{ payout: number } | { error: string }> {
    await this.initialize();

    const [marketRow] = await this.db
      .select()
      .from(predictionMarketsTable)
      .where(eq(predictionMarketsTable.id, marketId));
    if (!marketRow) return { error: "Market not found" };
    if (marketRow.status !== "resolved") return { error: "Market not yet resolved" };
    if (!marketRow.winningOutcome) return { error: "No winning outcome set" };

    // Get player's unclaimed winning positions
    const positions = await this.db
      .select()
      .from(marketPositionsTable)
      .where(
        and(
          eq(marketPositionsTable.marketId, marketId),
          eq(marketPositionsTable.playerId, playerId),
          eq(marketPositionsTable.outcome, marketRow.winningOutcome),
          eq(marketPositionsTable.claimed, false),
        )
      );
    if (positions.length === 0) return { error: "No unclaimed winning positions" };

    // Sum of player's winning wagers
    const playerWagered = positions.reduce((s, p) => s + p.amountWagered, 0);

    // Total winning side pool
    const totalWinningPool = marketRow.winningOutcome === "a" ? marketRow.tokenPoolA : marketRow.tokenPoolB;
    const totalLosingPool = marketRow.winningOutcome === "a" ? marketRow.tokenPoolB : marketRow.tokenPoolA;

    if (totalWinningPool === 0) return { error: "Winning pool is empty" };

    const totalPool = totalWinningPool + totalLosingPool;
    const feeAmount = totalPool * MARKET_FEE_RATE;
    const distributablePool = totalPool - feeAmount;

    const payout = Math.floor((playerWagered / totalWinningPool) * distributablePool);

    // Mark positions claimed
    for (const pos of positions) {
      await this.db
        .update(marketPositionsTable)
        .set({ claimed: true })
        .where(eq(marketPositionsTable.id, pos.id));
    }

    // Credit player
    const [playerRow] = await this.db.select().from(playersTable).where(eq(playersTable.id, playerId));
    if (playerRow) {
      await this.db
        .update(playersTable)
        .set({ frontier: playerRow.frontier + payout })
        .where(eq(playersTable.id, playerId));
    }

    // Record fee to treasury
    if (feeAmount > 0 && positions.length > 0) {
      const playerShare = (playerWagered / totalWinningPool) * feeAmount;
      await this.db.insert(treasuryLedgerTable).values({
        id: randomUUID(),
        eventType: "prediction_market_fee",
        amountMicro: Math.floor(playerShare * 1_000_000),
        fromPlayerId: playerId,
        settled: false,
        createdAt: Date.now(),
      });
    }

    return { payout };
  }

  async resolveMarket(marketId: string, winningOutcome: MarketOutcome): Promise<PredictionMarket | { error: string }> {
    await this.initialize();

    const [marketRow] = await this.db
      .select()
      .from(predictionMarketsTable)
      .where(eq(predictionMarketsTable.id, marketId));
    if (!marketRow) return { error: "Market not found" };
    if (marketRow.status === "resolved") return { error: "Market already resolved" };
    if (marketRow.status === "cancelled") return { error: "Market is cancelled" };

    const [updated] = await this.db
      .update(predictionMarketsTable)
      .set({ status: "resolved", winningOutcome, resolvedAt: Date.now() })
      .where(eq(predictionMarketsTable.id, marketId))
      .returning();

    return this.rowToMarket(updated);
  }

  async getPlayerPositions(playerId: string): Promise<(MarketPosition & { market: PredictionMarket })[]> {
    await this.initialize();
    const positions = await this.db
      .select()
      .from(marketPositionsTable)
      .where(eq(marketPositionsTable.playerId, playerId))
      .orderBy(desc(marketPositionsTable.createdAt));

    const result: (MarketPosition & { market: PredictionMarket })[] = [];
    for (const pos of positions) {
      const [marketRow] = await this.db
        .select()
        .from(predictionMarketsTable)
        .where(eq(predictionMarketsTable.id, pos.marketId));
      if (marketRow) {
        result.push({ ...this.rowToPosition(pos), market: this.rowToMarket(marketRow) });
      }
    }
    return result;
  }

  async resolveExpiredMarkets(): Promise<void> {
    // Close markets past their deadline but not yet resolved
    // (admin must manually pick winner via /api/admin/markets/:id/resolve)
    const now = Date.now();
    await this.db
      .update(predictionMarketsTable)
      .set({ status: "closed" })
      .where(
        and(
          eq(predictionMarketsTable.status, "open"),
          lt(predictionMarketsTable.resolvesAt, now),
        )
      );
  }
}
