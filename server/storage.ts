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
  BASE_STORAGE_CAPACITY,
  LAND_PURCHASE_ALGO,
  TOTAL_PLOTS,
  FRONTIER_TOTAL_SUPPLY,
  FRONTIER_PER_HOUR_BY_BIOME,
  COMMANDER_INFO,
  SPECIAL_ATTACK_INFO,
  DRONE_MINT_COST_FRONTIER,
  DRONE_SCOUT_DURATION_MS,
  MAX_DRONES,
} from "@shared/schema";
import { generateFibonacciSphere, sphereDistance, type PlotCoord } from "./hexUtils";

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
      const frontierRate = FRONTIER_PER_HOUR_BY_BIOME[biome];

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
        frontierPerHour: frontierRate,
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
      specialAttacks: [],
      drones: [],
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
        specialAttacks: [],
        drones: [],
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
    const hoursSinceLastClaim = (now - parcel.lastFrontierClaimTs) / (1000 * 60 * 60);
    if (hoursSinceLastClaim <= 0) return;

    const drillBonus = parcel.improvements
      .filter((i) => i.type === "mine_drill")
      .reduce((sum, i) => sum + i.level * 0.25, 0);
    const turretBonus = parcel.improvements
      .filter((i) => i.type === "turret")
      .reduce((sum, i) => sum + i.level * 0.1, 0);
    const shieldBonus = parcel.improvements
      .filter((i) => i.type === "shield_gen")
      .reduce((sum, i) => sum + i.level * 0.15, 0);
    const storageBonus = parcel.improvements
      .filter((i) => i.type === "storage_depot")
      .reduce((sum, i) => sum + i.level * 0.05, 0);
    const radarBonus = parcel.improvements
      .filter((i) => i.type === "radar")
      .reduce((sum, i) => sum + i.level * 0.1, 0);
    const fortressBonus = parcel.improvements
      .filter((i) => i.type === "fortress")
      .reduce((sum, i) => sum + i.level * 0.2, 0);
    const totalBonus = drillBonus + turretBonus + shieldBonus + storageBonus + radarBonus + fortressBonus;
    const rate = parcel.frontierPerHour * (1 + totalBonus) * (parcel.richness / 100);
    const earned = rate * hoursSinceLastClaim;
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
    const drillBonus = parcel.improvements.filter((i) => i.type === "mine_drill").reduce((sum, i) => sum + i.level * 0.25, 0);

    const ironYield = Math.floor(BASE_YIELD.iron * biomeBonus.yieldMod * richnessMultiplier * (parcel.yieldMultiplier + drillBonus));
    const fuelYield = Math.floor(BASE_YIELD.fuel * biomeBonus.yieldMod * richnessMultiplier * (parcel.yieldMultiplier + drillBonus));
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

    const info = IMPROVEMENT_INFO[action.improvementType];
    if (!info) throw new Error("Invalid improvement type");

    const existing = parcel.improvements.find((i) => i.type === action.improvementType);
    if (existing && existing.level >= info.maxLevel) throw new Error("Improvement already at max level");

    const level = existing ? existing.level + 1 : 1;
    const cost = { iron: info.cost.iron * level, fuel: info.cost.fuel * level };

    if (player.iron < cost.iron || player.fuel < cost.fuel) throw new Error("Insufficient resources");

    player.iron -= cost.iron;
    player.fuel -= cost.fuel;

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

    this.events.push({
      id: randomUUID(),
      type: "build",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} built ${info.name} (Lv${level}) at plot #${parcel.plotId}`,
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
    if (player.commander) throw new Error("You already have a Commander. Only one per player.");

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
      name: info.name,
      attackBonus: Math.floor(info.baseAttackBonus * (1 + bonusRoll)),
      defenseBonus: Math.floor(info.baseDefenseBonus * (1 + bonusRoll)),
      specialAbility: info.specialAbility,
      mintedAt: Date.now(),
      totalKills: 0,
    };

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

export const storage = new MemStorage();
