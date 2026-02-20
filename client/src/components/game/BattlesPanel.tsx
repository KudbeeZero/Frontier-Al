import { Swords, Clock, User, Bot, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Battle, GameEvent, Player } from "@shared/schema";

interface BattlesPanelProps {
  battles: Battle[];
  events: GameEvent[];
  players: Player[];
  className?: string;
}

function BattleCard({ battle, players }: { battle: Battle; players: Player[] }) {
  const attacker = players.find((p) => p.id === battle.attackerId);
  const defender = players.find((p) => p.id === battle.defenderId);
  const now = Date.now();
  const elapsed = now - battle.startTs;
  const totalDuration = battle.resolveTs - battle.startTs;
  const progress = Math.min(100, (elapsed / totalDuration) * 100);
  const remaining = Math.max(0, battle.resolveTs - now);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div
      className={cn(
        "p-3 border border-border rounded-md space-y-2",
        battle.status === "pending" ? "bg-destructive/5 border-destructive/20" : "bg-card"
      )}
      data-testid={`battle-card-${battle.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className={cn(
            "w-4 h-4",
            battle.status === "pending" ? "text-destructive animate-pulse" : "text-muted-foreground"
          )} />
          <span className="font-display text-xs uppercase tracking-wide">#{battle.id.slice(0, 6)}</span>
        </div>
        <Badge
          variant={battle.status === "pending" ? "destructive" : battle.outcome === "attacker_wins" ? "default" : "secondary"}
          className="text-[10px]"
        >
          {battle.status === "pending" ? "LIVE" : battle.outcome === "attacker_wins" ? "WON" : "LOST"}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          {attacker?.isAI ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
          <span className="font-mono truncate max-w-[80px]">{attacker?.name || "?"}</span>
        </div>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
        <div className="flex items-center gap-1.5">
          <span className="font-mono truncate max-w-[80px]">{defender?.name || "Unclaimed"}</span>
          {defender?.isAI ? <Bot className="w-3 h-3" /> : defender ? <User className="w-3 h-3" /> : null}
        </div>
      </div>

      {battle.status === "pending" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Resolves in</span>
            <span className="font-mono">{formatTime(remaining)}</span>
          </div>
          <Progress value={progress} className="h-1" />
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>ATK <span className="font-mono text-foreground">{Math.round(battle.attackerPower)}</span></span>
        <span>DEF <span className="font-mono text-foreground">{Math.round(battle.defenderPower)}</span></span>
      </div>
    </div>
  );
}

function EventItem({ event }: { event: GameEvent }) {
  const icon = (() => {
    switch (event.type) {
      case "mine": return <div className="w-2 h-2 rounded-full bg-iron" />;
      case "upgrade": return <div className="w-2 h-2 rounded-full bg-fuel" />;
      case "build": return <div className="w-2 h-2 rounded-full bg-primary" />;
      case "purchase": return <div className="w-2 h-2 rounded-full bg-primary" />;
      case "attack": return <div className="w-2 h-2 rounded-full bg-destructive" />;
      case "battle_resolved": return <CheckCircle2 className="w-3 h-3 text-primary" />;
      case "ai_action": return <Bot className="w-3 h-3 text-muted-foreground" />;
      default: return <div className="w-2 h-2 rounded-full bg-muted" />;
    }
  })();

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex items-start gap-2.5 py-1.5 border-b border-border/20 last:border-0" data-testid={`event-${event.id}`}>
      <div className="mt-1.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground leading-tight">{event.description}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{formatTime(event.timestamp)}</p>
      </div>
    </div>
  );
}

export function BattlesPanel({ battles, events, players, className }: BattlesPanelProps) {
  const activeBattles = battles.filter((b) => b.status === "pending");
  const recentBattles = battles.filter((b) => b.status === "resolved").slice(0, 10);
  const battleEvents = events.filter(e => ["attack", "battle_resolved"].includes(e.type)).slice(0, 20);

  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="battles-panel">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Swords className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">Battles</h2>
        {activeBattles.length > 0 && (
          <Badge variant="destructive" className="ml-auto animate-pulse text-[10px]">
            {activeBattles.length} Active
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {activeBattles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-display uppercase tracking-wide text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Active Battles
              </h3>
              {activeBattles.map((b) => <BattleCard key={b.id} battle={b} players={players} />)}
            </div>
          )}

          {recentBattles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-display uppercase tracking-wide text-muted-foreground">Recent Battles</h3>
              {recentBattles.map((b) => <BattleCard key={b.id} battle={b} players={players} />)}
            </div>
          )}

          {battleEvents.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-[10px] font-display uppercase tracking-wide text-muted-foreground">Battle Log</h3>
              {battleEvents.map((e) => <EventItem key={e.id} event={e} />)}
            </div>
          )}

          {activeBattles.length === 0 && recentBattles.length === 0 && battleEvents.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Swords className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-display uppercase tracking-wide text-sm">No Battles Yet</p>
              <p className="text-xs mt-1">Attack enemy territory to start a battle</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
