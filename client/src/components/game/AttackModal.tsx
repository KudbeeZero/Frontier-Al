import { useState } from "react";
import { Swords, Pickaxe, Fuel, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LandParcel, Player } from "@shared/schema";
import { ATTACK_BASE_COST, biomeBonuses } from "@shared/schema";

interface AttackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetParcel: LandParcel | null;
  attacker: Player | null;
  onAttack: (troops: number, iron: number, fuel: number) => void;
  isAttacking: boolean;
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

  if (!targetParcel || !attacker) return null;

  const baseCost = {
    iron: ATTACK_BASE_COST.iron * troops,
    fuel: ATTACK_BASE_COST.fuel * troops,
  };

  const totalCost = {
    iron: baseCost.iron + extraIron,
    fuel: baseCost.fuel + extraFuel,
  };

  const canAfford = attacker.iron >= totalCost.iron && attacker.fuel >= totalCost.fuel;
  const maxTroops = Math.min(
    10,
    Math.floor(attacker.iron / ATTACK_BASE_COST.iron),
    Math.floor(attacker.fuel / ATTACK_BASE_COST.fuel)
  );

  const attackerPower = troops * 10 + extraIron * 0.5 + extraFuel * 0.8;
  const defenderPower = targetParcel.defenseLevel * 15 * biomeBonuses[targetParcel.biome].defenseMod;
  const winChance = Math.min(95, Math.max(5, (attackerPower / (attackerPower + defenderPower)) * 100));

  const handleSubmit = () => {
    onAttack(troops, totalCost.iron, totalCost.fuel);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md backdrop-blur-md" data-testid="modal-attack">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase tracking-wide flex items-center gap-2">
            <Swords className="w-5 h-5 text-destructive" />
            Deploy Attack
          </DialogTitle>
          <DialogDescription>
            Target: Plot #{targetParcel.plotId} ({targetParcel.biome})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-display text-sm uppercase tracking-wide">Combat Warning</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Battle will resolve in 4 hours. Resources are consumed immediately.
              Outcome is probabilistic based on power levels.
            </p>
          </div>

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
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-card border border-border rounded-md">
            <div data-testid="display-attacker-power">
              <p className="text-xs text-muted-foreground uppercase font-display tracking-wide mb-1">Your Power</p>
              <p className="font-mono text-2xl font-bold text-primary" data-testid="text-attacker-power">{Math.round(attackerPower)}</p>
            </div>
            <div data-testid="display-defender-power">
              <p className="text-xs text-muted-foreground uppercase font-display tracking-wide mb-1">Defender Power</p>
              <p className="font-mono text-2xl font-bold text-destructive" data-testid="text-defender-power">{Math.round(defenderPower)}</p>
            </div>
          </div>

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

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-display uppercase tracking-wide">Total Cost</span>
            <div className="flex items-center gap-3">
              <span className={cn("font-mono flex items-center gap-1", !canAfford && "text-destructive")}>
                <Pickaxe className="w-3 h-3 text-iron" /> {totalCost.iron}
              </span>
              <span className={cn("font-mono flex items-center gap-1", !canAfford && "text-destructive")}>
                <Fuel className="w-3 h-3 text-fuel" /> {totalCost.fuel}
              </span>
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
