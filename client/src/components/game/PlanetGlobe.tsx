import { useRef, useMemo, useCallback, useState, useEffect, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { LandParcel, BiomeType } from "@shared/schema";
import planetTexturePath from "@/assets/images/planet-surface.png";

interface PlanetGlobeProps {
  parcels: LandParcel[];
  selectedParcelId: string | null;
  currentPlayerId: string | null;
  onParcelSelect: (parcelId: string) => void;
  className?: string;
  onLocateTerritory?: () => void;
  onFindEnemyTarget?: () => void;
  hasOwnedPlots?: boolean;
}

const GLOBE_RADIUS = 3;
const PLOT_ELEVATION = 0.015;

const BIOME_COLORS: Record<BiomeType, string> = {
  forest: "#2d6a30",
  plains: "#7a9e4f",
  mountain: "#6b6b7a",
  desert: "#c4a35a",
  water: "#2a6a9a",
  tundra: "#a8c8d8",
  volcanic: "#8b3a1a",
  swamp: "#3a5a2a",
};

const OWNER_COLORS = {
  player: new THREE.Color("#00ff44"),
  ai: new THREE.Color("#ff2222"),
  none: new THREE.Color("#1a1a2e"),
};

function latLngToSphere(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-3, -1, -3]} intensity={0.3} color="#4466aa" />
      <pointLight position={[0, 8, 0]} intensity={0.5} color="#ffccaa" />
    </>
  );
}

// Wireframe grid overlay — sits just above the planet surface
// instanced hexagonal cells rendered on the globe surface
function GridOverlay() {
  const geometry = useMemo(() => new THREE.SphereGeometry(GLOBE_RADIUS + 0.025, 48, 32), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color="#00ccff"
        wireframe={true}
        transparent={true}
        opacity={0.08}
        depthWrite={false}
      />
    </mesh>
  );
}

// Planet no longer self-rotates — the parent RotatingGlobe group handles it
function Planet() {
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(planetTexturePath);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      <meshStandardMaterial map={texture} roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

// Atmosphere stays OUTSIDE the rotating group — it's a world-space glow
function AtmosphereGlow() {
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vec3 viewDir = normalize(-vPosition);
      float fresnel = 1.0 - dot(viewDir, vNormal);
      fresnel = pow(fresnel, 3.0);
      gl_FragColor = vec4(0.3, 0.6, 1.0, fresnel * 0.6);
    }
  `;
  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS * 1.05, 64, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function PlotInstances({
  parcels,
  selectedParcelId,
  currentPlayerId,
  onParcelSelect,
}: {
  parcels: LandParcel[];
  selectedParcelId: string | null;
  currentPlayerId: string | null;
  onParcelSelect: (id: string) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const pulseRef = useRef(0);
  const { camera } = useThree();

  const basePlotSize = useMemo(() => {
    const surfaceArea = 4 * Math.PI * GLOBE_RADIUS * GLOBE_RADIUS;
    const areaPerPlot = surfaceArea / parcels.length;
    return Math.sqrt(areaPerPlot) * 0.42; // slightly larger than before
  }, [parcels.length]);

  const parcelMap = useMemo(() => {
    const map = new Map<number, LandParcel>();
    parcels.forEach((p, i) => map.set(i, p));
    return map;
  }, [parcels]);

  const geometry = useMemo(() => new THREE.PlaneGeometry(basePlotSize, basePlotSize), [basePlotSize]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    if (!meshRef.current || parcels.length === 0) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < parcels.length; i++) {
      const p = parcels[i];
      const pos = latLngToSphere(p.lat, p.lng, GLOBE_RADIUS + PLOT_ELEVATION);
      const normal = pos.clone().normalize();
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().add(normal));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      if (p.ownerId) {
        color.copy(p.ownerId === currentPlayerId || p.ownerType === "player" ? OWNER_COLORS.player : OWNER_COLORS.ai);
      } else {
        color.copy(OWNER_COLORS.none);
      }
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [parcels, currentPlayerId]);

  const lastScaleRef = useRef(1);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    pulseRef.current += delta * 3;

    const dist = camera.position.length();
    const maxDist = GLOBE_RADIUS * 5;
    const minDist = GLOBE_RADIUS + 0.5;
    const t = Math.max(0, Math.min(1, (dist - minDist) / (maxDist - minDist)));
    const zoomScale = THREE.MathUtils.lerp(2.5, 0.6, t);

    if (Math.abs(zoomScale - lastScaleRef.current) > 0.01) {
      lastScaleRef.current = zoomScale;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < parcels.length; i++) {
        const p = parcels[i];
        const isPlayerOwned = p.ownerId && (p.ownerId === currentPlayerId || p.ownerType === "player");
        const isAiOwned = p.ownerId && !isPlayerOwned;
        const elevation = isPlayerOwned ? PLOT_ELEVATION * 3 : isAiOwned ? PLOT_ELEVATION * 2 : PLOT_ELEVATION;
        const scale = isPlayerOwned ? zoomScale * 1.5 : isAiOwned ? zoomScale * 1.3 : zoomScale;
        const pos = latLngToSphere(p.lat, p.lng, GLOBE_RADIUS + elevation);
        const normal = pos.clone().normalize();
        dummy.position.copy(pos);
        dummy.lookAt(pos.clone().add(normal));
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
    }

    const color = new THREE.Color();
    let needsColorUpdate = false;
    const playerGlow = Math.sin(pulseRef.current * 0.5) * 0.15 + 0.85;

    for (let i = 0; i < parcels.length; i++) {
      const p = parcels[i];
      const isSelected = p.id === selectedParcelId;
      const isHovered = i === hoveredIndex;
      const isPlayerOwned = p.ownerId && (p.ownerId === currentPlayerId || p.ownerType === "player");

      if (isSelected || isHovered || isPlayerOwned) {
        if (isSelected) {
          const pulse = Math.sin(pulseRef.current) * 0.3 + 0.7;
          color.set("#ffffff").multiplyScalar(pulse);
        } else if (isHovered) {
          if (p.ownerId) {
            const base = isPlayerOwned ? OWNER_COLORS.player : OWNER_COLORS.ai;
            color.copy(base).lerp(new THREE.Color("#ffffff"), 0.3);
          } else {
            color.set("#334455");
          }
        } else if (isPlayerOwned) {
          color.copy(OWNER_COLORS.player).multiplyScalar(playerGlow + 0.2);
        }
        meshRef.current.setColorAt(i, color);
        needsColorUpdate = true;
      }
    }

    if (needsColorUpdate && meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  const handlePointerMove = useCallback((e: THREE.Intersection) => {
    if (e.instanceId !== undefined) {
      setHoveredIndex(e.instanceId);
      document.body.style.cursor = "pointer";
    }
  }, []);

  const handlePointerOut = useCallback(() => {
    if (hoveredIndex !== null) {
      const p = parcelMap.get(hoveredIndex);
      if (p && meshRef.current) {
        const color = new THREE.Color();
        if (p.ownerId) {
          const isPlayerOwned = p.ownerId === currentPlayerId || p.ownerType === "player";
          color.copy(isPlayerOwned ? OWNER_COLORS.player : OWNER_COLORS.ai);
        } else {
          color.copy(OWNER_COLORS.none);
        }
        meshRef.current.setColorAt(hoveredIndex, color);
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
      }
    }
    setHoveredIndex(null);
    document.body.style.cursor = "default";
  }, [hoveredIndex, parcelMap, currentPlayerId]);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      const p = parcelMap.get(e.instanceId);
      if (p) onParcelSelect(p.id);
    }
  }, [parcelMap, onParcelSelect]);

  if (parcels.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, parcels.length]}
      onPointerMove={(e) => handlePointerMove(e.intersections[0])}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.3}
        metalness={0.5}
        side={THREE.DoubleSide}
        transparent
        opacity={0.9}
        emissiveIntensity={0.4}
      />
    </instancedMesh>
  );
}

// THE KEY FIX: Planet + Grid + Plots all inside ONE rotating group
// Previously Planet rotated alone while Plots stayed static in world space
function RotatingGlobe({
  parcels,
  selectedParcelId,
  currentPlayerId,
  onParcelSelect,
}: {
  parcels: LandParcel[];
  selectedParcelId: string | null;
  currentPlayerId: string | null;
  onParcelSelect: (id: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      <Planet />
      <GridOverlay />
      <PlotInstances
        parcels={parcels}
        selectedParcelId={selectedParcelId}
        currentPlayerId={currentPlayerId}
        onParcelSelect={onParcelSelect}
      />
    </group>
  );
}

function CameraController() {
  return (
    <OrbitControls
      makeDefault
      minDistance={GLOBE_RADIUS + 0.5}
      maxDistance={GLOBE_RADIUS * 5}
      enablePan={false}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
      enableDamping={true}
      dampingFactor={0.08}
    />
  );
}

class WebGLErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function WebGLFallback({ className }: { className?: string }) {
  return (
    <div
      className={`${className || ""} flex items-center justify-center`}
      data-testid="planet-globe"
      style={{ background: "#000005" }}
    >
      <div className="text-center p-6 space-y-2">
        <p className="text-muted-foreground text-sm font-display uppercase tracking-wide">
          WebGL Unavailable
        </p>
        <p className="text-xs text-muted-foreground/70">
          Your browser does not support 3D rendering. Try a different browser or enable hardware acceleration.
        </p>
      </div>
    </div>
  );
}

export function PlanetGlobe({
  parcels,
  selectedParcelId,
  currentPlayerId,
  onParcelSelect,
  className,
  onLocateTerritory,
  onFindEnemyTarget,
  hasOwnedPlots,
}: PlanetGlobeProps) {
  return (
    <WebGLErrorBoundary fallback={<WebGLFallback className={className} />}>
      <div className={className} data-testid="planet-globe" style={{ position: "relative" }}>
        <Canvas
          camera={{ fov: 45, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          style={{ background: "#000005" }}
          onCreated={({ gl }) => {
            if (!gl.getContext()) throw new Error("WebGL context unavailable");
          }}
        >
          <SceneLighting />
          <Stars radius={50} depth={50} count={3000} factor={4} saturation={0.3} fade speed={0.5} />

          {/* Atmosphere stays outside the rotating group */}
          <AtmosphereGlow />

          {/* Everything that should rotate together */}
          <RotatingGlobe
            parcels={parcels}
            selectedParcelId={selectedParcelId}
            currentPlayerId={currentPlayerId}
            onParcelSelect={onParcelSelect}
          />

          <CameraController />
        </Canvas>

        <div className="absolute bottom-20 left-3 z-10 flex flex-col gap-1.5 pointer-events-none" data-testid="color-legend">
          <div className="backdrop-blur-md bg-black/60 rounded-md px-2.5 py-2 text-[10px] font-display uppercase tracking-wider space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#00ff44" }} />
              <span className="text-green-400">Your Territory</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#ff2222" }} />
              <span className="text-red-400">Enemy Territory</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#1a1a2e", border: "1px solid #333" }} />
              <span className="text-gray-500">Unclaimed</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-20 right-3 z-10 flex flex-col gap-2">
          {hasOwnedPlots && onLocateTerritory && (
            <button
              onClick={onLocateTerritory}
              className="bg-green-600/90 hover:bg-green-500 text-white px-3 py-2 rounded-md text-xs font-display uppercase tracking-wide flex items-center gap-1.5 shadow-lg"
              data-testid="button-locate-territory"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              My Bases
            </button>
          )}
          {onFindEnemyTarget && (
            <button
              onClick={onFindEnemyTarget}
              className="bg-red-600/90 hover:bg-red-500 text-white px-3 py-2 rounded-md text-xs font-display uppercase tracking-wide flex items-center gap-1.5 shadow-lg"
              data-testid="button-find-enemy"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Find Targets
            </button>
          )}
        </div>
      </div>
    </WebGLErrorBoundary>
  );
}
