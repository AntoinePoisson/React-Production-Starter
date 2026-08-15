import { appPath, expect, test } from './fixtures/webVitalsFixture';
import { SCENE_BOOT_FAILURE, isMobile, requiresWorkingWebGL } from './utils/testHelpers';
import { WEB_VITALS_THRESHOLDS, waitForR3FScene } from './utils/webVitals';

// Timing only means something against the real build. `vite dev` inflates LCP by seconds.
// Locally: pnpm website, then BASE_URL=http://localhost:3200 pnpm e2e
const MEASURES_PRODUCTION_BUILD = Boolean(process.env.CI || process.env.BASE_URL);

test.describe('Performance', () => {
  test.describe.configure({ mode: 'serial' });

  test('should have acceptable Core Web Vitals', async ({ pageWithVitals }, testInfo) => {
    await pageWithVitals.goto(appPath('/'));

    // A page that never booted the scene looks great on LCP. Don't measure that.
    const sceneReady = await waitForR3FScene(pageWithVitals);
    if (!sceneReady) {
      if (requiresWorkingWebGL(testInfo)) throw new Error(SCENE_BOOT_FAILURE);
      test.skip(true, 'Headless WebGL unavailable on this engine');
    }

    // INP needs a click before it reports.
    await pageWithVitals.mouse.move(100, 100);
    await pageWithVitals.mouse.click(100, 100);
    await pageWithVitals.waitForTimeout(2000);

    const metrics = await pageWithVitals.getWebVitals();

    // CLS 0 is valid, so `!= null` not truthiness. Only Chromium reports this.
    if (metrics.CLS != null) {
      expect(metrics.CLS).toBeLessThan(WEB_VITALS_THRESHOLDS.CLS.needsImprovement);
    }

    // needsImprovement, not good — a 3D app isn't going to hit "good" on every metric.
    if (MEASURES_PRODUCTION_BUILD) {
      if (metrics.LCP) {
        expect(metrics.LCP).toBeLessThan(WEB_VITALS_THRESHOLDS.LCP.needsImprovement);
      }

      if (metrics.FCP) {
        expect(metrics.FCP).toBeLessThan(WEB_VITALS_THRESHOLDS.FCP.needsImprovement);
      }

      if (metrics.TTFB) {
        expect(metrics.TTFB).toBeLessThan(WEB_VITALS_THRESHOLDS.TTFB.needsImprovement);
      }
    } else {
      console.info(
        `[web-vitals] dev server, thresholds not asserted. ` +
          `LCP=${metrics.LCP?.toFixed(0)}ms FCP=${metrics.FCP?.toFixed(0)}ms TTFB=${metrics.TTFB?.toFixed(0)}ms`
      );
    }

    const benchmarkMetrics = [
      { name: 'LCP', unit: 'ms', value: metrics.LCP, direction: 'smaller' },
      { name: 'CLS', unit: 'score', value: metrics.CLS, direction: 'smaller' },
      { name: 'FCP', unit: 'ms', value: metrics.FCP, direction: 'smaller' },
      { name: 'TTFB', unit: 'ms', value: metrics.TTFB, direction: 'smaller' }
    ];
    for (const metric of benchmarkMetrics) {
      if (metric.value != null) {
        await testInfo.attach(`benchmark:${metric.name}`, {
          contentType: 'application/json',
          body: Buffer.from(JSON.stringify(metric))
        });
      }
    }
  });

  test('should not leak memory across page reloads', async ({ pageWithVitals }, testInfo) => {
    test.skip(isMobile(testInfo), 'Desktop only - memory leak detection');
    test.setTimeout(120_000);

    await pageWithVitals.goto(appPath('/'));
    const sceneReady = await waitForR3FScene(pageWithVitals);
    if (!sceneReady) {
      if (requiresWorkingWebGL(testInfo)) throw new Error(SCENE_BOOT_FAILURE);
      test.skip(true, 'Headless WebGL unavailable on this engine');
    }

    const initialMemory = await pageWithVitals.evaluate(() => {
      if ('memory' in performance) return (performance as any).memory.usedJSHeapSize;
      return null;
    });

    if (initialMemory === null) {
      test.skip(true, 'performance.memory not available (Chromium only)');
      return;
    }

    for (let i = 0; i < 5; i++) {
      await pageWithVitals.reload();
      await waitForR3FScene(pageWithVitals);
      await pageWithVitals.waitForTimeout(1000);
    }

    const finalMemory = await pageWithVitals.evaluate(() => {
      if ('memory' in performance) return (performance as any).memory.usedJSHeapSize;
      return null;
    });

    if (finalMemory !== null) {
      const growthRatio = (finalMemory - initialMemory) / initialMemory;
      // A three.js leak shows 20-30% growth per reload when geometries/textures/materials aren't
      // disposed.
      expect(growthRatio).toBeLessThan(0.5);

      await testInfo.attach('benchmark:Memory Growth (5 reloads)', {
        contentType: 'application/json',
        body: Buffer.from(
          JSON.stringify({
            name: 'Memory Growth (5 reloads)',
            unit: '%',
            value: growthRatio * 100,
            direction: 'smaller'
          })
        )
      });
    }
  });
});
