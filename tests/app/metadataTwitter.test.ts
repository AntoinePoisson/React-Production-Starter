import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The one branch in `localeHead` that the default configuration cannot reach: the template ships
 * `TWITTER_HANDLE = ''` on purpose, so the tag is omitted rather than pointed at a handle nobody
 * owns. This covers the other side of that decision.
 */
describe('localeHead with a configured Twitter handle', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock('@/utils/config/Identity');
  });

  it('should emit twitter:site', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SITE_URL', 'https://example.com');
    vi.doMock('@/utils/config/Identity', () => ({
      SITE_TITLE: 'React App Fondation',
      AUTHOR: 'Antoine Poisson',
      TWITTER_HANDLE: '@example'
    }));

    const { localeHead } = await import('@/app/Metadata');
    const twitterSite = localeHead('en').meta.find((tag) => tag.name === 'twitter:site');

    expect(twitterSite?.content).toBe('@example');
  });
});
