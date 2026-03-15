/**
 * server/wsServer.ts
 *
 * FRONTIER WebSocket broadcast server.
 *
 * Dirty-flag + debounce design:
 *   - Any part of the server calls markDirty() when game state changes.
 *   - A flush loop runs every FLUSH_INTERVAL_MS. If dirty, it fetches
 *     game state once and broadcasts to all clients. Then clears the flag.
 *   - Player action handlers call markDirty() instead of the old pattern
 *     of getGameState() + broadcastGameState() inline.
 *   - Result: no matter how many actions fire in one flush window, exactly
 *     one DB read and one broadcast round occurs per interval.
 *
 * Message envelope format:
 *   { type: "game_state_update", payload: GameState }
 *   { type: "ping" }
 *
 * Clients MUST respond to "ping" with "pong" within 30 seconds or they
 * are terminated.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IStorage } from "./storage";

const FLUSH_INTERVAL_MS = 1_500;

let _wss: WebSocketServer | null = null;
let _storage: IStorage | null = null;
let _dirty = false;
let _flushTimer: ReturnType<typeof setInterval> | null = null;

export function initWsServer(httpServer: Server, storage: IStorage): WebSocketServer {
  _storage = storage;
  _wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  _wss.on("connection", (ws) => {
    let alive = true;

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "pong") alive = true;
      } catch { /* ignore malformed */ }
    });

    ws.on("error", () => ws.terminate());

    // Ping every 25 s to keep reverse-proxy connections alive
    const pingInterval = setInterval(() => {
      if (!alive) { clearInterval(pingInterval); ws.terminate(); return; }
      alive = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25_000);

    ws.on("close", () => clearInterval(pingInterval));

    // Send current state immediately to the newly connected client
    markDirty();
  });

  // Flush loop — one DB read + broadcast per interval when dirty
  _flushTimer = setInterval(async () => {
    if (!_dirty || !_storage || !_wss) return;
    if (_wss.clients.size === 0) { _dirty = false; return; }
    _dirty = false;
    try {
      const gameState = await _storage.getGameState();
      _broadcastRaw({ type: "game_state_update", payload: gameState });
    } catch (err) {
      console.warn("[ws] flush error:", err instanceof Error ? err.message : err);
      _dirty = true;
    }
  }, FLUSH_INTERVAL_MS);

  console.log(`[ws] WebSocket server attached to /ws (flush every ${FLUSH_INTERVAL_MS}ms)`);
  return _wss;
}

/** Mark game state as changed. Next flush tick will broadcast. */
export function markDirty(): void {
  _dirty = true;
}

/** Send a pre-serialized object to all open clients. Internal use only. */
function _broadcastRaw(obj: unknown): void {
  if (!_wss) return;
  const msg = JSON.stringify(obj);
  for (const client of _wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

/**
 * broadcastRaw — send any custom message envelope to all connected clients.
 * Use for non-game-state events such as TRADE_FILLED notifications.
 */
export function broadcastRaw(obj: unknown): void {
  _broadcastRaw(obj);
}

/**
 * broadcastGameState — kept for backward compatibility.
 * Callers that already have a fresh gameState object can push it immediately
 * without waiting for the flush tick. Used by routes that need instant feedback
 * (e.g. purchase confirmation). Clears the dirty flag since state is now fresh.
 */
export function broadcastGameState(payload: unknown): void {
  _dirty = false;
  _broadcastRaw({ type: "game_state_update", payload });
}
