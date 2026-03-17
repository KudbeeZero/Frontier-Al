import { randomUUID } from "crypto";
import type { TradeOrder, InsertTradeOrder } from "../db-schema";
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
  CommanderTier,
  ReconDrone,
  OrbitalSatellite,
  OrbitalEvent,
  OrbitalEffect,
  SlimGameState,
  SlimParcel,
  SlimPlayer,
  SubParcel,
  SubParcelListing,
  SubParcelArchetype,
  EnergyAlignment,
  Season,
  ImprovementType,
  PredictionMarket,
  MarketPosition,
  MarketOutcome,
  CreateMarketAction,
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
  ORBITAL_IMPACT_CHANCE,
} from "@shared/schema";
import type { FacilityType, DefenseImprovementType } from "@shared/schema";
import { generateFibonacciSphere, sphereDistance, type PlotCoord } from "../sphereUtils";
import { biomeFromLatitude } from "./game-rules";
import type { IStorage } from "./interface";

const AI_NAMES = ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"];
const AI_BEHAVIORS: Player["aiBehavior"][] = ["expansionist", "defensive", "raider", "economic"];

export class MemStorage implements IStorage {
  private parcels: Map<string, LandParcel>;
  private parcelByPlotId: Map<number, string>;
  private players: Map<string, Player>;
  private battles: Map<string, Battle>;
  private events: GameEvent[];
  private currentTurn: number;
  private lastUpdateTs: number;
  private initialized: boolean = false;
  private plotCoords: PlotCoord[] = [];
  private frontierCirculating: number = 0;

  constructor() {
    this.parcels = new Map();
    this.parcelByPlotId = new Map();
    this.players = new Map();
    this.battles = new Map();
    this.events = [];
    this.currentTurn = 1;
    this.lastUpdateTs = Date.now();
  }

  async initialize() {
    if (this.initialized) return;

    this.plotCoords = generateFibonacciSphere(TOTAL_PLOTS);

    for (const coord of this.plotCoords) {
      const id = randomUUID();
      const biome = biomeFromLatitude(coord.lat, coord.plotId);
      const richness = Math.floor(Math.random() * 60) + 40;

      const parcel: LandParcel = {
        id,
        plotId: coord.plotId,
        lat: coord.lat,
        lng: coord.lng,
        biome,
        richness,
        ownerId: null,
        ownerType: null,
        defenseLevel: 1,
        ironStored: 0,
        fuelStored: 0,
        crystalStored: 0,
        storageCapacity: BASE_STORAGE_CAPACITY,
        lastMineTs: 0,
        activeBattleId: null,
        yieldMultiplier: 1.0,
        improvements: [],
        purchasePriceAlgo: LAND_PURCHASE_ALGO[biome],
        frontierAccumulated: 0,
        lastFrontierClaimTs: Date.now(),
        frontierPerDay: 1,
        influence: 100,
        influenceRepairRate: 2.0,
        capturedFromFaction: null,
        capturedAt:          null,
        handoverCount:       0,
        hazardLevel:         0,
        stability:           100,
      };
      this.parcels.set(id, parcel);
      this.parcelByPlotId.set(coord.plotId, id);
    }

    const humanPlayerId = randomUUID();
    const humanPlayer: Player = {
      id: humanPlayerId,
      address: "PLAYER_WALLET",
      name: "Commander",
      iron: 200,
      fuel: 150,
      crystal: 50,
      frontier: 0,
      ownedParcels: [],
      isAI: false,
      totalIronMined: 0,
      totalFuelMined: 0,
      totalCrystalMined: 0,
      totalFrontierEarned: 0,
      totalFrontierBurned: 0,
      attacksWon: 0,
      attacksLost: 0,
      territoriesCaptured: 0,
      commander: null,
      commanders: [],
      activeCommanderIndex: 0,
      specialAttacks: [],
      drones: [],
      satellites: [],
      welcomeBonusReceived: false,
      testnetProgress: [],
    };
    this.players.set(humanPlayerId, humanPlayer);

    const startPlotId = this.parcelByPlotId.get(1);
    if (startPlotId) {
      const startParcel = this.parcels.get(startPlotId);
      if (startParcel) {
        startParcel.ownerId = humanPlayerId;
        startParcel.ownerType = "player";
        startParcel.defenseLevel = 3;
        startParcel.purchasePriceAlgo = null;
        humanPlayer.ownedParcels.push(startParcel.id);
      }
    }

    const aiStartPlots = [5250, 10500, 15750, 20000];
    for (let i = 0; i < 4; i++) {
      const aiId = randomUUID();
      const aiPlayer: Player = {
        id: aiId,
        address: `AI_WALLET_${i}`,
        name: AI_NAMES[i],
        iron: 150,
        fuel: 100,
        crystal: 25,
        frontier: 0,
        ownedParcels: [],
        isAI: true,
        aiBehavior: AI_BEHAVIORS[i],
        totalIronMined: 0,
        totalFuelMined: 0,
        totalCrystalMined: 0,
        totalFrontierEarned: 0,
        totalFrontierBurned: 0,
        attacksWon: 0,
        attacksLost: 0,
        territoriesCaptured: 0,
        commander: null,
        commanders: [],
        activeCommanderIndex: 0,
        specialAttacks: [],
        drones: [],
        satellites: [],
        welcomeBonusReceived: true,
        testnetProgress: [],
      };
      this.players.set(aiId, aiPlayer);

      const aiPlotUuid = this.parcelByPlotId.get(aiStartPlots[i]);
      if (aiPlotUuid) {
        const aiParcel = this.parcels.get(aiPlotUuid);
        if (aiParcel && !aiParcel.ownerId) {
          aiParcel.ownerId = aiId;
          aiParcel.ownerType = "ai";
          aiParcel.defenseLevel = 2;
          aiParcel.purchasePriceAlgo = null;
          aiPlayer.ownedParcels.push(aiParcel.id);
        }
      }
    }

    this.events.push({
      id: randomUUID(),
      type: "ai_action",
      playerId: "system",
      description: "Game world initialized. 21,000 plots ready. Factions are mobilizing.",
      timestamp: Date.now(),
    });

    this.initialized = true;
  }

  resetInitState(): void {
    this.initialized = false;
    this.parcels.clear();
    this.parcelByPlotId.clear();
    this.players.clear();
    this.battles.clear();
    this.events = [];
    this.currentTurn = 1;
    this.lastUpdateTs = Date.now();
  }

  private updateFrontierAccumulation(parcel: LandParcel) {
    if (!parcel.ownerId) return;
    const now = Date.now();
    const daysSinceLastClaim = (now - parcel.lastFrontierClaimTs) / (1000 * 60 * 60 * 24);
    if (daysSinceLastClaim <= 0) return;

    const perDay = calculateFrontierPerDay(parcel.improvements);
    parcel.frontierPerDay = perDay;
    const earned = perDay * daysSinceLastClaim;
    parcel.frontierAccumulated += earned;
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    await this.initialize();
    const entries: LeaderboardEntry[] = [];
    for (const player of Array.from(this.players.values())) {
      entries.push({
        playerId: player.id,
        name: player.name,
        address: player.address,
        territories: player.ownedParcels.length,
        totalIronMined: player.totalIronMined,
        totalFuelMined: player.totalFuelMined,
        totalCrystalMined: player.totalCrystalMined,
        totalFrontierEarned: player.totalFrontierEarned,
        attacksWon: player.attacksWon,
        attacksLost: player.attacksLost,
        isAI: player.isAI,
      });
    }
    return entries.sort((a, b) => b.territories - a.territories || b.totalFrontierEarned - a.totalFrontierEarned);
  }

  async getGameState(): Promise<GameState> {
    await this.initialize();
    await this.resolveBattles();

    const claimedPlots = Array.from(this.parcels.values()).filter((p) => p.ownerId !== null).length;

    return {
      parcels: Array.from(this.parcels.values()),
      players: Array.from(this.players.values()),
      battles: Array.from(this.battles.values()),
      events: this.events.slice(-50).reverse(),
      leaderboard: await this.getLeaderboard(),
      currentTurn: this.currentTurn,
      lastUpdateTs: this.lastUpdateTs,
      totalPlots: TOTAL_PLOTS,
      claimedPlots,
      frontierTotalSupply: FRONTIER_TOTAL_SUPPLY,
      frontierCirculating: this.frontierCirculating,
      currentSeason: null,
    };
  }

  async getSlimGameState(): Promise<SlimGameState> {
    const full = await this.getGameState();
    return {
      parcels: full.parcels.map(p => ({
        id: p.id,
        plotId: p.plotId,
        lat: p.lat,
        lng: p.lng,
        biome: p.biome,
        ownerId: p.ownerId,
        activeBattleId: p.activeBattleId,
      })),
      players: full.players.map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        isAI: p.isAI,
      })),
      battles: full.battles,
      leaderboard: full.leaderboard,
      claimedPlots: full.claimedPlots,
      frontierCirculating: full.frontierCirculating,
      lastUpdateTs: full.lastUpdateTs,
      seasonEndsAt: null,
      seasonName: null,
    };
  }

  async getParcel(id: string): Promise<LandParcel | undefined> {
    await this.initialize();
    return this.parcels.get(id);
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    await this.initialize();
    return this.players.get(id);
  }

  async getBattle(id: string): Promise<Battle | undefined> {
    await this.initialize();
    return this.battles.get(id);
  }

  async mineResources(action: MineAction): Promise<{ iron: number; fuel: number; crystal: number; mineralDrops: Partial<Record<string, number>> }> {
    await this.initialize();

    const parcel = this.parcels.get(action.parcelId);
    const player = this.players.get(action.playerId);

    if (!parcel || !player) throw new Error("Invalid parcel or player");
    if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

    const now = Date.now();
    const aiLab = parcel.improvements.find(i => i.type === "ai_lab");
    const cooldownReductionMs = aiLab ? aiLab.level * 30_000 : 0;
    const effectiveCooldownMs = Math.max(60_000, MINE_COOLDOWN_MS - cooldownReductionMs);
    if (now - parcel.lastMineTs < effectiveCooldownMs) throw new Error("Mining cooldown not complete");

    const activeSatellites = player.satellites.filter(s => s.status === "active" && s.expiresAt > now);
    const satelliteMult = activeSatellites.length > 0 ? 1 + SATELLITE_YIELD_BONUS : 1;

    const biomeBonus = biomeBonuses[parcel.biome];
    const richnessMultiplier = parcel.richness / 100;
    const influenceMult = (parcel.influence ?? 100) / 100;
    const ironYield    = Math.floor(BASE_YIELD.iron    * biomeBonus.ironMod    * richnessMultiplier * influenceMult * parcel.yieldMultiplier * satelliteMult);
    const fuelYield    = Math.floor(BASE_YIELD.fuel    * biomeBonus.fuelMod    * richnessMultiplier * influenceMult * parcel.yieldMultiplier * satelliteMult);
    const crystalYield = Math.floor(BASE_YIELD.crystal * biomeBonus.crystalMod * richnessMultiplier * influenceMult * parcel.yieldMultiplier * satelliteMult);

    const totalStored = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
    const remaining = parcel.storageCapacity - totalStored;
    const totalYield = ironYield + fuelYield + crystalYield;

    const ratio = remaining < totalYield ? remaining / totalYield : 1;
    const finalIron    = Math.floor(ironYield    * ratio);
    const finalFuel    = Math.floor(fuelYield    * ratio);
    const finalCrystal = Math.floor(crystalYield * ratio);

    parcel.ironStored    += finalIron;
    parcel.fuelStored    += finalFuel;
    parcel.crystalStored += finalCrystal;
    parcel.lastMineTs     = now;

    player.totalIronMined    += finalIron;
    player.totalFuelMined    += finalFuel;
    player.totalCrystalMined += finalCrystal;

    // Richness depletes by 0.5 per mine, floor raised to 40.
    if (parcel.richness > 40) {
      parcel.richness = Math.max(40, Math.floor(parcel.richness - 0.5));
    }
    // Active influence repair: +2 per mine, capped at 100.
    parcel.influence = Math.min(100, (parcel.influence ?? 100) + 2);

    this.events.push({
      id: randomUUID(),
      type: "mine",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} mined ${finalIron} iron, ${finalFuel} fuel, ${finalCrystal} crystal from plot #${parcel.plotId} [${parcel.biome}] (richness: ${parcel.richness})`,
      timestamp: now,
    });

    this.lastUpdateTs = now;
    return { iron: finalIron, fuel: finalFuel, crystal: finalCrystal, mineralDrops: {} };
  }

  async collectAll(playerId: string): Promise<{ iron: number; fuel: number; crystal: number }> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");

    let totalIron = 0,
      totalFuel = 0,
      totalCrystal = 0;

    for (const parcelId of player.ownedParcels) {
      const parcel = this.parcels.get(parcelId);
      if (!parcel) continue;

      totalIron += parcel.ironStored;
      totalFuel += parcel.fuelStored;
      totalCrystal += parcel.crystalStored;

      parcel.ironStored = 0;
      parcel.fuelStored = 0;
      parcel.crystalStored = 0;
    }

    player.iron += totalIron;
    player.fuel += totalFuel;
    player.crystal += totalCrystal;

    if (totalIron > 0 || totalFuel > 0 || totalCrystal > 0) {
      this.events.push({
        id: randomUUID(),
        type: "mine",
        playerId: player.id,
        description: `${player.name} collected ${totalIron} iron, ${totalFuel} fuel, ${totalCrystal} crystal from all territories`,
        timestamp: Date.now(),
      });
      this.lastUpdateTs = Date.now();
    }

    return { iron: totalIron, fuel: totalFuel, crystal: totalCrystal };
  }

  async updatePlayerAddress(playerId: string, address: string): Promise<void> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");
    if (player.isAI) throw new Error("Cannot update AI player address");
    player.address = address;
  }

  async updatePlayerName(playerId: string, name: string): Promise<void> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");
    if (player.isAI) throw new Error("Cannot rename AI player");
    player.name = name;
  }

  async updateTestnetProgress(playerId: string, completedMissions: string[]): Promise<void> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");
    player.testnetProgress = completedMissions;
  }

  async getOrCreatePlayerByAddress(address: string): Promise<Player> {
    await this.initialize();
    const trimmed = address.trim();
    const lower = trimmed.toLowerCase();
    for (const player of this.players.values()) {
      if (player.address.toLowerCase() === lower) return player;
    }
    const id = randomUUID();
    const displayName = `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
    const newPlayer: Player = {
      id,
      address: trimmed,
      name: displayName,
      iron: 200,
      fuel: 150,
      crystal: 50,
      frontier: 0,
      ownedParcels: [],
      isAI: false,
      totalIronMined: 0,
      totalFuelMined: 0,
      totalCrystalMined: 0,
      totalFrontierEarned: 0,
      totalFrontierBurned: 0,
      attacksWon: 0,
      attacksLost: 0,
      territoriesCaptured: 0,
      commander: null,
      commanders: [],
      activeCommanderIndex: 0,
      specialAttacks: [],
      drones: [],
      satellites: [],
      welcomeBonusReceived: false,
      testnetProgress: [],
    };
    this.players.set(id, newPlayer);
    return newPlayer;
  }

  async grantWelcomeBonus(playerId: string): Promise<void> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");
    if (player.welcomeBonusReceived) return;

    player.frontier += WELCOME_BONUS_FRONTIER;
    player.totalFrontierEarned += WELCOME_BONUS_FRONTIER;
    player.welcomeBonusReceived = true;
    this.frontierCirculating += WELCOME_BONUS_FRONTIER;

    this.events.push({
      id: randomUUID(),
      type: "claim_frontier",
      playerId: player.id,
      description: `${player.name} received ${WELCOME_BONUS_FRONTIER} FRONTIER welcome bonus!`,
      timestamp: Date.now(),
    });
    this.lastUpdateTs = Date.now();
  }

  async claimFrontier(playerId: string): Promise<{ amount: number }> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");

    let totalClaimed = 0;
    const now = Date.now();

    for (const parcelId of player.ownedParcels) {
      const parcel = this.parcels.get(parcelId);
      if (!parcel) continue;

      this.updateFrontierAccumulation(parcel);
      totalClaimed += parcel.frontierAccumulated;
      parcel.frontierAccumulated = 0;
      parcel.lastFrontierClaimTs = now;
    }

    const rounded = Math.floor(totalClaimed * 100) / 100;
    if (rounded > 0) {
      player.frontier += rounded;
      player.totalFrontierEarned += rounded;
      this.frontierCirculating += rounded;

      this.events.push({
        id: randomUUID(),
        type: "claim_frontier",
        playerId: player.id,
        description: `${player.name} claimed ${rounded.toFixed(2)} FRONTIER tokens`,
        timestamp: now,
      });
      this.lastUpdateTs = now;
    }

    return { amount: rounded };
  }

  async restoreFrontier(playerId: string, amount: number): Promise<void> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player || amount <= 0) return;

    player.frontier -= amount;
    player.totalFrontierEarned -= amount;
    this.frontierCirculating -= amount;
    console.log(`Restored ${amount} FRONTIER for player ${player.name} due to failed transfer`);
  }

  async buildImprovement(action: BuildAction): Promise<LandParcel> {
    await this.initialize();

    const parcel = this.parcels.get(action.parcelId);
    const player = this.players.get(action.playerId);
    if (!parcel || !player) throw new Error("Invalid parcel or player");
    if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

    const isFacility = action.improvementType in FACILITY_INFO;
    const isDefense = action.improvementType in DEFENSE_IMPROVEMENT_INFO;
    if (!isFacility && !isDefense) throw new Error("Invalid improvement type");

    const existing = parcel.improvements.find((i) => i.type === action.improvementType);
    const level = existing ? existing.level + 1 : 1;

    if (isFacility) {
      const facilityInfo = FACILITY_INFO[action.improvementType as FacilityType];
      if (existing && existing.level >= facilityInfo.maxLevel) throw new Error("Facility already at max level");

      if (facilityInfo.prerequisite) {
        const hasPrereq = parcel.improvements.find(i => i.type === facilityInfo.prerequisite);
        if (!hasPrereq) throw new Error(`Requires ${FACILITY_INFO[facilityInfo.prerequisite!].name} first`);
      }

      const cost = facilityInfo.costFrontier[level - 1];
      if (player.frontier < cost) throw new Error(`Insufficient FRONTIER (need ${cost})`);

      player.frontier -= cost;
      player.totalFrontierBurned += cost;
      this.frontierCirculating -= cost;
    } else {
      const defInfo = DEFENSE_IMPROVEMENT_INFO[action.improvementType as DefenseImprovementType];
      if (existing && existing.level >= defInfo.maxLevel) throw new Error("Improvement already at max level");

      const cost = { iron: defInfo.cost.iron * level, fuel: defInfo.cost.fuel * level };
      if (player.iron < cost.iron || player.fuel < cost.fuel) throw new Error("Insufficient resources");

      player.iron -= cost.iron;
      player.fuel -= cost.fuel;
    }

    if (existing) {
      existing.level = level;
    } else {
      parcel.improvements.push({ type: action.improvementType, level: 1 });
    }

    if (action.improvementType === "turret") {
      parcel.defenseLevel += 3;
    } else if (action.improvementType === "shield_gen") {
      parcel.defenseLevel += 5;
    } else if (action.improvementType === "fortress") {
      parcel.defenseLevel += 8;
      parcel.storageCapacity += 50;
    } else if (action.improvementType === "storage_depot") {
      parcel.storageCapacity += 200;
    } else if (action.improvementType === "data_centre") {
      parcel.yieldMultiplier += 0.05 * level;
    }

    parcel.frontierPerDay = calculateFrontierPerDay(parcel.improvements);

    const displayName = isFacility
      ? FACILITY_INFO[action.improvementType as FacilityType].name
      : DEFENSE_IMPROVEMENT_INFO[action.improvementType as DefenseImprovementType].name;

    this.events.push({
      id: randomUUID(),
      type: "build",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} built ${displayName} (Lv${level}) at plot #${parcel.plotId}`,
      timestamp: Date.now(),
    });

    this.lastUpdateTs = Date.now();
    return parcel;
  }

  async purchaseLand(action: PurchaseAction): Promise<LandParcel> {
    await this.initialize();

    const parcel = this.parcels.get(action.parcelId);
    const player = this.players.get(action.playerId);
    if (!parcel || !player) throw new Error("Invalid parcel or player");
    if (parcel.ownerId) throw new Error("Territory is already owned");
    if (parcel.purchasePriceAlgo === null) throw new Error("Territory is not for sale");

    parcel.ownerId = player.id;
    parcel.ownerType = player.isAI ? "ai" : "player";
    parcel.purchasePriceAlgo = null;
    parcel.lastFrontierClaimTs = Date.now();
    player.ownedParcels.push(parcel.id);
    player.territoriesCaptured++;

    this.events.push({
      id: randomUUID(),
      type: "purchase",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} purchased plot #${parcel.plotId} for ${LAND_PURCHASE_ALGO[parcel.biome]} ALGO`,
      timestamp: Date.now(),
    });

    this.lastUpdateTs = Date.now();
    return parcel;
  }

  async upgradeBase(action: UpgradeAction): Promise<LandParcel> {
    await this.initialize();

    const parcel = this.parcels.get(action.parcelId);
    const player = this.players.get(action.playerId);
    if (!parcel || !player) throw new Error("Invalid parcel or player");
    if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

    const cost = UPGRADE_COSTS[action.upgradeType];
    if (!cost) throw new Error("Invalid upgrade type");
    if (player.iron < cost.iron || player.fuel < cost.fuel) throw new Error("Insufficient resources");

    player.iron -= cost.iron;
    player.fuel -= cost.fuel;

    switch (action.upgradeType) {
      case "defense":
        parcel.defenseLevel = Math.min(10, parcel.defenseLevel + 1);
        break;
      case "yield":
        parcel.yieldMultiplier += 0.2;
        break;
      case "mine":
        parcel.richness = Math.min(100, parcel.richness + 10);
        break;
      case "bunker":
        parcel.influenceRepairRate = (parcel.influenceRepairRate ?? 24) + 5;
        break;
    }

    this.events.push({
      id: randomUUID(),
      type: "upgrade",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} upgraded ${action.upgradeType} at plot #${parcel.plotId}`,
      timestamp: Date.now(),
    });

    this.lastUpdateTs = Date.now();
    return parcel;
  }

  async deployAttack(action: AttackAction): Promise<Battle> {
    await this.initialize();

    const attacker = this.players.get(action.attackerId);
    const targetParcel = this.parcels.get(action.targetParcelId);
    if (!attacker || !targetParcel) throw new Error("Invalid attacker or target");
    if (targetParcel.ownerId === attacker.id) throw new Error("Cannot attack your own territory");
    if (targetParcel.activeBattleId) throw new Error("Territory is already under attack");

    // ── Commander gate ────────────────────────────────────────────────────
    if (!attacker.isAI && attacker.commanders.length === 0) {
      throw new Error("A Commander is required to launch an attack. Mint one from the Commander panel.");
    }

    // ── Concurrent attack cap ─────────────────────────────────────────────
    if (!attacker.isAI) {
      const TIER_RANK: Record<string, number> = { sentinel: 1, phantom: 2, reaper: 3 };
      const highestTier = attacker.commanders.reduce((best, c) => {
        return (TIER_RANK[c.tier] ?? 0) > (TIER_RANK[best] ?? 0) ? c.tier : best;
      }, "sentinel" as string);
      const maxConcurrent = COMMANDER_INFO[highestTier as CommanderTier]?.maxConcurrentAttacks ?? 1;

      const activeAttacks = Array.from(this.battles.values()).filter(
        (b) => b.attackerId === attacker.id && b.status === "pending"
      ).length;

      if (activeAttacks >= maxConcurrent) {
        throw new Error(
          `Attack limit reached. Your ${highestTier} Commander allows ${maxConcurrent} simultaneous attack${maxConcurrent > 1 ? "s" : ""}. Wait for a battle to resolve.`
        );
      }
    }

    const totalIron = action.resourcesBurned.iron;
    const totalFuel = action.resourcesBurned.fuel;
    if (attacker.iron < totalIron || attacker.fuel < totalFuel) throw new Error("Insufficient resources for attack");

    attacker.iron -= totalIron;
    attacker.fuel -= totalFuel;

    // Resolve commander: validate availability and apply attack bonus
    const now = Date.now();
    let commanderBonus = 0;
    let commanderId: string | undefined;
    if (action.commanderId) {
      const cmdIdx = attacker.commanders.findIndex((c) => c.id === action.commanderId);
      if (cmdIdx === -1) throw new Error("Commander not found");
      const cmd = attacker.commanders[cmdIdx];
      if (cmd.lockedUntil && now < cmd.lockedUntil) throw new Error("Commander is currently deployed and unavailable");
      commanderBonus = cmd.attackBonus;
      commanderId = cmd.id;
      // Lock commander for 12 hours
      attacker.commanders[cmdIdx] = { ...cmd, lockedUntil: now + COMMANDER_LOCK_MS };
      cmd.totalKills; // no-op, just referencing for type safety
    }

    const rawAttackerPower = action.troopsCommitted * 10 + totalIron * 0.5 + totalFuel * 0.8 + commanderBonus;
    // Apply morale debuff: reduces attack power when attacker has recently lost territory
    const moraleActive = attacker.moraleDebuffUntil && now < attacker.moraleDebuffUntil;
    const attackerPower = moraleActive
      ? rawAttackerPower * (1 - MORALE_ATTACK_PENALTY)
      : rawAttackerPower;

    const biomeBonus = biomeBonuses[targetParcel.biome];
    const turretBonus = targetParcel.improvements
      .filter((i) => i.type === "turret" || i.type === "shield_gen" || i.type === "fortress")
      .reduce((sum, i) => sum + i.level * 5, 0);
    const defenderPower = (targetParcel.defenseLevel * 15 + turretBonus) * biomeBonus.defenseMod;

    const battleId = randomUUID();

    const battle: Battle = {
      id: battleId,
      attackerId: attacker.id,
      defenderId: targetParcel.ownerId,
      targetParcelId: targetParcel.id,
      attackerPower,
      defenderPower,
      troopsCommitted: action.troopsCommitted,
      resourcesBurned: action.resourcesBurned,
      startTs: now,
      resolveTs: now + BATTLE_DURATION_MS,
      status: "pending",
      commanderId,
      sourceParcelId: action.sourceParcelId,
    };

    this.battles.set(battleId, battle);
    targetParcel.activeBattleId = battleId;

    this.events.push({
      id: randomUUID(),
      type: "attack",
      playerId: attacker.id,
      parcelId: targetParcel.id,
      battleId,
      description: `${attacker.name} launched an attack on plot #${targetParcel.plotId}`,
      timestamp: now,
    });

    this.lastUpdateTs = now;
    return battle;
  }

  async mintAvatar(action: MintAvatarAction): Promise<CommanderAvatar> {
    await this.initialize();
    const player = this.players.get(action.playerId);
    if (!player) throw new Error("Player not found");

    const info = COMMANDER_INFO[action.tier];
    if (!info) throw new Error("Invalid commander tier");
    if (player.frontier < info.mintCostFrontier) throw new Error(`Insufficient FRONTIER. Need ${info.mintCostFrontier}, have ${player.frontier.toFixed(2)}`);

    player.frontier -= info.mintCostFrontier;
    player.totalFrontierBurned += info.mintCostFrontier;
    this.frontierCirculating -= info.mintCostFrontier;

    const bonusRoll = Math.random() * 0.3;
    const avatar: CommanderAvatar = {
      id: randomUUID(),
      tier: action.tier,
      name: `${info.name} #${player.commanders.length + 1}`,
      attackBonus: Math.floor(info.baseAttackBonus * (1 + bonusRoll)),
      defenseBonus: Math.floor(info.baseDefenseBonus * (1 + bonusRoll)),
      specialAbility: info.specialAbility,
      mintedAt: Date.now(),
      totalKills: 0,
    };

    player.commanders.push(avatar);
    player.activeCommanderIndex = player.commanders.length - 1;
    player.commander = avatar;

    this.events.push({
      id: randomUUID(),
      type: "mint_avatar",
      playerId: player.id,
      description: `${player.name} minted a ${info.name} Commander (${action.tier.toUpperCase()}) for ${info.mintCostFrontier} FRONTIER`,
      timestamp: Date.now(),
    });

    this.lastUpdateTs = Date.now();
    return avatar;
  }

  async executeSpecialAttack(action: SpecialAttackAction): Promise<{ damage: number; effect: string }> {
    await this.initialize();
    const player = this.players.get(action.playerId);
    if (!player) throw new Error("Player not found");
    if (!player.commander) throw new Error("You need a Commander to use special attacks. Mint one first.");

    const attackInfo = SPECIAL_ATTACK_INFO[action.attackType];
    if (!attackInfo) throw new Error("Invalid attack type");

    if (!attackInfo.requiredTier.includes(player.commander.tier)) {
      throw new Error(`${attackInfo.name} requires a ${attackInfo.requiredTier.join(" or ")} Commander`);
    }

    if (player.frontier < attackInfo.costFrontier) {
      throw new Error(`Insufficient FRONTIER. Need ${attackInfo.costFrontier}, have ${player.frontier.toFixed(2)}`);
    }

    const existing = player.specialAttacks.find(sa => sa.type === action.attackType);
    if (existing) {
      const elapsed = Date.now() - existing.lastUsedTs;
      if (elapsed < attackInfo.cooldownMs) {
        const remaining = Math.ceil((attackInfo.cooldownMs - elapsed) / 60000);
        throw new Error(`${attackInfo.name} on cooldown. ${remaining} minutes remaining.`);
      }
    }

    const targetParcel = this.parcels.get(action.targetParcelId);
    if (!targetParcel) throw new Error("Target plot not found");
    if (targetParcel.ownerId === player.id) throw new Error("Cannot attack your own territory");

    player.frontier -= attackInfo.costFrontier;
    player.totalFrontierBurned += attackInfo.costFrontier;
    this.frontierCirculating -= attackInfo.costFrontier;

    if (existing) {
      existing.lastUsedTs = Date.now();
    } else {
      player.specialAttacks.push({ type: action.attackType, lastUsedTs: Date.now() });
    }

    let baseDamage = player.commander.attackBonus * attackInfo.damageMultiplier;
    let effectDescription = attackInfo.effect;

    if (action.attackType === "orbital_strike") {
      const defReduction = Math.floor(targetParcel.defenseLevel * 0.5);
      targetParcel.defenseLevel = Math.max(1, targetParcel.defenseLevel - defReduction);
      baseDamage += defReduction * 5;
      effectDescription = `Orbital Strike reduced defense by ${defReduction}`;
    } else if (action.attackType === "emp_blast") {
      targetParcel.defenseLevel = Math.max(1, targetParcel.defenseLevel - 2);
      effectDescription = "EMP disabled turrets and shields, defense reduced by 2";
    } else if (action.attackType === "siege_barrage") {
      targetParcel.defenseLevel = Math.max(1, targetParcel.defenseLevel - 1);
      const nearby = this.findNearbyParcels(targetParcel, 0.04);
      let splashCount = 0;
      for (const np of nearby) {
        if (np.ownerId && np.ownerId !== player.id && splashCount < 3) {
          np.defenseLevel = Math.max(1, np.defenseLevel - 1);
          splashCount++;
        }
      }
      effectDescription = `Siege Barrage damaged target + ${splashCount} nearby plots`;
    } else if (action.attackType === "sabotage") {
      targetParcel.yieldMultiplier = Math.max(0.1, targetParcel.yieldMultiplier * 0.5);
      effectDescription = "Sabotage halved target mining yield";
    }

    player.commander.totalKills++;

    this.events.push({
      id: randomUUID(),
      type: "special_attack",
      playerId: player.id,
      parcelId: targetParcel.id,
      description: `${player.name}'s ${player.commander.name} launched ${attackInfo.name} on plot #${targetParcel.plotId}!`,
      timestamp: Date.now(),
    });

    this.lastUpdateTs = Date.now();
    return { damage: Math.floor(baseDamage), effect: effectDescription };
  }

  async deployDrone(action: DeployDroneAction): Promise<ReconDrone> {
    await this.initialize();
    const player = this.players.get(action.playerId);
    if (!player) throw new Error("Player not found");
    if (player.drones.length >= MAX_DRONES) throw new Error(`Maximum ${MAX_DRONES} drones allowed`);
    if (player.frontier < DRONE_MINT_COST_FRONTIER) {
      throw new Error(`Insufficient FRONTIER. Need ${DRONE_MINT_COST_FRONTIER}, have ${player.frontier.toFixed(2)}`);
    }

    player.frontier -= DRONE_MINT_COST_FRONTIER;
    player.totalFrontierBurned += DRONE_MINT_COST_FRONTIER;
    this.frontierCirculating -= DRONE_MINT_COST_FRONTIER;

    let targetId = action.targetParcelId || null;
    if (!targetId) {
      const allParcels = Array.from(this.parcels.values());
      const enemyParcels = allParcels.filter(p => p.ownerId && p.ownerId !== player.id);
      if (enemyParcels.length > 0) {
        targetId = enemyParcels[Math.floor(Math.random() * enemyParcels.length)].id;
      }
    }

    const drone: ReconDrone = {
      id: randomUUID(),
      deployedAt: Date.now(),
      targetParcelId: targetId,
      status: targetId ? "scouting" : "idle",
      discoveredResources: { iron: 0, fuel: 0, crystal: 0 },
      scoutReportReady: false,
    };

    if (targetId) {
      const targetParcel = this.parcels.get(targetId);
      if (targetParcel) {
        const bonus = Math.random();
        drone.discoveredResources = {
          iron: Math.floor(5 + bonus * 15),
          fuel: Math.floor(3 + bonus * 10),
          crystal: Math.floor(bonus * 5),
        };
      }
    }

    player.drones.push(drone);

    this.events.push({
      id: randomUUID(),
      type: "deploy_drone",
      playerId: player.id,
      parcelId: targetId || undefined,
      description: `${player.name} deployed a Recon Drone`,
      timestamp: Date.now(),
    });

    this.lastUpdateTs = Date.now();
    return drone;
  }

  async deploySatellite(action: DeploySatelliteAction): Promise<OrbitalSatellite> {
    await this.initialize();
    const player = this.players.get(action.playerId);
    if (!player) throw new Error("Player not found");

    const now = Date.now();
    // Expire stale satellites first
    player.satellites = player.satellites.map(s =>
      s.status === "active" && s.expiresAt <= now ? { ...s, status: "expired" as const } : s
    );
    const activeSatellites = player.satellites.filter(s => s.status === "active");
    if (activeSatellites.length >= MAX_SATELLITES) throw new Error(`Maximum ${MAX_SATELLITES} active satellites allowed`);
    if (player.frontier < SATELLITE_DEPLOY_COST_FRONTIER) {
      throw new Error(`Insufficient FRONTIER. Need ${SATELLITE_DEPLOY_COST_FRONTIER}, have ${player.frontier.toFixed(2)}`);
    }

    player.frontier -= SATELLITE_DEPLOY_COST_FRONTIER;
    player.totalFrontierBurned += SATELLITE_DEPLOY_COST_FRONTIER;
    this.frontierCirculating -= SATELLITE_DEPLOY_COST_FRONTIER;

    const satellite: OrbitalSatellite = {
      id: randomUUID(),
      deployedAt: now,
      expiresAt: now + SATELLITE_ORBIT_DURATION_MS,
      status: "active",
    };

    player.satellites.push(satellite);

    this.events.push({
      id: randomUUID(),
      type: "deploy_satellite",
      playerId: player.id,
      description: `${player.name} launched an Orbital Satellite — +${SATELLITE_YIELD_BONUS * 100}% mining yield for 1 hour`,
      timestamp: now,
    });

    this.lastUpdateTs = now;
    return satellite;
  }

  async resolveBattles(): Promise<Battle[]> {
    const now = Date.now();
    const resolvedBattles: Battle[] = [];

    for (const battle of Array.from(this.battles.values())) {
      if (battle.status === "pending" && now >= battle.resolveTs) {
        const seedString = `${battle.id}${battle.startTs}`;
        let hash = 0;
        for (let i = 0; i < seedString.length; i++) {
          const char = seedString.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }
        const randFactor = (Math.abs(hash) % 21) - 10;
        const adjustedAttackerPower = battle.attackerPower * (1 + randFactor / 100);
        const attackerWins = adjustedAttackerPower > battle.defenderPower;

        battle.status = "resolved";
        battle.outcome = attackerWins ? "attacker_wins" : "defender_wins";
        battle.randFactor = randFactor;

        const targetParcel = this.parcels.get(battle.targetParcelId);
        const attacker = this.players.get(battle.attackerId);
        const defender = battle.defenderId ? this.players.get(battle.defenderId) : null;

        if (targetParcel && attacker) {
          targetParcel.activeBattleId = null;

          if (attackerWins) {
            // ── Pillage stored resources ────────────────────────────────────
            const pillagedIron    = Math.floor(targetParcel.ironStored    * PILLAGE_RATE);
            const pillagedFuel    = Math.floor(targetParcel.fuelStored    * PILLAGE_RATE);
            const pillagedCrystal = Math.floor(targetParcel.crystalStored * PILLAGE_RATE);
            targetParcel.ironStored    -= pillagedIron;
            targetParcel.fuelStored    -= pillagedFuel;
            targetParcel.crystalStored -= pillagedCrystal;
            attacker.iron    += pillagedIron;
            attacker.fuel    += pillagedFuel;
            attacker.crystal += pillagedCrystal;

            if (defender) {
              defender.ownedParcels = defender.ownedParcels.filter((id) => id !== targetParcel.id);
              defender.attacksLost++;

              // ── Morale debuff: scales with consecutive losses ─────────────
              const prevConsecutive = defender.consecutiveLosses ?? 0;
              defender.consecutiveLosses = prevConsecutive + 1;
              const debuffMs = MORALE_DEBUFF_BASE_MS * (1 + prevConsecutive * 0.5);
              defender.moraleDebuffUntil = now + debuffMs;

              // ── Attack cooldown: stacks per consecutive loss ──────────────
              defender.attackCooldownUntil = now + ATTACK_COOLDOWN_PER_LOSS_MS * defender.consecutiveLosses;

              // ── Cascade vulnerability: adjacent defender parcels lose 1 def
              const adjacentDefenderParcels = this.findNearbyParcels(targetParcel, 0.05)
                .filter((p) => p.ownerId === defender!.id);
              for (const adj of adjacentDefenderParcels) {
                adj.defenseLevel = Math.max(1, adj.defenseLevel - CASCADE_DEFENSE_PENALTY);
              }
            }

            targetParcel.ownerId = attacker.id;
            targetParcel.ownerType = attacker.isAI ? "ai" : "player";
            targetParcel.defenseLevel = Math.max(1, Math.floor(targetParcel.defenseLevel / 2));
            targetParcel.purchasePriceAlgo = null;
            targetParcel.lastFrontierClaimTs = now;
            attacker.ownedParcels.push(targetParcel.id);
            attacker.attacksWon++;
            attacker.territoriesCaptured++;
            // Reset attacker's consecutive losses on a win
            attacker.consecutiveLosses = 0;

            const pillageMsg = (pillagedIron > 0 || pillagedFuel > 0 || pillagedCrystal > 0)
              ? ` Pillaged: ${pillagedIron} iron, ${pillagedFuel} fuel, ${pillagedCrystal} crystal.`
              : "";
            const penaltyMsg = defender
              ? ` ${defender.name} suffers morale debuff and attack cooldown.`
              : "";

            this.events.push({
              id: randomUUID(),
              type: "battle_resolved",
              playerId: attacker.id,
              parcelId: targetParcel.id,
              battleId: battle.id,
              description: `${attacker.name} conquered plot #${targetParcel.plotId}!${pillageMsg}${penaltyMsg}`,
              timestamp: now,
            });
          } else {
            attacker.attacksLost++;
            if (defender) {
              defender.attacksWon++;
              // Successful defence resets the defender's consecutive-loss streak
              defender.consecutiveLosses = 0;
            }
            this.events.push({
              id: randomUUID(),
              type: "battle_resolved",
              playerId: defender?.id || attacker.id,
              parcelId: targetParcel.id,
              battleId: battle.id,
              description: `Defense held at plot #${targetParcel.plotId}. ${attacker.name}'s attack was repelled.`,
              timestamp: now,
            });
          }
        }

        resolvedBattles.push(battle);
      }
    }

    if (resolvedBattles.length > 0) {
      this.lastUpdateTs = now;
    }

    return resolvedBattles;
  }

  private findNearbyParcels(parcel: LandParcel, maxDist: number = 0.05): LandParcel[] {
    const nearby: LandParcel[] = [];
    for (const p of Array.from(this.parcels.values())) {
      if (p.id === parcel.id) continue;
      const dist = sphereDistance(parcel.lat, parcel.lng, p.lat, p.lng);
      if (dist < maxDist) nearby.push(p);
    }
    return nearby;
  }

  async switchCommander(playerId: string, commanderIndex: number): Promise<CommanderAvatar> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");
    if (commanderIndex < 0 || commanderIndex >= player.commanders.length)
      throw new Error("Invalid commander index");
    player.activeCommanderIndex = commanderIndex;
    player.commander = player.commanders[commanderIndex];
    this.events.push({
      id: randomUUID(),
      type: "ai_action",
      playerId: player.id,
      description: `${player.name} switched to commander ${player.commander.name}`,
      timestamp: Date.now(),
    });
    this.lastUpdateTs = Date.now();
    return player.commander;
  }

  async runAITurn(): Promise<GameEvent[]> {
    if (process.env.AI_ENABLED !== 'true') return [];
    const newEvents: GameEvent[] = [];
    const now = Date.now();

    for (const player of Array.from(this.players.values())) {
      if (!player.isAI) continue;
      if (Math.random() > 0.4) continue;

      const ownedParcels = player.ownedParcels
        .map((id: string) => this.parcels.get(id))
        .filter((p: LandParcel | undefined): p is LandParcel => !!p);

      for (const parcel of ownedParcels) {
        if (now - parcel.lastMineTs >= MINE_COOLDOWN_MS) {
          try {
            await this.mineResources({ playerId: player.id, parcelId: parcel.id });
          } catch (e) {}
          break;
        }
      }

      for (const parcel of ownedParcels) {
        const totalStored = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
        if (totalStored > 50) {
          try {
            await this.collectAll(player.id);
          } catch (e) {}
          break;
        }
      }

      if (player.aiBehavior === "expansionist" || player.aiBehavior === "economic") {
        if (Math.random() > 0.5) {
          let buyTarget: LandParcel | null = null;
          for (const owned of ownedParcels) {
            const nearby = this.findNearbyParcels(owned, 0.08);
            const buyable = nearby.filter((p) => !p.ownerId && p.purchasePriceAlgo !== null && p.biome !== "water");
            if (buyable.length > 0) {
              buyTarget = buyable[Math.floor(Math.random() * buyable.length)];
              break;
            }
          }
          if (buyTarget) {
            try {
              await this.purchaseLand({ playerId: player.id, parcelId: buyTarget.id });
              newEvents.push({
                id: randomUUID(),
                type: "ai_action",
                playerId: player.id,
                parcelId: buyTarget.id,
                description: `${player.name} purchased new territory`,
                timestamp: now,
              });
            } catch (e) {}
          }
        }
      }

      if (player.aiBehavior === "expansionist" || player.aiBehavior === "raider") {
        // Respect attack cooldown imposed by consecutive losses
        const inCooldown = player.attackCooldownUntil && now < player.attackCooldownUntil;
        if (!inCooldown) {
          const canAttack = player.iron >= ATTACK_BASE_COST.iron && player.fuel >= ATTACK_BASE_COST.fuel;
          // Raise the random threshold when morale-debuffed so the AI attacks less aggressively
          const moraleDebuffed = player.moraleDebuffUntil && now < player.moraleDebuffUntil;
          const attackThreshold = moraleDebuffed ? 0.85 : 0.7;
          if (canAttack && Math.random() > attackThreshold) {
            let attackTarget: LandParcel | null = null;
            for (const owned of ownedParcels) {
              const nearby = this.findNearbyParcels(owned, 0.08);
              const targets = nearby.filter((p) => p.ownerId !== player.id && !p.activeBattleId && p.biome !== "water");
              if (targets.length > 0) {
                attackTarget = targets[Math.floor(Math.random() * targets.length)];
                break;
              }
            }
            if (attackTarget) {
              try {
                await this.deployAttack({
                  attackerId: player.id,
                  targetParcelId: attackTarget.id,
                  troopsCommitted: 1,
                  resourcesBurned: { iron: ATTACK_BASE_COST.iron, fuel: ATTACK_BASE_COST.fuel },
                });
                const statusMsg = moraleDebuffed ? " [morale debuffed]" : "";
                newEvents.push({
                  id: randomUUID(),
                  type: "ai_action",
                  playerId: player.id,
                  description: `${player.name} deployed troops${statusMsg}`,
                  timestamp: now,
                });
              } catch (e) {}
            }
          }
        }
      }

      if (player.aiBehavior === "defensive") {
        for (const parcel of ownedParcels) {
          if (parcel.defenseLevel < 5 && player.iron >= UPGRADE_COSTS.defense.iron && player.fuel >= UPGRADE_COSTS.defense.fuel) {
            try {
              await this.upgradeBase({ playerId: player.id, parcelId: parcel.id, upgradeType: "defense" });
            } catch (e) {}
            break;
          }
        }
      }
    }

    this.events.push(...newEvents);
    if (newEvents.length > 0) this.lastUpdateTs = now;
    this.currentTurn++;

    return newEvents;
  }

  // ── Orbital stubs (MemStorage — no DB, so in-memory only) ────────────────
  private _memOrbitalEvents: OrbitalEvent[] = [];

  async getActiveOrbitalEvents(): Promise<OrbitalEvent[]> {
    const now = Date.now();
    return this._memOrbitalEvents.filter((e) => !e.resolved && e.endAt > now);
  }

  async createOrbitalImpactEvent(type: OrbitalEvent["type"], targetParcelId?: string): Promise<OrbitalEvent> {
    const now = Date.now();
    const event: OrbitalEvent = {
      id: randomUUID(), type, cosmetic: false,
      startAt: now, endAt: now + 10 * 60 * 1000,
      seed: Math.floor(Math.random() * 0x7fffffff), intensity: 0.7,
      trajectory: { startLat: 45, startLng: 0, endLat: -45, endLng: 90 },
      targetParcelId, effects: [], resolved: false,
    };
    this._memOrbitalEvents.push(event);
    return event;
  }

  async resolveOrbitalEvent(eventId: string): Promise<void> {
    const evt = this._memOrbitalEvents.find((e) => e.id === eventId);
    if (evt) evt.resolved = true;
  }

  async triggerOrbitalCheck(): Promise<OrbitalEvent | null> {
    if (Math.random() > ORBITAL_IMPACT_CHANCE) return null;
    return this.createOrbitalImpactEvent("IMPACT_STRIKE");
  }

  // ── Trade Station stubs (MemStorage — dev/test only) ──────────────────────
  async getOpenTradeOrders(): Promise<TradeOrder[]> { return []; }
  async createTradeOrder(order: InsertTradeOrder): Promise<TradeOrder> { return order as TradeOrder; }
  async cancelTradeOrder(_orderId: string, _playerId: string): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: "Not supported in memory storage" };
  }
  async fillTradeOrder(_orderId: string, _fillerId: string): Promise<{ success: boolean; error?: string; trade?: TradeOrder }> {
    return { success: false, error: "Not supported in memory storage" };
  }
  async getTradeHistory(_limit = 50): Promise<TradeOrder[]> { return []; }
  async getTradeLeaderboard(): Promise<{ playerId: string; name: string; tradesPosted: number; tradesFilled: number }[]> { return []; }

  // ── Sub-Parcel stubs (MemStorage — dev/test only) ─────────────────────────
  async getSubParcels(_parentPlotId: number): Promise<SubParcel[]> { return []; }
  async subdivideParcel(_plotId: number, _playerId: string): Promise<{ subParcels: SubParcel[]; error?: string }> {
    return { subParcels: [], error: "Not supported in memory storage" };
  }
  async purchaseSubParcel(_subParcelId: string, _playerId: string): Promise<{ subParcel: SubParcel; error?: string }> {
    return { subParcel: null as any, error: "Not supported in memory storage" };
  }
  async isSubdivided(_parentPlotId: number): Promise<boolean> { return false; }
  async buildSubParcelImprovement(_subParcelId: string, _playerId: string, _improvementType: ImprovementType): Promise<{ subParcel: SubParcel; error?: string }> {
    return { subParcel: null as any, error: "Not supported in memory storage" };
  }

  // ── Season stubs (MemStorage — dev/test only) ─────────────────────────────
  async getCurrentSeason(): Promise<Season | null> { return null; }
  async startSeason(_name: string, _daysLen?: number): Promise<Season> { throw new Error("Not supported in memory storage"); }
  async settleCurrentSeason(): Promise<Season | null> { return null; }
  async getSeasonHistory(): Promise<Season[]> { return []; }

  // ── Prediction Market stubs (MemStorage — dev/test only) ──────────────────
  async getOpenMarkets(): Promise<PredictionMarket[]> { return []; }
  async getAllMarkets(_limit?: number): Promise<PredictionMarket[]> { return []; }
  async getMarket(_id: string): Promise<PredictionMarket | undefined> { return undefined; }
  async createMarket(_action: CreateMarketAction, _createdBy?: string): Promise<PredictionMarket> { throw new Error("Not supported in memory storage"); }
  async placeBet(_marketId: string, _playerId: string, _outcome: MarketOutcome, _amount: number): Promise<{ position: MarketPosition; market: PredictionMarket } | { error: string }> { return { error: "Not supported in memory storage" }; }
  async claimWinnings(_marketId: string, _playerId: string): Promise<{ payout: number } | { error: string }> { return { error: "Not supported in memory storage" }; }
  async resolveMarket(_marketId: string, _winningOutcome: MarketOutcome): Promise<PredictionMarket | { error: string }> { return { error: "Not supported in memory storage" }; }
  async getPlayerPositions(_playerId: string): Promise<(MarketPosition & { market: PredictionMarket })[]> { return []; }
  async resolveExpiredMarkets(): Promise<void> { /* no-op */ }

  // ── Sub-parcel extended stubs ─────────────────────────────────────────────
  async getSubParcel(_subParcelId: string): Promise<SubParcel | undefined> { return undefined; }
  async getParcelBiomeByPlotId(_plotId: number): Promise<string> { return "plains"; }
  async attackSubParcel(_subParcelId: string, _attackerId: string, _params: { attackerParcelId: string; commanderId?: string; troops: number; iron: number; fuel: number; crystal: number }): Promise<{ outcome: "attacker_wins" | "defender_wins"; battleId: string; attackerPower: number; defenderPower: number; log: { phase: string; message: string }[]; error?: string }> {
    return { outcome: "defender_wins", battleId: "", attackerPower: 0, defenderPower: 0, log: [], error: "Not supported in memory storage" };
  }
  async getOpenSubParcelListings(): Promise<SubParcelListing[]> { return []; }
  async createSubParcelListing(_sellerId: string, _subParcelId: string, _askPriceFrontier: number): Promise<{ listing: SubParcelListing; error?: string }> { return { listing: null as any, error: "Not supported in memory storage" }; }
  async cancelSubParcelListing(_sellerId: string, _listingId: string): Promise<{ error?: string }> { return { error: "Not supported in memory storage" }; }
  async buySubParcelListing(_buyerId: string, _listingId: string): Promise<{ listing: SubParcelListing; error?: string }> { return { listing: null as any, error: "Not supported in memory storage" }; }
  async assignSubParcelArchetype(_subParcelId: string, _playerId: string, _archetype: SubParcelArchetype, _archetypeLevel: number, _energyAlignment?: EnergyAlignment): Promise<{ subParcel: SubParcel; factionBonus: number; error?: string }> { return { subParcel: null as any, factionBonus: 0, error: "Not supported in memory storage" }; }
  async terraformParcel(plotId: number, playerId: string, action: import("@shared/schema").TerraformAction["action"]): Promise<{ parcel: LandParcel; error?: string }> {
    await this.initialize();
    const { TERRAFORM_COSTS, TERRAFORM_BIOME_MAP } = await import("@shared/schema");

    const parcelUuid = this.parcelByPlotId.get(plotId);
    if (!parcelUuid) return { parcel: null as any, error: "Plot not found" };
    const parcel = this.parcels.get(parcelUuid);
    if (!parcel) return { parcel: null as any, error: "Plot not found" };

    const player = this.players.get(playerId);
    if (!player) return { parcel: { ...parcel }, error: "Player not found" };
    if (parcel.ownerId !== playerId) return { parcel: { ...parcel }, error: "You do not own this plot" };

    const cost = TERRAFORM_COSTS[action.type] ?? 10;
    if (player.frontier < cost) {
      return { parcel: { ...parcel }, error: `Insufficient FRONTIER — need ${cost}, have ${player.frontier.toFixed(2)}` };
    }

    const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

    switch (action.type) {
      case "convert_biome": {
        const mapped = (TERRAFORM_BIOME_MAP[action.targetBiome] ?? action.targetBiome) as BiomeType;
        if (mapped === parcel.biome) return { parcel: { ...parcel }, error: "Plot already has that biome" };
        parcel.biome = mapped;
        parcel.stability = clamp((parcel.stability ?? 100) - 5);
        break;
      }
      case "reduce_hazard":
        parcel.hazardLevel = clamp((parcel.hazardLevel ?? 0) - action.amount);
        break;
      case "increase_stability":
        parcel.stability = clamp((parcel.stability ?? 100) + action.amount);
        break;
      case "boost_resources":
        parcel.yieldMultiplier = Number(((parcel.yieldMultiplier ?? 1) + action.amount).toFixed(4));
        break;
      case "corrupt_land":
        parcel.hazardLevel = clamp((parcel.hazardLevel ?? 0) + action.amount);
        parcel.stability = clamp((parcel.stability ?? 100) - action.amount);
        if (parcel.biome === "plains") parcel.biome = "volcanic";
        break;
      default:
        return { parcel: { ...parcel }, error: "Unknown terraform action" };
    }

    player.frontier -= cost;
    return { parcel: { ...parcel } };
  }

  // ── Economics stub ────────────────────────────────────────────────────────
  async getTreasuryBalance(): Promise<{ unsettledMicro: number; totalMicro: number }> { return { unsettledMicro: 0, totalMicro: 0 }; }
}
