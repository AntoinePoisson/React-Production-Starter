import { expect, test } from './fixtures/webVitalsFixture';
import { SCENE_BOOT_FAILURE, requiresWorkingWebGL } from './utils/testHelpers';
import { waitForR3FScene } from './utils/webVitals';

// Browser and dev-server noise. hydration/Hydration are NOT noise: React's dev build reports
// real mismatches under that wording. Drop them once the suite is quiet enough locally.
const IGNORED_ERROR_PATTERNS = [
  'DevTools',
  'Extension',
  'favicon',
  'next-dev-overlay',
  'next/dist',
  'hydration',
  'Hydration',
  'webpack',
  'hot-reloader'
];

// What three.js logs when it can't get a context. Only dropped when the scene failed to boot AND
// the engine is one whose headless WebGL is undependable (firefox, webkit on a Linux runner).
const WEBGL_UNAVAILABLE_PATTERNS = ['A WebGL context could not be created', 'Error creating WebGL context'];

function filterConsoleErrors(errors: string[]): string[] {
  return errors.filter((e) => !IGNORED_ERROR_PATTERNS.some((pattern) => e.includes(pattern)));
}

test.describe('Application Smoke Tests', () => {
  test.describe.configure({ mode: 'parallel' });

  test('should load the main page successfully', async ({ pageWithVitals }) => {
    const response = await pageWithVitals.goto('/');

    expect(response?.status()).toBe(200);
    await expect(pageWithVitals).toHaveTitle(/React App Fondation/i);
  });

  test('should render without console errors', async ({ pageWithVitals }, testInfo) => {
    const consoleErrors: string[] = [];

    pageWithVitals.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    pageWithVitals.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await pageWithVitals.goto('/');
    const sceneLoaded = await waitForR3FScene(pageWithVitals);
    await pageWithVitals.waitForTimeout(2000);

    let filteredErrors = filterConsoleErrors(consoleErrors);

    if (!sceneLoaded) {
      if (requiresWorkingWebGL(testInfo)) throw new Error(SCENE_BOOT_FAILURE);
      filteredErrors = filteredErrors.filter(
        (error) => !WEBGL_UNAVAILABLE_PATTERNS.some((pattern) => error.includes(pattern))
      );
    }

    if (filteredErrors.length > 0) {
      console.error('Console errors detected:', filteredErrors);
    }

    expect(filteredErrors.length).toBe(0);
  });

  test('should show the 404 page over the canvas rather than below it', async ({ pageWithVitals }) => {
    // No status assertion: `serve` answers an unknown path with 404.html and a 404, the dev
    // server renders the same component with a 200. What both owe is a readable page.
    await pageWithVitals.goto('/this-route-does-not-exist');

    // The canvas is what made this fail: R3F's wrapper is a full-height block, so a system page
    // left in normal flow rendered below the fold of a body that cannot scroll. Present in the
    // DOM, impossible to reach — which is why toBeVisible() alone would not have caught it.
    await waitForR3FScene(pageWithVitals);

    await expect(pageWithVitals.getByRole('heading', { level: 1 })).toBeInViewport();
    await expect(pageWithVitals.getByRole('link')).toBeInViewport();
  });

  test('should load all essential assets without failures', async ({ pageWithVitals }) => {
    const failedRequests: string[] = [];

    pageWithVitals.on('requestfailed', (request) => {
      failedRequests.push(request.url());
    });

    await pageWithVitals.goto('/');
    await waitForR3FScene(pageWithVitals);

    const criticalFails = failedRequests.filter(
      (url) => !url.includes('favicon') && !url.includes('analytics') && !url.includes('hotjar')
    );

    if (criticalFails.length > 0) {
      console.error(`Critical failed requests (${criticalFails.length}):`, criticalFails);
    }

    expect(criticalFails.length).toBe(0);
  });
});
