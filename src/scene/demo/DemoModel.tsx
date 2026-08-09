import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh } from 'three';
import type { GLTF } from 'three-stdlib';

import { publicPath } from '@/utils/config/Site';
import { usePrefersReducedMotion } from '@/utils/screen/useReducedMotion';
import { sceneColor } from '@/utils/theme/Palette';

/**
 * Placeholder — swap your own asset in. Uncompressed on purpose: 92 kB vs a
 * 245 kB Draco decoder, not worth it under ~1 MB of geo. The decoder path is
 * still wired and only loads if the model actually has Draco data.
 *
 * Types: npx gltfjsx@latest --transform --types --debug ./public/assets/models/<model>.glb
 */
type GLTFResult = GLTF & {
  nodes: { DemoShape: Mesh };
};

// publicPath, not a bare /assets/... — the loader doesn't see Vite's base.
const MODEL_PATH = publicPath('/assets/models/demo/demo-shape.glb');
const DRACO_PATH = publicPath('/assets/models/draco/');

const ROTATION_SPEED = 0.25; // radians per second

export default function DemoModel() {
  const groupRef = useRef<Group>(null);
  const { nodes } = useGLTF(MODEL_PATH, DRACO_PATH) as unknown as GLTFResult;
  const reducedMotion = usePrefersReducedMotion();

  useFrame((_state, delta) => {
    // Nothing to restore, it just accumulates from 0.
    if (reducedMotion || !groupRef.current) return;
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
