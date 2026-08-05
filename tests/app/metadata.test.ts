import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CONTENT_SECURITY_POLICY, THEME_COLOR, rootHead } from '@/app/Metadata';
import { LOCALES, localePath } from '@/i18n/Routing';

/**
 * The `<head>` of every pre-rendered page.
 *
 * Asserted as data rather than as rendered HTML, which is the reason `rootHead` and `localeHead`
 * are plain functions: a crawler reads these tags and never runs a click, so what matters is the
 * exact set of tags produced for a locale — not how React chose to serialise them.
 */

/** Fresh module graph per case: the origin is read once, at import time. */
const loadMetadata = async (env: Record<string, string> = {}) => {
  vi.resetModules();

  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);

  return import('@/app/Metadata');
};

describe('rootHead', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('should declare the encoding before anything else', () => {
    // The CSP is meta-delivered, and a meta policy only governs what follows it — while the
    // encoding declaration must land in the document's first 1024 bytes. Second in line, not
    // first, is the only position that satisfies both.
    const { meta } = rootHead();

    expect(meta[0]).toEqual({ charSet: 'utf-8' });
    // `httpEquiv`, not `http-equiv`: these go through React, which drops the HTML spelling.
    expect(meta[1].httpEquiv).toBe('Content-Security-Policy');
  });

  it('should allow pinch-zoom', () => {
    const viewport = rootHead().meta.find((tag) => tag.name === 'viewport');

    // Blocking it fails WCAG 1.4.4. Double-tap zoom is stopped with `touch-action` on the
    // canvas instead, which costs nobody their ability to read.
    expect(viewport?.content).not.toContain('user-scalable=no');
    expect(viewport?.content).not.toContain('maximum-scale');
    expect(viewport?.content).toContain('viewport-fit=cover');
  });

  it('should never declare the same meta name twice', () => {
    // The head deduplicates by `name` and keeps the last one, so a duplicate is not two tags —
    // it is one tag silently replacing another, in the built HTML only. This shipped once as a
    // light/dark `theme-color` pair: `media` is not part of the dedup key, the light tag was
    // dropped, and every visitor on a dark OS got dark browser chrome around a light page.
    const names = rootHead()
      .meta.map((tag) => tag.name)
      .filter(Boolean);

    expect(names).toEqual([...new Set(names)]);
  });

  it('should declare one unconditional theme colour', () => {
    const themeColors = rootHead().meta.filter((tag) => tag.name === 'theme-color');

    // The page has no dark mode to match — `[data-theme='dark']` is never set — so a scheme-aware
    // pair would tint the chrome for a state the document never enters. Emit it from postbuild,
    // not from here, on the day that changes.
    expect(themeColors).toHaveLength(1);
    expect(themeColors[0].media).toBeUndefined();
    expect(themeColors[0].content).toBe(THEME_COLOR.light);
  });

  it('should link the manifest and every icon size', () => {
    const rels = rootHead().links.map((link) => link.rel);

    expect(rels).toContain('manifest');
    expect(rels).toContain('apple-touch-icon');
    expect(rels.filter((rel) => rel === 'icon')).toHaveLength(2);
  });
});

describe('localeHead', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each(LOCALES)('should give %s its own canonical', async (locale) => {
    const { localeHead } = await loadMetadata({ VITE_SITE_URL: 'https://example.com' });
    const canonical = localeHead(locale).links.find((link) => link.rel === 'canonical');

    expect(canonical?.href).toBe(`https://example.com${localePath(locale) === '/' ? '/' : localePath(locale)}`);
  });

  it('should cross-link every locale plus x-default', async () => {
    const { localeHead } = await loadMetadata({ VITE_SITE_URL: 'https://example.com' });
    const alternates = localeHead('en').links.filter((link) => link.rel === 'alternate');

    // Without these the locales read as duplicate content rather than translations.
    expect(alternates.map((link) => link.hrefLang)).toEqual(['en-US', 'fr-FR', 'x-default']);
  });

  it('should translate the description and the social preview alt text', async () => {
    const { localeHead } = await loadMetadata({ VITE_SITE_URL: 'https://example.com' });

    const english = localeHead('en').meta.find((tag) => tag.name === 'description')?.content;
    const french = localeHead('fr').meta.find((tag) => tag.name === 'description')?.content;

    expect(english).toBeTruthy();
    expect(french).toBeTruthy();
    expect(french).not.toBe(english);
  });

  it('should use the underscore form of the locale tag for Open Graph', async () => {
    const { localeHead } = await loadMetadata({ VITE_SITE_URL: 'https://example.com' });
    const ogLocale = localeHead('fr').meta.find((tag) => tag.property === 'og:locale');

    expect(ogLocale?.content).toBe('fr_FR');
  });

  it('should declare the social image dimensions', async () => {
    const { localeHead } = await loadMetadata({ VITE_SITE_URL: 'https://example.com' });
    const { meta } = localeHead('en');

    // Some crawlers skip an image that does not declare them.
    expect(meta.find((tag) => tag.property === 'og:image:width')?.content).toBe('1200');
    expect(meta.find((tag) => tag.property === 'og:image:height')?.content).toBe('630');
    expect(meta.find((tag) => tag.name === 'twitter:card')?.content).toBe('summary_large_image');
  });

  it('should point the social image at an absolute URL', async () => {
    const { localeHead } = await loadMetadata({ VITE_SITE_URL: 'https://example.com' });
    const image = localeHead('en').meta.find((tag) => tag.property === 'og:image');

    // A relative og:image is ignored by every scraper.
    expect(image?.content).toBe('https://example.com/og-image.png');
  });

  it.each(['https://example.com', ''])('should declare the page indexable with origin %j', async (origin) => {
    // One behaviour, always. A build that decides for itself ships `noindex` to production the
    // day a CI variable goes missing; keeping a preprod out of the index is the host's job.
    const { localeHead } = await loadMetadata({ VITE_SITE_URL: origin });
    const robots = localeHead('en').meta.find((tag) => tag.name === 'robots');

    expect(robots?.content).toBe('index, follow');
  });

  it('should omit twitter:site when no handle is configured', async () => {
    const { localeHead } = await loadMetadata({ VITE_SITE_URL: 'https://example.com' });
    const twitterSite = localeHead('en').meta.find((tag) => tag.name === 'twitter:site');

    // Pointing the card at a handle you do not own hands your social preview to a stranger.
    expect(twitterSite).toBeUndefined();
  });
});

describe('Content Security Policy', () => {
  it('should carry every directive the app needs and nothing more', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    // The Draco decoder instantiates a WebAssembly module.
    expect(CONTENT_SECURITY_POLICY).toContain("'wasm-unsafe-eval'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'self'");
    // Ignored in a meta tag, and logged as an error for every visitor if declared there anyway.
    expect(CONTENT_SECURITY_POLICY).not.toContain('frame-ancestors');
    // Belongs at the edge, where the origin is already HTTPS. WebKit does not exempt localhost
    // from the upgrade, so declaring it here breaks every HTTP origin: the E2E run, a preview
    // box, a phone on the LAN. Chromium and Firefox hide it by exempting local origins.
    expect(CONTENT_SECURITY_POLICY).not.toContain('upgrade-insecure-requests');
    // `'unsafe-inline'` is a documented compromise; `'unsafe-eval'` is never one.
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'");
  });
});
