import { useThree } from '@react-three/fiber';
import { type RefObject, useEffect } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { applyCameraKey } from './CameraKeyboardControlsRules';

/** Same camera moves for keyboard as for pointer. */
export default function CameraKeyboardControls({ controlsRef }: { controlsRef: RefObject<OrbitControlsImpl | null> }) {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const element = gl.domElement.closest<HTMLElement>('[data-scene-root]') ?? gl.domElement;

    const onKeyDown = (event: KeyboardEvent) => {
      const controls = controlsRef.current;
      if (!controls || !applyCameraKey(event.key, controls)) return;

      event.preventDefault();
      event.stopPropagation();
      invalidate();
    };

    element.addEventListener('keydown', onKeyDown);

    return () => element.removeEventListener('keydown', onKeyDown);
  }, [controlsRef, gl, invalidate]);

  return null;
}
