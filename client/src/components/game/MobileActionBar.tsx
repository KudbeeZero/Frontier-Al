import { Pickaxe, Shield, Swords, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LandParcel, Player } from "@shared/schema";
import { biomeColors } from "@shared/schema";

interface MobileActionBarProps {
  parcel: LandParcel | null;
  player: Player | null;
  onMine: () => void;
  onUpgrade: () => void;
  onAttack: () => void;
  onClose: () => void;
  isMining: boolean;
  isUpgrading: boolean;
  className?: string;
}

export function MobileActionBar({
  parcel,
  player,
  onMine,
  onUpgrade,
  onAttack,
  onClose,
  isMining,
  isUpgrading,
  className,
}: MobileActionBarProps) {
  if (!parcel) return null;

  const isOwned = parcel.ownerId === player?.id;
  const isEnemyOwned = parcel.ownerId && parcel.ownerId !== player?.id;
  const canMine = isOwned && !parcel.activeBattleId;
  const canUpgrade = isOwned && !parcel.activeBattleId;
  const canAttack = !isOwned && player && parcel.biome !== "water";

  return (
    <div
      className={cn(
        "lg:hidden fixed bottom-0 left-0 right-0 z-30 p-3 backdrop-blur-lg bg-card/95 border-t border-card-border shadow-lg",
        className
      )}
      data-testid="mobile-action-bar"
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center"
          style={{ backgroundColor: biomeColors[parcel.biome] + "40" }}
        >
          <MapPin className="w-4 h-4" style={{ color: biomeColors[parcel.biome] }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm uppercase tracking-wide truncate">
              Sector {parcel.q},{parcel.r}
            </span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {parcel.biome}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Defense: {parcel.defenseLevel}</span>
            <span>Richness: {parcel.richness}%</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="shrink-0"
          data-testid="button-close-mobile-bar"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex gap-2">
        {canMine && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onMine}
            disabled={isMining}
            className="flex-1 font-display uppercase tracking-wide"
            data-testid="button-mobile-mine"
          >
            <Pickaxe className="w-4 h-4 mr-1.5" />
            {isMining ? "Mining..." : "Mine"}
          </Button>
        )}
        {canUpgrade && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onUpgrade}
            disabled={isUpgrading}
            className="flex-1 font-display uppercase tracking-wide"
            data-testid="button-mobile-upgrade"
          >
            <Shield className="w-4 h-4 mr-1.5" />
            {isUpgrading ? "..." : "Upgrade"}
          </Button>
        )}
        {canAttack && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onAttack}
            className="flex-1 font-display uppercase tracking-wide"
            data-testid="button-mobile-attack"
          >
            <Swords className="w-4 h-4 mr-1.5" />
            Attack
          </Button>
        )}
        {!isOwned && !canAttack && parcel.biome === "water" && (
          <div className="flex-1 text-center text-sm text-muted-foreground py-2">
            Water tiles cannot be attacked
          </div>
        )}
        {isOwned && (
          <Badge variant="outline" className="self-center px-3 py-1 text-primary border-primary/30">
            Your Territory
          </Badge>
        )}
        {isEnemyOwned && (
          <Badge variant="outline" className="self-center px-3 py-1 text-destructive border-destructive/30">
            Enemy Territory
          </Badge>
        )}
      </div>
    </div>
  );
}
