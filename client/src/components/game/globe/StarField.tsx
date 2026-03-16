import * as THREE from "three";
import { useMemo } from "react";

const MAIN_COUNT   = 10000;
const BRIGHT_COUNT = 180;

/** Dual-layer star field: 10k coloured background stars + 180 prominent bright stars. */
export function StarField() {
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
