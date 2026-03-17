import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

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

const SECTION_STYLE: React.CSSProperties = {
  fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff",
};

const CARD: React.CSSProperties = {
  background: "rgba(10,12,30,0.8)", border: "1px solid rgba(60,90,180,0.25)",
  borderRadius: 8, padding: 20,
};

const FEATURES = [
  {
    icon: "🌍",
    title: "3D Planetary Globe",
    color: "#3b82f6",
    tagline: "Your battlefield, rendered in three dimensions",
    bullets: [
      "WebGL-powered real-time 3D globe with 500+ land parcels",
      "Zoom, rotate, and orbit to survey the entire battlefield",
      "Biome diversity: desert, forest, tundra, ocean, volcanic",
      "Live territory overlays showing ownership in real time",
      "Mobile-optimised touch controls — pinch to zoom, swipe to orbit",
    ],
  },
  {
    icon: "🤖",
    title: "AI Factions",
    color: "#a78bfa",
    tagline: "The planet pushes back",
    bullets: [
      "Persistent AI factions contest unowned land automatically",
      "Three AI aggression profiles: defensive, balanced, expansionist",
      "AI factions build improvements, attack, and trade independently",
      "Defeat AI commanders to claim their parcels and loot resources",
      "Seasonal AI scaling — harder each phase of the season cycle",
    ],
  },
  {
    icon: "🔗",
    title: "Algorand Blockchain",
    color: "#10b981",
    tagline: "True ownership, on-chain",
    bullets: [
      "Commander NFTs minted as Algorand Standard Assets (ASAs)",
      "FRONTIER (FRNTR) token — real ASA on Algorand MainNet",
      "Sub-1-second transaction finality with near-zero fees",
      "All NFT metadata stored on-chain — permanent, immutable",
      "Pera Wallet and WalletConnect 2.0 integration built-in",
    ],
  },
  {
    icon: "⚔️",
    title: "Territory Wars",
    color: "#ef4444",
    tagline: "Every sub-parcel is a battlefield",
    bullets: [
      "Attack full plots or individual sub-parcels within enemy land",
      "Deterministic battle engine — seeded RNG, no hidden randomness",
      "Resource allocation: split troops, iron, fuel, crystal per raid",
      "Special abilities: EMP Pulse, Orbital Strike, Shield Overcharge",
      "Win and seize ownership; lose and pay a resource tribute",
    ],
  },
  {
    icon: "💰",
    title: "Resource Economy",
    color: "#eab308",
    tagline: "Mine, refine, trade, repeat",
    bullets: [
      "Three resource types: Iron (industrial), Fuel (energy), Crystal (rare)",
      "Passive income streams from biome-specific improvements",
      "Refineries convert raw iron into higher-value fuel cells",
      "Blockchain Nodes multiply FRONTIER token yield per hour",
      "On-chain Trade Station for player-to-player resource exchange",
    ],
  },
  {
    icon: "🦾",
    title: "Commander NFTs",
    color: "#f97316",
    tagline: "Your AI companion, your identity",
    bullets: [
      "Three mint tiers: Sentinel (entry), Phantom (mid), Reaper (elite)",
      "Each tier paired with a unique AI animal companion",
      "Iron Wolf 🐺 · Shadow Fox 🦊 · Apex Raptor 🦅",
      "Live battle statistics tracked on every commander card",
      "Trade commanders on the open market — scarcity drives value",
    ],
  },
];

export default function LandingFeatures() {
  const [, setLocation] = useLocation();
  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden", ...SECTION_STYLE }}>
      <Starfield />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px 80px" }}>
        <LandingNav />

        <div style={{ width: "100%", maxWidth: 860, display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Hero */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: "#e0eaff", marginBottom: 8 }}>
              Features
            </div>
            <p style={{ fontSize: 14, color: "rgba(150,190,255,0.7)", maxWidth: 600, margin: "0 auto" }}>
              A full-stack strategy game built on Algorand — 3D territory, AI opponents, NFT commanders, and a real on-chain economy.
            </p>
          </div>

          {/* Feature deep-dives */}
          {FEATURES.map((feat) => (
            <div key={feat.title} style={{
              ...CARD,
              borderLeft: `3px solid ${feat.color}60`,
              display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start",
            }}>
              {/* Icon + title column */}
              <div style={{ flex: "0 0 180px", minWidth: 140 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{feat.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: feat.color, marginBottom: 4 }}>{feat.title}</div>
                <div style={{ fontSize: 10, color: "rgba(150,190,255,0.5)", fontStyle: "italic", lineHeight: 1.5 }}>{feat.tagline}</div>
              </div>
              {/* Bullets column */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                  {feat.bullets.map((b, i) => (
                    <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: feat.color, fontSize: 10, marginTop: 2, flexShrink: 0 }}>◆</span>
                      <span style={{ fontSize: 12, color: "rgba(170,200,255,0.8)", lineHeight: 1.6 }}>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          {/* Quick stats strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {[
              { val: "500+", label: "Land Parcels" },
              { val: "9", label: "Sub-Parcels / Plot" },
              { val: "3", label: "Commander Tiers" },
              { val: "5", label: "Biome Types" },
              { val: "< 1s", label: "Tx Finality" },
              { val: "∞", label: "Seasons" },
            ].map(({ val, label }) => (
              <div key={label} style={{ ...CARD, textAlign: "center", padding: 16 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#60a5fa", marginBottom: 4 }}>{val}</div>
                <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(150,190,255,0.45)" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ textAlign: "center", paddingTop: 8 }}>
            <button
              onClick={() => setLocation("/game")}
              style={{ background: "rgba(60,100,255,0.25)", border: "1px solid rgba(100,150,255,0.5)", borderRadius: 6, padding: "12px 32px", color: "rgba(180,220,255,0.95)", fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}
            >Enter the Frontier →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
