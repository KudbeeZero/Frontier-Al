/**
 * ActivityFeed.tsx
 *
 * HUD-style overlay that streams world events in real-time via WebSocket.
 * Slide-out panel on desktop, bottom sheet on mobile.
 * Color-coded by event type with timestamps and filter toggles.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Filter, ChevronDown, ChevronUp } from "lucide-react";
import type { WorldEvent } from "@shared/worldEvents";
import { onWorldEvent } from "@/hooks/useGameSocket";

// ── Event type configuration ─────────────────────────────────────────────────
const EVENT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  land_claimed:       { label: "Land Claimed",     color: "text-blue-400",    icon: "🏴" },
  battle_started:     { label: "Battle Started",   color: "text-red-400",     icon: "⚔️" },
  battle_resolved:    { label: "Battle Resolved",  color: "text-yellow-400",  icon: "🏁" },
  commander_deployed: { label: "Commander Deployed", color: "text-purple-400", icon: "🤖" },
  commander_minted:   { label: "Commander Minted", color: "text-purple-400",  icon: "🎖️" },
  scan_ping:          { label: "Scan Ping",        color: "text-green-400",   icon: "📡" },
  jammer_zone:        { label: "Jammer Zone",      color: "text-orange-400",  icon: "📵" },
  faction_movement:   { label: "Faction Movement", color: "text-orange-400",  icon: "🚩" },
  resource_pulse:     { label: "Resource Pulse",   color: "text-green-400",   icon: "⛏️" },
  mine_action:        { label: "Mine Action",      color: "text-green-400",   icon: "⛏️" },
};

const ALL_TYPES = Object.keys(EVENT_CONFIG);

// ── Utility: relative time ───────────────────────────────────────────────────
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

// ── Single event row ─────────────────────────────────────────────────────────
function EventRow({ event }: { event: WorldEvent }) {
  const cfg = EVENT_CONFIG[event.type] ?? { label: event.type, color: "text-gray-400", icon: "📋" };
  const playerName = (event.metadata?.playerName as string) ?? (event.metadata?.attackerName as string) ?? null;
  const detail = (event.metadata?.description as string) ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2 py-2 px-3 border-b border-white/5 hover:bg-white/5 transition-colors"
    >
      <span className="text-sm flex-shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-semibold ${cfg.color}`}>{cfg.label}</span>
          <span className="text-[10px] text-muted-foreground">{timeAgo(event.timestamp)}</span>
        </div>
        {playerName && (
          <p className="text-xs text-foreground/80 truncate">{playerName}</p>
        )}
        {detail && (
          <p className="text-[11px] text-muted-foreground truncate">{detail}</p>
        )}
        {event.plotId !== undefined && (
          <span className="text-[10px] text-muted-foreground">Plot #{event.plotId}</span>
        )}
      </div>
    </motion.div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
interface ActivityFeedProps {
  /** Initial events loaded from API */
  initialEvents?: WorldEvent[];
}

export function ActivityFeed({ initialEvents = [] }: ActivityFeedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<WorldEvent[]>(initialEvents);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(ALL_TYPES));
  const [showFilters, setShowFilters] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Subscribe to live WebSocket events
  useEffect(() => {
    const unsub = onWorldEvent((event: WorldEvent) => {
      setEvents(prev => {
        // Deduplicate by id
        if (prev.some(e => e.id === event.id)) return prev;
        const next = [event, ...prev].slice(0, 100);
        return next;
      });
    });
    return unsub;
  }, []);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length, autoScroll]);

  const toggleFilter = useCallback((type: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const filteredEvents = events.filter(e => activeFilters.has(e.type));
  const activeCount = activeFilters.size;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-4 bottom-20 md:bottom-8 z-50 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label="Toggle activity feed"
      >
        <div className="relative">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          {events.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center font-bold">
              {events.length > 9 ? "9+" : events.length}
            </span>
          )}
        </div>
      </button>

      {/* Overlay panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 md:bg-transparent"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full md:w-80 bg-background/95 backdrop-blur-sm border-l border-blue-500/20 z-50 flex flex-col shadow-2xl shadow-blue-500/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-transparent">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 font-mono text-sm font-bold tracking-wider">▸ ACTIVITY LOG</span>
                  <span className="text-[10px] text-muted-foreground bg-white/10 px-1.5 py-0.5 rounded-full">
                    {filteredEvents.length} events
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-1.5 rounded hover:bg-white/10 transition-colors ${activeCount < ALL_TYPES.length ? "text-blue-400" : "text-muted-foreground"}`}
                    title="Filter events"
                  >
                    <Filter size={14} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors text-muted-foreground"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Filter toggles */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b border-white/5"
                  >
                    <div className="px-3 py-2 flex flex-wrap gap-1.5">
                      {ALL_TYPES.map(type => {
                        const cfg = EVENT_CONFIG[type];
                        const isActive = activeFilters.has(type);
                        return (
                          <button
                            key={type}
                            onClick={() => toggleFilter(type)}
                            className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                              isActive
                                ? "bg-blue-500/20 border-blue-500/40 text-foreground"
                                : "bg-transparent border-white/10 text-muted-foreground opacity-50"
                            }`}
                          >
                            {cfg.icon} {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Event list */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  setAutoScroll(el.scrollTop < 50);
                }}
              >
                {filteredEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <span className="text-3xl mb-2">📡</span>
                    <p className="text-sm">No activity yet</p>
                    <p className="text-xs mt-1">Events will appear here in real-time</p>
                  </div>
                ) : (
                  filteredEvents.map(event => (
                    <EventRow key={event.id} event={event} />
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-3 py-2 border-t border-white/5 text-center">
                <span className="text-[10px] text-muted-foreground">
                  Streaming live • {events.length} total
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
