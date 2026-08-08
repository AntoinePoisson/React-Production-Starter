import { readFileSync } from 'node:fs';

import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { type Plugin, defineConfig, loadEnv } from 'vite';

import { seoFiles } from './scripts/postbuild.mjs';
import { basePathFromSiteUrl, resolveSiteUrl } from './src/utils/config/SiteRules.ts';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

/** Same robots / sitemap / llms.txt as the build, so they exist in `pnpm dev` too. */
const devSiteFiles = (env: Record<string, string>): Plugin => ({
  name: 'dev-site-files',
  apply: 'serve',
  // Has to run before TanStack Start, otherwise you get the SPA shell for these URLs.
  enforce: 'pre',
  configureServer(server) {
    const { files } = seoFiles(env);

    server.middlewares.use((req, res, next) => {
      const name = req.url?.slice(1).split('?')[0] ?? '';
      const body = files[name as keyof typeof files];

      if (!body) return next();

      res.setHeader('Content-Type', name.endsWith('.xml') ? 'application/xml' : 'text/plain; charset=utf-8');
      res.end(body);
    });
  }
});

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const configuredSiteUrl = env.VITE_SITE_URL || process.env.VITE_SITE_URL;

  if (command === 'build' && process.env.CI && !configuredSiteUrl) {
    throw new Error('VITE_SITE_URL is required for a CI production build.');
  }

  const siteUrl = resolveSiteUrl(configuredSiteUrl);
  const basePath = basePathFromSiteUrl(siteUrl);

  return {
    // One base for chunks and for the router. Matters on GH Pages (sub-path).
    base: `${basePath || ''}/`,
    resolve: { tsconfigPaths: true },

    plugins: [
      tanstackStart({
        prerender: { enabled: true, crawlLinks: true, autoSubfolderIndex: true, failOnError: true },
        // $locale is dynamic so the crawler never finds /en or /fr on its own.
        // New locale? Add a line here or it won't be in the build.
        pages: [
          { path: '/en', prerender: { enabled: true } },
          { path: '/fr', prerender: { enabled: true } },
          // 404.html at the root, not 404/index.html — that's what static hosts look for.
          { path: '/404', prerender: { enabled: true, outputPath: '/404.html' } }
        ]
      }),

      react(),

      // plugin-react v6 dropped the `babel` option and just ignores it if you pass one.
      // Easy to miss — macros look like they never ran.
      babel({
        plugins: [
          // <Trans> / msg are syntax. Skip this and the first render dies on babel-plugin-macros.
          '@lingui/babel-plugin-lingui-macro',
          // Strip data-test* in prod. That's why e2e never selects by testid:
          // it works in dev and then dies on the real site.
          ...(mode === 'production'
            ? [['babel-plugin-react-remove-properties', { properties: [/^data-test/] }] as [string, object]]
            : [])
        ],
        // React Compiler. Don't wrap things in useMemo/useCallback just because.
        presets: [reactCompilerPreset()]
      }),

      tailwindcss(),

      devSiteFiles(env),

      ...(process.env.ANALYZE === 'true'
        ? [visualizer({ filename: 'reports/bundle.html', gzipSize: true, brotliSize: true })]
        : [])
    ],

    define: { __APP_VERSION__: JSON.stringify(version) },

    build: {
      // Hashed JS goes in static/, so it doesn't mix with public/assets/ (copied as-is).
      assetsDir: 'static'
    },

    server: { port: 3000 }
  };
});
