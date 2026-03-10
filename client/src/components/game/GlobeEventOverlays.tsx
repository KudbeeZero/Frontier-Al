/**
 * GlobeEventOverlays — renders replay world events on the Three.js globe.
 * Mount this INSIDE a <Canvas> scene alongside the existing globe.
 */
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { WorldEvent } from "@shared/worldEvents";

const GLOBE_RADIUS = 2;

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi   = (90 - lat)  * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

const EVENT_COLORS: Record<string, string> = {
  land_claimed:       "#00ff6a",
  battle_started:     "#ff1744",
  battle_resolved:    "#ff9800",
  commander_deployed: "#00e5ff",
  commander_minted:   "#00e5ff",
  scan_ping:          "#2196f3",
  jammer_zone:        "#9c27b0",
  faction_movement:   "#ffeb3b",
  resource_pulse:     "#4caf50",
  mine_action:        "#78909c",
};

const EVENT_SIZES: Partial<Record<string, number>> = {
  battle_started:     0.022,
  battle_resolved:    0.016,
  land_claimed:       0.012,
  mine_action:        0.008,
  commander_minted:   0.014,
  commander_deployed: 0.014,
  scan_ping:          0.018,
  jammer_zone:        0.020,
  resource_pulse:     0.010,
  faction_movement:   0.012,
};

interface PulseMarkerProps {
  event: WorldEvent;
  replayTime: number;
  size?: number;
}

function PulseMarker({ event, replayTime, size = 0.012 }: PulseMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const t       = useRef(0);

  const pos = useMemo(
    () => latLngToVec3(event.lat, event.lng, GLOBE_RADIUS * 1.005),
    [event.lat, event.lng]
  );
  const lookAt = useMemo(() => pos.clone().multiplyScalar(2), [pos]);
  const color  = useMemo(() => new THREE.Color(EVENT_COLORS[event.type] ?? "#ffffff"), [event.type]);

  const age      = (replayTime - event.timestamp) / 1000;
  const isRecent = age < 30;
  const isBattle = event.type === "battle_started";
  const isRingOnly = event.type === "scan_ping";
  const pulseSpeed = isBattle ? (isRecent ? 5 : 3) : (isRecent ? 3 : 1.5);

  useFrame((_, delta) => {
    t.current += delta * pulseSpeed;
    const pulse = 0.7 + Math.sin(t.current) * 0.3;

    if (meshRef.current && !isRingOnly) {
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = pulse * 0.85;
    }
    if (ringRef.current) {
      const ringPulse = (Math.sin(t.current * 0.7) + 1) * 0.5;
      ringRef.current.scale.setScalar(1.0 + ringPulse * 0.6);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - ringPulse) * 0.6;
    }
  });

  const ringInner = size;
  const ringOuter = size * 1.8;

  return (
    <group position={pos}>
      {!isRingOnly && (
        <mesh ref={meshRef} onUpdate={self => self.lookAt(lookAt)}>
          <circleGeometry args={[size, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh ref={isRingOnly ? meshRef : ringRef} onUpdate={self => self.lookAt(lookAt)}>
        <ringGeometry args={[ringInner, ringOuter, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

interface ArcMarkerProps {
  event: WorldEvent;
  isBattle?: boolean;
}

function ArcMarker({ event, isBattle = false }: ArcMarkerProps) {
  const t = useRef(0);

  const fromLat = (event.metadata.fromLat as number) ?? event.lat;
  const fromLng = (event.metadata.fromLng as number) ?? event.lng;

  const points = useMemo(() => {
    const start = latLngToVec3(fromLat, fromLng, GLOBE_RADIUS * 1.01);
    const end   = latLngToVec3(event.lat, event.lng, GLOBE_RADIUS * 1.01);
    const mid   = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(GLOBE_RADIUS * 1.25);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return curve.getPoints(30);
  }, [fromLat, fromLng, event.lat, event.lng]);

  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  const arcColor = useMemo(
    () => new THREE.Color(isBattle ? "#ff1744" : EVENT_COLORS.faction_movement),
    [isBattle]
  );

  const mat = useMemo(() => new THREE.LineBasicMaterial({
    color: arcColor,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  }), [arcColor]);

  const lineObj = useMemo(() => new THREE.Line(geometry, mat), [geometry, mat]);

  const animSpeed = isBattle ? 4 : 2;
  useFrame((_, delta) => {
    t.current += delta;
    mat.opacity = 0.5 + Math.sin(t.current * animSpeed) * 0.3;
  });

  return <primitive object={lineObj} />;
}

interface GlobeEventOverlaysProps {
  events: WorldEvent[];
  replayTime: number;
  visibleTypes: Set<string>;
}

export function GlobeEventOverlays({ events, replayTime, visibleTypes }: GlobeEventOverlaysProps) {
  const visible = useMemo(() => {
    return events.filter(e => {
      if (!visibleTypes.has(e.type)) return false;
      const start = e.timestamp;
      const end   = e.endTimestamp ?? e.timestamp + 120_000;
      return replayTime >= start - 5000 && replayTime <= end;
    });
  }, [events, replayTime, visibleTypes]);

  return (
    <>
      {visible.map(event => {
        const size         = EVENT_SIZES[event.type] ?? 0.012;
        const hasBattleArc = event.type === "battle_started" &&
          event.metadata.fromLat !== undefined &&
          event.metadata.fromLng !== undefined;
        const hasFactionArc = event.type === "faction_movement";

        return (
          <group key={event.id}>
            {/* Pulse marker for all non-pure-arc events */}
            {!hasFactionArc && (
              <PulseMarker event={event} replayTime={replayTime} size={size} />
            )}
            {/* Arc for faction movement */}
            {hasFactionArc && <ArcMarker event={event} isBattle={false} />}
            {/* Arc for battle_started when origin coords present */}
            {hasBattleArc && <ArcMarker event={event} isBattle={true} />}
          </group>
        );
      })}
    </>
  );
}
