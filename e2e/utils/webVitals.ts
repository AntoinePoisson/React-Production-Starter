import { readFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';

import type { Page } from '@playwright/test';

/**
 * Local web-vitals IIFE, no CDN / no CSP hole. Plain build, not `attribution`
 * (~4x bigger, extra observers on the thread we're measuring).
 * Exports map forbids deep paths, so we resolve the entry and swap the variant.
 */
const requireFromRoot = createRequire(path.join(process.cwd(), 'package.json'));
const WEB_VITALS_BUNDLE_PATH = requireFromRoot.resolve('web-vitals').replace(/\.umd\.cjs$|\.js$/, '.iife.js');

// Injected scripts run in a function scope, so `var webVitals` never hits window on its own.
const WEB_VITALS_BUNDLE = `${readFileSync(WEB_VITALS_BUNDLE_PATH, 'utf-8')}\nwindow.webVitals = webVitals;`;

export interface WebVitalsMetrics {
  LCP?: number;
  CLS?: number;
  FCP?: number;
  TTFB?: number;
  INP?: number;
}

/** https://web.dev/vitals/ */
export const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // milliseconds
  CLS: { good: 0.1, needsImprovement: 0.25 }, // score
  FCP: { good: 1800, needsImprovement: 3000 }, // milliseconds
  TTFB: { good: 800, needsImprovement: 1800 }, // milliseconds
  INP: { good: 200, needsImprovement: 500 } // milliseconds
};

export async function setupWebVitals(page: Page): Promise<void> {
  await page.addInitScript({ content: WEB_VITALS_BUNDLE });

  await page.addInitScript(() => {
    const vitals: Record<string, number | null> = { LCP: null, CLS: null, FCP: null, TTFB: null, INP: null };
    (window as any).__webVitals = vitals;
    (window as any).__webVitalsLoaded = false;

    const lib = (window as any).webVitals;
    if (!lib) return;

    const record = (name: string) => (metric: { value: number }) => {
      vitals[name] = metric.value;
    };

    lib.onLCP(record('LCP'));
    lib.onFCP(record('FCP'));
    lib.onTTFB(record('TTFB'));

    // Without reportAllChanges, CLS and INP only report at page hide. Tests read them while the
    // page is still visible, so both would stay null.
    lib.onCLS(record('CLS'), { reportAllChanges: true });
    lib.onINP(record('INP'), { reportAllChanges: true });

    (window as any).__webVitalsLoaded = true;
  });
}

/** Waits for the library, then a settle delay for the late callbacks. Missing metrics are null. */
export async function collectWebVitals(page: Page, timeout: number = 10000): Promise<WebVitalsMetrics> {
  await page.waitForFunction(() => (window as any).__webVitalsLoaded === true, { timeout: 5000 });

  await page.waitForTimeout(timeout);

  const metrics = await page.evaluate(() => {
    return (window as any).__webVitals;
  });

  return metrics;
}

// Reads the __r3fRenderer set by Canvas.tsx's onCreated. canvas.getContext() would trigger
// context loss on WebKit.
async function waitForWebGLContext(page: Page, timeout: number = 30000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
        if (!canvas) return false;

        // Renderer reference only, canvas dimensions stay at the 300x150 default without WebGL.
        return !!(canvas as any).__r3fRenderer;
      },
      { timeout, polling: 500 }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Waits for a <canvas>, then the R3F renderer, then a frame with triangles drawn. Triangles prove
 * the renderer is drawing, not that the GLB arrived. Sampling pixels would just pick up the CSS
 * gradient behind the transparent canvas.
 */
export async function waitForR3FScene(page: Page, timeout: number = 30000): Promise<boolean> {
  try {
    // R3F renders the <canvas> whether or not WebGL initialises, so this only proves it mounted.
    await page.waitForSelector('canvas', { timeout });

    const hasWebGL = await waitForWebGLContext(page, timeout);
    if (!hasWebGL) {
      return false;
    }

    await page.waitForFunction(
      () => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
        if (!canvas) return false;

        const renderer = (canvas as any).__r3fRenderer;
        if (!renderer || !renderer.info) return false;

        return renderer.info.render.triangles > 0;
      },
      { timeout, polling: 1000 }
    );

    return true;
  } catch {
    return false;
  }
}
