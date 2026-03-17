import { Map, Package, Swords, Trophy, Shield, BarChart3, Radar, MoreHorizontal, ArrowLeftRight, Flag, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export type NavTab = "map" | "inventory" | "battles" | "leaderboard" | "commander" | "economics" | "intel" | "trade" | "factions" | "markets";

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  battleCount?: number;
}

const PRIMARY_TABS: { id: NavTab; label: string; icon: React.ElementType }[] = [
  { id: "map",       label: "Map",       icon: Map     },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "intel",     label: "Intel",     icon: Radar   },
  { id: "commander", label: "Commander", icon: Shield  },
];

const OVERFLOW_TABS: { id: NavTab; label: string; icon: React.ElementType }[] = [
  { id: "battles",     label: "Battles",   icon: Swords        },
  { id: "factions",    label: "Factions",  icon: Flag          },
  { id: "leaderboard", label: "Rankings",  icon: Trophy        },
  { id: "economics",   label: "Economics", icon: BarChart3     },
  { id: "trade",       label: "Trade",     icon: ArrowLeftRight },
  { id: "markets",     label: "Markets",   icon: TrendingUp    },
];

export function BottomNav({ activeTab, onTabChange, battleCount }: BottomNavProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowActive = OVERFLOW_TABS.some(t => t.id === activeTab);

  const renderTab = (tab: { id: NavTab; label: string; icon: React.ElementType }, inSheet = false) => {
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        onClick={() => {
          onTabChange(tab.id);
          if (inSheet) setOverflowOpen(false);
        }}
        className={cn(
          inSheet
            ? "flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors text-left"
            : "flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors",
          isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
        )}
        data-testid={`nav-tab-${tab.id}`}
      >
        {!inSheet && isActive && (
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
        <span className={cn(
          "font-display uppercase tracking-wider",
          inSheet ? "text-sm" : "text-[10px]"
        )}>
          {tab.label}
        </span>
      </button>
    );
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-card/95 border-t border-border"
      data-testid="bottom-nav"
    >
      <div className="flex items-center h-16">
        {PRIMARY_TABS.map(tab => renderTab(tab))}

        {/* More overflow button */}
        <Sheet open={overflowOpen} onOpenChange={setOverflowOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors",
                overflowActive ? "text-primary" : "text-muted-foreground"
              )}
              data-testid="nav-tab-more"
            >
              {overflowActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-display uppercase tracking-wider">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-8">
            <VisuallyHidden>
              <SheetTitle>More Options</SheetTitle>
            </VisuallyHidden>
            <div className="flex flex-col gap-1 pt-2">
              {OVERFLOW_TABS.map(tab => renderTab(tab, true))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
