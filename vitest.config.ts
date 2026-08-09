import { fileURLToPath } from 'node:url';

import babel from '@rolldown/plugin-babel';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Standalone rather than mergeConfig(viteConfig, ...). The TanStack Start plugin owns the
 * prerender pass, the server build and the route-tree generation, none of which a unit test
 * wants. The Babel pass is the only thing the tests need from the app build.
 */
export default defineConfig({
  plugins: [
    react(),
    // Lingui macros only. No reactCompilerPreset(): it changes when memoised values are
    // recomputed, never what a component renders, so it would just slow the suite down.
    // <Trans> is syntax though, without this every translated component throws
    // "executed outside the context of compilation" on render.
    babel({ plugins: ['@lingui/babel-plugin-lingui-macro'] })
  ],
  test: {
    name: 'react-app-fondation',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // 100% enforced on src/, the run fails below it. The exclusions are the things that aren't
    // the template's own code: scene/demo is placeholder content, routeTree.gen.ts is generated.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/scene/demo/**', 'src/routeTree.gen.ts', 'src/**/*.stories.tsx', 'src/vite-env.d.ts'],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    },
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'dist-ssr', 'coverage', 'storybook-static']
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test')
  }
});
