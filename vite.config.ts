import { readFileSync } from 'node:fs';

import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { type Plugin, defineConfig, loadEnv } from 'vite';

import { seoFiles } from './scripts/postbuild.mjs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

/** Serves robots.txt, sitemap.xml and llms.txt in dev, same three the build writes. */
const devSiteFiles = (env: Record<string, string>): Plugin => ({
  name: 'dev-site-files',
  apply: 'serve',
  // Ahead of TanStack Start, whose catch-all would answer these with the SPA shell.
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

export default defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },

  plugins: [
    tanstackStart({
      prerender: { enabled: true, crawlLinks: true, autoSubfolderIndex: true, failOnError: true },
      // $locale is dynamic, no crawl can discover its values. Add a line here per locale.
      pages: [
        { path: '/en', prerender: { enabled: true } },
        { path: '/fr', prerender: { enabled: true } },
        // Flat, not 404/index.html. Static hosts look for this exact filename.
        { path: '/404', prerender: { enabled: true, outputPath: '/404.html' } }
      ]
    }),

    react(),

    // Babel runs as its own plugin: @vitejs/plugin-react v6 dropped its `babel` option and
    // ignores one silently, which looks exactly like a macro that doesn't expand.
    babel({
      plugins: [
        // <Trans> and msg are syntax, not functions. Without this they reach the bundle and the
        // first render dies importing babel-plugin-macros.
        '@lingui/babel-plugin-lingui-macro',
        // Strips data-test* in production, which is what makes "never select by testid" real:
        // such a selector passes in dev and fails against the deployed site.
        ...(mode === 'production'
          ? [['babel-plugin-react-remove-properties', { properties: [/^data-test/] }] as [string, object]]
          : [])
      ],
      // Handles memoisation, so don't add useMemo/useCallback/React.memo for what it covers.
      presets: [reactCompilerPreset()]
    }),

    tailwindcss(),

    devSiteFiles(loadEnv(mode, process.cwd(), 'VITE_')),

    ...(process.env.ANALYZE === 'true'
      ? [visualizer({ filename: 'reports/bundle.html', gzipSize: true, brotliSize: true })]
      : [])
  ],

  define: { __APP_VERSION__: JSON.stringify(version) },

  build: {
    // public/assets/ is copied through verbatim. Sharing a directory with the hashed bundles
    // makes every size-limit glob and cache rule ambiguous.
    assetsDir: 'static'
  },

  server: { port: 3000 }
}));
