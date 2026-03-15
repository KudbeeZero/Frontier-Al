/**
 * StreamOverlay.tsx
 *
 * Fullscreen streaming HUD for Frontier-AL.
 *
 * Activated by appending ?stream=1 to the game URL.
 * Designed for Twitch/YouTube live broadcast — pure spectator view:
 *  - Top bar: season countdown, live player count, % world claimed
 *  - Right panel: scrolling live narrative event ticker
 *  - Bottom: top-5 leaderboard
 *  - Globe: enlarged, auto-rotating to active battle hotspots (via streamMode prop on PlanetGlobe)
 *  - No wallet/purchase UI
 *
 * Usage: renders as an overlay on top of PlanetGlobe when ?stream=1 is present.
 */

import { useMemo, useState, useEffect } from "react";
import type { GameState, LeaderboardEntry } from "@shared/schema";

interface StreamOverlayProps {
  gameState: GameState | null | undefined;
  /** Pre-formatted season countdown string, e.g. "14d 3h 22m" or null */
  seasonCountdown: string | null;
  seasonName: string | null;
}

const TICKER_INTERVAL_MS = 4_000; // advance ticker every 4s

export function StreamOverlay({ gameState, seasonCountdown, seasonName }: StreamOverlayProps) {
  const [tickerIdx, setTickerIdx] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  // Collect narrative events from recent game events
  const narrativeEvents = useMemo(() => {
    if (!gameState?.events) return [];
    return gameState.events
      .filter((e): e is typeof e & { narrativeText: string } => !!(e as any).narrativeText)
      .slice(0, 20)
      .map(e => ({
        id: e.id,
        text: (e as any).narrativeText as string,
        ts: e.timestamp,
      }))
      .reverse(); // newest first
  }, [gameState?.events]);

  // Auto-advance ticker
  useEffect(() => {
    if (narrativeEvents.length === 0) return;
    const t = setInterval(() => {
      setTickerIdx(i => (i + 1) % Math.max(1, narrativeEvents.length));
    }, TICKER_INTERVAL_MS);
    return () => clearInterval(t);
  }, [narrativeEvents.length]);

  const topLeaderboard: LeaderboardEntry[] = useMemo(
    () => (gameState?.leaderboard ?? []).slice(0, 5),
    [gameState?.leaderboard]
  );

  const totalPlots    = gameState?.totalPlots   ?? 21000;
  const claimedPlots  = gameState?.claimedPlots ?? 0;
  const claimedPct    = totalPlots > 0 ? ((claimedPlots / totalPlots) * 100).toFixed(1) : "0.0";
  const humanPlayers  = (gameState?.players ?? []).filter(p => !p.isAI).length;
  const activeBattles = (gameState?.battles ?? []).filter(b => b.status === "pending").length;

  const utcTime = new Date(now).toISOString().slice(11, 19) + " UTC";

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-50 overflow-hidden">

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3"
        style={{
          background: "linear-gradient(180deg, rgba(1,3,10,0.92) 0%, rgba(1,3,10,0) 100%)",
          fontFamily: "monospace",
        }}
      >
        {/* Left: branding */}
        <div style={{ fontSize: 13, letterSpacing: "0.4em", color: "rgba(0,229,255,0.9)", textTransform: "uppercase" }}>
          FRONTIER · LIVE
        </div>

        {/* Center: season countdown */}
        <div className="flex flex-col items-center" style={{ fontSize: 11, letterSpacing: "0.2em" }}>
          {seasonName && (
            <div style={{ color: "rgba(0,229,255,0.55)", fontSize: 9, letterSpacing: "0.3em" }}>
              {seasonName.toUpperCase()}
            </div>
          )}
          {seasonCountdown && (
            <div style={{ color: "rgba(0,229,255,0.95)", fontSize: 14, fontWeight: "bold" }}>
              {seasonCountdown}
            </div>
          )}
          {!seasonCountdown && (
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>NO ACTIVE SEASON</div>
          )}
        </div>

        {/* Right: stats */}
        <div className="flex gap-6" style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(255,255,255,0.6)" }}>
          <span><span style={{ color: "#00ff88" }}>COLONIZERS</span> {humanPlayers}</span>
          <span><span style={{ color: "#ff6d00" }}>BATTLES</span> {activeBattles}</span>
          <span><span style={{ color: "#4fc3f7" }}>CLAIMED</span> {claimedPct}%</span>
          <span style={{ color: "rgba(255,255,255,0.35)" }}>{utcTime}</span>
        </div>
      </div>

      {/* ── Right: live event ticker ──────────────────────────────────── */}
      <div
        className="absolute right-4 flex flex-col gap-2"
        style={{
          top: "80px",
          width: 320,
          maxHeight: "calc(100% - 180px)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.3em",
            color: "rgba(0,229,255,0.5)",
            fontFamily: "monospace",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          LIVE EVENTS
        </div>
        {narrativeEvents.length === 0 && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
            Awaiting events…
          </div>
        )}
        {narrativeEvents.slice(0, 8).map((e, i) => (
          <div
            key={e.id}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              fontFamily: "monospace",
              fontSize: 11,
              lineHeight: 1.5,
              background: i === 0 ? "rgba(0,229,255,0.08)" : "rgba(4,8,20,0.7)",
              border: i === 0 ? "1px solid rgba(0,229,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
              color: i === 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
              transition: "all 0.4s ease",
            }}
          >
            {e.text}
          </div>
        ))}
      </div>

      {/* ── Bottom: leaderboard ───────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-4"
        style={{ background: "linear-gradient(0deg, rgba(1,3,10,0.92) 0%, rgba(1,3,10,0) 100%)" }}
      >
        <div className="flex gap-3 items-end">
          {topLeaderboard.map((entry, i) => (
            <div
              key={entry.playerId}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontFamily: "monospace",
                background: i === 0 ? "rgba(255,215,0,0.1)" : "rgba(4,8,20,0.75)",
                border: i === 0 ? "1px solid rgba(255,215,0,0.3)" : "1px solid rgba(255,255,255,0.08)",
                minWidth: 110,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 8, letterSpacing: "0.25em", color: i === 0 ? "rgba(255,215,0,0.7)" : "rgba(255,255,255,0.35)", marginBottom: 2 }}>
                #{i + 1} {entry.isAI ? "AI" : "HUMAN"}
              </div>
              <div style={{ fontSize: 12, color: i === 0 ? "#ffd700" : "rgba(255,255,255,0.7)", fontWeight: "bold" }}>
                {entry.name.length > 10 ? entry.name.slice(0, 10) + "…" : entry.name}
              </div>
              <div style={{ fontSize: 10, color: "rgba(0,229,255,0.7)", marginTop: 1 }}>
                {entry.territories} plots
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Corner: REC indicator ─────────────────────────────────────── */}
      {activeBattles > 0 && (
        <div
          className="absolute top-4 right-6 flex items-center gap-2"
          style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.25em", color: "#ff1744" }}
        >
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: "#ff1744",
            display: "inline-block", animation: "pulse 1.2s infinite",
          }} />
          LIVE
        </div>
      )}
    </div>
  );
}
