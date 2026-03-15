/**
 * useGameSocket.ts
 *
 * Connects to the FRONTIER WebSocket server and listens for game_state_update
 * messages. On receipt, invalidates the /api/game/state TanStack Query cache
 * so all components re-render with fresh data without polling.
 *
 * Falls back gracefully: if WebSocket fails to connect or is not supported,
 * the existing 30-second refetchInterval in useGameState remains active.
 */

import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";
import type { GameState } from "@shared/schema";

const WS_RECONNECT_DELAY_MS = 3_000;
const WS_MAX_RECONNECTS = 10;

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
