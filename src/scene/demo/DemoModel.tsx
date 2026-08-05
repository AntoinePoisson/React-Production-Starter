import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh } from 'three';
import type { GLTF } from 'three-stdlib';

import { sceneColor } from '@/utils/theme/Palette';

/**
 * Placeholder model, replace with your own asset. The demo GLB ships uncompressed: 92 kB, 11 kB
 * under Draco, against a 245 kB decoder. Break-even is around a megabyte of geometry; the wired
 * decoder path only loads when a model actually carries Draco data.
 *
 * npx gltfjsx@latest --transform --types --debug ./public/assets/models/<model>.glb
 */
type GLTFResult = GLTF & {
  nodes: { DemoShape: Mesh };
};

const MODEL_PATH = '/assets/models/demo/demo-shape.glb';
const DRACO_PATH = '/assets/models/draco/';

const ROTATION_SPEED = 0.25; // radians per second

export default function DemoModel() {
  const groupRef = useRef<Group>(null);
  const { nodes } = useGLTF(MODEL_PATH, DRACO_PATH) as unknown as GLTFResult;

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * ROTATION_SPEED;
    groupRef.current.rotation.z += delta * ROTATION_SPEED * 0.35;
  });

  return (
    <group ref={groupRef}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.DemoShape.geometry}
      >
        <meshStandardMaterial
          color={sceneColor('accent')}
          metalness={0.15}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL_PATH, DRACO_PATH);
