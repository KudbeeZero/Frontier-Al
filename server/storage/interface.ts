import type {
  GameState,
  SlimGameState,
  LandParcel,
  Player,
  Battle,
  GameEvent,
  LeaderboardEntry,
  MineAction,
  UpgradeAction,
  AttackAction,
  BuildAction,
  PurchaseAction,
  MintAvatarAction,
  SpecialAttackAction,
  DeployDroneAction,
  DeploySatelliteAction,
  CommanderAvatar,
  ReconDrone,
  OrbitalSatellite,
  OrbitalEvent,
} from "@shared/schema";
import type { TradeOrder, InsertTradeOrder } from "../db-schema";

export interface IStorage {
  getGameState(): Promise<GameState>;
  getSlimGameState(): Promise<SlimGameState>;
  getParcel(id: string): Promise<LandParcel | undefined>;
  getPlayer(id: string): Promise<Player | undefined>;
  getBattle(id: string): Promise<Battle | undefined>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  /** Find an existing player by wallet address (case-insensitive), or create a fresh one. */
  getOrCreatePlayerByAddress(address: string): Promise<Player>;

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
  deploySatellite(action: DeploySatelliteAction): Promise<OrbitalSatellite>;
  updatePlayerName(playerId: string, name: string): Promise<void>;
  updateTestnetProgress(playerId: string, completedMissions: string[]): Promise<void>;
  /** Grant the 500 FRONTIER welcome bonus (idempotent). */
  grantWelcomeBonus(playerId: string): Promise<void>;
  /**
   * Atomically switch a player's active commander and emit a game event.
   * Throws if the index is out of bounds.
   */
  switchCommander(playerId: string, commanderIndex: number): Promise<CommanderAvatar>;

  resolveBattles(): Promise<Battle[]>;
  runAITurn(): Promise<GameEvent[]>;

  // ── Orbital Event Engine ──────────────────────────────────────────────────
  /** Get all impact (non-cosmetic) orbital events that have not yet expired. */
  getActiveOrbitalEvents(): Promise<OrbitalEvent[]>;
  /** Server creates a new gameplay-affecting impact event and persists it. */
  createOrbitalImpactEvent(type: OrbitalEvent["type"], targetParcelId?: string): Promise<OrbitalEvent>;
  /** Apply gameplay effects for an impact event and mark it resolved. */
  resolveOrbitalEvent(eventId: string): Promise<void>;
  /** Trigger a random impact check — may or may not create an event. */
  triggerOrbitalCheck(): Promise<OrbitalEvent | null>;

  // ── Trade Station ─────────────────────────────────────────────────────────
  getOpenTradeOrders(): Promise<TradeOrder[]>;
  createTradeOrder(order: InsertTradeOrder): Promise<TradeOrder>;
  cancelTradeOrder(orderId: string, playerId: string): Promise<{ success: boolean; error?: string }>;
  fillTradeOrder(orderId: string, fillerId: string): Promise<{ success: boolean; error?: string; trade?: TradeOrder }>;
}
