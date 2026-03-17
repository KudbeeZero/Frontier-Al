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
  SubParcel,
  SubParcelListing,
  Season,
  ImprovementType,
  PredictionMarket,
  MarketPosition,
  MarketOutcome,
  CreateMarketAction,
  RareMineralType,
} from "@shared/schema";
import type { TradeOrder, InsertTradeOrder } from "../db-schema";

export interface IStorage {
  /** Initialize storage (run seeder if needed). */
  initialize(): Promise<void>;
  /** Reset init state so next initialize() re-seeds. Used for testnet reset. */
  resetInitState(): void;
  getGameState(): Promise<GameState>;
  getSlimGameState(): Promise<SlimGameState>;
  getParcel(id: string): Promise<LandParcel | undefined>;
  getPlayer(id: string): Promise<Player | undefined>;
  getBattle(id: string): Promise<Battle | undefined>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  /** Find an existing player by wallet address (case-insensitive), or create a fresh one. */
  getOrCreatePlayerByAddress(address: string): Promise<Player>;

  mineResources(action: MineAction): Promise<{ iron: number; fuel: number; crystal: number; mineralDrops: Partial<Record<RareMineralType, number>> }>;
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
  getTradeHistory(limit?: number): Promise<TradeOrder[]>;
  getTradeLeaderboard(): Promise<{ playerId: string; name: string; tradesPosted: number; tradesFilled: number }[]>;

  // ── Sub-Parcels ──────────────────────────────────────────────────────────
  /** Get all sub-parcels for a given macro-plot. Returns [] if not yet subdivided. */
  getSubParcels(parentPlotId: number): Promise<SubParcel[]>;
  /**
   * Subdivide a macro-plot into 9 sub-parcels. The subdividing player receives
   * the center sub-parcel (index 4) for free. Fails if the plot cannot be subdivided.
   */
  subdivideParcel(plotId: number, playerId: string): Promise<{ subParcels: SubParcel[]; error?: string }>;
  /** Purchase an unowned sub-parcel with FRONTIER tokens. */
  purchaseSubParcel(subParcelId: string, playerId: string): Promise<{ subParcel: SubParcel; error?: string }>;
  /** Check whether a macro-plot has been subdivided. */
  isSubdivided(parentPlotId: number): Promise<boolean>;
  /** Build or upgrade an improvement on an owned sub-parcel. */
  buildSubParcelImprovement(subParcelId: string, playerId: string, improvementType: ImprovementType): Promise<{ subParcel: SubParcel; error?: string }>;
  /** Get a single sub-parcel by its UUID. */
  getSubParcel(subParcelId: string): Promise<SubParcel | undefined>;
  /** Get the biome string for a macro-plot by its plotId. */
  getParcelBiomeByPlotId(plotId: number): Promise<string>;
  /** Immediately resolve an attack on a single sub-parcel. */
  attackSubParcel(subParcelId: string, attackerId: string, params: { attackerParcelId: string; commanderId?: string; troops: number; iron: number; fuel: number; crystal: number }): Promise<{ outcome: "attacker_wins" | "defender_wins"; battleId: string; attackerPower: number; defenderPower: number; log: { phase: string; message: string }[]; error?: string }>;
  /** List all open sub-parcel listings. */
  getOpenSubParcelListings(): Promise<SubParcelListing[]>;
  /** Create a listing to sell a sub-parcel. */
  createSubParcelListing(sellerId: string, subParcelId: string, askPriceFrontier: number): Promise<{ listing: SubParcelListing; error?: string }>;
  /** Cancel an open listing. */
  cancelSubParcelListing(sellerId: string, listingId: string): Promise<{ error?: string }>;
  /** Buy a sub-parcel listing (transfers ownership + FRONTIER). */
  buySubParcelListing(buyerId: string, listingId: string): Promise<{ listing: SubParcelListing; error?: string }>;
  /**
   * Assign a strategic archetype to an owned sub-parcel.
   * Enforces grid composition limits (max 3 of same type per 9-cell grid).
   * Returns factionBonus multiplier applied (0 if no alignment benefit).
   */
  assignSubParcelArchetype(
    subParcelId: string,
    playerId: string,
    archetype: import("../../shared/schema").SubParcelArchetype,
    archetypeLevel: number,
    energyAlignment?: import("../../shared/schema").EnergyAlignment
  ): Promise<{ subParcel: SubParcel; factionBonus: number; error?: string }>;

  // ── Prediction Markets ────────────────────────────────────────────────────
  getOpenMarkets(): Promise<PredictionMarket[]>;
  getAllMarkets(limit?: number): Promise<PredictionMarket[]>;
  getMarket(id: string): Promise<PredictionMarket | undefined>;
  createMarket(action: CreateMarketAction, createdBy?: string): Promise<PredictionMarket>;
  placeBet(marketId: string, playerId: string, outcome: MarketOutcome, amount: number): Promise<{ position: MarketPosition; market: PredictionMarket } | { error: string }>;
  claimWinnings(marketId: string, playerId: string): Promise<{ payout: number } | { error: string }>;
  resolveMarket(marketId: string, winningOutcome: MarketOutcome): Promise<PredictionMarket | { error: string }>;
  getPlayerPositions(playerId: string): Promise<(MarketPosition & { market: PredictionMarket })[]>;
  resolveExpiredMarkets(): Promise<void>;

  // ── Terraforming ─────────────────────────────────────────────────────────
  /**
   * Apply a terraform action to an owned plot, deducting FRONTIER from the player.
   * Returns the updated parcel or an error string.
   */
  terraformParcel(
    plotId: number,
    playerId: string,
    action: import("@shared/schema").TerraformAction["action"],
  ): Promise<{ parcel: LandParcel; error?: string }>;

  // ── Season System ────────────────────────────────────────────────────────
  /** Get the currently active season, or null if none has been started. */
  getCurrentSeason(): Promise<Season | null>;
  /**
   * Start a new season. If a season is already active, throws.
   * @param name    Human-readable season name (e.g. "Season 1: First Colonists")
   * @param daysLen Duration in days (default 90)
   */
  startSeason(name: string, daysLen?: number): Promise<Season>;
  /** Settle the current season: snapshot leaderboard, mark complete. */
  settleCurrentSeason(): Promise<Season | null>;
  /** Get all past seasons ordered by number. */
  getSeasonHistory(): Promise<Season[]>;
  /** Get protocol treasury balance from the economics ledger. */
  getTreasuryBalance(): Promise<{ unsettledMicro: number; totalMicro: number }>;
}
