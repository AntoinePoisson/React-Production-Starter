import type { Page, TestInfo } from '@playwright/test';

export function isMobile(testInfo: TestInfo): boolean {
  return testInfo.project.name.includes('mobile');
}

/**
 * Wait until the shell has hydrated.
 *
 * `goto()` returns on `load` — markup is there, handlers aren't. Click a link
 * in that window and the browser just follows the href. ~120 ms on vite dev,
 * so you lose this race more often than not.
 *
 * `window.__log` is the signal (useBoot sets it in an effect). Don't use
 * `__reactProps$` — React 19 no longer puts those on hydrated nodes.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => '__log' in window);
}

// chromium / mobile-chrome always have WebGL (SwiftShader). WebKit/Firefox may skip.
const RELIABLE_WEBGL_PROJECTS = new Set(['chromium', 'mobile-chrome']);

export function requiresWorkingWebGL(testInfo: TestInfo): boolean {
  return RELIABLE_WEBGL_PROJECTS.has(testInfo.project.name);
}

// Fail, don't skip. A dead scene can be WebGL, but also CSP, a JS error, or a missing GLB.
export const SCENE_BOOT_FAILURE = [
  'The 3D scene never initialised on a project with reliable WebGL.',
  'This is not an environment problem. Check, in order:',
  '  1. CSP, look for "violates the following Content Security Policy directive" in the console.',
  '  2. A JavaScript error during hydration.',
  '  3. A missing or corrupt asset under public/assets/.'
].join('\n');
