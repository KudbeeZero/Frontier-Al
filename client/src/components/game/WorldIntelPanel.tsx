import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useWorldEvents, useLiveWorldEvents } from "@/hooks/useWorldEvents";
import type { WorldEvent, WorldEventType } from "@shared/worldEvents";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, SkipBack, Zap, Swords, MapPin, Pickaxe, Shield, Radar, Radio, ArrowRight, Gem, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT_LABELS: Record<WorldEventType, string> = {
  land_claimed:       "TERRITORY",
  battle_started:     "BATTLE IN",
  battle_resolved:    "BATTLE OUT",
  commander_deployed: "COMMANDER",
  commander_minted:   "COMMANDER",
  scan_ping:          "SCAN",
  jammer_zone:        "JAMMING",
  faction_movement:   "MOVEMENT",
  resource_pulse:     "RESOURCES",
  mine_action:        "MINING",
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

const EVENT_ICONS: Record<WorldEventType, React.ComponentType<{ className?: string }>> = {
  land_claimed:       MapPin,
  battle_started:     Swords,
  battle_resolved:    Swords,
  commander_deployed: Shield,
  commander_minted:   Shield,
  scan_ping:          Radar,
  jammer_zone:        Radio,
  faction_movement:   ArrowRight,
  resource_pulse:     Gem,
  mine_action:        Pickaxe,
};

const LAYER_TYPES: WorldEventType[] = [
  "land_claimed", "battle_started", "battle_resolved",
  "commander_deployed", "commander_minted", "mine_action",
  "scan_ping", "jammer_zone", "faction_movement", "resource_pulse",
];

const SPEED_OPTIONS = [1, 5, 20, 60] as const;
const RANGE_PRESETS = [
  { label: "15m", ms: 15 * 60_000 },
  { label: "1h",  ms: 60 * 60_000 },
  { label: "6h",  ms: 6 * 60 * 60_000 },
  { label: "24h", ms: 24 * 60 * 60_000 },
];

function computeThreatLevel(events: WorldEvent[]): { score: number; label: string; color: string } {
  const recentMs = 30 * 60_000;
  const cutoff = Date.now() - recentMs;
  const recent = events.filter(e => e.timestamp >= cutoff);
  const battles  = recent.filter(e => e.type === "battle_started").length;
  const critical = recent.filter(e => e.severity === "critical" || e.severity === "high").length;
  const claims   = recent.filter(e => e.type === "land_claimed").length;
  const score = Math.min(100, battles * 20 + critical * 15 + claims * 5);
  const label = score < 25 ? "QUIET" : score < 55 ? "ACTIVE" : score < 80 ? "ELEVATED" : "CONFLICT";
  const color = score < 25 ? "#00ff6a" : score < 55 ? "#ffeb3b" : score < 80 ? "#ff9800" : "#ff1744";
  return { score, label, color };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function ageStr(ts: number): string {
  const age = Math.round((Date.now() - ts) / 1000);
  if (age < 60) return `${age}s`;
  if (age < 3600) return `${Math.round(age / 60)}m`;
  return `${Math.round(age / 3600)}h`;
}

function buildDetail(event: WorldEvent): string {
  const m = event.metadata;
  if (event.type === "battle_started")   return `${m.attacker ?? "?"} → ${m.defender ?? "?"}`;
  if (event.type === "battle_resolved")  return m.outcome === "attacker_wins" ? "ATTACKER WINS" : "DEFENDER WINS";
  if (event.type === "land_claimed")     return m.playerName ? `${m.playerName} #${event.plotId ?? ""}` : `PLOT #${event.plotId}`;
  if (event.type === "faction_movement") return `${event.factionId ?? "?"} ADVANCING`;
  if (event.type === "jammer_zone")      return `${event.factionId ?? "?"} R=${m.radius ?? 0}`;
  if (event.type === "resource_pulse")   return `Fe:${m.iron ?? 0} Fu:${m.fuel ?? 0} Cr:${m.crystal ?? 0}`;
  if (event.type === "scan_ping")        return m.playerName ? `${String(m.playerName)}` : "SWEEP";
  if (event.type === "commander_minted") return m.playerName ? `${String(m.playerName)} ${String(m.tier ?? "").toUpperCase()}` : "MINTED";
  if (event.type === "mine_action")      return `PLOT #${event.plotId ?? "?"}`;
  return `${event.lat.toFixed(2)}°, ${event.lng.toFixed(2)}°`;
}

function EventRow({
  event,
  expanded,
  onToggle,
}: {
  event: WorldEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const color = EVENT_COLORS[event.type as WorldEventType] ?? "#888";
  const label = EVENT_LABELS[event.type as WorldEventType] ?? event.type;
  const detail = buildDetail(event);
  const Icon = EVENT_ICONS[event.type as WorldEventType];
  const isNew = Date.now() - event.timestamp < 10_000;
  const isCritical = event.severity === "critical" || event.severity === "high";
  const isLiveBattle = event.type === "battle_started";

  return (
    <div
      className={cn(
        "rounded transition-all cursor-pointer",
        isNew && "ring-1 ring-yellow-400/40",
      )}
      style={{
        borderLeft: `2px solid ${isNew ? "#fbbf24" : color}`,
        background: expanded ? `${color}08` : "transparent",
        marginBottom: 2,
      }}
      onClick={onToggle}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div className="shrink-0" style={{ color }}>
          {Icon && <Icon className="w-3 h-3" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-mono font-bold tracking-widest"
              style={{ color }}
            >
              {label}
            </span>
            {isCritical && (
              <span
                className="text-[8px] font-mono px-1 py-0.5 rounded"
                style={{ background: "#ff174420", color: "#ff1744", border: "1px solid #ff174440" }}
              >
                {event.severity?.toUpperCase()}
              </span>
            )}
            {isLiveBattle && !event.endTimestamp && (
              <span
                className="text-[8px] font-mono px-1 animate-pulse"
                style={{ color: "#ff1744" }}
              >
                ⬤ LIVE
              </span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{detail}</div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] font-mono text-muted-foreground">{ageStr(event.timestamp)}</span>
          {expanded
            ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
            : <ChevronDown className="w-3 h-3 text-muted-foreground" />
          }
        </div>
      </div>

      {expanded && (
        <div
          className="px-3 pb-2 pt-0.5 font-mono text-[9px] space-y-0.5"
          style={{ color: `${color}99` }}
        >
          <div>ID: {event.id.slice(0, 12)}...</div>
          <div>LAT: {event.lat.toFixed(4)}° LNG: {event.lng.toFixed(4)}°</div>
          <div>TIME: {formatTime(event.timestamp)}</div>
          {event.plotId    && <div>PLOT: #{event.plotId}</div>}
          {event.factionId && <div>FACTION: {event.factionId}</div>}
          {event.playerId  && <div>PLAYER: {event.playerId.slice(0, 12)}...</div>}
          {Object.entries(event.metadata).slice(0, 5).map(([k, v]) => (
            <div key={k}>{k.toUpperCase()}: {String(v)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineDotTrack({
  events,
  rangeStart,
  rangeEnd,
  replayTime,
  onSeek,
}: {
  events: WorldEvent[];
  rangeStart: number;
  rangeEnd: number;
  replayTime: number;
  onSeek: (ts: number) => void;
}) {
  const rangeMs = rangeEnd - rangeStart;
  const playheadPct = rangeMs > 0 ? ((replayTime - rangeStart) / rangeMs) * 100 : 0;

  return (
    <div className="relative h-5 w-full">
      <div
        className="absolute inset-y-0 my-auto h-px w-full"
        style={{ background: "rgba(79,195,247,0.15)" }}
      />
      <div
        className="absolute inset-y-0 my-auto h-px"
        style={{
          left: 0,
          width: `${playheadPct}%`,
          background: "rgba(79,195,247,0.45)",
          transition: "width 0.3s linear",
        }}
      />
      {events.map(evt => {
        const pct = rangeMs > 0 ? ((evt.timestamp - rangeStart) / rangeMs) * 100 : 0;
        if (pct < 0 || pct > 100) return null;
        const color = EVENT_COLORS[evt.type as WorldEventType] ?? "#888";
        return (
          <button
            key={evt.id}
            title={`${EVENT_LABELS[evt.type as WorldEventType] ?? evt.type} — ${formatTime(evt.timestamp)}`}
            onClick={() => onSeek(evt.timestamp)}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full hover:scale-150 transition-transform"
            style={{
              left: `${pct}%`,
              background: color,
              boxShadow: `0 0 4px ${color}`,
            }}
          />
        );
      })}
      <div
        className="absolute top-0 bottom-0 w-px pointer-events-none"
        style={{
          left: `${playheadPct}%`,
          background: "rgba(255,255,255,0.7)",
          boxShadow: "0 0 6px rgba(255,255,255,0.5)",
          transition: "left 0.3s linear",
        }}
      />
    </div>
  );
}

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
  const [expandedId, setExpandedId]         = useState<string | null>(null);
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

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

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

  const threat = useMemo(() => computeThreatLevel(events), [events]);

  const sliderValue = rangeMs > 0 ? (replayOffsetMs / rangeMs) * 100 : 0;

  return (
    <div className={cn("flex flex-col h-full bg-background text-foreground", className)}>

      {/* ── HEADER ── */}
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-primary">
              WORLD INTEL
            </h2>
            {isLive && (
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"
                  style={{ boxShadow: "0 0 6px #00ff6a" }}
                />
                <span className="text-[9px] font-mono text-green-400 tracking-widest">LIVE</span>
              </div>
            )}
          </div>
          {import.meta.env.DEV && (
            <button
              onClick={handleSeedDemo}
              className="flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Zap className="w-2.5 h-2.5" /> SEED
            </button>
          )}
        </div>

        {/* Threat meter */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono tracking-widest text-muted-foreground">THREAT LEVEL</span>
            <span
              className="text-[9px] font-mono tracking-widest font-bold"
              style={{ color: threat.color }}
            >
              {threat.label}
            </span>
          </div>
          <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${threat.score}%`,
                background: threat.color,
                boxShadow: `0 0 8px ${threat.color}60`,
              }}
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
                "flex-1 text-[9px] font-mono py-0.5 rounded border transition-colors tracking-widest",
                rangeMs === p.ms
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Timeline dot track */}
        <TimelineDotTrack
          events={events}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          replayTime={replayTime}
          onSeek={(ts) => {
            setReplayOffsetMs(ts - rangeStart);
            setPlaying(false);
          }}
        />

        {/* Time labels under track */}
        <div className="flex justify-between text-[8px] font-mono text-muted-foreground mt-0.5 mb-2">
          <span>{formatTime(rangeStart)}</span>
          <span style={{ color: "rgba(255,255,255,0.6)" }}>{formatTime(replayTime)}</span>
          <span>{formatTime(rangeEnd)}</span>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          <button
            className="h-6 w-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            onClick={() => { setReplayOffsetMs(0); setPlaying(false); }}
          >
            <SkipBack className="w-3 h-3" />
          </button>
          <button
            className={cn(
              "h-6 w-6 flex items-center justify-center rounded border transition-colors",
              playing
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
            )}
            onClick={() => {
              if (replayOffsetMs >= rangeMs) setReplayOffsetMs(0);
              setPlaying(p => !p);
            }}
          >
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <div className="flex gap-1 ml-auto">
            {SPEED_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors tracking-wider",
                  speed === s
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <div className="mt-1.5 text-[9px] font-mono text-muted-foreground tracking-widest">
          {visibleEvents.length} SIGNAL{visibleEvents.length !== 1 ? "S" : ""} AT T={formatTime(replayTime)}
        </div>
      </div>

      {/* ── SIGNAL LAYERS ── */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5 font-mono">
          SIGNAL LAYERS
        </div>
        <div className="grid grid-cols-2 gap-1">
          {LAYER_TYPES.map(type => {
            const active = visibleTypes.has(type);
            const color  = EVENT_COLORS[type];
            const count  = events.filter(e => e.type === type).length;
            const Icon   = EVENT_ICONS[type];
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded text-left transition-colors",
                  active ? "bg-muted/20" : "opacity-40 hover:opacity-60"
                )}
                style={active ? { border: `1px solid ${color}30` } : { border: "1px solid transparent" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={active ? { background: color, boxShadow: `0 0 4px ${color}` } : { background: "#555" }}
                />
                {Icon && (
                  <span className="shrink-0" style={{ color: active ? color : "#555" }}>
                    <Icon className="w-2.5 h-2.5" />
                  </span>
                )}
                <span
                  className="text-[9px] font-mono truncate tracking-wider"
                  style={{ color: active ? color : "#555" }}
                >
                  {EVENT_LABELS[type]}
                </span>
                <span className="text-[8px] font-mono text-muted-foreground ml-auto shrink-0">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── EVENT FEED ── */}
      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {isLoading && (
          <div className="text-[10px] font-mono text-muted-foreground text-center py-6 tracking-widest">
            ACQUIRING SIGNAL...
          </div>
        )}
        {!isLoading && recentEvents.length === 0 && (
          <div className="text-[10px] font-mono text-muted-foreground text-center py-6 tracking-widest">
            NO SIGNALS DETECTED
            {import.meta.env.DEV && (
              <div className="mt-2 text-[9px] text-primary/50">Click SEED to populate</div>
            )}
          </div>
        )}
        {recentEvents.map(event => (
          <EventRow
            key={event.id}
            event={event}
            expanded={expandedId === event.id}
            onToggle={() => handleToggleExpand(event.id)}
          />
        ))}
      </div>
    </div>
  );
}
