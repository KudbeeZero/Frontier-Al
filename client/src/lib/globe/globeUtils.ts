import * as THREE from "three";
import type { LandParcel } from "@shared/schema";
import {
  GLOBE_RADIUS,
  GOLDEN_ANGLE,
  POLAR_EXCLUSION_LAT,
  BIOME_COLORS,
  COLOR_PLAYER,
  COLOR_ENEMY,
  SIZE_VARIANTS,
  ARC_LIFT_BASE,
  ARC_LIFT_SCALE,
  ARC_SEGMENTS,
} from "./globeConstants";
import type { PlotCoord } from "./globeTypes";

/**
 * Client-side Fibonacci sphere generator.
 * MUST produce the same lat/lng positions as server/sphereUtils.ts generateFibonacciSphere().
 * Uses polar exclusion to skip |lat| > POLAR_EXCLUSION_LAT.
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

/** Convert lat/lng to a 3D point on a sphere of radius r. */
export function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

/** Build a lifted arc curve between two globe-surface points. */
export function buildArcCurve(from: THREE.Vector3, to: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dist = from.distanceTo(to);
  const lift = ARC_LIFT_BASE + dist * ARC_LIFT_SCALE;
  mid.normalize().multiplyScalar(GLOBE_RADIUS * lift);
  return new THREE.QuadraticBezierCurve3(from, mid, to);
}

/** Build tangent-plane right/up vectors for a sphere surface normal. */
export function tangentFrame(normal: THREE.Vector3): { right: THREE.Vector3; up: THREE.Vector3 } {
  const arbitrary = Math.abs(normal.y) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const right = new THREE.Vector3().crossVectors(normal, arbitrary).normalize();
  const up    = new THREE.Vector3().crossVectors(right, normal).normalize();
  return { right, up };
}

/** Per-instance fill colour — biome-tinted for unowned, ownership colours for owned. */
export function getPlotColor(
  parcel: LandParcel | undefined,
  currentPlayerId: string | null,
): THREE.Color {
  if (!parcel) return new THREE.Color(0x1a2a3a); // fallback dark blue-grey
  if (!parcel.ownerId) {
    const biomeCol = BIOME_COLORS[parcel.biome];
    return biomeCol ? biomeCol.clone() : new THREE.Color(0x1a2a3a);
  }
  if (currentPlayerId && parcel.ownerId === currentPlayerId) return COLOR_PLAYER.clone();
  return COLOR_ENEMY.clone();
}

/** Subtle size variant from plotId to avoid monotonous repetition. */
export function getPlotSizeVariant(plotId: number): number {
  return SIZE_VARIANTS[plotId % SIZE_VARIANTS.length];
}

/** Deterministic float in [0,1] from a string id and a numeric offset. */
export function satHashFloat(id: string, offset: number): number {
  let h = (offset + 1) * 2654435761;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 2654435761);
  }
  return (h >>> 0) / 0xffffffff;
}
