import type { Page, TestInfo } from '@playwright/test';

export function isMobile(testInfo: TestInfo): boolean {
  return testInfo.project.name.includes('mobile');
}

/**
 * Resolves once React has hydrated the shell.
 *
 * `goto()` returns on `load`, which is earlier: the markup is there, the handlers are not. Click a
 * link in that window and the browser follows the href, which is the progressive enhancement doing
 * its job — but a spec asserting the in-place behaviour then fails on a page that works. Measured
 * at ~120 ms against `vite dev`, so the race is lost far more often than it is won.
 *
 * `window.__log` is the signal: useBoot() sets it in an effect, and effects run after the commit
 * that attaches the handlers. Nothing renders it server-side. React's own `__reactProps$` keys are
 * not an option, React 19 no longer puts them on hydrated nodes.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => '__log' in window);
}

// Projects where a scene that fails to boot is a defect and not an environment quirk. chromium
// runs SwiftShader and always gets WebGL, WebKit/Firefox headless are allowed to skip.
const RELIABLE_WEBGL_PROJECTS = new Set(['chromium', 'mobile-chrome']);

export function requiresWorkingWebGL(testInfo: TestInfo): boolean {
  return RELIABLE_WEBGL_PROJECTS.has(testInfo.project.name);
}

// Fail rather than skip. waitForR3FScene() returns false for any boot failure: missing WebGL, but
// also a CSP regression that blocked hydration, a JS error, or a GLB that 404s.
export const SCENE_BOOT_FAILURE = [
  'The 3D scene never initialised on a project with reliable WebGL.',
  'This is not an environment problem. Check, in order:',
  '  1. CSP, look for "violates the following Content Security Policy directive" in the console.',
  '  2. A JavaScript error during hydration.',
  '  3. A missing or corrupt asset under public/assets/.'
].join('\n');
