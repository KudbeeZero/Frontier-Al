import * as THREE from "three";
import { useRef } from "react";
import { Canvas } from "@react-three/fiber";

function Planet() {
  const texture = new THREE.TextureLoader().load(
    "/textures/planets/ascendancy/planet_albedo.png",
    (t) => {
      console.log("TEXTURE LOADED", t);
      t.colorSpace = THREE.SRGBColorSpace;
    },
    undefined,
    (err) => console.error("TEXTURE FAILED", err)
  );

  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

export default function PlanetGlobe() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <ambientLight intensity={1} />
      <Planet />
    </Canvas>
  );
}
