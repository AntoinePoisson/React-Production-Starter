import type { TestInfo } from '@playwright/test';

export function isMobile(testInfo: TestInfo): boolean {
  return testInfo.project.name.includes('mobile');
}

// Projects where a scene that fails to boot is a defect, not an environment quirk: chromium runs
// SwiftShader (`--use-angle=swiftshader`) and always gets WebGL; WebKit/Firefox headless may skip.
const RELIABLE_WEBGL_PROJECTS = new Set(['chromium', 'mobile-chrome']);

export function requiresWorkingWebGL(testInfo: TestInfo): boolean {
  return RELIABLE_WEBGL_PROJECTS.has(testInfo.project.name);
}

// Fail, do not skip: `waitForR3FScene()` returns false for any boot failure — missing WebGL,
// but also a CSP regression that blocked hydration, a JS error, or a GLB that 404s.
export const SCENE_BOOT_FAILURE = [
  'The 3D scene never initialised on a project with reliable WebGL.',
  'This is not an environment problem. Check, in order:',
  '  1. CSP — look for "violates the following Content Security Policy directive" in the console.',
  '  2. A JavaScript error during hydration.',
  '  3. A missing or corrupt asset under public/assets/.'
].join('\n');
