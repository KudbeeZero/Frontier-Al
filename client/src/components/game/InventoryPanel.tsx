import { Package, Pickaxe, Fuel, Gem, MapPin, Shield, ArrowDownToLine, Coins, Zap } from "lucide-react";
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

  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="inventory-panel">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">Inventory</h2>
        </div>

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

        <div className="flex gap-2">
          {hasStored && (
            <Button
              onClick={onCollectAll}
              disabled={isCollecting}
              className="flex-1 font-display uppercase tracking-wide"
              data-testid="button-collect-all"
            >
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              {isCollecting ? "Collecting..." : `Collect All (+${totalStoredIron}I +${totalStoredFuel}F +${totalStoredCrystal}C)`}
            </Button>
          )}
          {ownedParcels.length > 0 && (
            <Button
              variant="secondary"
              onClick={onClaimFrontier}
              disabled={isClaimingFrontier}
              className="font-display uppercase tracking-wide"
              data-testid="button-claim-frontier"
            >
              <Zap className="w-4 h-4 mr-2" />
              {isClaimingFrontier ? "Claiming..." : `Claim FRNTR`}
            </Button>
          )}
        </div>

        {ownedParcels.length > 0 && (
          <div className="mt-2 text-[10px] text-muted-foreground font-mono text-center">
            Earning {totalFrontierRate.toFixed(1)} FRNTR/day across {ownedParcels.length} plots
          </div>
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
