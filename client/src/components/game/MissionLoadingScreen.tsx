import { useEffect, useState } from "react";

export function MissionLoadingScreen() {
  const [countdown, setCountdown] = useState(6);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "linear-gradient(135deg, rgba(0,0,30,0.98) 0%, rgba(10,5,40,0.96) 100%)",
        backdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      {/* Animated Globe */}
      <div style={{ position: "relative", width: 200, height: 200, animation: "rotatePlanet 12s linear infinite" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #2a4a8c 0%, #1a2e5a 30%, #0d1a3a 55%, #060d20 80%, #020508 100%)",
            boxShadow:
              "0 0 60px 15px rgba(40,80,200,0.3), inset -20px -15px 40px rgba(0,0,0,0.6), inset 10px 10px 30px rgba(60,100,200,0.1)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "radial-gradient(circle at 30% 30%, rgba(100,160,255,0.12) 0%, transparent 60%)",
            }}
          />
        </div>
        {/* Orbital pulse */}
        <div
          style={{
            position: "absolute",
            inset: -20,
            borderRadius: "50%",
            border: "2px solid rgba(79,195,247,0.3)",
            animation: "pulse 3s ease-in-out infinite",
          }}
        />
      </div>

      {/* Mission Log */}
      <div
        style={{
          maxWidth: 380,
          textAlign: "center",
          background: "rgba(5,15,50,0.6)",
          border: "1px solid rgba(79,195,247,0.3)",
          borderRadius: 12,
          padding: "20px 24px",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "rgba(79,195,247,0.8)",
            textTransform: "uppercase",
            marginBottom: 12,
            fontFamily: "monospace",
          }}
        >
          ◆ MISSION LOGS
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(150,200,255,0.7)",
            lineHeight: 1.8,
            fontFamily: "monospace",
            textAlign: "left",
          }}
        >
          <div style={{ marginBottom: 6, animation: countdown > 2 ? "none" : "fadeInUp 0.6s ease-out" }}>
            <span style={{ color: "rgba(100,200,100,0.8)" }}>✓</span> Initializing frontier access…
          </div>
          <div style={{ marginBottom: 6, animation: countdown > 1 ? "none" : "fadeInUp 0.6s ease-out 0.5s both" }}>
            <span style={{ color: "rgba(100,200,100,0.8)" }}>✓</span> Blockchain sync complete
          </div>
          <div style={{ animation: countdown > 0 ? "none" : "fadeInUp 0.6s ease-out 1s both" }}>
            <span style={{ color: "rgba(100,200,100,0.8)" }}>✓</span> Commander designation confirmed
          </div>
        </div>
      </div>

      {/* Launch countdown */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: "#4fc3f7",
            marginBottom: 12,
            fontFamily: "monospace",
          }}
        >
          {countdown}
        </div>
        <div style={{ fontSize: 12, letterSpacing: "0.15em", color: "rgba(150,180,255,0.7)", textTransform: "uppercase" }}>
          Launching mission…
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: 220, height: 3, background: "rgba(60,90,180,0.2)", borderRadius: 2, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            background: "linear-gradient(90deg, #4fc3f7, #a78bfa)",
            width: `${((6 - countdown) / 6) * 100}%`,
            transition: "width 1s linear",
            borderRadius: 2,
            boxShadow: "0 0 12px rgba(79,195,247,0.8)",
          }}
        />
      </div>

      <style>{`
        @keyframes rotatePlanet {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.03); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
