import * as THREE from "three";

export const GLOBE_RADIUS = 2;
export const PLOT_COUNT = 21000;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Polar exclusion latitude — must match server/sphereUtils.ts POLAR_EXCLUSION_LAT.
 * Plots above this latitude (abs) are skipped so the globe shows clean circular
 * polar cap voids at both poles (matching the Zero Colonies aesthetic).
 */
export const POLAR_EXCLUSION_LAT = 75;

export interface PlotCoord { plotId: number; lat: number; lng: number; }

/**
 * Client-side Fibonacci sphere generator.
 * MUST produce the same lat/lng positions as server/sphereUtils.ts generateFibonacciSphere().
 * Uses polar exclusion to skip |lat| > POLAR_EXCLUSION_LAT, creating the clean circular
 * polar cap voids on the globe.
 */
export function generateFibonacciSphere(count: number): PlotCoord[] {
  const plots: PlotCoord[] = [];
  const candidates = Math.ceil(count * 1.1); // same headroom multiplier as server

  for (let i = 0; i < candidates && plots.length < count; i++) {
    const y = 1 - (i / (candidates - 1)) * 2;
    const theta = GOLDEN_ANGLE * i;
    const lat = Math.asin(y) * (180 / Math.PI);
    if (Math.abs(lat) > POLAR_EXCLUSION_LAT) continue;
    const lng = ((theta * 180) / Math.PI) % 360;
    plots.push({ plotId: plots.length + 1, lat, lng: lng > 180 ? lng - 360 : lng });
  }
  return plots;
}

export function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}
