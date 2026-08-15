import { defineConfig, devices } from '@playwright/test';

const deploymentBasePath =
  process.env.CI && process.env.VITE_SITE_URL ? new URL(process.env.VITE_SITE_URL).pathname.replace(/\/+$/, '') : '';
const testServerUrl = `http://localhost:3120${deploymentBasePath || ''}`;

/**
 * Chromium / Firefox / WebKit + Pixel 5 / iPhone 14.
 * Vitals come from pageWithVitals. Screenshot compare is wired but unused for now.
 */
export default defineConfig({
  testDir: './e2e',

  snapshotDir: './reports/baseline-snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{-projectName}{-snapshotSuffix}{ext}',

  // Longest spec is ~30s boot + 3 viewport changes × 20s (see RESIZE_SETTLE_TIMEOUT).
  timeout: process.env.CI ? 120 * 1000 : 60 * 1000,

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,

  // 2 workers on CI. No GPU, SwiftShader + autoRotate = the main thread dies if you go to 4.
  // Timeouts then look like broken selectors. If it's slow on CI and fine locally, start here.
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
    baseURL: process.env.BASE_URL || testServerUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    viewport: { width: 1920, height: 1080 },
    navigationTimeout: 30 * 1000,
    // Same reason as workers: software GL is slow.
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
    // CI hits the real build (what we ship). Locally, vite dev is faster.
    // dist/serve, not dist/client: `serve` mounts at /, GH Pages lives under /<repo>,
    // so the job copies the build under that path first. Never serve dist/ — that's
    // also the server render output.
    command: process.env.CI
      ? './node_modules/.bin/serve ./dist/serve --listen 3120 --config ../../config/serve.json --no-clipboard --no-request-logging --no-port-switching'
      : 'lsof -ti :3120 | xargs kill -9 2>/dev/null || true && ./node_modules/.bin/lingui compile && ./node_modules/.bin/vite dev --port 3120',
    url: testServerUrl,
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
