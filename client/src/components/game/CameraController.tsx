import * as THREE from "three";
import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { latLngToVec3, GLOBE_RADIUS } from "./globeUtils";

// ── CameraController ──────────────────────────────────────────────────────────
// Handles two behaviors:
//   1. Fly-to: smoothly animates camera to face a target lat/lng on the globe
//   2. Idle auto-rotate: activates OrbitControls.autoRotate after 8s of no input

interface CameraControllerProps {
  targetLat: number | null;
  targetLng: number | null;
  controlsRef: React.RefObject<OrbitControlsImpl>;
  /** When true, auto-pilot camera through active battle hotspots (stream mode). */
  streamMode?: boolean;
  /** Sorted list of battle lat/lng hotspots for stream camera auto-rotation. */
  battleHotspots?: { lat: number; lng: number }[];
}

/** How long the stream camera dwells on each battle hotspot (ms). */
const STREAM_DWELL_MS = 15_000;

export function CameraController({ targetLat, targetLng, controlsRef, streamMode, battleHotspots }: CameraControllerProps) {
  const { camera } = useThree();

  const flyTarget  = useRef<THREE.Vector3 | null>(null);
  const flyZoom    = useRef<number | null>(null);
  const prevTarget = useRef<string>("");

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdle    = useRef(false);

  // Stream mode state
  const streamHotspotIdx  = useRef(0);
  const streamDwellStart  = useRef<number>(0);

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
    // Stream mode: auto-pilot through battle hotspots, ignoring manual fly-to
    if (streamMode && battleHotspots && battleHotspots.length > 0) {
      if (controlsRef.current) controlsRef.current.autoRotate = false;

      const now = Date.now();
      if (now - streamDwellStart.current > STREAM_DWELL_MS) {
        // Advance to next hotspot
        streamHotspotIdx.current = (streamHotspotIdx.current + 1) % battleHotspots.length;
        streamDwellStart.current = now;
        const h = battleHotspots[streamHotspotIdx.current];
        const surfaceVec = latLngToVec3(h.lat, h.lng, 1);
        flyTarget.current = surfaceVec.clone().multiplyScalar(FLY_DISTANCE);
      }
    }

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
