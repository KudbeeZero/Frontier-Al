import { Swords, Clock, User, Bot, ChevronRight, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Battle, GameEvent, Player } from "@shared/schema";
import { BATTLE_DURATION_MS } from "@shared/schema";

interface WarRoomPanelProps {
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
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div
      className={cn(
        "p-4 border border-border rounded-md space-y-3",
        battle.status === "pending" ? "bg-destructive/5 border-destructive/30" : "bg-card"
      )}
      data-testid={`battle-card-${battle.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className={cn(
            "w-4 h-4",
            battle.status === "pending" ? "text-destructive animate-pulse" : "text-muted-foreground"
          )} />
          <span className="font-display text-sm uppercase tracking-wide">
            Battle #{battle.id.slice(0, 6)}
          </span>
        </div>
        <Badge variant={battle.status === "pending" ? "destructive" : "secondary"} className="text-xs">
          {battle.status === "pending" ? "IN PROGRESS" : battle.outcome === "attacker_wins" ? "ATTACKER WON" : "DEFENDER WON"}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {attacker?.isAI ? <Bot className="w-3 h-3 text-muted-foreground" /> : <User className="w-3 h-3 text-muted-foreground" />}
          <span className="font-mono">{attacker?.name || "Unknown"}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <div className="flex items-center gap-2">
          <span className="font-mono">{defender?.name || "Unclaimed"}</span>
          {defender?.isAI ? <Bot className="w-3 h-3 text-muted-foreground" /> : <User className="w-3 h-3 text-muted-foreground" />}
        </div>
      </div>

      {battle.status === "pending" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Resolution in</span>
            <span className="font-mono">{formatTime(remaining)}</span>
          </div>
          <Progress value={progress} className="h-1" />
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Power: <span className="font-mono text-foreground">{battle.attackerPower}</span> vs <span className="font-mono text-foreground">{battle.defenderPower}</span>
        </span>
        <span className="text-muted-foreground">
          Target: <span className="font-mono text-foreground">{battle.targetParcelId.slice(0, 8)}</span>
        </span>
      </div>
    </div>
  );
}

function EventItem({ event }: { event: GameEvent }) {
  const getIcon = () => {
    switch (event.type) {
      case "mine": return <div className="w-2 h-2 rounded-full bg-iron" />;
      case "upgrade": return <div className="w-2 h-2 rounded-full bg-fuel" />;
      case "attack": return <div className="w-2 h-2 rounded-full bg-destructive" />;
      case "battle_resolved": return <CheckCircle2 className="w-3 h-3 text-success" />;
      case "ai_action": return <Bot className="w-3 h-3 text-muted-foreground" />;
      default: return <div className="w-2 h-2 rounded-full bg-muted" />;
    }
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0" data-testid={`event-item-${event.id}`}>
      <div className="mt-1">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground" data-testid="text-event-description">{event.description}</p>
        <p className="text-xs text-muted-foreground font-mono" data-testid="text-event-time">{formatTime(event.timestamp)}</p>
      </div>
    </div>
  );
}

function AIActivityFeed({ players, events }: { players: Player[]; events: GameEvent[] }) {
  const aiPlayers = players.filter((p) => p.isAI);
  const aiEvents = events.filter((e) => e.type === "ai_action").slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {aiPlayers.slice(0, 4).map((ai) => (
          <div
            key={ai.id}
            className="p-3 border border-border rounded-md"
            data-testid={`ai-player-${ai.id}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-muted-foreground" />
              <span className="font-display text-sm uppercase tracking-wide truncate">{ai.name}</span>
            </div>
            <Badge variant="outline" className="text-xs capitalize">
              {ai.aiBehavior || "adaptive"}
            </Badge>
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="font-mono">{ai.ownedParcels.length}</span> territories
            </div>
          </div>
        ))}
      </div>

      {aiEvents.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase font-display tracking-wide">Recent AI Activity</p>
          {aiEvents.map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

export function WarRoomPanel({ battles, events, players, className }: WarRoomPanelProps) {
  const activeBattles = battles.filter((b) => b.status === "pending");
  const recentBattles = battles.filter((b) => b.status === "resolved").slice(0, 5);
  const recentEvents = events.slice(0, 15);

  return (
    <div className={cn(
      "backdrop-blur-md bg-card/80 border border-card-border rounded-md overflow-hidden flex flex-col",
      className
    )} data-testid="panel-war-room">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">War Room</h2>
          {activeBattles.length > 0 && (
            <Badge variant="destructive" className="ml-auto animate-pulse">
              {activeBattles.length} Active
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="battles" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-border p-0 h-auto bg-transparent">
          <TabsTrigger
            value="battles"
            className="font-display uppercase tracking-wide text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
          >
            Battles
          </TabsTrigger>
          <TabsTrigger
            value="events"
            className="font-display uppercase tracking-wide text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
          >
            Events
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="font-display uppercase tracking-wide text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
          >
            AI Factions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="battles" className="flex-1 m-0 p-0">
          <ScrollArea className="h-full max-h-[400px]">
            <div className="p-4 space-y-3">
              {activeBattles.length === 0 && recentBattles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-display uppercase tracking-wide">No Active Battles</p>
                </div>
              ) : (
                <>
                  {activeBattles.map((battle) => (
                    <BattleCard key={battle.id} battle={battle} players={players} />
                  ))}
                  {recentBattles.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground uppercase font-display tracking-wide pt-2">Recent</p>
                      {recentBattles.map((battle) => (
                        <BattleCard key={battle.id} battle={battle} players={players} />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="events" className="flex-1 m-0 p-0">
          <ScrollArea className="h-full max-h-[400px]">
            <div className="p-4">
              {recentEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-display uppercase tracking-wide">No Events Yet</p>
                </div>
              ) : (
                recentEvents.map((event) => (
                  <EventItem key={event.id} event={event} />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ai" className="flex-1 m-0 p-0">
          <ScrollArea className="h-full max-h-[400px]">
            <div className="p-4">
              <AIActivityFeed players={players} events={events} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
