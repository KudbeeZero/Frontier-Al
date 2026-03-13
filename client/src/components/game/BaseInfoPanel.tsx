import { Shield, Pickaxe, Fuel, MapPin, Clock, Swords, Hammer, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LandParcel, Player, DefenseImprovementType, FacilityType } from "@shared/schema";
import { biomeColors, biomeBonuses, MINE_COOLDOWN_MS, DEFENSE_IMPROVEMENT_INFO, FACILITY_INFO } from "@shared/schema";

interface BaseInfoPanelProps {
  parcel: LandParcel | null;
  player: Player | null;
  onMine: () => void;
  onUpgrade: (type: string) => void;
  onBuild: (improvementType: string) => void;
  onAttack: () => void;
  isMining: boolean;
  isUpgrading: boolean;
  className?: string;
}

function StatRow({ icon: Icon, label, value, colorClass, testId }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  colorClass?: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0" data-testid={testId}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={cn("w-4 h-4", colorClass)} />
        <span className="text-sm uppercase tracking-wide font-display">{label}</span>
      </div>
      <span className="font-mono text-sm font-semibold" data-testid={testId ? `text-${testId}-value` : undefined}>{value}</span>
    </div>
  );
}

function CooldownTimer({ lastMineTs }: { lastMineTs: number }) {
  const now = Date.now();
  const elapsed = now - lastMineTs;
  const remaining = Math.max(0, MINE_COOLDOWN_MS - elapsed);
  const progress = ((MINE_COOLDOWN_MS - remaining) / MINE_COOLDOWN_MS) * 100;
  const canMine = remaining === 0;
  
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-2" data-testid="cooldown-timer">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-display uppercase tracking-wide">Mine Cooldown</span>
        <span className={cn("font-mono", canMine ? "text-success" : "text-warning")} data-testid="text-cooldown-status">
          {canMine ? "READY" : formatTime(remaining)}
        </span>
      </div>
      <Progress value={progress} className="h-2" data-testid="progress-cooldown" />
    </div>
  );
}

export function BaseInfoPanel({
  parcel,
  player,
  onMine,
  onUpgrade,
  onBuild,
  onAttack,
  isMining,
  isUpgrading,
  className,
}: BaseInfoPanelProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (!parcel) {
    return (
      <div className={cn(
        "p-6 backdrop-blur-md bg-card/80 border border-card-border rounded-md",
        className
      )} data-testid="panel-base-info-empty">
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <MapPin className="w-12 h-12 mb-4 opacity-50" />
          <p className="font-display text-lg uppercase tracking-wide">No Tile Selected</p>
          <p className="text-sm mt-1">Click on a hex tile to view details</p>
        </div>
      </div>
    );
  }

  const isOwned = parcel.ownerId && player && parcel.ownerId === player.id;
  const isEnemy = parcel.ownerId && (!player || parcel.ownerId !== player.id);
  const canMine = isOwned && Date.now() - parcel.lastMineTs >= MINE_COOLDOWN_MS;
  const biomeBonus = biomeBonuses[parcel.biome];
  const avgYieldPct = Math.round(((biomeBonus.ironMod + biomeBonus.fuelMod + biomeBonus.crystalMod) / 3 - 1) * 100);

  return (
    <div className={cn(
      "backdrop-blur-md bg-card/80 border border-card-border rounded-md overflow-hidden",
      className
    )} data-testid="panel-base-info">
      <div 
        className="h-2 w-full"
        style={{ backgroundColor: biomeColors[parcel.biome] }}
      />
      
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold uppercase tracking-wide" data-testid="text-plot-id">
              Plot #{parcel.plotId}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="capitalize font-display" data-testid="badge-biome">
                {parcel.biome}
              </Badge>
              {parcel.ownerId && (
                <Badge variant={isOwned ? "default" : "destructive"} className="font-display" data-testid="badge-ownership">
                  {isOwned ? "YOUR TERRITORY" : parcel.ownerType === "ai" ? "AI CONTROLLED" : "ENEMY"}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1" data-testid="display-defense-level">
            <Shield className={cn(
              "w-5 h-5",
              parcel.defenseLevel > 5 ? "text-success" : parcel.defenseLevel > 2 ? "text-warning" : "text-danger"
            )} />
            <span className="font-mono text-lg font-bold" data-testid="text-defense-level">{parcel.defenseLevel}</span>
          </div>
        </div>

        <div className="space-y-1">
          <StatRow icon={MapPin} label="Richness" value={`${parcel.richness}%`} testId="stat-richness" />
          <StatRow icon={Pickaxe} label="Iron Stored" value={parcel.ironStored} colorClass="text-iron" testId="stat-iron" />
          <StatRow icon={Fuel} label="Fuel Stored" value={parcel.fuelStored} colorClass="text-fuel" testId="stat-fuel" />
          <StatRow icon={Shield} label="Defense Bonus" value={`+${Math.round((biomeBonus.defenseMod - 1) * 100)}%`} testId="stat-defense-bonus" />
          <StatRow icon={Pickaxe} label="Yield Bonus" value={`${avgYieldPct >= 0 ? "+" : ""}${avgYieldPct}%`} testId="stat-yield-bonus" />
        </div>

        {isOwned && (
          <>
            <CooldownTimer lastMineTs={parcel.lastMineTs} />
            
            <div className="space-y-2">
              <Button
                onClick={onMine}
                disabled={!canMine || isMining}
                className="w-full font-display uppercase tracking-wide"
                data-testid="button-mine"
              >
                <Pickaxe className="w-4 h-4 mr-2" />
                {isMining ? "Mining..." : "Mine Resources"}
              </Button>

              <Collapsible open={upgradeOpen} onOpenChange={setUpgradeOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full font-display uppercase tracking-wide">
                    <Hammer className="w-4 h-4 mr-2" />
                    Build / Upgrade
                    {upgradeOpen ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">

                  {/* Defense structures */}
                  <p className="text-[10px] font-display uppercase tracking-widest text-muted-foreground px-0.5">
                    Defense Structures
                  </p>
                  {(Object.keys(DEFENSE_IMPROVEMENT_INFO) as DefenseImprovementType[]).map((type) => {
                    const info = DEFENSE_IMPROVEMENT_INFO[type];
                    const existing = parcel.improvements.find(i => i.type === type);
                    const currentLevel = existing?.level ?? 0;
                    const nextLevel = currentLevel + 1;
                    const atMax = currentLevel >= info.maxLevel;
                    const ironCost = atMax ? 0 : info.cost.iron * nextLevel;
                    const fuelCost = atMax ? 0 : info.cost.fuel * nextLevel;
                    const canAfford = player ? player.iron >= ironCost && player.fuel >= fuelCost : false;
                    return (
                      <div key={type} className="rounded-md border border-border/60 p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-display uppercase tracking-wide">{info.name}</span>
                            {currentLevel > 0 && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-mono">
                                Lv{currentLevel}
                              </Badge>
                            )}
                          </div>
                          {atMax && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">MAX</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">{info.effect}</p>
                        {!atMax && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onBuild(type)}
                            disabled={isUpgrading || !canAfford}
                            className="w-full justify-between font-display uppercase tracking-wide text-[10px] h-7"
                            data-testid={`button-build-${type}`}
                          >
                            <span>{currentLevel === 0 ? "Build" : `Upgrade → Lv${nextLevel}`}</span>
                            <span className={cn("font-mono flex items-center gap-1", !canAfford && "text-destructive")}>
                              {ironCost} <Pickaxe className="w-3 h-3 inline text-iron" />
                              {fuelCost} <Fuel className="w-3 h-3 inline text-fuel" />
                            </span>
                          </Button>
                        )}
                      </div>
                    );
                  })}

                  {/* Economic facilities */}
                  <p className="text-[10px] font-display uppercase tracking-widest text-muted-foreground px-0.5 pt-1">
                    Facilities
                  </p>
                  {(Object.keys(FACILITY_INFO) as FacilityType[]).map((type) => {
                    const info = FACILITY_INFO[type];
                    const existing = parcel.improvements.find(i => i.type === type);
                    const currentLevel = existing?.level ?? 0;
                    const nextLevel = currentLevel + 1;
                    const atMax = currentLevel >= info.maxLevel;
                    const hasPrereq = !info.prerequisite || parcel.improvements.some(i => i.type === info.prerequisite);
                    const frontierCost = atMax ? 0 : info.costFrontier[currentLevel] ?? 0;
                    const canAffordFrontier = player ? (player.frontier ?? 0) >= frontierCost : false;
                    return (
                      <div key={type} className="rounded-md border border-border/60 p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-display uppercase tracking-wide">{info.name}</span>
                            {currentLevel > 0 && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-mono">
                                Lv{currentLevel}
                              </Badge>
                            )}
                          </div>
                          {atMax && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">MAX</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">{info.effect}</p>
                        {!hasPrereq && (
                          <p className="text-[9px] text-yellow-500/80">
                            Requires {FACILITY_INFO[info.prerequisite!].name} first
                          </p>
                        )}
                        {!atMax && hasPrereq && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onBuild(type)}
                            disabled={isUpgrading || !canAffordFrontier}
                            className="w-full justify-between font-display uppercase tracking-wide text-[10px] h-7"
                            data-testid={`button-build-facility-${type}`}
                          >
                            <span>{currentLevel === 0 ? "Build" : `Upgrade → Lv${nextLevel}`}</span>
                            <span className={cn("font-mono text-cyan-400 flex items-center gap-1", !canAffordFrontier && "text-destructive")}>
                              {frontierCost} FRNTR
                            </span>
                          </Button>
                        )}
                        {!atMax && !hasPrereq && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled
                            className="w-full justify-between font-display uppercase tracking-wide text-[10px] h-7 opacity-40"
                          >
                            <span>{currentLevel === 0 ? "Build" : `Upgrade → Lv${nextLevel}`}</span>
                            <span className="font-mono text-cyan-400">{frontierCost} FRNTR</span>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </>
        )}

        {isEnemy && player && (
          <Button
            onClick={onAttack}
            variant="destructive"
            className="w-full font-display uppercase tracking-wide"
            data-testid="button-attack"
          >
            <Swords className="w-4 h-4 mr-2" />
            Deploy Attack
          </Button>
        )}

        {!parcel.ownerId && player && (
          <Button
            onClick={onAttack}
            className="w-full font-display uppercase tracking-wide"
            data-testid="button-claim"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Claim Territory
          </Button>
        )}

        {parcel.activeBattleId && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
            <div className="flex items-center gap-2 text-destructive">
              <Swords className="w-4 h-4 animate-pulse" />
              <span className="font-display uppercase tracking-wide text-sm">Active Battle</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
