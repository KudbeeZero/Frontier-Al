import { Trophy, User, Bot, Shield, Pickaxe, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@shared/schema";

interface LeaderboardPanelProps {
  entries: LeaderboardEntry[];
  currentPlayerId: string | null;
  className?: string;
}

function LeaderboardRow({ entry, rank, isSelf }: { entry: LeaderboardEntry; rank: number; isSelf: boolean }) {
  const truncAddr = entry.address.length > 12 ? entry.address.slice(0, 6) + "..." + entry.address.slice(-4) : entry.address;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 border-b border-border/30 last:border-0",
        isSelf && "bg-primary/5"
      )}
      data-testid={`leaderboard-row-${entry.playerId}`}
    >
      <div className={cn(
        "w-8 h-8 rounded-md flex items-center justify-center font-mono text-sm font-bold shrink-0",
        rank === 1 ? "bg-yellow-500/20 text-yellow-500" :
        rank === 2 ? "bg-gray-400/20 text-gray-400" :
        rank === 3 ? "bg-amber-700/20 text-amber-700" :
        "bg-muted text-muted-foreground"
      )}>
        #{rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {entry.isAI ? <Bot className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="font-display text-sm font-bold uppercase tracking-wide truncate" data-testid={`text-player-name-${entry.playerId}`}>
            {entry.name}
          </span>
          {isSelf && <Badge variant="outline" className="text-[9px] text-primary border-primary/30">YOU</Badge>}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{truncAddr}</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-center">
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-primary" />
            <span className="font-mono text-xs font-bold">{entry.territories}</span>
          </div>
          <span className="text-[9px] text-muted-foreground">Land</span>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1">
            <Pickaxe className="w-3 h-3 text-iron" />
            <span className="font-mono text-xs font-bold">{entry.totalIronMined}</span>
          </div>
          <span className="text-[9px] text-muted-foreground">Mined</span>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1">
            <Swords className="w-3 h-3 text-destructive" />
            <span className="font-mono text-xs">{entry.attacksWon}/{entry.attacksWon + entry.attacksLost}</span>
          </div>
          <span className="text-[9px] text-muted-foreground">W/L</span>
        </div>
      </div>
    </div>
  );
}

export function LeaderboardPanel({ entries, currentPlayerId, className }: LeaderboardPanelProps) {
  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="leaderboard-panel">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Trophy className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">Leaderboard</h2>
        <Badge variant="secondary" className="ml-auto text-[10px] font-mono">{entries.length} players</Badge>
      </div>

      <ScrollArea className="flex-1">
        <div>
          {entries.map((entry, i) => (
            <LeaderboardRow
              key={entry.playerId}
              entry={entry}
              rank={i + 1}
              isSelf={entry.playerId === currentPlayerId}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
