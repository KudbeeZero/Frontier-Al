import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

// ─── Starfield ────────────────────────────────────────────────────────────────
function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 1.2 + 0.2, speed: Math.random() * 0.08 + 0.01,
      opacity: Math.random() * 0.5 + 0.2, twinkle: Math.random() * Math.PI * 2,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bg = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.4, 0, canvas.width * 0.5, canvas.height * 0.4, canvas.width * 0.8);
      bg.addColorStop(0, "#05060f"); bg.addColorStop(0.5, "#020308"); bg.addColorStop(1, "#000002");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.x += s.speed; s.twinkle += 0.02;
        if (s.x > canvas.width) s.x = 0;
        const op = s.opacity * (0.7 + 0.3 * Math.sin(s.twinkle));
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${op})`; ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }} />;
}

// ─── LandingNav ───────────────────────────────────────────────────────────────
function LandingNav() {
  const [, setLocation] = useLocation();
  const links = [
    { label: "Home", path: "/" },
    { label: "Economics", path: "/info/economics" },
    { label: "Gameplay", path: "/info/gameplay" },
    { label: "Features", path: "/info/features" },
    { label: "Updates", path: "/info/updates" },
  ];
  return (
    <nav style={{
      width: "100%", maxWidth: 900, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "16px 0",
      borderBottom: "1px solid rgba(60,90,180,0.15)", marginBottom: 40,
      flexWrap: "wrap", gap: 8,
    }}>
      <span style={{ fontSize: 13, letterSpacing: "0.2em", color: "rgba(120,170,255,0.9)", fontWeight: 700, textTransform: "uppercase" }}>⬡ FRONTIER</span>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        {links.map(({ label, path }) => (
          <button key={path} onClick={() => setLocation(path)} style={{
            background: path === "/info/updates" ? "rgba(60,100,255,0.1)" : "transparent",
            border: path === "/info/updates" ? "1px solid rgba(80,130,255,0.5)" : "1px solid rgba(60,90,180,0.25)",
            borderRadius: 4, padding: "5px 12px",
            color: path === "/info/updates" ? "rgba(150,200,255,0.95)" : "rgba(150,190,255,0.7)",
            fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" as const, cursor: "pointer",
            fontWeight: path === "/info/updates" ? 600 : 400,
          }}>{label}</button>
        ))}
        <button onClick={() => setLocation("/game")} style={{
          marginLeft: 8, background: "rgba(60,100,255,0.2)", border: "1px solid rgba(80,130,255,0.5)",
          borderRadius: 4, padding: "5px 14px", color: "rgba(150,200,255,0.95)", fontSize: 11,
          letterSpacing: "0.12em", textTransform: "uppercase" as const, cursor: "pointer", fontWeight: 600,
        }}>Enter Game →</button>
      </div>
    </nav>
  );
}

// ─── Changelog Data ───────────────────────────────────────────────────────────

const ACTIVE_UPDATES = [
  {
    label: "Sub-Parcel Archetype System",
    status: "in_progress" as const,
    date: "2026-03-17",
    detail: "4 strategic archetypes (Resource / Trade / Fortress / Energy) with faction bonuses, grid composition limits, and power dependency mechanics. DB schema + API complete; frontend UI in progress.",
  },
  {
    label: "Biome-Differentiated Parcel Costs",
    status: "complete" as const,
    date: "2026-03-17",
    detail: "BIOME_UPGRADE_DISCOUNTS applied server-side on all sub-parcel improvements. Frontend shows biome badge, discount indicators, and affordability tooltips.",
  },
  {
    label: "Blockchain Upgrade Recording",
    status: "complete" as const,
    date: "2026-03-17",
    detail: "All sub-parcel upgrade events are recorded as on-chain Algorand notes via upgrades.ts. Real biome strings in all world events.",
  },
];

const RECENT_CHANGES = [
  { date: "2026-03-17", area: "Backend",    note: "POST /api/sub-parcels/:id/archetype — assign archetype with faction bonus calc" },
  { date: "2026-03-17", area: "Backend",    note: "assignSubParcelArchetype() in db.ts — transactional archetype assignment with grid limit enforcement" },
  { date: "2026-03-17", area: "Schema",     note: "SubParcelArchetype, EnergyAlignment types added to shared/schema.ts" },
  { date: "2026-03-17", area: "Database",   note: "archetype, archetypeLevel, energyAlignment columns added to sub_parcels table" },
  { date: "2026-03-17", area: "Redis",      note: "recordArchetypeWorldEvent() — archetype assignments tracked in Upstash world event stream (24h TTL)" },
  { date: "2026-03-17", area: "Game Rules", note: "canAssignArchetype(), computeArchetypeFactionBonus(), computeGridPowerDependency() added" },
  { date: "2026-03-17", area: "Frontend",   note: "Biome badge + cost discount/premium UI in SubParcelUpgradePanel" },
  { date: "2026-03-17", area: "Blockchain", note: "On-chain upgrade notes recording via Algorand (upgrades.ts)" },
  { date: "2026-03-17", area: "WebSocket",  note: "Real-time broadcasts for sub_parcel_purchased, sub_parcel_upgraded, sub_parcel_archetype_set" },
];

const UPCOMING = [
  { phase: "5.9", label: "Archetype Selector UI", detail: "Frontend panel in SubParcelUpgradePanel for picking and assigning archetypes" },
  { phase: "5.9", label: "Power Dependency Indicator", detail: "Fortress offline badge when no energy parcel in grid; resource throttle warning" },
  { phase: "5.9", label: "Fortress Siege System", detail: "3-phase siege battles: Breach → Interior → Extraction with armor loot drops" },
  { phase: "5.9", label: "Resource Parcel Depth", detail: "Extraction nodes with depletion/regrowth curves; mining rig + refinery improvements" },
  { phase: "5.9", label: "Trade Parcel Depth", detail: "Market stalls, tax bands, trade routes, economic warfare mechanics" },
  { phase: "2",   label: "Rare Minerals & Loot", detail: "Xenorite, Void Shard, Plasma Core, Dark Matter drops with biome-specific rates" },
  { phase: "3",   label: "Landmarks", detail: "4 mega-structures: Launchpad, Orbital Dome, Quantum Forge, Ancient Relay" },
  { phase: "8",   label: "Commander Dashboard", detail: "In-game analytics hub — territory metrics, resource income charts, archetype breakdown, faction bonuses" },
];

const BACKLOG = [
  { phase: "4", label: "Season Expansion", detail: "3-phase seasons (Expansion/Conflict/Domination) with enhanced rewards and leaderboard lock" },
  { phase: "6", label: "Visual Polish", detail: "5-layer color blending, landmark 3D models, sub-parcel grid overlay at medium zoom" },
  { phase: "7", label: "Guilds & Community", detail: "Guild wars, seasonal sieges, leaderboard seasons, battle replay sharing" },
  { phase: "1", label: "PlanetGlobe Refactor", detail: "Modularize PlanetGlobe.tsx into focused components for maintainability" },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "in_progress" | "complete" | "planned" }) {
  const cfg = {
    in_progress: { label: "IN PROGRESS", color: "#eab308", bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.3)" },
    complete:    { label: "COMPLETE",    color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)" },
    planned:     { label: "PLANNED",     color: "#6b7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.3)" },
  }[status];
  return (
    <span style={{
      fontSize: 9, letterSpacing: "0.15em", fontWeight: 700, padding: "2px 7px",
      borderRadius: 3, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      textTransform: "uppercase",
    }}>{cfg.label}</span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "rgba(10,12,30,0.8)", border: "1px solid rgba(60,90,180,0.25)",
  borderRadius: 8, padding: 20,
};

const MONO: React.CSSProperties = {
  fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff",
};

export default function LandingUpdates() {
  const { data: worldData } = useQuery<{ playerCount?: number; parcelCount?: number; totalBurned?: number; inGameCirculating?: number }>({
    queryKey: ["/api/economics"],
    queryFn: () => fetch("/api/economics").then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { data: leaderboard } = useQuery<{ name: string; territories: number; totalFrontierEarned: number }[]>({
    queryKey: ["/api/game/leaderboard"],
    queryFn: () => fetch("/api/game/leaderboard").then(r => r.json()),
    staleTime: 60_000,
  });

  const topPlayer = leaderboard?.[0];

  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden", ...MONO }}>
      <Starfield />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px 80px" }}>
        <LandingNav />

        {/* Header */}
        <div style={{ width: "100%", maxWidth: 900, textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", color: "rgba(100,160,255,0.6)", textTransform: "uppercase", marginBottom: 12 }}>Live Development Log</div>
          <h1 style={{ fontSize: 36, fontWeight: 700, color: "#fff", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            Updates &amp; Changelog
          </h1>
          <p style={{ fontSize: 14, color: "rgba(160,190,255,0.6)", maxWidth: 520, margin: "0 auto" }}>
            Transparent development progress — what shipped, what's in flight, and what's on the horizon.
          </p>
        </div>

        {/* Live World Stats */}
        <div style={{ width: "100%", maxWidth: 900, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 48 }}>
          {[
            { label: "FRNTR Circulating", value: worldData?.inGameCirculating != null ? Math.round(worldData.inGameCirculating).toLocaleString() : "—" },
            { label: "FRNTR Burned", value: worldData?.totalBurned != null ? Math.round(worldData.totalBurned).toLocaleString() : "—" },
            { label: "Top Commander", value: topPlayer?.name ?? "—" },
            { label: "Build Date", value: "March 2026" },
          ].map(({ label, value }) => (
            <div key={label} style={{ ...CARD, textAlign: "center" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(100,150,255,0.5)", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#7eb8ff" }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", gap: 40 }}>

          {/* Active Updates */}
          <section>
            <h2 style={{ fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(100,160,255,0.7)", marginBottom: 16 }}>Active Updates</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ACTIVE_UPDATES.map((u) => (
                <div key={u.label} style={{ ...CARD, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#c0d8ff" }}>{u.label}</span>
                    <StatusBadge status={u.status} />
                    <span style={{ fontSize: 10, color: "rgba(120,150,200,0.5)", marginLeft: "auto" }}>{u.date}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(150,180,230,0.7)", margin: 0, lineHeight: 1.6 }}>{u.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Changes */}
          <section>
            <h2 style={{ fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(100,160,255,0.7)", marginBottom: 16 }}>Recent Changes</h2>
            <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(60,90,180,0.2)" }}>
                    {["Date", "Area", "Change"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(100,150,255,0.5)", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RECENT_CHANGES.map((r, i) => (
                    <tr key={i} style={{ borderBottom: i < RECENT_CHANGES.length - 1 ? "1px solid rgba(60,90,180,0.1)" : "none" }}>
                      <td style={{ padding: "9px 16px", color: "rgba(120,150,200,0.5)", whiteSpace: "nowrap" }}>{r.date}</td>
                      <td style={{ padding: "9px 16px", color: "#7eb8ff", whiteSpace: "nowrap" }}>{r.area}</td>
                      <td style={{ padding: "9px 16px", color: "rgba(200,220,255,0.8)" }}>{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Upcoming */}
          <section>
            <h2 style={{ fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(100,160,255,0.7)", marginBottom: 16 }}>Coming Up</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {UPCOMING.map((u) => (
                <div key={u.label} style={{ ...CARD, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(60,90,200,0.2)", border: "1px solid rgba(80,120,255,0.25)", borderRadius: 3, color: "rgba(120,170,255,0.7)", letterSpacing: "0.1em" }}>PHASE {u.phase}</span>
                    <StatusBadge status="planned" />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#c0d8ff" }}>{u.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(140,170,220,0.6)", lineHeight: 1.5 }}>{u.detail}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Backlog */}
          <section>
            <h2 style={{ fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(100,160,255,0.7)", marginBottom: 16 }}>Backlog</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {BACKLOG.map((b) => (
                <div key={b.label} style={{ ...CARD, display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <span style={{ fontSize: 9, padding: "3px 7px", background: "rgba(30,30,60,0.6)", border: "1px solid rgba(60,90,180,0.2)", borderRadius: 3, color: "rgba(100,130,200,0.6)", letterSpacing: "0.1em", whiteSpace: "nowrap", marginTop: 2 }}>PHASE {b.phase}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(180,200,240,0.8)", marginBottom: 4 }}>{b.label}</div>
                    <div style={{ fontSize: 11, color: "rgba(120,150,200,0.55)", lineHeight: 1.5 }}>{b.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <p style={{ fontSize: 12, color: "rgba(120,160,220,0.5)", marginBottom: 16 }}>Fully on-chain strategy — built in public.</p>
            <button
              onClick={() => { const [, setLoc] = [null, (p: string) => { window.location.href = p; }]; setLoc("/game"); }}
              style={{
                background: "rgba(60,100,255,0.25)", border: "1px solid rgba(80,130,255,0.5)",
                borderRadius: 6, padding: "10px 28px", color: "rgba(160,210,255,0.95)", fontSize: 12,
                letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontWeight: 600,
              }}
            >Enter Game →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
