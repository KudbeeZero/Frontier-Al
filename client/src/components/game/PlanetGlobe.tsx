/**
 * PlanetGlobe.
 * tsx — FRONTIER Tier 1 Globe
 */

import * as THREE from "three";
import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { Canvas, useLoader, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { LandParcel, Player, Battle, SlimParcel, OrbitalEvent, OrbitalEventType } from "@shared/schema";
import type { WorldEvent } from "@shared/worldEvents";
import { GlobeEventOverlays } from "./GlobeEventOverlays";
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

// ── CameraController ──────────────────────────────────────────────────────────
// Handles two behaviors:
//   1. Fly-to: smoothly animates camera to face a target lat/lng on the globe
//   2. Idle auto-rotate: activates OrbitControls.autoRotate after 8s of no input

interface CameraControllerProps {
  targetLat: number | null;
  targetLng: number | null;
  controlsRef: React.RefObject<OrbitControlsImpl>;
}

function CameraController({ targetLat, targetLng, controlsRef }: CameraControllerProps) {
  const { camera } = useThree();

  const flyTarget  = useRef<THREE.Vector3 | null>(null);
  const flyZoom    = useRef<number | null>(null);
  const prevTarget = useRef<string>("");

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdle    = useRef(false);

  const FLY_DISTANCE = GLOBE_RADIUS * 2.8;
  const FLY_SPEED    = 0.055;
  const FLY_DONE_SQ  = 0.0004;

  useEffect(() => {
    if (targetLat === null || targetLng === null) {
      flyTarget.current = null;
      flyZoom.current   = null;
      return;
    }
    const key = `${targetLat.toFixed(4)},${targetLng.toFixed(4)}`;
    if (key === prevTarget.current) return;
    prevTarget.current = key;

    const surfaceVec = latLngToVec3(targetLat, targetLng, 1);
    flyTarget.current = surfaceVec.clone().multiplyScalar(FLY_DISTANCE);
    flyZoom.current   = FLY_DISTANCE;
  }, [targetLat, targetLng]);

  useEffect(() => {
    const resetIdle = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      isIdle.current = false;
      if (controlsRef.current) controlsRef.current.autoRotate = false;
      idleTimer.current = setTimeout(() => {
        isIdle.current = true;
        if (controlsRef.current) controlsRef.current.autoRotate = true;
      }, 8000);
    };

    window.addEventListener("pointerdown", resetIdle);
    window.addEventListener("pointermove", resetIdle);
    window.addEventListener("wheel",       resetIdle);
    resetIdle();

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      window.removeEventListener("pointerdown", resetIdle);
      window.removeEventListener("pointermove", resetIdle);
      window.removeEventListener("wheel",       resetIdle);
    };
  }, [controlsRef]);

  useFrame(() => {
    if (!flyTarget.current) return;
    if (controlsRef.current) controlsRef.current.autoRotate = false;

    const target = flyTarget.current;
    const distSq = camera.position.distanceToSquared(target);

    if (distSq < FLY_DONE_SQ) {
      camera.position.copy(target);
      flyTarget.current = null;
      flyZoom.current   = null;
      return;
    }

    camera.position.lerp(target, FLY_SPEED);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) controlsRef.current.update();
  });

  return null;
}

// ── BattleArcs ────────────────────────────────────────────────────────────────
// Renders one glowing arc per pending battle from attacker origin to defender
// target. A moving dot travels along each arc. Resolved battles fade out.

interface ArcData {
  battleId: string;
  fromVec: THREE.Vector3;
  toVec: THREE.Vector3;
  isPlayerAttacker: boolean;
  resolvedAt: number | null;
}

interface BattleArcsProps {
  battles: Battle[];
  parcels: (LandParcel | SlimParcel)[];
  players: Player[];
  currentPlayerId: string | null;
}

const ARC_LIFT_BASE   = 1.4;
const ARC_LIFT_SCALE  = 0.6;
const PROJECTILE_SIZE = 0.018;
const ARC_TUBE_RADIUS = 0.006;
const ARC_SEGMENTS    = 48;
const FADE_DURATION   = 1500;

function buildArcCurve(from: THREE.Vector3, to: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dist = from.distanceTo(to);
  const lift = ARC_LIFT_BASE + dist * ARC_LIFT_SCALE;
  mid.normalize().multiplyScalar(GLOBE_RADIUS * lift);
  return new THREE.QuadraticBezierCurve3(from, mid, to);
}

function SingleArc({ arc }: { arc: ArcData }) {
  const tubeRef       = useRef<THREE.Mesh>(null!);
  const projectileRef = useRef<THREE.Mesh>(null!);
  const progressRef   = useRef(0);
  const opacityRef    = useRef(1);

  const curve = useMemo(
    () => buildArcCurve(arc.fromVec, arc.toVec),
    [arc.fromVec, arc.toVec]
  );

  const tubeGeo = useMemo(
    () => new THREE.TubeGeometry(curve, ARC_SEGMENTS, ARC_TUBE_RADIUS, 6, false),
    [curve]
  );

  const arcColor = arc.isPlayerAttacker ? "#00e5ff" : "#ff1744";

  useFrame((_, delta) => {
    if (arc.resolvedAt !== null) {
      const elapsed = Date.now() - arc.resolvedAt;
      opacityRef.current = Math.max(0, 1 - elapsed / FADE_DURATION);
    } else {
      opacityRef.current = 1;
    }

    progressRef.current = (progressRef.current + delta * 0.35) % 1;
    const pos = curve.getPoint(progressRef.current);

    if (projectileRef.current) {
      projectileRef.current.position.copy(pos);
      (projectileRef.current.material as THREE.MeshBasicMaterial).opacity = opacityRef.current;
    }
    if (tubeRef.current) {
      (tubeRef.current.material as THREE.MeshBasicMaterial).opacity =
        opacityRef.current * 0.55;
    }
  });

  if (opacityRef.current <= 0) return null;

  return (
    <group>
      <mesh ref={tubeRef} geometry={tubeGeo}>
        <meshBasicMaterial
          color={arcColor}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={projectileRef} position={arc.fromVec}>
        <sphereGeometry args={[PROJECTILE_SIZE, 8, 8]} />
        <meshBasicMaterial
          color={arcColor}
          transparent
          opacity={1}
          depthWrite={false}
        />
      </mesh>

      <mesh position={arc.toVec}>
        <sphereGeometry args={[PROJECTILE_SIZE * 2.5, 8, 8]} />
        <meshBasicMaterial
          color={arc.isPlayerAttacker ? "#00e5ff" : "#ff1744"}
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function BattleArcs({ battles, parcels, players, currentPlayerId }: BattleArcsProps) {
  const parcelLatLng = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    parcels.forEach(p => m.set(p.id, { lat: p.lat, lng: p.lng }));
    return m;
  }, [parcels]);

  const playerFirstParcel = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach(p => {
      if (p.ownedParcels && p.ownedParcels.length > 0) {
        m.set(p.id, p.ownedParcels[0]);
      }
    });
    return m;
  }, [players]);

  const arcs = useMemo<ArcData[]>(() => {
    const now = Date.now();
    const result: ArcData[] = [];

    for (const battle of battles) {
      if (
        battle.status === "resolved" &&
        battle.resolveTs &&
        now - battle.resolveTs > FADE_DURATION
      ) continue;

      const defCoord = parcelLatLng.get(battle.targetParcelId);
      if (!defCoord) continue;

      const attackerParcelId = playerFirstParcel.get(battle.attackerId);
      if (!attackerParcelId) continue;
      const atkCoord = parcelLatLng.get(attackerParcelId);
      if (!atkCoord) continue;

      if (
        Math.abs(atkCoord.lat - defCoord.lat) < 0.01 &&
        Math.abs(atkCoord.lng - defCoord.lng) < 0.01
      ) continue;

      const fromVec = latLngToVec3(atkCoord.lat, atkCoord.lng, GLOBE_RADIUS * 1.01);
      const toVec   = latLngToVec3(defCoord.lat, defCoord.lng, GLOBE_RADIUS * 1.01);

      result.push({
        battleId:         battle.id,
        fromVec,
        toVec,
        isPlayerAttacker: battle.attackerId === currentPlayerId,
        resolvedAt:       battle.status === "resolved" ? battle.resolveTs : null,
      });
    }

    return result;
  }, [battles, parcelLatLng, playerFirstParcel, currentPlayerId]);

  if (arcs.length === 0) return null;

  return (
    <>
      {arcs.map(arc => (
        <SingleArc key={arc.battleId} arc={arc} />
      ))}
    </>
  );
}

// ── MiningPulseLayer ──────────────────────────────────────────────────────────
// Renders short-lived expanding ring pulses at mined parcel locations.
// Each pulse lives for PULSE_DURATION ms then is removed by GameLayout.

export interface LivePulse {
  id: string;
  lat: number;
  lng: number;
  startMs: number;
}

const PULSE_DURATION = 600;

interface SinglePulseProps {
  pulse: LivePulse;
}

function SinglePulse({ pulse }: SinglePulseProps) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  const pos    = useMemo(() => latLngToVec3(pulse.lat, pulse.lng, GLOBE_RADIUS * 1.005), [pulse.lat, pulse.lng]);
  const lookAt = useMemo(() => pos.clone().multiplyScalar(2), [pos]);

  useFrame(() => {
    const elapsed = Date.now() - pulse.startMs;
    const t = Math.min(elapsed / PULSE_DURATION, 1);

    const scale   = 1 + t * 4;
    const opacity = Math.pow(1 - t, 1.5);

    if (ringRef.current) {
      ringRef.current.scale.setScalar(scale);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.9;
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + t * 1.8);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.5;
    }
  });

  return (
    <group position={pos}>
      <mesh ref={ringRef} onUpdate={self => self.lookAt(lookAt)}>
        <ringGeometry args={[0.018, 0.030, 32]} />
        <meshBasicMaterial
          color="#00ff6a"
          transparent
          opacity={0.9}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={glowRef} onUpdate={self => self.lookAt(lookAt)}>
        <circleGeometry args={[0.018, 24]} />
        <meshBasicMaterial
          color="#80ffb0"
          transparent
          opacity={0.5}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

interface MiningPulseLayerProps {
  pulses: LivePulse[];
}

function MiningPulseLayer({ pulses }: MiningPulseLayerProps) {
  if (pulses.length === 0) return null;
  return (
    <>
      {pulses.map(pulse => (
        <SinglePulse key={pulse.id} pulse={pulse} />
      ))}
    </>
  );
}

// ── OrbitalZoneLayer ──────────────────────────────────────────────────────────
// Renders active orbital events on the globe surface:
//   - Impact events: pulsing zone disc at target coordinates
//   - Cosmetic events: animated streak arc across the globe

const ORBITAL_ZONE_COLORS: Record<string, string> = {
  ATMOSPHERIC_BURST: "#ff6622",
  IMPACT_STRIKE:     "#ff1744",
  METEOR_SHOWER:     "#ff9944",
  SINGLE_BOLIDE:     "#ffcc22",
  COMET_PASS:        "#aaddff",
  ORBITAL_DEBRIS:    "#aaaaaa",
};

const ZONE_BASE_RADIUS = 0.12;

interface ImpactZoneProps {
  event: OrbitalEvent;
}

function ImpactZone({ event }: ImpactZoneProps) {
  const discRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const tRef    = useRef(0);

  const pos    = useMemo(
    () => latLngToVec3(event.trajectory.endLat, event.trajectory.endLng, GLOBE_RADIUS * 1.004),
    [event.trajectory.endLat, event.trajectory.endLng]
  );
  const lookAt = useMemo(() => pos.clone().multiplyScalar(2), [pos]);
  const color  = useMemo(
    () => new THREE.Color(ORBITAL_ZONE_COLORS[event.type] ?? "#ffffff"),
    [event.type]
  );
  const radius = ZONE_BASE_RADIUS * (0.6 + (event.intensity ?? 0.5) * 0.8);

  useFrame((_, delta) => {
    tRef.current += delta;

    const breathe = 0.85 + Math.sin(tRef.current * 1.2) * 0.15;
    if (discRef.current) {
      discRef.current.scale.setScalar(breathe);
      (discRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.22 + Math.sin(tRef.current * 1.2) * 0.08;
    }

    const ringPulse = 0.9 + Math.sin(tRef.current * 2.1 + 1.0) * 0.2;
    if (ringRef.current) {
      ringRef.current.scale.setScalar(ringPulse);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.55 + Math.sin(tRef.current * 2.1 + 1.0) * 0.2;
    }
  });

  return (
    <group position={pos}>
      <mesh ref={discRef} onUpdate={self => self.lookAt(lookAt)}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={ringRef} onUpdate={self => self.lookAt(lookAt)}>
        <ringGeometry args={[radius * 0.85, radius * 1.05, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.55}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh onUpdate={self => self.lookAt(lookAt)}>
        <circleGeometry args={[radius * 0.08, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

interface CosmeticStreakProps {
  event: OrbitalEvent;
}

function CosmeticStreak({ event }: CosmeticStreakProps) {
  const dotRef      = useRef<THREE.Mesh>(null!);
  const progressRef = useRef(0);

  const color = useMemo(
    () => new THREE.Color(ORBITAL_ZONE_COLORS[event.type] ?? "#ffffff"),
    [event.type]
  );

  const curve = useMemo(() => {
    const from = latLngToVec3(
      event.trajectory.startLat,
      event.trajectory.startLng,
      GLOBE_RADIUS * 1.01
    );
    const to = latLngToVec3(
      event.trajectory.endLat,
      event.trajectory.endLng,
      GLOBE_RADIUS * 1.01
    );
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const dist = from.distanceTo(to);
    mid.normalize().multiplyScalar(GLOBE_RADIUS * (1.3 + dist * 0.25));
    return new THREE.QuadraticBezierCurve3(from, mid, to);
  }, [event.trajectory]);

  const durationSec = (event.endAt - event.startAt) / 1000;
  const speed = 1 / Math.max(durationSec, 1);

  useFrame((_, delta) => {
    progressRef.current = Math.min(progressRef.current + delta * speed, 1);
    const pos = curve.getPoint(progressRef.current);
    if (dotRef.current) {
      dotRef.current.position.copy(pos);
    }
  });

  const opacity = progressRef.current > 0.8
    ? (1 - progressRef.current) / 0.2
    : 1;

  return (
    <mesh ref={dotRef} position={curve.getPoint(0)}>
      <sphereGeometry args={[0.014 * (0.5 + (event.intensity ?? 0.5)), 8, 8]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}

interface OrbitalZoneLayerProps {
  events: OrbitalEvent[];
}

function OrbitalZoneLayer({ events }: OrbitalZoneLayerProps) {
  const now = Date.now();

  const impactEvents   = events.filter(e => !e.cosmetic && e.startAt <= now && e.endAt > now);
  const cosmeticEvents = events.filter(e =>  e.cosmetic && e.startAt <= now && e.endAt > now);

  if (impactEvents.length === 0 && cosmeticEvents.length === 0) return null;

  return (
    <>
      {impactEvents.map(event => (
        <ImpactZone key={event.id} event={event} />
      ))}
      {cosmeticEvents.map(event => (
        <CosmeticStreak key={event.id} event={event} />
      ))}
    </>
  );
}

// ── AtmosphereGlow ────────────────────────────────────────────────────────────
// Two concentric BackSide spheres with additive blending create a faint blue
// atmospheric rim — occluded by the planet at the center, visible at the limb.

function AtmosphereGlow() {
  const innerUniforms = useMemo(() => ({
    glowColor:   { value: new THREE.Color(0.12, 0.48, 1.0) },
    coefficient: { value: 0.62 },
    power:       { value: 3.2 },
  }), []);

  const outerUniforms = useMemo(() => ({
    glowColor:   { value: new THREE.Color(0.05, 0.68, 0.9) },
    coefficient: { value: 0.48 },
    power:       { value: 4.8 },
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
      gl_FragColor = vec4(glowColor, intensity * 0.6);
    }
  `;

  return (
    <>
      {/* Inner tight rim — fresnel blue at planet limb */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.05, 64, 32]} />
        <shaderMaterial
          uniforms={innerUniforms}
          vertexShader={vertShader}
          fragmentShader={fragShader}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer wide haze — softer cyan-teal corona */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.18, 64, 32]} />
        <shaderMaterial
          uniforms={outerUniforms}
          vertexShader={vertShader}
          fragmentShader={fragShader}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}

const BIOME_DISPLAY_COLORS: Record<string, string> = {
  forest:   "#00ff41",
  desert:   "#ffae00",
  mountain: "#9d8fff",
  plains:   "#39ff14",
  water:    "#00d4ff",
  tundra:   "#b0e8ff",
  volcanic: "#ff3d00",
  swamp:    "#00ffcc",
};

// Unowned tiles are fully invisible (black + additive = transparent).
// Geometry still exists for raycasting — click detection works even when invisible.
const UNOWNED_DIM = new THREE.Color(0, 0, 0);
// Fixed highlight shown when hovering over any tile (owned or unowned)
const HOVER_COLOR  = new THREE.Color("#1a6fff");

function getPlotColor(
  parcel: LandParcel | undefined,
  currentPlayerId: string | null,
  players: Player[]
): THREE.Color {
  // With AdditiveBlending, UNOWNED_DIM adds a very faint teal tint that
  // makes the grid visible + clickable without drowning the terrain texture.
  if (!parcel) return UNOWNED_DIM;
  if (!parcel.ownerId) return UNOWNED_DIM;
  if (currentPlayerId && parcel.ownerId === currentPlayerId) return COLOR_PLAYER;
  const owner = players.find(p => p.id === parcel.ownerId);
  if (owner && owner.isAI && owner.name && FACTION_COLORS[owner.name]) {
    return FACTION_COLORS[owner.name].three.clone();
  }
  return new THREE.Color("#ff6e40");
}

function StarField() {
  const MAIN_COUNT   = 10000;
  const BRIGHT_COUNT = 180;

  const { mainGeo, brightGeo } = useMemo(() => {
    const mPos = new Float32Array(MAIN_COUNT * 3);
    const mCol = new Float32Array(MAIN_COUNT * 3);
    const bPos = new Float32Array(BRIGHT_COUNT * 3);
    const bCol = new Float32Array(BRIGHT_COUNT * 3);

    for (let i = 0; i < MAIN_COUNT; i++) {
      const r     = 65 + Math.random() * 90;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      mPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      mPos[i * 3 + 1] = r * Math.cos(phi);
      mPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const t = Math.random();
      if (t < 0.52) {
        // Blue-white hot stars (O/B class)
        mCol[i*3] = 0.72 + Math.random() * 0.28;
        mCol[i*3+1] = 0.84 + Math.random() * 0.16;
        mCol[i*3+2] = 1.0;
      } else if (t < 0.78) {
        // Pure white (A/F class)
        const v = 0.85 + Math.random() * 0.15;
        mCol[i*3] = v; mCol[i*3+1] = v; mCol[i*3+2] = v;
      } else if (t < 0.93) {
        // Warm yellow-white (G/K class, sun-like)
        mCol[i*3] = 1.0;
        mCol[i*3+1] = 0.85 + Math.random() * 0.12;
        mCol[i*3+2] = 0.52 + Math.random() * 0.22;
      } else {
        // Deep orange-red (M class, cool giants)
        mCol[i*3] = 1.0;
        mCol[i*3+1] = 0.35 + Math.random() * 0.30;
        mCol[i*3+2] = 0.15 + Math.random() * 0.18;
      }
    }

    for (let i = 0; i < BRIGHT_COUNT; i++) {
      const r     = 58 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      bPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      bPos[i * 3 + 1] = r * Math.cos(phi);
      bPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      // Mix of pure white and icy blue-white for prominent stars
      if (Math.random() < 0.55) {
        bCol[i*3] = 1.0; bCol[i*3+1] = 1.0; bCol[i*3+2] = 1.0;
      } else {
        bCol[i*3] = 0.78; bCol[i*3+1] = 0.9; bCol[i*3+2] = 1.0;
      }
    }

    const mGeo = new THREE.BufferGeometry();
    mGeo.setAttribute("position", new THREE.BufferAttribute(mPos, 3));
    mGeo.setAttribute("color",    new THREE.BufferAttribute(mCol, 3));

    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    bGeo.setAttribute("color",    new THREE.BufferAttribute(bCol, 3));

    return { mainGeo: mGeo, brightGeo: bGeo };
  }, []);

  return (
    <>
      {/* Background star field — small, numerous, coloured */}
      <points geometry={mainGeo}>
        <pointsMaterial
          vertexColors
          size={0.08}
          sizeAttenuation
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </points>
      {/* Foreground bright stars — fewer, larger, more prominent */}
      <points geometry={brightGeo}>
        <pointsMaterial
          vertexColors
          size={0.26}
          sizeAttenuation
          transparent
          opacity={1.0}
          depthWrite={false}
        />
      </points>
    </>
  );
}

interface PlotOverlayProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  onPlotSelect: (parcelId: string) => void;
}

// Subtle size variation — natural variety without causing overlap artifacts
const SIZE_VARIANTS = [1.0, 1.04, 0.96, 1.06, 0.98, 1.02, 0.95, 1.05];
function getPlotSizeVariant(plotId: number): number {
  return SIZE_VARIANTS[plotId % SIZE_VARIANTS.length];
}

// Unowned borders: pure black = invisible with additive blending (no limb ring effect)
const BORDER_COLOR = new THREE.Color(0, 0, 0);

// Pre-compute sphere used for hit-testing (analytic intersection, no mesh needed)
const HIT_SPHERE = new THREE.Sphere(new THREE.Vector3(0, 0, 0), GLOBE_RADIUS);

function PlotOverlay({ parcels, players, currentPlayerId, selectedPlotId, onPlotSelect }: PlotOverlayProps) {
  const fillMeshRef   = useRef<THREE.InstancedMesh>(null!);
  const borderMeshRef = useRef<THREE.InstancedMesh>(null!);
  const readyRef      = useRef(false);
  const pulseRef      = useRef(0);
  // Store intersection point at pointer-down to detect drag vs click
  const pointerDownPt = useRef<THREE.Vector3 | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);

  const plotCoords = useMemo(() => generateFibonacciSphere(PLOT_COUNT), []);

  const plotIdToParcel = useMemo(() => {
    const m = new Map<number, LandParcel>();
    parcels.forEach(p => m.set(p.plotId, p));
    return m;
  }, [parcels]);

  // Flat Float32Array of every plot's 3D position — used for O(n) nearest-neighbor on clicks/hover
  const plotPositions3D = useMemo(() => {
    const arr = new Float32Array(plotCoords.length * 3);
    for (let i = 0; i < plotCoords.length; i++) {
      const v = latLngToVec3(plotCoords[i].lat, plotCoords[i].lng, GLOBE_RADIUS);
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
    }
    return arr;
  }, [plotCoords]);

  // Returns the index of the plot center closest to a world-space point
  const nearestPlot = useCallback((px: number, py: number, pz: number): number => {
    let minD2 = Infinity, best = 0;
    const pos = plotPositions3D;
    for (let i = 0; i < PLOT_COUNT; i++) {
      const dx = pos[i*3] - px, dy = pos[i*3+1] - py, dz = pos[i*3+2] - pz;
      const d2 = dx*dx + dy*dy + dz*dz;
      if (d2 < minD2) { minD2 = d2; best = i; }
    }
    return best;
  }, [plotPositions3D]);

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
  const fillSize   = GLOBE_RADIUS * 0.022;
  const borderSize = GLOBE_RADIUS * 0.025;

  const applyInstance = (
    mesh: THREE.InstancedMesh,
    i: number,
    pos: THREE.Vector3,
    size: number,
    color: THREE.Color
  ) => {
    dummy.position.copy(pos);
    dummy.lookAt(pos.clone().multiplyScalar(2));
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color);
  };

  // Pre-cached 3D positions for fill and border layers — never recomputed in useFrame.
  const fillPositions3D = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (const coord of plotCoords) {
      arr.push(latLngToVec3(coord.lat, coord.lng, GLOBE_RADIUS * 1.006));
    }
    return arr;
  }, [plotCoords]);

  const borderPositions3D = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (const coord of plotCoords) {
      arr.push(latLngToVec3(coord.lat, coord.lng, GLOBE_RADIUS * 1.004));
    }
    return arr;
  }, [plotCoords]);

  // Indices of all owned-but-not-player tiles eligible for ambient breathe.
  // Recomputed only when parcels/players change — not per frame.
  const breatheIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < plotCoords.length; i++) {
      const coord = plotCoords[i];
      const parcel = plotIdToParcel.get(coord.plotId);
      if (parcel?.ownerId && parcel.ownerId !== currentPlayerId && !parcel.activeBattleId) {
        indices.push(i);
      }
    }
    return indices;
  }, [plotCoords, plotIdToParcel, currentPlayerId]);

  // Which bucket of breatheIndices to update this frame.
  const breatheBucketRef = useRef(0);
  const BREATHE_BUCKET_SIZE = 200;

  const prevHoveredRef = useRef<number | null>(null);

  useFrame((_, delta) => {
    if (!fillMeshRef.current || !borderMeshRef.current || !readyRef.current) return;
    pulseRef.current += delta * 2.5;

    const currentHovered = hoveredIndexRef.current;
    const prevHovered    = prevHoveredRef.current;
    let matrixDirty = false;
    let colorDirty  = false;

    // ── High-priority animated tiles (selected, owned-by-me, battles, hover) ──
    const toProcess = new Set<number>(animatedIndices);
    if (currentHovered !== null) toProcess.add(currentHovered);
    if (prevHovered !== null && prevHovered !== currentHovered) toProcess.add(prevHovered);
    prevHoveredRef.current = currentHovered;

    for (const i of toProcess) {
      const coord  = plotCoords[i];
      const parcel = plotIdToParcel.get(coord.plotId);
      const isSelected = parcel?.id === selectedPlotId;
      const sizeVar = getPlotSizeVariant(coord.plotId);

      const pulse = isSelected
        ? 1.0 + Math.sin(pulseRef.current * 2) * 0.08
        : 1.0 + Math.sin(pulseRef.current + i * 0.1) * 0.04;

      // Use pre-cached positions — no trig here.
      const fillPos   = fillPositions3D[i];
      const borderPos = borderPositions3D[i];

      let fillColor: THREE.Color;
      const isHovered = hoveredIndexRef.current === i;
      if (parcel?.activeBattleId) {
        const bp = 0.8 + Math.sin(pulseRef.current * 3) * 0.2;
        fillColor = new THREE.Color("#ff1744").multiplyScalar(bp);
      } else if (currentPlayerId && parcel?.ownerId === currentPlayerId) {
        fillColor = COLOR_PLAYER.clone().multiplyScalar(1.4 + Math.sin(pulseRef.current + i * 0.1) * 0.12);
      } else if (parcel?.ownerId) {
        fillColor = getPlotColor(parcel, currentPlayerId, players).clone().multiplyScalar(1.25);
      } else {
        fillColor = getPlotColor(parcel, currentPlayerId, players);
      }
      const isOwned = parcel?.ownerId != null;
      if (isHovered) fillColor = isOwned ? fillColor.clone().multiplyScalar(1.6) : HOVER_COLOR;
      if (isSelected) fillColor = COLOR_SELECTED.clone().multiplyScalar(1.4);
      const showFill = isOwned || isHovered || isSelected;

      const borderColor = isSelected
        ? new THREE.Color("#ffffff")
        : isHovered
          ? HOVER_COLOR.clone().multiplyScalar(2.0)
          : isOwned
            ? fillColor.clone().multiplyScalar(2.2)
            : BORDER_COLOR;

      applyInstance(fillMeshRef.current,   i, fillPos,   showFill ? fillSize * sizeVar * pulse : 0, fillColor);
      applyInstance(borderMeshRef.current, i, borderPos, borderSize * sizeVar * pulse, borderColor);
      matrixDirty = true;
      colorDirty  = true;
    }

    // ── Ambient breathe — one bucket of ~200 owned tiles per frame ────────────
    // Each tile breathes at its own phase offset so the effect ripples across
    // the globe rather than all tiles pulsing in unison.
    if (breatheIndices.length > 0) {
      const bucketStart = breatheBucketRef.current * BREATHE_BUCKET_SIZE;
      const bucketEnd   = Math.min(bucketStart + BREATHE_BUCKET_SIZE, breatheIndices.length);

      for (let b = bucketStart; b < bucketEnd; b++) {
        const i = breatheIndices[b];
        // Skip tiles already handled by the high-priority loop above.
        if (toProcess.has(i)) continue;

        const coord  = plotCoords[i];
        const parcel = plotIdToParcel.get(coord.plotId);
        if (!parcel?.ownerId) continue;

        // Slow breathe: period ~4s, amplitude ±15%, unique phase per tile.
        const phase      = (i * 0.618033) % (Math.PI * 2); // golden ratio spread
        const breathe    = 1.0 + Math.sin(pulseRef.current * 0.6 + phase) * 0.15;
        const baseColor  = getPlotColor(parcel, currentPlayerId, players);
        const fillColor  = baseColor.clone().multiplyScalar(breathe);
        const borderColor = fillColor.clone().multiplyScalar(1.8);

        // Color-only update — position and scale don't change, so no matrix write.
        fillMeshRef.current.setColorAt(i, fillColor);
        borderMeshRef.current.setColorAt(i, borderColor);
        colorDirty = true;
      }

      // Advance bucket; wrap around.
      breatheBucketRef.current = (bucketEnd >= breatheIndices.length) ? 0 : breatheBucketRef.current + 1;
    }

    // Only upload to GPU when something actually changed.
    if (matrixDirty) {
      fillMeshRef.current.instanceMatrix.needsUpdate   = true;
      borderMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (colorDirty) {
      if (fillMeshRef.current.instanceColor)   fillMeshRef.current.instanceColor.needsUpdate   = true;
      if (borderMeshRef.current.instanceColor) borderMeshRef.current.instanceColor.needsUpdate = true;
    }
  });

  useEffect(() => {
    if (!fillMeshRef.current || !borderMeshRef.current) return;
    for (let i = 0; i < plotCoords.length; i++) {
      const coord = plotCoords[i];
      const parcel = plotIdToParcel.get(coord.plotId);
      const isSelected = parcel?.id === selectedPlotId;
      const sizeVar = getPlotSizeVariant(coord.plotId);

      const fillPos   = latLngToVec3(coord.lat, coord.lng, GLOBE_RADIUS * 1.006);
      const borderPos = latLngToVec3(coord.lat, coord.lng, GLOBE_RADIUS * 1.004);

      let fillColor: THREE.Color;
      if (parcel?.activeBattleId) {
        fillColor = new THREE.Color("#ff1744").multiplyScalar(0.9);
      } else {
        fillColor = getPlotColor(parcel, currentPlayerId, players);
      }

      const isOwned = (fillColor.r + fillColor.g + fillColor.b) > 0.40;
      const borderColor = isSelected
        ? new THREE.Color("#ffffff")
        : isOwned
          ? fillColor.clone().multiplyScalar(2.2)
          : BORDER_COLOR;
      applyInstance(fillMeshRef.current, i, fillPos, isOwned ? fillSize * sizeVar : 0, fillColor);
      applyInstance(borderMeshRef.current, i, borderPos, borderSize * sizeVar, borderColor);

    }
    fillMeshRef.current.instanceMatrix.needsUpdate = true;
    borderMeshRef.current.instanceMatrix.needsUpdate = true;
    if (fillMeshRef.current.instanceColor) fillMeshRef.current.instanceColor.needsUpdate = true;
    if (borderMeshRef.current.instanceColor) borderMeshRef.current.instanceColor.needsUpdate = true;
    readyRef.current = true;
  }, [parcels, players, currentPlayerId, selectedPlotId, plotCoords, plotIdToParcel, dummy, fillSize, borderSize]);

  // Sphere-based hover — fires on the invisible coverage sphere, always hits the globe surface
  const handlePointerMove = useCallback((e: any) => {
    const p = e.point as THREE.Vector3;
    hoveredIndexRef.current = nearestPlot(p.x, p.y, p.z);
  }, [nearestPlot]);

  const handlePointerLeave = useCallback(() => {
    hoveredIndexRef.current = null;
  }, []);

  const handlePointerDown = useCallback((e: any) => {
    pointerDownPt.current = (e.point as THREE.Vector3).clone();
  }, []);

  // Click fires from the invisible coverage sphere — find nearest plot, fire if it has a parcel
  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    // Ignore if the pointer moved significantly (orbit drag)
    if ((e.delta as number) > 6) return;
    const p = e.point as THREE.Vector3;
    const idx = nearestPlot(p.x, p.y, p.z);
    const coord = plotCoords[idx];
    const parcel = plotIdToParcel.get(coord.plotId);
    if (parcel) onPlotSelect(parcel.id);
  }, [nearestPlot, plotCoords, plotIdToParcel, onPlotSelect]);

  return (
    <>
      {/* Invisible sphere covering the full planet — catches every pointer event reliably,
          even in gaps between hex tiles and at oblique viewing angles.
          Geometry intersects cleanly; material is fully transparent and writes no depth. */}
      <mesh
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <sphereGeometry args={[GLOBE_RADIUS * 1.01, 48, 24]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} side={THREE.FrontSide} />
      </mesh>

      {/* Border ring — glows with ownership color on claimed tiles */}
      <instancedMesh ref={borderMeshRef} args={[undefined, undefined, PLOT_COUNT]}>
        <circleGeometry args={[0.5, 6]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={1.0}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>

      {/* Fill layer — normal blending: unowned tiles hidden via scale=0, faction colour shows clearly */}
      <instancedMesh ref={fillMeshRef} args={[undefined, undefined, PLOT_COUNT]}>
        <circleGeometry args={[0.5, 6]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.75}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </>
  );
}

function GlobeTerrain() {
  const albedoTex = useLoader(THREE.TextureLoader, "/textures/planets/ascendancy/planet_albedo.png");

  useEffect(() => {
    if (albedoTex) albedoTex.colorSpace = THREE.SRGBColorSpace;
  }, [albedoTex]);

  const terrainUniforms = useMemo(() => ({
    albedoMap: { value: albedoTex },
  }), [albedoTex]);

  const terrainVert = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const terrainFrag = `
    uniform sampler2D albedoMap;
    varying vec2 vUv;

    // Boost colour saturation (renamed to avoid clash with GLSL built-in 'saturate')
    vec3 boostSat(vec3 c, float amount) {
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      return mix(vec3(lum), c, amount);
    }

    void main() {
      vec4 dayCol = texture2D(albedoMap, vUv);
      // Fully lit — no dark side, terrain visible everywhere
      gl_FragColor = vec4(boostSat(dayCol.rgb, 1.25) * 1.05, 1.0);
    }
  `;

  return (
    <>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 128, 64]} />
        <shaderMaterial
          uniforms={terrainUniforms}
          vertexShader={terrainVert}
          fragmentShader={terrainFrag}
        />
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
  targetLat: number | null;
  targetLng: number | null;
  battles: Battle[];
  livePulses: LivePulse[];
  orbitalEvents: OrbitalEvent[];
  replayEvents?: WorldEvent[];
  replayTime?: number;
  replayVisibleTypes?: Set<string>;
}

function Scene({ parcels, players, currentPlayerId, selectedPlotId, onPlotSelect, controlsRef, targetLat, targetLng, battles, livePulses, orbitalEvents, replayEvents, replayTime, replayVisibleTypes }: SceneProps) {
  return (
    <>
      <CameraController
        targetLat={targetLat}
        targetLng={targetLng}
        controlsRef={controlsRef}
      />
      <StarField />
      <AtmosphereGlow />
      <ambientLight intensity={1.8} color="#d8eaff" />
      <directionalLight position={[8, 4, 5]}  intensity={1.6} color="#fff4e0" />
      <directionalLight position={[-6, -2, -4]} intensity={1.2} color="#c0d4ff" />
      <directionalLight position={[0,  8, 0]}  intensity={0.7} color="#e0eeff" />
      <group>
        <GlobeTerrain />
        <PlotOverlay
          parcels={parcels}
          players={players}
          currentPlayerId={currentPlayerId}
          selectedPlotId={selectedPlotId}
          onPlotSelect={onPlotSelect}
        />
        {replayEvents && replayEvents.length > 0 && replayVisibleTypes && replayTime !== undefined && (
          <GlobeEventOverlays
            events={replayEvents}
            replayTime={replayTime}
            visibleTypes={replayVisibleTypes}
          />
        )}
      </group>
      <BattleArcs
        battles={battles}
        parcels={parcels}
        players={players}
        currentPlayerId={currentPlayerId}
      />
      <MiningPulseLayer pulses={livePulses} />
      <OrbitalZoneLayer events={orbitalEvents} />
      <OrbitControls
        ref={controlsRef as any}
        enablePan={false}
        minDistance={GLOBE_RADIUS * 2.2}
        maxDistance={GLOBE_RADIUS * 4.8}
        rotateSpeed={0.45}
        zoomSpeed={1.0}
        enableDamping
        dampingFactor={0.08}
        autoRotate={false}
        autoRotateSpeed={0.4}
      />
    </>
  );
}

interface GlobeHUDProps {
  activeBattleCount: number;
  replayTime?: number;
}

function GlobeHUD({ activeBattleCount, replayTime }: GlobeHUDProps) {
  const now = replayTime ?? Date.now();
  const utc = new Date(now).toISOString().slice(11, 19) + " UTC";
  const lat  = "22.14°N";
  const lng  = "045°21'37.73\"E";
  const alt  = "3745115M";
  const gsd  = "1404.42M";

  return (
    <>
      {/* Bottom-left telemetry */}
      <div
        className="absolute bottom-28 left-4 z-20 pointer-events-none select-none"
        style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", lineHeight: "1.8", color: "rgba(0,229,255,0.55)" }}
      >
        <div>38P NS 3942 7798</div>
        <div>{lat} {lng}</div>
      </div>

      {/* Bottom-right telemetry */}
      <div
        className="absolute bottom-28 right-4 z-20 pointer-events-none select-none text-right"
        style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", lineHeight: "1.8", color: "rgba(0,229,255,0.55)" }}
      >
        <div>GSD: {gsd} NIIR</div>
        <div>ALT: {alt} SUN: -20</div>
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

      {/* Top-left: classification watermark (offset right of faction legend) */}
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
    <div className={className} style={{ position: "relative", width: "100%", height: "100%", background: "#010306" }}>
      <Canvas
        camera={{ position: [0, 0, GLOBE_RADIUS * 3.8], fov: 38 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        style={{ background: "#010306" }}
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
        />
      </Canvas>

      <GlobeHUD activeBattleCount={activeBattleCount} replayTime={replayTime} />

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

    </div>
  );
}
