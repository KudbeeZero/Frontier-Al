import { useRef, useMemo, useCallback, useState, useEffect, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
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
}

const GLOBE_RADIUS = 3;
const HEX_ELEVATION = 0.02;

const BIOME_COLORS: Record<BiomeType, string> = {
  forest: "#2d6a30",
  plains: "#7a9e4f",
  mountain: "#6b6b7a",
  desert: "#c4a35a",
  water: "#2a6a9a",
};

const OWNER_GLOW: Record<string, string> = {
  player: "#00ffcc",
  ai: "#ff4444",
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

function axialToLatLng(q: number, r: number, totalRadius: number): { lat: number; lng: number } {
  const x = q + r * 0.5;
  const y = r * (Math.sqrt(3) / 2);
  const scale = 180 / (totalRadius * 2 + 1);
  return {
    lat: -y * scale,
    lng: x * scale,
  };
}

function createHexGeometryOnSphere(
  center: THREE.Vector3,
  radius: number,
  hexSize: number,
  normal: THREE.Vector3
): THREE.BufferGeometry {
  const tangent = new THREE.Vector3();
  if (Math.abs(normal.y) < 0.999) {
    tangent.crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize();
  } else {
    tangent.crossVectors(new THREE.Vector3(1, 0, 0), normal).normalize();
  }
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

  const vertices: number[] = [];
  const indices: number[] = [];

  vertices.push(center.x, center.y, center.z);

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const dx = Math.cos(angle) * hexSize;
    const dy = Math.sin(angle) * hexSize;
    const point = new THREE.Vector3()
      .copy(center)
      .addScaledVector(tangent, dx)
      .addScaledVector(bitangent, dy);
    point.normalize().multiplyScalar(radius);
    vertices.push(point.x, point.y, point.z);
  }

  for (let i = 0; i < 6; i++) {
    indices.push(0, i + 1, ((i + 1) % 6) + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

interface HexTileData {
  parcel: LandParcel;
  position: THREE.Vector3;
  normal: THREE.Vector3;
  geometry: THREE.BufferGeometry;
  color: THREE.Color;
}

function HexTiles({
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const pulseRef = useRef(0);

  const maxRadius = useMemo(() => {
    let maxDist = 0;
    for (const p of parcels) {
      const dist = Math.max(Math.abs(p.q), Math.abs(p.r), Math.abs(p.q + p.r));
      if (dist > maxDist) maxDist = dist;
    }
    return maxDist || 5;
  }, [parcels]);

  const hexSize = useMemo(() => {
    const circumference = 2 * Math.PI * GLOBE_RADIUS;
    const tilesAcross = maxRadius * 2 + 1;
    return (circumference / tilesAcross) * 0.22;
  }, [maxRadius]);

  const prevGeometries = useRef<THREE.BufferGeometry[]>([]);

  const tileData = useMemo<HexTileData[]>(() => {
    prevGeometries.current.forEach((g) => g.dispose());
    prevGeometries.current = [];

    const tiles = parcels.map((parcel) => {
      const { lat, lng } = axialToLatLng(parcel.q, parcel.r, maxRadius);
      const position = latLngToSphere(lat, lng, GLOBE_RADIUS + HEX_ELEVATION);
      const normal = position.clone().normalize();
      const geometry = createHexGeometryOnSphere(position, GLOBE_RADIUS + HEX_ELEVATION, hexSize, normal);
      const color = new THREE.Color(BIOME_COLORS[parcel.biome] || "#555555");
      prevGeometries.current.push(geometry);
      return { parcel, position, normal, geometry, color };
    });
    return tiles;
  }, [parcels, maxRadius, hexSize]);

  useEffect(() => {
    return () => {
      prevGeometries.current.forEach((g) => g.dispose());
      prevGeometries.current = [];
    };
  }, []);

  useFrame((_, delta) => {
    pulseRef.current += delta * 2;
  });

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const parcelId = (e.object as any).userData?.parcelId;
      if (parcelId) {
        onParcelSelect(parcelId);
      }
    },
    [onParcelSelect]
  );

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = (e.object as any).userData?.parcelId;
    if (id) setHoveredId(id);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback(() => {
    setHoveredId(null);
    document.body.style.cursor = "auto";
  }, []);

  return (
    <group ref={groupRef}>
      {tileData.map((tile) => {
        const isSelected = tile.parcel.id === selectedParcelId;
        const isHovered = tile.parcel.id === hoveredId;
        const isOwned = tile.parcel.ownerId !== null;
        const isPlayerOwned = tile.parcel.ownerType === "player" && tile.parcel.ownerId === currentPlayerId;
        const isAIOwned = tile.parcel.ownerType === "ai";
        const isEnemyPlayer = tile.parcel.ownerType === "player" && tile.parcel.ownerId !== currentPlayerId && tile.parcel.ownerId !== null;

        let tileColor = tile.color.clone();
        if (isHovered) {
          tileColor.lerp(new THREE.Color("#ffffff"), 0.2);
        }

        let emissiveColor = new THREE.Color("#000000");
        let emissiveIntensity = 0;

        if (isSelected) {
          emissiveColor = new THREE.Color("#ffffff");
          emissiveIntensity = 0.5;
        } else if (isPlayerOwned) {
          emissiveColor = new THREE.Color(OWNER_GLOW.player);
          emissiveIntensity = 0.15;
        } else if (isAIOwned || isEnemyPlayer) {
          emissiveColor = new THREE.Color(OWNER_GLOW.ai);
          emissiveIntensity = 0.15;
        }

        const hasTurret = tile.parcel.improvements?.some((i) => i.type === "turret");
        const hasShield = tile.parcel.improvements?.some((i) => i.type === "shield_gen");
        const hasFortress = tile.parcel.improvements?.some((i) => i.type === "fortress");

        return (
          <group key={tile.parcel.id}>
            <mesh
              geometry={tile.geometry}
              onClick={handleClick}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
              userData={{ parcelId: tile.parcel.id }}
            >
              <meshStandardMaterial
                color={tileColor}
                emissive={emissiveColor}
                emissiveIntensity={emissiveIntensity}
                roughness={0.7}
                metalness={0.1}
                side={THREE.DoubleSide}
              />
            </mesh>

            {isOwned && (
              <mesh position={tile.position.clone().normalize().multiplyScalar(GLOBE_RADIUS + HEX_ELEVATION + 0.001)}>
                <ringGeometry args={[hexSize * 0.85, hexSize * 0.95, 6]} />
                <meshBasicMaterial
                  color={isPlayerOwned ? OWNER_GLOW.player : OWNER_GLOW.ai}
                  transparent
                  opacity={isSelected ? 0.9 : 0.5}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {(hasTurret || hasShield || hasFortress) && (
              <ImprovementMarker
                position={tile.position}
                normal={tile.normal}
                type={hasFortress ? "fortress" : hasTurret ? "turret" : "shield"}
                radius={hexSize * 0.3}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

function ImprovementMarker({
  position,
  normal,
  type,
  radius,
}: {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  type: "turret" | "shield" | "fortress";
  radius: number;
}) {
  const markerPos = position.clone().normalize().multiplyScalar(GLOBE_RADIUS + HEX_ELEVATION + 0.015);

  const color = type === "turret" ? "#ff8800" : type === "shield" ? "#4488ff" : "#ffdd00";

  return (
    <mesh position={markerPos}>
      {type === "turret" ? (
        <coneGeometry args={[radius, radius * 2, 4]} />
      ) : type === "shield" ? (
        <octahedronGeometry args={[radius]} />
      ) : (
        <boxGeometry args={[radius * 1.5, radius * 1.5, radius * 1.5]} />
      )}
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.4}
        metalness={0.6}
        roughness={0.3}
      />
    </mesh>
  );
}

function AtmosphereGlow() {
  const meshRef = useRef<THREE.Mesh>(null!);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
          gl_FragColor = vec4(0.3, 0.7, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
  }, []);

  return (
    <mesh ref={meshRef} material={shaderMaterial}>
      <sphereGeometry args={[GLOBE_RADIUS * 1.15, 64, 64]} />
    </mesh>
  );
}

function Planet() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(planetTexturePath);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.01;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[GLOBE_RADIUS, 128, 128]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.3} color="#8899bb" />
      <directionalLight
        position={[10, 8, 5]}
        intensity={1.2}
        color="#ffe8d6"
        castShadow={false}
      />
      <pointLight position={[-8, -5, -8]} intensity={0.3} color="#4466aa" />
    </>
  );
}

function CameraController() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 2, 7);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <OrbitControls
      enablePan={false}
      enableZoom={true}
      enableRotate={true}
      minDistance={GLOBE_RADIUS + 1}
      maxDistance={GLOBE_RADIUS * 5}
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
}: PlanetGlobeProps) {
  return (
    <WebGLErrorBoundary fallback={<WebGLFallback className={className} />}>
      <div className={className} data-testid="planet-globe">
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
          <HexTiles
            parcels={parcels}
            selectedParcelId={selectedParcelId}
            currentPlayerId={currentPlayerId}
            onParcelSelect={onParcelSelect}
          />
          <CameraController />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
