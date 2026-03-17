/**
 * useGlobeCamera — CameraController hook.
 * Handles fly-to animation and idle auto-rotate via OrbitControls.
 * Returns a render-null R3F component to mount inside the Canvas.
 */

import * as THREE from "three";
import { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { GLOBE_RADIUS, STREAM_DWELL_MS, FLY_DISTANCE, FLY_SPEED, FLY_DONE_SQ } from "@/lib/globe/globeConstants";
import { latLngToVec3 } from "@/lib/globe/globeUtils";

interface UseCameraControllerProps {
  targetLat: number | null;
  targetLng: number | null;
  controlsRef: React.RefObject<OrbitControlsImpl>;
  streamMode?: boolean;
  battleHotspots?: { lat: number; lng: number }[];
  /** Increment to force a re-fly even when lat/lng haven't changed. */
  flyRequestId?: number;
}

export function CameraController({ targetLat, targetLng, controlsRef, streamMode, battleHotspots, flyRequestId }: UseCameraControllerProps) {
  const { camera } = useThree();

  const flyTarget  = useRef<THREE.Vector3 | null>(null);
  const prevTarget = useRef<string>("");
  const idleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdle     = useRef(false);

  // Stream mode state
  const streamHotspotIdx = useRef(0);
  const streamDwellStart = useRef<number>(0);

  useEffect(() => {
    if (targetLat === null || targetLng === null) {
      flyTarget.current = null;
      return;
    }
    const key = `${targetLat.toFixed(4)},${targetLng.toFixed(4)}`;
    if (key === prevTarget.current && flyRequestId === undefined) return;
    prevTarget.current = key;

    const surfaceVec = latLngToVec3(targetLat, targetLng, 1);
    flyTarget.current = surfaceVec.clone().multiplyScalar(FLY_DISTANCE);
  }, [targetLat, targetLng, flyRequestId]);

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
    // Stream mode: auto-pilot through battle hotspots
    if (streamMode && battleHotspots && battleHotspots.length > 0) {
      if (controlsRef.current) controlsRef.current.autoRotate = false;
      const now = Date.now();
      if (now - streamDwellStart.current > STREAM_DWELL_MS) {
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
      return;
    }

    camera.position.lerp(target, FLY_SPEED);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) controlsRef.current.update();
  });

  return null;
}
