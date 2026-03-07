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
  land_claimed:     "#00ff6a",
  battle_started:   "#ff1744",
  battle_resolved:  "#ff9800",
  commander_deployed: "#00e5ff",
  scan_ping:        "#2196f3",
  jammer_zone:      "#9c27b0",
  faction_movement: "#ffeb3b",
  resource_pulse:   "#4caf50",
};

interface PulseMarkerProps {
  event: WorldEvent;
  replayTime: number;
}

function PulseMarker({ event, replayTime }: PulseMarkerProps) {
  const meshRef  = useRef<THREE.Mesh>(null!);
  const ringRef  = useRef<THREE.Mesh>(null!);
  const t        = useRef(0);

  const pos = useMemo(
    () => latLngToVec3(event.lat, event.lng, GLOBE_RADIUS * 1.005),
    [event.lat, event.lng]
  );

  const lookAt = useMemo(() => pos.clone().multiplyScalar(2), [pos]);
  const color  = useMemo(() => new THREE.Color(EVENT_COLORS[event.type] ?? "#ffffff"), [event.type]);

  const age = (replayTime - event.timestamp) / 1000;
  const isRecent = age < 30;

  useFrame((_, delta) => {
    t.current += delta * (isRecent ? 3 : 1.5);
    const pulse = 0.7 + Math.sin(t.current) * 0.3;

    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = pulse * 0.85;
    }
    if (ringRef.current) {
      const ringPulse = (Math.sin(t.current * 0.7) + 1) * 0.5;
      ringRef.current.scale.setScalar(1.0 + ringPulse * 0.6);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - ringPulse) * 0.6;
    }
  });

  return (
    <group position={pos}>
      <mesh ref={meshRef} onUpdate={self => self.lookAt(lookAt)}>
        <circleGeometry args={[0.012, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ringRef} onUpdate={self => self.lookAt(lookAt)}>
        <ringGeometry args={[0.012, 0.022, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

interface ArcMarkerProps {
  event: WorldEvent;
}

function ArcMarker({ event }: ArcMarkerProps) {
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

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [points]);

  const color = useMemo(() => new THREE.Color(EVENT_COLORS.faction_movement), []);


  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }), [color]);
  const lineObj = useMemo(() => new THREE.Line(geometry, mat), [geometry, mat]);

  useFrame((_, delta) => {
    t.current += delta;
    mat.opacity = 0.5 + Math.sin(t.current * 2) * 0.3;
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
        if (event.type === "faction_movement") {
          return <ArcMarker key={event.id} event={event} />;
        }
        return <PulseMarker key={event.id} event={event} replayTime={replayTime} />;
      })}
    </>
  );
}
