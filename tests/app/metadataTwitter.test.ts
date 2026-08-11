import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The one branch the default config never hits: TWITTER_HANDLE is empty so we
 * don't point twitter:site at a handle nobody owns. This covers the other side.
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
