import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { X, Shield, Pickaxe, Fuel, Gem, MapPin, Clock, Swords, Hammer, ShoppingCart, ChevronUp, Coins, Target, Zap, Crosshair, Skull, PackageCheck, ExternalLink, Grid3X3, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { LandParcel, Player, ImprovementType, SpecialAttackType, DefenseImprovementType, FacilityType, SubParcel, BiomeType } from "@shared/schema";
import { biomeColors, biomeBonuses, MINE_COOLDOWN_MS, UPGRADE_COSTS, DEFENSE_IMPROVEMENT_INFO, FACILITY_INFO, IMPROVEMENT_INFO, SPECIAL_ATTACK_INFO, SUB_PARCEL_HOLD_HOURS, BASE_YIELD, SUB_PARCEL_FACILITY_COSTS, SUB_PARCEL_DEFENSE_COSTS, getBiomeUpgradeMultiplier } from "@shared/schema";

// ── SubParcelGrid ─────────────────────────────────────────────────────────────
// Shows the 3×3 sub-parcel ownership grid for subdivided plots.
// Fetches sub-parcel data from /api/plots/:plotId/sub-parcels.

interface SubParcelGridProps {
  parcel: LandParcel;
  player: Player | null;
  onNavigate?: () => void;
}

function SubdivisionCountdown({ heldSince }: { heldSince: number }) {
  const holdMs = SUB_PARCEL_HOLD_HOURS * 60 * 60 * 1000;
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, heldSince + holdMs - Date.now()));

  useEffect(() => {
    const initial = Math.max(0, heldSince + holdMs - Date.now());
    setTimeLeft(initial);
    if (initial === 0) return;
    const id = setInterval(() => {
      const r = Math.max(0, heldSince + holdMs - Date.now());
      setTimeLeft(r);
      if (r === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [heldSince, holdMs]);

  if (timeLeft === 0) return null;

  const hours = Math.floor(timeLeft / 3600000);
  const mins  = Math.floor((timeLeft % 3600000) / 60000);
  const secs  = Math.floor((timeLeft % 60000) / 1000);
  const progress = ((holdMs - timeLeft) / holdMs) * 100;

  return (
    <div className="space-y-1 mb-2">
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-muted-foreground font-display uppercase tracking-wide flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" /> Unlocks in
        </span>
        <span className="font-mono text-amber-400">{hours}h {String(mins).padStart(2,"0")}m {String(secs).padStart(2,"0")}s</span>
      </div>
      <Progress value={progress} className="h-1" />
    </div>
  );
}

function SubParcelUpgradePanel({ sp, player, parentPlotId, biome, onClose }: {
  sp: SubParcel;
  player: Player;
  parentPlotId: number;
  biome: BiomeType;
  onClose: () => void;
}) {
  const [listPrice, setListPrice] = useState("");

  const buildMutation = useMutation({
    mutationFn: (improvementType: ImprovementType) =>
      apiRequest("POST", `/api/sub-parcels/${sp.id}/build`, { playerId: player.id, improvementType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/plots/${parentPlotId}/sub-parcels`] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });

  const { data: listingsData } = useQuery<{ listings: { id: string; subParcelId: string; status: string; askPriceFrontier: number }[] }>({
    queryKey: ["/api/sub-parcels/listings"],
    staleTime: 10_000,
  });
  const existingListing = listingsData?.listings?.find(l => l.subParcelId === sp.id && l.status === "open");

  const createListingMutation = useMutation({
    mutationFn: (price: number) =>
      apiRequest("POST", "/api/sub-parcels/listings", { sellerId: player.id, subParcelId: sp.id, askPriceFrontier: price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-parcels/listings"] });
      setListPrice("");
    },
  });

  const cancelListingMutation = useMutation({
    mutationFn: (listingId: string) =>
      apiRequest("DELETE", `/api/sub-parcels/listings/${listingId}`, { sellerId: player.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-parcels/listings"] });
    },
  });

  const improvements = sp.improvements ?? [];

  const facilityTypes: FacilityType[] = ["electricity", "blockchain_node", "data_centre", "ai_lab"];
  const defenseTypes: DefenseImprovementType[] = ["turret", "shield_gen", "storage_depot", "radar", "fortress"];
  const biomeColor = biomeColors[biome];

  return (
    <div className="mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-display uppercase tracking-wide text-primary flex items-center gap-1.5">
          <Wrench className="w-3 h-3" /> Sub-Parcel #{sp.subIndex + 1} Upgrades
        </span>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[8px] capitalize px-1.5 py-0" style={{ borderColor: biomeColor + "80", color: biomeColor }}>
            {biome}
          </Badge>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-[10px]">✕</button>
        </div>
      </div>

      {improvements.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {improvements.map((imp, i) => (
            <Badge key={i} variant="secondary" className="text-[9px]">
              {IMPROVEMENT_INFO[imp.type]?.name ?? imp.type} Lv{imp.level}
            </Badge>
          ))}
        </div>
      )}

      <div>
        <p className="text-[9px] text-muted-foreground font-display uppercase tracking-wide mb-1">Facilities (FRNTR)</p>
        <div className="grid grid-cols-2 gap-1">
          {facilityTypes.map(type => {
            const info = FACILITY_INFO[type];
            const existing = improvements.find(i => i.type === type);
            const atMax = existing && existing.level >= info.maxLevel;
            const level = existing ? existing.level + 1 : 1;
            const rawCost = atMax ? 0 : SUB_PARCEL_FACILITY_COSTS[type][level - 1];
            const multiplier = getBiomeUpgradeMultiplier(biome, type);
            const cost = atMax ? 0 : Math.ceil(rawCost * multiplier);
            const hasDiscount = multiplier < 0.99;
            const hasPremium = multiplier > 1.01;
            const canAfford = player.frontier >= cost;
            const hasPrereq = !info.prerequisite || improvements.find(i => i.type === info.prerequisite);
            return (
              <Button key={type} variant="outline" size="sm"
                onClick={() => buildMutation.mutate(type)}
                disabled={buildMutation.isPending || !!atMax || !canAfford || !hasPrereq}
                className={cn("flex-col items-start h-auto py-1.5 px-2 text-left", !hasPrereq && "opacity-50")}
              >
                <span className="text-[9px] font-display uppercase">{info.name}</span>
                {existing && <span className="text-[8px] text-primary font-mono">Lv{existing.level}{!atMax ? ` → Lv${level}` : " MAX"}</span>}
                {atMax ? (
                  <span className="text-[8px] text-muted-foreground font-mono">✓ MAX</span>
                ) : (
                  <span className="text-[8px] font-mono flex items-center gap-0.5">
                    {hasDiscount && <span className="line-through text-muted-foreground/50">{rawCost}</span>}
                    <span className={cn(hasDiscount ? "text-green-400" : hasPremium ? "text-amber-400" : "text-muted-foreground")}>
                      {cost} FRNTR
                    </span>
                    {hasDiscount && <span className="text-green-400/70">↓{Math.round((1 - multiplier) * 100)}%</span>}
                    {hasPremium && <span className="text-amber-400/70">↑{Math.round((multiplier - 1) * 100)}%</span>}
                  </span>
                )}
                {!hasPrereq && <span className="text-[7px] text-destructive">🔒 Needs Electricity</span>}
                {!atMax && !canAfford && <span className="text-[7px] text-destructive/70">Insufficient FRNTR</span>}
              </Button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[9px] text-muted-foreground font-display uppercase tracking-wide mb-1">Defense (Iron/Fuel)</p>
        <div className="grid grid-cols-2 gap-1">
          {defenseTypes.map(type => {
            const info = DEFENSE_IMPROVEMENT_INFO[type];
            const existing = improvements.find(i => i.type === type);
            const atMax = existing && existing.level >= info.maxLevel;
            const level = existing ? existing.level + 1 : 1;
            const baseCost = SUB_PARCEL_DEFENSE_COSTS[type];
            const multiplier = getBiomeUpgradeMultiplier(biome, type);
            const rawCost = { iron: baseCost.iron * level, fuel: baseCost.fuel * level };
            const cost = { iron: Math.ceil(rawCost.iron * multiplier), fuel: Math.ceil(rawCost.fuel * multiplier) };
            const hasDiscount = multiplier < 0.99;
            const hasPremium = multiplier > 1.01;
            const canAfford = player.iron >= cost.iron && player.fuel >= cost.fuel;
            return (
              <Button key={type} variant="outline" size="sm"
                onClick={() => buildMutation.mutate(type)}
                disabled={buildMutation.isPending || !!atMax || !canAfford}
                className="flex-col items-start h-auto py-1.5 px-2 text-left"
              >
                <span className="text-[9px] font-display uppercase">{info.name}</span>
                {existing && <span className="text-[8px] text-primary font-mono">Lv{existing.level}{!atMax ? ` → Lv${level}` : " MAX"}</span>}
                {atMax ? (
                  <span className="text-[8px] text-muted-foreground font-mono">✓ MAX</span>
                ) : (
                  <span className="text-[8px] font-mono flex items-center gap-0.5">
                    <span className={cn(hasDiscount ? "text-green-400" : hasPremium ? "text-amber-400" : "text-muted-foreground")}>
                      {cost.iron}I {cost.fuel}F
                    </span>
                    {hasDiscount && <span className="text-green-400/70">↓{Math.round((1 - multiplier) * 100)}%</span>}
                    {hasPremium && <span className="text-amber-400/70">↑{Math.round((multiplier - 1) * 100)}%</span>}
                  </span>
                )}
                {!atMax && !canAfford && <span className="text-[7px] text-destructive/70">Insufficient resources</span>}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Trade Section */}
      <div className="border-t border-border/30 pt-2">
        <p className="text-[9px] text-muted-foreground font-display uppercase tracking-wide mb-1.5">Trade</p>
        {existingListing ? (
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-emerald-400 font-mono">Listed: {existingListing.askPriceFrontier} FRNTR</span>
            <Button size="sm" variant="outline" className="h-5 px-2 text-[9px] border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => cancelListingMutation.mutate(existingListing.id)}
              disabled={cancelListingMutation.isPending}
            >Cancel Listing</Button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <input
              type="number"
              min={1}
              value={listPrice}
              onChange={e => setListPrice(e.target.value)}
              placeholder="Ask price (FRNTR)"
              className="flex-1 bg-muted/30 border border-border rounded px-2 py-1 text-[9px] font-mono focus:outline-none focus:border-primary"
            />
            <Button size="sm" variant="outline" className="h-7 px-2 text-[9px] border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 shrink-0"
              onClick={() => { const p = parseInt(listPrice); if (p > 0) createListingMutation.mutate(p); }}
              disabled={!listPrice || parseInt(listPrice) < 1 || createListingMutation.isPending}
            >List for Sale</Button>
          </div>
        )}
      </div>

      {buildMutation.isError && (
        <p className="text-[9px] text-destructive">{String((buildMutation.error as any)?.message ?? "Build failed")}</p>
      )}
    </div>
  );
}

function SubParcelGrid({ parcel, player, onNavigate }: SubParcelGridProps) {
  const [selectedSubIndex, setSelectedSubIndex] = useState<number | null>(null);

  // API returns { plotId, subParcels, isSubdivided } — select extracts the array
  const { data: subParcels = [], isLoading } = useQuery<SubParcel[]>({
    queryKey: [`/api/plots/${parcel.plotId}/sub-parcels`],
    enabled: !!parcel.isSubdivided,
    select: (data: any) => data?.subParcels ?? data ?? [],
  });

  const purchaseMutation = useMutation({
    mutationFn: (subParcelId: string) =>
      apiRequest("POST", `/api/sub-parcels/${subParcelId}/purchase`, { playerId: player?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/plots/${parcel.plotId}/sub-parcels`] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });

  const subdivideMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/plots/${parcel.plotId}/subdivide`, { playerId: player?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
      queryClient.invalidateQueries({ queryKey: [`/api/plots/${parcel.plotId}/sub-parcels`] });
    },
  });

  const isOwner = player && parcel.ownerId === player.id;
  const holdMs  = SUB_PARCEL_HOLD_HOURS * 60 * 60 * 1000;
  const heldSince = parcel.capturedAt ?? parcel.lastFrontierClaimTs;
  const canSubdivide = !!(isOwner && !parcel.isSubdivided && heldSince && Date.now() - heldSince >= holdMs);

  if (!parcel.isSubdivided) {
    if (!isOwner) return null;
    return (
      <div className="mt-3 p-2.5 rounded-lg bg-muted/30 border border-border/40">
        <div className="flex items-center gap-2 mb-2">
          <Grid3X3 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-display uppercase tracking-wide text-muted-foreground">Sub-Parcels</span>
        </div>
        {heldSince && !canSubdivide && <SubdivisionCountdown heldSince={heldSince} />}
        <p className="text-[9px] text-muted-foreground mb-2">
          {canSubdivide
            ? "Subdivide this plot into a 3×3 grid of 9 purchasable sub-parcels."
            : `Hold for ${SUB_PARCEL_HOLD_HOURS}h to unlock subdivision.`
          }
        </p>
        {canSubdivide && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-[10px] font-display uppercase"
            onClick={() => subdivideMutation.mutate()}
            disabled={subdivideMutation.isPending}
          >
            <Grid3X3 className="w-3 h-3 mr-1" />
            {subdivideMutation.isPending ? "Subdividing..." : "Subdivide Plot"}
          </Button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-3 p-2.5 rounded-lg bg-muted/30 border border-border/40">
        <div className="flex items-center gap-2 mb-2">
          <Grid3X3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-display uppercase tracking-wide">Sub-Parcels</span>
        </div>
        <div className="space-y-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Build indexed map for quick lookup
  const subMap = new Map<number, SubParcel>();
  for (const sp of subParcels) subMap.set(sp.subIndex, sp);

  const allOwnedByMe = subParcels.length === 9 && subParcels.every(s => s.ownerId === player?.id);
  const selectedSp = selectedSubIndex !== null ? subMap.get(selectedSubIndex) : undefined;

  return (
    <div className="mt-3 p-2.5 rounded-lg bg-muted/30 border border-border/40">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-display uppercase tracking-wide">Sub-Parcels</span>
        </div>
        <div className="flex items-center gap-1.5">
          {allOwnedByMe && (
            <Badge variant="outline" className="text-[9px] text-primary border-primary/40">
              +50% Yield
            </Badge>
          )}
          {onNavigate && (
            <button
              onClick={onNavigate}
              title="Find this plot on the map"
              className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded border border-border/40 hover:border-primary/40"
            >
              <MapPin className="w-2.5 h-2.5" />
              Find Plot
            </button>
          )}
        </div>
      </div>
      <Table className="text-[10px]">
        <TableHeader>
          <TableRow className="border-border/30">
            <TableHead className="text-[9px] font-display uppercase tracking-wide h-6 py-0">#</TableHead>
            <TableHead className="text-[9px] font-display uppercase tracking-wide h-6 py-0">Status</TableHead>
            <TableHead className="text-[9px] font-display uppercase tracking-wide h-6 py-0">Improvements</TableHead>
            <TableHead className="text-[9px] font-display uppercase tracking-wide h-6 py-0 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 9 }).map((_, i) => {
            const sp = subMap.get(i);
            const isYours = sp?.ownerId === player?.id;
            const isEnemy = sp?.ownerId && !isYours;
            const price   = sp?.purchasePriceFrontier;
            const canAffordBuy = player && price !== undefined && player.frontier >= price;
            const canBuy  = !sp?.ownerId && player && price !== undefined;
            const hasImprovements = (sp?.improvements?.length ?? 0) > 0;
            const isSelected = selectedSubIndex === i;

            return (
              <TableRow
                key={i}
                className={cn(
                  "border-border/20 transition-colors",
                  isSelected && "bg-primary/10"
                )}
              >
                <TableCell className="py-1 font-mono text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="py-1">
                  {isYours ? (
                    <span className="text-primary font-display uppercase font-semibold">Yours</span>
                  ) : isEnemy ? (
                    <span className="text-destructive font-display uppercase font-semibold">Enemy</span>
                  ) : sp ? (
                    <span className="text-muted-foreground font-mono">{price}F</span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </TableCell>
                <TableCell className="py-1">
                  {hasImprovements ? (
                    <div className="flex flex-wrap gap-0.5">
                      {sp!.improvements!.map((imp, j) => (
                        <Badge key={j} variant="secondary" className="text-[8px] px-1 py-0">
                          {IMPROVEMENT_INFO[imp.type]?.name ?? imp.type} {imp.level}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/40 text-[9px]">None</span>
                  )}
                </TableCell>
                <TableCell className="py-1 text-right">
                  {canBuy && sp && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(
                        "h-5 px-2 text-[9px] font-display uppercase",
                        canAffordBuy ? "" : "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => canAffordBuy && purchaseMutation.mutate(sp.id)}
                      disabled={purchaseMutation.isPending || !canAffordBuy}
                      title={canAffordBuy ? `Buy for ${price} FRNTR` : `Need ${price} FRNTR`}
                    >
                      {canAffordBuy ? `Buy ${price}F` : `${price}F`}
                    </Button>
                  )}
                  {isYours && (
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "ghost"}
                      className="h-5 px-2 text-[9px] font-display uppercase"
                      onClick={() => setSelectedSubIndex(isSelected ? null : i)}
                    >
                      {isSelected ? "Close" : "Manage"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selectedSp && player && selectedSp.ownerId === player.id && (
        <SubParcelUpgradePanel
          sp={selectedSp}
          player={player}
          parentPlotId={parcel.plotId}
          biome={parcel.biome}
          onClose={() => setSelectedSubIndex(null)}
        />
      )}

      {purchaseMutation.isError && (
        <p className="text-[9px] text-destructive mt-1">
          {String((purchaseMutation.error as any)?.message ?? "Purchase failed")}
        </p>
      )}
    </div>
  );
}

const ATTACK_ICONS: Record<SpecialAttackType, React.ElementType> = {
  orbital_strike: Target,
  emp_blast: Zap,
  siege_barrage: Crosshair,
  sabotage: Skull,
};

interface LandSheetProps {
  parcel: LandParcel | null;
  player: Player | null;
  onMine: () => void;
  onUpgrade: (type: string) => void;
  onAttack: () => void;
  onBuild: (type: ImprovementType) => void;
  onPurchase: () => void;
  onSpecialAttack?: (type: SpecialAttackType) => void;
  onClose: () => void;
  isMining: boolean;
  isUpgrading: boolean;
  isBuilding: boolean;
  isPurchasing: boolean;
  isWalletConnected: boolean;
  isSpecialAttacking?: boolean;
  nftInfo?: { assetId: number; inCustody: boolean } | null;
  onDeliverNft?: () => void;
  isDeliveringNft?: boolean;
  onNavigateToPlot?: () => void;
}

function CooldownTimer({ lastMineTs }: { lastMineTs: number }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, MINE_COOLDOWN_MS - (Date.now() - lastMineTs))
  );

  useEffect(() => {
    const initial = Math.max(0, MINE_COOLDOWN_MS - (Date.now() - lastMineTs));
    setRemaining(initial);
    if (initial === 0) return;
    const id = setInterval(() => {
      const r = Math.max(0, MINE_COOLDOWN_MS - (Date.now() - lastMineTs));
      setRemaining(r);
      if (r === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [lastMineTs]);

  const progress = ((MINE_COOLDOWN_MS - remaining) / MINE_COOLDOWN_MS) * 100;
  const canMine = remaining === 0;

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-1.5" data-testid="cooldown-timer">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-display uppercase tracking-wide flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> Mine Cooldown
        </span>
        <span className={cn("font-mono text-xs", canMine ? "text-primary" : "text-warning")} data-testid="text-cooldown-status">
          {canMine ? "READY" : formatTime(remaining)}
        </span>
      </div>
      <Progress value={progress} className="h-1.5" data-testid="progress-cooldown" />
    </div>
  );
}

export function LandSheet({
  parcel,
  player,
  onMine,
  onUpgrade,
  onAttack,
  onBuild,
  onPurchase,
  onSpecialAttack,
  onClose,
  isMining,
  isUpgrading,
  isBuilding,
  isPurchasing,
  isWalletConnected,
  isSpecialAttacking,
  nftInfo,
  onDeliverNft,
  isDeliveringNft,
  onNavigateToPlot,
}: LandSheetProps) {
  const [expanded, setExpanded] = useState(false);

  if (!parcel) return null;

  const isOwned = parcel.ownerId === player?.id;
  const isEnemyOwned = parcel.ownerId && parcel.ownerId !== player?.id;
  const isUnclaimed = !parcel.ownerId;
  const canMine = isOwned && Date.now() - parcel.lastMineTs >= MINE_COOLDOWN_MS;
  const biomeBonus = biomeBonuses[parcel.biome];
  const totalStored = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
  const storagePercent = (totalStored / parcel.storageCapacity) * 100;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 md:left-60 md:right-60 lg:left-72 lg:right-72 z-40 transition-all duration-300 ease-out",
        expanded ? "max-h-[75vh]" : "max-h-[280px]"
      )}
      data-testid="land-sheet"
    >
      <div className="mx-2 backdrop-blur-xl bg-gradient-to-b from-card/95 to-card/85 border border-border/60 rounded-t-xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: expanded ? "75vh" : "280px" }}>
        <div
          className="h-2 w-full shrink-0"
          style={{ backgroundColor: biomeColors[parcel.biome] }}
        />

        <div className="flex-1 min-h-0 p-3 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shadow-md"
                style={{ backgroundColor: biomeColors[parcel.biome] + "35", border: `2px solid ${biomeColors[parcel.biome]}30` }}
              >
                <MapPin className="w-5 h-5" style={{ color: biomeColors[parcel.biome] }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold uppercase tracking-wide" data-testid="text-plot-id">
                    Plot #{parcel.plotId}
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize font-semibold">{parcel.biome}</Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] mt-0.5">
                  {isOwned && <span className="text-primary font-display uppercase font-semibold">Your Territory</span>}
                  {isEnemyOwned && <span className="text-destructive font-display uppercase font-semibold">Enemy Territory</span>}
                  {isUnclaimed && <span className="font-display uppercase">Unclaimed</span>}
                  <span className="text-primary font-mono font-semibold">{parcel.frontierPerDay.toFixed(1)} FRNTR/day</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-muted/40"
                onClick={() => setExpanded(!expanded)}
                data-testid="button-expand-sheet"
              >
                <ChevronUp className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-muted/40"
                onClick={onClose}
                data-testid="button-close-sheet"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Biome yield profile */}
          <div className="mb-2 px-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-display uppercase tracking-wide mb-1">
              <span style={{ color: biomeColors[parcel.biome] }}>■</span>
              <span>{parcel.biome} zone</span>
            </div>
            <div className="flex gap-3 font-mono text-[9px] text-muted-foreground">
              <span className="text-iron">⛏ ×{biomeBonus.ironMod.toFixed(1)} iron</span>
              <span className="text-fuel">⛽ ×{biomeBonus.fuelMod.toFixed(1)} fuel</span>
              <span className="text-purple-400">💎 ×{biomeBonus.crystalMod.toFixed(1)} crystal</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 text-center hover:border-primary/40 transition-colors">
              <Shield className={cn("w-4 h-4 mx-auto mb-1", parcel.defenseLevel > 5 ? "text-green-500" : parcel.defenseLevel > 2 ? "text-yellow-500" : "text-red-500")} />
              <span className="text-[9px] text-muted-foreground block font-display uppercase tracking-wide">Defense</span>
              <span className="font-mono text-sm font-bold" data-testid="text-defense-level">{parcel.defenseLevel}</span>
              <span className="text-[8px] text-muted-foreground block">{(parcel.defenseLevel * 15).toFixed(0)} power</span>
            </div>
            <div className={cn(
              "p-2.5 rounded-lg bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 text-center transition-colors",
              (parcel.influence ?? 100) > 66 ? "hover:border-green-500/40"
                : (parcel.influence ?? 100) > 33 ? "hover:border-yellow-500/40"
                : "border-red-500/30 hover:border-red-500/40"
            )}>
              <div className={cn("w-4 h-4 mx-auto mb-1", (parcel.influence ?? 100) > 66 ? "text-green-400" : (parcel.influence ?? 100) > 33 ? "text-yellow-400" : "text-red-400")}>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11.5L3.5 14.5L5 9.5L1 6H6L8 1Z"/></svg>
              </div>
              <span className="text-[9px] text-muted-foreground block font-display uppercase tracking-wide">Influence</span>
              <span className={cn("font-mono text-sm font-bold", (parcel.influence ?? 100) > 66 ? "text-green-400" : (parcel.influence ?? 100) > 33 ? "text-yellow-400" : "text-red-400")}>
                {parcel.influence ?? 100}%
              </span>
              {(parcel.influence ?? 100) < 20 && <p className="text-[8px] text-red-400 uppercase font-bold mt-0.5">⚠ Blocked</p>}
            </div>
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 text-center hover:border-primary/40 transition-colors">
              <MapPin className="w-4 h-4 mx-auto mb-1 text-amber-500" />
              <span className="text-[9px] text-muted-foreground block font-display uppercase tracking-wide">Richness</span>
              <span className="font-mono text-sm font-bold">{Math.round(parcel.richness)}%</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 text-center hover:border-iron/40 transition-colors">
              <Pickaxe className="w-4 h-4 mx-auto mb-1 text-iron" />
              <span className="text-[9px] text-muted-foreground block font-display uppercase tracking-wide">Iron</span>
              <span className="font-mono text-sm font-bold text-iron">{parcel.ironStored}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 text-center hover:border-fuel/40 transition-colors">
              <Fuel className="w-4 h-4 mx-auto mb-1 text-fuel" />
              <span className="text-[9px] text-muted-foreground block font-display uppercase tracking-wide">Fuel</span>
              <span className="font-mono text-sm font-bold text-fuel">{parcel.fuelStored}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 text-center hover:border-purple-400/40 transition-colors">
              <Gem className="w-4 h-4 mx-auto mb-1 text-purple-400" />
              <span className="text-[9px] text-muted-foreground block font-display uppercase tracking-wide">Crystal</span>
              <span className="font-mono text-sm font-bold text-purple-400">{parcel.crystalStored}</span>
            </div>
          </div>

          {/* 24h Resource Yield Forecast */}
          {(() => {
            const richMult = parcel.richness / 100;
            const influenceMult = Math.min(1, Math.max(0, (parcel.influence ?? 100) / 100));
            const yieldMult = parcel.yieldMultiplier ?? 1.0;
            const ironPerMine    = Math.floor(BASE_YIELD.iron    * biomeBonus.ironMod    * richMult * influenceMult * yieldMult);
            const fuelPerMine    = Math.floor(BASE_YIELD.fuel    * biomeBonus.fuelMod    * richMult * influenceMult * yieldMult);
            const crystalPerMine = Math.floor(BASE_YIELD.crystal * biomeBonus.crystalMod * richMult * influenceMult * yieldMult);
            const minesPerDay = Math.floor((24 * 60 * 60 * 1000) / MINE_COOLDOWN_MS);
            return (
              <div className="mb-2 px-1 py-1.5 rounded-md bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-1.5 text-[9px] text-primary/70 font-display uppercase tracking-wide mb-1">
                  <Pickaxe className="w-2.5 h-2.5" />
                  <span>Per-Mine Yield</span>
                  {yieldMult !== 1.0 && (
                    <span className="text-amber-400">×{yieldMult.toFixed(1)} orbital</span>
                  )}
                </div>
                <div className="flex gap-3 font-mono text-[10px]">
                  <span className="text-iron">⛏ +{ironPerMine} iron</span>
                  <span className="text-fuel">⛽ +{fuelPerMine} fuel</span>
                  <span className="text-purple-400">💎 +{crystalPerMine} xtal</span>
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                  ~{minesPerDay}× daily capacity · {(ironPerMine * minesPerDay).toLocaleString()} iron/day max
                </div>
              </div>
            );
          })()}

          {isOwned && (
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground font-display uppercase">Storage {totalStored}/{parcel.storageCapacity}</span>
                <span className="font-mono">{Math.round(storagePercent)}%</span>
              </div>
              <Progress value={storagePercent} className="h-1" />
              <CooldownTimer lastMineTs={parcel.lastMineTs} />
            </div>
          )}

          {/* Sub-parcel grid — shown for owned plots and subdivided plots */}
          {(parcel.isSubdivided || isOwned) && (
            <SubParcelGrid parcel={parcel} player={player} onNavigate={onNavigateToPlot} />
          )}

          <div className="flex gap-2">
            {isOwned && (
              <>
                <Button
                  size="sm"
                  onClick={onMine}
                  disabled={!canMine || isMining}
                  className={cn(
                    "flex-1 font-display uppercase tracking-wide text-xs font-semibold",
                    canMine && !isMining && "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
                  )}
                  data-testid="button-mine"
                >
                  <Pickaxe className="w-4 h-4 mr-1.5" />
                  {isMining ? "Mining..." : "Mine"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setExpanded(true)}
                  className="font-display uppercase tracking-wide text-xs font-semibold"
                  data-testid="button-upgrade"
                >
                  <Hammer className="w-3.5 h-3.5 mr-1" />
                  Upgrade ↑
                </Button>
              </>
            )}
            {isEnemyOwned && player && parcel.biome !== "water" && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onAttack}
                  className="flex-1 font-display uppercase tracking-wide text-xs"
                  data-testid="button-attack"
                >
                  <Swords className="w-3.5 h-3.5 mr-1" />
                  Attack
                </Button>
              </>
            )}
            {isUnclaimed && player && parcel.purchasePriceAlgo !== null && (
              <Button
                size="sm"
                onClick={onPurchase}
                disabled={isPurchasing || !isWalletConnected}
                className="flex-1 font-display uppercase tracking-wide text-xs"
                data-testid="button-purchase"
              >
                <Coins className="w-3.5 h-3.5 mr-1" />
                Buy ({parcel.purchasePriceAlgo} ALGO)
              </Button>
            )}
          </div>

          {expanded && isOwned && (
            <div className="mt-3 pt-3 border-t border-border space-y-3">
              <div>
                <h4 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Defense (Iron/Fuel)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(DEFENSE_IMPROVEMENT_INFO) as [DefenseImprovementType, typeof DEFENSE_IMPROVEMENT_INFO[DefenseImprovementType]][]).map(([type, info]) => {
                    const existing = parcel.improvements.find(i => i.type === type);
                    const atMax = existing && existing.level >= info.maxLevel;
                    const nextLevel = existing ? existing.level + 1 : 1;
                    const cost = { iron: info.cost.iron * nextLevel, fuel: info.cost.fuel * nextLevel };
                    const canAfford = player && player.iron >= cost.iron && player.fuel >= cost.fuel;
                    const needIron = !canAfford && player ? Math.max(0, cost.iron - player.iron) : 0;
                    const needFuel = !canAfford && player ? Math.max(0, cost.fuel - player.fuel) : 0;

                    return (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => onBuild(type)}
                        disabled={isBuilding || !!atMax || !canAfford}
                        className="flex-col items-start h-auto py-2 px-2.5 text-left"
                        data-testid={`button-build-${type}`}
                      >
                        <span className="text-[10px] font-display uppercase tracking-wide">{info.name}</span>
                        <span className="text-[9px] text-primary/70 font-mono">{info.effect}</span>
                        {existing && <span className="text-[9px] text-muted-foreground font-mono">Currently Lv{existing.level} → Lv{nextLevel}</span>}
                        <span className="text-[9px] text-muted-foreground font-mono mt-0.5">
                          {atMax ? "✓ MAX" : `${cost.iron}I ${cost.fuel}F`}
                        </span>
                        {!atMax && !canAfford && player && (
                          <span className="text-[8px] text-destructive font-mono">
                            Need {needIron > 0 ? `+${needIron} iron` : ""}{needIron > 0 && needFuel > 0 ? ", " : ""}{needFuel > 0 ? `+${needFuel} fuel` : ""}
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-display uppercase tracking-wide text-primary mb-2 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" /> Facilities (FRONTIER burned)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(FACILITY_INFO) as [FacilityType, typeof FACILITY_INFO[FacilityType]][]).map(([type, info]) => {
                    const existing = parcel.improvements.find(i => i.type === type);
                    const atMax = existing && existing.level >= info.maxLevel;
                    const level = existing ? existing.level + 1 : 1;
                    const cost = atMax ? 0 : info.costFrontier[level - 1];
                    const canAfford = player && player.frontier >= cost;
                    const hasPrereq = !info.prerequisite || parcel.improvements.find(i => i.type === info.prerequisite);
                    const perDay = info.frontierPerDay[Math.min(level - 1, info.frontierPerDay.length - 1)];
                    const showsIncome = perDay > 0;

                    return (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => onBuild(type)}
                        disabled={isBuilding || !!atMax || !canAfford || !hasPrereq}
                        className={cn("flex-col items-start h-auto py-2 px-2.5 text-left", !hasPrereq && "opacity-50")}
                        data-testid={`button-build-${type}`}
                      >
                        <span className="text-[10px] font-display uppercase tracking-wide">{info.name}</span>
                        {existing && (
                          <span className="text-[9px] text-primary font-mono">
                            Lv{existing.level}{existing.level < info.maxLevel ? ` → Lv${existing.level + 1}` : " MAX"}
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {atMax ? "✓ MAX" : `${cost} FRNTR`}
                        </span>
                        {showsIncome
                          ? <span className="text-[9px] text-primary/70 font-mono">+{perDay} FRNTR/day</span>
                          : <span className="text-[9px] text-primary/70 font-mono">{info.effect}</span>
                        }
                        {!hasPrereq && (
                          <span className="text-[8px] text-destructive flex items-center gap-0.5">
                            🔒 Needs Electricity
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {parcel.improvements.length > 0 && (
                <div>
                  <h4 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-1.5">Active Improvements</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {parcel.improvements.map((imp, i) => {
                      const info = IMPROVEMENT_INFO[imp.type];
                      return (
                        <Badge key={i} variant="secondary" className="text-[10px] flex items-center gap-1">
                          {info?.name || imp.type} Lv{imp.level}
                          {info?.effect && <span className="text-primary/60">· {info.effect.split(" per")[0]}</span>}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              <h4 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Hammer className="w-3.5 h-3.5" /> Plot Upgrades (Iron/Fuel)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(UPGRADE_COSTS).map(([type, cost]) => {
                  const canAfford = player && player.iron >= cost.iron && player.fuel >= cost.fuel;
                  const needIron = !canAfford && player ? Math.max(0, cost.iron - player.iron) : 0;
                  const needFuel = !canAfford && player ? Math.max(0, cost.fuel - player.fuel) : 0;
                  return (
                    <Button
                      key={type}
                      variant="secondary"
                      size="sm"
                      onClick={() => onUpgrade(type)}
                      disabled={isUpgrading || !canAfford}
                      className="flex-col items-start h-auto py-2 px-2.5 text-left"
                      data-testid={`button-upgrade-${type}`}
                    >
                      <span className="text-[10px] font-display uppercase tracking-wide capitalize">{type}</span>
                      <span className="text-[9px] text-primary/70 font-mono">{cost.effect}</span>
                      <span className="text-[9px] text-muted-foreground font-mono mt-0.5">{cost.iron}I {cost.fuel}F</span>
                      {!canAfford && player && (
                        <span className="text-[8px] text-destructive font-mono">
                          Need {needIron > 0 ? `+${needIron} iron` : ""}{needIron > 0 && needFuel > 0 ? ", " : ""}{needFuel > 0 ? `+${needFuel} fuel` : ""}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {expanded && isEnemyOwned && player?.commander && onSpecialAttack && (
            <div className="mt-3 pt-3 border-t border-border">
              <h4 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Special Attacks
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(SPECIAL_ATTACK_INFO) as [SpecialAttackType, typeof SPECIAL_ATTACK_INFO[SpecialAttackType]][]).map(([type, info]) => {
                  const Icon = ATTACK_ICONS[type];
                  const isAvailable = info.requiredTier.includes(player.commander!.tier);
                  const record = player.specialAttacks.find(sa => sa.type === type);
                  const isOnCooldown = record ? (Date.now() - record.lastUsedTs) < info.cooldownMs : false;
                  const canAfford = player.frontier >= info.costFrontier;

                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => onSpecialAttack(type)}
                      disabled={!isAvailable || isOnCooldown || !canAfford || isSpecialAttacking}
                      className="flex-col items-start h-auto py-2 px-2.5 text-left"
                      data-testid={`button-special-${type}`}
                    >
                      <span className="text-[10px] font-display uppercase tracking-wide flex items-center gap-1">
                        <Icon className="w-3 h-3" /> {info.name}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {isOnCooldown ? "Cooldown" : `${info.costFrontier} FRNTR`}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {parcel.activeBattleId && (
            <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded-md flex items-center gap-2">
              <Swords className="w-3.5 h-3.5 text-destructive animate-pulse" />
              <span className="text-xs font-display uppercase tracking-wide text-destructive">Active Battle</span>
            </div>
          )}

          {nftInfo && (
            <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded-md">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-display uppercase tracking-wide text-primary">Plot NFT</span>
                  <a
                    href={`https://explorer.perawallet.app/assets/${nftInfo.assetId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary font-mono underline underline-offset-2"
                  >
                    ASA {nftInfo.assetId} ↗
                  </a>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`https://allo.info/asset/${nftInfo.assetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {nftInfo.inCustody && onDeliverNft && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onDeliverNft}
                      disabled={isDeliveringNft}
                      className="h-5 px-2 text-[10px] font-display uppercase"
                    >
                      {isDeliveringNft ? "Claiming..." : nftInfo.inCustody ? "Claim NFT" : "NFT Claimed ✓"}
                    </Button>
                  )}
                  {!nftInfo.inCustody && nftInfo.assetId && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">In Wallet</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
