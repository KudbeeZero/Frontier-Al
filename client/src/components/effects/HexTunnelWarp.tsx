import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";

const RING_COUNT = 120;
const STREAK_COUNT = 80;
const Z_NEAR = -2;
const Z_FAR = -120;
const SPEED = 18;
const HEX_COLOR = new THREE.Color("#00e5ff");
const STREAK_COLOR = new THREE.Color("#00aaff");

interface HexTunnelWarpProps {
  enabled: boolean;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

export default function HexTunnelWarp({ enabled }: HexTunnelWarpProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null!);

  // Per-ring state stored in refs so no React renders are triggered
  const ringZ = useRef<Float32Array>(null!);
  const ringRadius = useRef<Float32Array>(null!);
  const ringRotY = useRef<Float32Array>(null!);
  const ringOpacity = useRef<Float32Array>(null!);

  const streakZ = useRef<Float32Array>(null!);
  const streakAngle = useRef<Float32Array>(null!);
  const streakRadius = useRef<Float32Array>(null!);

  // Hex ring instanced mesh
  const ringMesh = useRef<THREE.InstancedMesh>(null!);
  const streakMesh = useRef<THREE.InstancedMesh>(null!);

  // Shared transform scratch
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Geometries & materials
  const ringGeo = useMemo(() => {
    // CylinderGeometry with 6 radial segments = hexagonal cross-section
    // Very thin height, open-ended → looks like a hex ring
    const g = new THREE.CylinderGeometry(1, 1, 0.08, 6, 1, true);
    return g;
  }, []);

  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: HEX_COLOR,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        wireframe: false,
      }),
    []
  );

  const streakGeo = useMemo(() => {
    // Thin elongated box oriented along Z
    return new THREE.BoxGeometry(0.015, 0.015, 6);
  }, []);

  const streakMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: STREAK_COLOR,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  // Initialise per-instance data once
  useMemo(() => {
    const rz = new Float32Array(RING_COUNT);
    const rr = new Float32Array(RING_COUNT);
    const ry = new Float32Array(RING_COUNT);
    const ro = new Float32Array(RING_COUNT);
    for (let i = 0; i < RING_COUNT; i++) {
      const t = i / RING_COUNT;
      rz[i] = Z_FAR + t * (Z_NEAR - Z_FAR);
      rr[i] = 2.5 + seededRandom(i * 7.3) * 4.5;
      ry[i] = seededRandom(i * 3.1) * Math.PI;
      ro[i] = 0.15 + seededRandom(i * 11.7) * 0.5;
    }
    ringZ.current = rz;
    ringRadius.current = rr;
    ringRotY.current = ry;
    ringOpacity.current = ro;

    const sz = new Float32Array(STREAK_COUNT);
    const sa = new Float32Array(STREAK_COUNT);
    const sr = new Float32Array(STREAK_COUNT);
    for (let i = 0; i < STREAK_COUNT; i++) {
      const t = i / STREAK_COUNT;
      sz[i] = Z_FAR + t * (Z_NEAR - Z_FAR);
      sa[i] = seededRandom(i * 5.9) * Math.PI * 2;
      sr[i] = 1.0 + seededRandom(i * 2.3) * 5.0;
    }
    streakZ.current = sz;
    streakAngle.current = sa;
    streakRadius.current = sr;
  }, []);

  useFrame((_state, delta) => {
    if (!enabled) return;
    const group = groupRef.current;
    if (!group) return;

    // Lock group to camera each frame so effect is always in front of viewer
    group.position.copy(camera.position);
    group.quaternion.copy(camera.quaternion);

    const rm = ringMesh.current;
    const sm = streakMesh.current;
    const rz = ringZ.current;
    const rr = ringRadius.current;
    const ry = ringRotY.current;
    const ro = ringOpacity.current;

    const advance = SPEED * delta;

    // Update rings
    if (rm) {
      for (let i = 0; i < RING_COUNT; i++) {
        rz[i] += advance;
        if (rz[i] > Z_NEAR) {
          rz[i] = Z_FAR + (seededRandom(i + performance.now() * 0.001) * 5);
          rr[i] = 2.5 + seededRandom(i * 7.3 + performance.now() * 0.0001) * 4.5;
          ry[i] = seededRandom(i * 3.1 + performance.now() * 0.0001) * Math.PI;
          ro[i] = 0.15 + seededRandom(i * 11.7 + performance.now() * 0.0001) * 0.5;
        }
        dummy.position.set(0, 0, rz[i]);
        dummy.rotation.set(Math.PI / 2, ry[i], 0);
        dummy.scale.setScalar(rr[i]);
        dummy.updateMatrix();
        rm.setMatrixAt(i, dummy.matrix);
      }
      rm.instanceMatrix.needsUpdate = true;
    }

    // Update streaks
    const sz = streakZ.current;
    const sa = streakAngle.current;
    const sr = streakRadius.current;

    if (sm) {
      for (let i = 0; i < STREAK_COUNT; i++) {
        sz[i] += advance;
        if (sz[i] > Z_NEAR) {
          sz[i] = Z_FAR + (seededRandom(i * 1.7 + performance.now() * 0.001) * 8);
          sa[i] = seededRandom(i * 5.9 + performance.now() * 0.0001) * Math.PI * 2;
          sr[i] = 1.0 + seededRandom(i * 2.3 + performance.now() * 0.0001) * 5.0;
        }
        const x = Math.cos(sa[i]) * sr[i];
        const y = Math.sin(sa[i]) * sr[i];
        dummy.position.set(x, y, sz[i]);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        sm.setMatrixAt(i, dummy.matrix);
      }
      sm.instanceMatrix.needsUpdate = true;
    }
  });

  if (!enabled) return null;

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={ringMesh}
        args={[ringGeo, ringMat, RING_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={streakMesh}
        args={[streakGeo, streakMat, STREAK_COUNT]}
        frustumCulled={false}
      />
    </group>
  );
}
