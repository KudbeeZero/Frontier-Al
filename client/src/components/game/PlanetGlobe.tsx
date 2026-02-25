import * as THREE from "three";
import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { LandParcel, BiomeType } from "@shared/schema";
import { biomeColors } from "@shared/schema";

const GLOBE_RADIUS = 2;
const PLOT_COUNT = 21000;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

interface PlotCoord {
  plotId: number;
  lat: number;
  lng: number;
}

function generateFibonacciSphere(count: number): PlotCoord[] {
  const plots: PlotCoord[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = GOLDEN_ANGLE * i;
    const lat = Math.asin(y) * (180 / Math.PI);
    const lng = ((theta * 180) / Math.PI) % 360;
    plots.push({
      plotId: i + 1,
      lat,
      lng: lng > 180 ? lng - 360 : lng,
    });
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

function vec3ToLatLng(v: THREE.Vector3): { lat: number; lng: number } {
  const r = v.length();
  const lat = Math.asin(v.y / r) * (180 / Math.PI);
  const theta = Math.atan2(v.z, -v.x);
  const lng = theta * (180 / Math.PI) - 180;
  const normalizedLng = lng < -180 ? lng + 360 : lng > 180 ? lng - 360 : lng;
  return { lat, lng: normalizedLng };
}

const OWNER_COLORS = {
  player: new THREE.Color("#00ff44"),
  ai: new THREE.Color("#ff2222"),
  unclaimed: new THREE.Color("#1a1a1a"),
  selected: new THREE.Color("#00e5ff"),
};

function getPlotColor(parcel: LandParcel | undefined, currentPlayerId: string | null): THREE.Color {
  if (!parcel || !parcel.ownerId) return new THREE.Color(biomeColors[parcel?.biome ?? "plains"]).multiplyScalar(0.3);
  if (parcel.ownerId === currentPlayerId) return OWNER_COLORS.player;
  return OWNER_COLORS.ai;
}

interface PlotOverlayProps {
  parcels: LandParcel[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  globeGroupRef: React.RefObject<THREE.Group>;
  onPlotSelect: (parcelId: string) => void;
}

function PlotOverlay({ parcels, currentPlayerId, selectedPlotId, globeGroupRef, onPlotSelect }: PlotOverlayProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { raycaster, camera } = useThree();

  const plotCoords = useMemo(() => generateFibonacciSphere(PLOT_COUNT), []);

  const parcelMap = useMemo(() => {
    const m = new Map<string, LandParcel>();
    parcels.forEach((p) => m.set(p.id, p));
    return m;
  }, [parcels]);

  const plotIdToParcel = useMemo(() => {
    const m = new Map<number, LandParcel>();
    parcels.forEach((p) => m.set(p.plotId, p));
    return m;
  }, [parcels]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const plotSize = GLOBE_RADIUS * 0.012;

  useEffect(() => {
    if (!meshRef.current) return;
    const color = new THREE.Color();
    for (let i = 0; i < plotCoords.length; i++) {
      const coord = plotCoords[i];
      const pos = latLngToVec3(coord.lat, coord.lng, GLOBE_RADIUS * 1.002);
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().multiplyScalar(2));
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const parcel = plotIdToParcel.get(coord.plotId);
      const c = getPlotColor(parcel, currentPlayerId);
      meshRef.current.setColorAt(i, c);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [parcels, currentPlayerId, plotCoords, plotIdToParcel, dummy]);

  useEffect(() => {
    if (!meshRef.current || !meshRef.current.instanceColor) return;
    const color = new THREE.Color();
    for (let i = 0; i < plotCoords.length; i++) {
      const coord = plotCoords[i];
      const parcel = plotIdToParcel.get(coord.plotId);
      if (parcel && parcel.id === selectedPlotId) {
        meshRef.current.setColorAt(i, OWNER_COLORS.selected);
      } else {
        meshRef.current.setColorAt(i, getPlotColor(parcel, currentPlayerId));
      }
    }
    meshRef.current.instanceColor!.needsUpdate = true;
  }, [selectedPlotId, parcels, currentPlayerId, plotCoords, plotIdToParcel]);

  const handleClick = useCallback(
    (e: any) => {
      if (!meshRef.current || !globeGroupRef.current) return;
      if (e.stopPropagation) e.stopPropagation();

      const intersects = raycaster.intersectObject(meshRef.current);
      if (intersects.length === 0) return;

      const hit = intersects[0];
      const worldPoint = hit.point.clone();
      const localPoint = globeGroupRef.current.worldToLocal(worldPoint);
      const { lat, lng } = vec3ToLatLng(localPoint);

      let bestDist = Infinity;
      let bestPlotId = -1;
      for (const coord of plotCoords) {
        const dLat = coord.lat - lat;
        const dLng = coord.lng - lng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < bestDist) {
          bestDist = dist;
          bestPlotId = coord.plotId;
        }
      }

      if (bestPlotId > 0) {
        const parcel = plotIdToParcel.get(bestPlotId);
        if (parcel) onPlotSelect(parcel.id);
      }
    },
    [raycaster, globeGroupRef, plotCoords, plotIdToParcel, onPlotSelect]
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PLOT_COUNT]}
      onClick={handleClick}
    >
      <planeGeometry args={[plotSize, plotSize]} />
      <meshBasicMaterial
        transparent
        opacity={0.2}
        depthWrite={false}
        vertexColors
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

function GlobeTerrain() {
  const albedoTex = useLoader(THREE.TextureLoader, "/textures/planets/ascendancy/planet_albedo.png");
  const nightTex = useLoader(THREE.TextureLoader, "/textures/planets/ascendancy/planet_night_lights.png");
  const cloudsTex = useLoader(THREE.TextureLoader, "/textures/planets/ascendancy/planet_clouds.png");

  useEffect(() => {
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    nightTex.colorSpace = THREE.SRGBColorSpace;
    cloudsTex.colorSpace = THREE.SRGBColorSpace;
  }, [albedoTex, nightTex, cloudsTex]);

  return (
    <>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 128, 64]} />
        <meshStandardMaterial
          map={albedoTex}
          emissiveMap={nightTex}
          emissive={new THREE.Color(1, 1, 1)}
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.006, 64, 32]} />
        <meshBasicMaterial
          map={cloudsTex}
          transparent
          opacity={0.3}
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>
    </>
  );
}

interface SatelliteProps {
  orbitRadius: number;
}

function Satellite({ orbitRadius }: SatelliteProps) {
  const spriteRef = useRef<THREE.Sprite>(null!);
  const tex = useLoader(THREE.TextureLoader, "/images/satellite.png");
  const material = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    [tex]
  );

  const orbitOffset = useRef(0);

  useFrame((_, delta) => {
    if (!spriteRef.current) return;
    orbitOffset.current += delta * 0.15;
    const angle = orbitOffset.current;
    const inclination = 0.4;
    const x = orbitRadius * Math.cos(angle);
    const z = orbitRadius * Math.sin(angle);
    const y = orbitRadius * Math.sin(angle * 0.7) * inclination + Math.sin(orbitOffset.current * 2.3) * 0.05;
    spriteRef.current.position.set(x, y, z);
    const scale = 0.25;
    spriteRef.current.scale.set(scale, scale, 1);
  });

  return <sprite ref={spriteRef} material={material} />;
}

function AtmosphereGlow() {
  const shaderRef = useRef<THREE.ShaderMaterial>(null!);

  const uniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color(0.2, 0.5, 1.0) },
      coefficient: { value: 0.6 },
      power: { value: 3.5 },
    }),
    []
  );

  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS * 1.12, 64, 32]} />
      <shaderMaterial
        ref={shaderRef}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vPositionNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 glowColor;
          uniform float coefficient;
          uniform float power;
          varying vec3 vNormal;
          varying vec3 vPositionNormal;
          void main() {
            float intensity = pow(coefficient + dot(vPositionNormal, vNormal), power);
            gl_FragColor = vec4(glowColor, intensity * 0.4);
          }
        `}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

interface SceneProps {
  parcels: LandParcel[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  onPlotSelect: (parcelId: string) => void;
  onNorthReset?: () => void;
  controlsRef: React.RefObject<OrbitControlsImpl>;
}

function Scene({ parcels, currentPlayerId, selectedPlotId, onPlotSelect, controlsRef }: SceneProps) {
  const globeGroupRef = useRef<THREE.Group>(null!);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />

      <group ref={globeGroupRef}>
        <GlobeTerrain />
        <PlotOverlay
          parcels={parcels}
          currentPlayerId={currentPlayerId}
          selectedPlotId={selectedPlotId}
          globeGroupRef={globeGroupRef}
          onPlotSelect={onPlotSelect}
        />
        <Satellite orbitRadius={GLOBE_RADIUS * 1.25} />
      </group>

      <AtmosphereGlow />

      <OrbitControls
        ref={controlsRef as any}
        enablePan={false}
        minDistance={GLOBE_RADIUS * 1.5}
        maxDistance={GLOBE_RADIUS * 5}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        enableDamping
        dampingFactor={0.1}
      />
    </>
  );
}

interface PlanetGlobeProps {
  parcels: LandParcel[];
  currentPlayerId: string | null;
  selectedParcelId: string | null;
  onParcelSelect: (parcelId: string) => void;
  className?: string;
}

export default function PlanetGlobe({
  parcels,
  currentPlayerId,
  selectedParcelId,
  onParcelSelect,
  className,
}: PlanetGlobeProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null!);

  const handleNorthReset = useCallback(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    controls.reset();
    controls.target.set(0, 0, 0);
    controls.update();
  }, []);

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0, GLOBE_RADIUS * 3], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#050508" }}
      >
        <Scene
          parcels={parcels}
          currentPlayerId={currentPlayerId}
          selectedPlotId={selectedParcelId}
          onPlotSelect={onParcelSelect}
          controlsRef={controlsRef}
        />
      </Canvas>

      <button
        onClick={handleNorthReset}
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          zIndex: 20,
          background: "rgba(0,229,255,0.15)",
          border: "1px solid rgba(0,229,255,0.4)",
          color: "#00e5ff",
          borderRadius: 8,
          padding: "8px 16px",
          cursor: "pointer",
          fontFamily: "Rajdhani, sans-serif",
          fontWeight: 600,
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          backdropFilter: "blur(4px)",
        }}
      >
        ⬆ North
      </button>
    </div>
  );
}
