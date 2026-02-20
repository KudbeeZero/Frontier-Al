import { useState } from "react";
import { ChevronRight, MapPin, Pickaxe, Swords, Shield, ShoppingCart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingFlowProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: MapPin,
    title: "WELCOME TO FRONTIER",
    subtitle: "Algorand TestNet Strategy Game",
    description: "Compete against AI factions for territory, resources, and dominance on the blockchain. Every action matters.",
    color: "text-primary",
  },
  {
    icon: ShoppingCart,
    title: "CLAIM YOUR TERRITORY",
    subtitle: "Expand Your Empire",
    description: "Tap unclaimed tiles on the hex map to purchase them with Iron and Fuel. Different biomes offer unique bonuses to mining yield and defense.",
    color: "text-primary",
  },
  {
    icon: Pickaxe,
    title: "MINE RESOURCES",
    subtitle: "Iron, Fuel & Crystal",
    description: "Mine your territories every 5 minutes to extract resources. Resources are stored in tiles until you collect them to your wallet. Storage capacity limits how much each tile can hold.",
    color: "text-iron",
  },
  {
    icon: Shield,
    title: "BUILD & FORTIFY",
    subtitle: "Turrets, Shields & More",
    description: "Construct improvements on your land: turrets for defense, drills for yield, storage depots for capacity, and fortresses for maximum protection.",
    color: "text-fuel",
  },
  {
    icon: Swords,
    title: "ATTACK & CONQUER",
    subtitle: "PvP & PvE Combat",
    description: "Deploy troops against enemy or AI-controlled territory. Battles resolve in 10 minutes. Commit more resources for better odds. Conquered land becomes yours.",
    color: "text-destructive",
  },
  {
    icon: Package,
    title: "COLLECT & DOMINATE",
    subtitle: "Rise to the Top",
    description: "Use the Collect All button to gather resources from all your territories at once. Climb the leaderboard by controlling the most land and winning battles.",
    color: "text-crystal",
  },
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md" data-testid="onboarding-flow">
      <div className="max-w-sm w-full mx-4">
        <div className="flex justify-center mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full mx-1 transition-all",
                i === step ? "bg-primary w-6" : i < step ? "bg-primary/50" : "bg-muted"
              )}
            />
          ))}
        </div>

        <div className="text-center space-y-4">
          <div className={cn("w-16 h-16 rounded-lg mx-auto flex items-center justify-center bg-card border border-border", current.color)}>
            <current.icon className="w-8 h-8" />
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wider" data-testid="text-onboarding-title">
              {current.title}
            </h2>
            <p className="text-sm text-primary font-display uppercase tracking-wide mt-1">{current.subtitle}</p>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed px-2" data-testid="text-onboarding-description">
            {current.description}
          </p>
        </div>

        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="font-display uppercase tracking-wide"
              data-testid="button-onboarding-back"
            >
              Back
            </Button>
          )}
          <Button
            onClick={() => isLast ? onComplete() : setStep(step + 1)}
            className="flex-1 font-display uppercase tracking-wide"
            data-testid="button-onboarding-next"
          >
            {isLast ? "Start Playing" : "Next"}
            {!isLast && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>

        {!isLast && (
          <button
            onClick={onComplete}
            className="block w-full mt-3 text-xs text-muted-foreground font-display uppercase tracking-wide text-center"
            data-testid="button-onboarding-skip"
          >
            Skip Tutorial
          </button>
        )}
      </div>
    </div>
  );
}
