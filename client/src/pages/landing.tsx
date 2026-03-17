import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

// ─── Starfield Canvas ────────────────────────────────────────────────────────
function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const stars = Array.from({ length: 320 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.2,
      speed: Math.random() * 0.15 + 0.02,
      opacity: Math.random() * 0.6 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
    }));

    const shoots: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];
    const spawnShoot = () => {
      shoots.push({
        x: Math.random() * window.innerWidth * 0.6,
        y: Math.random() * window.innerHeight * 0.4,
        vx: Math.random() * 6 + 3,
        vy: Math.random() * 2 + 1,
        life: 0,
        maxLife: Math.random() * 50 + 30,
      });
    };
    let shootTimer = 0;

    const draw = (_t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bg = ctx.createRadialGradient(
        canvas.width * 0.5, canvas.height * 0.4, 0,
        canvas.width * 0.5, canvas.height * 0.4, canvas.width * 0.8
      );
      bg.addColorStop(0, "#05060f");
      bg.addColorStop(0.5, "#020308");
      bg.addColorStop(1, "#000002");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const neb = ctx.createRadialGradient(
        canvas.width * 0.3, canvas.height * 0.25, 0,
        canvas.width * 0.3, canvas.height * 0.25, canvas.width * 0.35
      );
      neb.addColorStop(0, "rgba(30,5,80,0.18)");
      neb.addColorStop(0.5, "rgba(10,2,40,0.08)");
      neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const neb2 = ctx.createRadialGradient(
        canvas.width * 0.75, canvas.height * 0.6, 0,
        canvas.width * 0.75, canvas.height * 0.6, canvas.width * 0.28
      );
      neb2.addColorStop(0, "rgba(0,30,70,0.15)");
      neb2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const s of stars) {
        s.twinkle += 0.008;
        const alpha = s.opacity * (0.7 + 0.3 * Math.sin(s.twinkle));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${alpha})`;
        ctx.fill();
      }

      shootTimer++;
      if (shootTimer > 160) { spawnShoot(); shootTimer = 0; }
      for (let i = shoots.length - 1; i >= 0; i--) {
        const sh = shoots[i];
        sh.x += sh.vx; sh.y += sh.vy; sh.life++;
        const progress = sh.life / sh.maxLife;
        const alpha = Math.sin(progress * Math.PI) * 0.9;
        const len = 60 * (1 - progress * 0.5);
        const grad = ctx.createLinearGradient(sh.x - sh.vx * len / sh.vx, sh.y - sh.vy * len / sh.vx, sh.x, sh.y);
        grad.addColorStop(0, `rgba(255,255,255,0)`);
        grad.addColorStop(1, `rgba(200,230,255,${alpha})`);
        ctx.beginPath();
        ctx.moveTo(sh.x - sh.vx * 8, sh.y - sh.vy * 8);
        ctx.lineTo(sh.x, sh.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (sh.life >= sh.maxLife) shoots.splice(i, 1);
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />;
}

// ─── Animated Planet ─────────────────────────────────────────────────────────
function Planet() {
  return (
    <div style={{ position: "relative", width: 260, height: 260, flexShrink: 0 }}>
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
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, rgba(100,160,255,0.12) 0%, transparent 60%)",
        }} />
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "radial-gradient(circle at 70% 65%, transparent 40%, rgba(0,0,0,0.55) 75%)",
        }} />
      </div>
      <div style={{
        position: "absolute", inset: -3, borderRadius: "50%",
        background: "transparent",
        boxShadow: "inset 0 0 20px 6px rgba(60,120,255,0.18)",
        border: "2px solid rgba(80,130,255,0.1)",
      }} />
      {[
        { top: "18%", left: "42%", delay: "0s" },
        { top: "55%", left: "25%", delay: "0.4s" },
        { top: "68%", left: "60%", delay: "0.8s" },
        { top: "35%", left: "70%", delay: "1.2s" },
        { top: "78%", left: "40%", delay: "1.6s" },
      ].map((dot, i) => (
        <div key={i} style={{
          position: "absolute", top: dot.top, left: dot.left,
          width: 6, height: 6, borderRadius: "50%",
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
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "rgba(40,60,120,0.35)" : "rgba(10,15,40,0.55)",
        border: `1px solid ${hovered ? "rgba(100,160,255,0.4)" : "rgba(60,90,180,0.2)"}`,
        borderRadius: 12, padding: "20px 22px", backdropFilter: "blur(10px)",
        transition: "all 0.3s ease", transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? "0 8px 32px rgba(60,100,255,0.18)" : "none",
        cursor: "default", flex: "1 1 200px", minWidth: 180,
      }}
    >
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
    "🛡 Early adopters get permanent bonuses",
    "🤖 Three rival factions compete for the planet",
    "⬡ 21,000 hex parcels — claim yours now",
    "📡 Blockchain integration 91% complete",
    "🚀 Be first. Be Frontier.",
  ];
  const text = items.join("   ·   ");
  return (
    <div style={{
      width: "100%", maxWidth: 900,
      overflow: "hidden",
      background: "rgba(5,10,30,0.7)",
      border: "1px solid rgba(60,90,180,0.25)",
      borderRadius: 6,
      padding: "10px 0",
      backdropFilter: "blur(8px)",
      marginBottom: 60,
      marginTop: -20,
    }}>
      <div className="ticker-track">
        <span className="ticker-text">{text}&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;{text}</span>
      </div>
    </div>
  );
}

// ─── Token Buy Section ────────────────────────────────────────────────────────
function TokenSection() {
  const steps = [
    {
      num: "01",
      icon: "📱",
      title: "Install Pera Wallet",
      desc: "Download the Pera Wallet app on iOS or Android. Pera is the leading Algorand wallet with full ASA support.",
      action: "Get Pera Wallet →",
      color: "#4fc3f7",
    },
    {
      num: "02",
      icon: "⚡",
      title: "Acquire ALGO",
      desc: "Fund your wallet with ALGO from any major exchange — Coinbase, Kraken, Binance, or KuCoin. ALGO is your gateway to the Frontier ecosystem.",
      action: "Buy ALGO →",
      color: "#81c784",
    },
    {
      num: "03",
      icon: "🪙",
      title: "Swap for $FRONTIER",
      desc: "Visit Vestige or Tinyman DEX. Connect your Pera wallet and swap ALGO for $FRONTIER tokens. Then claim your parcels.",
      action: "Swap on Vestige →",
      color: "#ce93d8",
    },
  ];

  return (
    <div style={{ width: "100%", maxWidth: 900, marginBottom: 80 }}>
      {/* Section label */}
      <div style={{
        fontSize: 10, letterSpacing: "0.28em", color: "rgba(100,140,255,0.5)",
        textTransform: "uppercase", textAlign: "center", marginBottom: 8,
      }}>
        — HOW TO ACQUIRE $FRONTIER —
      </div>
      <div style={{
        fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 800,
        letterSpacing: "0.08em", textAlign: "center", textTransform: "uppercase",
        background: "linear-gradient(135deg, #ffffff 0%, #a8c4ff 50%, #6090ff 100%)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        marginBottom: 12,
      }}>
        Join the Economy
      </div>
      <div style={{
        fontSize: 13, color: "rgba(160,190,255,0.6)", textAlign: "center",
        marginBottom: 40, maxWidth: 500, margin: "0 auto 40px",
      }}>
        $FRONTIER powers every transaction on the planet. Own parcels, trade resources, and shape the economy.
      </div>

      {/* Token stats */}
      <div className="token-stats-grid" style={{ marginBottom: 36 }}>
        {[
          { label: "Token", value: "$FRONTIER" },
          { label: "Chain", value: "Algorand" },
          { label: "Total Supply", value: "21,000,000" },
          { label: "Asset Type", value: "ASA" },
          { label: "Status", value: "Pre-Launch" },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: "rgba(5,10,30,0.6)", border: "1px solid rgba(60,90,180,0.2)",
            borderRadius: 8, padding: "14px 16px", textAlign: "center",
            backdropFilter: "blur(8px)",
          }}>
            <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(100,130,200,0.55)", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 14, color: "rgba(180,210,255,0.85)", fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="steps-grid">
        {steps.map((step) => (
          <div key={step.num} style={{
            background: "rgba(8,12,36,0.65)", border: "1px solid rgba(60,90,180,0.2)",
            borderRadius: 12, padding: "24px 22px", backdropFilter: "blur(12px)",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.15em",
                color: step.color, opacity: 0.7,
              }}>STEP {step.num}</div>
              <div style={{ fontSize: 22 }}>{step.icon}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", color: "#a0b8ff", textTransform: "uppercase" }}>{step.title}</div>
            <div style={{ fontSize: 13, color: "rgba(160,190,240,0.7)", lineHeight: 1.6, flex: 1 }}>{step.desc}</div>
            <div style={{
              fontSize: 11, color: step.color, letterSpacing: "0.1em",
              textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
              borderTop: `1px solid ${step.color}30`, paddingTop: 12, marginTop: 4,
            }}>
              {step.action}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Early Adopter Incentives ─────────────────────────────────────────────────
function EarlyAdopterSection({ onEnter }: { onEnter: () => void }) {
  const tiers = [
    {
      rank: "Pioneer",
      icon: "🌱",
      req: "Claim 1+ parcel before mainnet",
      color: "#81c784",
      glow: "rgba(129,199,132,0.15)",
      border: "rgba(129,199,132,0.25)",
      perks: [
        "+10% permanent resource yield",
        "Pioneer Commander badge",
        "Early access to faction selection",
        "Reserved Discord role",
      ],
    },
    {
      rank: "Vanguard",
      icon: "⚔️",
      req: "Claim 5+ parcels before mainnet",
      color: "#4fc3f7",
      glow: "rgba(79,195,247,0.18)",
      border: "rgba(79,195,247,0.3)",
      perks: [
        "+20% permanent resource yield",
        "Vanguard Commander badge",
        "Exclusive faction skin (launch day)",
        "Priority War Room access",
        "Name in launch credits",
      ],
      featured: true,
    },
    {
      rank: "Marshal",
      icon: "👑",
      req: "Claim 10+ parcels before mainnet",
      color: "#ce93d8",
      glow: "rgba(206,147,216,0.18)",
      border: "rgba(206,147,216,0.3)",
      perks: [
        "+35% permanent resource yield",
        "Marshal title on-chain",
        "All Vanguard perks included",
        "Founding Council membership",
        "Custom parcel naming rights",
      ],
    },
  ];

  return (
    <div style={{ width: "100%", maxWidth: 900, marginBottom: 80 }}>
      <div style={{
        fontSize: 10, letterSpacing: "0.28em", color: "rgba(100,140,255,0.5)",
        textTransform: "uppercase", textAlign: "center", marginBottom: 8,
      }}>
        — EARLY COMMANDER PROGRAM —
      </div>
      <div style={{
        fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 800,
        letterSpacing: "0.08em", textAlign: "center", textTransform: "uppercase",
        background: "linear-gradient(135deg, #ffffff 0%, #a8c4ff 50%, #6090ff 100%)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        marginBottom: 12,
      }}>
        Claim Your Rank
      </div>
      <div style={{
        fontSize: 13, color: "rgba(160,190,255,0.6)", textAlign: "center",
        maxWidth: 500, margin: "0 auto 40px",
      }}>
        Early commanders receive permanent on-chain bonuses locked at mainnet launch. The frontier rewards those who arrive first.
      </div>

      <div className="tiers-grid">
        {tiers.map((tier) => (
          <div key={tier.rank} style={{
            background: tier.featured ? `rgba(20,35,80,0.7)` : "rgba(8,12,36,0.65)",
            border: `1px solid ${tier.border}`,
            borderRadius: 14,
            padding: "28px 22px",
            backdropFilter: "blur(12px)",
            boxShadow: tier.featured ? `0 0 40px ${tier.glow}, inset 0 1px 0 ${tier.border}` : `0 0 20px ${tier.glow}`,
            display: "flex", flexDirection: "column", gap: 14,
            position: "relative", overflow: "hidden",
          }}>
            {tier.featured && (
              <div style={{
                position: "absolute", top: 14, right: 14,
                fontSize: 9, letterSpacing: "0.15em", color: tier.color,
                background: `${tier.glow}`, border: `1px solid ${tier.border}`,
                borderRadius: 4, padding: "3px 8px", textTransform: "uppercase", fontWeight: 700,
              }}>Most Popular</div>
            )}
            <div style={{ fontSize: 32 }}>{tier.icon}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.08em", color: tier.color, textTransform: "uppercase" }}>{tier.rank}</div>
              <div style={{ fontSize: 11, color: "rgba(160,190,255,0.55)", marginTop: 4, letterSpacing: "0.06em" }}>{tier.req}</div>
            </div>
            <div style={{ height: 1, background: `${tier.border}` }} />
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {tier.perks.map((perk) => (
                <li key={perk} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ color: tier.color, fontSize: 12, marginTop: 1, flexShrink: 0 }}>▶</span>
                  <span style={{ fontSize: 12, color: "rgba(180,210,255,0.75)", lineHeight: 1.4 }}>{perk}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={onEnter}
              style={{
                marginTop: "auto",
                background: `${tier.glow}`,
                border: `1px solid ${tier.border}`,
                borderRadius: 6, padding: "12px 0",
                color: tier.color, fontSize: 11, letterSpacing: "0.15em",
                textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
                transition: "all 0.2s ease", width: "100%",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = tier.glow.replace("0.1", "0.25").replace("0.18", "0.3"); }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = tier.glow; }}
            >
              Reserve Parcels →
            </button>
          </div>
        ))}
      </div>

      <div style={{
        textAlign: "center", marginTop: 20,
        fontSize: 11, color: "rgba(100,130,180,0.5)", letterSpacing: "0.08em",
      }}>
        ⚠ Bonuses are non-transferable and permanently assigned to wallet address at mainnet launch.
      </div>
    </div>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [entered, setEntered] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleEnter = () => {
    setMenuOpen(false);
    setEntered(true);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); setLocation("/game"); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const navLinks = [
    { label: "Economics", path: "/info/economics" },
    { label: "Gameplay", path: "/info/gameplay" },
    { label: "Features", path: "/info/features" },
    { label: "Updates", path: "/info/updates" },
  ];

  return (
    <div style={{
      position: "relative", minHeight: "100vh", width: "100%",
      overflow: "hidden", fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff",
    }}>
      <Starfield />

      {/* Content layer */}
      <div style={{
        position: "relative", zIndex: 1, minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "0 20px 60px",
      }}>

        {/* ── Navigation Bar ── */}
        <nav style={{
          width: "100%", maxWidth: 900,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 0",
          borderBottom: "1px solid rgba(60,90,180,0.15)",
          marginBottom: 20,
          position: "relative",
        }}>
          {/* Logo */}
          <span style={{
            fontSize: 14, letterSpacing: "0.2em", color: "rgba(120,170,255,0.9)",
            fontWeight: 700, textTransform: "uppercase",
          }}>
            ⬡ FRONTIER
          </span>

          {/* Desktop nav links */}
          <div className="desktop-nav" style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {navLinks.map(({ label, path }) => (
              <button
                key={path}
                onClick={() => setLocation(path)}
                style={{
                  background: "transparent", border: "1px solid rgba(60,90,180,0.25)",
                  borderRadius: 4, padding: "5px 12px",
                  color: "rgba(150,190,255,0.7)", fontSize: 11,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(100,150,255,0.5)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(180,220,255,0.9)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(60,90,180,0.25)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(150,190,255,0.7)"; }}
              >{label}</button>
            ))}
            <button
              onClick={handleEnter}
              style={{
                marginLeft: 8, background: "rgba(60,100,255,0.2)",
                border: "1px solid rgba(80,130,255,0.5)", borderRadius: 4,
                padding: "5px 14px", color: "rgba(150,200,255,0.95)",
                fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                cursor: "pointer", fontWeight: 600,
              }}
            >Enter Game →</button>
          </div>

          {/* Hamburger (mobile) */}
          <button
            className="hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            style={{
              background: "transparent",
              border: "1px solid rgba(60,90,180,0.3)",
              borderRadius: 6, padding: "8px 10px",
              color: "rgba(150,190,255,0.9)", fontSize: 18,
              cursor: "pointer", lineHeight: 1,
              display: "none",
            }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </nav>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="mobile-drawer" style={{
            width: "100%", maxWidth: 900,
            background: "rgba(5,8,25,0.96)",
            border: "1px solid rgba(60,90,180,0.25)",
            borderRadius: 10, padding: "20px",
            backdropFilter: "blur(20px)",
            marginBottom: 16, zIndex: 10,
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {navLinks.map(({ label, path }) => (
              <button
                key={path}
                onClick={() => { setLocation(path); setMenuOpen(false); }}
                style={{
                  background: "transparent", border: "1px solid rgba(60,90,180,0.2)",
                  borderRadius: 6, padding: "12px 16px", color: "rgba(160,200,255,0.8)",
                  fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
                  cursor: "pointer", textAlign: "left", width: "100%",
                }}
              >{label}</button>
            ))}
            <button
              onClick={handleEnter}
              style={{
                background: "rgba(60,100,255,0.25)", border: "1px solid rgba(80,130,255,0.5)",
                borderRadius: 6, padding: "14px 16px", color: "rgba(150,200,255,0.95)",
                fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase",
                cursor: "pointer", fontWeight: 700, textAlign: "center", width: "100%",
                marginTop: 4,
              }}
            >▶ Enter Game</button>
          </div>
        )}

        {/* Top status bar */}
        <div style={{
          width: "100%", maxWidth: 900,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 50, borderBottom: "1px solid rgba(60,90,180,0.2)", paddingBottom: 16,
          flexWrap: "wrap", gap: 8,
        }}>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "rgba(120,160,255,0.6)", textTransform: "uppercase" }}>
            FRONTIER PROTOCOL // v1.4.0
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%", background: "#4ade80",
              boxShadow: "0 0 8px #4ade80", animation: "blink 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 10, letterSpacing: "0.15em", color: "rgba(100,200,130,0.8)" }}>
              ALGORAND TESTNET
            </span>
          </div>
        </div>

        {/* ── Hero Section ── */}
        <div className="hero-section" style={{
          display: "flex", flexDirection: "row", alignItems: "center",
          gap: 60, maxWidth: 900, width: "100%",
          flexWrap: "wrap", justifyContent: "center", marginBottom: 70,
        }}>
          {/* Planet */}
          <div className="planet-wrap" style={{ animation: "fadeInLeft 1.2s ease-out forwards", opacity: 0 }}>
            <Planet />
          </div>

          {/* Title block */}
          <div style={{
            flex: 1, minWidth: 260,
            animation: "fadeInRight 1.2s ease-out 0.2s forwards", opacity: 0,
          }}>
            <div style={{
              fontSize: 10, letterSpacing: "0.35em", color: "rgba(100,150,255,0.7)",
              textTransform: "uppercase", marginBottom: 14,
              borderLeft: "2px solid rgba(100,150,255,0.5)", paddingLeft: 10,
            }}>
              CLASSIFIED // SECTOR 7 — CONSTRUCTION ZONE
            </div>
            <div style={{
              fontSize: "clamp(40px, 10vw, 72px)", fontWeight: 900,
              letterSpacing: "0.06em", lineHeight: 1, textTransform: "uppercase", marginBottom: 8,
              background: "linear-gradient(135deg, #ffffff 0%, #a8c4ff 40%, #6090ff 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              filter: "drop-shadow(0 0 30px rgba(100,150,255,0.4))",
            }}>
              FRONTIER
            </div>
            <div style={{
              fontSize: "clamp(11px, 2.5vw, 17px)", letterSpacing: "0.22em",
              color: "rgba(180,210,255,0.65)", textTransform: "uppercase", marginBottom: 24,
            }}>
              THE PLANET IS BEING BUILT
            </div>
            <div style={{
              height: 1, width: 80,
              background: "linear-gradient(90deg, rgba(100,150,255,0.6), transparent)", marginBottom: 24,
            }} />
            <p style={{
              fontSize: 14, lineHeight: 1.75, color: "rgba(180,205,255,0.65)",
              margin: "0 0 32px", maxWidth: 420,
            }}>
              A territorial strategy game built on the Algorand blockchain.
              21,000 hexagonal land parcels. Real on-chain ownership.
              AI factions, resource wars, and a living planetary economy.
              <br /><br />
              <span style={{ color: "rgba(120,170,255,0.8)", fontStyle: "italic" }}>
                Construction is underway. The frontier awaits.
              </span>
            </p>

            {/* Build progress */}
            <div style={{
              background: "rgba(5,10,30,0.6)", border: "1px solid rgba(60,90,180,0.25)",
              borderRadius: 10, padding: "16px 20px", marginBottom: 32, backdropFilter: "blur(8px)",
            }}>
              <div style={{
                fontSize: 10, letterSpacing: "0.2em", color: "rgba(100,140,255,0.6)",
                textTransform: "uppercase", marginBottom: 14,
              }}>
                — PLANET BUILD STATUS —
              </div>
              <BuildProgress label="Terrain Generation" pct={87} color="#4fc3f7" />
              <BuildProgress label="Hex Grid Mapping" pct={72} color="#81c784" />
              <BuildProgress label="Faction AI Systems" pct={64} color="#ffb74d" />
              <BuildProgress label="Blockchain Integration" pct={91} color="#ce93d8" />
              <BuildProgress label="Resource Economy" pct={55} color="#f48fb1" />
            </div>

            {/* CTA */}
            {!entered ? (
              <button
                onClick={handleEnter}
                style={{
                  background: "transparent", border: "1px solid rgba(100,150,255,0.5)",
                  color: "#a8c4ff", padding: "14px 40px",
                  fontSize: 12, letterSpacing: "0.25em", textTransform: "uppercase",
                  cursor: "pointer", borderRadius: 4, backdropFilter: "blur(8px)",
                  transition: "all 0.3s ease", position: "relative", overflow: "hidden",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(80,120,255,0.2)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 30px rgba(80,120,255,0.3)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLButtonElement).style.color = "#a8c4ff";
                }}
              >
                ▶ ENTER THE FRONTIER
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0" }}>
                <div style={{
                  width: 32, height: 32, border: "2px solid rgba(100,150,255,0.4)",
                  borderTopColor: "#a8c4ff", borderRadius: "50%", animation: "spin 0.8s linear infinite",
                }} />
                <span style={{
                  fontSize: 12, letterSpacing: "0.2em", color: "rgba(160,196,255,0.8)", textTransform: "uppercase",
                }}>
                  INITIALIZING... LAUNCHING IN {countdown}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Hype Ticker ── */}
        <HypeTicker />

        {/* ── Feature grid ── */}
        <div style={{
          maxWidth: 900, width: "100%",
          animation: "fadeInUp 1.2s ease-out 0.5s forwards", opacity: 0, marginBottom: 80,
        }}>
          <div style={{
            fontSize: 10, letterSpacing: "0.28em", color: "rgba(100,140,255,0.5)",
            textTransform: "uppercase", textAlign: "center", marginBottom: 24,
          }}>
            — FRONTIER INTELLIGENCE BRIEFING —
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <FeatureCard icon="🌐" title="21,000 Hex Parcels" desc="Every tile is a unique on-chain asset. Stake your claim before the factions do." />
            <FeatureCard icon="⛓" title="Algorand Blockchain" desc="True ownership via ASAs. Transactions settle in under 4 seconds with near-zero fees." />
            <FeatureCard icon="🤖" title="AI Factions" desc="Three rival AI factions compete for territory. Ally, resist, or be absorbed." />
            <FeatureCard icon="⚗" title="Resource Economy" desc="Mine ore, harvest energy, trade goods. A living economy shaped by player decisions." />
            <FeatureCard icon="🗺" title="3D Planetary Map" desc="Rendered in Three.js. Explore terrain, scout borders, and plan your expansion." />
            <FeatureCard icon="🛡" title="Territory Wars" desc="Expand, fortify, and defend your parcels. Strategic alliances determine who rules the frontier." />
          </div>
        </div>

        {/* ── Token Buy Section ── */}
        <TokenSection />

        {/* ── Early Adopter Incentives ── */}
        <EarlyAdopterSection onEnter={handleEnter} />

        {/* ── Footer ── */}
        <footer style={{
          width: "100%", maxWidth: 900,
          borderTop: "1px solid rgba(60,90,180,0.15)",
          paddingTop: 32, marginTop: 20,
          animation: "fadeInUp 1.2s ease-out 0.8s forwards", opacity: 0,
        }}>
          {/* Stats row */}
          <div style={{
            display: "flex", justifyContent: "space-between", flexWrap: "wrap",
            gap: 10, marginBottom: 32,
          }}>
            {[
              { label: "Network", value: "Algorand TestNet" },
              { label: "Block Time", value: "~3.7s" },
              { label: "Parcels Reserved", value: "4,218 / 21,000" },
              { label: "Status", value: "UNDER CONSTRUCTION" },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: "center", flex: "1 1 120px" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(100,130,200,0.5)", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12, color: "rgba(180,210,255,0.7)", letterSpacing: "0.05em" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Footer nav + branding */}
          <div className="footer-grid">
            <div>
              <div style={{ fontSize: 14, letterSpacing: "0.2em", color: "rgba(120,170,255,0.9)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                ⬡ FRONTIER
              </div>
              <div style={{ fontSize: 12, color: "rgba(140,170,220,0.5)", lineHeight: 1.6, maxWidth: 220 }}>
                A territorial strategy game on the Algorand blockchain. 21,000 parcels. Infinite possibilities.
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(100,130,200,0.5)", textTransform: "uppercase", marginBottom: 12 }}>Explore</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {navLinks.map(({ label, path }) => (
                  <button key={path} onClick={() => setLocation(path)} style={{
                    background: "transparent", border: "none", padding: 0,
                    color: "rgba(140,180,255,0.55)", fontSize: 12, letterSpacing: "0.08em",
                    textTransform: "uppercase", cursor: "pointer", textAlign: "left",
                  }}>{label}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(100,130,200,0.5)", textTransform: "uppercase", marginBottom: 12 }}>Community</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["Discord", "Twitter / X", "Telegram", "GitHub"].map((s) => (
                  <div key={s} style={{ fontSize: 12, letterSpacing: "0.08em", color: "rgba(140,180,255,0.45)", textTransform: "uppercase" }}>{s}</div>
                ))}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 28, paddingTop: 20,
            borderTop: "1px solid rgba(60,90,180,0.1)",
            display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
          }}>
            <div style={{ fontSize: 10, color: "rgba(100,130,180,0.35)", letterSpacing: "0.1em" }}>
              © 2025 FRONTIER PROTOCOL. ALL RIGHTS RESERVED.
            </div>
            <div style={{ fontSize: 10, color: "rgba(100,130,180,0.35)", letterSpacing: "0.1em" }}>
              BUILT ON ALGORAND
            </div>
          </div>
        </footer>
      </div>

      {/* Global keyframes + responsive styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes rotatePlanet {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes growBar {
          from { width: 0%; }
          to { width: var(--target-width); }
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; }
        button:focus { outline: none; }

        /* Ticker */
        .ticker-track { overflow: hidden; white-space: nowrap; }
        .ticker-text {
          display: inline-block;
          animation: ticker 40s linear infinite;
          font-size: 11px;
          letter-spacing: 0.14em;
          color: rgba(140,180,255,0.65);
          text-transform: uppercase;
          padding: 0 24px;
        }

        /* Steps grid */
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        /* Token stats grid */
        .token-stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        /* Tier cards grid */
        .tiers-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        /* Footer grid */
        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 32px;
        }

        /* Desktop nav shown, hamburger hidden */
        .desktop-nav { display: flex !important; }
        .hamburger { display: none !important; }

        /* ── Tablet (≤ 768px) ── */
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .hamburger { display: flex !important; align-items: center; justify-content: center; }

          .steps-grid { grid-template-columns: 1fr; }
          .token-stats-grid { grid-template-columns: repeat(3, 1fr); }
          .tiers-grid { grid-template-columns: 1fr; gap: 12px; }
          .footer-grid { grid-template-columns: 1fr 1fr; gap: 24px; }

          .hero-section { gap: 32px !important; margin-bottom: 50px !important; }
        }

        /* ── Mobile (≤ 480px) ── */
        @media (max-width: 480px) {
          .planet-wrap > div { width: 200px !important; height: 200px !important; }
          .token-stats-grid { grid-template-columns: repeat(2, 1fr); }
          .footer-grid { grid-template-columns: 1fr; gap: 20px; }
          .hero-section { flex-direction: column !important; align-items: center !important; }
        }

        /* ── Landscape mobile (short screens) ── */
        @media (max-height: 500px) and (orientation: landscape) {
          .hero-section { flex-direction: row !important; gap: 24px !important; margin-bottom: 30px !important; }
          .planet-wrap > div { width: 160px !important; height: 160px !important; }
        }
      `}</style>
    </div>
  );
}
