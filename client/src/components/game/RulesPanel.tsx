import { BookOpen, Pickaxe, Shield, Swords, ShoppingCart, Hammer, Clock, Gem, Fuel, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface RulesPanelProps {
  className?: string;
}

function RuleSection({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">{title}</h3>
      </div>
      <div className="pl-6 text-xs text-muted-foreground space-y-1 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export function RulesPanel({ className }: RulesPanelProps) {
  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="rules-panel">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">How to Play</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          <RuleSection icon={ShoppingCart} title="Claim Land">
            <p>Tap unclaimed tiles on the map to buy them with Iron and Fuel. Prices depend on biome type and richness.</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <Badge variant="outline" className="text-[10px]">Plains: Cheapest</Badge>
              <Badge variant="outline" className="text-[10px]">Mountain: Expensive</Badge>
              <Badge variant="outline" className="text-[10px]">Water: Most Costly</Badge>
            </div>
          </RuleSection>

          <RuleSection icon={Pickaxe} title="Mining">
            <p>Mine your owned tiles to extract Iron, Fuel, and Crystal. Each tile has a 5-minute cooldown between mines.</p>
            <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> Cooldown: 5 minutes</p>
            <p>Resources are stored in the tile until you collect them.</p>
          </RuleSection>

          <RuleSection icon={Hammer} title="Build & Upgrade">
            <p>Construct improvements on your tiles:</p>
            <div className="space-y-1 mt-1">
              <p className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> <strong>Turret:</strong> +3 defense per level</p>
              <p className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> <strong>Shield Generator:</strong> +5 defense per level</p>
              <p className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> <strong>Mining Drill:</strong> +25% yield per level</p>
              <p className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> <strong>Storage Depot:</strong> +100 capacity per level</p>
              <p className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> <strong>Radar:</strong> See incoming attacks</p>
              <p className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> <strong>Fortress:</strong> +8 defense, +50 capacity</p>
            </div>
          </RuleSection>

          <RuleSection icon={Swords} title="Combat">
            <p>Attack enemy or AI-controlled tiles. Commit troops and resources to determine your attack power.</p>
            <p>Battles resolve in 10 minutes. Outcome depends on:</p>
            <div className="space-y-1 mt-1">
              <p className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> Your troops and resources committed</p>
              <p className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> Defender's defense level and improvements</p>
              <p className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> Biome defense bonuses</p>
              <p className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> Random variance factor</p>
            </div>
          </RuleSection>

          <RuleSection icon={Shield} title="Resources">
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px]"><Pickaxe className="w-3 h-3 mr-1 text-iron" /> Iron</Badge>
              <span>Primary resource for upgrades and attacks</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px]"><Fuel className="w-3 h-3 mr-1 text-fuel" /> Fuel</Badge>
              <span>Secondary resource for operations</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px]"><Gem className="w-3 h-3 mr-1 text-crystal" /> Crystal</Badge>
              <span>Rare resource from rich territories</span>
            </div>
          </RuleSection>

          <RuleSection icon={Gem} title="AI Factions">
            <p>Four AI factions compete for territory:</p>
            <div className="space-y-1 mt-1">
              <p><strong>NEXUS-7:</strong> Expansionist - aggressively claims new land</p>
              <p><strong>KRONOS:</strong> Defensive - fortifies existing territories</p>
              <p><strong>VANGUARD:</strong> Raider - attacks player and AI territory</p>
              <p><strong>SPECTRE:</strong> Economic - focuses on resource optimization</p>
            </div>
          </RuleSection>
        </div>
      </ScrollArea>
    </div>
  );
}
