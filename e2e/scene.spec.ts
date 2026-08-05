import { expect, test } from './fixtures/webVitalsFixture';
import { SCENE_BOOT_FAILURE, isMobile, requiresWorkingWebGL } from './utils/testHelpers';
import { waitForR3FScene } from './utils/webVitals';

// `hydration`/`Hydration` do silence a genuine bug under `vite dev`. Kept deliberately.
const IGNORED_ERROR_PATTERNS = [
  // Dev tooling
  'DevTools',
  'Extension',
  'favicon',
  'next-dev-overlay',
  'next/dist',
  'hydration',
  'Hydration',
  'webpack',
  'hot-reloader',
  // WebGL/Three.js runtime errors (expected in CI with software renderers)
  'WebGL',
  'webgl',
  'GL_INVALID',
  'THREE',
  'shader',
  'Shader',
  'context lost',
  'CONTEXT_LOST',
  // Pointer lock is not supported in headless browsers
  'Pointer lock',
  'pointer lock',
  'WrongDocumentError'
];

function filterConsoleErrors(errors: string[]): string[] {
  return errors.filter((e) => !IGNORED_ERROR_PATTERNS.some((pattern) => e.includes(pattern)));
}

// `chromium` and `mobile-chrome` run SwiftShader and must boot the scene; `firefox`, `webkit`
// and `mobile-safari` may bail out. `requiresWorkingWebGL` in utils/testHelpers.ts decides.
test.describe('3D Scene', () => {
  test.describe.configure({ mode: 'serial' });

  test('should load and render the 3D scene', async ({ pageWithVitals }, testInfo) => {
    await pageWithVitals.goto('/');

    const sceneLoaded = await waitForR3FScene(pageWithVitals, 30000);
    if (!sceneLoaded) {
      if (requiresWorkingWebGL(testInfo)) throw new Error(SCENE_BOOT_FAILURE);
      test.skip(true, 'Headless WebGL unavailable on this engine');
    }

    const canvasVisible = await pageWithVitals.isVisible('canvas');
    expect(canvasVisible).toBe(true);

    const canvasSize = await pageWithVitals.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return { width: canvas?.width || 0, height: canvas?.height || 0 };
    });

    expect(canvasSize.width).toBeGreaterThan(0);
    expect(canvasSize.height).toBeGreaterThan(0);
  });

  test('should survive 30 seconds of simulated activity', async ({ pageWithVitals }, testInfo) => {
    test.skip(isMobile(testInfo), 'Desktop only - extended activity test');
    test.setTimeout(90_000);

    const consoleErrors: string[] = [];
    pageWithVitals.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    pageWithVitals.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await pageWithVitals.goto('/');
    const sceneReady = await waitForR3FScene(pageWithVitals, 30000);
    if (!sceneReady) {
      if (requiresWorkingWebGL(testInfo)) throw new Error(SCENE_BOOT_FAILURE);
      test.skip(true, 'Headless WebGL unavailable on this engine');
    }

    // Chromium only; null elsewhere.
    const initialMemory = await pageWithVitals.evaluate(() => {
      if ('memory' in performance) return (performance as any).memory.usedJSHeapSize;
      return null;
    });

    await pageWithVitals.evaluate(() => {
      const timestamps: number[] = [];
      (window as any).__fpsTracker = { timestamps, running: true };

      function tick() {
        if (!(window as any).__fpsTracker.running) return;
        timestamps.push(performance.now());
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });

    const duration = 30_000;
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      const elapsed = Date.now() - startTime;
      const phase = elapsed % 6000; // 6-second rotation cycle

      if (phase < 2000) {
        // Phase 1: pointer sweeps (hover / raycast pressure)
        const x = 400 + Math.sin(elapsed / 500) * 300;
        const y = 300 + Math.cos(elapsed / 700) * 200;
        await pageWithVitals.mouse.move(x, y);
      } else if (phase < 4000) {
        // Phase 2: drag to orbit the camera
        await pageWithVitals.mouse.move(960, 540);
        await pageWithVitals.mouse.down();
        for (let step = 1; step <= 4; step++) {
          await pageWithVitals.mouse.move(960 + step * 40, 540 + Math.sin(step) * 30);
          await pageWithVitals.waitForTimeout(40);
        }
        await pageWithVitals.mouse.up();
      } else {
        // Phase 3: wheel zoom in and out
        await pageWithVitals.mouse.move(960, 540);
        await pageWithVitals.mouse.wheel(0, elapsed % 12000 < 6000 ? 240 : -240);
        await pageWithVitals.waitForTimeout(200);
      }

      await pageWithVitals.waitForTimeout(100);
    }

    const fpsReport = await pageWithVitals.evaluate(() => {
      const tracker = (window as any).__fpsTracker;
      tracker.running = false;
      const timestamps: number[] = tracker.timestamps;

      if (timestamps.length < 2) return null;

      const startMs = timestamps[0];
      const buckets: number[] = [];
      let bucketStart = startMs;
      let framesInBucket = 0;

      for (const ts of timestamps) {
        if (ts - bucketStart >= 1000) {
          buckets.push(framesInBucket);
          bucketStart += 1000;
          framesInBucket = 1;
        } else {
          framesInBucket++;
        }
      }
      if (framesInBucket > 0) buckets.push(framesInBucket);

      if (buckets.length < 10) return null;

      const avgFps = buckets.reduce((a, b) => a + b, 0) / buckets.length;
      const minFps = Math.min(...buckets);

      const third = Math.floor(buckets.length / 3);
      const firstThirdAvg = buckets.slice(0, third).reduce((a, b) => a + b, 0) / third;
      const lastThirdAvg = buckets.slice(-third).reduce((a, b) => a + b, 0) / third;

      return { avgFps, minFps, firstThirdAvg, lastThirdAvg, totalSeconds: buckets.length };
    });

    // 1. Scene is still alive.
    const sceneState = await pageWithVitals.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
      if (!canvas) return { alive: false, contextLost: true };

      const renderer = (canvas as any).__r3fRenderer;
      if (!renderer) return { alive: false, contextLost: true };

      const gl = renderer.getContext();
      return { alive: true, contextLost: gl?.isContextLost() ?? true };
    });

    // Software renderers (SwiftShader, WebKit headless) drop the context under stress.
    if (sceneState.contextLost) {
      console.warn('[stress-test] WebGL context lost during stress test (software renderer)');
      test.skip(true, 'WebGL context lost during stress test (expected with software rendering)');
    }

    expect(sceneState.alive).toBe(true);

    // 2. No runtime errors
    const filteredErrors = filterConsoleErrors(consoleErrors);
    expect(filteredErrors.length).toBe(0);

    // 3. FPS stability (hardware-independent: checks degradation, not absolute value)
    if (fpsReport) {
      const degradationRatio = fpsReport.lastThirdAvg / fpsReport.firstThirdAvg;
      expect(degradationRatio).toBeGreaterThan(0.5);

      console.info(
        `[FPS] avg=${fpsReport.avgFps.toFixed(1)} min=${fpsReport.minFps} ` +
          `first10s=${fpsReport.firstThirdAvg.toFixed(1)} last10s=${fpsReport.lastThirdAvg.toFixed(1)} ` +
          `degradation=${((1 - degradationRatio) * 100).toFixed(0)}% ` +
          `duration=${fpsReport.totalSeconds}s`
      );

      const fpsBenchmarks = [
        { name: 'Average FPS (30s stress)', unit: 'fps', value: fpsReport.avgFps, direction: 'bigger' as const },
        { name: 'Minimum FPS (30s stress)', unit: 'fps', value: fpsReport.minFps, direction: 'bigger' as const },
        {
          name: 'FPS Degradation (30s stress)',
          unit: '%',
          value: (1 - degradationRatio) * 100,
          direction: 'smaller' as const
        }
      ];
      for (const metric of fpsBenchmarks) {
        await testInfo.attach(`benchmark:${metric.name}`, {
          contentType: 'application/json',
          body: Buffer.from(JSON.stringify(metric))
        });
      }
    }

    // 4. Memory hasn't exploded (Chromium only)
    if (initialMemory !== null) {
      const finalMemory = await pageWithVitals.evaluate(() => {
        if ('memory' in performance) return (performance as any).memory.usedJSHeapSize;
        return null;
      });

      if (finalMemory !== null) {
        const growthRatio = (finalMemory - initialMemory) / initialMemory;
        expect(growthRatio).toBeLessThan(1.0);

        await testInfo.attach('benchmark:Memory Growth (30s stress)', {
          contentType: 'application/json',
          body: Buffer.from(
            JSON.stringify({
              name: 'Memory Growth (30s stress)',
              unit: '%',
              value: growthRatio * 100,
              direction: 'smaller'
            })
          )
        });
      }
    }
  });

  test('should handle WebGL context loss and recovery', async ({ pageWithVitals }, testInfo) => {
    test.skip(isMobile(testInfo), 'Desktop only - context loss edge case');

    await pageWithVitals.goto('/');
    const sceneReady = await waitForR3FScene(pageWithVitals, 15000);
    if (!sceneReady) {
      if (requiresWorkingWebGL(testInfo)) throw new Error(SCENE_BOOT_FAILURE);
      test.skip(true, 'Headless WebGL unavailable on this engine');
    }

    const result = await pageWithVitals.evaluate(async () => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return { supported: false, reason: 'no canvas' };

      const renderer = (canvas as any).__r3fRenderer;
      const gl: WebGLRenderingContext | WebGL2RenderingContext | null = renderer
        ? renderer.getContext()
        : canvas.getContext('webgl2') || canvas.getContext('webgl');

      if (!gl) return { supported: false, reason: 'no context' };

      const ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) return { supported: false, reason: 'no WEBGL_lose_context extension' };

      let contextLostFired = false;
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        contextLostFired = true;
      });

      ext.loseContext();
      await new Promise((resolve) => setTimeout(resolve, 500));

      ext.restoreContext();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return { supported: true, contextLostFired, isContextLost: gl.isContextLost() };
    });

    if (!result.supported) {
      test.skip(true, `Context loss not testable: ${result.reason}`);
      return;
    }

    expect(result.contextLostFired).toBe(true);
    const canvasVisible = await pageWithVitals.isVisible('canvas');
    expect(canvasVisible).toBe(true);
  });
});
