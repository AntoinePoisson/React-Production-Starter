import { OrbitControls } from '@react-three/drei';
import { Suspense } from 'react';

import { InsideCanvasLoader } from '@/components/three/Loader';
import SceneErrorBoundary from '@/components/three/SceneErrorBoundary';

import DemoModel from './demo/DemoModel';
import FloatingShapes from './demo/FloatingShapes';
import Environment from './environment/Environment';

/**
 * Everything rendered inside the <Canvas>. scene/demo is placeholder content, delete it and keep
 * this file's shape for an empty stage.
 */
export default function Experiences() {
  return (
    <>
      <Environment />

      {/* Both, around any asset load. Suspense covers a slow fetch, the boundary a failed one. */}
      <SceneErrorBoundary>
        <Suspense fallback={<InsideCanvasLoader />}>
          <DemoModel />
        </Suspense>
      </SceneErrorBoundary>

      <FloatingShapes />

      <OrbitControls
        autoRotate
        enableDamping
        autoRotateSpeed={0.4}
        dampingFactor={0.06}
        enablePan={false}
        maxDistance={18}
        maxPolarAngle={Math.PI * 0.49}
        minDistance={4}
        target={[0, 0, 0]}
      />
    </>
  );
}
