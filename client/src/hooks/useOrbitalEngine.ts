/**
 * useOrbitalEngine.ts
 *
 * Client-side hook that combines:
 *  1. Deterministic cosmetic events (generated locally from seeded RNG, no server)
 *  2. Server-authoritative impact events (polled from /api/orbital/active)
 *
 * Returns a merged list of OrbitalEvent objects the UI should render.
 */

import { useState, useEffect, useRef } from "react";
import type { OrbitalEvent } from "@shared/schema";
import {
  getActiveCosmeticEvents,
  epochIndexForTime,
  msUntilNextEpoch,
} from "@shared/orbitalEngine";

const IMPACT_POLL_MS = 30_000; // poll server every 30 seconds for impact events

export function useOrbitalEngine() {
  const [cosmeticEvents, setCosmeticEvents] = useState<OrbitalEvent[]>([]);
  const [impactEvents,   setImpactEvents]   = useState<OrbitalEvent[]>([]);
  const lastEpochRef = useRef(-1);

  // ── Deterministic cosmetic events (client-only, no server) ───────────────
  useEffect(() => {
    function refresh() {
      const now     = Date.now();
      const epoch   = epochIndexForTime(now);
      const active  = getActiveCosmeticEvents(now);

      if (epoch !== lastEpochRef.current) {
        lastEpochRef.current = epoch;
      }

      setCosmeticEvents(active);
    }

    refresh();

    // Re-run every 5 seconds (active events come in/out as time progresses)
    const tickId = setInterval(refresh, 5_000);

    // Also schedule a wakeup at the next epoch boundary so new events appear
    function scheduleNextEpoch() {
      const delay = msUntilNextEpoch(Date.now()) + 50; // +50ms buffer
      const id    = setTimeout(() => {
        refresh();
        scheduleNextEpoch();
      }, delay);
      return id;
    }
    const epochId = scheduleNextEpoch();

    return () => {
      clearInterval(tickId);
      clearTimeout(epochId);
    };
  }, []);

  // ── Server impact events (authoritative) ──────────────────────────────────
  useEffect(() => {
    async function fetchImpacts() {
      try {
        const res  = await fetch("/api/orbital/active");
        if (!res.ok) return;
        const data = await res.json() as { events: OrbitalEvent[] };
        setImpactEvents(data.events ?? []);
        if (data.events?.length) {
          console.log(
            `[ORBITAL-DEBUG] client fetched impact events | count: ${data.events.length} | ids: [${data.events.map((e) => e.id).join(",")}]`
          );
        }
      } catch {
        // Network error — keep stale data
      }
    }

    fetchImpacts(); // fetch immediately on mount
    const id = setInterval(fetchImpacts, IMPACT_POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Merge: cosmetic first, then impacts (impacts rendered on top)
  const allEvents: OrbitalEvent[] = [...cosmeticEvents, ...impactEvents];

  return {
    /** All active orbital events (cosmetic + impact) — ready to render */
    events:         allEvents,
    cosmeticEvents,
    impactEvents,
  };
}
