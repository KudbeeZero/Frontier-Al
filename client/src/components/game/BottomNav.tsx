import { Map, Package, Swords, Trophy, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavTab = "map" | "inventory" | "battles" | "leaderboard" | "rules";

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  battleCount?: number;
}

const tabs: { id: NavTab; label: string; icon: React.ElementType }[] = [
  { id: "map", label: "Map", icon: Map },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "battles", label: "Battles", icon: Swords },
  { id: "leaderboard", label: "Rankings", icon: Trophy },
  { id: "rules", label: "Rules", icon: BookOpen },
];

export function BottomNav({ activeTab, onTabChange, battleCount }: BottomNavProps) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-card/95 border-t border-border"
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-full h-full relative transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={`nav-tab-${tab.id}`}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <div className="relative">
                <tab.icon className="w-5 h-5" />
                {tab.id === "battles" && battleCount && battleCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] bg-destructive text-destructive-foreground text-[9px] font-mono font-bold rounded-full flex items-center justify-center px-0.5">
                    {battleCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-display uppercase tracking-wider">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
