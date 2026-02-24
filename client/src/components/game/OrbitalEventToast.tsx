/**
 * OrbitalEventToast.tsx
 *
 * In-game notification panel for active orbital impact events.
 * Shows event name, effect summary, and a countdown to expiry.
 *
 * Design intent: looks like a COMMS UPLINK / SATELLITE RELAY message —
 * intentional, not "lag". Cyan pulsing border matches the selection ring.
 */

import { useState, useEffect } from "react";
import type { OrbitalEvent } from "@shared/schema";

const EVENT_LABELS: Record<string, string> = {
  METEOR_SHOWER:    "Meteor Shower",
  SINGLE_BOLIDE:    "Bolide Impact",
  COMET_PASS:       "Comet Passage",
  ORBITAL_DEBRIS:   "Orbital Debris Field",
  ATMOSPHERIC_BURST:"Atmospheric Burst",
  IMPACT_STRIKE:    "Impact Strike",
};

const EFFECT_ICONS: Record<string, string> = {
  RESOURCE_BURST: "▲",
  TILE_HAZARD:    "▼",
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface OrbitalEventToastProps {
  events: OrbitalEvent[];
}

export function OrbitalEventToast({ events }: OrbitalEventToastProps) {
  const [now, setNow] = useState(Date.now());

  // Update countdown every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Only show active impact events
  const active = events.filter(
    (e) => !e.cosmetic && e.startAt <= now && e.endAt > now
  );

  if (active.length === 0) return null;

  return (
    <div
      className="absolute top-16 right-3 z-20 flex flex-col gap-2 pointer-events-none"
      aria-label="Orbital event notifications"
    >
      {active.map((event) => {
        const remaining = event.endAt - now;
        const effect    = event.effects?.[0];

        return (
          <div
            key={event.id}
            className="backdrop-blur-md rounded-md px-3 py-2 text-xs font-display uppercase tracking-wide"
            style={{
              background:   "rgba(0,0,0,0.75)",
              border:       "1px solid #00e5ff",
              boxShadow:    "0 0 8px rgba(0,229,255,0.35)",
              animation:    "pulse 2s ease-in-out infinite",
              minWidth:     "180px",
            }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-cyan-400 font-bold truncate">
                {EVENT_LABELS[event.type] ?? event.type}
              </span>
              <span className="text-cyan-300 tabular-nums">
                {formatCountdown(remaining)}
              </span>
            </div>

            {/* Effect summary */}
            {effect && (
              <div className="text-[10px] text-gray-300 leading-tight">
                <span
                  className={
                    effect.type === "RESOURCE_BURST"
                      ? "text-green-400"
                      : "text-red-400"
                  }
                >
                  {EFFECT_ICONS[effect.type]} {effect.description}
                </span>
              </div>
            )}

            {/* Intensity bar */}
            <div className="mt-1.5 h-0.5 rounded-full overflow-hidden bg-gray-700">
              <div
                className="h-full rounded-full bg-cyan-400"
                style={{
                  width: `${Math.round(event.intensity * 100)}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            {/* COMMS label */}
            <div className="mt-1 text-[9px] text-gray-500">
              ORBITAL COMMS RELAY — INTENSITY {Math.round(event.intensity * 100)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
