import { Shield, Pickaxe, Fuel, MapPin, Clock, Swords, Hammer, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LandParcel, Player } from "@shared/schema";
import { biomeColors, biomeBonuses, MINE_COOLDOWN_MS, UPGRADE_COSTS } from "@shared/schema";

interface BaseInfoPanelProps {
  parcel: LandParcel | null;
  player: Player | null;
  onMine: () => void;
  onUpgrade: (type: string) => void;
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
            <h2 className="font-display text-xl font-bold uppercase tracking-wide" data-testid="text-sector-coords">
              Sector {parcel.q},{parcel.r}
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
          <StatRow icon={Pickaxe} label="Yield Bonus" value={`+${Math.round((biomeBonus.yieldMod - 1) * 100)}%`} testId="stat-yield-bonus" />
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
                    Upgrade Base
                    {upgradeOpen ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {Object.entries(UPGRADE_COSTS).map(([type, cost]) => (
                    <Button
                      key={type}
                      variant="secondary"
                      size="sm"
                      onClick={() => onUpgrade(type)}
                      disabled={isUpgrading || (player && (player.iron < cost.iron || player.fuel < cost.fuel))}
                      className="w-full justify-between font-display uppercase tracking-wide text-xs"
                      data-testid={`button-upgrade-${type}`}
                    >
                      <span className="capitalize">{type}</span>
                      <span className="font-mono text-muted-foreground">
                        {cost.iron} <Pickaxe className="w-3 h-3 inline text-iron" /> {cost.fuel} <Fuel className="w-3 h-3 inline text-fuel" />
                      </span>
                    </Button>
                  ))}
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
