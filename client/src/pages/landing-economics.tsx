import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { LandingNav, LandingFooter, Starfield, SHARED_CSS } from "./landing-shared";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

const CARD: React.CSSProperties = {
  background: "rgba(10,12,30,0.82)", border: "1px solid rgba(60,90,180,0.25)",
  borderRadius: 8, padding: 20,
};

const PIE_COLORS = ["#10b981", "#ef4444", "#eab308", "#374151"];

export default function LandingEconomics() {
  const [, setLocation] = useLocation();
  const { data } = useQuery<{ totalSupply: number; inGameCirculating: number; totalBurned: number; treasury: number; asaId: number | null; unitName: string; network: string }>({
    queryKey: ["/api/economics"],
    queryFn: () => fetch("/api/economics").then(r => r.json()),
    staleTime: 30_000,
  });

  const pieData = data ? [
    { name: "In Circulation", value: Math.round(data.inGameCirculating) },
    { name: "Burned",         value: Math.round(data.totalBurned) },
    { name: "Treasury",       value: Math.round(data.treasury) },
    { name: "Unallocated",    value: Math.max(0, Math.round(data.totalSupply - data.inGameCirculating - data.totalBurned - data.treasury)) },
  ] : [];

  const trendData = Array.from({ length: 12 }, (_, i) => ({
    month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
    circulating: Math.round(50000 + i * 8000 + Math.sin(i) * 5000),
    burned:      Math.round(2000  + i * 600  + Math.cos(i) * 400),
  }));

  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden", fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff" }}>
      <Starfield />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px 80px" }}>
        <LandingNav activePath="/info/economics" />

        <div style={{ width: "100%", maxWidth: 860, display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ textAlign: "center", animation: "fadeInUp 0.8s ease-out forwards" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "rgba(100,160,255,0.55)", textTransform: "uppercase", marginBottom: 10 }}>— On-Chain Economy —</div>
            <div className="glitch-text" style={{ fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e0eaff", marginBottom: 8 }}>
              Token Economics
            </div>
            <p style={{ fontSize: 14, color: "rgba(150,190,255,0.65)", maxWidth: 600, margin: "0 auto" }}>
              FRONTIER (FRNTR) is the native Algorand ASA powering the game economy. Earn it by owning land, spend it on commanders, buildings, and attacks.
            </p>
          </div>

          {data && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, animation: "fadeInUp 0.7s ease-out 0.1s both" }}>
              {[
                { label: "Total Supply",   value: fmt(data.totalSupply),         color: "#60a5fa" },
                { label: "In Circulation", value: fmt(data.inGameCirculating),   color: "#10b981" },
                { label: "Burned",         value: fmt(data.totalBurned),         color: "#ef4444" },
                { label: "Treasury",       value: fmt(data.treasury),            color: "#eab308" },
              ].map(({ label, value, color }) => (
                <div key={label} className="border-glow" style={{ ...CARD, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(150,190,255,0.5)" }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ ...CARD, animation: "fadeInUp 0.7s ease-out 0.2s both" }}>
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

          <div style={{ ...CARD, animation: "fadeInUp 0.7s ease-out 0.3s both" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(100,140,200,0.7)", marginBottom: 16 }}>Circulating Supply Trend (Projected)</div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCirc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradBurn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,90,180,0.1)" />
                  <XAxis dataKey="month" tick={{ fill: "rgba(150,190,255,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(150,190,255,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={45} />
                  <Tooltip contentStyle={{ backgroundColor: "#0a0b14", border: "1px solid #1f2937", borderRadius: 6, fontSize: 10 }} formatter={(v: number) => [fmt(v), ""]} />
                  <Area type="monotone" dataKey="circulating" stroke="#10b981" fill="url(#gradCirc)" strokeWidth={1.5} name="Circulating" />
                  <Area type="monotone" dataKey="burned"      stroke="#ef4444" fill="url(#gradBurn)" strokeWidth={1.5} name="Burned" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, animation: "fadeInUp 0.7s ease-out 0.4s both" }}>
            {[
              { icon: "🏗️", title: "Own Land",         desc: "Each biome generates 0.5–1.5 FRONTIER/hr passively based on improvements built." },
              { icon: "⚡", title: "Blockchain Nodes", desc: "Build blockchain infrastructure on your parcels to multiply your daily FRNTR yield." },
              { icon: "🔥", title: "Burn Mechanics",   desc: "Minting commanders, special attacks, and upgrades consume tokens — creating deflation." },
              { icon: "🏪", title: "Trade Station",    desc: "Trade iron, fuel, crystal and FRONTIER with other players through the in-game market." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ ...CARD }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(200,230,255,0.9)", marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 11, color: "rgba(150,190,255,0.6)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", paddingTop: 20 }}>
            <button onClick={() => setLocation("/game")} style={{
              background: "rgba(60,100,255,0.25)", border: "1px solid rgba(100,150,255,0.5)",
              borderRadius: 6, padding: "12px 32px", color: "rgba(180,220,255,0.95)",
              fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase",
              cursor: "pointer", fontWeight: 700, fontFamily: "inherit",
            }}>Enter the Frontier →</button>
          </div>
        </div>

        <LandingFooter />
      </div>
      <style>{SHARED_CSS}</style>
    </div>
  );
}
