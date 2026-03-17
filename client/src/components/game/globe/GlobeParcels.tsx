/**
 * GlobeParcels — InstancedMesh rendering of all 21,000 parcel tiles.
 * Handles hover, selection state, battle pulse, and biome coloring.
 *
 * SubParcelOverlay — 3×3 sub-tile grid for subdivided macro-plots.
 */

import * as THREE from "three";
import { useRef, useMemo, useCallback, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import type { LandParcel, Player } from "@shared/schema";
import {
  GLOBE_RADIUS,
  PLOT_COUNT,
  COLOR_PLAYER,
  COLOR_BATTLE,
  COLOR_SELECTED,
  COLOR_BORDER_OWNED,
  COLOR_BORDER_UNOWNED,
  COLOR_SUBDIVIDED,
  FILL_SIZE,
  BORDER_SIZE,
  SUB_FILL_SIZE,
  SUB_BORDER_SIZE,
  SUB_SPACING,
  MAX_SUB_TILES,
} from "@/lib/globe/globeConstants";
import {
  generateFibonacciSphere,
  latLngToVec3,
  getPlotColor,
  getPlotSizeVariant,
  tangentFrame,
} from "@/lib/globe/globeUtils";

// ── PlotOverlay ────────────────────────────────────────────────────────────────

interface PlotOverlayProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  onPlotSelect: (parcelId: string) => void;
}

export function PlotOverlay({ parcels, currentPlayerId, selectedPlotId, onPlotSelect }: PlotOverlayProps) {
  const fillMeshRef   = useRef<THREE.InstancedMesh>(null!);
  const borderMeshRef = useRef<THREE.InstancedMesh>(null!);
  const readyRef      = useRef(false);
  const pulseRef      = useRef(0);
  const hoveredIndexRef = useRef<number | null>(null);
  const prevHoveredRef  = useRef<number | null>(null);

  const plotCoords = useMemo(() => generateFibonacciSphere(PLOT_COUNT), []);

  const plotIdToParcel = useMemo(() => {
    const m = new Map<number, LandParcel>();
    parcels.forEach(p => m.set(p.plotId, p));
    return m;
  }, [parcels]);

  const plotIdToParcelRef = useRef(plotIdToParcel);
  plotIdToParcelRef.current = plotIdToParcel;

  const parcelsRevision = useMemo(() => {
    return parcels
      .filter(p => p.ownerId || p.activeBattleId || p.isSubdivided)
      .map(p => `${p.plotId}:${p.ownerId ?? ""}:${p.activeBattleId ?? ""}:${Number(!!p.isSubdivided)}`)
      .sort()
      .join("|");
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

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const fillPositions3D = useMemo(() => {
    return plotCoords.map(c => latLngToVec3(c.lat, c.lng, GLOBE_RADIUS * 1.018));
  }, [plotCoords]);

  const borderPositions3D = useMemo(() => {
    return plotCoords.map(c => latLngToVec3(c.lat, c.lng, GLOBE_RADIUS * 1.012));
  }, [plotCoords]);

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

  useFrame((_, delta) => {
    if (!fillMeshRef.current || !borderMeshRef.current || !readyRef.current) return;
    pulseRef.current += delta * 2.5;

    const currentHovered = hoveredIndexRef.current;
    const prevHovered    = prevHoveredRef.current;
    prevHoveredRef.current = currentHovered;

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
      const isSubdivided = !!(parcel as LandParcel)?.isSubdivided;

      const fillPos   = fillPositions3D[i];
      const borderPos = borderPositions3D[i];

      let fillColor: THREE.Color;

      if (isSelected && isHovered) {
        const pulse = 1.0 + Math.sin(pulseRef.current * 3) * 0.12;
        fillColor = COLOR_SELECTED.clone().multiplyScalar(pulse * 1.1);
      } else if (isSelected) {
        const pulse = 1.0 + Math.sin(pulseRef.current * 2.5) * 0.15;
        fillColor = COLOR_SELECTED.clone().multiplyScalar(pulse);
      } else if (isHovered) {
        fillColor = COLOR_SELECTED.clone().multiplyScalar(0.65);
      } else if (parcel?.activeBattleId) {
        const bp = 0.75 + Math.sin(pulseRef.current * 3) * 0.25;
        fillColor = COLOR_BATTLE.clone().multiplyScalar(bp);
      } else if (isSubdivided) {
        fillColor = COLOR_SUBDIVIDED.clone();
      } else {
        fillColor = getPlotColor(parcel, currentPlayerId);
      }

      const borderColor = isSelected
        ? COLOR_SELECTED.clone().multiplyScalar(1.5)
        : isHovered
          ? COLOR_SELECTED.clone()
          : isOwned
            ? COLOR_BORDER_OWNED.clone()
            : COLOR_BORDER_UNOWNED.clone();

      const fillScale   = isSelected ? 1.12 : isHovered ? 1.06 : isOwned ? 1.0 : 0.85;
      const borderScale = isSelected ? 1.15 : isHovered ? 1.08 : isOwned ? 1.0 : 0.85;

      applyInstance(fillMeshRef.current,   i, fillPos,   FILL_SIZE   * sizeVar * fillScale,   fillColor);
      applyInstance(borderMeshRef.current, i, borderPos, BORDER_SIZE * sizeVar * borderScale, borderColor);

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

    const idToParcel = plotIdToParcelRef.current;
    const t0 = performance.now();

    for (let i = 0; i < plotCoords.length; i++) {
      const coord  = plotCoords[i];
      const parcel = idToParcel.get(coord.plotId);
      const sizeVar = getPlotSizeVariant(coord.plotId);

      const fillPos   = fillPositions3D[i];
      const borderPos = borderPositions3D[i];

      const isOwned      = !!parcel?.ownerId;
      const isSelected   = parcel?.id === selectedPlotId;
      const isSubdivided = !!(parcel as LandParcel)?.isSubdivided;

      let fillColor: THREE.Color;
      if (isSelected) {
        fillColor = COLOR_SELECTED.clone();
      } else if (parcel?.activeBattleId) {
        fillColor = COLOR_BATTLE.clone();
      } else if (isSubdivided) {
        fillColor = COLOR_SUBDIVIDED.clone();
      } else {
        fillColor = getPlotColor(parcel, currentPlayerId);
      }

      const borderColor = isSelected
        ? COLOR_SELECTED.clone().multiplyScalar(1.5)
        : isOwned
          ? COLOR_BORDER_OWNED.clone()
          : COLOR_BORDER_UNOWNED.clone();

      const fillScale   = isSelected ? 1.12 : isOwned ? 1.0 : 0.85;
      const borderScale = isSelected ? 1.15 : isOwned ? 1.0 : 0.85;
      applyInstance(fillMeshRef.current,   i, fillPos,   FILL_SIZE   * sizeVar * fillScale,   fillColor);
      applyInstance(borderMeshRef.current, i, borderPos, BORDER_SIZE * sizeVar * borderScale, borderColor);
    }

    fillMeshRef.current.instanceMatrix.needsUpdate   = true;
    borderMeshRef.current.instanceMatrix.needsUpdate = true;
    if (fillMeshRef.current.instanceColor)   fillMeshRef.current.instanceColor.needsUpdate   = true;
    if (borderMeshRef.current.instanceColor) borderMeshRef.current.instanceColor.needsUpdate = true;

    if (idToParcel.size > 0) readyRef.current = true;
    console.log(`[PLOT-OVERLAY] full update: ${(performance.now() - t0).toFixed(1)}ms (${parcelsRevision.split("|").length} active parcels)`);
  }, [parcelsRevision, currentPlayerId, selectedPlotId, plotCoords,
      fillPositions3D, borderPositions3D]);

  const handlePointerMove = useCallback((e: any) => {
    const p = e.point as THREE.Vector3;
    const len = p.length();
    const scale = len > 0 ? GLOBE_RADIUS / len : 1;
    hoveredIndexRef.current = nearestPlot(p.x * scale, p.y * scale, p.z * scale);
  }, [nearestPlot]);

  const handlePointerLeave = useCallback(() => {
    hoveredIndexRef.current = null;
  }, []);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    if ((e.delta as number) > 6) return;
    const p = e.point as THREE.Vector3;
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
      {/* Invisible coverage sphere — catches every pointer event reliably */}
      <mesh
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        <sphereGeometry args={[GLOBE_RADIUS * 1.01, 48, 24]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} side={THREE.FrontSide} />
      </mesh>

      {/* Border frame — thin square outline for grid tile look */}
      <instancedMesh ref={borderMeshRef} args={[undefined, undefined, PLOT_COUNT]} renderOrder={1}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.75}
          depthWrite={false}
          depthTest={false}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Fill layer — square tile */}
      <instancedMesh ref={fillMeshRef} args={[undefined, undefined, PLOT_COUNT]} renderOrder={2}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.88}
          depthWrite={false}
          depthTest={false}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  );
}

// ── SubParcelOverlay ───────────────────────────────────────────────────────────

interface SubParcelOverlayProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
}

/** Renders a 3×3 grid of 9 sub-tiles for every subdivided macro-plot. */
export function SubParcelOverlay({ parcels, currentPlayerId }: SubParcelOverlayProps) {
  const fillMeshRef   = useRef<THREE.InstancedMesh>(null!);
  const borderMeshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

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

          const offsetRight = (col - 1) * SUB_SPACING;
          const offsetUp    = (1 - row) * SUB_SPACING;

          const worldPos = center.clone()
            .addScaledVector(right, offsetRight)
            .addScaledVector(up, offsetUp)
            .normalize()
            .multiplyScalar(GLOBE_RADIUS * 1.007);

          let fillColor: THREE.Color;
          if (!ownerId) {
            fillColor = new THREE.Color(0x223344);
          } else if (currentPlayerId && ownerId === currentPlayerId) {
            fillColor = COLOR_PLAYER.clone().multiplyScalar(0.9);
          } else {
            fillColor = new THREE.Color("#ff4400").multiplyScalar(0.9);
          }

          const borderColor = ownerId ? new THREE.Color("#ffffff") : new THREE.Color(0x334455);

          dummy.position.copy(worldPos);
          dummy.lookAt(worldPos.clone().multiplyScalar(2));
          dummy.scale.setScalar(SUB_FILL_SIZE);
          dummy.updateMatrix();
          fillMeshRef.current.setMatrixAt(instanceIdx, dummy.matrix);
          fillMeshRef.current.setColorAt(instanceIdx, fillColor);

          dummy.scale.setScalar(SUB_BORDER_SIZE);
          dummy.updateMatrix();
          borderMeshRef.current.setMatrixAt(instanceIdx, dummy.matrix);
          borderMeshRef.current.setColorAt(instanceIdx, borderColor);

          instanceIdx++;
        }
      }
    }

    fillMeshRef.current.instanceMatrix.needsUpdate   = true;
    borderMeshRef.current.instanceMatrix.needsUpdate = true;
    if (fillMeshRef.current.instanceColor)   fillMeshRef.current.instanceColor.needsUpdate   = true;
    if (borderMeshRef.current.instanceColor) borderMeshRef.current.instanceColor.needsUpdate = true;
    fillMeshRef.current.count   = instanceIdx;
    borderMeshRef.current.count = instanceIdx;
  }, [parcels, currentPlayerId, dummy]);

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
