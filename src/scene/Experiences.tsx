import { OrbitControls } from '@react-three/drei';
import { Suspense, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { InsideCanvasLoader } from '@/components/three/Loader';
import SceneErrorBoundary from '@/components/three/SceneErrorBoundary';
import { usePrefersReducedMotion } from '@/utils/screen/useReducedMotion';

import CameraKeyboardControls from './CameraKeyboardControls';
import DemoModel from './demo/DemoModel';
import FloatingShapes from './demo/FloatingShapes';
import Environment from './environment/Environment';

/**
 * Everything rendered inside the <Canvas>. scene/demo is placeholder content, delete it and keep
 * this file's shape for an empty stage.
 *
 * autoRotate never stops on its own: an idle scene that drifts is the point of the stage, and
 * OrbitControls resumes it after a drag rather than handing the camera back frozen. The only
 * thing that switches it off is prefers-reduced-motion.
 */
export default function Experiences() {
  const reducedMotion = usePrefersReducedMotion();
  const controlsRef = useRef<OrbitControlsImpl>(null);

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
        ref={controlsRef}
        enableDamping
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.4}
        dampingFactor={0.06}
        enablePan={false}
        maxDistance={12}
        maxPolarAngle={Math.PI * 0.49}
        minDistance={4}
        target={[0, 0, 0]}
      />

      {/* Same camera commands for a focused keyboard user as for a pointer user. */}
      <CameraKeyboardControls controlsRef={controlsRef} />
    </>
  );
}
