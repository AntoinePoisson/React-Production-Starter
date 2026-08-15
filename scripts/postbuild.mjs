#!/usr/bin/env node

/**
 * What `vite build` doesn't emit: robots, sitemap, llms.txt, the SW, and
 * moving the CSP meta after <meta charset>.
 *
 * seoFiles() is also used by the dev server (vite.config.ts).
 *
 *   node scripts/postbuild.mjs [outDir]   # defaults to dist/client
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSW } from 'workbox-build';

import { DEFAULT_LOCALE, LOCALES, LOCALE_LABELS, alternateLanguages, localePath } from '../src/i18n/Routing.ts';
import { SITE_TITLE } from '../src/utils/config/Identity.ts';
import {
  basePathFromSiteUrl,
  resolveSiteUrl,
  toAbsoluteUrl,
  withBasePath,
  withoutBasePath
} from '../src/utils/config/SiteRules.ts';

const colors = { reset: '\x1b[0m', green: '\x1b[32m', blue: '\x1b[36m' };

/**
 * Always indexable. Keep a preprod out of Google with an X-Robots-Tag at the
 * host — if the build decides, a missing CI var ships noindex to prod.
 */
export function seoFiles(env = process.env) {
  const siteUrl = resolveSiteUrl(env.VITE_SITE_URL);
  const basePath = basePathFromSiteUrl(siteUrl);
  const url = (path) => toAbsoluteUrl(path, siteUrl);

  const robots = `User-Agent: *\nAllow: /\n\nHost: ${new URL(siteUrl).origin}\nSitemap: ${url('sitemap.xml')}\n`;

  // Without these, the translations look like duplicate pages.
  const alternates = Object.entries(alternateLanguages())
    .map(([tag, path]) => `      <xhtml:link rel="alternate" hreflang="${tag}" href="${url(path)}" />`)
    .join('\n');

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...LOCALES.map((locale) =>
      [
        '  <url>',
        `    <loc>${url(localePath(locale))}</loc>`,
        '    <changefreq>weekly</changefreq>',
        `    <priority>${locale === DEFAULT_LOCALE ? '1.0' : '0.9'}</priority>`,
        alternates,
        '  </url>'
      ].join('\n')
    ),
    '</urlset>',
    ''
  ].join('\n');

  // llmstxt.org. Short, links not essays. Test caps this at 2 kB.
  const englishNames = new Intl.DisplayNames(['en'], { type: 'language' });

  const llms = [
    `# ${SITE_TITLE}`,
    '',
    `> ${SITE_TITLE} is a starter template built on React, Vite and React Three Fiber: a single interactive 3D scene rendered in the browser, with a DOM overlay above it.`,
    '',
    'All copy lives in the DOM rather than in a 3D texture, so the pages below carry their text',
    'in the HTML. Nothing readable is locked inside the WebGL canvas.',
    '',
    '## Pages',
    '',
    ...LOCALES.map((l) => `- [${LOCALE_LABELS[l]}](${url(localePath(l))}): The site in ${englishNames.of(l)}.`),
    '',
    '## Optional',
    '',
    `- [Sitemap](${url('sitemap.xml')}): Every page, cross-linked with its translations.`,
    `- [humans.txt](${url('humans.txt')}): Who built the site, and with what.`,
    ''
  ].join('\n');

  return { siteUrl, basePath, files: { 'robots.txt': robots, 'sitemap.xml': sitemap, 'llms.txt': llms } };
}

const CSP_META = /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i;
const STYLESHEET_LINK = /<link[^>]*\srel=["']stylesheet["'][^>]*>/gi;
const LINK_HREF = /\shref=["']([^"']+)["']/i;
// Against the decoded policy. React turns ' into &#x27;, and that semicolon
// would kill a [^;]* match halfway through the directive.
const STYLE_SRC = /style-src [^;]*/;
const ESCAPED_QUOTE = '&#x27;';

/**
 * Inline the build's stylesheet and add its hash to the CSP. Last render-blocking
 * request before first paint, for ~3 kB.
 *
 * __root.tsx still declares the sheet, so React puts the <link> back on hydrate —
 * the file has to stay in static/. readCss is a param so we can test this on a string.
 */
export function inlineStylesheet(html, readCss, basePath = '') {
  const hashes = [];
  const staticPrefix = withBasePath('/static/', basePath);

  const withStyles = html.replace(STYLESHEET_LINK, (tag) => {
    const href = tag.match(LINK_HREF)?.[1];
    // Anything else is a third-party sheet we don't have on disk.
    if (!href?.startsWith(staticPrefix)) return tag;

    const css = readCss(href);
    hashes.push(`sha256-${createHash('sha256').update(css).digest('base64')}`);

    return `<style>${css}</style>`;
  });

  if (hashes.length === 0) return html;

  return withStyles.replace(CSP_META, (tag) => {
    const decoded = tag.replaceAll(ESCAPED_QUOTE, "'");

    // Don't ship a page whose CSP blocks its own CSS. Looks like an unstyled
    // site and a green build.
    if (!STYLE_SRC.test(decoded)) {
      throw new Error('CSP declares no style-src, the inlined stylesheet would be blocked.');
    }

    const authorised = decoded.replace(STYLE_SRC, (directive) =>
      [directive, ...hashes.map((hash) => `'${hash}'`)].join(' ')
    );

    return authorised.replaceAll("'", ESCAPED_QUOTE);
  });
}

/**
 * Static hosts serve this for every unknown path. Hydrating /404's state at
 * /anything makes React throw #418, so the deployed 404 is just HTML — no scripts.
 */
export function makeStaticNotFound(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

// Skip when vite.config.ts just imports seoFiles().
if (import.meta.main) {
  const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
  const OUT_DIR = join(PROJECT_ROOT, process.argv[2] ?? 'dist/client');

  const { siteUrl, basePath, files } = seoFiles();

  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(OUT_DIR, name), content);
    console.info(`${colors.green}✓${colors.reset} ${name}`);
  }

  console.info(`${colors.blue}Origin${colors.reset} ${siteUrl}`);

  // After prerender, so the worker caches what actually shipped.
  const { count, size } = await generateSW({
    globDirectory: OUT_DIR,
    globPatterns: ['**/*.{js,css,html,svg,png,ico,json,txt}'],
    // Draco is 760 kB and only loads for a Draco model. OG image is for crawlers.
    globIgnores: ['assets/models/draco/**', 'og-image.png', 'sw.js', 'workbox-*.js'],
    swDest: join(OUT_DIR, 'sw.js'),
    // Each route has its own HTML. If this is set, /fr gets /index.html.
    navigateFallback: undefined,
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
  });

  const swUrl = withBasePath('/sw.js', basePath);
  const swScope = `${basePath || ''}/`;
  writeFileSync(
    join(OUT_DIR, 'registerSW.js'),
    `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('${swUrl}',{scope:'${swScope}'})})}\n`
  );

  // Head is built with CSS + module preloads before the CSP, and a meta policy
  // only covers what follows it. After charset (has to be in the first 1024 bytes),
  // not before.
  // eslint is wrong about this regex — `[^>]*` can't overlap.
  // eslint-disable-next-line security/detect-unsafe-regex
  const HEAD_OPEN = /<head(?:\s[^>]*)?>/i;
  const CHARSET_META = /<meta[^>]*\scharset=["'][^"']*["'][^>]*>/i;
  const SW_TAG = `<script src="${withBasePath('/registerSW.js', basePath)}" defer></script>`;

  const htmlFiles = (function walk(dir) {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return entry.endsWith('.html') ? [full] : [];
    });
  })(OUT_DIR);

  let patched = 0;

  for (const file of htmlFiles) {
    let html = readFileSync(file, 'utf-8');
    const before = html;
    const isStaticNotFound = file === join(OUT_DIR, '404.html');

    if (!isStaticNotFound && !html.includes(SW_TAG)) html = html.replace('</body>', `${SW_TAG}</body>`);

    // Before we move the CSP — that reads its position from the patched HTML.
    html = inlineStylesheet(
      html,
      (href) => {
        const localPath = withoutBasePath(new URL(href, siteUrl).pathname, basePath);
        return readFileSync(join(OUT_DIR, localPath.slice(1)), 'utf-8');
      },
      basePath
    );

    if (isStaticNotFound) html = makeStaticNotFound(html);

    const meta = html.match(CSP_META);
    const head = html.match(HEAD_OPEN);

    if (meta && head) {
      const charset = html.match(CHARSET_META);
      const anchor =
        charset && charset.index > head.index ? charset.index + charset[0].length : head.index + head[0].length;

      if (meta.index > anchor) {
        const stripped = html.slice(0, meta.index) + html.slice(meta.index + meta[0].length);
        html = stripped.slice(0, anchor) + meta[0] + stripped.slice(anchor);
      }
    }

    if (html === before) continue;

    writeFileSync(file, html);
    patched++;
  }

  console.info(
    `${colors.green}✓ service worker${colors.reset} ${count} file(s), ${(size / 1024).toFixed(0)} kB · ` +
      `${colors.green}${patched} page(s)${colors.reset} finalised`
  );
}
