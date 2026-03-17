import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { LandingNav, LandingFooter, Starfield, SHARED_CSS } from "./landing-shared";

// ─── Animated Rocket ──────────────────────────────────────────────────────────
function Rocket() {
  return (
    <div style={{ position: "relative", width: 54, height: 120 }}>
      {/* Smoke puffs */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{
          position: "absolute", bottom: -10 + (i * 3), left: 12 + (i % 3) * 8,
          width: 22 + i * 4, height: 22 + i * 4, borderRadius: "50%",
          background: `rgba(180,200,255,${0.06 - i * 0.01})`,
          animation: `smoke-puff 1.8s ease-out ${i * 0.3}s infinite`,
          filter: "blur(4px)",
        }} />
      ))}
      {/* Flame + Rocket body — wrapped so both move together on lift */}
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", animation: "rocket-lift 6s ease-in-out infinite" }}>
        {/* Flame */}
        <div style={{
          position: "absolute", bottom: -23, left: "calc(50% - 7px)", transform: "translateX(-50%) rotate(-2deg)",
          width: 14, height: 28, borderRadius: "0 0 50% 50%",
          background: "linear-gradient(180deg, #fff7a0 0%, #ff9800 40%, #ff4400 80%, transparent 100%)",
          animation: "flame-flicker 0.15s ease-in-out infinite",
          filter: "blur(1px)",
          boxShadow: "0 0 12px 6px rgba(255,120,0,0.4), 0 0 25px 10px rgba(255,60,0,0.2)",
        }} />
        {/* Rocket body */}
      <svg width="54" height="90" viewBox="0 0 54 90" style={{ position: "relative", zIndex: 2 }}>
        {/* Body */}
        <ellipse cx="27" cy="55" rx="13" ry="30" fill="rgba(180,210,255,0.9)" />
        {/* Nose */}
        <ellipse cx="27" cy="22" rx="13" ry="17" fill="rgba(220,235,255,0.95)" />
        {/* Window */}
        <circle cx="27" cy="40" r="6" fill="rgba(80,140,255,0.8)" />
        <circle cx="27" cy="40" r="4" fill="rgba(100,170,255,0.6)" />
        <circle cx="25" cy="38" r="1.5" fill="rgba(255,255,255,0.7)" />
        {/* Fins left */}
        <path d="M14 72 L8 88 L14 82 Z" fill="rgba(150,185,255,0.85)" />
        {/* Fins right */}
        <path d="M40 72 L46 88 L40 82 Z" fill="rgba(150,185,255,0.85)" />
        {/* Detail stripe */}
        <rect x="17" y="60" width="20" height="2" rx="1" fill="rgba(100,160,255,0.5)" />
        <rect x="17" y="65" width="20" height="1.5" rx="0.75" fill="rgba(100,160,255,0.35)" />
        {/* Exhaust nozzle */}
        <ellipse cx="27" cy="85" rx="9" ry="4" fill="rgba(120,150,200,0.8)" />
        <ellipse cx="27" cy="82" rx="7" ry="3" fill="rgba(90,120,180,0.6)" />
      </svg>
      </div>{/* end rocket-lift wrapper */}
    </div>
  );
}

// ─── Animated Planet ─────────────────────────────────────────────────────────
function Planet() {
  return (
    <div className="float-anim" style={{ position: "relative", width: 260, height: 260, flexShrink: 0 }}>
      <div style={{
        position: "absolute", inset: -40, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(60,100,255,0.08) 0%, transparent 70%)",
        animation: "pulse 4s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", inset: -20, borderRadius: "50%",
        boxShadow: "0 0 60px 20px rgba(80,120,255,0.12), 0 0 120px 40px rgba(30,60,180,0.07)",
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 360, height: 80,
        transform: "translate(-50%, -50%) rotateX(72deg)",
        border: "1.5px solid rgba(120,160,255,0.18)", borderRadius: "50%",
        boxShadow: "0 0 16px 2px rgba(100,140,255,0.10)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: `radial-gradient(circle at 35% 35%, #2a4a8c 0%, #1a2e5a 30%, #0d1a3a 55%, #060d20 80%, #020508 100%)`,
        boxShadow: `inset -30px -20px 60px rgba(0,0,0,0.8), inset 10px 10px 40px rgba(60,100,200,0.15), 0 0 40px 8px rgba(40,80,200,0.2), 0 0 80px 20px rgba(20,50,150,0.12)`,
        overflow: "hidden", animation: "rotatePlanet 30s linear infinite",
      }}>
        <svg viewBox="0 0 260 260" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.35 }}>
          <ellipse cx="90" cy="100" rx="35" ry="22" fill="rgba(80,160,80,0.7)" transform="rotate(-15,90,100)" />
          <ellipse cx="160" cy="140" rx="28" ry="18" fill="rgba(90,140,70,0.6)" transform="rotate(20,160,140)" />
          <ellipse cx="110" cy="175" rx="20" ry="12" fill="rgba(100,155,75,0.5)" />
          <ellipse cx="185" cy="85" rx="15" ry="10" fill="rgba(80,150,80,0.5)" transform="rotate(-30,185,85)" />
          <ellipse cx="55" cy="155" rx="18" ry="11" fill="rgba(85,145,70,0.45)" transform="rotate(10,55,155)" />
          <path d="M30 60 l10-6 10 6 0 12-10 6-10-6z" fill="none" stroke="rgba(100,180,255,0.15)" strokeWidth="0.5"/>
          <path d="M60 60 l10-6 10 6 0 12-10 6-10-6z" fill="none" stroke="rgba(100,180,255,0.15)" strokeWidth="0.5"/>
          <path d="M90 60 l10-6 10 6 0 12-10 6-10-6z" fill="none" stroke="rgba(100,180,255,0.15)" strokeWidth="0.5"/>
          <path d="M120 60 l10-6 10 6 0 12-10 6-10-6z" fill="none" stroke="rgba(100,180,255,0.15)" strokeWidth="0.5"/>
          <path d="M150 60 l10-6 10 6 0 12-10 6-10-6z" fill="none" stroke="rgba(100,180,255,0.15)" strokeWidth="0.5"/>
          <path d="M45 78 l10-6 10 6 0 12-10 6-10-6z" fill="none" stroke="rgba(100,180,255,0.12)" strokeWidth="0.5"/>
          <path d="M75 78 l10-6 10 6 0 12-10 6-10-6z" fill="none" stroke="rgba(100,180,255,0.12)" strokeWidth="0.5"/>
          <path d="M105 78 l10-6 10 6 0 12-10 6-10-6z" fill="none" stroke="rgba(100,180,255,0.12)" strokeWidth="0.5"/>
          <path d="M135 78 l10-6 10 6 0 12-10 6-10-6z" fill="none" stroke="rgba(100,180,255,0.12)" strokeWidth="0.5"/>
        </svg>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, rgba(100,160,255,0.12) 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 70% 65%, transparent 40%, rgba(0,0,0,0.55) 75%)" }} />
      </div>
      <div style={{
        position: "absolute", inset: -3, borderRadius: "50%", background: "transparent",
        boxShadow: "inset 0 0 20px 6px rgba(60,120,255,0.18)", border: "2px solid rgba(80,130,255,0.1)",
      }} />
      {[
        { top: "18%", left: "42%", delay: "0s" }, { top: "55%", left: "25%", delay: "0.4s" },
        { top: "68%", left: "60%", delay: "0.8s" }, { top: "35%", left: "70%", delay: "1.2s" },
        { top: "78%", left: "40%", delay: "1.6s" },
      ].map((dot, i) => (
        <div key={i} style={{
          position: "absolute", top: dot.top, left: dot.left, width: 6, height: 6, borderRadius: "50%",
          background: "#4fc3f7", boxShadow: "0 0 8px 3px rgba(79,195,247,0.8)",
          animation: `blink 2s ease-in-out ${dot.delay} infinite`,
        }} />
      ))}
    </div>
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      background: hovered ? "rgba(40,60,120,0.35)" : "rgba(10,15,40,0.55)",
      border: `1px solid ${hovered ? "rgba(100,160,255,0.4)" : "rgba(60,90,180,0.2)"}`,
      borderRadius: 12, padding: "20px 22px", backdropFilter: "blur(10px)",
      transition: "all 0.3s ease", transform: hovered ? "translateY(-3px)" : "none",
      boxShadow: hovered ? "0 8px 32px rgba(60,100,255,0.18)" : "none",
      cursor: "default", flex: "1 1 200px", minWidth: 180,
    }}>
      <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "#a0b8ff", textTransform: "uppercase", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "rgba(180,200,240,0.75)", lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function BuildProgress({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.08em", color: "rgba(160,190,255,0.7)", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color, borderRadius: 2,
          boxShadow: `0 0 8px ${color}`, animation: "growBar 1.8s ease-out forwards",
        }} />
      </div>
    </div>
  );
}

// ─── Hype Ticker ──────────────────────────────────────────────────────────────
function HypeTicker() {
  const items = [
    "🔥 4,218 parcels claimed",
    "⚡ AI factions are mobilising",
    "🌐 Algorand TestNet LIVE",
    "🪙 $FRONTIER token launching soon",
    "🛡 Early adopters get permanent on-chain bonuses",
    "🤖 Four rival factions compete for the planet",
    "⬡ 21,000 hex parcels — claim yours now",
    "📡 Blockchain integration 91% complete",
    "🚀 Be first. Be Frontier.",
  ];
  const text = items.join("   ·   ");
  return (
    <div style={{
      width: "100%", maxWidth: 940, overflow: "hidden",
      background: "rgba(5,10,30,0.7)", border: "1px solid rgba(60,90,180,0.25)",
      borderRadius: 6, padding: "10px 0", backdropFilter: "blur(8px)",
      marginBottom: 60, marginTop: -20,
    }}>
      <div className="ticker-track">
        <span className="ticker-text">{text}&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;{text}</span>
      </div>
    </div>
  );
}

// ─── Token Section ─────────────────────────────────────────────────────────────
function TokenSection() {
  const steps = [
    { num: "01", icon: "📱", title: "Install Pera Wallet", desc: "Download Pera Wallet on iOS or Android. It's the leading Algorand wallet with full ASA and NFT support.", action: "Get Pera Wallet →", color: "#4fc3f7" },
    { num: "02", icon: "⚡", title: "Acquire ALGO",        desc: "Fund your wallet with ALGO from any major exchange — Coinbase, Kraken, Binance, or KuCoin.", action: "Buy ALGO →", color: "#81c784" },
    { num: "03", icon: "🪙", title: "Swap for $FRONTIER",  desc: "Visit Vestige or Tinyman DEX. Swap ALGO for $FRONTIER, then claim your parcels and begin your conquest.", action: "Swap on Vestige →", color: "#ce93d8" },
  ];

  return (
    <div style={{ width: "100%", maxWidth: 940, marginBottom: 80 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.28em", color: "rgba(100,140,255,0.5)", textTransform: "uppercase", textAlign: "center", marginBottom: 8 }}>
        — HOW TO ACQUIRE $FRONTIER —
      </div>
      <div style={{
        fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 800, letterSpacing: "0.08em",
        textAlign: "center", textTransform: "uppercase",
        background: "linear-gradient(135deg, #ffffff 0%, #a8c4ff 50%, #6090ff 100%)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        marginBottom: 12,
      }}>Join the Economy</div>
      <div style={{ fontSize: 13, color: "rgba(160,190,255,0.6)", textAlign: "center", marginBottom: 40, maxWidth: 500, margin: "0 auto 40px" }}>
        $FRONTIER powers every transaction on the planet. Own parcels, trade resources, and shape the economy.
      </div>

      <div className="token-stats-grid" style={{ marginBottom: 36 }}>
        {[
          { label: "Token",        value: "$FRONTIER" },
          { label: "Chain",        value: "Algorand" },
          { label: "Total Supply", value: "21,000,000" },
          { label: "Asset Type",   value: "ASA" },
          { label: "Status",       value: "Pre-Launch" },
        ].map(({ label, value }) => (
          <div key={label} className="border-glow" style={{
            background: "rgba(5,10,30,0.6)", border: "1px solid rgba(60,90,180,0.2)",
            borderRadius: 8, padding: "14px 16px", textAlign: "center", backdropFilter: "blur(8px)",
          }}>
            <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(100,130,200,0.55)", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 14, color: "rgba(180,210,255,0.85)", fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="steps-grid">
        {steps.map((step) => (
          <div key={step.num} style={{
            background: "rgba(8,12,36,0.65)", border: "1px solid rgba(60,90,180,0.2)",
            borderRadius: 12, padding: "24px 22px", backdropFilter: "blur(12px)",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", color: step.color, opacity: 0.7 }}>STEP {step.num}</div>
              <div style={{ fontSize: 22 }}>{step.icon}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", color: "#a0b8ff", textTransform: "uppercase" }}>{step.title}</div>
            <div style={{ fontSize: 13, color: "rgba(160,190,240,0.7)", lineHeight: 1.6, flex: 1 }}>{step.desc}</div>
            <div style={{ fontSize: 11, color: step.color, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, borderTop: `1px solid ${step.color}30`, paddingTop: 12, marginTop: 4 }}>
              {step.action}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Claim Modal ──────────────────────────────────────────────────────────────
function ClaimModal({ tier, color, onClose }: { tier: string; color: string; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,5,0.85)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480,
        background: "rgba(6,8,24,0.98)", border: `1px solid ${color}40`,
        borderRadius: 14, padding: "32px 28px",
        boxShadow: `0 0 60px ${color}20, 0 0 120px rgba(0,0,0,0.8)`,
        animation: "fadeInUp 0.3s ease-out forwards",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "rgba(100,140,255,0.5)", textTransform: "uppercase", marginBottom: 6 }}>Claim Your Rank</div>
            <div style={{ fontSize: 22, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{tier}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(150,180,255,0.5)", fontSize: 20, cursor: "pointer", padding: 4, fontFamily: "inherit" }}>✕</button>
        </div>

        <div style={{ background: "rgba(20,30,80,0.4)", border: "1px solid rgba(60,90,180,0.25)", borderRadius: 8, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "rgba(150,190,255,0.8)", lineHeight: 1.8 }}>
            To claim your <strong style={{ color }}>{tier}</strong> rank, reach out on Twitter / X and send a DM with:
            <br /><br />
            <span style={{ color: "rgba(200,220,255,0.9)", fontFamily: "monospace" }}>Your Algorand wallet address</span><br />
            <span style={{ color: "rgba(200,220,255,0.9)", fontFamily: "monospace" }}>Rank you want to reserve: {tier}</span>
            <br /><br />
            Your rank and wallet are recorded manually before the mainnet snapshot. Bonuses are permanent and non-transferable.
          </div>
        </div>

        <a
          href="https://x.com/ascendancyalgox"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: `${color}18`, border: `1px solid ${color}55`,
            borderRadius: 8, padding: "14px 20px",
            color, fontSize: 13, letterSpacing: "0.12em",
            textTransform: "uppercase", fontWeight: 700, textDecoration: "none",
            cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.2s",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          DM @ascendancyalgox on X ↗
        </a>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 10, color: "rgba(100,130,180,0.4)", letterSpacing: "0.08em" }}>
          BONUSES LOCKED ON-CHAIN AT MAINNET LAUNCH
        </div>
      </div>
    </div>
  );
}

// ─── Early Adopter / Claim Your Rank Section ──────────────────────────────────
function EarlyAdopterSection({ onEnter }: { onEnter: () => void }) {
  const [claimTier, setClaimTier] = useState<{ rank: string; color: string } | null>(null);

  const tiers = [
    {
      rank: "Pioneer", icon: "🌱",
      req: "Claim 1+ parcel before mainnet",
      color: "#81c784", glow: "rgba(129,199,132,0.15)", border: "rgba(129,199,132,0.25)",
      perks: ["+10% permanent resource yield", "Pioneer Commander badge", "Early faction selection access", "Reserved Discord role"],
    },
    {
      rank: "Vanguard", icon: "⚔️",
      req: "Claim 5+ parcels before mainnet",
      color: "#4fc3f7", glow: "rgba(79,195,247,0.18)", border: "rgba(79,195,247,0.3)",
      perks: ["+20% permanent resource yield", "Vanguard Commander badge", "Exclusive faction skin (launch day)", "Priority War Room access", "Name in launch credits"],
      featured: true,
    },
    {
      rank: "Marshal", icon: "👑",
      req: "Claim 10+ parcels before mainnet",
      color: "#ce93d8", glow: "rgba(206,147,216,0.18)", border: "rgba(206,147,216,0.3)",
      perks: ["+35% permanent resource yield", "Marshal title on-chain", "All Vanguard perks included", "Founding Council membership", "Custom parcel naming rights"],
    },
  ];

  return (
    <>
      {claimTier && <ClaimModal tier={claimTier.rank} color={claimTier.color} onClose={() => setClaimTier(null)} />}

      <div style={{ width: "100%", maxWidth: 940, marginBottom: 80 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.28em", color: "rgba(100,140,255,0.5)", textTransform: "uppercase", textAlign: "center", marginBottom: 8 }}>
          — EARLY COMMANDER PROGRAM —
        </div>
        <div className="glitch-text" style={{
          fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 800, letterSpacing: "0.08em",
          textAlign: "center", textTransform: "uppercase",
          background: "linear-gradient(135deg, #ffffff 0%, #a8c4ff 50%, #6090ff 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          marginBottom: 12,
        }}>
          Claim Your Rank
        </div>
        <div style={{ fontSize: 13, color: "rgba(160,190,255,0.6)", textAlign: "center", maxWidth: 500, margin: "0 auto 40px" }}>
          Early commanders receive permanent on-chain bonuses locked at mainnet launch. The frontier rewards those who arrive first.
        </div>

        <div className="tiers-grid">
          {tiers.map((tier) => (
            <div key={tier.rank} style={{
              background: (tier as any).featured ? `rgba(20,35,80,0.7)` : "rgba(8,12,36,0.65)",
              border: `1px solid ${tier.border}`,
              borderRadius: 14, padding: "28px 22px",
              backdropFilter: "blur(12px)",
              boxShadow: (tier as any).featured ? `0 0 40px ${tier.glow}, inset 0 1px 0 ${tier.border}` : `0 0 20px ${tier.glow}`,
              display: "flex", flexDirection: "column", gap: 14,
              position: "relative", overflow: "hidden",
              transition: "transform 0.2s ease",
            }}>
              {(tier as any).featured && (
                <div style={{
                  position: "absolute", top: 14, right: 14,
                  fontSize: 9, letterSpacing: "0.15em", color: tier.color,
                  background: tier.glow, border: `1px solid ${tier.border}`,
                  borderRadius: 4, padding: "3px 8px", textTransform: "uppercase", fontWeight: 700,
                }}>Most Popular</div>
              )}
              <div style={{ fontSize: 32 }}>{tier.icon}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.08em", color: tier.color, textTransform: "uppercase" }}>{tier.rank}</div>
                <div style={{ fontSize: 11, color: "rgba(160,190,255,0.55)", marginTop: 4, letterSpacing: "0.06em" }}>{tier.req}</div>
              </div>
              <div style={{ height: 1, background: tier.border }} />
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {tier.perks.map((perk) => (
                  <li key={perk} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ color: tier.color, fontSize: 12, marginTop: 1, flexShrink: 0 }}>▶</span>
                    <span style={{ fontSize: 12, color: "rgba(180,210,255,0.75)", lineHeight: 1.4 }}>{perk}</span>
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <button
                  onClick={() => setClaimTier({ rank: tier.rank, color: tier.color })}
                  style={{
                    flex: 1, background: tier.glow, border: `1px solid ${tier.border}`,
                    borderRadius: 6, padding: "12px 0",
                    color: tier.color, fontSize: 11, letterSpacing: "0.15em",
                    textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
                    transition: "all 0.2s ease", width: "100%", fontFamily: "inherit",
                  }}
                >
                  Claim Rank →
                </button>
                <button
                  onClick={onEnter}
                  style={{
                    background: "rgba(60,100,255,0.1)", border: "1px solid rgba(80,130,255,0.25)",
                    borderRadius: 6, padding: "12px 14px",
                    color: "rgba(150,190,255,0.7)", fontSize: 11, cursor: "pointer",
                    textTransform: "uppercase", fontWeight: 600, fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  Play Now
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <div style={{ fontSize: 11, color: "rgba(100,130,180,0.5)", letterSpacing: "0.08em", marginBottom: 8 }}>
            ⚠ Bonuses are non-transferable and permanently assigned to wallet address at mainnet launch.
          </div>
          <div style={{ fontSize: 11, color: "rgba(100,130,180,0.4)", letterSpacing: "0.06em" }}>
            Questions? DM{" "}
            <a href="https://x.com/ascendancyalgox" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(100,170,255,0.65)", textDecoration: "none" }}>
              @ascendancyalgox
            </a>{" "}
            on X
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [entered, setEntered] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const handleEnter = () => {
    setEntered(true);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); setLocation("/game"); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  return (
    <div style={{
      position: "relative", minHeight: "100vh", width: "100%",
      overflow: "hidden", fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff",
    }}>
      <Starfield />

      {/* Scan-line overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1,
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.025) 2px, rgba(0,0,0,0.025) 4px)",
      }} />

      {entered && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,20,0.94)", backdropFilter: "blur(16px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
        }}>
          <div style={{ fontSize: 48 }}>🚀</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.2em", color: "#e0eaff", textTransform: "uppercase" }}>
            Launching in {countdown}…
          </div>
          <div style={{ width: 200, height: 2, background: "rgba(60,90,180,0.2)", borderRadius: 1 }}>
            <div style={{ height: "100%", background: "#4fc3f7", width: `${((3 - countdown) / 3) * 100}%`, transition: "width 1s linear", borderRadius: 1 }} />
          </div>
        </div>
      )}

      <div style={{
        position: "relative", zIndex: 2, minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "0 20px 60px",
      }}>
        <LandingNav activePath="/" />

        {/* ── Hero Section ── */}
        <div className="hero-section" style={{
          width: "100%", maxWidth: 940,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 40, marginBottom: 70, flexWrap: "wrap",
        }}>
          {/* Left: Text */}
          <div style={{ flex: "1 1 320px", minWidth: 280, animation: "fadeInLeft 0.9s ease-out forwards" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.35em", color: "rgba(100,160,255,0.55)", textTransform: "uppercase", marginBottom: 14, animation: "glow-pulse 3s ease-in-out infinite" }}>
              ⬡ FRONTIER — ALGORAND TESTNET
            </div>
            <h1 className="glitch-text" style={{
              fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 800, lineHeight: 1.05,
              letterSpacing: "-0.02em", color: "#fff", marginBottom: 14,
            }}>
              Conquer the<br />
              <span style={{
                background: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>Planet</span>
            </h1>
            <p style={{ fontSize: 15, color: "rgba(170,200,255,0.72)", lineHeight: 1.65, maxWidth: 420, marginBottom: 28 }}>
              A massive-scale strategy game on Algorand. Claim 21,000 hex parcels, build your empire, crush AI factions — all on-chain.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={handleEnter} style={{
                background: "rgba(60,100,255,0.3)", border: "1px solid rgba(100,160,255,0.55)",
                borderRadius: 8, padding: "13px 28px", color: "rgba(180,220,255,0.95)",
                fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase",
                cursor: "pointer", fontWeight: 700, fontFamily: "inherit",
                boxShadow: "0 0 24px rgba(60,100,255,0.2)",
              }}>▶ Enter Game</button>
              <button onClick={() => setLocation("/info/features")} style={{
                background: "transparent", border: "1px solid rgba(60,90,180,0.35)",
                borderRadius: 8, padding: "13px 24px", color: "rgba(150,185,255,0.75)",
                fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
                cursor: "pointer", fontFamily: "inherit",
              }}>Learn More →</button>
            </div>
          </div>

          {/* Right: Planet + Rocket */}
          <div className="planet-wrap" style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 16, animation: "fadeInRight 0.9s ease-out forwards" }}>
            <Planet />
            <div style={{ marginBottom: 20, opacity: 0.88 }}>
              <Rocket />
            </div>
          </div>
        </div>

        {/* ── Ticker ── */}
        <HypeTicker />

        {/* ── Build Progress ── */}
        <div style={{
          width: "100%", maxWidth: 940, marginBottom: 80,
          background: "rgba(5,10,30,0.65)", border: "1px solid rgba(60,90,180,0.22)",
          borderRadius: 12, padding: "28px 32px", backdropFilter: "blur(12px)",
          animation: "fadeInUp 0.8s ease-out 0.2s both",
        }}>
          <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "rgba(100,140,255,0.5)", textTransform: "uppercase", marginBottom: 20 }}>
            Build Progress — Testnet Alpha
          </div>
          <BuildProgress label="Blockchain Integration"     pct={91} color="#4fc3f7" />
          <BuildProgress label="Territory & Battle System"  pct={88} color="#81c784" />
          <BuildProgress label="Economy & Token"            pct={85} color="#ce93d8" />
          <BuildProgress label="3D Globe & Visuals"         pct={79} color="#ffb74d" />
          <BuildProgress label="Commander NFT System"       pct={72} color="#f48fb1" />
          <BuildProgress label="MainNet Migration"          pct={18} color="#9e9e9e" />
        </div>

        {/* ── Feature Cards ── */}
        <div style={{ width: "100%", maxWidth: 940, marginBottom: 80, animation: "fadeInUp 0.8s ease-out 0.3s both" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.28em", color: "rgba(100,140,255,0.5)", textTransform: "uppercase", textAlign: "center", marginBottom: 8 }}>
            — The Full Stack —
          </div>
          <div style={{
            fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 800, letterSpacing: "0.08em",
            textAlign: "center", textTransform: "uppercase", color: "#e0eaff", marginBottom: 36,
          }}>What's Inside</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <FeatureCard icon="🌍" title="3D Planetary Map"  desc="Rendered in Three.js. 21,000 hex parcels across 5 biomes. Explore, scout, and plan your expansion." />
            <FeatureCard icon="🤖" title="AI Factions"       desc="Four AI factions contest unowned land. NEXUS-7, KRONOS, VANGUARD, SPECTRE — all hostile." />
            <FeatureCard icon="🔗" title="Algorand Chain"    desc="Every parcel, upgrade, and battle recorded on-chain. True ownership. Near-zero fees." />
            <FeatureCard icon="⚔️" title="Territory Wars"   desc="Expand, fortify, and defend your parcels. Strategic alliances determine who rules the frontier." />
            <FeatureCard icon="💎" title="Commander NFTs"    desc="Three tiers. Unique AI companions. Permanent stats. Traded on the open market." />
            <FeatureCard icon="💰" title="FRNTR Economy"    desc="Earn tokens by owning land. Burn them to mint commanders and launch attacks." />
          </div>
        </div>

        {/* ── Token Section ── */}
        <TokenSection />

        {/* ── Early Adopter Claim Section ── */}
        <EarlyAdopterSection onEnter={handleEnter} />

        <LandingFooter />
      </div>

      <style>{`
        ${SHARED_CSS}

        @keyframes rotatePlanet {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .hero-section { gap: 40px !important; margin-bottom: 70px !important; }

        @media (max-width: 768px) {
          .hero-section { flex-direction: column !important; align-items: center !important; gap: 32px !important; margin-bottom: 50px !important; }
          .planet-wrap > div { width: 200px !important; height: 200px !important; }
        }
        @media (max-width: 480px) {
          .planet-wrap > div { width: 180px !important; height: 180px !important; }
          .hero-section { flex-direction: column !important; align-items: center !important; }
        }
        @media (max-height: 500px) and (orientation: landscape) {
          .hero-section { flex-direction: row !important; gap: 24px !important; }
          .planet-wrap > div { width: 160px !important; height: 160px !important; }
        }
      `}</style>
    </div>
  );
}
