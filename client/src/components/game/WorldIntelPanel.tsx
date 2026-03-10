import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useWorldEvents, useLiveWorldEvents } from "@/hooks/useWorldEvents";
import type { WorldEvent, WorldEventType } from "@shared/worldEvents";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, SkipBack, Zap, Swords, MapPin, Pickaxe, Shield, Radar, Zap as ZapIcon, ArrowRight, Gem, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT_LABELS: Record<WorldEventType, string> = {
  land_claimed:       "Claims",
  battle_started:     "Battles",
  battle_resolved:    "Resolved",
  commander_deployed: "Deployed",
  commander_minted:   "Commander",
  scan_ping:          "Scans",
  jammer_zone:        "Jamming",
  faction_movement:   "Movement",
  resource_pulse:     "Resources",
  mine_action:        "Mining",
};

const EVENT_COLORS: Record<WorldEventType, string> = {
  land_claimed:       "#00ff6a",
  battle_started:     "#ff1744",
  battle_resolved:    "#ff9800",
  commander_deployed: "#00e5ff",
  commander_minted:   "#00e5ff",
  scan_ping:          "#2196f3",
  jammer_zone:        "#9c27b0",
  faction_movement:   "#ffeb3b",
  resource_pulse:     "#4caf50",
  mine_action:        "#78909c",
};

const LAYER_TYPES: WorldEventType[] = [
  "land_claimed", "battle_started", "battle_resolved",
  "commander_minted", "mine_action",
  "scan_ping", "jammer_zone", "faction_movement", "resource_pulse",
];

function EventIcon({ type, color }: { type: WorldEventType; color: string }) {
  const cls = "w-3 h-3 shrink-0";
  switch (type) {
    case "battle_started":    return <Swords className={cls} style={{ color }} />;
    case "battle_resolved":   return <Swords className={cls} style={{ color }} />;
    case "land_claimed":      return <MapPin className={cls} style={{ color }} />;
    case "mine_action":       return <Pickaxe className={cls} style={{ color }} />;
    case "commander_minted":  return <Shield className={cls} style={{ color }} />;
    case "commander_deployed":return <Shield className={cls} style={{ color }} />;
    case "scan_ping":         return <Radar className={cls} style={{ color }} />;
    case "jammer_zone":       return <ZapIcon className={cls} style={{ color }} />;
    case "faction_movement":  return <ArrowRight className={cls} style={{ color }} />;
    case "resource_pulse":    return <Gem className={cls} style={{ color }} />;
    default:                  return <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />;
  }
}

const SPEED_OPTIONS = [1, 5, 20, 60] as const;
const RANGE_PRESETS = [
  { label: "15m", ms: 15 * 60_000 },
  { label: "1h",  ms: 60 * 60_000 },
  { label: "6h",  ms: 6 * 60 * 60_000 },
  { label: "24h", ms: 24 * 60 * 60_000 },
];

interface WorldIntelPanelProps {
  className?: string;
  onReplayStateChange?: (state: { replayTime: number; visibleTypes: Set<string> }) => void;
  activeBattleCount?: number;
}

export function WorldIntelPanel({ className, onReplayStateChange, activeBattleCount = 0 }: WorldIntelPanelProps) {
  const [rangeMs, setRangeMs]               = useState(60 * 60_000);
  const [playing, setPlaying]               = useState(false);
  const [speed, setSpeed]                   = useState<number>(5);
  const [replayOffsetMs, setReplayOffsetMs] = useState(60 * 60_000);
  const [visibleTypes, setVisibleTypes]     = useState<Set<WorldEventType>>(new Set(LAYER_TYPES));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const now = useRef(Date.now());
  useEffect(() => { now.current = Date.now(); }, []);

  const windowStart = now.current - rangeMs;
  const { data: rangedEvents = [], isLoading } = useWorldEvents({ start: windowStart, limit: 500 });
  const { data: liveEvents = [] }              = useLiveWorldEvents();

  const events = useMemo(() => {
    const map = new Map<string, WorldEvent>();
    for (const e of rangedEvents) map.set(e.id, e);
    for (const e of liveEvents)   map.set(e.id, e);
    return [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
  }, [rangedEvents, liveEvents]);

  const rangeStart = windowStart;
  const rangeEnd   = now.current;
  const replayTime = rangeStart + replayOffsetMs;

  const prevReplayRef = useRef<string>("");
  useEffect(() => {
    const key = `${replayTime}|${[...visibleTypes].sort().join(",")}`;
    if (key === prevReplayRef.current) return;
    prevReplayRef.current = key;
    onReplayStateChange?.({ replayTime, visibleTypes: visibleTypes as Set<string> });
  }, [replayTime, visibleTypes, onReplayStateChange]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setReplayOffsetMs(prev => {
          const next = prev + speed * 1000;
          if (next >= rangeMs) { setPlaying(false); return rangeMs; }
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, rangeMs]);

  const handleSeedDemo = useCallback(async () => {
    await fetch("/api/world/events/dev-seed", { method: "POST" });
    setReplayOffsetMs(0);
  }, []);

  const toggleType = (type: WorldEventType) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const isLive = rangeEnd - replayTime < 10_000;

  const visibleEvents = useMemo(() => {
    return events.filter(e => {
      if (!visibleTypes.has(e.type as WorldEventType)) return false;
      if (isLive) return e.timestamp >= rangeStart && e.timestamp <= rangeEnd;
      if (e.endTimestamp !== undefined) return e.timestamp <= replayTime && replayTime <= e.endTimestamp;
      return Math.abs(e.timestamp - replayTime) <= 30_000;
    });
  }, [events, replayTime, visibleTypes, isLive, rangeStart, rangeEnd]);

  const recentEvents = useMemo(() => {
    return events
      .filter(e => visibleTypes.has(e.type as WorldEventType))
      .slice(0, 50);
  }, [events, visibleTypes]);

  const threatLevel = useMemo(() => {
    const recentWindow = Date.now() - 60 * 60_000;
    const recentInWindow = events.filter(e => e.timestamp >= recentWindow);
    const claims = recentInWindow.filter(e => e.type === "land_claimed").length;
    const mines  = recentInWindow.filter(e => e.type === "mine_action").length;
    return Math.min(100, activeBattleCount * 25 + claims * 5 + mines * 1);
  }, [events, activeBattleCount]);

  const threatLabel = threatLevel < 30 ? "QUIET" : threatLevel < 60 ? "ACTIVE" : "CONFLICT";
  const threatColor = threatLevel < 30 ? "#00ff6a" : threatLevel < 60 ? "#ffb300" : "#ff1744";

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const sliderValue = rangeMs > 0 ? (replayOffsetMs / rangeMs) * 100 : 0;

  return (
    <div className={cn("flex flex-col h-full bg-background text-foreground", className)}>

      {/* ── Header ── */}
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-primary">World Intel</h2>
            {isLive && (
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                <span className="text-[10px] font-mono text-green-400 uppercase tracking-wide">Live</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {import.meta.env.DEV && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={handleSeedDemo}>
                <Zap className="w-3 h-3 mr-1" /> Seed
              </Button>
            )}
          </div>
        </div>

        {/* Threat meter */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-display uppercase tracking-wide text-muted-foreground">Threat</span>
            <span className="text-[10px] font-mono font-bold" style={{ color: threatColor }}>{threatLabel}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${threatLevel}%`, backgroundColor: threatColor }}
            />
          </div>
        </div>

        {/* Range presets */}
        <div className="flex gap-1 mb-2">
          {RANGE_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { setRangeMs(p.ms); setReplayOffsetMs(p.ms); setPlaying(false); }}
              className={cn(
                "flex-1 text-[10px] font-mono py-0.5 rounded border transition-colors",
                rangeMs === p.ms
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Timeline scrubber */}
        <div className="space-y-1 mb-2">
          <Slider
            value={[sliderValue]}
            onValueChange={([v]) => {
              setReplayOffsetMs(Math.round((v / 100) * rangeMs));
              setPlaying(false);
            }}
            min={0} max={100} step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
            <span>{formatTime(rangeStart)}</span>
            <span className="text-primary">{formatTime(replayTime)}</span>
            <span>{formatTime(rangeEnd)}</span>
          </div>
        </div>

        {/* Controls + speed */}
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-7 w-7"
            onClick={() => { setReplayOffsetMs(0); setPlaying(false); }}>
            <SkipBack className="w-3 h-3" />
          </Button>
          <Button size="icon" variant={playing ? "secondary" : "default"} className="h-7 w-7"
            onClick={() => {
              if (replayOffsetMs >= rangeMs) setReplayOffsetMs(0);
              setPlaying(p => !p);
            }}>
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </Button>
          <div className="flex gap-1 ml-auto">
            {SPEED_OPTIONS.map(s => (
              <button key={s} onClick={() => setSpeed(s)}
                className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors",
                  speed === s ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                )}>
                {s}x
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1.5 text-[10px] font-mono text-muted-foreground">
          {visibleEvents.length} event{visibleEvents.length !== 1 ? "s" : ""} at this time
        </div>
      </div>

      {/* ── Layer Toggles ── */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-display">Layers</div>
        <div className="grid grid-cols-2 gap-1">
          {LAYER_TYPES.map(type => {
            const active = visibleTypes.has(type);
            const count  = events.filter(e => e.type === type).length;
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono transition-colors text-left",
                  active
                    ? "border-transparent text-black"
                    : "border-border text-muted-foreground hover:border-primary/50 bg-transparent"
                )}
                style={active ? { backgroundColor: EVENT_COLORS[type] } : {}}
              >
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: active ? "rgba(0,0,0,0.4)" : EVENT_COLORS[type] }} />
                <span className="flex-1 truncate">{EVENT_LABELS[type]}</span>
                {count > 0 && (
                  <span className={cn("text-[9px]", active ? "text-black/60" : "text-muted-foreground")}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Event Feed ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <div className="text-[11px] text-muted-foreground text-center py-4">Loading events…</div>
        )}
        {!isLoading && recentEvents.length === 0 && (
          <div className="text-[11px] text-muted-foreground text-center py-6">
            No events yet{import.meta.env.DEV ? " — click Seed to populate" : ""}
          </div>
        )}
        <div className="divide-y divide-border/20">
          {recentEvents.map(event => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: WorldEvent }) {
  const [expanded, setExpanded] = useState(false);

  const color  = EVENT_COLORS[event.type as WorldEventType] ?? "#888";
  const label  = EVENT_LABELS[event.type as WorldEventType] ?? event.type;
  const ageMs  = Date.now() - event.timestamp;
  const ageStr = ageMs < 60_000
    ? `${Math.round(ageMs / 1000)}s ago`
    : ageMs < 3_600_000
    ? `${Math.round(ageMs / 60_000)}m ago`
    : `${Math.round(ageMs / 3_600_000)}h ago`;

  const isNew     = ageMs < 10_000;
  const isLiveBtl = event.type === "battle_started" && event.severity === "critical";

  const detail = (() => {
    const m = event.metadata;
    if (event.type === "land_claimed")    return `${m.playerName ?? "Unknown"} claimed #${event.plotId ?? "?"} (${m.biome ?? "?"})`;
    if (event.type === "battle_started")  return `${m.attacker ?? "?"} → ${m.defender ?? "?"}`;
    if (event.type === "battle_resolved") return `${m.outcome === "attacker_wins" ? "Attacker" : "Defender"} wins · ${m.attacker ?? "?"} vs ${m.defender ?? "?"}`;
    if (event.type === "commander_minted") return `${m.playerName ?? "?"} minted ${String(m.tier ?? "").toUpperCase()}`;
    if (event.type === "mine_action")     return `Plot #${event.plotId ?? "?"}`;
    if (event.type === "faction_movement") return `${event.factionId ?? "?"} advancing`;
    if (event.type === "jammer_zone")     return `${event.factionId ?? "?"} jamming r=${m.radius}`;
    if (event.type === "resource_pulse")  return `Fe:${m.iron ?? 0} Fu:${m.fuel ?? 0} Cr:${m.crystal ?? 0}`;
    if (event.type === "scan_ping")       return `${m.playerName ?? "?"} · ${m.source ?? "scan"}`;
    return `${event.lat.toFixed(1)}°, ${event.lng.toFixed(1)}°`;
  })();

  return (
    <div
      className={cn(
        "px-2 py-1.5 hover:bg-card/60 transition-colors cursor-pointer",
        isNew && "border-l-2 border-amber-400 bg-amber-400/5"
      )}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-start gap-2">
        {/* Live battle pulse */}
        {isLiveBtl && (
          <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse mt-1 shrink-0" />
        )}
        {!isLiveBtl && (
          <div className="mt-0.5 shrink-0">
            <EventIcon type={event.type as WorldEventType} color={color} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] font-mono font-bold leading-none" style={{ color }}>{label}</span>
            {(event.severity === "critical" || event.severity === "high") && (
              <Badge variant="destructive" className="text-[8px] h-3 px-1 py-0">
                {event.severity === "critical" ? "!!" : "!"}
              </Badge>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground leading-tight truncate">{detail}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] font-mono text-muted-foreground">{ageStr}</span>
          {expanded
            ? <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
            : <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Inline detail drawer */}
      {expanded && (
        <div className="mt-1.5 ml-5 p-2 rounded bg-muted/30 border border-border/40 space-y-0.5">
          {Object.entries(event.metadata).map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[10px] font-mono">
              <span className="text-muted-foreground shrink-0">{k}:</span>
              <span className="text-foreground break-all">{String(v)}</span>
            </div>
          ))}
          {event.plotId   && <div className="flex gap-2 text-[10px] font-mono"><span className="text-muted-foreground shrink-0">plotId:</span><span>{event.plotId}</span></div>}
          {event.playerId && <div className="flex gap-2 text-[10px] font-mono"><span className="text-muted-foreground shrink-0">player:</span><span>{event.playerId.slice(0, 8)}…</span></div>}
          <div className="flex gap-2 text-[10px] font-mono">
            <span className="text-muted-foreground shrink-0">lat/lng:</span>
            <span>{event.lat.toFixed(3)}, {event.lng.toFixed(3)}</span>
          </div>
          <div className="flex gap-2 text-[10px] font-mono">
            <span className="text-muted-foreground shrink-0">severity:</span>
            <span>{event.severity ?? "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
