import { Package, Pickaxe, Fuel, Gem, MapPin, Shield, ArrowDownToLine, Coins, Zap, TrendingUp, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Player, LandParcel } from "@shared/schema";
import { biomeColors, IMPROVEMENT_INFO } from "@shared/schema";

interface InventoryPanelProps {
  player: Player | null;
  parcels: LandParcel[];
  onCollectAll: () => void;
  onClaimFrontier: () => void;
  onSelectParcel: (id: string) => void;
  isCollecting: boolean;
  isClaimingFrontier: boolean;
  className?: string;
}

function LandCard({ parcel, onSelect }: { parcel: LandParcel; onSelect: () => void }) {
  const totalStored = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
  const storagePercent = (totalStored / parcel.storageCapacity) * 100;

  return (
    <button
      onClick={onSelect}
      className="w-full p-3 border border-border rounded-md text-left hover-elevate active-elevate-2"
      data-testid={`land-card-${parcel.plotId}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: biomeColors[parcel.biome] + "30" }}
        >
          <MapPin className="w-3 h-3" style={{ color: biomeColors[parcel.biome] }} />
        </div>
        <span className="font-display text-xs font-bold uppercase tracking-wide">
          Plot #{parcel.plotId}
        </span>
        <Badge variant="outline" className="text-[9px] capitalize ml-auto">{parcel.biome}</Badge>
      </div>

      <div className="flex items-center gap-3 mb-1.5 text-[10px]">
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-primary" /> {parcel.defenseLevel}
        </span>
        <span className="flex items-center gap-1">
          <Pickaxe className="w-3 h-3 text-iron" /> {parcel.ironStored}
        </span>
        <span className="flex items-center gap-1">
          <Fuel className="w-3 h-3 text-fuel" /> {parcel.fuelStored}
        </span>
        <span className="flex items-center gap-1">
          <Gem className="w-3 h-3 text-crystal" /> {parcel.crystalStored}
        </span>
      </div>

      <Progress value={storagePercent} className="h-1" />
      <div className="flex items-center justify-between mt-1 text-[9px] text-muted-foreground">
        <span>{totalStored}/{parcel.storageCapacity}</span>
        <span>{parcel.frontierPerDay.toFixed(1)} FRNTR/day</span>
      </div>
    </button>
  );
}

export function InventoryPanel({ player, parcels, onCollectAll, onClaimFrontier, onSelectParcel, isCollecting, isClaimingFrontier, className }: InventoryPanelProps) {
  if (!player) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground p-8", className)}>
        <Package className="w-12 h-12 mb-4 opacity-30" />
        <p className="font-display uppercase tracking-wide">Connect wallet to view inventory</p>
      </div>
    );
  }

  const ownedParcels = parcels.filter(p => p.ownerId === player.id);
  const totalStoredIron = ownedParcels.reduce((s, p) => s + p.ironStored, 0);
  const totalStoredFuel = ownedParcels.reduce((s, p) => s + p.fuelStored, 0);
  const totalStoredCrystal = ownedParcels.reduce((s, p) => s + p.crystalStored, 0);
  const hasStored = totalStoredIron > 0 || totalStoredFuel > 0 || totalStoredCrystal > 0;
  const totalFrontierRate = ownedParcels.reduce((s, p) => s + p.frontierPerDay, 0);
  const totalFrontierPending = ownedParcels.reduce((s, p) => s + p.frontierAccumulated, 0);
  const hasPendingFrontier = totalFrontierPending > 0.01;

  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="inventory-panel">

      {/* ── Cumulative FRNTR Accumulation Banner ── */}
      {ownedParcels.length > 0 && (
        <div className="mx-4 mt-4 p-3 rounded-lg border border-primary/40 bg-primary/5" data-testid="frntr-accumulation-banner">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary shrink-0" />
            <span className="font-display text-xs font-bold uppercase tracking-wide text-primary">FRNTR Generation</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="text-center">
              <span className="font-mono text-xl font-bold text-primary block" data-testid="text-frontier-daily-rate">
                {totalFrontierRate.toFixed(1)}
              </span>
              <span className="text-[10px] text-muted-foreground font-display uppercase">FRNTR / Day</span>
              <div className="text-[9px] text-muted-foreground mt-0.5">across {ownedParcels.length} plot{ownedParcels.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="text-center">
              <span className="font-mono text-xl font-bold text-yellow-400 block" data-testid="text-frontier-pending">
                {totalFrontierPending.toFixed(2)}
              </span>
              <span className="text-[10px] text-muted-foreground font-display uppercase">Accumulated</span>
              <div className="text-[9px] text-muted-foreground mt-0.5">ready to mint</div>
            </div>
          </div>

          <Button
            onClick={onClaimFrontier}
            disabled={isClaimingFrontier || !hasPendingFrontier}
            className="w-full font-display uppercase tracking-wide bg-primary hover:bg-primary/90"
            data-testid="button-mint-all-frontier"
          >
            <Zap className="w-4 h-4 mr-2" />
            {isClaimingFrontier
              ? "Minting..."
              : hasPendingFrontier
              ? `Mint All — ${totalFrontierPending.toFixed(2)} FRNTR`
              : "No FRNTR to Mint Yet"}
          </Button>
          {hasPendingFrontier && (
            <p className="text-[9px] text-muted-foreground text-center mt-1.5">
              Large claims are sent in max-size batches on-chain
            </p>
          )}
        </div>
      )}

      <div className="p-4 border-b border-border mt-3">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">Inventory</h2>
        </div>

        {/* ── Wallet balances ── */}
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

        {/* ── Lifetime mineral extraction totals ── */}
        <div className="rounded-md bg-muted/30 p-2.5 mb-3">
          <div className="flex items-center gap-1 mb-1.5">
            <FlaskConical className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-display uppercase tracking-wide text-muted-foreground">Total Extracted (Lifetime)</span>
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

        {/* ── Collect stored minerals button ── */}
        {hasStored && (
          <Button
            onClick={onCollectAll}
            disabled={isCollecting}
            className="w-full font-display uppercase tracking-wide mb-1"
            data-testid="button-collect-all"
          >
            <ArrowDownToLine className="w-4 h-4 mr-2" />
            {isCollecting ? "Collecting..." : `Collect Minerals — +${totalStoredIron}Fe +${totalStoredFuel}Fu +${totalStoredCrystal}Cr`}
          </Button>
        )}
      </div>

      <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
        <span className="text-xs font-display uppercase tracking-wide text-muted-foreground">
          Your Territories ({ownedParcels.length})
        </span>
      </div>

      <ScrollArea className="flex-1 px-4 pb-4">
        <div className="space-y-2">
          {ownedParcels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No territories yet</p>
              <p className="text-xs mt-1">Purchase land from the map</p>
            </div>
          ) : (
            ownedParcels.map((p) => (
              <LandCard key={p.id} parcel={p} onSelect={() => onSelectParcel(p.id)} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
