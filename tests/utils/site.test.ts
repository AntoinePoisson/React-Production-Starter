import { afterEach, describe, expect, it, vi } from 'vitest';

/** `Site.ts` applies `SiteRules.ts` to `import.meta.env`. The rules themselves live next door. */
const loadSite = async (env: Record<string, string>) => {
  vi.resetModules();

  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);

  return import('@/utils/config/Site');
};

describe('Site', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should resolve the origin from VITE_SITE_URL', async () => {
    const { SITE_URL } = await loadSite({ VITE_SITE_URL: 'https://example.com/' });

    expect(SITE_URL).toBe('https://example.com');
  });

  it('should fall back to localhost when unset', async () => {
    const { SITE_URL } = await loadSite({ VITE_SITE_URL: '' });

    expect(SITE_URL).toBe('http://localhost:3000');
  });

  it('should build absolute URLs against the resolved origin', async () => {
    const { absoluteUrl } = await loadSite({ VITE_SITE_URL: 'https://example.com' });

    expect(absoluteUrl('/fr')).toBe('https://example.com/fr');
    expect(absoluteUrl('og-image.png')).toBe('https://example.com/og-image.png');
  });

  it('should expose consistent public and route paths below a mount point', async () => {
    const { SITE_BASE_PATH, publicPath, routePath } = await loadSite({ VITE_SITE_URL: 'https://example.com/app' });

    expect(SITE_BASE_PATH).toBe('/app');
    expect(publicPath('/icons/favicon.svg')).toBe('/app/icons/favicon.svg');
    expect(routePath('/app/fr')).toBe('/fr');
  });
});
