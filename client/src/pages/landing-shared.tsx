import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

// ─── Shared Nav Links ─────────────────────────────────────────────────────────
export const NAV_LINKS = [
  { label: "Home",       path: "/" },
  { label: "Economics",  path: "/info/economics" },
  { label: "Gameplay",   path: "/info/gameplay" },
  { label: "Features",   path: "/info/features" },
  { label: "Updates",    path: "/info/updates" },
];

// ─── Shared Starfield ─────────────────────────────────────────────────────────
export function Starfield() {
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
    const stars = Array.from({ length: 260 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.2, speed: Math.random() * 0.09 + 0.01,
      opacity: Math.random() * 0.6 + 0.25, twinkle: Math.random() * Math.PI * 2,
    }));
    const shoots: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];
    const spawnShoot = () => shoots.push({
      x: Math.random() * window.innerWidth * 0.7,
      y: Math.random() * window.innerHeight * 0.4,
      vx: Math.random() * 7 + 3, vy: Math.random() * 2 + 0.5,
      life: 0, maxLife: Math.random() * 50 + 30,
    });
    let shootTimer = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bg = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.4, 0, canvas.width * 0.5, canvas.height * 0.4, canvas.width * 0.85);
      bg.addColorStop(0, "#04050e"); bg.addColorStop(0.5, "#020308"); bg.addColorStop(1, "#000002");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const neb = ctx.createRadialGradient(canvas.width * 0.3, canvas.height * 0.25, 0, canvas.width * 0.3, canvas.height * 0.25, canvas.width * 0.38);
      neb.addColorStop(0, "rgba(30,5,80,0.15)"); neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const neb2 = ctx.createRadialGradient(canvas.width * 0.77, canvas.height * 0.62, 0, canvas.width * 0.77, canvas.height * 0.62, canvas.width * 0.28);
      neb2.addColorStop(0, "rgba(0,30,70,0.12)"); neb2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb2; ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        s.x += s.speed; s.twinkle += 0.012;
        if (s.x > canvas.width) s.x = 0;
        const alpha = s.opacity * (0.7 + 0.3 * Math.sin(s.twinkle));
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${alpha})`; ctx.fill();
      }
      shootTimer++;
      if (shootTimer > 150) { spawnShoot(); shootTimer = 0; }
      for (let i = shoots.length - 1; i >= 0; i--) {
        const sh = shoots[i];
        sh.x += sh.vx; sh.y += sh.vy; sh.life++;
        const progress = sh.life / sh.maxLife;
        const alpha = Math.sin(progress * Math.PI) * 0.85;
        const grad = ctx.createLinearGradient(sh.x - sh.vx * 8, sh.y - sh.vy * 8, sh.x, sh.y);
        grad.addColorStop(0, `rgba(255,255,255,0)`);
        grad.addColorStop(1, `rgba(200,230,255,${alpha})`);
        ctx.beginPath(); ctx.moveTo(sh.x - sh.vx * 8, sh.y - sh.vy * 8);
        ctx.lineTo(sh.x, sh.y); ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.stroke();
        if (sh.life >= sh.maxLife) shoots.splice(i, 1);
      }
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }} />;
}

// ─── Shared Nav ───────────────────────────────────────────────────────────────
export function LandingNav({ activePath }: { activePath: string }) {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNav = (path: string) => { setLocation(path); setMenuOpen(false); };

  return (
    <>
      <nav style={{
        width: "100%", maxWidth: 940, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "16px 0",
        borderBottom: "1px solid rgba(60,90,180,0.18)", marginBottom: 40,
        position: "relative",
      }}>
        <button onClick={() => handleNav("/")} style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          fontSize: 14, letterSpacing: "0.22em", color: "rgba(120,175,255,0.92)",
          fontWeight: 700, textTransform: "uppercase", fontFamily: "inherit",
        }}>⬡ FRONTIER</button>

        <div className="desktop-nav" style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {NAV_LINKS.map(({ label, path }) => {
            const active = path === activePath;
            return (
              <button key={path} onClick={() => handleNav(path)} style={{
                background: active ? "rgba(60,100,255,0.12)" : "transparent",
                border: active ? "1px solid rgba(80,130,255,0.55)" : "1px solid rgba(60,90,180,0.22)",
                borderRadius: 4, padding: "5px 12px",
                color: active ? "rgba(160,210,255,0.95)" : "rgba(150,190,255,0.65)",
                fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
                cursor: "pointer", fontWeight: active ? 700 : 400,
                transition: "all 0.15s", fontFamily: "inherit",
              }}>{label}</button>
            );
          })}
          <button onClick={() => handleNav("/game")} style={{
            marginLeft: 8, background: "rgba(60,100,255,0.22)",
            border: "1px solid rgba(80,130,255,0.55)", borderRadius: 4,
            padding: "5px 15px", color: "rgba(160,210,255,0.95)", fontSize: 11,
            letterSpacing: "0.12em", textTransform: "uppercase",
            cursor: "pointer", fontWeight: 700, fontFamily: "inherit",
          }}>Enter Game →</button>
        </div>

        <button className="hamburger" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle menu" style={{
          background: "transparent", border: "1px solid rgba(60,90,180,0.35)",
          borderRadius: 6, padding: "8px 11px", color: "rgba(150,195,255,0.9)",
          fontSize: 18, cursor: "pointer", lineHeight: 1, display: "none",
        }}>
          {menuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {menuOpen && (
        <div style={{
          width: "100%", maxWidth: 940,
          background: "rgba(4,6,22,0.97)", border: "1px solid rgba(60,90,180,0.28)",
          borderRadius: 10, padding: "20px", backdropFilter: "blur(20px)",
          marginBottom: 16, zIndex: 100, display: "flex", flexDirection: "column", gap: 10,
        }}>
          {NAV_LINKS.map(({ label, path }) => (
            <button key={path} onClick={() => handleNav(path)} style={{
              background: "transparent", border: "1px solid rgba(60,90,180,0.2)",
              borderRadius: 6, padding: "12px 16px", color: "rgba(160,205,255,0.85)",
              fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
              cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit",
            }}>{label}</button>
          ))}
          <button onClick={() => handleNav("/game")} style={{
            background: "rgba(60,100,255,0.28)", border: "1px solid rgba(80,130,255,0.55)",
            borderRadius: 6, padding: "14px 16px", color: "rgba(160,210,255,0.95)",
            fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase",
            cursor: "pointer", fontWeight: 700, textAlign: "center", width: "100%",
            marginTop: 4, fontFamily: "inherit",
          }}>▶ Enter Game</button>
        </div>
      )}
    </>
  );
}

// ─── Cookie Consent Banner ────────────────────────────────────────────────
export function CookieConsentBanner() {
  const [accepted, setAccepted] = useState(() => {
    try {
      return localStorage.getItem("frontier_cookies_accepted") === "true";
    } catch {
      return false;
    }
  });

  const handleAccept = () => {
    try {
      localStorage.setItem("frontier_cookies_accepted", "true");
    } catch {}
    setAccepted(true);
  };

  if (accepted) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "linear-gradient(135deg, rgba(4,10,25,0.98) 0%, rgba(10,5,30,0.96) 100%)",
      borderTop: "1px solid rgba(60,90,180,0.3)", backdropFilter: "blur(16px)",
      padding: "16px 20px",
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 20, flexWrap: "wrap",
      }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{
            fontSize: 13, color: "rgba(140,180,255,0.85)", lineHeight: 1.5,
          }}>
            We use cookies to enhance your browsing experience and analyze site usage. By clicking "Accept", you consent to our cookie policy.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <a href="/privacy-policy" style={{
            fontSize: 11, color: "rgba(100,160,255,0.7)", textDecoration: "underline",
            textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer",
          }}>Privacy Policy</a>
          <button onClick={handleAccept} style={{
            background: "rgba(60,100,255,0.3)", border: "1px solid rgba(100,160,255,0.55)",
            borderRadius: 6, padding: "8px 16px", color: "rgba(180,220,255,0.95)",
            fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
            cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
          }}>Accept</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Footer ────────────────────────────────────────────────────────────
export function LandingFooter() {
  return (
    <footer style={{
      width: "100%", maxWidth: 1100,
      borderTop: "1px solid rgba(60,90,180,0.15)",
      paddingTop: 40, marginTop: 60, textAlign: "center",
    }}>
      {/* Logo & Description */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 16, letterSpacing: "0.2em", color: "rgba(120,175,255,0.92)", fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>
          ⬡ FRONTIER
        </div>
        <div style={{ fontSize: 13, color: "rgba(140,170,220,0.6)", lineHeight: 1.6, maxWidth: 500, margin: "0 auto", marginBottom: 24 }}>
          A territorial strategy game on the Algorand blockchain. 21,000 parcels. Infinite possibilities.
        </div>

        {/* Social Icons - Centered */}
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center", gap: 20, marginBottom: 24,
        }}>
          <a href="https://x.com/ascendancyalgox" target="_blank" rel="noopener noreferrer" title="Twitter/X" style={{
            fontSize: 24, color: "rgba(150,200,255,0.7)", transition: "all 0.3s",
            cursor: "pointer", textDecoration: "none",
          }} onMouseEnter={(e) => e.currentTarget.style.color = "rgba(79,195,247,0.95)"}
             onMouseLeave={(e) => e.currentTarget.style.color = "rgba(150,200,255,0.7)"}
          >𝕏</a>
          <div title="Discord" style={{
            fontSize: 24, color: "rgba(150,200,255,0.5)", cursor: "default",
          }}>◆</div>
          <div title="Telegram" style={{
            fontSize: 24, color: "rgba(150,200,255,0.5)", cursor: "default",
          }}>✈</div>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" title="GitHub" style={{
            fontSize: 24, color: "rgba(150,200,255,0.7)", transition: "all 0.3s",
            cursor: "pointer", textDecoration: "none",
          }} onMouseEnter={(e) => e.currentTarget.style.color = "rgba(79,195,247,0.95)"}
             onMouseLeave={(e) => e.currentTarget.style.color = "rgba(150,200,255,0.7)"}
          >⚙</a>
        </div>
      </div>

      {/* Network Status */}
      <div style={{
        display: "flex", justifyContent: "center", flexWrap: "wrap",
        gap: 24, marginBottom: 32, paddingBottom: 32, borderBottom: "1px solid rgba(60,90,180,0.1)",
      }}>
        {[
          { label: "Network",          value: "Algorand TestNet" },
          { label: "Parcels Reserved", value: "4,218 / 21,000" },
          { label: "Status",           value: "UNDER CONSTRUCTION" },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(100,130,200,0.5)", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color: "rgba(180,210,255,0.72)", letterSpacing: "0.05em" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Copyright */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
      }}>
        <div style={{ fontSize: 10, color: "rgba(100,130,180,0.32)", letterSpacing: "0.1em" }}>
          © 2025–2026 FRONTIER PROTOCOL. ALL RIGHTS RESERVED.
        </div>
        <div style={{ fontSize: 10, color: "rgba(100,130,180,0.32)", letterSpacing: "0.1em" }}>
          BUILT ON ALGORAND
        </div>
      </div>
    </footer>
  );
}

// ─── Shared Global Styles ─────────────────────────────────────────────────────
export const SHARED_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #000; }
  button:focus { outline: none; }

  /* ── Nav responsive ── */
  .desktop-nav { display: flex !important; }
  .hamburger   { display: none  !important; }

  /* ── Footer grid ── */
  .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 32px; }

  /* ── Sci-fi animations ── */
  @keyframes pulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50%       { opacity: 1;   transform: scale(1.03); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.15; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeInLeft {
    from { opacity: 0; transform: translateX(-28px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeInRight {
    from { opacity: 0; transform: translateX(28px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes glow-pulse {
    0%, 100% { text-shadow: 0 0 8px rgba(100,160,255,0.3); }
    50%       { text-shadow: 0 0 22px rgba(100,160,255,0.75), 0 0 45px rgba(60,120,255,0.35); }
  }
  @keyframes scan-line {
    0%   { transform: translateY(-100%); opacity: 0; }
    10%  { opacity: 0.06; }
    90%  { opacity: 0.06; }
    100% { transform: translateY(100vh); opacity: 0; }
  }
  @keyframes border-glow {
    0%, 100% { box-shadow: 0 0 6px rgba(60,100,255,0.2); }
    50%       { box-shadow: 0 0 18px rgba(80,140,255,0.5); }
  }
  @keyframes ticker {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes growBar {
    from { width: 0%; }
    to   { width: var(--target-width); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* Rocket animation */
  @keyframes rocket-lift {
    0%   { transform: translateY(0px) rotate(-8deg); opacity: 0; }
    5%   { opacity: 1; }
    60%  { transform: translateY(-60px) rotate(-8deg); }
    100% { transform: translateY(-200px) rotate(-8deg); opacity: 0; }
  }
  @keyframes smoke-puff {
    0%   { transform: scale(0.4) translateY(0px); opacity: 0.7; }
    100% { transform: scale(2.2) translateY(30px); opacity: 0; }
  }
  @keyframes flame-flicker {
    0%, 100% { transform: scaleY(1);   opacity: 0.9; }
    50%       { transform: scaleY(1.3); opacity: 1; }
  }
  @keyframes float-up {
    0%   { transform: translateY(0px); }
    50%  { transform: translateY(-7px); }
    100% { transform: translateY(0px); }
  }
  @keyframes text-glitch {
    0%, 92%, 100% { clip-path: none; transform: none; }
    93%  { clip-path: inset(20% 0 60% 0); transform: translateX(3px); }
    95%  { clip-path: inset(60% 0 10% 0); transform: translateX(-3px); }
    97%  { clip-path: inset(40% 0 40% 0); transform: translateX(2px); }
  }
  @keyframes grid-scroll {
    from { background-position: 0 0; }
    to   { background-position: 0 60px; }
  }

  .glow-text { animation: glow-pulse 3s ease-in-out infinite; }
  .float-anim { animation: float-up 4s ease-in-out infinite; }
  .glitch-text { animation: text-glitch 8s ease-in-out infinite; }
  .border-glow { animation: border-glow 2.5s ease-in-out infinite; }

  .ticker-track { overflow: hidden; white-space: nowrap; }
  .ticker-text {
    display: inline-block;
    animation: ticker 40s linear infinite;
    font-size: 11px; letter-spacing: 0.14em;
    color: rgba(140,180,255,0.65); text-transform: uppercase; padding: 0 24px;
  }

  /* ── Grid classes ── */
  .steps-grid        { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .token-stats-grid  { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  .tiers-grid        { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

  /* ── Responsive: tablet ── */
  @media (max-width: 768px) {
    .desktop-nav { display: none !important; }
    .hamburger   { display: flex !important; align-items: center; justify-content: center; }

    .steps-grid        { grid-template-columns: 1fr; }
    .token-stats-grid  { grid-template-columns: repeat(3, 1fr); }
    .tiers-grid        { grid-template-columns: 1fr; gap: 12px; }
    .footer-grid       { grid-template-columns: 1fr 1fr !important; gap: 24px !important; }
  }

  /* ── Responsive: mobile ── */
  @media (max-width: 480px) {
    .token-stats-grid { grid-template-columns: repeat(2, 1fr); }
    .footer-grid      { grid-template-columns: 1fr !important; gap: 20px !important; }
  }
`;
