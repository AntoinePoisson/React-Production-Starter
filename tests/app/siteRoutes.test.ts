import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FALLBACK_URL,
  basePathFromSiteUrl,
  resolveSiteUrl,
  toAbsoluteUrl,
  withBasePath,
  withoutBasePath
} from '@/utils/config/SiteRules';

import { seoFiles } from '../../scripts/postbuild.mjs';

// `process.cwd()` rather than `import.meta.url`: under Vitest's module runner the latter is an
// http:// URL, which `fileURLToPath` refuses.
const PROJECT_ROOT = process.cwd();
const PRODUCTION_URL = 'https://example.com';

describe('Site origin rules', () => {
  describe('resolveSiteUrl', () => {
    it('should fall back to localhost when nothing is configured', () => {
      expect(resolveSiteUrl(undefined)).toBe(FALLBACK_URL);
      expect(resolveSiteUrl('')).toBe(FALLBACK_URL);
    });

    it('should strip trailing slashes so URL joining stays predictable', () => {
      expect(resolveSiteUrl(`${PRODUCTION_URL}/`)).toBe(PRODUCTION_URL);
      expect(resolveSiteUrl(`${PRODUCTION_URL}///`)).toBe(PRODUCTION_URL);
    });
  });

  describe('toAbsoluteUrl', () => {
    it('should join a root-relative path onto the origin', () => {
      expect(toAbsoluteUrl('/fr', PRODUCTION_URL)).toBe(`${PRODUCTION_URL}/fr`);
      expect(toAbsoluteUrl('sitemap.xml', PRODUCTION_URL)).toBe(`${PRODUCTION_URL}/sitemap.xml`);
    });

    it('should keep the base path under a sub-path deployment', () => {
      // The leading slash has to be stripped first: a root-relative reference resets to the
      // origin, which would silently drop `/app` from every URL in the sitemap.
      expect(toAbsoluteUrl('/fr', 'https://example.com/app')).toBe('https://example.com/app/fr');
    });
  });

  describe('deployment base paths', () => {
    it('should derive the mount point from the full site URL', () => {
      expect(basePathFromSiteUrl('https://example.com')).toBe('');
      expect(basePathFromSiteUrl('https://example.com/app/')).toBe('/app');
    });

    it('should prefix routes and assets exactly once', () => {
      expect(withBasePath('/fr', '')).toBe('/fr');
      expect(withBasePath('fr', '/app')).toBe('/app/fr');
      expect(withBasePath('/app', '/app')).toBe('/app');
      expect(withBasePath('/app/icons/favicon.svg', '/app')).toBe('/app/icons/favicon.svg');
    });

    it('should recover route paths from browser locations', () => {
      expect(withoutBasePath('', '')).toBe('/');
      expect(withoutBasePath('/fr', '')).toBe('/fr');
      expect(withoutBasePath('/app', '/app')).toBe('/');
      expect(withoutBasePath('/app/fr', '/app')).toBe('/fr');
      expect(withoutBasePath('/elsewhere', '/app')).toBe('/elsewhere');
      expect(withoutBasePath('', '/app')).toBe('/');
    });
  });
});

describe('Generated SEO files', () => {
  /** The same function the build and the dev server both call. */
  const generate = (env: Record<string, string | undefined>) => {
    const { files } = seoFiles(env);

    return { robots: files['robots.txt'], sitemap: files['sitemap.xml'], llms: files['llms.txt'] };
  };

  it('should allow crawling and advertise the sitemap', () => {
    const { robots } = generate({ VITE_SITE_URL: PRODUCTION_URL });

    expect(robots).toContain('Allow: /');
    expect(robots).not.toContain('Disallow: /');
    expect(robots).toContain(`Sitemap: ${PRODUCTION_URL}/sitemap.xml`);
  });

  it('should list every locale, cross-linked with its translations', () => {
    const { sitemap } = generate({ VITE_SITE_URL: PRODUCTION_URL });

    expect(sitemap).toContain(`<loc>${PRODUCTION_URL}/</loc>`);
    expect(sitemap).toContain(`<loc>${PRODUCTION_URL}/fr</loc>`);
    // Translations listed without being cross-linked read as duplicate content.
    expect(sitemap).toContain('hreflang="fr-FR"');
    expect(sitemap).toContain('hreflang="x-default"');
  });

  it('should keep every generated URL below a deployment base path', () => {
    const siteUrl = 'https://example.com/app';
    const { robots, sitemap, llms } = generate({ VITE_SITE_URL: siteUrl });

    expect(robots).toContain(`${siteUrl}/sitemap.xml`);
    expect(sitemap).toContain(`<loc>${siteUrl}/</loc>`);
    expect(sitemap).toContain(`<loc>${siteUrl}/fr</loc>`);
    expect(llms).toContain(`(${siteUrl}/fr)`);
  });

  it('should publish links in llms.txt', () => {
    const { llms } = generate({ VITE_SITE_URL: PRODUCTION_URL });

    expect(llms).toContain('## Pages');
    expect(llms).toContain(`(${PRODUCTION_URL}/fr)`);
  });

  it('should keep llms.txt under 2 kB', () => {
    const { llms } = generate({ VITE_SITE_URL: PRODUCTION_URL });

    // Its whole value is that a model can read all of it before deciding what to fetch.
    expect(Buffer.byteLength(llms, 'utf-8')).toBeLessThan(2048);
  });

  it('should behave identically with no origin configured, on localhost', () => {
    // One behaviour, always. A build that decides for itself whether to be indexable is one
    // that ships `noindex` to production the day a CI variable goes missing.
    const { robots, sitemap, llms } = generate({});

    expect(robots).toContain('Allow: /');
    expect(sitemap).toContain(`<loc>${FALLBACK_URL}/</loc>`);
    expect(llms).toContain('## Pages');
  });
});

describe('Static files that must not exist', () => {
  it.each(['robots.txt', 'sitemap.xml', 'llms.txt'])('should not ship public/%s', (name) => {
    // A file in `public/` is copied over the generated one, hardcoding a single domain into
    // every environment.
    expect(existsSync(join(PROJECT_ROOT, 'public', name))).toBe(false);
  });
});
