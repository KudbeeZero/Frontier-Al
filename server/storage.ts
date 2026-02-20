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
  LAND_PURCHASE_BASE,
} from "@shared/schema";
import { generateHexGrid } from "./hexUtils";

const AI_NAMES = ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"];
const AI_BEHAVIORS: Player["aiBehavior"][] = ["expansionist", "defensive", "raider", "economic"];
const BIOMES: BiomeType[] = ["forest", "desert", "mountain", "plains", "water"];

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

  resolveBattles(): Promise<Battle[]>;
  runAITurn(): Promise<GameEvent[]>;
}

export class MemStorage implements IStorage {
  private parcels: Map<string, LandParcel>;
  private players: Map<string, Player>;
  private battles: Map<string, Battle>;
  private events: GameEvent[];
  private currentTurn: number;
  private lastUpdateTs: number;
  private initialized: boolean = false;

  constructor() {
    this.parcels = new Map();
    this.players = new Map();
    this.battles = new Map();
    this.events = [];
    this.currentTurn = 1;
    this.lastUpdateTs = Date.now();
  }

  private computePurchasePrice(biome: BiomeType, richness: number): { iron: number; fuel: number } {
    const base = LAND_PURCHASE_BASE[biome];
    const richnessMod = richness / 50;
    return {
      iron: Math.floor(base.iron * richnessMod),
      fuel: Math.floor(base.fuel * richnessMod),
    };
  }

  private async initialize() {
    if (this.initialized) return;

    const hexCoords = generateHexGrid(5);

    for (const coord of hexCoords) {
      const id = randomUUID();
      const biome = BIOMES[Math.floor(Math.random() * BIOMES.length)];
      const richness = Math.floor(Math.random() * 60) + 40;
      const parcel: LandParcel = {
        id,
        q: coord.q,
        r: coord.r,
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
        purchasePrice: this.computePurchasePrice(biome, richness),
      };
      this.parcels.set(id, parcel);
    }

    const humanPlayerId = randomUUID();
    const humanPlayer: Player = {
      id: humanPlayerId,
      address: "PLAYER_WALLET",
      name: "Commander",
      iron: 200,
      fuel: 150,
      crystal: 50,
      ownedParcels: [],
      isAI: false,
      totalIronMined: 0,
      totalFuelMined: 0,
      attacksWon: 0,
      attacksLost: 0,
      territoriesCaptured: 0,
    };
    this.players.set(humanPlayerId, humanPlayer);

    const parcelArray = Array.from(this.parcels.values());
    const centerParcel = parcelArray.find((p) => p.q === 0 && p.r === 0);
    if (centerParcel) {
      centerParcel.ownerId = humanPlayerId;
      centerParcel.ownerType = "player";
      centerParcel.defenseLevel = 3;
      centerParcel.purchasePrice = null;
      humanPlayer.ownedParcels.push(centerParcel.id);
    }

    for (let i = 0; i < 4; i++) {
      const aiId = randomUUID();
      const aiPlayer: Player = {
        id: aiId,
        address: `AI_WALLET_${i}`,
        name: AI_NAMES[i],
        iron: 150,
        fuel: 100,
        crystal: 25,
        ownedParcels: [],
        isAI: true,
        aiBehavior: AI_BEHAVIORS[i],
        totalIronMined: 0,
        totalFuelMined: 0,
        attacksWon: 0,
        attacksLost: 0,
        territoriesCaptured: 0,
      };
      this.players.set(aiId, aiPlayer);

      const unownedParcels = parcelArray.filter((p) => !p.ownerId && p.biome !== "water");
      if (unownedParcels.length > 0) {
        const randomParcel = unownedParcels[Math.floor(Math.random() * unownedParcels.length)];
        randomParcel.ownerId = aiId;
        randomParcel.ownerType = "ai";
        randomParcel.defenseLevel = 2;
        randomParcel.purchasePrice = null;
        aiPlayer.ownedParcels.push(randomParcel.id);
      }
    }

    this.events.push({
      id: randomUUID(),
      type: "ai_action",
      playerId: "system",
      description: "Game world initialized. Factions are mobilizing.",
      timestamp: Date.now(),
    });

    this.initialized = true;
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    await this.initialize();
    const entries: LeaderboardEntry[] = [];
    for (const player of this.players.values()) {
      entries.push({
        playerId: player.id,
        name: player.name,
        address: player.address,
        territories: player.ownedParcels.length,
        totalIronMined: player.totalIronMined,
        totalFuelMined: player.totalFuelMined,
        attacksWon: player.attacksWon,
        attacksLost: player.attacksLost,
        isAI: player.isAI,
      });
    }
    return entries.sort((a, b) => b.territories - a.territories || b.totalIronMined - a.totalIronMined);
  }

  async getGameState(): Promise<GameState> {
    await this.initialize();
    await this.resolveBattles();

    return {
      parcels: Array.from(this.parcels.values()),
      players: Array.from(this.players.values()),
      battles: Array.from(this.battles.values()),
      events: this.events.slice(-50).reverse(),
      leaderboard: await this.getLeaderboard(),
      currentTurn: this.currentTurn,
      lastUpdateTs: this.lastUpdateTs,
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
    const drillBonus = parcel.improvements.filter(i => i.type === "mine_drill").reduce((sum, i) => sum + i.level * 0.25, 0);

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
      description: `${player.name} mined ${finalIron} iron, ${finalFuel} fuel from sector ${parcel.q},${parcel.r}`,
      timestamp: now,
    });

    this.lastUpdateTs = now;
    return { iron: finalIron, fuel: finalFuel, crystal: finalCrystal };
  }

  async collectAll(playerId: string): Promise<{ iron: number; fuel: number; crystal: number }> {
    await this.initialize();
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");

    let totalIron = 0, totalFuel = 0, totalCrystal = 0;

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

  async buildImprovement(action: BuildAction): Promise<LandParcel> {
    await this.initialize();

    const parcel = this.parcels.get(action.parcelId);
    const player = this.players.get(action.playerId);
    if (!parcel || !player) throw new Error("Invalid parcel or player");
    if (parcel.ownerId !== player.id) throw new Error("You don't own this territory");

    const info = IMPROVEMENT_INFO[action.improvementType];
    if (!info) throw new Error("Invalid improvement type");

    const existing = parcel.improvements.find(i => i.type === action.improvementType);
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
      description: `${player.name} built ${info.name} (Lv${level}) at sector ${parcel.q},${parcel.r}`,
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
    if (!parcel.purchasePrice) throw new Error("Territory is not for sale");

    if (player.iron < parcel.purchasePrice.iron || player.fuel < parcel.purchasePrice.fuel) {
      throw new Error("Insufficient resources");
    }

    player.iron -= parcel.purchasePrice.iron;
    player.fuel -= parcel.purchasePrice.fuel;

    parcel.ownerId = player.id;
    parcel.ownerType = player.isAI ? "ai" : "player";
    parcel.purchasePrice = null;
    player.ownedParcels.push(parcel.id);
    player.territoriesCaptured++;

    this.events.push({
      id: randomUUID(),
      type: "purchase",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} purchased sector ${parcel.q},${parcel.r}`,
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
      description: `${player.name} upgraded ${action.upgradeType} at sector ${parcel.q},${parcel.r}`,
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
    const turretBonus = targetParcel.improvements.filter(i => i.type === "turret" || i.type === "shield_gen" || i.type === "fortress").reduce((sum, i) => sum + i.level * 5, 0);
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
      description: `${attacker.name} launched an attack on sector ${targetParcel.q},${targetParcel.r}`,
      timestamp: now,
    });

    this.lastUpdateTs = now;
    return battle;
  }

  async resolveBattles(): Promise<Battle[]> {
    const now = Date.now();
    const resolvedBattles: Battle[] = [];

    for (const battle of this.battles.values()) {
      if (battle.status === "pending" && now >= battle.resolveTs) {
        const seedString = `${battle.id}${battle.startTs}`;
        let hash = 0;
        for (let i = 0; i < seedString.length; i++) {
          const char = seedString.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
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
            targetParcel.purchasePrice = null;
            attacker.ownedParcels.push(targetParcel.id);
            attacker.attacksWon++;
            attacker.territoriesCaptured++;

            this.events.push({
              id: randomUUID(),
              type: "battle_resolved",
              playerId: attacker.id,
              parcelId: targetParcel.id,
              battleId: battle.id,
              description: `${attacker.name} conquered sector ${targetParcel.q},${targetParcel.r}!`,
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
              description: `Defense held at sector ${targetParcel.q},${targetParcel.r}. Attack repelled.`,
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

  async runAITurn(): Promise<GameEvent[]> {
    const newEvents: GameEvent[] = [];
    const now = Date.now();

    for (const player of this.players.values()) {
      if (!player.isAI) continue;
      if (Math.random() > 0.4) continue;

      const ownedParcels = player.ownedParcels
        .map((id) => this.parcels.get(id))
        .filter((p): p is LandParcel => !!p);

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
          try { await this.collectAll(player.id); } catch (e) {}
          break;
        }
      }

      if (player.aiBehavior === "expansionist" || player.aiBehavior === "economic") {
        if (player.iron >= 80 && player.fuel >= 40 && Math.random() > 0.5) {
          const buyable = Array.from(this.parcels.values()).filter(
            (p) => !p.ownerId && p.purchasePrice && p.biome !== "water"
          );
          if (buyable.length > 0) {
            const target = buyable[Math.floor(Math.random() * buyable.length)];
            try {
              await this.purchaseLand({ playerId: player.id, parcelId: target.id });
              newEvents.push({
                id: randomUUID(),
                type: "ai_action",
                playerId: player.id,
                parcelId: target.id,
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
          const unownedParcels = Array.from(this.parcels.values()).filter(
            (p) => p.ownerId !== player.id && !p.activeBattleId && p.biome !== "water"
          );
          if (unownedParcels.length > 0) {
            const target = unownedParcels[Math.floor(Math.random() * unownedParcels.length)];
            try {
              await this.deployAttack({
                attackerId: player.id,
                targetParcelId: target.id,
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

      if (player.aiBehavior === "defensive" && ownedParcels.length > 0) {
        const weakestParcel = ownedParcels.reduce((min, p) =>
          p.defenseLevel < min.defenseLevel ? p : min
        );
        if (weakestParcel.defenseLevel < 5 && player.iron >= UPGRADE_COSTS.defense.iron && player.fuel >= UPGRADE_COSTS.defense.fuel) {
          try {
            await this.upgradeBase({
              playerId: player.id,
              parcelId: weakestParcel.id,
              upgradeType: "defense",
            });
          } catch (e) {}
        }
      }
    }

    this.events.push(...newEvents);
    return newEvents;
  }
}

export const storage = new MemStorage();
