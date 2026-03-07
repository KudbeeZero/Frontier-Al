/**
 * PlanetGlobe.tsx — FRONTIER Tier 1 Globe
 */

import * as THREE from "three";
import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { Canvas, useLoader, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { LandParcel, Player } from "@shared/schema";
import { biomeColors } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Sword, HardHat, Pickaxe, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const GLOBE_RADIUS = 2;
const PLOT_COUNT = 21000;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const FACTION_COLORS: Record<string, {
  three: THREE.Color;
  hex: string;
  glow: string;
  label: string;
}> = {
  "NEXUS-7":  { three: new THREE.Color("#00e5ff"), hex: "#00e5ff", glow: "#00b8d4", label: "NEXUS-7"  },
  "KRONOS":   { three: new THREE.Color("#ffb300"), hex: "#ffb300", glow: "#e65100", label: "KRONOS"   },
  "VANGUARD": { three: new THREE.Color("#ff1744"), hex: "#ff1744", glow: "#b71c1c", label: "VANGUARD" },
  "SPECTRE":  { three: new THREE.Color("#d500f9"), hex: "#d500f9", glow: "#6a0080", label: "SPECTRE"  },
};

const COLOR_PLAYER   = new THREE.Color("#00ff6a");
const COLOR_SELECTED = new THREE.Color("#ffffff");

interface PlotCoord { plotId: number; lat: number; lng: number; }

function generateFibonacciSphere(count: number): PlotCoord[] {
  const plots: PlotCoord[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = GOLDEN_ANGLE * i;
    const lat = Math.asin(y) * (180 / Math.PI);
    const lng = ((theta * 180) / Math.PI) % 360;
    plots.push({ plotId: i + 1, lat, lng: lng > 180 ? lng - 360 : lng });
  }
  return plots;
}

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

const BIOME_DISPLAY_COLORS: Record<string, string> = {
  forest:   "#2ecc71",
  desert:   "#f39c12",
  mountain: "#95a5a6",
  plains:   "#27ae60",
  water:    "#2980b9",
  tundra:   "#bdc3c7",
  volcanic: "#e74c3c",
  swamp:    "#16a085",
};

function getPlotColor(
  parcel: LandParcel | undefined,
  currentPlayerId: string | null,
  players: Player[]
): THREE.Color {
  if (!parcel) return new THREE.Color(0x080c18);
  if (!parcel.ownerId) {
    const hex = BIOME_DISPLAY_COLORS[parcel.biome] || "#3498db";
    return new THREE.Color(hex);
  }
  if (currentPlayerId && parcel.ownerId === currentPlayerId) return COLOR_PLAYER;
  const owner = players.find(p => p.id === parcel.ownerId);
  if (owner && owner.isAI && owner.name && FACTION_COLORS[owner.name]) {
    return FACTION_COLORS[owner.name].three.clone();
  }
  return new THREE.Color("#ff6e40");
}

function StarField() {
  const meshRef = useRef<THREE.Points>(null!);
  const count = 6000;

  const { positions, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 80 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 0.3 + Math.random() * 1.2;
    }
    return { positions, sizes };
  }, []);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.003;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [positions, sizes]);

  return (
    <points ref={meshRef} geometry={geometry}>
      <pointsMaterial
        color="#a8d4ff"
        size={0.12}
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </points>
  );
}

interface PlotOverlayProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  onPlotSelect: (parcelId: string) => void;
}

function PlotOverlay({ parcels, players, currentPlayerId, selectedPlotId, onPlotSelect }: PlotOverlayProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const readyRef = useRef(false);
  const { raycaster, mouse, camera } = useThree();
  const pulseRef = useRef(0);
  const pointerDownState = useRef<{ mouse: THREE.Vector2; cam: THREE.Camera } | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);

  const plotCoords = useMemo(() => generateFibonacciSphere(PLOT_COUNT), []);

  const plotIdToParcel = useMemo(() => {
    const m = new Map<number, LandParcel>();
    parcels.forEach(p => m.set(p.plotId, p));
    return m;
  }, [parcels]);

  const animatedIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < plotCoords.length; i++) {
      const coord = plotCoords[i];
      const parcel = plotIdToParcel.get(coord.plotId);
      if (parcel?.id === selectedPlotId || parcel?.ownerId === currentPlayerId || parcel?.activeBattleId) {
        indices.push(i);
      }
    }
    return indices;
  }, [plotCoords, plotIdToParcel, selectedPlotId, currentPlayerId]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const plotSize = GLOBE_RADIUS * 0.0125;

  const getPlotScale = (parcel: LandParcel | undefined, isSelected: boolean): number => {
    if (isSelected) return 2.8;
    if (!parcel?.ownerId) return 1.0;
    if (parcel.ownerId === currentPlayerId) return 2.0;
    return 1.7;
  };

  useFrame((_, delta) => {
    if (!meshRef.current || !readyRef.current || animatedIndices.length === 0) return;
    pulseRef.current += delta * 2.5;

    for (const i of animatedIndices) {
      const coord = plotCoords[i];
      const parcel = plotIdToParcel.get(coord.plotId);
      const isSelected = parcel?.id === selectedPlotId;

      const baseScale = getPlotScale(parcel, isSelected);
      const pulse = isSelected
        ? baseScale + Math.sin(pulseRef.current * 2) * 0.5
        : baseScale + Math.sin(pulseRef.current + i * 0.1) * 0.12;

      const pos = latLngToVec3(coord.lat, coord.lng, GLOBE_RADIUS * 1.002);
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().multiplyScalar(2));
      dummy.scale.setScalar(plotSize * pulse);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      let color: THREE.Color;
      const isHovered = hoveredIndexRef.current === i;
      if (parcel?.activeBattleId) {
        const battlePulse = 0.8 + Math.sin(pulseRef.current * 3) * 0.2;
        color = new THREE.Color("#ff1744").multiplyScalar(battlePulse);
      } else if (currentPlayerId && parcel?.ownerId === currentPlayerId) {
        color = COLOR_PLAYER.clone().multiplyScalar(0.9 + Math.sin(pulseRef.current + i * 0.1) * 0.15);
      } else {
        color = getPlotColor(parcel, currentPlayerId, players);
      }
      if (isHovered) color.multiplyScalar(1.2);
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < plotCoords.length; i++) {
      const coord = plotCoords[i];
      const parcel = plotIdToParcel.get(coord.plotId);
      const isSelected = parcel?.id === selectedPlotId;
      const pos = latLngToVec3(coord.lat, coord.lng, GLOBE_RADIUS * 1.002);
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().multiplyScalar(2));
      let color: THREE.Color;
      if (parcel?.activeBattleId) {
        color = new THREE.Color("#ff1744").multiplyScalar(0.9);
      } else {
        color = getPlotColor(parcel, currentPlayerId, players);
      }
      dummy.scale.setScalar(plotSize * getPlotScale(parcel, isSelected));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    readyRef.current = true;
  }, [parcels, players, currentPlayerId, selectedPlotId, plotCoords, plotIdToParcel, dummy, plotSize]);

  const handlePointerMove = useCallback((e: any) => {
    if (!meshRef.current) return;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(meshRef.current);
    hoveredIndexRef.current = intersects.length > 0 ? (intersects[0].instanceId ?? null) : null;
  }, [raycaster, mouse, camera]);

  const handlePointerDown = useCallback(() => {
    pointerDownState.current = { mouse: mouse.clone(), cam: camera.clone() };
  }, [mouse, camera]);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    if (!pointerDownState.current) return;

    // Use snapshotted mouse position and camera to prevent drift during orbit damping
    raycaster.setFromCamera(pointerDownState.current.mouse, pointerDownState.current.cam);
    const intersects = raycaster.intersectObject(meshRef.current);
    pointerDownState.current = null;

    if (!intersects.length) return;
    const instanceId = intersects[0].instanceId;
    if (instanceId === undefined) return;
    const coord = plotCoords[instanceId];
    const parcel = plotIdToParcel.get(coord.plotId);
    if (parcel) onPlotSelect(parcel.id);
  }, [raycaster, camera, plotCoords, plotIdToParcel, onPlotSelect]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PLOT_COUNT]}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <ringGeometry args={[0.65, 1, 128]} />
      <meshPhongMaterial 
        transparent 
        opacity={0.8} 
        depthWrite={false} 
        side={THREE.DoubleSide}
        emissive={new THREE.Color(0.4, 0.4, 0.4)}
        emissiveIntensity={0.6}
        shininess={100}
        wireframe={false}
      />
    </instancedMesh>
  );
}

function GlobeTerrain() {
  const albedoTex = useLoader(THREE.TextureLoader, "/textures/planets/ascendancy/planet_albedo.png");
  const nightTex  = useLoader(THREE.TextureLoader, "/textures/planets/ascendancy/planet_night_lights.png");
  const cloudsTex = useLoader(THREE.TextureLoader, "/textures/planets/ascendancy/planet_clouds.png");
  const cloudRef  = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    [albedoTex, nightTex, cloudsTex].forEach(t => { if (t) t.colorSpace = THREE.SRGBColorSpace; });
  }, [albedoTex, nightTex, cloudsTex]);

  useFrame((_, delta) => {
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.018;
  });

  return (
    <>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 128, 64]} />
        <meshStandardMaterial
          map={albedoTex}
          emissiveMap={nightTex}
          emissive={new THREE.Color(0.3, 0.5, 1.0)}
          emissiveIntensity={0.6}
          roughness={0.6}
          metalness={0.0}
        />
      </mesh>
      <mesh ref={cloudRef}>
        <sphereGeometry args={[GLOBE_RADIUS * 1.007, 64, 32]} />
        <meshBasicMaterial
          map={cloudsTex}
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}

function AtmosphereGlow() {
  const innerUniforms = useMemo(() => ({
    glowColor:   { value: new THREE.Color(0.05, 0.35, 1.0) },
    coefficient: { value: 0.55 },
    power:       { value: 4.0 },
  }), []);

  const outerUniforms = useMemo(() => ({
    glowColor:   { value: new THREE.Color(0.0, 0.6, 0.7) },
    coefficient: { value: 0.4 },
    power:       { value: 6.0 },
  }), []);

  const vertShader = `
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const fragShader = `
    uniform vec3 glowColor;
    uniform float coefficient;
    uniform float power;
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      float intensity = pow(coefficient + dot(vPositionNormal, vNormal), power);
      gl_FragColor = vec4(glowColor, intensity * 0.5);
    }
  `;

  return (
    <>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.08, 64, 32]} />
        <shaderMaterial uniforms={innerUniforms} vertexShader={vertShader} fragmentShader={fragShader}
          transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.18, 64, 32]} />
        <shaderMaterial uniforms={outerUniforms} vertexShader={vertShader} fragmentShader={fragShader}
          transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
}

function FactionLegend({ players }: { players: Player[] }) {
  const factionStats = useMemo(() => {
    return Object.entries(FACTION_COLORS).map(([name, cfg]) => {
      const player = players.find(p => p.isAI && p.name === name);
      return { name, cfg, player };
    });
  }, [players]);

  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5">
      {factionStats.map(({ name, cfg }) => (
        <div key={name} className="flex items-center gap-2 px-2.5 py-1 rounded-md backdrop-blur-md"
          style={{ background: `${cfg.hex}12`, border: `1px solid ${cfg.hex}30` }}>
          <div className="w-2 h-2 rounded-full" style={{ background: cfg.hex, boxShadow: `0 0 6px ${cfg.hex}` }} />
          <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: cfg.hex }}>
            {name}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-md backdrop-blur-md mt-1"
        style={{ background: "#00ff6a12", border: "1px solid #00ff6a30" }}>
        <div className="w-2 h-2 rounded-full" style={{ background: "#00ff6a", boxShadow: "0 0 6px #00ff6a" }} />
        <span className="text-[10px] font-mono tracking-widest uppercase text-green-400">YOU</span>
      </div>
    </div>
  );
}

interface ParcelHUDProps {
  parcel: LandParcel;
  currentPlayerId: string | null;
  playerMap: Map<string, Player>;
  onAttack?: () => void;
  onMine?: () => void;
  onBuild?: () => void;
  onParcelSelect: (id: string) => void;
}

function ParcelHUD({ parcel, currentPlayerId, playerMap, onAttack, onMine, onBuild, onParcelSelect }: ParcelHUDProps) {
  const owner = parcel.ownerId ? playerMap.get(parcel.ownerId) : null;
  const isPlayer = parcel.ownerId === currentPlayerId;
  const factionData = owner?.isAI && owner.name ? FACTION_COLORS[owner.name] : null;

  const accentColor = isPlayer ? "#00ff6a"
    : factionData ? factionData.hex
    : parcel.ownerId ? "#ff6e40"
    : "#4fc3f7";

  const statusLabel = isPlayer ? "SECURED"
    : factionData ? factionData.label
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
            { label: "Defense", value: parcel.defenseLevel },
            { label: "Richness", value: parcel.richness },
            { label: "FRNTR/d", value: parcel.frontierPerDay?.toFixed(1) ?? "—" },
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

interface SceneProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  onPlotSelect: (parcelId: string) => void;
  controlsRef: React.RefObject<OrbitControlsImpl>;
}

function Scene({ parcels, players, currentPlayerId, selectedPlotId, onPlotSelect, controlsRef }: SceneProps) {
  return (
    <>
      <StarField />
      <ambientLight intensity={1.4} color="#ffffff" />
      <directionalLight position={[6, 4, 5]} intensity={2.5} color="#e8f4ff" />
      <directionalLight position={[-4, -2, -3]} intensity={1.2} color="#8aaeff" />
      <pointLight position={[0, 0, 0]} intensity={0.6} color="#4488ff" distance={10} />
      <group>
        <GlobeTerrain />
        <PlotOverlay
          parcels={parcels}
          players={players}
          currentPlayerId={currentPlayerId}
          selectedPlotId={selectedPlotId}
          onPlotSelect={onPlotSelect}
        />
      </group>
      <AtmosphereGlow />
      <OrbitControls
        ref={controlsRef as any}
        enablePan={false}
        minDistance={GLOBE_RADIUS * 1.25}
        maxDistance={GLOBE_RADIUS * 5.5}
        rotateSpeed={0.45}
        zoomSpeed={1.1}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

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
    <div className={className} style={{ position: "relative", width: "100%", height: "100%", background: "#02040e" }}>
      <Canvas
        camera={{ position: [0, 0, GLOBE_RADIUS * 3.2], fov: 42 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 2.2 }}
        style={{ background: "#02040e" }}
      >
        <Scene
          parcels={parcels}
          players={players}
          currentPlayerId={currentPlayerId}
          selectedPlotId={selectedParcelId}
          onPlotSelect={onParcelSelect}
          controlsRef={controlsRef}
        />
      </Canvas>

      <FactionLegend players={players} />

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

      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(2,4,14,0.7) 100%)" }}
      />
    </div>
  );
}
