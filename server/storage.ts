import { randomUUID } from "crypto";
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
  ImprovementType,
  Improvement,
  MintAvatarAction,
  SpecialAttackAction,
  DeployDroneAction,
  CommanderAvatar,
  ReconDrone,
  SpecialAttackRecord,
  CommanderTier,
  SpecialAttackType,
} from "@shared/schema";
import {
  biomeBonuses,
  MINE_COOLDOWN_MS,
  BASE_YIELD,
  UPGRADE_COSTS,
  BATTLE_DURATION_MS,
  ATTACK_BASE_COST,
  IMPROVEMENT_INFO,
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
  DRONE_SCOUT_DURATION_MS,
  MAX_DRONES,
  calculateFrontierPerDay,
} from "@shared/schema";
import type { FacilityType, DefenseImprovementType } from "@shared/schema";
import { generateFibonacciSphere, sphereDistance, type PlotCoord } from "./sphereUtils";
import { eq, and, desc, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { gameMeta, players as playersTable, parcels as parcelsTable, battles as battlesTable, gameEvents as gameEventsTable } from "./db-schema";
import type { DB } from "./db";

const AI_NAMES = ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"];
const AI_BEHAVIORS: Player["aiBehavior"][] = ["expansionist", "defensive", "raider", "economic"];
const BIOMES: BiomeType[] = ["forest", "desert", "mountain", "plains", "water", "tundra", "volcanic", "swamp"];

function biomeFromLatitude(lat: number, plotId: number): BiomeType {
  const absLat = Math.abs(lat);
  const noise = ((plotId * 7919) % 100) / 100;

  if (absLat > 75) return noise > 0.3 ? "tundra" : "mountain";
  if (absLat > 60) return noise > 0.6 ? "tundra" : noise > 0.3 ? "forest" : "mountain";
  if (absLat > 40) return noise > 0.5 ? "forest" : noise > 0.2 ? "plains" : "mountain";
  if (absLat > 20) {
    if (noise > 0.7) return "volcanic";
    if (noise > 0.4) return "plains";
    if (noise > 0.2) return "forest";
    return "swamp";
  }
  if (noise > 0.6) return "desert";
  if (noise > 0.3) return "plains";
  if (noise > 0.15) return "swamp";
  return "water";
}

export interface IStorage {
  getGameState(): Promise<GameState>;
  getParcel(id: string): Promise<LandParcel | undefined>;
  getPlayer(id: string): Promise<Player | undefined>;
  getBattle(id: string): Promise<Battle | undefined>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;

  mineResources(action: MineAction): Promise<{ iron: number; fuel: number; crystal: number }>;
  upgradeBase(action: UpgradeAction): Promise<LandParcel>;
  deployAttack(action: AttackAction): Promise<Battle>;
  buildImprovement(action: BuildAction): Promise<LandParcel>;
  purchaseLand(action: PurchaseAction): Promise<LandParcel>;
  collectAll(playerId: string): Promise<{ iron: number; fuel: number; crystal: number }>;
  updatePlayerAddress(playerId: string, address: string): Promise<void>;
  claimFrontier(playerId: string): Promise<{ amount: number }>;
  restoreFrontier(playerId: string, amount: number): Promise<void>;
  mintAvatar(action: MintAvatarAction): Promise<CommanderAvatar>;
  executeSpecialAttack(action: SpecialAttackAction): Promise<{ damage: number; effect: string }>;
  deployDrone(action: DeployDroneAction): Promise<ReconDrone>;
  /** Grant the 500 FRONTIER welcome bonus (idempotent). */
  grantWelcomeBonus(playerId: string): Promise<void>;
  /**
   * Atomically switch a player's active commander and emit a game event.
   * Throws if the index is out of bounds.
   */
  switchCommander(playerId: string, commanderIndex: number): Promise<CommanderAvatar>;

  resolveBattles(): Promise<Battle[]>;
  runAITurn(): Promise<GameEvent[]>;
}

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

  private async initialize() {
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
      welcomeBonusReceived: false,
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
        welcomeBonusReceived: true,
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

  async mineResources(action: MineAction): Promise<{ iron: number; fuel: number; crystal: number }> {
    await this.initialize();

    const parcel = this.parcels.get(action.parcelId);
    const player = this.players.get(action.playerId);

    if (!parcel || !player) throw new Error("Invalid parcel or player");
    if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

    const now = Date.now();
    if (now - parcel.lastMineTs < MINE_COOLDOWN_MS) throw new Error("Mining cooldown not complete");

    const biomeBonus = biomeBonuses[parcel.biome];
    const richnessMultiplier = parcel.richness / 100;
    const ironYield = Math.floor(BASE_YIELD.iron * biomeBonus.yieldMod * richnessMultiplier * parcel.yieldMultiplier);
    const fuelYield = Math.floor(BASE_YIELD.fuel * biomeBonus.yieldMod * richnessMultiplier * parcel.yieldMultiplier);
    const crystalYield = Math.floor(BASE_YIELD.crystal * richnessMultiplier);

    const totalStored = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
    const remaining = parcel.storageCapacity - totalStored;
    const totalYield = ironYield + fuelYield + crystalYield;

    const ratio = remaining < totalYield ? remaining / totalYield : 1;
    const finalIron = Math.floor(ironYield * ratio);
    const finalFuel = Math.floor(fuelYield * ratio);
    const finalCrystal = Math.floor(crystalYield * ratio);

    parcel.ironStored += finalIron;
    parcel.fuelStored += finalFuel;
    parcel.crystalStored += finalCrystal;
    parcel.lastMineTs = now;

    player.totalIronMined += finalIron;
    player.totalFuelMined += finalFuel;

    if (parcel.richness > 20) {
      parcel.richness = Math.max(20, parcel.richness - 1);
    }

    this.events.push({
      id: randomUUID(),
      type: "mine",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} mined ${finalIron} iron, ${finalFuel} fuel from plot #${parcel.plotId}`,
      timestamp: now,
    });

    this.lastUpdateTs = now;
    return { iron: finalIron, fuel: finalFuel, crystal: finalCrystal };
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
      parcel.storageCapacity += 100;
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
        parcel.yieldMultiplier += 0.3;
        break;
      case "fortress":
        parcel.defenseLevel = Math.min(10, parcel.defenseLevel + 3);
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

    const totalIron = action.resourcesBurned.iron;
    const totalFuel = action.resourcesBurned.fuel;
    if (attacker.iron < totalIron || attacker.fuel < totalFuel) throw new Error("Insufficient resources for attack");

    attacker.iron -= totalIron;
    attacker.fuel -= totalFuel;

    const attackerPower = action.troopsCommitted * 10 + totalIron * 0.5 + totalFuel * 0.8;
    const biomeBonus = biomeBonuses[targetParcel.biome];
    const turretBonus = targetParcel.improvements
      .filter((i) => i.type === "turret" || i.type === "shield_gen" || i.type === "fortress")
      .reduce((sum, i) => sum + i.level * 5, 0);
    const defenderPower = (targetParcel.defenseLevel * 15 + turretBonus) * biomeBonus.defenseMod;

    const now = Date.now();
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
            if (defender) {
              defender.ownedParcels = defender.ownedParcels.filter((id) => id !== targetParcel.id);
              defender.attacksLost++;
            }
            targetParcel.ownerId = attacker.id;
            targetParcel.ownerType = attacker.isAI ? "ai" : "player";
            targetParcel.defenseLevel = Math.max(1, Math.floor(targetParcel.defenseLevel / 2));
            targetParcel.purchasePriceAlgo = null;
            targetParcel.lastFrontierClaimTs = now;
            attacker.ownedParcels.push(targetParcel.id);
            attacker.attacksWon++;
            attacker.territoriesCaptured++;

            this.events.push({
              id: randomUUID(),
              type: "battle_resolved",
              playerId: attacker.id,
              parcelId: targetParcel.id,
              battleId: battle.id,
              description: `${attacker.name} conquered plot #${targetParcel.plotId}!`,
              timestamp: now,
            });
          } else {
            attacker.attacksLost++;
            if (defender) defender.attacksWon++;
            this.events.push({
              id: randomUUID(),
              type: "battle_resolved",
              playerId: defender?.id || attacker.id,
              parcelId: targetParcel.id,
              battleId: battle.id,
              description: `Defense held at plot #${targetParcel.plotId}. Attack repelled.`,
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
        const canAttack = player.iron >= ATTACK_BASE_COST.iron && player.fuel >= ATTACK_BASE_COST.fuel;
        if (canAttack && Math.random() > 0.7) {
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
              newEvents.push({
                id: randomUUID(),
                type: "ai_action",
                playerId: player.id,
                description: `${player.name} deployed troops`,
                timestamp: now,
              });
            } catch (e) {}
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level row-to-domain-object helpers
// ─────────────────────────────────────────────────────────────────────────────

type ParcelRow  = typeof parcelsTable.$inferSelect;
type PlayerRow  = typeof playersTable.$inferSelect;
type BattleRow  = typeof battlesTable.$inferSelect;
type EventRow   = typeof gameEventsTable.$inferSelect;

function rowToParcel(row: ParcelRow): LandParcel {
  return {
    id:                  row.id,
    plotId:              row.plotId,
    lat:                 row.lat,
    lng:                 row.lng,
    biome:               row.biome as BiomeType,
    richness:            row.richness,
    ownerId:             row.ownerId ?? null,
    ownerType:           (row.ownerType ?? null) as "player" | "ai" | null,
    defenseLevel:        row.defenseLevel,
    ironStored:          row.ironStored,
    fuelStored:          row.fuelStored,
    crystalStored:       row.crystalStored,
    storageCapacity:     row.storageCapacity,
    lastMineTs:          Number(row.lastMineTs),
    activeBattleId:      row.activeBattleId ?? null,
    yieldMultiplier:     row.yieldMultiplier,
    improvements:        (row.improvements ?? []) as Improvement[],
    purchasePriceAlgo:   row.purchasePriceAlgo ?? null,
    frontierAccumulated: row.frontierAccumulated,
    lastFrontierClaimTs: Number(row.lastFrontierClaimTs),
    frontierPerDay:      row.frontierPerDay,
  };
}

function rowToPlayer(row: PlayerRow, ownedParcelIds: string[]): Player {
  const commanders = (row.commanders ?? []) as CommanderAvatar[];
  return {
    id:                   row.id,
    address:              row.address,
    name:                 row.name,
    iron:                 row.iron,
    fuel:                 row.fuel,
    crystal:              row.crystal,
    frontier:             row.frontier,
    ownedParcels:         ownedParcelIds,
    isAI:                 row.isAi,
    aiBehavior:           (row.aiBehavior ?? undefined) as Player["aiBehavior"],
    totalIronMined:       row.totalIronMined,
    totalFuelMined:       row.totalFuelMined,
    totalFrontierEarned:  row.totalFrontierEarned,
    totalFrontierBurned:  row.totalFrontierBurned,
    attacksWon:           row.attacksWon,
    attacksLost:          row.attacksLost,
    territoriesCaptured:  row.territoriesCaptured,
    commanders,
    activeCommanderIndex: row.activeCommanderIndex,
    commander:            commanders[row.activeCommanderIndex] ?? null,
    specialAttacks:       (row.specialAttacks ?? []) as SpecialAttackRecord[],
    drones:               (row.drones ?? []) as ReconDrone[],
    welcomeBonusReceived: row.welcomeBonusReceived,
  };
}

function rowToBattle(row: BattleRow): Battle {
  return {
    id:               row.id,
    attackerId:       row.attackerId,
    defenderId:       row.defenderId ?? null,
    targetParcelId:   row.targetParcelId,
    attackerPower:    row.attackerPower,
    defenderPower:    row.defenderPower,
    troopsCommitted:  row.troopsCommitted,
    resourcesBurned:  row.resourcesBurned as { iron: number; fuel: number },
    startTs:          Number(row.startTs),
    resolveTs:        Number(row.resolveTs),
    status:           row.status as "pending" | "resolved",
    outcome:          (row.outcome ?? undefined) as Battle["outcome"],
    randFactor:       row.randFactor ?? undefined,
  };
}

function rowToEvent(row: EventRow): GameEvent {
  return {
    id:          row.id,
    type:        row.type as GameEvent["type"],
    playerId:    row.playerId,
    parcelId:    row.parcelId ?? undefined,
    battleId:    row.battleId ?? undefined,
    description: row.description,
    timestamp:   Number(row.ts),
  };
}

function computeLeaderboard(playerRows: PlayerRow[], parcelRows: ParcelRow[]): LeaderboardEntry[] {
  const countByOwner = new Map<string, number>();
  for (const p of parcelRows) {
    if (p.ownerId) countByOwner.set(p.ownerId, (countByOwner.get(p.ownerId) ?? 0) + 1);
  }
  return playerRows
    .map((r) => ({
      playerId:            r.id,
      name:                r.name,
      address:             r.address,
      territories:         countByOwner.get(r.id) ?? 0,
      totalIronMined:      r.totalIronMined,
      totalFuelMined:      r.totalFuelMined,
      totalFrontierEarned: r.totalFrontierEarned,
      attacksWon:          r.attacksWon,
      attacksLost:         r.attacksLost,
      isAI:                r.isAi,
    }))
    .sort((a, b) => b.territories - a.territories || b.totalFrontierEarned - a.totalFrontierEarned);
}

/** Convert lat/lng (degrees) to unit-sphere cartesian coords. */
function latLngToXYZ(lat: number, lng: number): { x: number; y: number; z: number } {
  const φ = (lat * Math.PI) / 180;
  const λ = (lng * Math.PI) / 180;
  return {
    x: Math.cos(φ) * Math.cos(λ),
    y: Math.cos(φ) * Math.sin(λ),
    z: Math.sin(φ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DbStorage
// ─────────────────────────────────────────────────────────────────────────────

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
  private async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this._doInitialize();
    }
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    // Check whether the world has already been seeded.
    const [meta] = await this.db
      .insert(gameMeta)
      .values({ id: 1, initialized: false, currentTurn: 1, lastUpdateTs: Date.now() })
      .onConflictDoNothing()
      .returning();

    const existing = meta
      ? meta
      : (await this.db.select().from(gameMeta).where(eq(gameMeta.id, 1)))[0];

    if (existing?.initialized) return; // already seeded in a previous process run

    console.log("DbStorage: seeding world for the first time…");

    await this.db.transaction(async (tx) => {
      const plotCoords = generateFibonacciSphere(TOTAL_PLOTS);
      const now = Date.now();

      // ── Seed parcels in 500-row batches ──────────────────────────────────
      const BATCH = 500;
      const rows = plotCoords.map((coord) => {
        const biome  = biomeFromLatitude(coord.lat, coord.plotId);
        const { x, y, z } = latLngToXYZ(coord.lat, coord.lng);
        return {
          id:                  randomUUID(),
          plotId:              coord.plotId,
          lat:                 coord.lat,
          lng:                 coord.lng,
          x, y, z,
          biome,
          richness:            Math.floor(Math.random() * 60) + 40,
          defenseLevel:        1,
          ironStored:          0,
          fuelStored:          0,
          crystalStored:       0,
          storageCapacity:     BASE_STORAGE_CAPACITY,
          lastMineTs:          0,
          yieldMultiplier:     1.0,
          improvements:        [] as object[],
          purchasePriceAlgo:   LAND_PURCHASE_ALGO[biome],
          frontierAccumulated: 0,
          lastFrontierClaimTs: now,
          frontierPerDay:      1,
        };
      });

      for (let i = 0; i < rows.length; i += BATCH) {
        await tx.insert(parcelsTable).values(rows.slice(i, i + BATCH));
        if ((i + BATCH) % 5000 === 0 || i + BATCH >= rows.length) {
          console.log(`  seeded ${Math.min(i + BATCH, rows.length)} / ${rows.length} parcels`);
        }
      }

      // ── Human player ─────────────────────────────────────────────────────
      const humanId = randomUUID();
      await tx.insert(playersTable).values({
        id:      humanId,
        address: "PLAYER_WALLET",
        name:    "Commander",
        iron:    200,
        fuel:    150,
        crystal: 50,
      });

      // Give the human player the first plot (plotId=1)
      await tx
        .update(parcelsTable)
        .set({ ownerId: humanId, ownerType: "player", defenseLevel: 3, purchasePriceAlgo: null, lastFrontierClaimTs: now })
        .where(eq(parcelsTable.plotId, 1));

      // ── AI players ───────────────────────────────────────────────────────
      const AI_NAMES     = ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"];
      const AI_BEHAVIORS: Player["aiBehavior"][] = ["expansionist", "defensive", "raider", "economic"];
      const AI_PLOTS     = [5250, 10500, 15750, 20000];

      for (let i = 0; i < 4; i++) {
        const aiId = randomUUID();
        await tx.insert(playersTable).values({
          id:                   aiId,
          address:              `AI_WALLET_${i}`,
          name:                 AI_NAMES[i],
          iron:                 150,
          fuel:                 100,
          crystal:              25,
          isAi:                 true,
          aiBehavior:           AI_BEHAVIORS[i],
          welcomeBonusReceived: true,
        });
        await tx
          .update(parcelsTable)
          .set({ ownerId: aiId, ownerType: "ai", defenseLevel: 2, purchasePriceAlgo: null, lastFrontierClaimTs: now })
          .where(eq(parcelsTable.plotId, AI_PLOTS[i]));
      }

      // ── Initial event & mark initialized ─────────────────────────────────
      await tx.insert(gameEventsTable).values({
        id:          randomUUID(),
        type:        "ai_action",
        playerId:    "system",
        description: "Game world initialized. 21,000 plots ready. Factions are mobilizing.",
        ts:          now,
      });

      await tx
        .update(gameMeta)
        .set({ initialized: true, lastUpdateTs: now })
        .where(eq(gameMeta.id, 1));
    });

    console.log("DbStorage: world seed complete.");
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

  /** Compute how much FRONTIER has accumulated on a parcel and update the row. */
  private accumulatedFrontier(parcel: LandParcel, now: number): number {
    if (!parcel.ownerId) return 0;
    const days = (now - parcel.lastFrontierClaimTs) / (1000 * 60 * 60 * 24);
    if (days <= 0) return 0;
    const perDay = calculateFrontierPerDay(parcel.improvements);
    return perDay * days;
  }

  // ── IStorage – read ────────────────────────────────────────────────────────

  async getGameState(): Promise<GameState> {
    await this.initialize();
    await this.resolveBattles();

    const [allParcels, allPlayers, allBattles, recentEvents, [meta]] = await Promise.all([
      this.db.select().from(parcelsTable),
      this.db.select().from(playersTable),
      this.db.select().from(battlesTable),
      this.db.select().from(gameEventsTable).orderBy(desc(gameEventsTable.ts)).limit(50),
      this.db.select().from(gameMeta).where(eq(gameMeta.id, 1)),
    ]);

    // Build ownedParcels arrays from the parcel rows (avoids a separate join).
    const ownerMap = new Map<string, string[]>();
    for (const p of allParcels) {
      if (p.ownerId) {
        if (!ownerMap.has(p.ownerId)) ownerMap.set(p.ownerId, []);
        ownerMap.get(p.ownerId)!.push(p.id);
      }
    }

    const claimedPlots = allParcels.filter((p) => p.ownerId !== null).length;
    const frontierCirculating = allPlayers.reduce((sum, p) => sum + p.frontier, 0);

    return {
      parcels:            allParcels.map(rowToParcel),
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
      if (now - parcel.lastMineTs < MINE_COOLDOWN_MS) throw new Error("Mining cooldown not complete");

      const biomeBonus  = biomeBonuses[parcel.biome];
      const richMult    = parcel.richness / 100;
      const ironYield   = Math.floor(BASE_YIELD.iron   * biomeBonus.yieldMod * richMult * parcel.yieldMultiplier);
      const fuelYield   = Math.floor(BASE_YIELD.fuel   * biomeBonus.yieldMod * richMult * parcel.yieldMultiplier);
      const crystalYield= Math.floor(BASE_YIELD.crystal * richMult);

      const totalStored = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
      const remaining   = parcel.storageCapacity - totalStored;
      const totalYield  = ironYield + fuelYield + crystalYield;
      const ratio       = remaining < totalYield ? remaining / totalYield : 1;

      const finalIron    = Math.floor(ironYield    * ratio);
      const finalFuel    = Math.floor(fuelYield    * ratio);
      const finalCrystal = Math.floor(crystalYield * ratio);
      const newRichness  = parcel.richness > 20 ? Math.max(20, parcel.richness - 1) : parcel.richness;

      await Promise.all([
        tx.update(parcelsTable)
          .set({
            ironStored:    parcel.ironStored    + finalIron,
            fuelStored:    parcel.fuelStored    + finalFuel,
            crystalStored: parcel.crystalStored + finalCrystal,
            lastMineTs:    now,
            richness:      newRichness,
          })
          .where(eq(parcelsTable.id, parcel.id)),
        tx.update(playersTable)
          .set({
            totalIronMined: playerRow.totalIronMined + finalIron,
            totalFuelMined: playerRow.totalFuelMined + finalFuel,
          })
          .where(eq(playersTable.id, player.id)),
      ]);

      await this.addEvent({
        type:        "mine",
        playerId:    player.id,
        parcelId:    parcel.id,
        description: `${player.name} mined ${finalIron} iron, ${finalFuel} fuel from plot #${parcel.plotId}`,
        timestamp:   now,
      }, tx);
      await this.bumpLastTs(now, tx);

      return { iron: finalIron, fuel: finalFuel, crystal: finalCrystal };
    });
  }

  async collectAll(playerId: string): Promise<{ iron: number; fuel: number; crystal: number }> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [[playerRow], ownedRows] = await Promise.all([
        tx.select().from(playersTable).where(eq(playersTable.id, playerId)),
        tx.select().from(parcelsTable).where(eq(parcelsTable.ownerId, playerId)),
      ]);
      if (!playerRow) throw new Error("Player not found");

      let totalIron = 0, totalFuel = 0, totalCrystal = 0;
      for (const p of ownedRows) {
        totalIron    += p.ironStored;
        totalFuel    += p.fuelStored;
        totalCrystal += p.crystalStored;
      }

      if (totalIron > 0 || totalFuel > 0 || totalCrystal > 0) {
        await Promise.all([
          // Zero stored resources on all owned parcels in one statement
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

  async grantWelcomeBonus(playerId: string): Promise<void> {
    await this.initialize();
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!row) throw new Error("Player not found");
      if (row.welcomeBonusReceived) return;

      const now = Date.now();
      await tx.update(playersTable)
        .set({
          frontier:             row.frontier            + WELCOME_BONUS_FRONTIER,
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
        // Update frontierAccumulated with time-elapsed earnings first
        const earned  = this.accumulatedFrontier(parcel, now);
        const newAccum = parcel.frontierAccumulated + earned;
        total += newAccum;
        await tx.update(parcelsTable)
          .set({ frontierAccumulated: 0, lastFrontierClaimTs: now, frontierPerDay: calculateFrontierPerDay(parcel.improvements) })
          .where(eq(parcelsTable.id, row.id));
      }

      const rounded = Math.floor(total * 100) / 100;
      if (rounded > 0) {
        await tx.update(playersTable)
          .set({
            frontier:            playerRow.frontier            + rounded,
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
      await tx.update(playersTable)
        .set({
          frontier:            row.frontier            - amount,
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
        case "defense":   updates.defenseLevel    = Math.min(10, parcel.defenseLevel + 1); break;
        case "yield":     updates.yieldMultiplier = parcel.yieldMultiplier + 0.2; break;
        case "mine":      updates.yieldMultiplier = parcel.yieldMultiplier + 0.3; break;
        case "fortress":  updates.defenseLevel    = Math.min(10, parcel.defenseLevel + 3); break;
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
        if (player.frontier < cost) throw new Error(`Insufficient FRONTIER (need ${cost})`);
        playerUpdates = {
          frontier:            playerRow.frontier            - cost,
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
      let newDefense  = parcel.defenseLevel;
      let newCapacity = parcel.storageCapacity;
      if      (action.improvementType === "turret")       newDefense  += 3;
      else if (action.improvementType === "shield_gen")   newDefense  += 5;
      else if (action.improvementType === "fortress")   { newDefense  += 8; newCapacity += 50; }
      else if (action.improvementType === "storage_depot") newCapacity += 100;

      const newFpd = calculateFrontierPerDay(newImprovements);

      const now = Date.now();
      await Promise.all([
        tx.update(parcelsTable)
          .set({ improvements: newImprovements, defenseLevel: newDefense, storageCapacity: newCapacity, frontierPerDay: newFpd })
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

      return rowToParcel({ ...parcelRow, improvements: newImprovements, defenseLevel: newDefense, storageCapacity: newCapacity, frontierPerDay: newFpd });
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

      const { iron, fuel } = action.resourcesBurned;
      if (attacker.iron < iron || attacker.fuel < fuel) throw new Error("Insufficient resources for attack");

      const attackerPower = action.troopsCommitted * 10 + iron * 0.5 + fuel * 0.8;
      const biomeBonus    = biomeBonuses[target.biome];
      const turretBonus   = target.improvements
        .filter((i) => ["turret", "shield_gen", "fortress"].includes(i.type))
        .reduce((sum, i) => sum + i.level * 5, 0);
      const defenderPower = (target.defenseLevel * 15 + turretBonus) * biomeBonus.defenseMod;

      const now      = Date.now();
      const battleId = randomUUID();

      const battleValues = {
        id:               battleId,
        attackerId:       attacker.id,
        defenderId:       target.ownerId ?? undefined,
        targetParcelId:   target.id,
        attackerPower,
        defenderPower,
        troopsCommitted:  action.troopsCommitted,
        resourcesBurned:  { iron, fuel },
        startTs:          now,
        resolveTs:        now + BATTLE_DURATION_MS,
        status:           "pending" as const,
      };

      await Promise.all([
        tx.insert(battlesTable).values(battleValues),
        tx.update(parcelsTable).set({ activeBattleId: battleId }).where(eq(parcelsTable.id, target.id)),
        tx.update(playersTable)
          .set({ iron: attackerRow.iron - iron, fuel: attackerRow.fuel - fuel })
          .where(eq(playersTable.id, attacker.id)),
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

      return rowToBattle({ ...battleValues, outcome: undefined, randFactor: undefined } as BattleRow);
    });
  }

  async mintAvatar(action: MintAvatarAction): Promise<CommanderAvatar> {
    await this.initialize();
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, action.playerId));
      if (!row) throw new Error("Player not found");

      const info = COMMANDER_INFO[action.tier];
      if (!info) throw new Error("Invalid commander tier");
      if (row.frontier < info.mintCostFrontier)
        throw new Error(`Insufficient FRONTIER. Need ${info.mintCostFrontier}, have ${row.frontier.toFixed(2)}`);

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
          frontier:             row.frontier            - info.mintCostFrontier,
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
      if (player.frontier < attackInfo.costFrontier)
        throw new Error(`Insufficient FRONTIER. Need ${attackInfo.costFrontier}, have ${player.frontier.toFixed(2)}`);

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
        // Splash nearby — best-effort; won't cause transaction failure if none found
        const nearby = await tx.select()
          .from(parcelsTable)
          .where(and(
            sql`${parcelsTable.ownerId} IS NOT NULL`,
            sql`${parcelsTable.ownerId} != ${player.id}`,
            sql`(${parcelsTable.x} - ${target.id}) IS NOT NULL` // placeholder; real query below
          ))
          .limit(10);
        // Practical approach: re-use sphereDistance on fetched neighbors
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
            frontier:            playerRow.frontier            - attackInfo.costFrontier,
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
      if (row.frontier < DRONE_MINT_COST_FRONTIER)
        throw new Error(`Insufficient FRONTIER. Need ${DRONE_MINT_COST_FRONTIER}, have ${row.frontier.toFixed(2)}`);

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
          frontier:            row.frontier            - DRONE_MINT_COST_FRONTIER,
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

        await tx.update(battlesTable)
          .set({ status: "resolved", outcome, randFactor })
          .where(eq(battlesTable.id, battleRow.id));

        const [[targetRow], [attackerRow]] = await Promise.all([
          tx.select().from(parcelsTable).where(eq(parcelsTable.id, battleRow.targetParcelId)),
          tx.select().from(playersTable).where(eq(playersTable.id, battleRow.attackerId)),
        ]);

        if (!targetRow || !attackerRow) return;

        await tx.update(parcelsTable)
          .set({ activeBattleId: null })
          .where(eq(parcelsTable.id, targetRow.id));

        if (attackerWins) {
          // Update previous owner
          if (battleRow.defenderId) {
            await tx.update(playersTable)
              .set({ attacksLost: sql`${playersTable.attacksLost} + 1` })
              .where(eq(playersTable.id, battleRow.defenderId));
          }
          await Promise.all([
            tx.update(parcelsTable)
              .set({
                ownerId:              attackerRow.id,
                ownerType:            attackerRow.isAi ? "ai" : "player",
                defenseLevel:         Math.max(1, Math.floor(targetRow.defenseLevel / 2)),
                purchasePriceAlgo:    null,
                lastFrontierClaimTs:  now,
              })
              .where(eq(parcelsTable.id, targetRow.id)),
            tx.update(playersTable)
              .set({
                attacksWon:          sql`${playersTable.attacksWon} + 1`,
                territoriesCaptured: sql`${playersTable.territoriesCaptured} + 1`,
              })
              .where(eq(playersTable.id, attackerRow.id)),
          ]);

          await this.addEvent({
            type:        "battle_resolved",
            playerId:    attackerRow.id,
            parcelId:    targetRow.id,
            battleId:    battleRow.id,
            description: `${attackerRow.name} conquered plot #${targetRow.plotId}!`,
            timestamp:   now,
          }, tx);
        } else {
          await tx.update(playersTable)
            .set({ attacksLost: sql`${playersTable.attacksLost} + 1` })
            .where(eq(playersTable.id, attackerRow.id));
          if (battleRow.defenderId) {
            await tx.update(playersTable)
              .set({ attacksWon: sql`${playersTable.attacksWon} + 1` })
              .where(eq(playersTable.id, battleRow.defenderId));
          }

          await this.addEvent({
            type:        "battle_resolved",
            playerId:    battleRow.defenderId ?? attackerRow.id,
            parcelId:    targetRow.id,
            battleId:    battleRow.id,
            description: `Defense held at plot #${targetRow.plotId}. Attack repelled.`,
            timestamp:   now,
          }, tx);
        }

        await this.bumpLastTs(now, tx);
        resolved.push(rowToBattle({ ...battleRow, status: "resolved", outcome, randFactor }));
      });
    }

    return resolved;
  }

  async runAITurn(): Promise<GameEvent[]> {
    await this.initialize();
    const now = Date.now();
    const newEvents: GameEvent[] = [];

    const [allAiPlayers, allParcels] = await Promise.all([
      this.db.select().from(playersTable).where(eq(playersTable.isAi, true)),
      this.db.select().from(parcelsTable),
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
          try { await this.mineResources({ playerId: ai.id, parcelId: parcel.id }); } catch {}
          break;
        }
      }

      // Collect if stored resources are large
      for (const parcel of ownedParcels) {
        if (parcel.ironStored + parcel.fuelStored + parcel.crystalStored > 50) {
          try { await this.collectAll(ai.id); } catch {}
          break;
        }
      }

      // Expand
      if (ai.aiBehavior === "expansionist" || ai.aiBehavior === "economic") {
        if (Math.random() > 0.5) {
          for (const parcel of ownedParcels) {
            const nearby = allParcels.filter((p) => {
              if (p.ownerId || p.purchasePriceAlgo === null || p.biome === "water") return false;
              return sphereDistance(parcel.lat, parcel.lng, p.lat, p.lng) < 0.08;
            });
            if (nearby.length > 0) {
              const target = nearby[Math.floor(Math.random() * nearby.length)];
              try {
                await this.purchaseLand({ playerId: ai.id, parcelId: target.id });
                const evt: GameEvent = {
                  id: randomUUID(), type: "ai_action", playerId: ai.id, parcelId: target.id,
                  description: `${ai.name} purchased new territory`, timestamp: now,
                };
                newEvents.push(evt);
              } catch {}
              break;
            }
          }
        }
      }

      // Attack
      if (ai.aiBehavior === "expansionist" || ai.aiBehavior === "raider") {
        const canAttack = ai.iron >= ATTACK_BASE_COST.iron && ai.fuel >= ATTACK_BASE_COST.fuel;
        if (canAttack && Math.random() > 0.7) {
          for (const parcel of ownedParcels) {
            const targets = allParcels.filter((p) => {
              if (!p.ownerId || p.ownerId === ai.id || p.activeBattleId || p.biome === "water") return false;
              return sphereDistance(parcel.lat, parcel.lng, p.lat, p.lng) < 0.08;
            });
            if (targets.length > 0) {
              const attackTarget = targets[Math.floor(Math.random() * targets.length)];
              try {
                await this.deployAttack({
                  attackerId: ai.id, targetParcelId: attackTarget.id,
                  troopsCommitted: 1,
                  resourcesBurned: { iron: ATTACK_BASE_COST.iron, fuel: ATTACK_BASE_COST.fuel },
                });
                newEvents.push({
                  id: randomUUID(), type: "ai_action", playerId: ai.id,
                  description: `${ai.name} deployed troops`, timestamp: now,
                });
              } catch {}
              break;
            }
          }
        }
      }

      // Upgrade defense
      if (ai.aiBehavior === "defensive") {
        for (const parcel of ownedParcels) {
          if (parcel.defenseLevel < 5 && ai.iron >= UPGRADE_COSTS.defense.iron && ai.fuel >= UPGRADE_COSTS.defense.fuel) {
            try { await this.upgradeBase({ playerId: ai.id, parcelId: parcel.id, upgradeType: "defense" }); } catch {}
            break;
          }
        }
      }
    }

    // Bump turn counter
    await this.db.update(gameMeta)
      .set({ currentTurn: sql`${gameMeta.currentTurn} + 1`, lastUpdateTs: now })
      .where(eq(gameMeta.id, 1));

    return newEvents;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export: swap MemStorage → DbStorage here when DATABASE_URL is available.
// ─────────────────────────────────────────────────────────────────────────────

export const storage: IStorage = process.env.DATABASE_URL
  ? new DbStorage()
  : new MemStorage();
