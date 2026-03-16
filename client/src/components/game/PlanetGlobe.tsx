/**
 * PlanetGlobe — FRONTIER 3D globe orchestrator.
 * Wires props, mounts sub-components, and renders the Canvas.
 * Scene internals live in ./globe/ and hooks in @/hooks/.
 */

import * as THREE from "three";
import { useRef, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { LandParcel, Player, Battle, OrbitalEvent } from "@shared/schema";
import type { WorldEvent } from "@shared/worldEvents";
import { GlobeEventOverlays } from "./GlobeEventOverlays";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { StarField }           from "./globe/StarField";
import { GlobeAtmosphere }     from "./globe/GlobeAtmosphere";
import { GlobeTerrain }        from "./globe/GlobeTerrain";
import { PlotOverlay, SubParcelOverlay } from "./globe/GlobeParcels";
import { BattleArcs, MiningPulseLayer, OrbitalZoneLayer, SatelliteOrbitLayer } from "./globe/GlobeEvents";
import { GlobeHUD, GlobeCompass, PlayerLegend, ParcelHUD } from "./globe/GlobeHUD";
import { CameraController } from "@/hooks/useGlobeCamera";

export type { LivePulse } from "@/lib/globe/globeTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

import type { LivePulse } from "@/lib/globe/globeTypes";

interface SceneProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  onPlotSelect: (parcelId: string) => void;
  controlsRef: React.RefObject<OrbitControlsImpl>;
  targetLat: number | null;
  targetLng: number | null;
  battles: Battle[];
  livePulses: LivePulse[];
  orbitalEvents: OrbitalEvent[];
  replayEvents?: WorldEvent[];
  replayTime?: number;
  replayVisibleTypes?: Set<string>;
  streamMode?: boolean;
}

// ── Scene ─────────────────────────────────────────────────────────────────────

function Scene({
  parcels, players, currentPlayerId, selectedPlotId, onPlotSelect,
  controlsRef, targetLat, targetLng, battles, livePulses, orbitalEvents,
  replayEvents, replayTime, replayVisibleTypes, streamMode,
}: SceneProps) {
  const battleHotspots = useMemo(() => {
    if (!streamMode) return [];
    const parcelMap = new Map(parcels.map(p => [p.id, p]));
    return battles
      .filter(b => b.status === "pending")
      .map(b => parcelMap.get(b.targetParcelId))
      .filter((p): p is LandParcel => !!p)
      .map(p => ({ lat: p.lat, lng: p.lng }));
  }, [streamMode, battles, parcels]);

  return (
    <>
      <CameraController
        targetLat={targetLat}
        targetLng={targetLng}
        controlsRef={controlsRef}
        streamMode={streamMode}
        battleHotspots={battleHotspots}
      />
      <StarField />
      <GlobeAtmosphere />
      <ambientLight intensity={1.0} color="#c8d8ff" />
      <directionalLight position={[8, 5, 5]} intensity={1.8} color="#fff5e0" />
      <group>
        <GlobeTerrain />
        <PlotOverlay
          parcels={parcels}
          players={players}
          currentPlayerId={currentPlayerId}
          selectedPlotId={selectedPlotId}
          onPlotSelect={onPlotSelect}
        />
        <SubParcelOverlay
          parcels={parcels}
          players={players}
          currentPlayerId={currentPlayerId}
        />
        {replayEvents && replayEvents.length > 0 && replayVisibleTypes && replayTime !== undefined && (
          <GlobeEventOverlays
            events={replayEvents}
            replayTime={replayTime}
            visibleTypes={replayVisibleTypes}
          />
        )}
      </group>
      <BattleArcs battles={battles} parcels={parcels} players={players} currentPlayerId={currentPlayerId} />
      <MiningPulseLayer pulses={livePulses} />
      <OrbitalZoneLayer events={orbitalEvents} />
      <SatelliteOrbitLayer players={players} />
      <OrbitControls
        ref={controlsRef as any}
        enablePan={false}
        enableDamping={true}
        dampingFactor={0.08}
        rotateSpeed={0.45}
        zoomSpeed={0.9}
        minDistance={GLOBE_RADIUS * 1.8}
        maxDistance={GLOBE_RADIUS * 6.0}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        makeDefault
      />
    </>
  );
}

// ── PlanetGlobe ───────────────────────────────────────────────────────────────

interface PlanetGlobeProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
  selectedParcelId: string | null;
  onParcelSelect: (parcelId: string) => void;
  onAttack?: () => void;
  onMine?: () => void;
  onBuild?: () => void;
  className?: string;
  battles?: Battle[];
  livePulses?: LivePulse[];
  orbitalEvents?: OrbitalEvent[];
  replayEvents?: WorldEvent[];
  replayTime?: number;
  replayVisibleTypes?: Set<string>;
  activeBattleCount?: number;
  /** Enable stream mode: fullscreen hotspot camera + no HUD chrome. */
  streamMode?: boolean;
}

export default function PlanetGlobe({
  parcels,
  players,
  currentPlayerId,
  selectedParcelId,
  onParcelSelect,
  onAttack,
  onMine,
  onBuild,
  className,
  battles = [],
  livePulses = [],
  orbitalEvents = [],
  replayEvents,
  replayTime,
  replayVisibleTypes,
  activeBattleCount = 0,
  streamMode = false,
}: PlanetGlobeProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null!);

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const selectedParcel = useMemo(
    () => parcels.find(p => p.id === selectedParcelId),
    [parcels, selectedParcelId]
  );

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%", background: "#000b1e" }}>
      <Canvas
        camera={{ position: [0, 0, GLOBE_RADIUS * 3.8], fov: 45, near: 0.5, far: 200 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        style={{ background: "#000b1e", touchAction: "none" }}
      >
        <Scene
          parcels={parcels}
          players={players}
          currentPlayerId={currentPlayerId}
          selectedPlotId={selectedParcelId}
          onPlotSelect={onParcelSelect}
          controlsRef={controlsRef}
          targetLat={selectedParcel?.lat ?? null}
          targetLng={selectedParcel?.lng ?? null}
          battles={battles}
          livePulses={livePulses}
          orbitalEvents={orbitalEvents}
          replayEvents={replayEvents}
          replayTime={replayTime}
          replayVisibleTypes={replayVisibleTypes}
          streamMode={streamMode}
        />
      </Canvas>

      <GlobeHUD activeBattleCount={activeBattleCount} replayTime={replayTime} />

      <GlobeCompass controlsRef={controlsRef} />

      {/* Zoom buttons */}
      <div style={{
        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
        zIndex: 30, display: "flex", flexDirection: "column", gap: 4,
      }}>
        {(["+", "−"] as const).map((label, i) => (
          <button
            key={label}
            onClick={() => {
              const cam = controlsRef.current?.object;
              if (!cam) return;
              const d = (cam as THREE.PerspectiveCamera).position.length();
              const next = i === 0
                ? Math.max(GLOBE_RADIUS * 1.8, d * 0.82)
                : Math.min(GLOBE_RADIUS * 6.0, d * 1.20);
              (cam as THREE.PerspectiveCamera).position.setLength(next);
              controlsRef.current.update();
            }}
            style={{
              width: 32, height: 32,
              background: "rgba(4,8,20,0.7)",
              border: "1px solid rgba(79,195,247,0.3)",
              borderRadius: 6, color: "rgba(0,229,255,0.85)",
              fontSize: 18, lineHeight: 1, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "monospace",
            }}
          >{label}</button>
        ))}
      </div>

      <PlayerLegend />

      {selectedParcel && (
        <ParcelHUD
          parcel={selectedParcel}
          currentPlayerId={currentPlayerId}
          playerMap={playerMap}
          onAttack={onAttack}
          onMine={onMine}
          onBuild={onBuild}
          onParcelSelect={onParcelSelect}
        />
      )}

      <button
        onClick={() => controlsRef.current?.reset()}
        className="absolute bottom-24 right-4 z-20 backdrop-blur-xl text-white/50 hover:text-white/90 px-3 py-2 rounded-lg transition-all"
        style={{ background: "rgba(4, 8, 20, 0.6)", border: "1px solid rgba(79, 195, 247, 0.15)", fontSize: 10, fontFamily: "monospace", letterSpacing: "0.2em" }}
      >
        RESET
      </button>
    </div>
  );
}
