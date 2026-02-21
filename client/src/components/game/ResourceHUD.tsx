import { Pickaxe, Fuel, Gem, Wallet, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResourceHUDProps {
  iron: number;
  fuel: number;
  crystal: number;
  frontier: number;
  algoBalance: number;
  frontierDailyRate?: number;
  frontierPending?: number;
  className?: string;
}

function ResourceItem({
  icon: Icon,
  label,
  value,
  colorClass,
  testId,
  decimals,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  colorClass: string;
  testId: string;
  decimals?: number;
}) {
  return (
    <div className="flex items-center gap-2" data-testid={`resource-${testId}`}>
      <div className={cn("p-1.5 sm:p-2 rounded-md", colorClass)}>
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] sm:text-xs uppercase tracking-wide text-muted-foreground font-display hidden sm:block">
          {label}
        </span>
        <span className="font-mono text-xs sm:text-sm font-semibold tabular-nums" data-testid={`text-${testId}-value`}>
          {decimals !== undefined ? value.toFixed(decimals) : value.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export function ResourceHUD({ iron, fuel, crystal, frontier, algoBalance, frontierDailyRate, frontierPending, className }: ResourceHUDProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 sm:gap-5 px-3 sm:px-5 py-2 sm:py-2.5 backdrop-blur-md bg-card/90 border border-card-border rounded-md shadow-lg",
        className
      )}
      data-testid="resource-hud"
    >
      <ResourceItem
        icon={Pickaxe}
        label="Iron"
        value={iron}
        colorClass="bg-iron/20 text-iron"
        testId="iron"
      />
      <ResourceItem
        icon={Fuel}
        label="Fuel"
        value={fuel}
        colorClass="bg-fuel/20 text-fuel"
        testId="fuel"
      />
      <ResourceItem
        icon={Gem}
        label="Crystal"
        value={crystal}
        colorClass="bg-crystal/20 text-crystal"
        testId="crystal"
      />
      {/* FRNTR balance with daily rate indicator */}
      <div className="flex items-center gap-2" data-testid="resource-frontier">
        <div className="p-1.5 sm:p-2 rounded-md bg-primary/20 text-primary">
          <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] sm:text-xs uppercase tracking-wide text-muted-foreground font-display hidden sm:block">
            FRNTR
          </span>
          <span className="font-mono text-xs sm:text-sm font-semibold tabular-nums" data-testid="text-frontier-value">
            {frontier.toFixed(1)}
          </span>
          {frontierDailyRate !== undefined && frontierDailyRate > 0 && (
            <span className="text-[8px] text-primary/70 font-mono tabular-nums flex items-center gap-0.5 hidden sm:flex" data-testid="text-frontier-rate">
              <TrendingUp className="w-2.5 h-2.5" />
              {frontierDailyRate.toFixed(1)}/day
              {frontierPending !== undefined && frontierPending > 0.01 && (
                <span className="text-yellow-400 ml-1">({frontierPending.toFixed(1)} pending)</span>
              )}
            </span>
          )}
        </div>
      </div>
      <div className="w-px h-6 sm:h-8 bg-border hidden sm:block" />
      <div className="flex items-center gap-2" data-testid="resource-algo">
        <div className="p-1.5 sm:p-2 rounded-md bg-primary/20 text-primary">
          <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] sm:text-xs uppercase tracking-wide text-muted-foreground font-display hidden sm:block">
            ALGO
          </span>
          <span className="font-mono text-xs sm:text-sm font-semibold tabular-nums" data-testid="text-algo-value">
            {algoBalance.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
