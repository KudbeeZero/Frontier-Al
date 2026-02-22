import { useState, useMemo } from "react";
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

// ─── PlotRow ─────────────────────────────────────────────────────────────────

function PlotRow({
  parcel,
  isSelected,
  onSelect,
}: {
  parcel: LandParcel;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const now = Date.now();
  const elapsed = now - parcel.lastMineTs;
  const remaining = Math.max(0, MINE_COOLDOWN_MS - elapsed);
  const mineReady = remaining === 0;
  const storagePercent =
    ((parcel.ironStored + parcel.fuelStored + parcel.crystalStored) /
      parcel.storageCapacity) *
    100;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted/60 active:bg-muted/80",
        isSelected
          ? "border-primary/60 bg-primary/10"
          : "border-border bg-muted/20"
      )}
      data-testid={`plot-row-${parcel.plotId}`}
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

      {/* Pending FRNTR if any */}
      {parcel.frontierAccumulated > 0.01 && (
        <div className="mt-1.5 text-[9px] text-yellow-400 font-mono">
          {parcel.frontierAccumulated.toFixed(2)} FRNTR accumulated
        </div>
      )}
    </button>
  );
}

// ─── SelectedParcelActions (inlined from BaseInfoPanel) ──────────────────────

function SelectedParcelActions({
  parcel,
  player,
  onMine,
  onUpgrade,
  onAttack,
  isMining,
  isUpgrading,
}: {
  parcel: LandParcel;
  player: Player;
  onMine: () => void;
  onUpgrade: (type: string) => void;
  onAttack: () => void;
  isMining: boolean;
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
            <Button
              onClick={onMine}
              disabled={!canMine || isMining}
              className="w-full font-display uppercase tracking-wide"
              size="sm"
              data-testid="button-mine-cc"
            >
              <Pickaxe className="w-3.5 h-3.5 mr-2" />
              {isMining ? "Mining..." : "Mine Resources"}
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
  onUpgrade,
  onAttack,
  isMining,
  isUpgrading,
  isClaimingFrontier,
  isCollecting,
  className,
}: CommandCenterPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

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
    () => ownedParcels.reduce((s, p) => s + p.frontierAccumulated, 0),
    [ownedParcels]
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

      {/* ── FRNTR Accumulation Banner ── */}
      {player && ownedParcels.length > 0 && (
        <div className="mx-3 mt-3 p-3 rounded-lg border border-primary/40 bg-primary/5 shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-primary">
              FRNTR Generation
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

          <Button
            onClick={onClaimFrontier}
            disabled={isClaimingFrontier || !hasPending}
            className="w-full font-display uppercase tracking-wide text-xs h-8"
            data-testid="cc-button-mint-all"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            {isClaimingFrontier
              ? "Minting..."
              : hasPending
              ? `Mint All — ${totalFrontierPending.toFixed(2)} FRNTR`
              : "No FRNTR Accumulated Yet"}
          </Button>
          {hasPending && (
            <p className="text-[8px] text-muted-foreground text-center mt-1">
              Sent in max-batch atomic transactions on-chain
            </p>
          )}
        </div>
      )}

      {/* ── Collect Minerals ── */}
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

      {/* ── Lifetime mineral stats ── */}
      {player && (player.totalIronMined > 0 || player.totalFuelMined > 0) && (
        <div className="mx-3 mt-2 p-2 rounded-md bg-muted/20 border border-border shrink-0">
          <div className="flex items-center gap-1 mb-1">
            <FlaskConical className="w-3 h-3 text-muted-foreground" />
            <span className="text-[9px] font-display uppercase tracking-wide text-muted-foreground">
              Total Extracted
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
              />
            ))
          )}
        </div>

        {/* ── Selected parcel actions (shown at bottom of scroll area) ── */}
        {selectedParcel && player && (
          <div className="mt-3">
            <SelectedParcelActions
              parcel={selectedParcel}
              player={player}
              onMine={onMine}
              onUpgrade={onUpgrade}
              onAttack={onAttack}
              isMining={isMining}
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
                isMining={isMining}
                isUpgrading={isUpgrading}
              />
            </div>
          )}
      </ScrollArea>
    </div>
  );
}
