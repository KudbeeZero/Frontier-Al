import { useState, useEffect, useMemo } from "react";
import {
  Package, Pickaxe, Fuel, Gem, MapPin, Shield,
  ArrowDownToLine, Zap, FlaskConical, Search, Clock, CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Player, LandParcel } from "@shared/schema";
import { biomeColors, MINE_COOLDOWN_MS } from "@shared/schema";

function formatCooldown(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface InventoryPanelProps {
  player: Player | null;
  parcels: LandParcel[];
  onCollectAll: () => void;
  onClaimFrontier: () => void;
  onSelectParcel: (id: string) => void;
  onMineParcel?: (parcelId: string) => void;
  isMiningParcel?: (parcelId: string) => boolean;
  isCollecting: boolean;
  isClaimingFrontier: boolean;
  className?: string;
}

function LandCard({
  parcel,
  onSelect,
  onMineParcel,
  isMiningThisParcel,
  now,
}: {
  parcel: LandParcel;
  onSelect: () => void;
  onMineParcel?: (parcelId: string) => void;
  isMiningThisParcel: boolean;
  now: number;
}) {
  const liveAccum =
    parcel.frontierAccumulated +
    Math.max(0, (now - parcel.lastFrontierClaimTs) / (1000 * 60 * 60 * 24)) *
      parcel.frontierPerDay;
  const totalStored = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
  const storagePercent = (totalStored / parcel.storageCapacity) * 100;

  const elapsed = now - parcel.lastMineTs;
  const remaining = Math.max(0, MINE_COOLDOWN_MS - elapsed);
  const mineReady = remaining === 0;

  return (
    <div
      className="w-full border border-border rounded-md overflow-hidden bg-muted/10 hover:bg-muted/20 transition-colors"
      data-testid={`land-card-${parcel.plotId}`}
    >
      {/* Clickable card body — navigates to plot on map */}
      <button
        onClick={onSelect}
        className="w-full p-3 text-left"
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: biomeColors[parcel.biome] + "30" }}
          >
            <MapPin className="w-3 h-3" style={{ color: biomeColors[parcel.biome] }} />
          </div>
          <span className="font-display text-xs font-bold uppercase tracking-wide flex-1">
            Plot #{parcel.plotId}
          </span>
          <Badge variant="outline" className="text-[9px] capitalize shrink-0">
            {parcel.biome}
          </Badge>
          {/* Green checkmark when ready to mine */}
          {mineReady ? (
            <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
          ) : (
            <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground font-mono shrink-0">
              <Clock className="w-3 h-3" />
              {formatCooldown(remaining)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-1.5 text-[10px]">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-primary" /> {parcel.defenseLevel}
          </span>
          <span className="flex items-center gap-1 text-iron">
            <Pickaxe className="w-3 h-3" /> {parcel.ironStored}
          </span>
          <span className="flex items-center gap-1 text-fuel">
            <Fuel className="w-3 h-3" /> {parcel.fuelStored}
          </span>
          <span className="flex items-center gap-1 text-crystal">
            <Gem className="w-3 h-3" /> {parcel.crystalStored}
          </span>
          <span className="flex items-center gap-1 text-primary ml-auto">
            <Zap className="w-3 h-3" /> {parcel.frontierPerDay.toFixed(1)}/day
          </span>
        </div>

        <Progress value={storagePercent} className="h-1" />
        <div className="flex items-center justify-between mt-1 text-[9px] text-muted-foreground">
          <span>{totalStored}/{parcel.storageCapacity} stored</span>
          {liveAccum > 0.001 && (
            <span className="text-yellow-400">{liveAccum.toFixed(4)} FRNTR pending</span>
          )}
        </div>
      </button>

      {/* Mine Resources button — only shown when plot is ready */}
      {mineReady && onMineParcel && (
        <div className="px-3 pb-2 border-t border-border/50">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onMineParcel(parcel.id);
            }}
            disabled={isMiningThisParcel}
            size="sm"
            className="w-full h-7 font-display uppercase tracking-wide text-xs transition-all active:scale-95"
            data-testid={`button-inv-mine-${parcel.plotId}`}
          >
            <Pickaxe className={cn("w-3 h-3 mr-1.5", isMiningThisParcel && "animate-spin")} />
            {isMiningThisParcel ? "Extracting..." : "Mine Resources"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function InventoryPanel({
  player,
  parcels,
  onCollectAll,
  onClaimFrontier,
  onSelectParcel,
  onMineParcel,
  isMiningParcel,
  isCollecting,
  isClaimingFrontier,
  className,
}: InventoryPanelProps) {
  if (!player) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground p-8", className)}>
        <Package className="w-12 h-12 mb-4 opacity-30" />
        <p className="font-display uppercase tracking-wide">Connect wallet to view inventory</p>
      </div>
    );
  }

  const [now, setNow] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ownedParcels = useMemo(
    () => parcels.filter((p) => p.ownerId === player.id),
    [parcels, player.id]
  );

  const filteredParcels = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return ownedParcels;
    return ownedParcels.filter((p) => String(p.plotId).includes(q));
  }, [ownedParcels, searchQuery]);

  const totalStoredIron = ownedParcels.reduce((s, p) => s + p.ironStored, 0);
  const totalStoredFuel = ownedParcels.reduce((s, p) => s + p.fuelStored, 0);
  const totalStoredCrystal = ownedParcels.reduce((s, p) => s + p.crystalStored, 0);
  const hasStored = totalStoredIron > 0 || totalStoredFuel > 0 || totalStoredCrystal > 0;

  const totalFrontierPending = ownedParcels.reduce((s, p) => {
    const days = Math.max(0, (now - p.lastFrontierClaimTs) / (1000 * 60 * 60 * 24));
    return s + p.frontierAccumulated + days * p.frontierPerDay;
  }, 0);
  const hasPending = totalFrontierPending > 0.01;

  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="inventory-panel">
      {/* ── Header ── */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">Inventory</h2>
          <span className="text-xs text-muted-foreground ml-auto font-mono">
            {ownedParcels.length} plot{ownedParcels.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Wallet resource balances */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="p-2.5 rounded-md bg-muted/50 text-center">
            <Pickaxe className="w-4 h-4 mx-auto mb-1 text-iron" />
            <span className="font-mono text-lg font-bold block" data-testid="text-wallet-iron">{player.iron}</span>
            <span className="text-[10px] text-muted-foreground font-display uppercase">Iron</span>
          </div>
          <div className="p-2.5 rounded-md bg-muted/50 text-center">
            <Fuel className="w-4 h-4 mx-auto mb-1 text-fuel" />
            <span className="font-mono text-lg font-bold block" data-testid="text-wallet-fuel">{player.fuel}</span>
            <span className="text-[10px] text-muted-foreground font-display uppercase">Fuel</span>
          </div>
          <div className="p-2.5 rounded-md bg-muted/50 text-center">
            <Gem className="w-4 h-4 mx-auto mb-1 text-crystal" />
            <span className="font-mono text-lg font-bold block" data-testid="text-wallet-crystal">{player.crystal}</span>
            <span className="text-[10px] text-muted-foreground font-display uppercase">Crystal</span>
          </div>
          <div className="p-2.5 rounded-md bg-muted/50 text-center">
            <Zap className="w-4 h-4 mx-auto mb-1 text-primary" />
            <span className="font-mono text-lg font-bold block" data-testid="text-wallet-frontier">{player.frontier.toFixed(1)}</span>
            <span className="text-[10px] text-muted-foreground font-display uppercase">FRNTR</span>
          </div>
        </div>

        {/* Lifetime resource extraction totals */}
        <div className="rounded-md bg-muted/30 p-2.5 mb-3">
          <div className="flex items-center gap-1 mb-1.5">
            <FlaskConical className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-display uppercase tracking-wide text-muted-foreground">Total Resources Extracted</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="font-mono text-sm font-bold text-iron block">{player.totalIronMined.toLocaleString()}</span>
              <span className="text-[9px] text-muted-foreground uppercase">Iron</span>
            </div>
            <div>
              <span className="font-mono text-sm font-bold text-fuel block">{player.totalFuelMined.toLocaleString()}</span>
              <span className="text-[9px] text-muted-foreground uppercase">Fuel</span>
            </div>
            <div>
              <span className="font-mono text-sm font-bold text-crystal block">{(player.totalCrystalMined ?? 0).toLocaleString()}</span>
              <span className="text-[9px] text-muted-foreground uppercase">Crystal</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {hasStored && (
            <Button
              onClick={onCollectAll}
              disabled={isCollecting}
              className="flex-1 font-display uppercase tracking-wide text-xs"
              data-testid="button-collect-all"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" />
              {isCollecting ? "Collecting..." : `Collect +${totalStoredIron}Fe +${totalStoredFuel}Fu +${totalStoredCrystal}Cr`}
            </Button>
          )}
          {/* MINT button — mints FRNTR ASA token, separate from mining */}
          {hasPending && (
            <Button
              variant="secondary"
              onClick={onClaimFrontier}
              disabled={isClaimingFrontier}
              className="font-display uppercase tracking-wide text-xs"
              data-testid="button-claim-frontier"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              {isClaimingFrontier ? "Minting..." : `Mint ${totalFrontierPending.toFixed(1)} FRNTR`}
            </Button>
          )}
        </div>

        {!hasStored && !hasPending && ownedParcels.length > 0 && (
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            Open the side menu (≡) to manage plots and mint tokens
          </p>
        )}
      </div>

      {/* ── Territories header + search ── */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-display uppercase tracking-wide text-muted-foreground flex-1">
            Your Territories ({ownedParcels.length})
          </span>
        </div>

        {/* Search bar */}
        {ownedParcels.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by plot ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs font-mono"
              data-testid="input-inventory-plot-search"
            />
          </div>
        )}
      </div>

      {/* ── Territory list ── */}
      <ScrollArea className="flex-1 px-4 pb-4">
        <div className="space-y-2">
          {ownedParcels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No territories yet</p>
              <p className="text-xs mt-1">Purchase land from the map</p>
            </div>
          ) : filteredParcels.length === 0 && searchQuery ? (
            <div className="text-center py-6 text-muted-foreground">
              <Search className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No plots match "{searchQuery}"</p>
            </div>
          ) : (
            filteredParcels.map((p) => (
              <LandCard
                key={p.id}
                parcel={p}
                onSelect={() => onSelectParcel(p.id)}
                onMineParcel={onMineParcel}
                isMiningThisParcel={isMiningParcel ? isMiningParcel(p.id) : false}
                now={now}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
