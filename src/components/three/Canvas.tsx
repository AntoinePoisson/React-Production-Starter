import { useLingui } from '@lingui/react/macro';
import { Canvas, type RootState } from '@react-three/fiber';
import { Suspense, useCallback } from 'react';
import { PCFShadowMap } from 'three';

import { createLogger } from '@/utils/logger/Logger';

import CanvasLoader from './Loader';

const log = createLogger('Canvas');

/** The single WebGL canvas. Keep one per page: each is a WebGL context, and browsers cap them. */
export default function ThreeCanvas({ children }: { children: React.ReactNode }) {
  const { t } = useLingui();

  const handleCreated = useCallback(({ gl, camera, scene }: RootState) => {
    // Expose the R3F root for E2E inspection: canvas.getContext() loses the context on WebKit.
    // Context loss/restore is already handled inside three.js; no extra recovery belongs here.
    Object.assign(gl.domElement, { __r3fRenderer: gl, __r3fCamera: camera, __r3fScene: scene });

    // Give the right-click menu back: OrbitControls preventDefaults `contextmenu` whenever it is
    // `enabled`, on the full-screen R3F container, even though `enablePan={false}` here.
    gl.domElement.addEventListener('contextmenu', (event) => event.stopImmediatePropagation());

    log.debug('WebGL context ready');
  }, []);

  return (
    <Suspense fallback={<CanvasLoader />}>
      <Canvas
        aria-label={t`Interactive 3D scene — drag to orbit the camera, scroll to zoom`}
        // Lands on R3F's wrapper div, which carries inline position/width/height, so layout
        // classes here are dead. Pass layout intent through `style` or through the parent.
        // Touch handling lives in globals.css (`touch-action: none !important` on the canvas).
        className='outline-none'
        // DPR capped at 2: beyond that the pixel cost outgrows the visible gain.
        dpr={[1, 2]}
        fallback={<p className='p-6'>{t`Your browser does not support WebGL, so the 3D scene cannot be displayed.`}</p>}
        role='application'
        camera={{
          fov: 45,
          near: 0.1,
          far: 100,
          position: [0, 2.5, 8]
        }}
        gl={{
          powerPreference: 'high-performance',
          // Transparent canvas: the sky gradient is painted by CSS underneath.
          alpha: true
        }}
        shadows={{
          // PCFShadowMap instead of the softer (and costlier) PCFSoftShadowMap.
          type: PCFShadowMap,
          enabled: true
        }}
        onCreated={handleCreated}
      >
        {/* No <Preload all />: it compiles every material up front, front-loading main-thread
            work during load. Add it back if objects revealed later hitch on shader compile. */}
        {children}
      </Canvas>
    </Suspense>
  );
}
