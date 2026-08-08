import { fileURLToPath } from 'node:url';

import babel from '@rolldown/plugin-babel';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Own config, not mergeConfig(viteConfig). TanStack Start would try to prerender and
 * generate the route tree during tests — we only need the Lingui babel plugin from that stack.
 */
export default defineConfig({
  plugins: [
    react(),
    // Just the macros. Compiler preset would only slow the suite down (same render output).
    // Without this, <Trans> throws "executed outside the context of compilation".
    babel({ plugins: ['@lingui/babel-plugin-lingui-macro'] })
  ],
  test: {
    name: 'react-app-fondation',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // 100% on src/. Demo scene + generated route tree + stories don't count.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/scene/demo/**', 'src/routeTree.gen.ts', 'src/**/*.stories.tsx', 'src/vite-env.d.ts'],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    },
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'dist-ssr', 'coverage', 'storybook-static'],
    env: { VITE_SITE_URL: '' }
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test')
  }
});
