import { useState } from "react";
import { X, Shield, Pickaxe, Fuel, Gem, MapPin, Clock, Swords, Hammer, ShoppingCart, ChevronUp, Coins, Target, Zap, Crosshair, Skull, PackageCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { LandParcel, Player, ImprovementType, SpecialAttackType, DefenseImprovementType, FacilityType } from "@shared/schema";
import { biomeColors, biomeBonuses, MINE_COOLDOWN_MS, UPGRADE_COSTS, DEFENSE_IMPROVEMENT_INFO, FACILITY_INFO, IMPROVEMENT_INFO, SPECIAL_ATTACK_INFO } from "@shared/schema";

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
  isWalletConnected,
  isSpecialAttacking,
  nftInfo,
  onDeliverNft,
  isDeliveringNft,
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
        "fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-72 lg:right-72 z-40 transition-all duration-300 ease-out",
        expanded ? "max-h-[75vh]" : "max-h-[280px]"
      )}
      data-testid="land-sheet"
    >
      <div className="mx-2 backdrop-blur-xl bg-gradient-to-b from-card/95 to-card/85 border border-border/60 rounded-t-xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: expanded ? "75vh" : "280px" }}>
        <div
          className="h-2 w-full shrink-0"
          style={{ backgroundColor: biomeColors[parcel.biome] }}
        />

        <div className="p-3 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
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
