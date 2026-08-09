import { useLingui } from '@lingui/react/macro';
import { Canvas, type RootState } from '@react-three/fiber';
import { Suspense, useCallback } from 'react';
import { PCFShadowMap } from 'three';

import { createLogger } from '@/utils/logger/Logger';

import CanvasLoader from './Loader';

const log = createLogger('Canvas');

/** One canvas per page. Each one is a WebGL context and browsers cap how many a tab can hold. */
export default function ThreeCanvas({ children }: { children: React.ReactNode }) {
  const { t } = useLingui();

  const handleCreated = useCallback(({ gl, camera, scene }: RootState) => {
    // For the E2E specs. canvas.getContext() loses the context on WebKit.
    Object.assign(gl.domElement, { __r3fRenderer: gl, __r3fCamera: camera, __r3fScene: scene });

    // Gives the right-click menu back. OrbitControls preventDefaults contextmenu as soon as it's
    // enabled, on the full-screen container, even with enablePan={false}.
    gl.domElement.addEventListener('contextmenu', (event) => event.stopImmediatePropagation());

    log.debug('WebGL context ready');
  }, []);

  return (
    <Suspense fallback={<CanvasLoader />}>
      <Canvas
        aria-label={t`Interactive 3D scene — drag to orbit the camera, scroll to zoom`}
        // Lands on R3F's wrapper div, which already has inline position/width/height, so layout
        // classes here do nothing. Go through `style` or the parent instead.
        className='outline-none'
        // Capped at 2, past that the pixel cost outgrows the visible gain.
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
          alpha: true
        }}
        shadows={{
          type: PCFShadowMap,
          enabled: true
        }}
        onCreated={handleCreated}
      >
        {/* No <Preload all />, it compiles every material up front and front-loads main-thread
            work during load. Add it back if late-revealed objects hitch on shader compile. */}
        {children}
      </Canvas>
    </Suspense>
  );
}
