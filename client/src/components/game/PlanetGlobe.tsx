import * as THREE from "three";
import { useRef, useMemo, useCallback, useEffect } from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { LandParcel } from "@shared/schema";
import { biomeColors } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Sword, HardHat, Pickaxe } from "lucide-react";
import { cn } from "@/lib/utils";

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

const OWNER_COLORS = {
  player: new THREE.Color("#00ff44"),
  ai: new THREE.Color("#ff2222"),
  selected: new THREE.Color("#00e5ff"),
};

function getPlotColor(parcel: LandParcel | undefined, currentPlayerId: string | null): THREE.Color {
  if (!parcel) return new THREE.Color("#1a1a1a");
  if (!parcel.ownerId) {
    const baseColor = biomeColors[parcel.biome] || "#333333";
    return new THREE.Color(baseColor).multiplyScalar(0.4);
  }
  if (parcel.ownerId === currentPlayerId) return OWNER_COLORS.player;
  return OWNER_COLORS.ai;
}

interface PlotOverlayProps {
  parcels: LandParcel[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  onPlotSelect: (parcelId: string) => void;
}

function PlotOverlay({ parcels, currentPlayerId, selectedPlotId, onPlotSelect }: PlotOverlayProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { raycaster } = useThree();

  const plotCoords = useMemo(() => generateFibonacciSphere(PLOT_COUNT), []);
  const plotIdToParcel = useMemo(() => {
    const m = new Map<number, LandParcel>();
    parcels.forEach((p) => m.set(p.plotId, p));
    return m;
  }, [parcels]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const plotSize = GLOBE_RADIUS * 0.025;

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < plotCoords.length; i++) {
      const coord = plotCoords[i];
      const pos = latLngToVec3(coord.lat, coord.lng, GLOBE_RADIUS * 1.002);
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().multiplyScalar(2));
      
      const parcel = plotIdToParcel.get(coord.plotId);
      const isSelected = parcel && parcel.id === selectedPlotId;
      dummy.scale.setScalar(isSelected ? 2.5 : 1.0);
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const color = isSelected ? OWNER_COLORS.selected : getPlotColor(parcel, currentPlayerId);
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [parcels, currentPlayerId, selectedPlotId, plotCoords, plotIdToParcel, dummy]);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    const intersects = raycaster.intersectObject(meshRef.current);
    if (intersects.length === 0) return;
    const hit = intersects[0];
    const instanceId = hit.instanceId;
    if (instanceId === undefined) return;
    const coord = plotCoords[instanceId];
    const parcel = plotIdToParcel.get(coord.plotId);
    if (parcel) onPlotSelect(parcel.id);
  }, [raycaster, plotCoords, plotIdToParcel, onPlotSelect]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PLOT_COUNT]} onClick={handleClick}>
      <planeGeometry args={[plotSize, plotSize]} />
      <meshBasicMaterial transparent opacity={0.8} depthWrite={false} vertexColors side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function GlobeTerrain() {
  const albedoTex = useLoader(THREE.TextureLoader, "/textures/planets/ascendancy/planet_albedo.png");
  const nightTex = useLoader(THREE.TextureLoader, "/textures/planets/ascendancy/planet_night_lights.png");
  const cloudsTex = useLoader(THREE.TextureLoader, "/textures/planets/ascendancy/planet_clouds.png");
  useEffect(() => {
    if (albedoTex) albedoTex.colorSpace = THREE.SRGBColorSpace;
    if (nightTex) nightTex.colorSpace = THREE.SRGBColorSpace;
    if (cloudsTex) cloudsTex.colorSpace = THREE.SRGBColorSpace;
  }, [albedoTex, nightTex, cloudsTex]);

  return (
    <>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 128, 64]} />
        <meshStandardMaterial map={albedoTex} emissiveMap={nightTex} emissive={new THREE.Color(1, 1, 1)} emissiveIntensity={0.6} />
      </mesh>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.006, 64, 32]} />
        <meshBasicMaterial map={cloudsTex} transparent opacity={0.3} depthWrite={false} side={THREE.FrontSide} />
      </mesh>
    </>
  );
}

function AtmosphereGlow() {
  const uniforms = useMemo(() => ({
    glowColor: { value: new THREE.Color(0.2, 0.5, 1.0) },
    coefficient: { value: 0.6 },
    power: { value: 3.5 },
  }), []);

  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS * 1.12, 64, 32]} />
      <shaderMaterial
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
        transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

interface SceneProps {
  parcels: LandParcel[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  onPlotSelect: (parcelId: string) => void;
  controlsRef: React.RefObject<OrbitControlsImpl>;
}

function Scene({ parcels, currentPlayerId, selectedPlotId, onPlotSelect, controlsRef }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} />
      <group>
        <GlobeTerrain />
        <PlotOverlay parcels={parcels} currentPlayerId={currentPlayerId} selectedPlotId={selectedPlotId} onPlotSelect={onPlotSelect} />
      </group>
      <AtmosphereGlow />
      <OrbitControls ref={controlsRef as any} enablePan={false} minDistance={GLOBE_RADIUS * 1.2} maxDistance={GLOBE_RADIUS * 5} rotateSpeed={0.5} zoomSpeed={1.2} enableDamping dampingFactor={0.1} />
    </>
  );
}

interface PlanetGlobeProps {
  parcels: LandParcel[];
  currentPlayerId: string | null;
  selectedParcelId: string | null;
  onParcelSelect: (parcelId: string) => void;
  onAttack?: () => void;
  onMine?: () => void;
  onBuild?: () => void;
  className?: string;
}

export default function PlanetGlobe({ parcels, currentPlayerId, selectedParcelId, onParcelSelect, onAttack, onMine, onBuild, className }: PlanetGlobeProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null!);
  const selectedParcel = useMemo(() => parcels.find(p => p.id === selectedParcelId), [parcels, selectedParcelId]);

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas camera={{ position: [0, 0, GLOBE_RADIUS * 3], fov: 45 }} gl={{ antialias: true, alpha: false }} style={{ background: "#050508" }}>
        <Scene parcels={parcels} currentPlayerId={currentPlayerId} selectedPlotId={selectedParcelId} onPlotSelect={onParcelSelect} controlsRef={controlsRef} />
      </Canvas>

      {selectedParcel && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[120%] z-30 pointer-events-none">
          <div className="bg-card/95 backdrop-blur-md border border-primary/30 p-5 rounded-2xl shadow-2xl min-w-[280px] pointer-events-auto flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-start border-b border-primary/10 pb-3">
               <div>
                 <div className="text-[10px] font-display uppercase tracking-widest text-primary/70 mb-0.5">Plot #{selectedParcel.plotId}</div>
                 <div className="text-lg font-display uppercase tracking-wider text-foreground leading-tight">{selectedParcel.biome} Zone</div>
               </div>
               <div className={cn("text-[10px] px-2 py-0.5 rounded border uppercase", selectedParcel.ownerId ? (selectedParcel.ownerId === currentPlayerId ? "border-green-500/30 text-green-500 bg-green-500/5" : "border-red-500/30 text-red-500 bg-red-500/5") : "border-muted text-muted-foreground")}>
                 {selectedParcel.ownerId ? (selectedParcel.ownerId === currentPlayerId ? "Secure" : "Hostile") : "Unclaimed"}
               </div>
             </div>
             <div className="grid grid-cols-2 gap-3">
               {selectedParcel.ownerId === currentPlayerId ? (
                 <>
                   <Button size="sm" variant="outline" className="h-10 gap-2 border-primary/20 hover:bg-primary/5 transition-all" onClick={onMine}><Pickaxe className="w-4 h-4" /> Extract</Button>
                   <Button size="sm" variant="outline" className="h-10 gap-2 border-primary/20 hover:bg-primary/5 transition-all" onClick={onBuild}><HardHat className="w-4 h-4" /> Develop</Button>
                 </>
               ) : selectedParcel.ownerId ? (
                 <Button size="sm" className="col-span-2 h-11 gap-2 bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20 transition-all font-display uppercase tracking-widest" onClick={onAttack}><Sword className="w-5 h-5" /> Initiate Invasion</Button>
               ) : (
                 <Button size="sm" className="col-span-2 h-11 border-primary/40 text-primary hover:bg-primary/10 font-display uppercase tracking-widest" variant="outline" onClick={() => onParcelSelect(selectedParcel.id)}>Select for Acquisition</Button>
               )}
             </div>
          </div>
        </div>
      )}
      <button onClick={() => controlsRef.current?.reset()} className="absolute bottom-24 right-6 z-20 bg-card/40 backdrop-blur-xl border border-white/10 text-white/60 hover:text-white p-3 rounded-full transition-all shadow-xl group">
        <span className="text-[10px] uppercase font-display tracking-[0.2em] font-bold">Reset</span>
      </button>
    </div>
  );
}
