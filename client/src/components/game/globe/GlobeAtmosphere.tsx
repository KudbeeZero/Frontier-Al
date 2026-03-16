import * as THREE from "three";
import { useMemo } from "react";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";

/**
 * Three concentric BackSide spheres: a tight electric-blue rim, a mid cyan
 * haze, and a wide purple-indigo corona — all additive, depthWrite off.
 */
export function GlobeAtmosphere() {
  const innerUniforms = useMemo(() => ({
    glowColor:   { value: new THREE.Color(0.1, 0.55, 1.0) },
    coefficient: { value: 0.55 },
    power:       { value: 2.8 },
  }), []);

  const midUniforms = useMemo(() => ({
    glowColor:   { value: new THREE.Color(0.04, 0.75, 1.0) },
    coefficient: { value: 0.42 },
    power:       { value: 4.2 },
  }), []);

  const outerUniforms = useMemo(() => ({
    glowColor:   { value: new THREE.Color(0.18, 0.08, 0.6) },
    coefficient: { value: 0.32 },
    power:       { value: 6.0 },
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
      gl_FragColor = vec4(glowColor, intensity * 0.85);
    }
  `;

  return (
    <>
      {/* Inner tight rim — electric blue at planet limb */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[GLOBE_RADIUS * 1.04, 64, 32]} />
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

      {/* Mid cyan haze */}
      <mesh renderOrder={-2}>
        <sphereGeometry args={[GLOBE_RADIUS * 1.12, 64, 32]} />
        <shaderMaterial
          uniforms={midUniforms}
          vertexShader={vertShader}
          fragmentShader={fragShader}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer wide purple-indigo corona */}
      <mesh renderOrder={-3}>
        <sphereGeometry args={[GLOBE_RADIUS * 1.28, 64, 32]} />
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
