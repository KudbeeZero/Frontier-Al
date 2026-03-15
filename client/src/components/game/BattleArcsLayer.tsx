import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { LandParcel, Player, Battle, SlimParcel } from "@shared/schema";
import { latLngToVec3, GLOBE_RADIUS } from "./globeUtils";

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

export function BattleArcs({ battles, parcels, players, currentPlayerId }: BattleArcsProps) {
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

      const attackerParcelId =
        battle.sourceParcelId ??
        playerFirstParcel.get(battle.attackerId);
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
