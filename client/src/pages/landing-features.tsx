import { useLocation } from "wouter";
import { LandingNav, LandingFooter, Starfield, SHARED_CSS } from "./landing-shared";

const CARD: React.CSSProperties = {
  background: "rgba(10,12,30,0.82)", border: "1px solid rgba(60,90,180,0.25)",
  borderRadius: 8, padding: 20,
};

const FEATURES = [
  {
    icon: "🌍",
    title: "3D Planetary Globe",
    color: "#3b82f6",
    tagline: "Your battlefield, rendered in three dimensions",
    bullets: [
      "WebGL-powered real-time 3D globe with 21,000 hex land parcels",
      "Zoom, rotate, and orbit to survey the entire battlefield",
      "Biome diversity: desert, forest, tundra, ocean, volcanic",
      "Live territory overlays showing faction ownership in real time",
      "Mobile-optimised touch controls — pinch to zoom, swipe to orbit",
    ],
  },
  {
    icon: "🤖",
    title: "AI Factions",
    color: "#a78bfa",
    tagline: "The planet pushes back",
    bullets: [
      "Four persistent AI factions contest unowned land: NEXUS-7, KRONOS, VANGUARD, SPECTRE",
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
      "FRONTIER (FRNTR) token — real ASA on Algorand Testnet",
      "Sub-1-second transaction finality with near-zero fees",
      "All upgrade events permanently recorded on-chain",
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
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden", fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff" }}>
      <Starfield />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px 80px" }}>
        <LandingNav activePath="/info/features" />

        <div style={{ width: "100%", maxWidth: 860, display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ textAlign: "center", animation: "fadeInUp 0.8s ease-out forwards" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "rgba(100,160,255,0.55)", textTransform: "uppercase", marginBottom: 10 }}>— Platform Capabilities —</div>
            <div className="glitch-text" style={{ fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e0eaff", marginBottom: 8 }}>
              Features
            </div>
            <p style={{ fontSize: 14, color: "rgba(150,190,255,0.65)", maxWidth: 600, margin: "0 auto" }}>
              A full-stack strategy game built on Algorand — 3D territory, AI opponents, NFT commanders, and a real on-chain economy.
            </p>
          </div>

          {FEATURES.map((feat, idx) => (
            <div key={feat.title} style={{
              ...CARD,
              borderLeft: `3px solid ${feat.color}60`,
              display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start",
              animation: `fadeInUp 0.7s ease-out ${idx * 0.08}s both`,
            }}>
              <div style={{ flex: "0 0 180px", minWidth: 140 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{feat.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: feat.color, marginBottom: 4 }}>{feat.title}</div>
                <div style={{ fontSize: 10, color: "rgba(150,190,255,0.5)", fontStyle: "italic", lineHeight: 1.5 }}>{feat.tagline}</div>
              </div>
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {[
              { val: "21,000", label: "Land Parcels" },
              { val: "9",      label: "Sub-Parcels / Plot" },
              { val: "3",      label: "Commander Tiers" },
              { val: "5",      label: "Biome Types" },
              { val: "< 1s",   label: "Tx Finality" },
              { val: "∞",      label: "Seasons" },
            ].map(({ val, label }) => (
              <div key={label} className="border-glow" style={{ ...CARD, textAlign: "center", padding: 16 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#60a5fa", marginBottom: 4 }}>{val}</div>
                <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(150,190,255,0.45)" }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", paddingTop: 8 }}>
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
