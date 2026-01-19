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
} from "@shared/schema";
import {
  biomeColors,
  biomeBonuses,
  MINE_COOLDOWN_MS,
  BASE_YIELD,
  UPGRADE_COSTS,
  BATTLE_DURATION_MS,
  ATTACK_BASE_COST,
} from "@shared/schema";
import { generateHexGrid } from "./hexUtils";

const AI_NAMES = ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE", "TITAN"];
const AI_BEHAVIORS: Player["aiBehavior"][] = ["expansionist", "defensive", "raider", "economic", "adaptive"];
const BIOMES: BiomeType[] = ["forest", "desert", "mountain", "plains", "water"];

export interface IStorage {
  getGameState(): Promise<GameState>;
  getParcel(id: string): Promise<LandParcel | undefined>;
  getPlayer(id: string): Promise<Player | undefined>;
  getBattle(id: string): Promise<Battle | undefined>;
  
  mineResources(action: MineAction): Promise<{ iron: number; fuel: number }>;
  upgradeBase(action: UpgradeAction): Promise<LandParcel>;
  deployAttack(action: AttackAction): Promise<Battle>;
  
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

  private async initialize() {
    if (this.initialized) return;
    
    const hexCoords = generateHexGrid(4);
    
    for (const coord of hexCoords) {
      const id = randomUUID();
      const biome = BIOMES[Math.floor(Math.random() * BIOMES.length)];
      const parcel: LandParcel = {
        id,
        q: coord.q,
        r: coord.r,
        biome,
        richness: Math.floor(Math.random() * 60) + 40,
        ownerId: null,
        ownerType: null,
        defenseLevel: 1,
        ironStored: 0,
        fuelStored: 0,
        lastMineTs: 0,
        activeBattleId: null,
        yieldMultiplier: 1.0,
        improvements: [],
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
    };
    this.players.set(humanPlayerId, humanPlayer);

    const parcelArray = Array.from(this.parcels.values());
    const centerParcel = parcelArray.find((p) => p.q === 0 && p.r === 0);
    if (centerParcel) {
      centerParcel.ownerId = humanPlayerId;
      centerParcel.ownerType = "player";
      centerParcel.defenseLevel = 3;
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
      };
      this.players.set(aiId, aiPlayer);

      const unownedParcels = parcelArray.filter((p) => !p.ownerId);
      if (unownedParcels.length > 0) {
        const randomParcel = unownedParcels[Math.floor(Math.random() * unownedParcels.length)];
        randomParcel.ownerId = aiId;
        randomParcel.ownerType = "ai";
        randomParcel.defenseLevel = 2;
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

  async getGameState(): Promise<GameState> {
    await this.initialize();
    
    await this.resolveBattles();
    
    return {
      parcels: Array.from(this.parcels.values()),
      players: Array.from(this.players.values()),
      battles: Array.from(this.battles.values()),
      events: this.events.slice(-50).reverse(),
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

  async mineResources(action: MineAction): Promise<{ iron: number; fuel: number }> {
    await this.initialize();
    
    const parcel = this.parcels.get(action.parcelId);
    const player = this.players.get(action.playerId);
    
    if (!parcel || !player) {
      throw new Error("Invalid parcel or player");
    }
    
    if (parcel.ownerId !== player.id) {
      throw new Error("You don't own this territory");
    }
    
    const now = Date.now();
    if (now - parcel.lastMineTs < MINE_COOLDOWN_MS) {
      throw new Error("Mining cooldown not complete");
    }
    
    const biomeBonus = biomeBonuses[parcel.biome];
    const richnessMultiplier = parcel.richness / 100;
    
    const ironYield = Math.floor(
      BASE_YIELD.iron * biomeBonus.yieldMod * richnessMultiplier * parcel.yieldMultiplier
    );
    const fuelYield = Math.floor(
      BASE_YIELD.fuel * biomeBonus.yieldMod * richnessMultiplier * parcel.yieldMultiplier
    );
    
    parcel.ironStored += ironYield;
    parcel.fuelStored += fuelYield;
    player.iron += ironYield;
    player.fuel += fuelYield;
    parcel.lastMineTs = now;
    
    if (parcel.richness > 20) {
      parcel.richness = Math.max(20, parcel.richness - 1);
    }
    
    this.events.push({
      id: randomUUID(),
      type: "mine",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} mined ${ironYield} iron and ${fuelYield} fuel from sector ${parcel.q},${parcel.r}`,
      timestamp: now,
    });
    
    this.lastUpdateTs = now;
    
    return { iron: ironYield, fuel: fuelYield };
  }

  async upgradeBase(action: UpgradeAction): Promise<LandParcel> {
    await this.initialize();
    
    const parcel = this.parcels.get(action.parcelId);
    const player = this.players.get(action.playerId);
    
    if (!parcel || !player) {
      throw new Error("Invalid parcel or player");
    }
    
    if (parcel.ownerId !== player.id) {
      throw new Error("You don't own this territory");
    }
    
    const cost = UPGRADE_COSTS[action.upgradeType];
    if (!cost) {
      throw new Error("Invalid upgrade type");
    }
    
    if (player.iron < cost.iron || player.fuel < cost.fuel) {
      throw new Error("Insufficient resources");
    }
    
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
        if (!parcel.improvements.includes("mine")) {
          parcel.improvements.push("mine");
          parcel.yieldMultiplier += 0.3;
        }
        break;
      case "fortress":
        if (!parcel.improvements.includes("fortress")) {
          parcel.improvements.push("fortress");
          parcel.defenseLevel = Math.min(10, parcel.defenseLevel + 3);
        }
        break;
    }
    
    const now = Date.now();
    this.events.push({
      id: randomUUID(),
      type: "upgrade",
      playerId: player.id,
      parcelId: parcel.id,
      description: `${player.name} upgraded ${action.upgradeType} at sector ${parcel.q},${parcel.r}`,
      timestamp: now,
    });
    
    this.lastUpdateTs = now;
    
    return parcel;
  }

  async deployAttack(action: AttackAction): Promise<Battle> {
    await this.initialize();
    
    const attacker = this.players.get(action.attackerId);
    const targetParcel = this.parcels.get(action.targetParcelId);
    
    if (!attacker || !targetParcel) {
      throw new Error("Invalid attacker or target");
    }
    
    if (targetParcel.ownerId === attacker.id) {
      throw new Error("Cannot attack your own territory");
    }
    
    if (targetParcel.activeBattleId) {
      throw new Error("Territory is already under attack");
    }
    
    const totalIron = action.resourcesBurned.iron;
    const totalFuel = action.resourcesBurned.fuel;
    
    if (attacker.iron < totalIron || attacker.fuel < totalFuel) {
      throw new Error("Insufficient resources for attack");
    }
    
    attacker.iron -= totalIron;
    attacker.fuel -= totalFuel;
    
    const attackerPower = action.troopsCommitted * 10 + totalIron * 0.5 + totalFuel * 0.8;
    
    const defender = targetParcel.ownerId ? this.players.get(targetParcel.ownerId) : null;
    const biomeBonus = biomeBonuses[targetParcel.biome];
    const defenderPower = targetParcel.defenseLevel * 15 * biomeBonus.defenseMod;
    
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
            }
            
            targetParcel.ownerId = attacker.id;
            targetParcel.ownerType = attacker.isAI ? "ai" : "player";
            targetParcel.defenseLevel = Math.max(1, Math.floor(targetParcel.defenseLevel / 2));
            attacker.ownedParcels.push(targetParcel.id);
            
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
      
      if (Math.random() > 0.3) continue;
      
      const ownedParcels = player.ownedParcels
        .map((id) => this.parcels.get(id))
        .filter((p): p is LandParcel => !!p);
      
      for (const parcel of ownedParcels) {
        if (now - parcel.lastMineTs >= MINE_COOLDOWN_MS) {
          try {
            await this.mineResources({ playerId: player.id, parcelId: parcel.id });
            newEvents.push({
              id: randomUUID(),
              type: "ai_action",
              playerId: player.id,
              parcelId: parcel.id,
              description: `${player.name} mined resources`,
              timestamp: now,
            });
          } catch (e) {
          }
          break;
        }
      }
      
      if (player.aiBehavior === "expansionist" || player.aiBehavior === "raider") {
        const canAttack = player.iron >= ATTACK_BASE_COST.iron && player.fuel >= ATTACK_BASE_COST.fuel;
        if (canAttack && Math.random() > 0.7) {
          const unownedParcels = Array.from(this.parcels.values()).filter(
            (p) => p.ownerId !== player.id && !p.activeBattleId
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
            } catch (e) {
            }
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
            newEvents.push({
              id: randomUUID(),
              type: "ai_action",
              playerId: player.id,
              parcelId: weakestParcel.id,
              description: `${player.name} upgraded defenses`,
              timestamp: now,
            });
          } catch (e) {
          }
        }
      }
    }
    
    this.events.push(...newEvents);
    return newEvents;
  }
}

export const storage = new MemStorage();
