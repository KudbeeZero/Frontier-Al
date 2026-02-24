/**
 * OrbitalLayer.tsx
 *
 * Renders cosmetic and impact orbital events as 3D streak lines in the scene.
 * This component lives OUTSIDE the RotatingGlobe group so meteor streaks move
 * independently of the globe's rotation — they exist in world space.
 *
 * Rendering strategy (mobile-safe):
 *  - Each streak = one THREE.Line with 2 points (start + end of trail)
 *  - Animated by interpolating a t [0,1] value over the event's duration
 *  - No heavy shaders, no post-processing — just emissive line material
 *  - Max active streaks capped to avoid performance degradation
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitalEvent } from "@shared/schema";

const GLOBE_RADIUS = 3;
const MAX_VISIBLE_STREAKS = 6; // mobile-safe cap

// Event type → trail color
const STREAK_COLORS: Record<string, string> = {
  METEOR_SHOWER:    "#ff9944",
  SINGLE_BOLIDE:    "#ffcc22",
  COMET_PASS:       "#aaddff",
  ORBITAL_DEBRIS:   "#cccccc",
  ATMOSPHERIC_BURST:"#ff6688",
  IMPACT_STRIKE:    "#ff2244",
};

/** Convert lat/lng to a world-space 3D position (not inside the rotating group). */
function latLngToWorld(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

/** A single animated streak line. */
function OrbitalStreak({ event }: { event: OrbitalEvent }) {
  const lineRef  = useRef<THREE.Line>(null!);
  const tRef     = useRef(0);
  const startRef = useRef(Date.now());

  const { startPos, endPos, color, trailLength } = useMemo(() => {
    const { startLat, startLng, endLat, endLng } = event.trajectory;
    const startPos = latLngToWorld(startLat, startLng, GLOBE_RADIUS * 1.4);
    const endPos   = latLngToWorld(endLat,   endLng,   GLOBE_RADIUS * 1.02);
    const color    = new THREE.Color(STREAK_COLORS[event.type] ?? "#ffffff");
    // Trail length: 10–40% of the full path based on intensity
    const trailLength = 0.10 + event.intensity * 0.30;
    return { startPos, endPos, color, trailLength };
  }, [event]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // Two vertices: head and tail — we'll update them in useFrame
    const pos = new Float32Array(6); // 2 × XYZ
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  useEffect(() => {
    startRef.current = event.startAt;
    tRef.current     = 0;
    return () => geometry.dispose();
  }, [event.id, geometry]);

  useFrame(() => {
    if (!lineRef.current) return;
    const now       = Date.now();
    const elapsed   = now - event.startAt;
    const total     = event.endAt - event.startAt;
    const rawT      = Math.max(0, Math.min(1, elapsed / total));

    // Ease-in quadratic so the streak accelerates
    const t = rawT * rawT;

    // Head moves from 0 → 1 along the path; tail trails behind
    const headT = t;
    const tailT = Math.max(0, headT - trailLength);

    const head = startPos.clone().lerp(endPos, headT);
    const tail = startPos.clone().lerp(endPos, tailT);

    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    posAttr.setXYZ(0, tail.x,  tail.y,  tail.z);
    posAttr.setXYZ(1, head.x,  head.y,  head.z);
    posAttr.needsUpdate = true;

    // Fade out in the last 20% of the event duration
    const mat = lineRef.current.material as THREE.LineBasicMaterial;
    if (rawT > 0.8) {
      mat.opacity = 1 - (rawT - 0.8) / 0.2;
    } else {
      mat.opacity = Math.min(1, rawT / 0.1 * event.intensity); // quick fade-in
    }
  });

  return (
    // @ts-ignore — JSX line element accepted by React Three Fiber
    <line ref={lineRef} geometry={geometry}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0}
        linewidth={event.intensity > 0.7 ? 2 : 1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </line>
  );
}

/** Impact ring pulse — a growing translucent circle at the target position. */
function ImpactRing({ event }: { event: OrbitalEvent }) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const tRef    = useRef(0);

  const pos = useMemo(() => {
    const { endLat, endLng } = event.trajectory;
    return latLngToWorld(endLat, endLng, GLOBE_RADIUS + 0.05);
  }, [event]);

  const normal = useMemo(() => pos.clone().normalize(), [pos]);
  const quat   = useMemo(() =>
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal),
  [normal]);

  const geo = useMemo(() => new THREE.RingGeometry(0.01, 0.04, 32), []);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((_, delta) => {
    if (!ringRef.current) return;
    const now   = Date.now();
    const total = event.endAt - event.startAt;
    const t     = Math.max(0, Math.min(1, (now - event.startAt) / total));

    // Ring expands then fades
    const scale = 1 + t * 8;
    ringRef.current.scale.setScalar(scale);

    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, (1 - t) * 0.7);
  });

  return (
    <mesh ref={ringRef} geometry={geo} position={pos} quaternion={quat}>
      <meshBasicMaterial
        color="#00e5ff"
        transparent
        opacity={0.7}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface OrbitalLayerProps {
  events: OrbitalEvent[];
}

/**
 * OrbitalLayer — place this OUTSIDE the RotatingGlobe group inside the Canvas,
 * at the same level as AtmosphereGlow and Stars, so streaks don't rotate with
 * the planet.
 */
export function OrbitalLayer({ events }: OrbitalLayerProps) {
  const now     = Date.now();
  // Filter to events that are currently "in flight"
  const active  = events
    .filter((e) => e.startAt <= now && e.endAt >= now)
    .slice(0, MAX_VISIBLE_STREAKS);

  const impacts = active.filter((e) => !e.cosmetic);

  return (
    <group name="orbital-layer">
      {active.map((e) => (
        <OrbitalStreak key={e.id} event={e} />
      ))}
      {impacts.map((e) => (
        <ImpactRing key={`ring-${e.id}`} event={e} />
      ))}
    </group>
  );
}
