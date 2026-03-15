import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { latLngToVec3, GLOBE_RADIUS } from "./globeUtils";

// ── MiningPulseLayer ──────────────────────────────────────────────────────────
// Renders short-lived expanding ring pulses at mined parcel locations.
// Each pulse lives for PULSE_DURATION ms then is removed by GameLayout.

export interface LivePulse {
  id: string;
  lat: number;
  lng: number;
  startMs: number;
}

const PULSE_DURATION = 600;

interface SinglePulseProps {
  pulse: LivePulse;
}

function SinglePulse({ pulse }: SinglePulseProps) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  const pos    = useMemo(() => latLngToVec3(pulse.lat, pulse.lng, GLOBE_RADIUS * 1.005), [pulse.lat, pulse.lng]);
  const lookAt = useMemo(() => pos.clone().multiplyScalar(2), [pos]);

  useFrame(() => {
    const elapsed = Date.now() - pulse.startMs;
    const t = Math.min(elapsed / PULSE_DURATION, 1);

    const scale   = 1 + t * 4;
    const opacity = Math.pow(1 - t, 1.5);

    if (ringRef.current) {
      ringRef.current.scale.setScalar(scale);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.9;
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + t * 1.8);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.5;
    }
  });

  return (
    <group position={pos}>
      <mesh ref={ringRef} onUpdate={self => self.lookAt(lookAt)}>
        <ringGeometry args={[0.018, 0.030, 32]} />
        <meshBasicMaterial
          color="#00ff6a"
          transparent
          opacity={0.9}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={glowRef} onUpdate={self => self.lookAt(lookAt)}>
        <circleGeometry args={[0.018, 24]} />
        <meshBasicMaterial
          color="#80ffb0"
          transparent
          opacity={0.5}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

interface MiningPulseLayerProps {
  pulses: LivePulse[];
}

export function MiningPulseLayer({ pulses }: MiningPulseLayerProps) {
  if (pulses.length === 0) return null;
  return (
    <>
      {pulses.map(pulse => (
        <SinglePulse key={pulse.id} pulse={pulse} />
      ))}
    </>
  );
}
