import { useState, useMemo, useEffect } from "react";
import {
  MapPin, Pickaxe, Fuel, Gem, Shield, Zap, TrendingUp,
  Search, Clock, CheckCircle, Swords, Hammer, ChevronDown, ChevronUp,
  FlaskConical, ArrowDownToLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { LandParcel, Player } from "@shared/schema";
import { biomeColors, biomeBonuses, MINE_COOLDOWN_MS, UPGRADE_COSTS } from "@shared/schema";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatCooldown(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Live accumulated FRNTR = stored amount + time-based earnings since last claim. */
function liveFrontierAccumulated(parcel: LandParcel, now: number): number {
  const days = Math.max(0, (now - parcel.lastFrontierClaimTs) / (1000 * 60 * 60 * 24));
  return parcel.frontierAccumulated + days * parcel.frontierPerDay;
}

// ─── PlotRow ─────────────────────────────────────────────────────────────────

function PlotRow({
  parcel,
  isSelected,
  onSelect,
  onMineParcel,
  isMiningThisParcel,
  now,
}: {
  parcel: LandParcel;
  isSelected: boolean;
  onSelect: () => void;
  onMineParcel: (parcelId: string) => void;
  isMiningThisParcel: boolean;
  now: number;
}) {
  const elapsed = now - parcel.lastMineTs;
  const remaining = Math.max(0, MINE_COOLDOWN_MS - elapsed);
  const mineReady = remaining === 0;
  const storagePercent =
    ((parcel.ironStored + parcel.fuelStored + parcel.crystalStored) /
      parcel.storageCapacity) *
    100;

  return (
    <div
      className={cn(
        "w-full rounded-lg border transition-colors overflow-hidden",
        isSelected
          ? "border-primary/60 bg-primary/10"
          : "border-border bg-muted/20 hover:bg-muted/40"
      )}
      data-testid={`plot-row-${parcel.plotId}`}
    >
      <button
        onClick={onSelect}
        className="w-full text-left p-3"
      >
        {/* Top row: ID + biome + mine status */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-5 h-5 rounded shrink-0 flex items-center justify-center"
            style={{ backgroundColor: biomeColors[parcel.biome] + "40" }}
          >
            <MapPin className="w-3 h-3" style={{ color: biomeColors[parcel.biome] }} />
          </div>
          <span className="font-display text-xs font-bold uppercase tracking-wide flex-1">
            Plot #{parcel.plotId}
          </span>
          <Badge variant="outline" className="text-[9px] capitalize shrink-0">
            {parcel.biome}
          </Badge>
          {mineReady ? (
            <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
          ) : (
            <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground font-mono">
              <Clock className="w-3 h-3" />
              {formatCooldown(remaining)}
            </div>
          )}
        </div>

        {/* Resource storage bar */}
        <Progress value={storagePercent} className="h-1 mb-1.5" />

        {/* Bottom row: resources + FRNTR rate */}
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-0.5 text-iron">
            <Pickaxe className="w-2.5 h-2.5" /> {parcel.ironStored}
          </span>
          <span className="flex items-center gap-0.5 text-fuel">
            <Fuel className="w-2.5 h-2.5" /> {parcel.fuelStored}
          </span>
          <span className="flex items-center gap-0.5 text-crystal">
            <Gem className="w-2.5 h-2.5" /> {parcel.crystalStored}
          </span>
          <span className="flex items-center gap-0.5 text-primary ml-auto">
            <Zap className="w-2.5 h-2.5" />
            {parcel.frontierPerDay.toFixed(1)}/day
          </span>
          <span className="flex items-center gap-0.5 text-muted-foreground">
            <Shield className="w-2.5 h-2.5" /> Lv{parcel.defenseLevel}
          </span>
        </div>

        {/* Pending FRNTR — live computed */}
        {liveFrontierAccumulated(parcel, now) > 0.001 && (
          <div className="mt-1.5 text-[9px] text-yellow-400 font-mono">
            {liveFrontierAccumulated(parcel, now).toFixed(4)} FRNTR accumulated
          </div>
        )}
      </button>

      {/* Mine Resources button — only shown when plot is ready; per-parcel disabled state */}
      {mineReady && (
        <div className="px-3 pb-2 border-t border-border/50">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onMineParcel(parcel.id);
            }}
            disabled={isMiningThisParcel}
            size="sm"
            className="w-full h-7 font-display uppercase tracking-wide text-xs transition-all active:scale-95"
            data-testid={`button-mine-resources-${parcel.plotId}`}
          >
            <Pickaxe className={cn("w-3 h-3 mr-1.5", isMiningThisParcel && "animate-spin")} />
            {isMiningThisParcel ? "Extracting..." : "Mine Resources"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── SelectedParcelActions ────────────────────────────────────────────────────

function SelectedParcelActions({
  parcel,
  player,
  onMine,
  onUpgrade,
  onAttack,
  isMiningThisParcel,
  isUpgrading,
}: {
  parcel: LandParcel;
  player: Player;
  onMine: () => void;
  onUpgrade: (type: string) => void;
  onAttack: () => void;
  isMiningThisParcel: boolean;
  isUpgrading: boolean;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const isOwned = parcel.ownerId === player.id;
  const isEnemy = parcel.ownerId && parcel.ownerId !== player.id;
  const canMine = isOwned && Date.now() - parcel.lastMineTs >= MINE_COOLDOWN_MS;
  const biomeBonus = biomeBonuses[parcel.biome];

  return (
    <div
      className="border-t border-border pt-3 space-y-3"
      data-testid="selected-parcel-actions"
    >
      {/* Parcel header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-6 rounded-sm shrink-0"
              style={{ backgroundColor: biomeColors[parcel.biome] }}
            />
            <span className="font-display text-sm font-bold uppercase tracking-wide">
              Plot #{parcel.plotId}
            </span>
            <Badge variant="outline" className="text-[9px] capitalize">
              {parcel.biome}
            </Badge>
            {isOwned && (
              <Badge variant="default" className="text-[9px] font-display">
                YOURS
              </Badge>
            )}
            {isEnemy && (
              <Badge variant="destructive" className="text-[9px] font-display">
                {parcel.ownerType === "ai" ? "AI" : "ENEMY"}
              </Badge>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 ml-5">
            Richness {parcel.richness}% · Yield {biomeBonus.yieldMod >= 1 ? "+" : ""}
            {Math.round((biomeBonus.yieldMod - 1) * 100)}%
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm font-mono font-bold">
          <Shield
            className={cn(
              "w-4 h-4",
              parcel.defenseLevel > 5
                ? "text-green-500"
                : parcel.defenseLevel > 2
                ? "text-yellow-500"
                : "text-red-500"
            )}
          />
          {parcel.defenseLevel}
        </div>
      </div>

      {/* Mine cooldown */}
      {isOwned && (
        <>
          {(() => {
            const remaining = Math.max(0, MINE_COOLDOWN_MS - (Date.now() - parcel.lastMineTs));
            const progress = ((MINE_COOLDOWN_MS - remaining) / MINE_COOLDOWN_MS) * 100;
            return (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground font-display uppercase tracking-wide">
                    Mine Cooldown
                  </span>
                  <span
                    className={cn(
                      "font-mono",
                      remaining === 0 ? "text-green-500" : "text-yellow-500"
                    )}
                  >
                    {remaining === 0 ? "READY" : formatCooldown(remaining)}
                  </span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            );
          })()}

          <div className="space-y-2">
            {/* Mine For Resources — resource extraction only, NOT token minting */}
            <Button
              onClick={onMine}
              disabled={!canMine || isMiningThisParcel}
              className="w-full font-display uppercase tracking-wide transition-all active:scale-95"
              size="sm"
              data-testid="button-mine-cc"
            >
              <Pickaxe className={cn("w-3.5 h-3.5 mr-2", isMiningThisParcel && "animate-spin")} />
              {isMiningThisParcel
                ? "Extracting Resources..."
                : canMine
                ? "Mine For Resources"
                : "Mine Cooldown Active"}
            </Button>

            <Collapsible open={upgradeOpen} onOpenChange={setUpgradeOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full font-display uppercase tracking-wide"
                >
                  <Hammer className="w-3.5 h-3.5 mr-2" />
                  Upgrade Base
                  {upgradeOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1.5 space-y-1.5">
                {Object.entries(UPGRADE_COSTS).map(([type, cost]) => (
                  <Button
                    key={type}
                    variant="secondary"
                    size="sm"
                    onClick={() => onUpgrade(type)}
                    disabled={
                      isUpgrading ||
                      player.iron < cost.iron ||
                      player.fuel < cost.fuel
                    }
                    className="w-full justify-between font-display uppercase tracking-wide text-xs"
                  >
                    <span className="capitalize">{type}</span>
                    <span className="font-mono text-muted-foreground text-[10px]">
                      {cost.iron}
                      <Pickaxe className="w-2.5 h-2.5 inline mx-0.5 text-iron" />
                      {cost.fuel}
                      <Fuel className="w-2.5 h-2.5 inline mx-0.5 text-fuel" />
                    </span>
                  </Button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </>
      )}

      {isEnemy && (
        <Button
          onClick={onAttack}
          variant="destructive"
          size="sm"
          className="w-full font-display uppercase tracking-wide"
          data-testid="button-attack-cc"
        >
          <Swords className="w-3.5 h-3.5 mr-2" />
          Deploy Attack
        </Button>
      )}

      {!parcel.ownerId && (
        <Button
          onClick={onAttack}
          size="sm"
          className="w-full font-display uppercase tracking-wide"
          data-testid="button-claim-cc"
        >
          <MapPin className="w-3.5 h-3.5 mr-2" />
          Claim Territory
        </Button>
      )}

      {parcel.activeBattleId && (
        <div className="p-2 bg-destructive/10 border border-destructive/30 rounded-md flex items-center gap-2 text-destructive">
          <Swords className="w-3.5 h-3.5 animate-pulse" />
          <span className="font-display uppercase tracking-wide text-xs">Active Battle</span>
        </div>
      )}
    </div>
  );
}

// ─── CommandCenterPanel (main export) ────────────────────────────────────────

interface CommandCenterPanelProps {
  player: Player | null;
  parcels: LandParcel[];
  selectedParcel: LandParcel | null;
  onSelectParcel: (id: string) => void;
  onClaimFrontier: () => void;
  onCollectAll: () => void;
  onMine: () => void;
  onMineParcel?: (parcelId: string) => void;
  isMiningParcel?: (parcelId: string) => boolean;
  onUpgrade: (type: string) => void;
  onAttack: () => void;
  isMining: boolean;
  isUpgrading: boolean;
  isClaimingFrontier: boolean;
  isCollecting: boolean;
  className?: string;
}

export function CommandCenterPanel({
  player,
  parcels,
  selectedParcel,
  onSelectParcel,
  onClaimFrontier,
  onCollectAll,
  onMine,
  onMineParcel,
  isMiningParcel,
  onUpgrade,
  onAttack,
  isMining,
  isUpgrading,
  isClaimingFrontier,
  isCollecting,
  className,
}: CommandCenterPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // Tick every second so accumulated FRNTR counts up in real time.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ownedParcels = useMemo(
    () => parcels.filter((p) => player && p.ownerId === player.id),
    [parcels, player]
  );

  const filteredParcels = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return ownedParcels;
    return ownedParcels.filter((p) =>
      String(p.plotId).includes(q)
    );
  }, [ownedParcels, searchQuery]);

  const totalFrontierRate = useMemo(
    () => ownedParcels.reduce((s, p) => s + p.frontierPerDay, 0),
    [ownedParcels]
  );
  const totalFrontierPending = useMemo(
    () => ownedParcels.reduce((s, p) => s + liveFrontierAccumulated(p, now), 0),
    [ownedParcels, now]
  );
  const totalStoredIron = ownedParcels.reduce((s, p) => s + p.ironStored, 0);
  const totalStoredFuel = ownedParcels.reduce((s, p) => s + p.fuelStored, 0);
  const totalStoredCrystal = ownedParcels.reduce((s, p) => s + p.crystalStored, 0);
  const hasStored = totalStoredIron > 0 || totalStoredFuel > 0 || totalStoredCrystal > 0;
  const hasPending = totalFrontierPending > 0.01;

  return (
    <div
      className={cn("flex flex-col h-full bg-sidebar overflow-hidden", className)}
      data-testid="command-center-panel"
    >
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-sidebar-border shrink-0">
        <h2 className="font-display text-base font-bold uppercase tracking-widest text-primary">
          Command Center
        </h2>
        {player && (
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
            {ownedParcels.length} plot{ownedParcels.length !== 1 ? "s" : ""} owned
            {player.totalFrontierEarned > 0 && (
              <> · {player.totalFrontierEarned.toFixed(1)} FRNTR earned lifetime</>
            )}
          </p>
        )}
      </div>

      {/* ── FRNTR Token Mint Banner (ASA tokens only — not related to mining) ── */}
      {player && ownedParcels.length > 0 && (
        <div className="mx-3 mt-3 p-3 rounded-lg border border-primary/40 bg-primary/5 shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-primary">
              FRNTR Token Generation
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div className="text-center bg-background/40 rounded-md p-2">
              <span
                className="font-mono text-lg font-bold text-primary block"
                data-testid="cc-frontier-daily-rate"
              >
                {totalFrontierRate.toFixed(1)}
              </span>
              <span className="text-[9px] text-muted-foreground font-display uppercase tracking-wide">
                FRNTR / Day
              </span>
              <div className="text-[8px] text-muted-foreground mt-0.5">
                across {ownedParcels.length} plot{ownedParcels.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="text-center bg-background/40 rounded-md p-2">
              <span
                className="font-mono text-lg font-bold text-yellow-400 block"
                data-testid="cc-frontier-pending"
              >
                {totalFrontierPending.toFixed(2)}
              </span>
              <span className="text-[9px] text-muted-foreground font-display uppercase tracking-wide">
                Accumulated
              </span>
              <div className="text-[8px] text-muted-foreground mt-0.5">
                ready to mint
              </div>
            </div>
          </div>

          {/* MINT FRNTR TOKEN — this mints the ASA token, separate from mining */}
          <Button
            onClick={onClaimFrontier}
            disabled={isClaimingFrontier || !hasPending}
            className="w-full font-display uppercase tracking-wide text-xs h-8"
            data-testid="cc-button-mint-all"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            {isClaimingFrontier
              ? "Minting FRNTR Token..."
              : hasPending
              ? `Mint FRNTR Token — ${totalFrontierPending.toFixed(2)}`
              : "No FRNTR Accumulated Yet"}
          </Button>
          {hasPending && (
            <p className="text-[8px] text-muted-foreground text-center mt-1">
              Mints FRNTR ASA tokens to your Algorand wallet on-chain
            </p>
          )}
        </div>
      )}

      {/* ── Collect Minerals — collects extracted resources (iron/fuel/crystal) ── */}
      {player && hasStored && (
        <div className="mx-3 mt-2 shrink-0">
          <Button
            onClick={onCollectAll}
            disabled={isCollecting}
            variant="outline"
            className="w-full font-display uppercase tracking-wide text-xs h-8"
            data-testid="cc-button-collect-all"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" />
            {isCollecting
              ? "Collecting..."
              : `Collect Minerals — +${totalStoredIron}Fe +${totalStoredFuel}Fu +${totalStoredCrystal}Cr`}
          </Button>
        </div>
      )}

      {/* ── Lifetime resource extraction stats ── */}
      {player && (player.totalIronMined > 0 || player.totalFuelMined > 0) && (
        <div className="mx-3 mt-2 p-2 rounded-md bg-muted/20 border border-border shrink-0">
          <div className="flex items-center gap-1 mb-1">
            <FlaskConical className="w-3 h-3 text-muted-foreground" />
            <span className="text-[9px] font-display uppercase tracking-wide text-muted-foreground">
              Total Resources Extracted
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <span className="font-mono text-xs font-bold text-iron block">
                {player.totalIronMined.toLocaleString()}
              </span>
              <span className="text-[8px] text-muted-foreground uppercase">Iron</span>
            </div>
            <div>
              <span className="font-mono text-xs font-bold text-fuel block">
                {player.totalFuelMined.toLocaleString()}
              </span>
              <span className="text-[8px] text-muted-foreground uppercase">Fuel</span>
            </div>
            <div>
              <span className="font-mono text-xs font-bold text-crystal block">
                {(player.totalCrystalMined ?? 0).toLocaleString()}
              </span>
              <span className="text-[8px] text-muted-foreground uppercase">Crystal</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Divider ── */}
      <div className="mx-3 mt-3 mb-1 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[9px] font-display uppercase tracking-wider text-muted-foreground">
            Your Territories ({ownedParcels.length})
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
      </div>

      {/* ── Search ── */}
      {ownedParcels.length > 0 && (
        <div className="mx-3 mb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by plot ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs font-mono"
              data-testid="input-plot-search"
            />
          </div>
        </div>
      )}

      {/* ── Plot list ── */}
      <ScrollArea className="flex-1 px-3 pb-2">
        <div className="space-y-1.5">
          {!player ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Connect wallet to manage plots</p>
            </div>
          ) : filteredParcels.length === 0 && searchQuery ? (
            <div className="text-center py-6 text-muted-foreground">
              <Search className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No plots match "{searchQuery}"</p>
            </div>
          ) : ownedParcels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-display uppercase tracking-wide">
                No Territories Yet
              </p>
              <p className="text-[10px] mt-1">Tap a hex tile to purchase land</p>
            </div>
          ) : (
            filteredParcels.map((p) => (
              <PlotRow
                key={p.id}
                parcel={p}
                isSelected={selectedParcel?.id === p.id}
                onSelect={() => onSelectParcel(p.id)}
                onMineParcel={onMineParcel || (() => {})}
                isMiningThisParcel={isMiningParcel ? isMiningParcel(p.id) : false}
                now={now}
              />
            ))
          )}
        </div>

        {/* ── Selected parcel actions ── */}
        {selectedParcel && player && (
          <div className="mt-3">
            <SelectedParcelActions
              parcel={selectedParcel}
              player={player}
              onMine={onMine}
              onUpgrade={onUpgrade}
              onAttack={onAttack}
              isMiningThisParcel={
                isMiningParcel ? isMiningParcel(selectedParcel.id) : isMining
              }
              isUpgrading={isUpgrading}
            />
          </div>
        )}

        {/* Show unowned selected parcel info */}
        {selectedParcel && !player && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: biomeColors[selectedParcel.biome] }}
              />
              <span className="font-display text-sm uppercase tracking-wide">
                Plot #{selectedParcel.plotId}
              </span>
              <Badge variant="outline" className="capitalize text-[9px]">
                {selectedParcel.biome}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Connect wallet to interact with this plot.
            </p>
          </div>
        )}

        {/* Show selected enemy / unclaimed parcel when no owned plots match */}
        {selectedParcel &&
          player &&
          selectedParcel.ownerId !== player.id &&
          !filteredParcels.find((p) => p.id === selectedParcel.id) && (
            <div className="mt-3">
              <SelectedParcelActions
                parcel={selectedParcel}
                player={player}
                onMine={onMine}
                onUpgrade={onUpgrade}
                onAttack={onAttack}
                isMiningThisParcel={
                  isMiningParcel ? isMiningParcel(selectedParcel.id) : isMining
                }
                isUpgrading={isUpgrading}
              />
            </div>
          )}
      </ScrollArea>
    </div>
  );
}
