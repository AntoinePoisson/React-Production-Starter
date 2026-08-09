import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';

import type { Breakpoint } from '@/utils/screen/Breakpoints';
import { useBreakpoint } from '@/utils/screen/useBreakpoint';
import { sceneColor } from '@/utils/theme/Palette';

// Density per device. Width is a rough proxy for GPU budget, tier on hardwareConcurrency or a
// short FPS probe if a project turns out to be really GPU-bound.
const COUNT_BY_BREAKPOINT: Record<Breakpoint, number> = { wide: 28, desktop: 22, tablet: 16, mobile: 10 };

const GOLDEN_ANGLE = 2.399963229728653;

// Reused every frame. Never allocate inside useFrame, it shows up immediatly in the profiler.
const dummy = new Object3D();

type Satellite = { radius: number; speed: number; phase: number; height: number; scale: number };

export default function FloatingShapes() {
  const meshRef = useRef<InstancedMesh>(null);
  const count = COUNT_BY_BREAKPOINT[useBreakpoint()];

  // Golden angle instead of Math.random so the layout is identical on every reload.
  const satellites = useMemo<Satellite[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const t = i / count;
        return {
          radius: 3.1 + (i % 4) * 0.62,
          speed: 0.18 + ((i % 5) * 0.05 + t * 0.12),
          phase: i * GOLDEN_ANGLE,
          height: Math.sin(i * GOLDEN_ANGLE) * 1.9,
          scale: 0.08 + (i % 3) * 0.035
        };
      }),
    [count]
  );

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const time = state.clock.elapsedTime;

    for (let i = 0; i < satellites.length; i++) {
      const { radius, speed, phase, height, scale } = satellites[i];
      const angle = phase + time * speed;

      dummy.position.set(
        Math.cos(angle) * radius,
        height + Math.sin(time * speed * 2 + phase) * 0.35,
        Math.sin(angle) * radius
      );
      dummy.rotation.set(angle, angle * 0.7, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      key={count}
      ref={meshRef}
      castShadow
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        flatShading
        color={sceneColor('prop')}
        metalness={0.1}
        roughness={0.6}
      />
    </instancedMesh>
  );
}
