/**
 * GlobeEvents — all animated event overlays rendered inside the R3F scene:
 *   BattleArcs        — glowing arcs between attacker and defender plots
 *   MiningPulseLayer  — short-lived expanding ring pulses at mined parcels
 *   OrbitalZoneLayer  — impact zones and cosmetic streaks for orbital events
 *   SatelliteOrbitLayer — player-deployed satellites orbiting the globe
 */

import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import type { Battle, LandParcel, Player, SlimParcel, OrbitalEvent } from "@shared/schema";
import {
  GLOBE_RADIUS,
  COLOR_PLAYER,
  ARC_TUBE_RADIUS,
  ARC_SEGMENTS,
  FADE_DURATION,
  PULSE_DURATION,
  ORBITAL_ZONE_COLORS,
  ZONE_BASE_RADIUS,
  SAT_ORBIT_RADIUS,
  SAT_ORBIT_SPEED,
  SAT_SPHERE_RADIUS,
} from "@/lib/globe/globeConstants";
import { latLngToVec3, buildArcCurve, satHashFloat } from "@/lib/globe/globeUtils";
import type { LivePulse } from "@/lib/globe/globeTypes";

// ── BattleArcs ────────────────────────────────────────────────────────────────

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
        <meshBasicMaterial color={arcColor} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh ref={projectileRef} position={arc.fromVec}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshBasicMaterial color={arcColor} transparent opacity={1} depthWrite={false} />
      </mesh>
      <mesh position={arc.toVec}>
        <sphereGeometry args={[0.045, 8, 8]} />
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

export function BattleArcs({ battles, parcels, players, currentPlayerId }: BattleArcsProps) {
  const parcelLatLng = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    parcels.forEach(p => m.set(p.id, { lat: p.lat, lng: p.lng }));
    return m;
  }, [parcels]);

  const playerFirstParcel = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach(p => {
      if (p.ownedParcels && p.ownedParcels.length > 0) m.set(p.id, p.ownedParcels[0]);
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

      const attackerParcelId = battle.sourceParcelId ?? playerFirstParcel.get(battle.attackerId);
      if (!attackerParcelId) continue;
      const atkCoord = parcelLatLng.get(attackerParcelId);
      if (!atkCoord) continue;

      if (
        Math.abs(atkCoord.lat - defCoord.lat) < 0.01 &&
        Math.abs(atkCoord.lng - defCoord.lng) < 0.01
      ) continue;

      result.push({
        battleId:         battle.id,
        fromVec:          latLngToVec3(atkCoord.lat, atkCoord.lng, GLOBE_RADIUS * 1.01),
        toVec:            latLngToVec3(defCoord.lat, defCoord.lng, GLOBE_RADIUS * 1.01),
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

function SinglePulse({ pulse }: { pulse: LivePulse }) {
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
        <meshBasicMaterial color="#00ff6a" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={glowRef} onUpdate={self => self.lookAt(lookAt)}>
        <circleGeometry args={[0.018, 24]} />
        <meshBasicMaterial color="#80ffb0" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function MiningPulseLayer({ pulses }: { pulses: LivePulse[] }) {
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

function ImpactZone({ event }: { event: OrbitalEvent }) {
  const discRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const tRef    = useRef(0);

  const pos    = useMemo(
    () => latLngToVec3(event.trajectory.endLat, event.trajectory.endLng, GLOBE_RADIUS * 1.004),
    [event.trajectory.endLat, event.trajectory.endLng]
  );
  const lookAt = useMemo(() => pos.clone().multiplyScalar(2), [pos]);
  const color  = useMemo(() => new THREE.Color(ORBITAL_ZONE_COLORS[event.type] ?? "#ffffff"), [event.type]);
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
        <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ringRef} renderOrder={20} onUpdate={self => self.lookAt(lookAt)}>
        <ringGeometry args={[radius * 0.85, radius * 1.05, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh renderOrder={20} onUpdate={self => self.lookAt(lookAt)}>
        <circleGeometry args={[radius * 0.08, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function CosmeticStreak({ event }: { event: OrbitalEvent }) {
  const dotRef      = useRef<THREE.Mesh>(null!);
  const progressRef = useRef(0);

  const color = useMemo(() => new THREE.Color(ORBITAL_ZONE_COLORS[event.type] ?? "#ffffff"), [event.type]);

  const curve = useMemo(() => {
    const from = latLngToVec3(event.trajectory.startLat, event.trajectory.startLng, GLOBE_RADIUS * 1.01);
    const to   = latLngToVec3(event.trajectory.endLat,   event.trajectory.endLng,   GLOBE_RADIUS * 1.01);
    const mid  = from.clone().add(to).multiplyScalar(0.5);
    const dist = from.distanceTo(to);
    mid.normalize().multiplyScalar(GLOBE_RADIUS * (1.3 + dist * 0.25));
    return new THREE.QuadraticBezierCurve3(from, mid, to);
  }, [event.trajectory]);

  const speed = 1 / Math.max((event.endAt - event.startAt) / 1000, 1);

  useFrame((_, delta) => {
    progressRef.current = Math.min(progressRef.current + delta * speed, 1);
    const pos = curve.getPoint(progressRef.current);
    if (dotRef.current) dotRef.current.position.copy(pos);
  });

  const opacity = progressRef.current > 0.8 ? (1 - progressRef.current) / 0.2 : 1;

  return (
    <mesh ref={dotRef} position={curve.getPoint(0)}>
      <sphereGeometry args={[0.014 * (0.5 + (event.intensity ?? 0.5)), 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

export function OrbitalZoneLayer({ events }: { events: OrbitalEvent[] }) {
  const now = Date.now();
  const impactEvents   = events.filter(e => !e.cosmetic && e.startAt <= now && e.endAt > now);
  const cosmeticEvents = events.filter(e =>  e.cosmetic && e.startAt <= now && e.endAt > now);

  if (impactEvents.length === 0 && cosmeticEvents.length === 0) return null;
  return (
    <>
      {impactEvents.map(event =>   <ImpactZone    key={event.id} event={event} />)}
      {cosmeticEvents.map(event => <CosmeticStreak key={event.id} event={event} />)}
    </>
  );
}

// ── SatelliteOrbitLayer ───────────────────────────────────────────────────────

interface SatOrbitState { angle: number; inclination: number; }
interface ActiveSatInfo  { id: string; color: THREE.Color; }

export function SatelliteOrbitLayer({ players }: { players: Player[] }) {
  const now = Date.now();

  const activeSats = useMemo<ActiveSatInfo[]>(() => {
    const result: ActiveSatInfo[] = [];
    for (const player of players) {
      if (!player.satellites) continue;
      for (const sat of player.satellites) {
        if (sat.status !== "active" || sat.expiresAt <= now) continue;
        result.push({ id: sat.id, color: COLOR_PLAYER.clone() });
      }
    }
    return result;
  }, [players]);

  const orbitsRef  = useRef<Map<string, SatOrbitState>>(new Map());
  const meshesRef  = useRef<(THREE.Mesh | null)[]>([]);

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
    meshesRef.current = meshesRef.current.slice(0, activeSats.length);
  }, [activeSats]);

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
