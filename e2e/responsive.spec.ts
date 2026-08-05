import type { Page } from '@playwright/test';

import { BREAKPOINTS, breakpointForWidth } from '@/utils/screen/Breakpoints';

import { expect, test } from './fixtures/webVitalsFixture';
import { SCENE_BOOT_FAILURE, isMobile, requiresWorkingWebGL } from './utils/testHelpers';
import { waitForR3FScene } from './utils/webVitals';

// Not `waitForR3FScene`: reading a box or a computed style has no reason to fail on an engine
// with no GL. The wait itself is required; the canvas arrives in a dynamically imported chunk.
async function waitForCanvas(page: Page, timeout = 15000): Promise<boolean> {
  try {
    await page.waitForSelector('canvas', { timeout, state: 'attached' });
    return true;
  } catch {
    return false;
  }
}

// How long the canvas gets to catch up with a viewport change. A resize makes R3F reallocate
// the drawbuffer and redraw: a few hundred ms on a laptop GPU, seconds on a runner's
// SwiftShader. Three viewports at this budget plus the 30 s scene boot is what sets the 120 s
// per-test timeout in playwright.config.ts; raise one and check the other.
const RESIZE_SETTLE_TIMEOUT = process.env.CI ? 20000 : 5000;

// These deliberately do not wait for the 3D scene (one exception below): layout is a DOM
// concern and gating on WebGL would skip them on exactly the engines with flaky headless GL.
// Scene behaviour lives in scene.spec.ts.
const VIEWPORTS = [
  { name: 'small phone', width: 320, height: 568, tier: 'mobile' },
  { name: 'phone', width: 375, height: 812, tier: 'mobile' },
  { name: 'phone landscape', width: 812, height: 375, tier: 'tablet' },
  { name: 'tablet portrait', width: 768, height: 1024, tier: 'tablet' },
  { name: 'tablet landscape', width: 1024, height: 768, tier: 'desktop' },
  { name: 'laptop', width: 1440, height: 900, tier: 'desktop' },
  { name: 'desktop', width: 1920, height: 1080, tier: 'wide' }
] as const;

// `breakpointForWidth` is imported, not mirrored: a local copy of the boundaries would reduce
// the tier assertion below to two constants from this file agreeing with each other.

test.describe('Responsive layout', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const viewport of VIEWPORTS) {
    test(`should lay out correctly on a ${viewport.name} (${viewport.width}×${viewport.height})`, async ({
      pageWithVitals
    }) => {
      await pageWithVitals.setViewportSize({ width: viewport.width, height: viewport.height });
      await pageWithVitals.goto('/');

      // Never select by `data-testid`: `reactRemoveProperties` strips it from the production
      // build, so the selector passes against `vite dev` and fails against the deployed site.
      const heading = pageWithVitals.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();

      // 1. The page must never scroll sideways.
      const overflow = await pageWithVitals.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, 'the page scrolls horizontally').toBeLessThanOrEqual(0);

      // 2. The heading has to fit, not just exist.
      const headingBox = await heading.boundingBox();
      expect(headingBox).not.toBeNull();
      expect(headingBox!.width).toBeLessThanOrEqual(viewport.width);

      // 3. Nothing flush against the edge: that is where a notch or a rounded corner eats it.
      expect(headingBox!.x).toBeGreaterThan(0);
      expect(headingBox!.y).toBeGreaterThan(0);

      // 4. The tier the CSS is in must match the app's own resolver.
      expect(breakpointForWidth(viewport.width)).toBe(viewport.tier);
    });
  }

  test('should reveal the secondary copy only from the tablet tier up', async ({ pageWithVitals }) => {
    await pageWithVitals.goto('/');
    const footer = pageWithVitals.locator('footer');

    await pageWithVitals.setViewportSize({ width: BREAKPOINTS.tablet - 1, height: 800 });
    await expect(footer).toBeHidden();

    await pageWithVitals.setViewportSize({ width: BREAKPOINTS.tablet, height: 800 });
    await expect(footer).toBeVisible();
  });

  test('should scale the heading up with the viewport', async ({ pageWithVitals }) => {
    await pageWithVitals.goto('/');
    const heading = pageWithVitals.getByRole('heading', { level: 1 });

    const fontSizeAt = async (width: number): Promise<number> => {
      await pageWithVitals.setViewportSize({ width, height: 800 });
      return heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    };

    const mobile = await fontSizeAt(375);
    const tablet = await fontSizeAt(768);
    const desktop = await fontSizeAt(1440);

    expect(tablet).toBeGreaterThan(mobile);
    expect(desktop).toBeGreaterThan(tablet);
  });

  test('should keep the canvas filling the viewport at every size', async ({ pageWithVitals }, testInfo) => {
    await pageWithVitals.goto('/');

    // The one test here that needs WebGL: R3F only sizes the element once it has a renderer,
    // so with no GL the canvas sits at the HTML default of 300×150 and this measures nothing.
    const sceneLoaded = await waitForR3FScene(pageWithVitals);
    if (!sceneLoaded) {
      if (requiresWorkingWebGL(testInfo)) throw new Error(SCENE_BOOT_FAILURE);
      test.skip(true, 'Headless WebGL unavailable on this engine');

      return;
    }

    const canvas = pageWithVitals.locator('canvas');

    for (const { width, height } of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 }
    ]) {
      await pageWithVitals.setViewportSize({ width, height });

      // Polled: R3F resizes from a ResizeObserver and legitimately trails setViewportSize by
      // a frame or two. What must not happen is that it never catches up.
      await expect
        .poll(
          async () => {
            const box = await canvas.boundingBox();
            if (!box) return null;
            return Math.max(Math.abs(box.width - width), Math.abs(box.height - height));
          },
          { message: `canvas never matched ${width}x${height}`, timeout: RESIZE_SETTLE_TIMEOUT }
        )
        .toBeLessThanOrEqual(1);
    }
  });

  test('should survive an orientation flip', async ({ pageWithVitals }) => {
    await pageWithVitals.setViewportSize({ width: 390, height: 844 });
    await pageWithVitals.goto('/');

    const heading = pageWithVitals.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    const portrait = await heading.boundingBox();

    await pageWithVitals.setViewportSize({ width: 844, height: 390 });
    await expect(heading).toBeVisible();
    const landscape = await heading.boundingBox();

    expect(portrait).not.toBeNull();
    expect(landscape).not.toBeNull();
    // The layout has to actually respond, not just avoid crashing.
    expect(landscape!.width).not.toBe(portrait!.width);

    const overflow = await pageWithVitals.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, 'landscape introduced horizontal scroll').toBeLessThanOrEqual(0);
  });

  test('should not let the page rubber-band or scroll', async ({ pageWithVitals }) => {
    await pageWithVitals.goto('/');

    // A full-screen canvas app that scrolls slides under the finger instead of orbiting.
    const { overflowY, overscroll } = await pageWithVitals.evaluate(() => {
      const style = getComputedStyle(document.body);
      return { overflowY: style.overflowY, overscroll: style.overscrollBehavior };
    });

    expect(overflowY).toBe('hidden');
    expect(overscroll).toContain('none');
  });
});

test.describe('Touch and pointer handling', () => {
  test('should let the canvas swallow gestures while leaving the copy selectable', async ({
    pageWithVitals
  }, testInfo) => {
    await pageWithVitals.goto('/');

    const overlayCopy = pageWithVitals.getByRole('heading', { level: 1 });
    const selectable = await overlayCopy.evaluate((element) => getComputedStyle(element).userSelect);

    // The overlay exists so the copy is selectable; `user-select: none` on <body> undoes that.
    expect(selectable).not.toBe('none');

    test.skip(!(await waitForCanvas(pageWithVitals)), 'No canvas element on this engine');

    const canvas = pageWithVitals.locator('canvas');

    // Asserted on the canvas itself, where globals.css declares it. Walking the ancestor chain
    // would pass on OrbitControls' inline style and stay green until `src/scene/demo/` is deleted.
    expect(
      await canvas.evaluate((element) => getComputedStyle(element).touchAction),
      'the canvas does not block touch panning — drags will scroll the page'
    ).toBe('none');

    if (isMobile(testInfo)) {
      const hasTouch = await pageWithVitals.evaluate(() => 'ontouchstart' in window || navigator.maxTouchPoints > 0);
      expect(hasTouch, 'mobile project is not emulating touch').toBe(true);
    }
  });
});
