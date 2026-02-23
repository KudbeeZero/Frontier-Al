import { useState, useEffect, useRef } from "react";
import { Swords, Shield, Zap, Skull, Crosshair, Target, Clock, Trophy, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Battle, Player, CommanderAvatar } from "@shared/schema";
import { COMMANDER_INFO } from "@shared/schema";

// ── Deterministic seeded event generation ─────────────────────────────────

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

interface BattleEvent {
  id: number;
  ts: number;
  text: string;
  side: "attacker" | "defender" | "neutral";
}

function generateEvents(
  battle: Battle,
  attackerName: string,
  defenderName: string,
  commanderTier?: string,
): BattleEvent[] {
  const attackerAhead = battle.attackerPower > battle.defenderPower;
  const duration = battle.resolveTs - battle.startTs;

  // Commander-flavored openers
  const commanderLine: Record<string, string> = {
    sentinel: `${attackerName}'s Sentinel establishes a fortified advance line`,
    phantom: `${attackerName}'s Phantom activates cloaking field — forces vanish from radar`,
    reaper: `${attackerName}'s Reaper triggers Annihilate protocol — all cannons open fire`,
  };

  const attackerPool = [
    commanderTier ? commanderLine[commanderTier] : null,
    `${attackerName} launches a missile barrage at the eastern wall`,
    `Armored column breaches the outer perimeter`,
    `Strike team advances under suppressive fire`,
    `${attackerName} hits the fuel depot — enemy supply lines cut`,
    `Forward operating base secured inside the defensive line`,
    `Iron stockpile targeted by precision artillery`,
    `Assault drones deployed over the contested zone`,
    `Alpha squad secures the north gate`,
    `${attackerName} calls in orbital targeting coordinates`,
  ].filter(Boolean) as string[];

  const defenderPool = [
    `Emergency bunkers reinforced along the perimeter`,
    `${defenderName}'s turret grid engages — incoming troops taking losses`,
    `Counter-strike repels the assault — attackers pushed back`,
    `Shield generator absorbs a direct hit`,
    `Reinforcements arrive — defensive line holds firm`,
    `Radar detects flanking maneuver — ambush prepared`,
    `${defenderName} seals the breach under fire`,
    `Anti-air battery lights up the drone swarm`,
    `${defenderName} activates fortress lockdown`,
  ];

  const neutralPool = [
    `Artillery exchange — heavy losses on both sides`,
    `Communication blackout — both commanders go dark`,
    `Smoke screen deployed — ground forces repositioning`,
    `Supply convoy ambushed — both sides short on fuel`,
    `Recon drone spotted — electronic warfare begins`,
    `Satellite feed disrupted — commanders flying blind`,
  ];

  const events: BattleEvent[] = [];
  let rng = hashCode(battle.id);

  const next = (): number => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng;
  };

  const NUM_EVENTS = 8;
  for (let i = 0; i < NUM_EVENTS; i++) {
    const r1 = next();
    const r2 = next();
    const r3 = next();
    const timeOffset = (duration / (NUM_EVENTS + 1)) * (i + 1);
    const ts = battle.startTs + timeOffset;

    const rand = r1 % 100;
    let side: BattleEvent["side"];
    let text: string;

    if (attackerAhead) {
      if (rand < 52) {
        side = "attacker";
        text = attackerPool[r2 % attackerPool.length];
      } else if (rand < 82) {
        side = "defender";
        text = defenderPool[r2 % defenderPool.length];
      } else {
        side = "neutral";
        text = neutralPool[r3 % neutralPool.length];
      }
    } else {
      if (rand < 52) {
        side = "defender";
        text = defenderPool[r2 % defenderPool.length];
      } else if (rand < 82) {
        side = "attacker";
        text = attackerPool[r2 % attackerPool.length];
      } else {
        side = "neutral";
        text = neutralPool[r3 % neutralPool.length];
      }
    }

    events.push({ id: i, ts, text, side });
  }

  return events;
}

// ── Component ──────────────────────────────────────────────────────────────

interface BattleWatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  battle: Battle | null;
  players: Player[];
}

export function BattleWatchModal({ open, onOpenChange, battle, players }: BattleWatchModalProps) {
  const [now, setNow] = useState(() => Date.now());
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!battle) return null;

  const attacker = players.find((p) => p.id === battle.attackerId);
  const defender = players.find((p) => p.id === battle.defenderId);
  const attackerName = attacker?.name ?? "Attacker";
  const defenderName = defender?.name ?? "Defender";

  // Find which commander was used
  const usedCommander: CommanderAvatar | undefined = battle.commanderId
    ? attacker?.commanders?.find((c) => c.id === battle.commanderId)
    : undefined;
  const commanderTier = usedCommander?.tier;

  const events = generateEvents(battle, attackerName, defenderName, commanderTier);
  const visibleEvents = events.filter((e) => now >= e.ts);

  const elapsed = now - battle.startTs;
  const totalDuration = battle.resolveTs - battle.startTs;
  const progress = Math.min(100, (elapsed / totalDuration) * 100);
  const remaining = Math.max(0, battle.resolveTs - now);
  const isResolved = battle.status === "resolved";
  const timerExpired = now >= battle.resolveTs;

  const formatTime = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const attackerWins = battle.outcome === "attacker_wins";
  const defenderWins = battle.outcome === "defender_wins";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col backdrop-blur-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="font-display text-xl uppercase tracking-wide flex items-center gap-2">
            <Swords className={cn("w-5 h-5", !timerExpired && "text-destructive animate-pulse", timerExpired && "text-muted-foreground")} />
            {isResolved ? "Battle Resolved" : timerExpired ? "Awaiting Resolution..." : "Battle Live"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-6 overflow-y-auto flex-1">
          {/* VS Panel */}
          <div className="grid grid-cols-3 items-center gap-3 p-4 bg-card border border-border rounded-md">
            <div className="text-center space-y-1">
              <p className="font-display text-xs uppercase tracking-wide text-muted-foreground">Attacker</p>
              <p className="font-display text-sm font-bold text-primary truncate">{attackerName}</p>
              {usedCommander && (
                <Badge variant="outline" className="text-[9px] gap-1">
                  {usedCommander.tier === "sentinel" && <Shield className="w-2.5 h-2.5 text-blue-400" />}
                  {usedCommander.tier === "phantom" && <Zap className="w-2.5 h-2.5 text-purple-400" />}
                  {usedCommander.tier === "reaper" && <Skull className="w-2.5 h-2.5 text-red-400" />}
                  {usedCommander.name}
                </Badge>
              )}
              <p className="font-mono text-2xl font-bold text-primary">{Math.round(battle.attackerPower)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Power</p>
            </div>

            <div className="flex flex-col items-center gap-1">
              <Swords className="w-8 h-8 text-destructive" />
              <span className="font-display text-xs text-muted-foreground">VS</span>
              <span className="font-display text-[10px] uppercase text-muted-foreground">Plot #{battle.targetParcelId.slice(0, 4)}</span>
            </div>

            <div className="text-center space-y-1">
              <p className="font-display text-xs uppercase tracking-wide text-muted-foreground">Defender</p>
              <p className="font-display text-sm font-bold text-destructive truncate">{defenderName}</p>
              <div className="h-5" />
              <p className="font-mono text-2xl font-bold text-destructive">{Math.round(battle.defenderPower)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Power</p>
            </div>
          </div>

          {/* Timer */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {isResolved ? "Complete" : timerExpired ? "Processing..." : "Battle progress"}
              </span>
              <span className="font-mono text-muted-foreground">
                {isResolved || timerExpired ? "—" : formatTime(remaining) + " remaining"}
              </span>
            </div>
            <Progress
              value={progress}
              className={cn("h-2", isResolved && attackerWins && "[&>div]:bg-primary", isResolved && defenderWins && "[&>div]:bg-destructive")}
            />
          </div>

          {/* Battle Feed */}
          <div className="border border-border rounded-md overflow-hidden flex-1 min-h-[200px]">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-[10px] font-display uppercase tracking-wide text-muted-foreground">Battle Log</p>
            </div>
            <div ref={feedRef} className="p-3 space-y-2 max-h-64 overflow-y-auto">
              {visibleEvents.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6 italic">
                  Forces advancing... battle commencing
                </p>
              )}
              {[...visibleEvents].reverse().map((event, idx) => (
                <div
                  key={event.id}
                  className={cn(
                    "flex items-start gap-2 p-2.5 rounded-md text-xs border transition-all",
                    idx === 0 && "ring-1 ring-offset-1",
                    event.side === "attacker" && "bg-primary/5 border-primary/20",
                    event.side === "attacker" && idx === 0 && "ring-primary/30",
                    event.side === "defender" && "bg-destructive/5 border-destructive/20",
                    event.side === "defender" && idx === 0 && "ring-destructive/30",
                    event.side === "neutral" && "bg-muted/20 border-border",
                    event.side === "neutral" && idx === 0 && "ring-border",
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {event.side === "attacker" && <Crosshair className="w-3 h-3 text-primary" />}
                    {event.side === "defender" && <Shield className="w-3 h-3 text-destructive" />}
                    {event.side === "neutral" && <Target className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <p className="leading-snug">{event.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Outcome Banner */}
          {isResolved && battle.outcome && (
            <div
              className={cn(
                "p-5 rounded-md text-center border space-y-1",
                attackerWins ? "bg-primary/10 border-primary/40" : "bg-destructive/10 border-destructive/40",
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Trophy className={cn("w-6 h-6", attackerWins ? "text-primary" : "text-destructive")} />
                <p className={cn("font-display text-2xl uppercase tracking-widest", attackerWins ? "text-primary" : "text-destructive")}>
                  {attackerWins ? "Victory" : "Defeat"}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {attackerWins
                  ? `${attackerName} has captured the territory`
                  : `${defenderName} repelled the attack`}
              </p>
            </div>
          )}

          {timerExpired && !isResolved && (
            <div className="p-3 rounded-md text-center border border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">Waiting for server to resolve battle...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full font-display uppercase tracking-wide">
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
