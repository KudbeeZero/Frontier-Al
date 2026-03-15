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

    // Generate stars
    const stars = Array.from({ length: 320 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.2,
      speed: Math.random() * 0.15 + 0.02,
      opacity: Math.random() * 0.6 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
    }));

    // Shooting stars
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

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Deep space gradient
      const bg = ctx.createRadialGradient(
        canvas.width * 0.5, canvas.height * 0.4, 0,
        canvas.width * 0.5, canvas.height * 0.4, canvas.width * 0.8
      );
      bg.addColorStop(0, "#05060f");
      bg.addColorStop(0.5, "#020308");
      bg.addColorStop(1, "#000002");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Nebula glow
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

      // Stars
      for (const s of stars) {
        s.twinkle += 0.008;
        const alpha = s.opacity * (0.7 + 0.3 * Math.sin(s.twinkle));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${alpha})`;
        ctx.fill();
      }

      // Shooting stars
      shootTimer++;
      if (shootTimer > 160) {
        spawnShoot();
        shootTimer = 0;
      }
      for (let i = shoots.length - 1; i >= 0; i--) {
        const sh = shoots[i];
        sh.x += sh.vx;
        sh.y += sh.vy;
        sh.life++;
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
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0 }}
    />
  );
}

// ─── Animated Planet ─────────────────────────────────────────────────────────
function Planet() {
  return (
    <div style={{ position: "relative", width: 260, height: 260, flexShrink: 0 }}>
      {/* Outer glow rings */}
      <div style={{
        position: "absolute", inset: -40,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(60,100,255,0.08) 0%, transparent 70%)",
        animation: "pulse 4s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", inset: -20,
        borderRadius: "50%",
        boxShadow: "0 0 60px 20px rgba(80,120,255,0.12), 0 0 120px 40px rgba(30,60,180,0.07)",
      }} />

      {/* Planet ring / orbit */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        width: 360, height: 80,
        transform: "translate(-50%, -50%) rotateX(72deg)",
        border: "1.5px solid rgba(120,160,255,0.18)",
        borderRadius: "50%",
        boxShadow: "0 0 16px 2px rgba(100,140,255,0.10)",
        pointerEvents: "none",
      }} />

      {/* Planet body */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: "50%",
        background: `
          radial-gradient(circle at 35% 35%,
            #2a4a8c 0%,
            #1a2e5a 30%,
            #0d1a3a 55%,
            #060d20 80%,
            #020508 100%
          )
        `,
        boxShadow: `
          inset -30px -20px 60px rgba(0,0,0,0.8),
          inset 10px 10px 40px rgba(60,100,200,0.15),
          0 0 40px 8px rgba(40,80,200,0.2),
          0 0 80px 20px rgba(20,50,150,0.12)
        `,
        overflow: "hidden",
        animation: "rotatePlanet 30s linear infinite",
      }}>
        {/* Continent-like land masses */}
        <svg viewBox="0 0 260 260" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.35 }}>
          <ellipse cx="90" cy="100" rx="35" ry="22" fill="rgba(80,160,80,0.7)" transform="rotate(-15,90,100)" />
          <ellipse cx="160" cy="140" rx="28" ry="18" fill="rgba(90,140,70,0.6)" transform="rotate(20,160,140)" />
          <ellipse cx="110" cy="175" rx="20" ry="12" fill="rgba(100,155,75,0.5)" />
          <ellipse cx="185" cy="85" rx="15" ry="10" fill="rgba(80,150,80,0.5)" transform="rotate(-30,185,85)" />
          <ellipse cx="55" cy="155" rx="18" ry="11" fill="rgba(85,145,70,0.45)" transform="rotate(10,55,155)" />
          {/* Grid hex overlay hint */}
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

        {/* Atmosphere shimmer */}
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, rgba(100,160,255,0.12) 0%, transparent 60%)",
        }} />

        {/* Terminator line (day/night shadow) */}
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: "50%",
          background: "radial-gradient(circle at 70% 65%, transparent 40%, rgba(0,0,0,0.55) 75%)",
        }} />
      </div>

      {/* Atmosphere edge glow */}
      <div style={{
        position: "absolute", inset: -3,
        borderRadius: "50%",
        background: "transparent",
        boxShadow: "inset 0 0 20px 6px rgba(60,120,255,0.18)",
        border: "2px solid rgba(80,130,255,0.1)",
      }} />

      {/* Construction indicators — glowing dots */}
      {[
        { top: "18%", left: "42%", delay: "0s" },
        { top: "55%", left: "25%", delay: "0.4s" },
        { top: "68%", left: "60%", delay: "0.8s" },
        { top: "35%", left: "70%", delay: "1.2s" },
        { top: "78%", left: "40%", delay: "1.6s" },
      ].map((dot, i) => (
        <div key={i} style={{
          position: "absolute",
          top: dot.top, left: dot.left,
          width: 6, height: 6,
          borderRadius: "50%",
          background: "#4fc3f7",
          boxShadow: "0 0 8px 3px rgba(79,195,247,0.8)",
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
        background: hovered
          ? "rgba(40,60,120,0.35)"
          : "rgba(10,15,40,0.55)",
        border: `1px solid ${hovered ? "rgba(100,160,255,0.4)" : "rgba(60,90,180,0.2)"}`,
        borderRadius: 12,
        padding: "20px 22px",
        backdropFilter: "blur(10px)",
        transition: "all 0.3s ease",
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? "0 8px 32px rgba(60,100,255,0.18)" : "none",
        cursor: "default",
        flex: "1 1 200px",
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: "#a0b8ff",
        textTransform: "uppercase",
        marginBottom: 6,
      }}>{title}</div>
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
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 2,
          boxShadow: `0 0 8px ${color}`,
          animation: "growBar 1.8s ease-out forwards",
        }} />
      </div>
    </div>
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
        if (c <= 1) {
          clearInterval(timer);
          setLocation("/game");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  return (
    <div style={{
      position: "relative",
      minHeight: "100vh",
      width: "100%",
      overflow: "hidden",
      fontFamily: "'Courier New', 'SF Mono', monospace",
      color: "#e0eaff",
    }}>
      <Starfield />

      {/* Content layer */}
      <div style={{
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 24px 60px",
      }}>

        {/* Top bar */}
        <div style={{
          width: "100%",
          maxWidth: 900,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 60,
          borderBottom: "1px solid rgba(60,90,180,0.2)",
          paddingBottom: 16,
        }}>
          <div style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "rgba(120,160,255,0.6)",
            textTransform: "uppercase",
          }}>
            FRONTIER PROTOCOL // v1.4.0
          </div>
          <div style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "#4ade80",
              boxShadow: "0 0 8px #4ade80",
              animation: "blink 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 10, letterSpacing: "0.15em", color: "rgba(100,200,130,0.8)" }}>
              ALGORAND TESTNET
            </span>
          </div>
        </div>

        {/* Hero section */}
        <div style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 60,
          maxWidth: 900,
          width: "100%",
          flexWrap: "wrap",
          justifyContent: "center",
          marginBottom: 70,
        }}>
          {/* Planet */}
          <div style={{ animation: "fadeInLeft 1.2s ease-out forwards", opacity: 0 }}>
            <Planet />
          </div>

          {/* Title block */}
          <div style={{
            flex: 1,
            minWidth: 280,
            animation: "fadeInRight 1.2s ease-out 0.2s forwards",
            opacity: 0,
          }}>
            {/* Eyebrow */}
            <div style={{
              fontSize: 10,
              letterSpacing: "0.35em",
              color: "rgba(100,150,255,0.7)",
              textTransform: "uppercase",
              marginBottom: 14,
              borderLeft: "2px solid rgba(100,150,255,0.5)",
              paddingLeft: 10,
            }}>
              CLASSIFIED // SECTOR 7 — CONSTRUCTION ZONE
            </div>

            {/* Main title */}
            <div style={{
              fontSize: "clamp(44px, 7vw, 72px)",
              fontWeight: 900,
              letterSpacing: "0.06em",
              lineHeight: 1,
              textTransform: "uppercase",
              marginBottom: 8,
              background: "linear-gradient(135deg, #ffffff 0%, #a8c4ff 40%, #6090ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              textShadow: "none",
              filter: "drop-shadow(0 0 30px rgba(100,150,255,0.4))",
            }}>
              FRONTIER
            </div>

            {/* Subtitle */}
            <div style={{
              fontSize: "clamp(13px, 2vw, 17px)",
              letterSpacing: "0.22em",
              color: "rgba(180,210,255,0.65)",
              textTransform: "uppercase",
              marginBottom: 24,
            }}>
              THE PLANET IS BEING BUILT
            </div>

            {/* Divider */}
            <div style={{
              height: 1,
              width: 80,
              background: "linear-gradient(90deg, rgba(100,150,255,0.6), transparent)",
              marginBottom: 24,
            }} />

            {/* Description */}
            <p style={{
              fontSize: 14,
              lineHeight: 1.75,
              color: "rgba(180,205,255,0.65)",
              margin: "0 0 32px",
              maxWidth: 420,
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
              background: "rgba(5,10,30,0.6)",
              border: "1px solid rgba(60,90,180,0.25)",
              borderRadius: 10,
              padding: "16px 20px",
              marginBottom: 32,
              backdropFilter: "blur(8px)",
            }}>
              <div style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "rgba(100,140,255,0.6)",
                textTransform: "uppercase",
                marginBottom: 14,
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
                  background: "transparent",
                  border: "1px solid rgba(100,150,255,0.5)",
                  color: "#a8c4ff",
                  padding: "14px 40px",
                  fontSize: 12,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  borderRadius: 4,
                  backdropFilter: "blur(8px)",
                  transition: "all 0.3s ease",
                  position: "relative",
                  overflow: "hidden",
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
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 0",
              }}>
                <div style={{
                  width: 32, height: 32,
                  border: "2px solid rgba(100,150,255,0.4)",
                  borderTopColor: "#a8c4ff",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }} />
                <span style={{
                  fontSize: 12,
                  letterSpacing: "0.2em",
                  color: "rgba(160,196,255,0.8)",
                  textTransform: "uppercase",
                }}>
                  INITIALIZING... LAUNCHING IN {countdown}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Feature grid */}
        <div style={{
          maxWidth: 900,
          width: "100%",
          animation: "fadeInUp 1.2s ease-out 0.5s forwards",
          opacity: 0,
        }}>
          <div style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            color: "rgba(100,140,255,0.5)",
            textTransform: "uppercase",
            textAlign: "center",
            marginBottom: 24,
          }}>
            — FRONTIER INTELLIGENCE BRIEFING —
          </div>
          <div style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: "center",
          }}>
            <FeatureCard
              icon="🌐"
              title="21,000 Hex Parcels"
              desc="Every tile is a unique on-chain asset. Stake your claim before the factions do."
            />
            <FeatureCard
              icon="⛓"
              title="Algorand Blockchain"
              desc="True ownership via ASAs. Transactions settle in under 4 seconds with near-zero fees."
            />
            <FeatureCard
              icon="🤖"
              title="AI Factions"
              desc="Three rival AI factions compete for territory. Ally, resist, or be absorbed."
            />
            <FeatureCard
              icon="⚗"
              title="Resource Economy"
              desc="Mine ore, harvest energy, trade goods. A living economy shaped by player decisions."
            />
            <FeatureCard
              icon="🗺"
              title="3D Planetary Map"
              desc="Rendered in Three.js. Explore terrain, scout borders, and plan your expansion."
            />
            <FeatureCard
              icon="🛡"
              title="Territory Wars"
              desc="Expand, fortify, and defend your parcels. Strategic alliances determine who rules the frontier."
            />
          </div>
        </div>

        {/* Bottom status bar */}
        <div style={{
          marginTop: 60,
          borderTop: "1px solid rgba(60,90,180,0.15)",
          paddingTop: 20,
          width: "100%",
          maxWidth: 900,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          animation: "fadeInUp 1.2s ease-out 0.8s forwards",
          opacity: 0,
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
      </div>

      {/* Global keyframes */}
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
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; }
        button:focus { outline: none; }
      `}</style>
    </div>
  );
}
