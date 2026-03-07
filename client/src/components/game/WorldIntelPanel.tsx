import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useWorldEvents } from "@/hooks/useWorldEvents";
import type { WorldEvent, WorldEventType } from "@shared/worldEvents";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, SkipBack, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT_LABELS: Record<WorldEventType, string> = {
  land_claimed:      "Claims",
  battle_started:    "Battles",
  battle_resolved:   "Resolved",
  commander_deployed:"Commanders",
  scan_ping:         "Scans",
  jammer_zone:       "Jamming",
  faction_movement:  "Movement",
  resource_pulse:    "Resources",
};

const EVENT_COLORS: Record<WorldEventType, string> = {
  land_claimed:      "#00ff6a",
  battle_started:    "#ff1744",
  battle_resolved:   "#ff9800",
  commander_deployed:"#00e5ff",
  scan_ping:         "#2196f3",
  jammer_zone:       "#9c27b0",
  faction_movement:  "#ffeb3b",
  resource_pulse:    "#4caf50",
};

const LAYER_TYPES: WorldEventType[] = [
  "land_claimed", "battle_started", "battle_resolved",
  "scan_ping", "jammer_zone", "faction_movement",
];

const SPEED_OPTIONS = [1, 5, 20, 60] as const;
const RANGE_PRESETS = [
  { label: "15m", ms: 15 * 60_000 },
  { label: "1h",  ms: 60 * 60_000 },
  { label: "24h", ms: 24 * 60 * 60_000 },
];

interface WorldIntelPanelProps {
  className?: string;
  onReplayStateChange?: (state: { replayTime: number; visibleTypes: Set<string> }) => void;
}

export function WorldIntelPanel({ className, onReplayStateChange }: WorldIntelPanelProps) {
  const [rangeMs, setRangeMs]           = useState(60 * 60_000);
  const [playing, setPlaying]           = useState(false);
  const [speed, setSpeed]               = useState<number>(5);
  const [replayOffsetMs, setReplayOffsetMs] = useState(60 * 60_000);
  const [visibleTypes, setVisibleTypes] = useState<Set<WorldEventType>>(
    new Set(LAYER_TYPES)
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const now = useRef(Date.now());
  useEffect(() => { now.current = Date.now(); }, []);

  const windowStart = now.current - rangeMs;
  const { data: events = [], isLoading } = useWorldEvents({ start: windowStart, limit: 500 });

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
      if (isLive) {
        return e.timestamp >= rangeStart && e.timestamp <= rangeEnd;
      }
      if (e.endTimestamp !== undefined) {
        return e.timestamp <= replayTime && replayTime <= e.endTimestamp;
      }
      return Math.abs(e.timestamp - replayTime) <= 30_000;
    });
  }, [events, replayTime, visibleTypes, isLive, rangeStart, rangeEnd]);

  const recentEvents = useMemo(() => {
    return [...events]
      .filter(e => visibleTypes.has(e.type as WorldEventType))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30);
  }, [events, visibleTypes]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const sliderValue = rangeMs > 0 ? (replayOffsetMs / rangeMs) * 100 : 0;

  return (
    <div className={cn("flex flex-col h-full bg-background text-foreground", className)}>
      <div className="p-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-primary">
            World Intel
          </h2>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={handleSeedDemo}>
            <Zap className="w-3 h-3 mr-1" /> Seed Demo
          </Button>
        </div>

        {/* Range presets */}
        <div className="flex gap-1 mb-3">
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
        <div className="space-y-1 mb-3">
          <Slider
            value={[sliderValue]}
            onValueChange={([v]) => {
              setReplayOffsetMs(Math.round((v / 100) * rangeMs));
              setPlaying(false);
            }}
            min={0}
            max={100}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
            <span>{formatTime(rangeStart)}</span>
            <span className="text-primary">{formatTime(replayTime)}</span>
            <span>{formatTime(rangeEnd)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={() => { setReplayOffsetMs(0); setPlaying(false); }}
          >
            <SkipBack className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant={playing ? "secondary" : "default"}
            className="h-7 w-7"
            onClick={() => {
              if (replayOffsetMs >= rangeMs) setReplayOffsetMs(0);
              setPlaying(p => !p);
            }}
          >
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </Button>
          <div className="flex gap-1 ml-auto">
            {SPEED_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors",
                  speed === s
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Visible at time indicator */}
        <div className="mt-2 text-[10px] font-mono text-muted-foreground">
          {visibleEvents.length} event{visibleEvents.length !== 1 ? "s" : ""} at this time
        </div>
      </div>

      {/* Layer toggles */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-display">
          Layers
        </div>
        <div className="flex flex-wrap gap-1">
          {LAYER_TYPES.map(type => {
            const active = visibleTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border font-mono transition-colors",
                  active
                    ? "text-black border-transparent"
                    : "border-border text-muted-foreground hover:border-primary/50"
                )}
                style={active ? { backgroundColor: EVENT_COLORS[type] } : {}}
              >
                {EVENT_LABELS[type]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Event feed */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {isLoading && (
          <div className="text-[11px] text-muted-foreground text-center py-4">Loading events…</div>
        )}
        {!isLoading && recentEvents.length === 0 && (
          <div className="text-[11px] text-muted-foreground text-center py-4">
            No events yet — click Seed Demo to populate
          </div>
        )}
        {recentEvents.map(event => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: WorldEvent }) {
  const color = EVENT_COLORS[event.type as WorldEventType] ?? "#888";
  const label = EVENT_LABELS[event.type as WorldEventType] ?? event.type;
  const age   = Math.round((Date.now() - event.timestamp) / 1000);
  const ageStr = age < 60 ? `${age}s ago` : age < 3600 ? `${Math.round(age / 60)}m ago` : `${Math.round(age / 3600)}h ago`;

  const detail = (() => {
    const m = event.metadata;
    if (event.type === "land_claimed")    return `${m.playerName ?? "Unknown"} #${event.plotId}`;
    if (event.type === "battle_started")  return `${m.attacker ?? "?"} → ${m.defender ?? "?"}`;
    if (event.type === "battle_resolved") return `${m.outcome === "attacker_wins" ? "Attacker" : "Defender"} wins`;
    if (event.type === "faction_movement") return `${event.factionId ?? "?"} advancing`;
    if (event.type === "jammer_zone")     return `${event.factionId ?? "?"} jamming r=${m.radius}`;
    if (event.type === "resource_pulse")  return `Fe:${m.iron ?? 0} Fu:${m.fuel ?? 0}`;
    return String(event.lat.toFixed(1)) + "°, " + String(event.lng.toFixed(1)) + "°";
  })();

  return (
    <div className="flex items-start gap-2 p-1.5 rounded bg-card/50 hover:bg-card transition-colors">
      <div
        className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono font-bold" style={{ color }}>{label}</span>
          {event.severity === "critical" && (
            <Badge variant="destructive" className="text-[8px] h-3 px-1">!</Badge>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{detail}</div>
      </div>
      <span className="text-[9px] font-mono text-muted-foreground shrink-0">{ageStr}</span>
    </div>
  );
}
