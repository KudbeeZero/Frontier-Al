import { useLocation } from "wouter";
import { LandingNav, LandingFooter, CookieConsentBanner, Starfield, SHARED_CSS } from "./landing-shared";

const CARD: React.CSSProperties = {
  background: "rgba(10,12,30,0.82)", border: "1px solid rgba(60,90,180,0.25)",
  borderRadius: 8, padding: 20,
};

const LOOP_STEPS = [
  { icon: "🌍", label: "Claim Parcel",    desc: "Purchase a land parcel on the 3D globe using FRONTIER tokens. Every parcel has a unique biome — desert, forest, tundra, ocean, volcanic." },
  { icon: "⛏️", label: "Mine Resources",  desc: "Parcels generate iron, fuel, and crystal passively over time. Build mining improvements to amplify yield per hour." },
  { icon: "🏗️", label: "Build Improvements", desc: "Construct command centres, refineries, shield arrays, and blockchain nodes on your 3×3 sub-parcel grid." },
  { icon: "⚔️", label: "Attack & Defend", desc: "Deploy your commander and their AI companion to raid enemy parcels. Win to pillage resources and seize territory." },
  { icon: "🏪", label: "Trade",           desc: "Exchange resources and sub-parcels through the on-chain Trade Station. Set your price, list your asset, watch the market." },
  { icon: "💎", label: "Earn FRONTIER",   desc: "Accumulate FRNTR from ownership yield, battle victories, and trade. Stake it back into new parcels and commanders." },
];

const COMMANDERS = [
  { tier: "Sentinel", companion: "Iron Wolf 🐺",    atk: "+10", def: "+10", cooldown: "12 hr", color: "#60a5fa", desc: "Tactical suppression beast. Mechanical legs, energy jaw. Ideal for defence-first strategies." },
  { tier: "Phantom",  companion: "Shadow Fox 🦊",   atk: "+18", def: "+6",  cooldown: "12 hr", color: "#a78bfa", desc: "Cloaked recon animal. EMP-capable tail, stealth plating. Dominates guerrilla raids." },
  { tier: "Reaper",   companion: "Apex Raptor 🦅",  atk: "+30", def: "+5",  cooldown: "12 hr", color: "#f97316", desc: "Biomechanical aerial predator. Siege talons, orbital targeting. Maximum offensive power." },
];

const SUB_CELLS = [
  { label: "CMD",   color: "#3b82f6" }, { label: "MINE",  color: "#10b981" }, { label: "MINE",  color: "#10b981" },
  { label: "SHD",   color: "#8b5cf6" }, { label: "◆",     color: "#eab308" }, { label: "SHD",   color: "#8b5cf6" },
  { label: "RFNRY", color: "#ef4444" }, { label: "MINE",  color: "#10b981" }, { label: "NODE",  color: "#06b6d4" },
];

const SEASONS = [
  { phase: "Phase I",   name: "Expansion", desc: "Land rush — claim parcels, build infrastructure, form resource stockpiles. AI factions actively contest unowned territory.", color: "#60a5fa" },
  { phase: "Phase II",  name: "Conflict",  desc: "Territory wars erupt. Sub-parcel battles unlock. Commander deployments accelerate. Burn mechanics peak as upgrades flood in.", color: "#a78bfa" },
  { phase: "Phase III", name: "Dominion",  desc: "Top landholders compete for global control. Leaderboard sealed. Season rewards distributed in FRONTIER tokens.", color: "#f97316" },
];

export default function LandingGameplay() {
  const [, setLocation] = useLocation();
  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden", fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff" }}>
      <Starfield />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px 80px" }}>
        <LandingNav activePath="/info/gameplay" />

        <div style={{ width: "100%", maxWidth: 860, display: "flex", flexDirection: "column", gap: 40 }}>
          <div style={{ textAlign: "center", animation: "fadeInUp 0.8s ease-out forwards" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "rgba(100,160,255,0.55)", textTransform: "uppercase", marginBottom: 10 }}>— Commander Briefing —</div>
            <div className="glitch-text" style={{ fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e0eaff", marginBottom: 8 }}>
              How to Play
            </div>
            <p style={{ fontSize: 14, color: "rgba(150,190,255,0.65)", maxWidth: 600, margin: "0 auto" }}>
              Claim land, build infrastructure, deploy commanders, and conquer the planet. The frontier rewards strategy over brute force.
            </p>
          </div>

          {/* Game Loop */}
          <div style={{ ...CARD, animation: "fadeInUp 0.7s ease-out 0.1s both" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(100,140,200,0.7)", marginBottom: 20 }}>The Game Loop</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              {LOOP_STEPS.map((step, i) => (
                <div key={step.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{step.icon}</div>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(100,140,200,0.5)", marginBottom: 2, letterSpacing: "0.1em" }}>STEP {i + 1}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(200,230,255,0.9)", marginBottom: 4 }}>{step.label}</div>
                    <div style={{ fontSize: 11, color: "rgba(150,190,255,0.6)", lineHeight: 1.6 }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Commander Tiers */}
          <div style={{ ...CARD, animation: "fadeInUp 0.7s ease-out 0.2s both" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(100,140,200,0.7)", marginBottom: 20 }}>Commander Tiers & Companions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {COMMANDERS.map(cmd => (
                <div key={cmd.tier} style={{
                  background: "rgba(5,8,20,0.6)", border: `1px solid ${cmd.color}30`,
                  borderLeft: `3px solid ${cmd.color}`, borderRadius: 6, padding: "14px 16px",
                  display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start",
                }}>
                  <div style={{ minWidth: 120 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: cmd.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>{cmd.tier}</div>
                    <div style={{ fontSize: 11, color: "rgba(200,220,255,0.8)", marginTop: 2 }}>{cmd.companion}</div>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#f87171" }}>{cmd.atk}</div>
                      <div style={{ fontSize: 9, color: "rgba(150,190,255,0.4)", letterSpacing: "0.08em" }}>ATK</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#60a5fa" }}>{cmd.def}</div>
                      <div style={{ fontSize: 9, color: "rgba(150,190,255,0.4)", letterSpacing: "0.08em" }}>DEF</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(200,200,200,0.7)" }}>{cmd.cooldown}</div>
                      <div style={{ fontSize: 9, color: "rgba(150,190,255,0.4)", letterSpacing: "0.08em" }}>COOLDOWN</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 200, fontSize: 11, color: "rgba(150,190,255,0.6)", lineHeight: 1.6 }}>{cmd.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sub-Parcel Grid */}
          <div style={{ ...CARD, animation: "fadeInUp 0.7s ease-out 0.3s both" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(100,140,200,0.7)", marginBottom: 20 }}>Sub-Parcel System</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center" }}>
              <div style={{ flex: "0 0 auto" }}>
                <svg width="180" height="180" viewBox="0 0 180 180">
                  {SUB_CELLS.map((cell, i) => {
                    const col = i % 3; const row = Math.floor(i / 3);
                    const x = col * 60 + 2; const y = row * 60 + 2;
                    return (
                      <g key={i}>
                        <rect x={x} y={y} width={56} height={56} rx={4} fill={`${cell.color}22`} stroke={`${cell.color}66`} strokeWidth={1} />
                        <text x={x + 28} y={y + 32} textAnchor="middle" fill={cell.color} fontSize={9} fontFamily="monospace" fontWeight={700} letterSpacing="0.05em">{cell.label}</text>
                      </g>
                    );
                  })}
                </svg>
                <div style={{ textAlign: "center", fontSize: 9, color: "rgba(150,190,255,0.4)", letterSpacing: "0.1em", marginTop: 6 }}>SAMPLE 3×3 SUB-PARCEL LAYOUT</div>
              </div>
              <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 12, color: "rgba(200,230,255,0.9)", lineHeight: 1.7 }}>
                  Each land parcel contains a <strong style={{ color: "#60a5fa" }}>3×3 grid of sub-parcels</strong> — 9 individually tradeable, attackable tiles.
                </div>
                {[
                  { color: "#3b82f6", label: "CMD",   name: "Command Centre",  desc: "Boosts ATK when defending" },
                  { color: "#10b981", label: "MINE",  name: "Mining Rig",      desc: "Increases resource yield" },
                  { color: "#8b5cf6", label: "SHD",   name: "Shield Array",    desc: "Passive DEF bonus" },
                  { color: "#ef4444", label: "RFNRY", name: "Refinery",        desc: "Converts raw ore to fuel" },
                  { color: "#06b6d4", label: "NODE",  name: "Blockchain Node", desc: "Multiplies FRNTR yield" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ width: 28, height: 18, background: `${item.color}22`, border: `1px solid ${item.color}66`, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 7, color: item.color, fontWeight: 700 }}>{item.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(150,190,255,0.7)" }}>
                      <strong style={{ color: "rgba(200,220,255,0.9)" }}>{item.name}</strong> — {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Season Phases */}
          <div style={{ ...CARD, animation: "fadeInUp 0.7s ease-out 0.4s both" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(100,140,200,0.7)", marginBottom: 20 }}>Season Phases</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {SEASONS.map(s => (
                <div key={s.phase} style={{ background: "rgba(5,8,20,0.6)", border: "1px solid rgba(60,90,180,0.2)", borderLeft: `3px solid ${s.color}`, borderRadius: 6, padding: 16 }}>
                  <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(100,140,200,0.5)", marginBottom: 4 }}>{s.phase}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(150,190,255,0.6)", lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              ))}
            </div>
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

      <CookieConsentBanner />

      <style>{SHARED_CSS}</style>
    </div>
  );
}
