/**
 * useGameSocket.ts
 *
 * Connects to the FRONTIER WebSocket server and listens for game_state_update
 * and world_event messages. On game_state_update, invalidates the /api/game/state
 * TanStack Query cache so all components re-render with fresh data without polling.
 * On world_event, pushes the event into a global callback system for the Activity Feed.
 *
 * Falls back gracefully: if WebSocket fails to connect or is not supported,
 * the existing 30-second refetchInterval in useGameState remains active.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { queryClient } from "@/lib/queryClient";
import type { GameState } from "@shared/schema";
import type { WorldEvent } from "@shared/worldEvents";

const WS_RECONNECT_DELAY_MS = 3_000;
const WS_MAX_RECONNECTS = 10;

// ── Global event bus for world events (Activity Feed) ────────────────────────
type WorldEventCallback = (event: WorldEvent) => void;
const _worldEventCallbacks: Map<number, WorldEventCallback> = new Map();
let _callbackId = 0;

/** Register a callback to receive world events in real-time. */
export function onWorldEvent(cb: WorldEventCallback): () => void {
  const id = ++_callbackId;
  _worldEventCallbacks.set(id, cb);
  return () => _worldEventCallbacks.delete(id);
}

/** Dispatch a world event to all registered callbacks. */
function dispatchWorldEvent(event: WorldEvent): void {
  for (const cb of _worldEventCallbacks.values()) {
    try { cb(event); } catch { /* ignore */ }
  }
}

export function useGameSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      if (reconnectCount.current >= WS_MAX_RECONNECTS) return;

      // MIGRATION: WebSocket URL now driven by VITE_WS_URL env var
      const wsBase = import.meta.env.VITE_WS_URL;
      const url = wsBase
        ? `${wsBase}/ws`
        : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectCount.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
            return;
          }
          if (msg.type === "game_state_update" && msg.payload) {
            // Directly set the cache — no refetch round-trip needed
            queryClient.setQueryData<GameState>(
              ["/api/game/state"],
              msg.payload as GameState
            );
          }
          // NEW: Stream individual world events to Activity Feed
          if (msg.type === "world_event" && msg.payload) {
            dispatchWorldEvent(msg.payload as WorldEvent);
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        wsRef.current = null;
        reconnectCount.current += 1;
        reconnectTimer.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);
}

/**
 * Hook that subscribes to world events from the WebSocket connection.
 * Returns the latest N events (most recent first).
 */
export function useLiveWorldEvents(maxEvents = 50): WorldEvent[] {
  const eventsRef = useRef<WorldEvent[]>([]);
  const [, setTick] = useState(0);

  const update = useCallback(() => {
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    const unsub = onWorldEvent((event: WorldEvent) => {
      eventsRef.current = [event, ...eventsRef.current].slice(0, maxEvents);
      update();
    });
    return unsub;
  }, [maxEvents, update]);

  return eventsRef.current;
}
