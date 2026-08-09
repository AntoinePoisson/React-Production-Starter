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
 * Everything inside the canvas. scene/demo is placeholder — delete it and keep
 * this file's shape for an empty stage.
 *
 * autoRotate doesn't stop on its own (that's the idle look). Only
 * prefers-reduced-motion turns it off.
 */
export default function Experiences() {
  const reducedMotion = usePrefersReducedMotion();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <>
      <Environment />

      {/* Suspense for a slow fetch, boundary for a failed one. */}
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

      {/* Same camera moves for keyboard as for pointer. */}
      <CameraKeyboardControls controlsRef={controlsRef} />
    </>
  );
}
