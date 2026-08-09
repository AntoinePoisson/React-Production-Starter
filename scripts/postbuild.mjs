#!/usr/bin/env node

/**
 * Everything the built site needs that `vite build` doesn't produce: robots.txt, sitemap.xml,
 * llms.txt, the service worker, and the CSP meta tag's position in the document.
 *
 * seoFiles() is exported so the dev server can serve the same three files, see vite.config.ts.
 *
 * Usage: node scripts/postbuild.mjs [outDir]   # defaults to dist/client
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSW } from 'workbox-build';

import { DEFAULT_LOCALE, LOCALES, LOCALE_LABELS, alternateLanguages, localePath } from '../src/i18n/Routing.ts';
import { SITE_TITLE } from '../src/utils/config/Identity.ts';
import { resolveSiteUrl, toAbsoluteUrl } from '../src/utils/config/SiteRules.ts';

const colors = { reset: '\x1b[0m', green: '\x1b[32m', blue: '\x1b[36m' };

/**
 * Always indexable, whatever the origin. Keeping a preprod out of Google is an X-Robots-Tag
 * header at the host. A build that decides for itself ships noindex to production the day a CI
 * variable goes missing.
 */
export function seoFiles(env = process.env) {
  const siteUrl = resolveSiteUrl(env.VITE_SITE_URL);
  const url = (path) => toAbsoluteUrl(path, siteUrl);

  const robots = `User-Agent: *\nAllow: /\n\nHost: ${siteUrl}\nSitemap: ${url('sitemap.xml')}\n`;

  // Without the cross-links the translations read as duplicate content.
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

  // llmstxt.org. Keep it short, link rather than inline. A unit test caps it at 2 kB.
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

  return { siteUrl, files: { 'robots.txt': robots, 'sitemap.xml': sitemap, 'llms.txt': llms } };
}

const CSP_META = /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i;
const STYLESHEET_LINK = /<link[^>]*\srel=["']stylesheet["'][^>]*>/gi;
const LINK_HREF = /\shref=["']([^"']+)["']/i;
// Matched against the decoded policy. React escapes every ' in the attribute to &#x27;, whose
// trailing semicolon ends a [^;]* match halfway through the directive.
const STYLE_SRC = /style-src [^;]*/;
const ESCAPED_QUOTE = '&#x27;';

/**
 * Swaps every build-emitted stylesheet link for the sheet itself and authorises the result by
 * hash. It's the last render-blocking request in front of first paint, for 3 kB.
 *
 * __root.tsx still declares the sheet, so React re-inserts its <link> during hydration. That's
 * why the file has to stay in static/. readCss is a parameter so this is testable on a string.
 */
export function inlineStylesheet(html, readCss) {
  const hashes = [];

  const withStyles = html.replace(STYLESHEET_LINK, (tag) => {
    const href = tag.match(LINK_HREF)?.[1];
    // Anything else is a third party's sheet, whose bytes this build doesn't have.
    if (!href?.startsWith('/static/')) return tag;

    const css = readCss(href);
    hashes.push(`sha256-${createHash('sha256').update(css).digest('base64')}`);

    return `<style>${css}</style>`;
  });

  if (hashes.length === 0) return html;

  return withStyles.replace(CSP_META, (tag) => {
    const decoded = tag.replaceAll(ESCAPED_QUOTE, "'");

    // Throw rather than ship a page whose policy refuses its own stylesheet: that failure looks
    // like an unstyled document and a green build.
    if (!STYLE_SRC.test(decoded)) {
      throw new Error('CSP declares no style-src, the inlined stylesheet would be blocked.');
    }

    const authorised = decoded.replace(STYLE_SRC, (directive) =>
      [directive, ...hashes.map((hash) => `'${hash}'`)].join(' ')
    );

    return authorised.replaceAll("'", ESCAPED_QUOTE);
  });
}

// Only runs when this file is the entry point, not when vite.config.ts imports seoFiles().
if (import.meta.main) {
  const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
  const OUT_DIR = join(PROJECT_ROOT, process.argv[2] ?? 'dist/client');

  const { siteUrl, files } = seoFiles();

  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(OUT_DIR, name), content);
    console.info(`${colors.green}✓${colors.reset} ${name}`);
  }

  console.info(`${colors.blue}Origin${colors.reset} ${siteUrl}`);

  // After the prerender, so the worker caches the pages that actually shipped.
  const { count, size } = await generateSW({
    globDirectory: OUT_DIR,
    globPatterns: ['**/*.{js,css,html,svg,png,ico,json,txt}'],
    // The Draco decoder is 760 kB that useGLTF only fetches for a model carrying Draco data, and
    // the OG image is only ever requested by crawlers.
    globIgnores: ['assets/models/draco/**', 'og-image.png', 'sw.js', 'workbox-*.js'],
    swDest: join(OUT_DIR, 'sw.js'),
    // Every route has its own document. Enabled, the worker would answer /fr with /index.html.
    navigateFallback: undefined,
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
  });

  writeFileSync(
    join(OUT_DIR, 'registerSW.js'),
    "if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js',{scope:'/'})})}\n"
  );

  // The head gets assembled with the stylesheet and the module preloads ahead of the CSP, and a
  // meta policy only governs what follows it. After <meta charset> and not before, the encoding
  // declaration has to land within the first 1024 bytes.
  const HEAD_OPEN = /<head(?:\s[^>]*)?>/i;
  const CHARSET_META = /<meta[^>]*\scharset=["'][^"']*["'][^>]*>/i;
  const SW_TAG = '<script src="/registerSW.js" defer></script>';

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

    if (!html.includes(SW_TAG)) html = html.replace('</body>', `${SW_TAG}</body>`);

    // Before the move below, which reads the policy's position from the patched document.
    html = inlineStylesheet(html, (href) => readFileSync(join(OUT_DIR, href.slice(1)), 'utf-8'));

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
