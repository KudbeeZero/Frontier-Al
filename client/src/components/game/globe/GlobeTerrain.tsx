import * as THREE from "three";
import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";

/** Planet surface — albedo texture with boosted saturation shader. */
export function GlobeTerrain() {
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
      vec3 boosted = boostSat(dayCol.rgb, 1.5) * 1.4;
      gl_FragColor = vec4(boosted, 1.0);
    }
  `;

  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS, 128, 64]} />
      <shaderMaterial
        uniforms={terrainUniforms}
        vertexShader={terrainVert}
        fragmentShader={terrainFrag}
      />
    </mesh>
  );
}
