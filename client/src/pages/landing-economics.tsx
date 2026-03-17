import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";

// ─── Starfield (same as main landing) ────────────────────────────────────────
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
    const draw = (t: number) => {
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
            background: "transparent", border: "1px solid rgba(60,90,180,0.25)", borderRadius: 4,
            padding: "5px 12px", color: "rgba(150,190,255,0.7)", fontSize: 11,
            letterSpacing: "0.1em", textTransform: "uppercase" as const, cursor: "pointer",
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

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

const SECTION_STYLE: React.CSSProperties = {
  fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff",
};

const CARD: React.CSSProperties = {
  background: "rgba(10,12,30,0.8)", border: "1px solid rgba(60,90,180,0.25)",
  borderRadius: 8, padding: 20,
};

const PIE_COLORS = ["#10b981", "#ef4444", "#eab308", "#374151"];

export default function LandingEconomics() {
  const { data } = useQuery<{ totalSupply: number; inGameCirculating: number; totalBurned: number; treasury: number; asaId: number | null; unitName: string; network: string }>({
    queryKey: ["/api/economics"],
    queryFn: () => fetch("/api/economics").then(r => r.json()),
    staleTime: 30_000,
  });

  const pieData = data ? [
    { name: "In Circulation", value: Math.round(data.inGameCirculating) },
    { name: "Burned", value: Math.round(data.totalBurned) },
    { name: "Treasury", value: Math.round(data.treasury) },
    { name: "Unallocated", value: Math.max(0, Math.round(data.totalSupply - data.inGameCirculating - data.totalBurned - data.treasury)) },
  ] : [];

  // Mock trend data for visual
  const trendData = Array.from({ length: 12 }, (_, i) => ({
    month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
    circulating: Math.round(50000 + i * 8000 + Math.random() * 5000),
    burned: Math.round(2000 + i * 600 + Math.random() * 500),
  }));

  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden", ...SECTION_STYLE }}>
      <Starfield />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px 80px" }}>
        <LandingNav />

        <div style={{ width: "100%", maxWidth: 860, display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Hero */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: "#e0eaff", marginBottom: 8 }}>
              Token Economics
            </div>
            <p style={{ fontSize: 14, color: "rgba(150,190,255,0.7)", maxWidth: 600, margin: "0 auto" }}>
              FRONTIER (FRNTR) is the native Algorand ASA powering the game economy. Earn it by owning land, spend it on commanders, buildings, and attacks.
            </p>
          </div>

          {/* Stat cards */}
          {data && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {[
                { label: "Total Supply", value: fmt(data.totalSupply), color: "#60a5fa" },
                { label: "In Circulation", value: fmt(data.inGameCirculating), color: "#10b981" },
                { label: "Burned", value: fmt(data.totalBurned), color: "#ef4444" },
                { label: "Treasury", value: fmt(data.treasury), color: "#eab308" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ ...CARD, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(150,190,255,0.5)" }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Pie chart */}
          <div style={{ ...CARD }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(100,140,200,0.7)", marginBottom: 16 }}>Distribution</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
              <div style={{ flex: "1 1 200px", height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {PIE_COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#0a0b14", border: "1px solid #1f2937", borderRadius: 6, fontSize: 10 }} formatter={(v: number) => [fmt(v), ""]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: 10 }}>
                {pieData.map((d, i) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i], flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 11 }}>
                      <div style={{ color: "rgba(200,220,255,0.9)" }}>{d.name}</div>
                      <div style={{ color: "rgba(150,190,255,0.5)", fontFamily: "monospace" }}>{fmt(d.value || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Area chart trend */}
          <div style={{ ...CARD }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(100,140,200,0.7)", marginBottom: 16 }}>Circulating Supply Trend (Simulated)</div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCirc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradBurn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,90,180,0.1)" />
                  <XAxis dataKey="month" tick={{ fill: "rgba(150,190,255,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(150,190,255,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={45} />
                  <Tooltip contentStyle={{ backgroundColor: "#0a0b14", border: "1px solid #1f2937", borderRadius: 6, fontSize: 10 }} formatter={(v: number) => [fmt(v), ""]} />
                  <Area type="monotone" dataKey="circulating" stroke="#10b981" fill="url(#gradCirc)" strokeWidth={1.5} name="Circulating" />
                  <Area type="monotone" dataKey="burned" stroke="#ef4444" fill="url(#gradBurn)" strokeWidth={1.5} name="Burned" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* How to earn */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[
              { icon: "🏗️", title: "Own Land", desc: "Each biome generates 0.5–1.5 FRONTIER/hr passively based on improvements built." },
              { icon: "⚡", title: "Blockchain Nodes", desc: "Build blockchain infrastructure on your parcels to multiply your daily FRNTR yield." },
              { icon: "🔥", title: "Burn Mechanics", desc: "Minting commanders, special attacks, and upgrades consume tokens — creating deflation." },
              { icon: "🏪", title: "Trade Station", desc: "Trade iron, fuel, crystal and FRONTIER with other players through the in-game market." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ ...CARD }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(200,230,255,0.9)", marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 11, color: "rgba(150,190,255,0.6)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ textAlign: "center", paddingTop: 20 }}>
            <button
              onClick={() => { window.location.href = "/game"; }}
              style={{ background: "rgba(60,100,255,0.25)", border: "1px solid rgba(100,150,255,0.5)", borderRadius: 6, padding: "12px 32px", color: "rgba(180,220,255,0.95)", fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}
            >Enter the Frontier →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
