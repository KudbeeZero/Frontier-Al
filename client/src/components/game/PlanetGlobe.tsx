/**
 * PlanetGlobe.
 * tsx — FRONTIER Tier 1 Globe
 */

import * as THREE from "three";
import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { Canvas, useLoader, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { LandParcel, Player, Battle, SlimParcel, OrbitalEvent, BiomeType } from "@shared/schema";
import { biomeColors } from "@shared/schema";
import type { WorldEvent } from "@shared/worldEvents";
import { GlobeEventOverlays } from "./GlobeEventOverlays";
import { Button } from "@/components/ui/button";
import { Sword, HardHat, Pickaxe, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { GLOBE_RADIUS, PLOT_COUNT, GOLDEN_ANGLE, POLAR_EXCLUSION_LAT, generateFibonacciSphere, latLngToVec3 } from "./globeUtils";
import { COLOR_PLAYER, COLOR_ENEMY, COLOR_BATTLE, COLOR_BORDER_OWNED, COLOR_BORDER_UNOWNED, BIOME_COLORS } from "./globeConstants";
import { CameraController } from "./CameraController";
import { BattleArcs } from "./BattleArcsLayer";
import { MiningPulseLayer, type LivePulse } from "./MiningPulseLayer";
import { OrbitalZoneLayer, SatelliteOrbitLayer } from "./OrbitalLayers";



// ── AtmosphereGlow ────────────────────────────────────────────────────────────
// Two concentric BackSide spheres with additive blending create a faint blue
// atmospheric rim — occluded by the planet at the center, visible at the limb.

function AtmosphereGlow() {
  const innerUniforms = useMemo(() => ({
    glowColor:   { value: new THREE.Color(0.12, 0.48, 1.0) },
    coefficient: { value: 0.62 },
    power:       { value: 3.2 },
  }), []);

  const outerUniforms = useMemo(() => ({
    glowColor:   { value: new THREE.Color(0.05, 0.68, 0.9) },
    coefficient: { value: 0.48 },
    power:       { value: 4.8 },
  }), []);

  const vertShader = `
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragShader = `
    uniform vec3 glowColor;
    uniform float coefficient;
    uniform float power;
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      float intensity = pow(coefficient + dot(vPositionNormal, vNormal), power);
      gl_FragColor = vec4(glowColor, intensity * 0.6);
    }
  `;

  return (
    <>
      {/* Inner tight rim — fresnel blue at planet limb */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.05, 64, 32]} />
        <shaderMaterial
          uniforms={innerUniforms}
          vertexShader={vertShader}
          fragmentShader={fragShader}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer wide haze — softer cyan-teal corona */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.18, 64, 32]} />
        <shaderMaterial
          uniforms={outerUniforms}
          vertexShader={vertShader}
          fragmentShader={fragShader}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}


/** Per-instance fill colour — biome-tinted for unowned, ownership colours for owned. */
function getPlotColor(
  parcel: LandParcel | undefined,
  currentPlayerId: string | null,
): THREE.Color {
  if (!parcel) return new THREE.Color(0x1a2a3a); // fallback dark blue-grey
  if (!parcel.ownerId) {
    // Unowned: show biome color (dimmed)
    const biomeCol = BIOME_COLORS[parcel.biome];
    return biomeCol ? biomeCol.clone() : new THREE.Color(0x1a2a3a);
  }
  if (currentPlayerId && parcel.ownerId === currentPlayerId) return COLOR_PLAYER.clone();
  return COLOR_ENEMY.clone();
}

function StarField() {
  const MAIN_COUNT   = 10000;
  const BRIGHT_COUNT = 180;

  const { mainGeo, brightGeo } = useMemo(() => {
    const mPos = new Float32Array(MAIN_COUNT * 3);
    const mCol = new Float32Array(MAIN_COUNT * 3);
    const bPos = new Float32Array(BRIGHT_COUNT * 3);
    const bCol = new Float32Array(BRIGHT_COUNT * 3);

    for (let i = 0; i < MAIN_COUNT; i++) {
      const r     = 65 + Math.random() * 90;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      mPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      mPos[i * 3 + 1] = r * Math.cos(phi);
      mPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const t = Math.random();
      if (t < 0.52) {
        // Blue-white hot stars (O/B class)
        mCol[i*3] = 0.72 + Math.random() * 0.28;
        mCol[i*3+1] = 0.84 + Math.random() * 0.16;
        mCol[i*3+2] = 1.0;
      } else if (t < 0.78) {
        // Pure white (A/F class)
        const v = 0.85 + Math.random() * 0.15;
        mCol[i*3] = v; mCol[i*3+1] = v; mCol[i*3+2] = v;
      } else if (t < 0.93) {
        // Warm yellow-white (G/K class, sun-like)
        mCol[i*3] = 1.0;
        mCol[i*3+1] = 0.85 + Math.random() * 0.12;
        mCol[i*3+2] = 0.52 + Math.random() * 0.22;
      } else {
        // Deep orange-red (M class, cool giants)
        mCol[i*3] = 1.0;
        mCol[i*3+1] = 0.35 + Math.random() * 0.30;
        mCol[i*3+2] = 0.15 + Math.random() * 0.18;
      }
    }

    for (let i = 0; i < BRIGHT_COUNT; i++) {
      const r     = 58 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      bPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      bPos[i * 3 + 1] = r * Math.cos(phi);
      bPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      // Mix of pure white and icy blue-white for prominent stars
      if (Math.random() < 0.55) {
        bCol[i*3] = 1.0; bCol[i*3+1] = 1.0; bCol[i*3+2] = 1.0;
      } else {
        bCol[i*3] = 0.78; bCol[i*3+1] = 0.9; bCol[i*3+2] = 1.0;
      }
    }

    const mGeo = new THREE.BufferGeometry();
    mGeo.setAttribute("position", new THREE.BufferAttribute(mPos, 3));
    mGeo.setAttribute("color",    new THREE.BufferAttribute(mCol, 3));

    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    bGeo.setAttribute("color",    new THREE.BufferAttribute(bCol, 3));

    return { mainGeo: mGeo, brightGeo: bGeo };
  }, []);

  return (
    <>
      {/* Background star field — small, numerous, coloured */}
      <points geometry={mainGeo}>
        <pointsMaterial
          vertexColors
          size={0.08}
          sizeAttenuation
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </points>
      {/* Foreground bright stars — fewer, larger, more prominent */}
      <points geometry={brightGeo}>
        <pointsMaterial
          vertexColors
          size={0.26}
          sizeAttenuation
          transparent
          opacity={1.0}
          depthWrite={false}
        />
      </points>
    </>
  );
}

interface PlotOverlayProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  onPlotSelect: (parcelId: string) => void;
}

// Color used for subdivided macro-plot fill (neutral dim so sub-tiles show through)
const COLOR_SUBDIVIDED = new THREE.Color(0x111820);

// Subtle size variation — natural variety without causing overlap artifacts
const SIZE_VARIANTS = [1.0, 1.04, 0.96, 1.06, 0.98, 1.02, 0.95, 1.05];
function getPlotSizeVariant(plotId: number): number {
  return SIZE_VARIANTS[plotId % SIZE_VARIANTS.length];
}


// Pre-compute sphere used for hit-testing (analytic intersection, no mesh needed)
const HIT_SPHERE = new THREE.Sphere(new THREE.Vector3(0, 0, 0), GLOBE_RADIUS);

function PlotOverlay({ parcels, players, currentPlayerId, selectedPlotId, onPlotSelect }: PlotOverlayProps) {
  const fillMeshRef   = useRef<THREE.InstancedMesh>(null!);
  const borderMeshRef = useRef<THREE.InstancedMesh>(null!);
  const readyRef      = useRef(false);
  const pulseRef      = useRef(0);
  // Store intersection point at pointer-down to detect drag vs click
  const pointerDownPt = useRef<THREE.Vector3 | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);

  const plotCoords = useMemo(() => generateFibonacciSphere(PLOT_COUNT), []);

  const plotIdToParcel = useMemo(() => {
    const m = new Map<number, LandParcel>();
    parcels.forEach(p => m.set(p.plotId, p));
    return m;
  }, [parcels]);

  // Flat Float32Array of every plot's 3D position — used for O(n) nearest-neighbor on clicks/hover
  const plotPositions3D = useMemo(() => {
    const arr = new Float32Array(plotCoords.length * 3);
    for (let i = 0; i < plotCoords.length; i++) {
      const v = latLngToVec3(plotCoords[i].lat, plotCoords[i].lng, GLOBE_RADIUS);
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
    }
    return arr;
  }, [plotCoords]);

  // Returns the index of the plot center closest to a world-space point
  const nearestPlot = useCallback((px: number, py: number, pz: number): number => {
    let minD2 = Infinity, best = 0;
    const pos = plotPositions3D;
    for (let i = 0; i < PLOT_COUNT; i++) {
      const dx = pos[i*3] - px, dy = pos[i*3+1] - py, dz = pos[i*3+2] - pz;
      const d2 = dx*dx + dy*dy + dz*dz;
      if (d2 < minD2) { minD2 = d2; best = i; }
    }
    return best;
  }, [plotPositions3D]);

  const animatedIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < plotCoords.length; i++) {
      const coord = plotCoords[i];
      const parcel = plotIdToParcel.get(coord.plotId);
      if (parcel?.id === selectedPlotId || parcel?.ownerId === currentPlayerId || parcel?.activeBattleId) {
        indices.push(i);
      }
    }
    return indices;
  }, [plotCoords, plotIdToParcel, selectedPlotId, currentPlayerId]);

  const unownedIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < plotCoords.length; i++) {
      const coord = plotCoords[i];
      const parcel = plotIdToParcel.get(coord.plotId);
      if (!parcel?.ownerId) indices.push(i);
    }
    return indices;
  }, [plotCoords, plotIdToParcel]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const fillSize   = GLOBE_RADIUS * 0.034;
  const borderSize = GLOBE_RADIUS * 0.038;

  const applyInstance = (
    mesh: THREE.InstancedMesh,
    i: number,
    pos: THREE.Vector3,
    size: number,
    color: THREE.Color
  ) => {
    dummy.position.copy(pos);
    dummy.lookAt(pos.clone().multiplyScalar(2));
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color);
  };

  // Pre-cached 3D positions for fill and border layers — never recomputed in useFrame.
  const fillPositions3D = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (const coord of plotCoords) {
      arr.push(latLngToVec3(coord.lat, coord.lng, GLOBE_RADIUS * 1.006));
    }
    return arr;
  }, [plotCoords]);

  const borderPositions3D = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (const coord of plotCoords) {
      arr.push(latLngToVec3(coord.lat, coord.lng, GLOBE_RADIUS * 1.004));
    }
    return arr;
  }, [plotCoords]);


  const prevHoveredRef = useRef<number | null>(null);

  useFrame((_, delta) => {
    if (!fillMeshRef.current || !borderMeshRef.current || !readyRef.current) return;
    pulseRef.current += delta * 2.5;

    const currentHovered = hoveredIndexRef.current;
    const prevHovered    = prevHoveredRef.current;
    prevHoveredRef.current = currentHovered;

    // Build the set of tiles that need per-frame updates:
    // selected, active battles, hovered, and just-un-hovered (to reset).
    const toProcess = new Set<number>(animatedIndices);
    if (currentHovered !== null) toProcess.add(currentHovered);
    if (prevHovered !== null && prevHovered !== currentHovered) toProcess.add(prevHovered);

    let colorDirty  = false;
    let matrixDirty = false;

    for (const i of toProcess) {
      const coord   = plotCoords[i];
      const parcel  = plotIdToParcel.get(coord.plotId);
      const sizeVar = getPlotSizeVariant(coord.plotId);

      const isSelected = parcel?.id === selectedPlotId;
      const isHovered  = currentHovered === i;
      const isOwned    = !!parcel?.ownerId;

      const fillPos   = fillPositions3D[i];
      const borderPos = borderPositions3D[i];

      let fillColor: THREE.Color;

      const isSubdivided = !!(parcel as LandParcel)?.isSubdivided;

      if (isHovered) {
        // Any hovered tile shows dim green — owned or not
        fillColor = COLOR_PLAYER.clone().multiplyScalar(0.6);
      } else if (isSelected) {
        const pulse = 1.0 + Math.sin(pulseRef.current * 2) * 0.08;
        // Selected tile always shows green — owned tiles pulse brighter
        fillColor = isOwned
          ? COLOR_PLAYER.clone().multiplyScalar(pulse)
          : COLOR_PLAYER.clone().multiplyScalar(pulse * 0.75);
      } else if (parcel?.activeBattleId) {
        const bp = 0.75 + Math.sin(pulseRef.current * 3) * 0.25;
        fillColor = COLOR_BATTLE.clone().multiplyScalar(bp);
      } else if (isSubdivided) {
        fillColor = COLOR_SUBDIVIDED.clone();
      } else {
        fillColor = getPlotColor(parcel, currentPlayerId);
      }

      const borderColor = isSelected || isHovered
        ? COLOR_PLAYER.clone()
        : isOwned
          ? COLOR_BORDER_OWNED.clone()
          : COLOR_BORDER_UNOWNED.clone();

      // All tiles visible: owned tiles full scale, unowned slightly smaller with biome color
      const fillScale   = isOwned || isSelected || isHovered ? 1.0 : 0.85;
      const borderScale = isOwned || isSelected || isHovered ? 1.0 : 0.85;

      applyInstance(fillMeshRef.current,   i, fillPos,   fillSize   * sizeVar * fillScale,   fillColor);
      applyInstance(borderMeshRef.current, i, borderPos, borderSize * sizeVar * borderScale, borderColor);

      colorDirty  = true;
      matrixDirty = true;
    }

    if (matrixDirty) {
      fillMeshRef.current.instanceMatrix.needsUpdate   = true;
      borderMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (colorDirty) {
      if (fillMeshRef.current.instanceColor)   fillMeshRef.current.instanceColor.needsUpdate   = true;
      if (borderMeshRef.current.instanceColor) borderMeshRef.current.instanceColor.needsUpdate = true;
    }

  });

  useEffect(() => {
    if (!fillMeshRef.current || !borderMeshRef.current) return;

    for (let i = 0; i < plotCoords.length; i++) {
      const coord  = plotCoords[i];
      const parcel = plotIdToParcel.get(coord.plotId);
      const sizeVar = getPlotSizeVariant(coord.plotId);

      const fillPos   = fillPositions3D[i];
      const borderPos = borderPositions3D[i];

      // Determine fill color — ownership flat-colour only.
      let fillColor: THREE.Color;
      const isOwned      = !!parcel?.ownerId;
      const isSelected   = parcel?.id === selectedPlotId;
      const isSubdivided = !!(parcel as LandParcel)?.isSubdivided;

      if (isSelected) {
        // Always show green when selected — owned tiles brighter, unowned slightly dimmer
        fillColor = isOwned ? COLOR_PLAYER.clone() : COLOR_PLAYER.clone().multiplyScalar(0.75);
      } else if (parcel?.activeBattleId) {
        fillColor = COLOR_BATTLE.clone();
      } else if (isSubdivided) {
        // Subdivided plots show neutral dark fill so sub-tiles are visible
        fillColor = COLOR_SUBDIVIDED.clone();
      } else {
        fillColor = getPlotColor(parcel, currentPlayerId);
      }

      // Border: green on selected, white on owned, bright cyan on unowned.
      const borderColor = isSelected
        ? COLOR_PLAYER.clone()
        : isOwned
          ? COLOR_BORDER_OWNED.clone()
          : COLOR_BORDER_UNOWNED.clone();

      // All tiles visible: owned tiles full scale, unowned slightly smaller with biome color
      const fillScale   = isOwned || isSelected ? 1.0 : 0.85;
      const borderScale = isOwned || isSelected ? 1.0 : 0.85;
      applyInstance(fillMeshRef.current,   i, fillPos,   fillSize   * sizeVar * fillScale,   fillColor);
      applyInstance(borderMeshRef.current, i, borderPos, borderSize * sizeVar * borderScale, borderColor);
    }

    fillMeshRef.current.instanceMatrix.needsUpdate   = true;
    borderMeshRef.current.instanceMatrix.needsUpdate = true;
    if (fillMeshRef.current.instanceColor)   fillMeshRef.current.instanceColor.needsUpdate   = true;
    if (borderMeshRef.current.instanceColor) borderMeshRef.current.instanceColor.needsUpdate = true;

    // Only set ready once we have real parcel data.
    if (parcels.length > 0) readyRef.current = true;
  }, [parcels, currentPlayerId, selectedPlotId, plotCoords, plotIdToParcel,
      fillPositions3D, borderPositions3D, fillSize, borderSize]);

  // Sphere-based hover — fires on the invisible coverage sphere, normalize to globe surface
  const handlePointerMove = useCallback((e: any) => {
    const p = e.point as THREE.Vector3;
    const len = p.length();
    const scale = len > 0 ? GLOBE_RADIUS / len : 1;
    hoveredIndexRef.current = nearestPlot(p.x * scale, p.y * scale, p.z * scale);
  }, [nearestPlot]);

  const handlePointerLeave = useCallback(() => {
    hoveredIndexRef.current = null;
  }, []);

  const handlePointerDown = useCallback((e: any) => {
    pointerDownPt.current = (e.point as THREE.Vector3).clone();
  }, []);

  // Click fires from the invisible coverage sphere — find nearest plot, fire if it has a parcel.
  // Normalize click point to GLOBE_RADIUS so the nearest-neighbor search matches plotPositions3D.
  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    // Ignore if the pointer moved significantly (orbit drag)
    if ((e.delta as number) > 6) return;
    const p = e.point as THREE.Vector3;
    // Normalize click point from the invisible sphere surface down to globe surface
    const len = p.length();
    const scale = len > 0 ? GLOBE_RADIUS / len : 1;
    const nx = p.x * scale, ny = p.y * scale, nz = p.z * scale;
    const idx = nearestPlot(nx, ny, nz);
    const coord = plotCoords[idx];
    const parcel = plotIdToParcel.get(coord.plotId);
    if (parcel) onPlotSelect(parcel.id);
  }, [nearestPlot, plotCoords, plotIdToParcel, onPlotSelect]);

  return (
    <>
      {/* Invisible sphere covering the full planet — catches every pointer event reliably,
          even in gaps between hex tiles and at oblique viewing angles.
          Geometry intersects cleanly; material is fully transparent and writes no depth. */}
      <mesh
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <sphereGeometry args={[GLOBE_RADIUS * 1.01, 48, 24]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} side={THREE.FrontSide} />
      </mesh>

      {/* Border frame — thin square outline for grid tile look (matches Zero Colonies aesthetic). */}
      <instancedMesh ref={borderMeshRef} args={[undefined, undefined, PLOT_COUNT]}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.65}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Fill layer — square tile. toneMapped=false so colours appear at exact sRGB values. */}
      <instancedMesh ref={fillMeshRef} args={[undefined, undefined, PLOT_COUNT]}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.72}
          depthWrite={true}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  );
}

// ── Sub-Parcel Overlay ────────────────────────────────────────────────────────
// Renders a 3×3 grid of 9 sub-tiles for every subdivided macro-plot.
// Sub-tile positions are computed via tangent-plane offsets from the macro center.

interface SubParcelOverlayProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
}

// Max sub-tiles = 21000 plots × 9 sub-parcels (only subdivided ones are rendered)
const MAX_SUB_TILES = 21000 * 9;

// Build tangent-plane right/up vectors for a sphere surface normal
function tangentFrame(normal: THREE.Vector3): { right: THREE.Vector3; up: THREE.Vector3 } {
  const arbitrary = Math.abs(normal.y) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const right = new THREE.Vector3().crossVectors(normal, arbitrary).normalize();
  const up    = new THREE.Vector3().crossVectors(right, normal).normalize();
  return { right, up };
}

function SubParcelOverlay({ parcels, players, currentPlayerId }: SubParcelOverlayProps) {
  const fillMeshRef   = useRef<THREE.InstancedMesh>(null!);
  const borderMeshRef = useRef<THREE.InstancedMesh>(null!);

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Sub-tile size: ~1/3 of macro-tile (fillSize = GLOBE_RADIUS * 0.034)
  const subFillSize   = GLOBE_RADIUS * 0.010;
  const subBorderSize = GLOBE_RADIUS * 0.011;
  // Spacing between sub-tile centers within the macro tile footprint
  const subSpacing    = GLOBE_RADIUS * 0.011;

  useEffect(() => {
    if (!fillMeshRef.current || !borderMeshRef.current) return;

    let instanceIdx = 0;

    for (const parcel of parcels) {
      if (!parcel.isSubdivided || !parcel.subParcelOwnerIds) continue;

      const center = latLngToVec3(parcel.lat, parcel.lng, GLOBE_RADIUS);
      const normal = center.clone().normalize();
      const { right, up } = tangentFrame(normal);

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const subIndex = row * 3 + col;
          const ownerId  = parcel.subParcelOwnerIds[subIndex] ?? null;

          // Offset in tangent plane: center sub-tile at (0,0)
          const offsetRight = (col - 1) * subSpacing;
          const offsetUp    = (1 - row) * subSpacing; // row 0 = top

          const worldPos = center.clone()
            .addScaledVector(right, offsetRight)
            .addScaledVector(up, offsetUp)
            .normalize()
            .multiplyScalar(GLOBE_RADIUS * 1.007);

          // Determine color
          let fillColor: THREE.Color;
          if (!ownerId) {
            fillColor = new THREE.Color(0x223344); // dark unowned
          } else if (currentPlayerId && ownerId === currentPlayerId) {
            fillColor = COLOR_PLAYER.clone().multiplyScalar(0.9);
          } else {
            fillColor = COLOR_ENEMY.clone().multiplyScalar(0.9);
          }

          const borderColor = ownerId ? COLOR_BORDER_OWNED.clone() : new THREE.Color(0x334455);

          // Fill instance
          dummy.position.copy(worldPos);
          dummy.lookAt(worldPos.clone().multiplyScalar(2));
          dummy.scale.setScalar(subFillSize);
          dummy.updateMatrix();
          fillMeshRef.current.setMatrixAt(instanceIdx, dummy.matrix);
          fillMeshRef.current.setColorAt(instanceIdx, fillColor);

          // Border instance
          dummy.scale.setScalar(subBorderSize);
          dummy.updateMatrix();
          borderMeshRef.current.setMatrixAt(instanceIdx, dummy.matrix);
          borderMeshRef.current.setColorAt(instanceIdx, borderColor);

          instanceIdx++;
        }
      }
    }

    // Hide unused instances
    const zeroScale = new THREE.Matrix4().makeScale(0, 0, 0);
    const blackColor = new THREE.Color(0, 0, 0);
    for (let i = instanceIdx; i < MAX_SUB_TILES; i++) {
      fillMeshRef.current.setMatrixAt(i, zeroScale);
      borderMeshRef.current.setMatrixAt(i, zeroScale);
      fillMeshRef.current.setColorAt(i, blackColor);
      borderMeshRef.current.setColorAt(i, blackColor);
    }

    fillMeshRef.current.instanceMatrix.needsUpdate   = true;
    borderMeshRef.current.instanceMatrix.needsUpdate = true;
    if (fillMeshRef.current.instanceColor)   fillMeshRef.current.instanceColor.needsUpdate   = true;
    if (borderMeshRef.current.instanceColor) borderMeshRef.current.instanceColor.needsUpdate = true;
    fillMeshRef.current.count   = instanceIdx;
    borderMeshRef.current.count = instanceIdx;
  }, [parcels, currentPlayerId, playerMap, dummy, subFillSize, subBorderSize, subSpacing]);

  return (
    <>
      <instancedMesh ref={borderMeshRef} args={[undefined, undefined, MAX_SUB_TILES]}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.70}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={fillMeshRef} args={[undefined, undefined, MAX_SUB_TILES]}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.85}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  );
}

function GlobeTerrain() {
  const albedoTex = useLoader(THREE.TextureLoader, "/textures/planets/ascendancy/planet_albedo.png");

  useEffect(() => {
    if (albedoTex) albedoTex.colorSpace = THREE.SRGBColorSpace;
  }, [albedoTex]);

  const terrainUniforms = useMemo(() => ({
    albedoMap: { value: albedoTex },
  }), [albedoTex]);

  const terrainVert = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const terrainFrag = `
    uniform sampler2D albedoMap;
    varying vec2 vUv;

    // Boost colour saturation (renamed to avoid clash with GLSL built-in 'saturate')
    vec3 boostSat(vec3 c, float amount) {
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      return mix(vec3(lum), c, amount);
    }

    void main() {
      vec4 dayCol = texture2D(albedoMap, vUv);
      // Fully lit — no dark side, terrain visible everywhere
      gl_FragColor = vec4(boostSat(dayCol.rgb, 1.25) * 1.05, 1.0);
    }
  `;

  return (
    <>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 128, 64]} />
        <shaderMaterial
          uniforms={terrainUniforms}
          vertexShader={terrainVert}
          fragmentShader={terrainFrag}
        />
      </mesh>
    </>
  );
}

function PlayerLegend() {
  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-md backdrop-blur-md"
        style={{ background: "#00ff6a12", border: "1px solid #00ff6a30" }}>
        <div className="w-2 h-2 rounded-full" style={{ background: "#00ff6a", boxShadow: "0 0 6px #00ff6a" }} />
        <span className="text-[10px] font-mono tracking-widest uppercase text-green-400">YOU</span>
      </div>
    </div>
  );
}

interface ParcelHUDProps {
  parcel: LandParcel;
  currentPlayerId: string | null;
  playerMap: Map<string, Player>;
  onAttack?: () => void;
  onMine?: () => void;
  onBuild?: () => void;
  onParcelSelect: (id: string) => void;
}

function ParcelHUD({ parcel, currentPlayerId, playerMap, onAttack, onMine, onBuild, onParcelSelect }: ParcelHUDProps) {
  const isPlayer = parcel.ownerId === currentPlayerId;

  const accentColor = isPlayer ? "#00ff6a"
    : parcel.ownerId ? "#ff6e40"
    : "#4fc3f7";

  const statusLabel = isPlayer ? "SECURED"
    : parcel.ownerId ? "HOSTILE"
    : "UNCLAIMED";

  return (
  <div className="absolute z-30 pointer-events-none"
    style={{
      bottom: "calc(50% + 20px)",
      left: "50%",
      transform: "translateX(-50%)",
      width: "min(320px, calc(100vw - 32px))",
      maxWidth: "100%",
    }}
  >
      <div
        className="pointer-events-auto flex flex-col gap-3 rounded-2xl p-4 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: "rgba(4, 8, 20, 0.88)",
          border: `1px solid ${accentColor}40`,
          boxShadow: `0 0 40px ${accentColor}18, inset 0 1px 0 ${accentColor}20`,
        }}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[9px] tracking-[0.3em] uppercase mb-0.5" style={{ color: `${accentColor}99` }}>
              Plot #{parcel.plotId}
            </div>
            <div className="text-base font-mono font-bold uppercase tracking-wider text-white">
              {parcel.biome} Zone
            </div>
          </div>
          <div
            className="text-[9px] px-2 py-1 rounded tracking-widest uppercase font-mono"
            style={{ color: accentColor, background: `${accentColor}15`, border: `1px solid ${accentColor}40` }}
          >
            {statusLabel}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Defense", value: parcel.defenseLevel },
            { label: "Richness", value: parcel.richness },
            { label: "FRNTR/d", value: parcel.frontierPerDay?.toFixed(1) ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg py-1.5"
              style={{ background: `${accentColor}0a`, border: `1px solid ${accentColor}18` }}>
              <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: `${accentColor}70` }}>{label}</div>
              <div className="text-sm font-mono font-bold" style={{ color: accentColor }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {isPlayer ? (
            <>
              <button onClick={onMine}
                className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[11px] font-mono uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
                style={{ background: "#00ff6a12", border: "1px solid #00ff6a35", color: "#00ff6a" }}>
                <Pickaxe className="w-3.5 h-3.5" /> Extract
              </button>
              <button onClick={onBuild}
                className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[11px] font-mono uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
                style={{ background: "#4fc3f712", border: "1px solid #4fc3f735", color: "#4fc3f7" }}>
                <HardHat className="w-3.5 h-3.5" /> Develop
              </button>
            </>
          ) : parcel.ownerId ? (
            <button onClick={onAttack}
              className="col-span-2 flex items-center justify-center gap-2 h-10 rounded-lg text-[11px] font-mono uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
              style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}50`, color: accentColor, boxShadow: `0 0 20px ${accentColor}20` }}>
              <Sword className="w-4 h-4" /> Initiate Invasion
            </button>
          ) : (
            <button onClick={() => onParcelSelect(parcel.id)}
              className="col-span-2 flex items-center justify-center gap-2 h-10 rounded-lg text-[11px] font-mono uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
              style={{ background: "#4fc3f712", border: "1px solid #4fc3f740", color: "#4fc3f7" }}>
              <Zap className="w-4 h-4" /> Acquire Territory
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface SceneProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  onPlotSelect: (parcelId: string) => void;
  controlsRef: React.RefObject<OrbitControlsImpl>;
  targetLat: number | null;
  targetLng: number | null;
  battles: Battle[];
  livePulses: LivePulse[];
  orbitalEvents: OrbitalEvent[];
  replayEvents?: WorldEvent[];
  replayTime?: number;
  replayVisibleTypes?: Set<string>;
  streamMode?: boolean;
}

function Scene({ parcels, players, currentPlayerId, selectedPlotId, onPlotSelect, controlsRef, targetLat, targetLng, battles, livePulses, orbitalEvents, replayEvents, replayTime, replayVisibleTypes, streamMode }: SceneProps) {
  // Build hotspot list from active battles for stream camera
  const battleHotspots = useMemo(() => {
    if (!streamMode) return [];
    const parcelMap = new Map(parcels.map(p => [p.id, p]));
    return battles
      .filter(b => b.status === "pending")
      .map(b => parcelMap.get(b.targetParcelId))
      .filter((p): p is LandParcel => !!p)
      .map(p => ({ lat: p.lat, lng: p.lng }));
  }, [streamMode, battles, parcels]);

  return (
    <>
      <CameraController
        targetLat={targetLat}
        targetLng={targetLng}
        controlsRef={controlsRef}
        streamMode={streamMode}
        battleHotspots={battleHotspots}
      />
      <StarField />
      <AtmosphereGlow />
      <ambientLight intensity={1.8} color="#d8eaff" />
      <directionalLight position={[8, 4, 5]}  intensity={1.6} color="#fff4e0" />
      <directionalLight position={[-6, -2, -4]} intensity={1.2} color="#c0d4ff" />
      <directionalLight position={[0,  8, 0]}  intensity={0.7} color="#e0eeff" />
      <group>
        <GlobeTerrain />
        <PlotOverlay
          parcels={parcels}
          players={players}
          currentPlayerId={currentPlayerId}
          selectedPlotId={selectedPlotId}
          onPlotSelect={onPlotSelect}
        />
        <SubParcelOverlay
          parcels={parcels}
          players={players}
          currentPlayerId={currentPlayerId}
        />
        {replayEvents && replayEvents.length > 0 && replayVisibleTypes && replayTime !== undefined && (
          <GlobeEventOverlays
            events={replayEvents}
            replayTime={replayTime}
            visibleTypes={replayVisibleTypes}
          />
        )}
      </group>
      <BattleArcs
        battles={battles}
        parcels={parcels}
        players={players}
        currentPlayerId={currentPlayerId}
      />
      <MiningPulseLayer pulses={livePulses} />
      <OrbitalZoneLayer events={orbitalEvents} />
      <SatelliteOrbitLayer players={players} />
      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.25}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
      <OrbitControls
        ref={controlsRef as any}
        enablePan={false}
        enableDamping={true}
        dampingFactor={0.08}
        rotateSpeed={0.45}
        zoomSpeed={0.9}
        minDistance={GLOBE_RADIUS * 1.8}
        maxDistance={GLOBE_RADIUS * 6.0}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
        makeDefault
      />
    </>
  );
}

interface GlobeHUDProps {
  activeBattleCount: number;
  replayTime?: number;
}

function GlobeHUD({ activeBattleCount, replayTime }: GlobeHUDProps) {
  const now = replayTime ?? Date.now();
  const utc = new Date(now).toISOString().slice(11, 19) + " UTC";
  const lat  = "22.14°N";
  const lng  = "045°21'37.73\"E";
  const alt  = "3745115M";
  const gsd  = "1404.42M";

  return (
    <>
      {/* Bottom-left telemetry */}
      <div
        className="absolute bottom-28 left-4 z-20 pointer-events-none select-none"
        style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", lineHeight: "1.8", color: "rgba(0,229,255,0.55)" }}
      >
        <div>38P NS 3942 7798</div>
        <div>{lat} {lng}</div>
      </div>

      {/* Bottom-right telemetry */}
      <div
        className="absolute bottom-28 right-4 z-20 pointer-events-none select-none text-right"
        style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", lineHeight: "1.8", color: "rgba(0,229,255,0.55)" }}
      >
        <div>GSD: {gsd} NIIR</div>
        <div>ALT: {alt} SUN: -20</div>
      </div>

      {/* Top-right: REC indicator + timestamp */}
      <div
        className="absolute top-4 right-4 z-20 pointer-events-none select-none flex items-center gap-2"
        style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", color: "rgba(0,229,255,0.5)" }}
      >
        {activeBattleCount > 0 && (
          <span style={{ color: "#ff1744", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#ff1744",
              display: "inline-block", animation: "pulse 1.2s infinite"
            }} />
            REC
          </span>
        )}
        <span>{utc}</span>
      </div>

      {/* Top-left: classification watermark (offset right of faction legend) */}
      <div
        className="absolute top-4 left-20 z-20 pointer-events-none select-none"
        style={{ fontFamily: "monospace", fontSize: 8, letterSpacing: "0.25em", color: "rgba(0,229,255,0.35)" }}
      >
        <div>CRET // SI-TK // NOFORN</div>
        <div>176 OPS-4179</div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Compass + Zoom overlay — lives outside the Canvas so it's pure HTML/CSS.
// Polls OrbitControls via rAF to keep bearing in sync without React re-renders.
// ---------------------------------------------------------------------------
function GlobeCompass({ controlsRef }: { controlsRef: { current: OrbitControlsImpl } }) {
  const needleRef = useRef<HTMLDivElement>(null);
  const labelRef  = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const ctrl = controlsRef.current;
      if (ctrl && needleRef.current && labelRef.current) {
        const az  = ctrl.getAzimuthalAngle(); // radians, 0 = positive-Z axis
        const deg = ((az * 180 / Math.PI) % 360 + 360) % 360;
        needleRef.current.style.transform = `rotate(${deg}deg)`;
        const dirs = ["N","NE","E","SE","S","SW","W","NW"];
        labelRef.current.textContent = dirs[Math.round(deg / 45) % 8];
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controlsRef]);

  return (
    <div
      style={{
        position: "absolute", top: 12, right: 12, zIndex: 30,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        pointerEvents: "none", userSelect: "none",
      }}
    >
      {/* Compass rose */}
      <div style={{ position: "relative", width: 44, height: 44 }}>
        {/* Cardinal labels — fixed */}
        {(["N","E","S","W"] as const).map((d, i) => {
          const angle = i * 90;
          const r = 16;
          const x = 22 + r * Math.sin(angle * Math.PI / 180);
          const y = 22 - r * Math.cos(angle * Math.PI / 180);
          return (
            <span key={d} style={{
              position: "absolute", left: x, top: y,
              transform: "translate(-50%,-50%)",
              fontSize: 8, fontFamily: "monospace", fontWeight: "bold", letterSpacing: "0.05em",
              color: d === "N" ? "#ff4444" : "rgba(0,229,255,0.7)",
            }}>{d}</span>
          );
        })}
        {/* Rotating needle */}
        <div ref={needleRef} style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          transformOrigin: "center",
        }}>
          <div style={{
            width: 2, height: 20, borderRadius: 1,
            background: "linear-gradient(to bottom, #ff4444 50%, rgba(0,229,255,0.5) 50%)",
          }} />
        </div>
        {/* Center dot */}
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          width: 4, height: 4, borderRadius: "50%",
          background: "rgba(0,229,255,0.9)",
          transform: "translate(-50%,-50%)",
        }} />
      </div>
      <span ref={labelRef} style={{
        fontSize: 8, fontFamily: "monospace", letterSpacing: "0.2em",
        color: "rgba(0,229,255,0.7)",
      }}>N</span>
    </div>
  );
}

interface PlanetGlobeProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
  selectedParcelId: string | null;
  onParcelSelect: (parcelId: string) => void;
  onAttack?: () => void;
  onMine?: () => void;
  onBuild?: () => void;
  className?: string;
  battles?: Battle[];
  livePulses?: LivePulse[];
  orbitalEvents?: OrbitalEvent[];
  replayEvents?: WorldEvent[];
  replayTime?: number;
  replayVisibleTypes?: Set<string>;
  activeBattleCount?: number;
  /** Enable stream mode: fullscreen hotspot camera + no HUD chrome. */
  streamMode?: boolean;
}

export default function PlanetGlobe({
  parcels,
  players,
  currentPlayerId,
  selectedParcelId,
  onParcelSelect,
  onAttack,
  onMine,
  onBuild,
  className,
  battles = [],
  livePulses = [],
  orbitalEvents = [],
  replayEvents,
  replayTime,
  replayVisibleTypes,
  activeBattleCount = 0,
  streamMode = false,
}: PlanetGlobeProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null!);

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const selectedParcel = useMemo(
    () => parcels.find(p => p.id === selectedParcelId),
    [parcels, selectedParcelId]
  );

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%", background: "#010306" }}>
      <Canvas
        camera={{ position: [0, 0, GLOBE_RADIUS * 3.8], fov: 45 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        style={{ background: "#010306", touchAction: "none" }}
      >
        <Scene
          parcels={parcels}
          players={players}
          currentPlayerId={currentPlayerId}
          selectedPlotId={selectedParcelId}
          onPlotSelect={onParcelSelect}
          controlsRef={controlsRef}
          targetLat={selectedParcel?.lat ?? null}
          targetLng={selectedParcel?.lng ?? null}
          battles={battles}
          livePulses={livePulses}
          orbitalEvents={orbitalEvents}
          replayEvents={replayEvents}
          replayTime={replayTime}
          replayVisibleTypes={replayVisibleTypes}
          streamMode={streamMode}
        />
      </Canvas>

      <GlobeHUD activeBattleCount={activeBattleCount} replayTime={replayTime} />

      <GlobeCompass controlsRef={controlsRef} />

      {/* Zoom buttons */}
      <div style={{
        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
        zIndex: 30, display: "flex", flexDirection: "column", gap: 4,
      }}>
        {(["+", "−"] as const).map((label, i) => (
          <button
            key={label}
            onClick={() => {
              const cam = controlsRef.current?.object;
              if (!cam) return;
              const d = (cam as THREE.PerspectiveCamera).position.length();
              const next = i === 0
                ? Math.max(GLOBE_RADIUS * 1.8, d * 0.82)
                : Math.min(GLOBE_RADIUS * 6.0, d * 1.20);
              (cam as THREE.PerspectiveCamera).position.setLength(next);
              controlsRef.current.update();
            }}
            style={{
              width: 32, height: 32,
              background: "rgba(4,8,20,0.7)",
              border: "1px solid rgba(79,195,247,0.3)",
              borderRadius: 6, color: "rgba(0,229,255,0.85)",
              fontSize: 18, lineHeight: 1, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "monospace",
            }}
          >{label}</button>
        ))}
      </div>

      <PlayerLegend />

      {selectedParcel && (
        <ParcelHUD
          parcel={selectedParcel}
          currentPlayerId={currentPlayerId}
          playerMap={playerMap}
          onAttack={onAttack}
          onMine={onMine}
          onBuild={onBuild}
          onParcelSelect={onParcelSelect}
        />
      )}

      <button
        onClick={() => controlsRef.current?.reset()}
        className="absolute bottom-24 right-4 z-20 backdrop-blur-xl text-white/50 hover:text-white/90 px-3 py-2 rounded-lg transition-all"
        style={{ background: "rgba(4, 8, 20, 0.6)", border: "1px solid rgba(79, 195, 247, 0.15)", fontSize: 10, fontFamily: "monospace", letterSpacing: "0.2em" }}
      >
        RESET
      </button>

    </div>
  );
}
