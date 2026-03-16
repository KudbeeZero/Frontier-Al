/**
 * GlobeHUD — all HTML overlay UI rendered outside the R3F Canvas:
 *   GlobeHUD       — telemetry readout, REC indicator, classification watermark
 *   GlobeCompass   — animated compass rose polling OrbitControls azimuth via rAF
 *   PlayerLegend   — "YOU" faction colour indicator
 *   ParcelHUD      — selected parcel info card with action buttons
 */

import { useRef, useEffect } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { LandParcel, Player } from "@shared/schema";
import { Sword, HardHat, Pickaxe, Zap } from "lucide-react";

// ── GlobeHUD ──────────────────────────────────────────────────────────────────

interface GlobeHUDProps {
  activeBattleCount: number;
  replayTime?: number;
}

export function GlobeHUD({ activeBattleCount, replayTime }: GlobeHUDProps) {
  const now = replayTime ?? Date.now();
  const utc = new Date(now).toISOString().slice(11, 19) + " UTC";

  return (
    <>
      {/* Bottom-left telemetry */}
      <div
        className="absolute bottom-28 left-4 z-20 pointer-events-none select-none"
        style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", lineHeight: "1.8", color: "rgba(0,229,255,0.55)" }}
      >
        <div>38P NS 3942 7798</div>
        <div>22.14°N 045°21'37.73&quot;E</div>
      </div>

      {/* Bottom-right telemetry */}
      <div
        className="absolute bottom-28 right-4 z-20 pointer-events-none select-none text-right"
        style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", lineHeight: "1.8", color: "rgba(0,229,255,0.55)" }}
      >
        <div>GSD: 1404.42M NIIR</div>
        <div>ALT: 3745115M SUN: -20</div>
      </div>

      {/* Top-right: REC indicator + timestamp */}
      <div
        className="absolute top-4 right-4 z-20 pointer-events-none select-none flex items-center gap-2"
        style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", color: "rgba(0,229,255,0.5)" }}
      >
        {activeBattleCount > 0 && (
          <span style={{ color: "#ff1744", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#ff1744",
              display: "inline-block", animation: "pulse 1.2s infinite"
            }} />
            REC
          </span>
        )}
        <span>{utc}</span>
      </div>

      {/* Top-left: classification watermark */}
      <div
        className="absolute top-4 left-20 z-20 pointer-events-none select-none"
        style={{ fontFamily: "monospace", fontSize: 8, letterSpacing: "0.25em", color: "rgba(0,229,255,0.35)" }}
      >
        <div>CRET // SI-TK // NOFORN</div>
        <div>176 OPS-4179</div>
      </div>
    </>
  );
}

// ── GlobeCompass ──────────────────────────────────────────────────────────────

export function GlobeCompass({ controlsRef }: { controlsRef: { current: OrbitControlsImpl } }) {
  const needleRef = useRef<HTMLDivElement>(null);
  const labelRef  = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const ctrl = controlsRef.current;
      if (ctrl && needleRef.current && labelRef.current) {
        const az  = ctrl.getAzimuthalAngle();
        const deg = ((az * 180 / Math.PI) % 360 + 360) % 360;
        needleRef.current.style.transform = `rotate(${deg}deg)`;
        const dirs = ["N","NE","E","SE","S","SW","W","NW"];
        labelRef.current.textContent = dirs[Math.round(deg / 45) % 8];
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controlsRef]);

  return (
    <div
      style={{
        position: "absolute", top: 12, right: 12, zIndex: 30,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        pointerEvents: "none", userSelect: "none",
      }}
    >
      <div style={{ position: "relative", width: 44, height: 44 }}>
        {(["N","E","S","W"] as const).map((d, i) => {
          const angle = i * 90;
          const r = 16;
          const x = 22 + r * Math.sin(angle * Math.PI / 180);
          const y = 22 - r * Math.cos(angle * Math.PI / 180);
          return (
            <span key={d} style={{
              position: "absolute", left: x, top: y,
              transform: "translate(-50%,-50%)",
              fontSize: 8, fontFamily: "monospace", fontWeight: "bold", letterSpacing: "0.05em",
              color: d === "N" ? "#ff4444" : "rgba(0,229,255,0.7)",
            }}>{d}</span>
          );
        })}
        <div ref={needleRef} style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          transformOrigin: "center",
        }}>
          <div style={{
            width: 2, height: 20, borderRadius: 1,
            background: "linear-gradient(to bottom, #ff4444 50%, rgba(0,229,255,0.5) 50%)",
          }} />
        </div>
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          width: 4, height: 4, borderRadius: "50%",
          background: "rgba(0,229,255,0.9)",
          transform: "translate(-50%,-50%)",
        }} />
      </div>
      <span ref={labelRef} style={{
        fontSize: 8, fontFamily: "monospace", letterSpacing: "0.2em",
        color: "rgba(0,229,255,0.7)",
      }}>N</span>
    </div>
  );
}

// ── PlayerLegend ──────────────────────────────────────────────────────────────

export function PlayerLegend() {
  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-md backdrop-blur-md"
        style={{ background: "#00ff6a12", border: "1px solid #00ff6a30" }}>
        <div className="w-2 h-2 rounded-full" style={{ background: "#00ff6a", boxShadow: "0 0 6px #00ff6a" }} />
        <span className="text-[10px] font-mono tracking-widest uppercase text-green-400">YOU</span>
      </div>
    </div>
  );
}

// ── ParcelHUD ─────────────────────────────────────────────────────────────────

interface ParcelHUDProps {
  parcel: LandParcel;
  currentPlayerId: string | null;
  playerMap: Map<string, Player>;
  onAttack?: () => void;
  onMine?: () => void;
  onBuild?: () => void;
  onParcelSelect: (id: string) => void;
}

export function ParcelHUD({ parcel, currentPlayerId, onAttack, onMine, onBuild, onParcelSelect }: ParcelHUDProps) {
  const isPlayer = parcel.ownerId === currentPlayerId;

  const accentColor = isPlayer ? "#00ff6a"
    : parcel.ownerId ? "#ff6e40"
    : "#4fc3f7";

  const statusLabel = isPlayer ? "SECURED"
    : parcel.ownerId ? "HOSTILE"
    : "UNCLAIMED";

  return (
    <div className="absolute z-30 pointer-events-none"
      style={{
        bottom: "calc(50% + 20px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(320px, calc(100vw - 32px))",
        maxWidth: "100%",
      }}
    >
      <div
        className="pointer-events-auto flex flex-col gap-3 rounded-2xl p-4 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: "rgba(4, 8, 20, 0.88)",
          border: `1px solid ${accentColor}40`,
          boxShadow: `0 0 40px ${accentColor}18, inset 0 1px 0 ${accentColor}20`,
        }}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[9px] tracking-[0.3em] uppercase mb-0.5" style={{ color: `${accentColor}99` }}>
              Plot #{parcel.plotId}
            </div>
            <div className="text-base font-mono font-bold uppercase tracking-wider text-white">
              {parcel.biome} Zone
            </div>
          </div>
          <div
            className="text-[9px] px-2 py-1 rounded tracking-widest uppercase font-mono"
            style={{ color: accentColor, background: `${accentColor}15`, border: `1px solid ${accentColor}40` }}
          >
            {statusLabel}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Defense",  value: parcel.defenseLevel },
            { label: "Richness", value: parcel.richness },
            { label: "FRNTR/d",  value: parcel.frontierPerDay?.toFixed(1) ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg py-1.5"
              style={{ background: `${accentColor}0a`, border: `1px solid ${accentColor}18` }}>
              <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: `${accentColor}70` }}>{label}</div>
              <div className="text-sm font-mono font-bold" style={{ color: accentColor }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {isPlayer ? (
            <>
              <button onClick={onMine}
                className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[11px] font-mono uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
                style={{ background: "#00ff6a12", border: "1px solid #00ff6a35", color: "#00ff6a" }}>
                <Pickaxe className="w-3.5 h-3.5" /> Extract
              </button>
              <button onClick={onBuild}
                className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[11px] font-mono uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
                style={{ background: "#4fc3f712", border: "1px solid #4fc3f735", color: "#4fc3f7" }}>
                <HardHat className="w-3.5 h-3.5" /> Develop
              </button>
            </>
          ) : parcel.ownerId ? (
            <button onClick={onAttack}
              className="col-span-2 flex items-center justify-center gap-2 h-10 rounded-lg text-[11px] font-mono uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
              style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}50`, color: accentColor, boxShadow: `0 0 20px ${accentColor}20` }}>
              <Sword className="w-4 h-4" /> Initiate Invasion
            </button>
          ) : (
            <button onClick={() => onParcelSelect(parcel.id)}
              className="col-span-2 flex items-center justify-center gap-2 h-10 rounded-lg text-[11px] font-mono uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
              style={{ background: "#4fc3f712", border: "1px solid #4fc3f740", color: "#4fc3f7" }}>
              <Zap className="w-4 h-4" /> Acquire Territory
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
