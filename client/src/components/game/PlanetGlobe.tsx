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
  player: new THREE.Color("#00ffcc"),
  ai: new THREE.Color("#ff4444"),
  none: new THREE.Color("#333333"),
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

function Planet() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(planetTexturePath);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      <meshStandardMaterial map={texture} roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

function AtmosphereGlow() {
  const shaderRef = useRef<THREE.ShaderMaterial>(null!);

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
        ref={shaderRef}
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
    return Math.sqrt(areaPerPlot) * 0.35;
  }, [parcels.length]);

  const parcelMap = useMemo(() => {
    const map = new Map<number, LandParcel>();
    parcels.forEach((p, i) => map.set(i, p));
    return map;
  }, [parcels]);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(basePlotSize, basePlotSize);
    return geo;
  }, [basePlotSize]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

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

      const biomeColor = BIOME_COLORS[p.biome] || "#555555";
      if (p.ownerId) {
        const ownerColor = p.ownerType === "player" ? OWNER_COLORS.player : OWNER_COLORS.ai;
        const blendAmount = p.ownerType === "player" ? 0.6 : 0.4;
        color.set(biomeColor).lerp(ownerColor, blendAmount);
      } else {
        color.set(biomeColor);
      }
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [parcels]);

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
        const isPlayerOwned = p.ownerId && p.ownerType === "player";
        const elevation = isPlayerOwned ? PLOT_ELEVATION * 2.5 : PLOT_ELEVATION;
        const scale = isPlayerOwned ? zoomScale * 1.4 : zoomScale;
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
      const isPlayerOwned = p.ownerId && p.ownerType === "player";

      if (isSelected || isHovered || isPlayerOwned) {
        const biomeColor = BIOME_COLORS[p.biome] || "#555555";
        if (isSelected) {
          const pulse = Math.sin(pulseRef.current) * 0.3 + 0.7;
          color.set("#00ffcc").multiplyScalar(pulse);
        } else if (isHovered) {
          color.set(biomeColor).lerp(new THREE.Color("#ffffff"), 0.3);
        } else if (isPlayerOwned) {
          color.set(biomeColor).lerp(OWNER_COLORS.player, 0.6).multiplyScalar(playerGlow + 0.2);
        }
        meshRef.current.setColorAt(i, color);
        needsColorUpdate = true;
      }
    }

    if (needsColorUpdate && meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  const handlePointerMove = useCallback(
    (e: THREE.Intersection) => {
      if (e.instanceId !== undefined) {
        setHoveredIndex(e.instanceId);
        document.body.style.cursor = "pointer";
      }
    },
    []
  );

  const handlePointerOut = useCallback(() => {
    if (hoveredIndex !== null) {
      const p = parcelMap.get(hoveredIndex);
      if (p && meshRef.current) {
        const color = new THREE.Color();
        const biomeColor = BIOME_COLORS[p.biome] || "#555555";
        if (p.ownerId) {
          const ownerColor = p.ownerType === "player" ? OWNER_COLORS.player : OWNER_COLORS.ai;
          color.set(biomeColor).lerp(ownerColor, 0.4);
        } else {
          color.set(biomeColor);
        }
        meshRef.current.setColorAt(hoveredIndex, color);
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
      }
    }
    setHoveredIndex(null);
    document.body.style.cursor = "default";
  }, [hoveredIndex, parcelMap]);

  const handleClick = useCallback(
    (e: any) => {
      e.stopPropagation();
      if (e.instanceId !== undefined) {
        const p = parcelMap.get(e.instanceId);
        if (p) {
          onParcelSelect(p.id);
        }
      }
    },
    [parcelMap, onParcelSelect]
  );

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
        roughness={0.6}
        metalness={0.2}
        side={THREE.DoubleSide}
        transparent
        opacity={0.85}
      />
    </instancedMesh>
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

interface WebGLErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  WebGLErrorBoundaryState
> {
  state: WebGLErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
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
  hasOwnedPlots,
}: PlanetGlobeProps) {
  return (
    <WebGLErrorBoundary fallback={<WebGLFallback className={className} />}>
      <div className={className} data-testid="planet-globe" style={{ position: "relative" }}>
        <Canvas
          camera={{ fov: 45, near: 0.1, far: 100 }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          style={{ background: "#000005" }}
          onCreated={({ gl }) => {
            if (!gl.getContext()) {
              throw new Error("WebGL context unavailable");
            }
          }}
        >
          <SceneLighting />
          <Stars
            radius={50}
            depth={50}
            count={3000}
            factor={4}
            saturation={0.3}
            fade
            speed={0.5}
          />
          <Planet />
          <AtmosphereGlow />
          <PlotInstances
            parcels={parcels}
            selectedParcelId={selectedParcelId}
            currentPlayerId={currentPlayerId}
            onParcelSelect={onParcelSelect}
          />
          <CameraController />
        </Canvas>
        {hasOwnedPlots && onLocateTerritory && (
          <button
            onClick={onLocateTerritory}
            className="absolute bottom-20 right-3 z-10 bg-primary/90 hover:bg-primary text-primary-foreground px-3 py-2 rounded-md text-xs font-display uppercase tracking-wide flex items-center gap-1.5 shadow-lg"
            data-testid="button-locate-territory"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            My Territories
          </button>
        )}
      </div>
    </WebGLErrorBoundary>
  );
}
