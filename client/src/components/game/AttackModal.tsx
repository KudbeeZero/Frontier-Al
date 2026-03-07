import { useState } from "react";
import { Swords, Pickaxe, Fuel, AlertTriangle, ChevronUp, ChevronDown, Clock, Shield, Zap, Skull, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { LandParcel, Player, CommanderAvatar } from "@shared/schema";
import { ATTACK_BASE_COST, BATTLE_DURATION_MS, biomeBonuses } from "@shared/schema";

interface AttackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetParcel: LandParcel | null;
  attacker: Player | null;
  onAttack: (troops: number, iron: number, fuel: number, crystal: number, commanderId?: string) => void;
  isAttacking: boolean;
}

const TIER_ICON = {
  sentinel: Shield,
  phantom: Zap,
  reaper: Skull,
};

const TIER_COLOR = {
  sentinel: "text-blue-400",
  phantom: "text-purple-400",
  reaper: "text-red-400",
};

const TIER_BORDER_SELECTED = {
  sentinel: "border-blue-400 bg-blue-400/10",
  phantom: "border-purple-400 bg-purple-400/10",
  reaper: "border-red-400 bg-red-400/10",
};

function isLocked(c: CommanderAvatar): boolean {
  return !!(c.lockedUntil && Date.now() < c.lockedUntil);
}

function lockRemaining(c: CommanderAvatar): string {
  if (!c.lockedUntil) return "";
  const ms = c.lockedUntil - Date.now();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function AttackModal({
  open,
  onOpenChange,
  targetParcel,
  attacker,
  onAttack,
  isAttacking,
}: AttackModalProps) {
  const [troops, setTroops] = useState(1);
  const [extraIron, setExtraIron] = useState(0);
  const [extraFuel, setExtraFuel] = useState(0);
  const [extraCrystal, setExtraCrystal] = useState(0);
  const [selectedCommanderId, setSelectedCommanderId] = useState<string | null>(null);

  if (!targetParcel || !attacker) return null;

  const commanders: CommanderAvatar[] = attacker.commanders ?? [];
  const selectedCommander = commanders.find((c) => c.id === selectedCommanderId) ?? null;
  const battleDurationMin = Math.round(BATTLE_DURATION_MS / 60000);

  const baseCost = {
    iron: ATTACK_BASE_COST.iron * troops,
    fuel: ATTACK_BASE_COST.fuel * troops,
  };

  const totalCost = {
    iron: baseCost.iron + extraIron,
    fuel: baseCost.fuel + extraFuel,
  };

  const canAfford = attacker.iron >= totalCost.iron && attacker.fuel >= totalCost.fuel && attacker.crystal >= extraCrystal;
  const maxTroops = Math.min(
    10,
    Math.floor(attacker.iron / ATTACK_BASE_COST.iron),
    Math.floor(attacker.fuel / ATTACK_BASE_COST.fuel)
  );

  const commanderBonus = selectedCommander?.attackBonus ?? 0;
  const attackerPower = troops * 10 + extraIron * 0.5 + extraFuel * 0.8 + extraCrystal * 1.2 + commanderBonus;
  const defenderPower = targetParcel.defenseLevel * 15 * biomeBonuses[targetParcel.biome].defenseMod;
  const winChance = Math.min(95, Math.max(5, (attackerPower / (attackerPower + defenderPower)) * 100));

  const handleSubmit = () => {
    onAttack(troops, totalCost.iron, totalCost.fuel, extraCrystal, selectedCommanderId ?? undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg backdrop-blur-md max-h-[90vh] overflow-y-auto" data-testid="modal-attack">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase tracking-wide flex items-center gap-2">
            <Swords className="w-5 h-5 text-destructive" />
            Deploy Attack
          </DialogTitle>
          <DialogDescription>
            Target: Plot #{targetParcel.plotId} ({targetParcel.biome})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Combat Warning */}
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
            <div className="flex items-center gap-2 text-destructive mb-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-display text-sm uppercase tracking-wide">Combat Warning</span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3 h-3 shrink-0" />
              Battle resolves in {battleDurationMin} minutes. Resources consumed immediately.
            </p>
          </div>

          {/* Commander Selection */}
          {commanders.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-display uppercase tracking-wide">Choose Commander</span>
                {selectedCommander && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    +{selectedCommander.attackBonus} ATK bonus
                  </Badge>
                )}
              </div>
              <div className="overflow-x-auto pb-1">
                <div className="flex gap-2 w-max">
                  {/* No Commander */}
                  <button
                    onClick={() => setSelectedCommanderId(null)}
                    className={cn(
                      "flex-shrink-0 w-[72px] h-24 rounded-md border-2 flex flex-col items-center justify-center gap-1 transition-colors",
                      !selectedCommanderId
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/20 hover:border-muted-foreground"
                    )}
                  >
                    <Swords className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[9px] font-display uppercase tracking-wide text-muted-foreground">No Cmd</span>
                  </button>

                  {commanders.map((c) => {
                    const locked = isLocked(c);
                    const selected = selectedCommanderId === c.id;
                    const Icon = TIER_ICON[c.tier];
                    return (
                      <button
                        key={c.id}
                        disabled={locked}
                        onClick={() => !locked && setSelectedCommanderId(selected ? null : c.id)}
                        className={cn(
                          "flex-shrink-0 w-[72px] h-24 rounded-md border-2 flex flex-col items-center justify-center gap-0.5 transition-colors relative px-1",
                          selected
                            ? TIER_BORDER_SELECTED[c.tier]
                            : locked
                            ? "border-border bg-muted/10 opacity-40 cursor-not-allowed"
                            : "border-border bg-muted/20 hover:border-primary/50"
                        )}
                      >
                        {locked && (
                          <Lock className="w-3 h-3 text-muted-foreground absolute top-1 right-1" />
                        )}
                        <Icon className={cn("w-5 h-5", TIER_COLOR[c.tier])} />
                        <span className="text-[9px] font-display uppercase tracking-wide leading-tight text-center line-clamp-1">
                          {c.name}
                        </span>
                        {locked ? (
                          <span className="text-[8px] text-destructive/70 font-mono">{lockRemaining(c)}</span>
                        ) : (
                          <span className="text-[8px] text-muted-foreground font-mono">+{c.attackBonus} ATK</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Troops */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-display uppercase tracking-wide">Troops</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setTroops(Math.max(1, troops - 1))}
                    disabled={troops <= 1}
                    data-testid="button-troops-decrease"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <span className="font-mono text-lg w-8 text-center">{troops}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setTroops(Math.min(maxTroops, troops + 1))}
                    disabled={troops >= maxTroops}
                    data-testid="button-troops-increase"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <Slider
                value={[troops]}
                onValueChange={([v]) => setTroops(v)}
                min={1}
                max={maxTroops}
                step={1}
                className="w-full"
                data-testid="slider-troops"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-display uppercase tracking-wide flex items-center gap-1">
                  <Pickaxe className="w-3 h-3 text-iron" /> Extra Iron
                </span>
                <span className="font-mono text-sm">{extraIron}</span>
              </div>
              <Slider
                value={[extraIron]}
                onValueChange={([v]) => setExtraIron(v)}
                min={0}
                max={Math.max(0, attacker.iron - baseCost.iron)}
                step={10}
                className="w-full"
                data-testid="slider-extra-iron"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-display uppercase tracking-wide flex items-center gap-1">
                  <Fuel className="w-3 h-3 text-fuel" /> Extra Fuel
                </span>
                <span className="font-mono text-sm">{extraFuel}</span>
              </div>
              <Slider
                value={[extraFuel]}
                onValueChange={([v]) => setExtraFuel(v)}
                min={0}
                max={Math.max(0, attacker.fuel - baseCost.fuel)}
                step={10}
                className="w-full"
                data-testid="slider-extra-fuel"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-display uppercase tracking-wide flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" />
                  Crystal Boost
                  <span className="text-[10px] text-muted-foreground normal-case font-normal">(×1.2 power)</span>
                </span>
                <span className="font-mono text-sm text-cyan-400">{extraCrystal}</span>
              </div>
              <Slider
                value={[extraCrystal]}
                onValueChange={([v]) => setExtraCrystal(v)}
                min={0}
                max={Math.max(0, attacker.crystal)}
                step={1}
                className="w-full"
                data-testid="slider-extra-crystal"
              />
              {attacker.crystal === 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">Mine volcanic parcels to acquire crystal.</p>
              )}
            </div>
          </div>

          {/* Power Display */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-card border border-border rounded-md">
            <div data-testid="display-attacker-power">
              <p className="text-xs text-muted-foreground uppercase font-display tracking-wide mb-1">Your Power</p>
              <p className="font-mono text-2xl font-bold text-primary" data-testid="text-attacker-power">
                {Math.round(attackerPower)}
              </p>
              {commanderBonus > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  incl. +{commanderBonus} from commander
                </p>
              )}
            </div>
            <div data-testid="display-defender-power">
              <p className="text-xs text-muted-foreground uppercase font-display tracking-wide mb-1">Defender Power</p>
              <p className="font-mono text-2xl font-bold text-destructive" data-testid="text-defender-power">
                {Math.round(defenderPower)}
              </p>
            </div>
          </div>

          {/* Win Chance */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-md" data-testid="display-win-chance">
            <span className="text-sm font-display uppercase tracking-wide">Win Chance</span>
            <Badge
              variant={winChance > 60 ? "default" : winChance > 40 ? "secondary" : "destructive"}
              className="font-mono text-lg px-3 py-1"
              data-testid="badge-win-chance"
            >
              {Math.round(winChance)}%
            </Badge>
          </div>

          {/* Total Cost */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-display uppercase tracking-wide">Total Cost</span>
            <div className="flex items-center gap-3">
              <span className={cn("font-mono flex items-center gap-1", !canAfford && "text-destructive")}>
                <Pickaxe className="w-3 h-3 text-iron" /> {totalCost.iron}
              </span>
              <span className={cn("font-mono flex items-center gap-1", !canAfford && "text-destructive")}>
                <Fuel className="w-3 h-3 text-fuel" /> {totalCost.fuel}
              </span>
              {extraCrystal > 0 && (
                <span className="font-mono flex items-center gap-1 text-cyan-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> {extraCrystal}
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="font-display uppercase tracking-wide"
            data-testid="button-attack-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canAfford || isAttacking}
            className="font-display uppercase tracking-wide"
            data-testid="button-attack-confirm"
          >
            <Swords className="w-4 h-4 mr-2" />
            {isAttacking ? "Deploying..." : "Deploy Attack"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
