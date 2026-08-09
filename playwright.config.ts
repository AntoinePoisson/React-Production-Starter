import { defineConfig, devices } from '@playwright/test';

/**
 * Five projects: three desktop browsers plus two mobile viewports. Web Vitals come from the
 * pageWithVitals fixture. Screenshot comparison is wired up but no spec uses it yet.
 */
export default defineConfig({
  testDir: './e2e',

  snapshotDir: './reports/baseline-snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{-projectName}{-snapshotSuffix}{ext}',

  // 120s comes from the longest test: 30s for the scene to boot, then three viewport changes at
  // 20s each (RESIZE_SETTLE_TIMEOUT in e2e/responsive.spec.ts). Raise one, check the other.
  timeout: process.env.CI ? 120 * 1000 : 60 * 1000,

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,

  // 2 on CI, not 4. A runner has no GPU, so every page draws its scene through SwiftShader on the
  // CPU and autoRotate means it never stops. Four of those starve the main thread, and Playwright
  // reports starvation as evaluate/boundingBox/click timeouts, which read like broken selectors.
  // If a spec is slow on CI and instant locally, suspect this first.
  workers: process.env.CI ? 2 : '50%',

  reporter: (() => {
    if (process.env.BENCHMARK === 'true') {
      return [['list'], ['./e2e/reporters/benchmarkReporter.ts']] as const;
    }
    if (process.env.CI) {
      return [['blob', { outputDir: 'blob-report' }], ['github']] as const;
    }
    return [['html', { outputFolder: 'reports/html' }], ['list']] as const;
  })(),

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3120',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    viewport: { width: 1920, height: 1080 },
    navigationTimeout: 30 * 1000,
    // Doubled on CI for the same software-rendering reason as the workers above.
    actionTimeout: process.env.CI ? 20 * 1000 : 10 * 1000
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-webgl',
            '--ignore-gpu-blocklist',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--disable-gpu-sandbox'
          ]
        }
      }
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } }
      }
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } }
  ],

  webServer: {
    // CI serves the real build so the specs measure what ships, locally the dev server keeps the
    // loop fast. dist/client and not dist, the build also emits a dist/server nobody deploys.
    command: process.env.CI
      ? './node_modules/.bin/serve ./dist/client --listen 3120 --config ../../serve.json --no-clipboard --no-request-logging --no-port-switching'
      : 'lsof -ti :3120 | xargs kill -9 2>/dev/null || true && ./node_modules/.bin/lingui compile && ./node_modules/.bin/vite dev --port 3120',
    url: 'http://localhost:3120',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { TERM: 'xterm' }
  },

  outputDir: 'reports/artifacts/',

  expect: {
    timeout: process.env.CI ? 20 * 1000 : 10 * 1000,
    toHaveScreenshot: { maxDiffPixels: 150, threshold: 0.25, animations: 'disabled' },
    toMatchSnapshot: { maxDiffPixels: 150, threshold: 0.25 }
  },

  globalTimeout: process.env.CI ? 30 * 60 * 1000 : 10 * 60 * 1000
});
