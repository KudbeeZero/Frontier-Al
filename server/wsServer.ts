/**
 * server/wsServer.ts
 *
 * FRONTIER WebSocket broadcast server.
 * Wraps the Node.js http.Server with a ws.WebSocketServer.
 * Provides a single broadcast function used by routes to push game state
 * changes to all connected clients.
 *
 * Message envelope format:
 *   { type: "game_state_update", payload: GameState }
 *   { type: "ping" }
 *
 * Clients MUST respond to "ping" with "pong" within 30 seconds or they
 * are terminated. This keeps the Replit connection alive through its
 * proxy idle timeout.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

let _wss: WebSocketServer | null = null;

export function initWsServer(httpServer: Server): WebSocketServer {
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

    // Ping this client every 25 seconds to keep Replit proxy alive
    const pingInterval = setInterval(() => {
      if (!alive) { clearInterval(pingInterval); ws.terminate(); return; }
      alive = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25_000);

    ws.on("close", () => clearInterval(pingInterval));
  });

  console.log("[ws] WebSocket server attached to /ws");
  return _wss;
}

export function broadcastGameState(payload: unknown): void {
  if (!_wss) return;
  const msg = JSON.stringify({ type: "game_state_update", payload });
  for (const client of _wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}
