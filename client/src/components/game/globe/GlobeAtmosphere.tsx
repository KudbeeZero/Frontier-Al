import * as THREE from "three";
import { useMemo } from "react";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";

/**
 * Two concentric BackSide spheres with additive blending create a faint blue
 * atmospheric rim — occluded by the planet at the center, visible at the limb.
 */
export function GlobeAtmosphere() {
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
