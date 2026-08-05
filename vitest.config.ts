import { fileURLToPath } from 'node:url';

import babel from '@rolldown/plugin-babel';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Deliberately standalone rather than `mergeConfig(viteConfig, …)`: the TanStack Start plugin
 * owns the pre-render pass, the server build and the route-tree generation, none of which a unit
 * test wants. What the tests do need from the app build is the Babel pass.
 */
export default defineConfig({
  plugins: [
    react(),
    // Lingui macros only. No `reactCompilerPreset()` here: the compiler changes when memoised
    // values are recomputed, never what a component renders, so running it would slow the suite
    // down to assert nothing extra. `<Trans>` on the other hand is syntax — without this every
    // translated component throws "executed outside the context of compilation" on render.
    babel({ plugins: ['@lingui/babel-plugin-lingui-macro'] })
  ],
  test: {
    name: 'react-app-fondation',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // 100% is enforced on `src/` — `pnpm test` fails below it. The exclusions are the two things
    // that are not the template's own machinery: `src/scene/demo/` is placeholder content meant
    // to be deleted on day one, and `routeTree.gen.ts` is generated from the file tree.
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
