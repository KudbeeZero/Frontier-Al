import { Pickaxe, Fuel, Gem, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ResourceHUDProps {
  iron: number;
  fuel: number;
  crystal: number;
  algoBalance: number;
  className?: string;
}

function ResourceItem({
  icon: Icon,
  label,
  value,
  maxValue,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  maxValue?: number;
  colorClass: string;
}) {
  const percentage = maxValue ? (value / maxValue) * 100 : undefined;
  
  return (
    <div className="flex items-center gap-3 min-w-[140px]">
      <div className={cn("p-2 rounded-md", colorClass)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-display">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold tabular-nums">
            {value.toLocaleString()}
          </span>
          {percentage !== undefined && (
            <Progress value={percentage} className="h-1 flex-1 bg-muted" />
          )}
        </div>
      </div>
    </div>
  );
}

export function ResourceHUD({ iron, fuel, crystal, algoBalance, className }: ResourceHUDProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-6 px-6 py-3 backdrop-blur-md bg-card/80 border border-card-border rounded-md",
        className
      )}
      data-testid="resource-hud"
    >
      <ResourceItem
        icon={Pickaxe}
        label="Iron"
        value={iron}
        colorClass="bg-iron/20 text-iron"
      />
      <ResourceItem
        icon={Fuel}
        label="Fuel"
        value={fuel}
        colorClass="bg-fuel/20 text-fuel"
      />
      <ResourceItem
        icon={Gem}
        label="Crystal"
        value={crystal}
        colorClass="bg-crystal/20 text-crystal"
      />
      <div className="w-px h-8 bg-border" />
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-primary/20 text-primary">
          <Wallet className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-display">
            ALGO
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {algoBalance.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
