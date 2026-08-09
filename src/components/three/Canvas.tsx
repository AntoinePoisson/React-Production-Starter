import { useLingui } from '@lingui/react/macro';
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, type RootState } from '@react-three/fiber';
import { Suspense, useCallback, useState } from 'react';
import { PCFShadowMap } from 'three';

import { createLogger } from '@/utils/logger/Logger';

import CanvasLoader from './Loader';

const log = createLogger('Canvas');

/** One canvas per page — each is a WebGL context, browsers cap those. */
export default function ThreeCanvas({ children }: { children: React.ReactNode }) {
  const { t } = useLingui();
  const [maximumDpr, setMaximumDpr] = useState(1.5);

  const handleCreated = useCallback(({ gl, camera, scene }: RootState) => {
    // For e2e. Don't call canvas.getContext() — WebKit drops the context.
    Object.assign(gl.domElement, { __r3fRenderer: gl, __r3fCamera: camera, __r3fScene: scene });

    // Get the right-click menu back. OrbitControls preventDefault contextmenu
    // on the whole container as soon as it's on, even with enablePan={false}.
    gl.domElement.addEventListener('contextmenu', (event) => event.stopImmediatePropagation());

    log.debug('WebGL context ready');
  }, []);

  return (
    <Suspense fallback={<CanvasLoader />}>
      <Canvas
        // Pointer + keyboard in one string. A visible paragraph would be a second
        // place to keep in sync, and aria-describedby only fires once focused.
        aria-label={t`Interactive 3D scene — drag or press the arrow keys to orbit, scroll or press plus and minus to zoom, Home to reset`}
        // Lands on R3F's wrapper (already has inline size). Layout classes here do nothing.
        className='outline-none'
        data-scene-root=''
        // Start low, then let frame stability pick the cap — not screen width.
        dpr={[1, maximumDpr]}
        fallback={<p className='p-6'>{t`Your browser does not support WebGL, so the 3D scene cannot be displayed.`}</p>}
        role='region'
        tabIndex={0}
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
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setMaximumDpr(1)}
          onFallback={() => setMaximumDpr(1)}
          onIncline={() => setMaximumDpr(2)}
        />
        {/* No <Preload all /> — compiles every material up front. Put it back if
            late objects hitch on shader compile. */}
        {children}
      </Canvas>
    </Suspense>
  );
}
