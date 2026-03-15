import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import type { OrbitalEvent } from "@shared/schema";
import type { Player } from "@shared/schema";
import { latLngToVec3, GLOBE_RADIUS } from "./globeUtils";
import { COLOR_PLAYER } from "./globeConstants";

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
      <mesh ref={discRef} renderOrder={20} onUpdate={self => self.lookAt(lookAt)}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.22}
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={ringRef} renderOrder={20} onUpdate={self => self.lookAt(lookAt)}>
        <ringGeometry args={[radius * 0.85, radius * 1.05, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.55}
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh renderOrder={20} onUpdate={self => self.lookAt(lookAt)}>
        <circleGeometry args={[radius * 0.08, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
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

export function OrbitalZoneLayer({ events }: OrbitalZoneLayerProps) {
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

// ── SatelliteOrbitLayer ───────────────────────────────────────────────────────
// Renders active player-deployed OrbitalSatellites as small glowing spheres
// orbiting at a fixed altitude above the globe. Each satellite gets a
// deterministic inclination and starting angle derived from its id, so the
// layout is stable across re-renders but visually varied.
//
// Design constraints (mobile-safe):
//  - Primitive sphereGeometry only — no GLTF loading
//  - Mesh refs array + useFrame: no React state mutations per frame
//  - Orbit state stored in a Map ref so it survives player-list changes
//  - Capped to MAX_SATELLITES * MAX_PLAYERS, which is small enough to be free

const SAT_ORBIT_RADIUS = GLOBE_RADIUS + 0.45; // altitude above surface
const SAT_ORBIT_SPEED  = 0.003;               // radians per second (visual)
const SAT_SPHERE_RADIUS = 0.035;

/** Deterministic float in [0,1] from a string id and a numeric offset. */
function satHashFloat(id: string, offset: number): number {
  let h = (offset + 1) * 2654435761;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 2654435761);
  }
  return (h >>> 0) / 0xffffffff;
}

interface SatOrbitState {
  angle: number;
  inclination: number;
}

interface ActiveSatInfo {
  id: string;
  color: THREE.Color;
}

export function SatelliteOrbitLayer({ players }: { players: Player[] }) {
  const now = Date.now();

  // Collect all non-expired active satellites across all players
  const activeSats = useMemo<ActiveSatInfo[]>(() => {
    const result: ActiveSatInfo[] = [];
    for (const player of players) {
      if (!player.satellites) continue;
      for (const sat of player.satellites) {
        if (sat.status !== "active" || sat.expiresAt <= now) continue;
        // All satellites use the same cyan color
        const color = COLOR_PLAYER.clone();
        result.push({ id: sat.id, color });
      }
    }
    return result;
  }, [players]);

  // Persistent orbit state per satellite id (angle advances each frame)
  const orbitsRef = useRef<Map<string, SatOrbitState>>(new Map());

  // Individual mesh refs (re-allocated if satellite count changes)
  const meshesRef = useRef<(THREE.Mesh | null)[]>([]);

  // Initialise / prune orbit states when satellite list changes
  useEffect(() => {
    const next = new Map<string, SatOrbitState>();
    for (const sat of activeSats) {
      const existing = orbitsRef.current.get(sat.id);
      next.set(sat.id, existing ?? {
        angle:       satHashFloat(sat.id, 1) * Math.PI * 2,
        inclination: (satHashFloat(sat.id, 2) - 0.5) * (Math.PI / 2),
      });
    }
    orbitsRef.current = next;
    // Resize mesh ref array to match
    meshesRef.current = meshesRef.current.slice(0, activeSats.length);
  }, [activeSats]);

  // Advance orbit angles and update mesh positions each frame
  useFrame((_, delta) => {
    activeSats.forEach((sat, i) => {
      const orb  = orbitsRef.current.get(sat.id);
      const mesh = meshesRef.current[i];
      if (!orb || !mesh) return;

      orb.angle += SAT_ORBIT_SPEED * delta * 60;
      if (orb.angle > Math.PI * 2) orb.angle -= Math.PI * 2;

      const cosI = Math.cos(orb.inclination);
      const sinI = Math.sin(orb.inclination);
      const cosA = Math.cos(orb.angle);
      const sinA = Math.sin(orb.angle);

      mesh.position.set(
        SAT_ORBIT_RADIUS * cosA * cosI,
        SAT_ORBIT_RADIUS * sinI,
        SAT_ORBIT_RADIUS * sinA * cosI,
      );
    });
  });

  if (activeSats.length === 0) return null;

  return (
    <group name="satellite-orbit-layer">
      {activeSats.map((sat, i) => (
        <mesh
          key={sat.id}
          ref={(el) => { meshesRef.current[i] = el; }}
          position={[SAT_ORBIT_RADIUS, 0, 0]}
        >
          <sphereGeometry args={[SAT_SPHERE_RADIUS, 12, 12]} />
          <meshStandardMaterial
            color={sat.color}
            emissive={sat.color}
            emissiveIntensity={0.7}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}
