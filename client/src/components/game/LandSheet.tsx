import { useState } from "react";
import { X, Shield, Pickaxe, Fuel, Gem, MapPin, Clock, Swords, Hammer, ShoppingCart, ChevronUp, Coins, Target, Zap, Crosshair, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { LandParcel, Player, ImprovementType, SpecialAttackType } from "@shared/schema";
import { biomeColors, biomeBonuses, MINE_COOLDOWN_MS, UPGRADE_COSTS, IMPROVEMENT_INFO, SPECIAL_ATTACK_INFO } from "@shared/schema";

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
  isSpecialAttacking?: boolean;
}

function CooldownTimer({ lastMineTs }: { lastMineTs: number }) {
  const now = Date.now();
  const remaining = Math.max(0, MINE_COOLDOWN_MS - (now - lastMineTs));
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
  isSpecialAttacking,
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
        "lg:hidden fixed bottom-16 left-0 right-0 z-40 transition-all duration-300 ease-out",
        expanded ? "max-h-[75vh]" : "max-h-[280px]"
      )}
      data-testid="land-sheet"
    >
      <div className="mx-2 backdrop-blur-xl bg-card/95 border border-border rounded-t-lg overflow-hidden shadow-xl">
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: biomeColors[parcel.biome] }}
        />

        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center"
                style={{ backgroundColor: biomeColors[parcel.biome] + "30" }}
              >
                <MapPin className="w-4 h-4" style={{ color: biomeColors[parcel.biome] }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold uppercase tracking-wide" data-testid="text-plot-id">
                    Plot #{parcel.plotId}
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize">{parcel.biome}</Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {isOwned && <span className="text-primary font-display uppercase">Your Territory</span>}
                  {isEnemyOwned && <span className="text-destructive font-display uppercase">Enemy Territory</span>}
                  {isUnclaimed && <span className="font-display uppercase">Unclaimed</span>}
                  <span className="font-mono">{(() => {
                    const drillBonus = parcel.improvements.filter(i => i.type === "mine_drill").reduce((s, i) => s + i.level * 0.25, 0);
                    const turretBonus = parcel.improvements.filter(i => i.type === "turret").reduce((s, i) => s + i.level * 0.1, 0);
                    const shieldBonus = parcel.improvements.filter(i => i.type === "shield_gen").reduce((s, i) => s + i.level * 0.15, 0);
                    const storageBonus = parcel.improvements.filter(i => i.type === "storage_depot").reduce((s, i) => s + i.level * 0.05, 0);
                    const radarBonus = parcel.improvements.filter(i => i.type === "radar").reduce((s, i) => s + i.level * 0.1, 0);
                    const fortressBonus = parcel.improvements.filter(i => i.type === "fortress").reduce((s, i) => s + i.level * 0.2, 0);
                    const totalBonus = drillBonus + turretBonus + shieldBonus + storageBonus + radarBonus + fortressBonus;
                    const effectiveRate = parcel.frontierPerHour * (1 + totalBonus) * (parcel.richness / 100);
                    return effectiveRate.toFixed(2);
                  })()} FRNTR/hr</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setExpanded(!expanded)}
                data-testid="button-expand-sheet"
              >
                <ChevronUp className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                data-testid="button-close-sheet"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="p-2 rounded-md bg-muted/50 text-center">
              <Shield className={cn("w-3.5 h-3.5 mx-auto mb-0.5", parcel.defenseLevel > 5 ? "text-primary" : parcel.defenseLevel > 2 ? "text-warning" : "text-destructive")} />
              <span className="text-[10px] text-muted-foreground block font-display uppercase">Defense</span>
              <span className="font-mono text-sm font-bold" data-testid="text-defense-level">{parcel.defenseLevel}</span>
            </div>
            <div className="p-2 rounded-md bg-muted/50 text-center">
              <MapPin className="w-3.5 h-3.5 mx-auto mb-0.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground block font-display uppercase">Richness</span>
              <span className="font-mono text-sm font-bold">{parcel.richness}%</span>
            </div>
            <div className="p-2 rounded-md bg-muted/50 text-center">
              <Pickaxe className="w-3.5 h-3.5 mx-auto mb-0.5 text-iron" />
              <span className="text-[10px] text-muted-foreground block font-display uppercase">Iron</span>
              <span className="font-mono text-sm font-bold">{parcel.ironStored}</span>
            </div>
            <div className="p-2 rounded-md bg-muted/50 text-center">
              <Fuel className="w-3.5 h-3.5 mx-auto mb-0.5 text-fuel" />
              <span className="text-[10px] text-muted-foreground block font-display uppercase">Fuel</span>
              <span className="font-mono text-sm font-bold">{parcel.fuelStored}</span>
            </div>
          </div>

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

          <div className="flex gap-2">
            {isOwned && (
              <>
                <Button
                  size="sm"
                  onClick={onMine}
                  disabled={!canMine || isMining}
                  className="flex-1 font-display uppercase tracking-wide text-xs"
                  data-testid="button-mine"
                >
                  <Pickaxe className="w-3.5 h-3.5 mr-1" />
                  {isMining ? "Mining..." : "Mine"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onUpgrade("defense")}
                  disabled={isUpgrading}
                  className="font-display uppercase tracking-wide text-xs"
                  data-testid="button-upgrade"
                >
                  <Shield className="w-3.5 h-3.5 mr-1" />
                  Upgrade
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
                disabled={isPurchasing}
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
                  <Hammer className="w-3.5 h-3.5" /> Build Improvements
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(IMPROVEMENT_INFO) as [ImprovementType, typeof IMPROVEMENT_INFO[ImprovementType]][]).map(([type, info]) => {
                    const existing = parcel.improvements.find(i => i.type === type);
                    const atMax = existing && existing.level >= info.maxLevel;
                    const level = existing ? existing.level + 1 : 1;
                    const cost = { iron: info.cost.iron * level, fuel: info.cost.fuel * level };
                    const canAfford = player && player.iron >= cost.iron && player.fuel >= cost.fuel;

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
                        {existing && <span className="text-[9px] text-muted-foreground font-mono">Lv{existing.level}</span>}
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {atMax ? "MAX" : `${cost.iron}I ${cost.fuel}F`}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {parcel.improvements.length > 0 && (
                <div>
                  <h4 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-1.5">Active Improvements</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {parcel.improvements.map((imp, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {IMPROVEMENT_INFO[imp.type]?.name || imp.type} Lv{imp.level}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {Object.entries(UPGRADE_COSTS).map(([type, cost]) => (
                  <Button
                    key={type}
                    variant="secondary"
                    size="sm"
                    onClick={() => onUpgrade(type)}
                    disabled={isUpgrading || !player || player.iron < cost.iron || player.fuel < cost.fuel}
                    className="flex-col items-start h-auto py-2 px-2.5 text-left"
                    data-testid={`button-upgrade-${type}`}
                  >
                    <span className="text-[10px] font-display uppercase tracking-wide capitalize">{type}</span>
                    <span className="text-[9px] text-muted-foreground font-mono">{cost.iron}I {cost.fuel}F</span>
                  </Button>
                ))}
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
        </div>
      </div>
    </div>
  );
}
