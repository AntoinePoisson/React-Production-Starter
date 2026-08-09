import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_LOCALE, LOCALES } from '@/i18n/Routing';

// createFileRoute and createRootRoute are stubbed to hand back the options object. What's worth
// asserting is the config, not TanStack's ability to build a route from it.
const notFound = vi.fn(() => new Error('notFound'));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  createRootRoute: (options: unknown) => options,
  notFound,
  HeadContent: () => null,
  Scripts: () => null,
  useRouterState: () => '/',
  Link: () => null
}));

vi.mock('@/app/globals.css?url', () => ({ default: '/assets/globals.css' }));

const { Route: indexRoute } = await import('@/routes/index');
const { Route: localeRoute } = await import('@/routes/$locale');
const { Route: notFoundRoute } = await import('@/routes/404');

type RouteOptions = {
  head?: (ctx: { params: { locale: string } }) => { meta: Record<string, string>[]; links: Record<string, string>[] };
  beforeLoad?: (ctx: { params: { locale: string } }) => void;
  component?: unknown;
};

describe('/', () => {
  it('should serve the default locale from the bare domain', () => {
    const head = (indexRoute as RouteOptions).head?.({ params: { locale: '' } });
    const canonical = head?.links.find((link) => link.rel === 'canonical');

    // / and /en render the same page, /en canonicals here, so only one gets indexed.
    expect(canonical?.href.endsWith('/')).toBe(true);
    expect(head?.meta.some((tag) => tag.property === 'og:locale')).toBe(true);
  });
});

describe('/$locale', () => {
  it.each(LOCALES)('should accept %s', (locale) => {
    notFound.mockClear();

    (localeRoute as RouteOptions).beforeLoad?.({ params: { locale } });

    expect(notFound).not.toHaveBeenCalled();
  });

  it('should reject an unknown segment', () => {
    notFound.mockClear();

    // The segment matches anything, so without this /nonsense renders the home page under a
    // canonical claiming to be a language.
    expect(() => (localeRoute as RouteOptions).beforeLoad?.({ params: { locale: 'nonsense' } })).toThrow();
    expect(notFound).toHaveBeenCalled();
  });

  it('should build the head for a valid locale', () => {
    const head = (localeRoute as RouteOptions).head?.({ params: { locale: 'fr' } });

    expect(head?.meta.find((tag) => tag.property === 'og:locale')?.content).toBe('fr_FR');
  });

  it('should return an empty head for an unknown segment', () => {
    // head() runs even for a match beforeLoad is about to reject, so it has to tolerate one.
    const head = (localeRoute as RouteOptions).head?.({ params: { locale: 'nonsense' } });

    expect(head).toEqual({});
  });

  it('should have every locale listed for pre-rendering', async () => {
    const { readFileSync } = await import('node:fs');
    const viteConfig = readFileSync('vite.config.ts', 'utf-8');

    // $locale is dynamic, so no crawl discovers its values, they're listed in the plugin's
    // `pages`. A locale added to LOCALES without a line there compiles, renders in dev, and is
    // simply absent from the build.
    for (const locale of LOCALES) {
      expect(viteConfig, `/${locale} is not listed for pre-rendering in vite.config.ts`).toContain(`'/${locale}'`);
    }

    expect(LOCALES).toContain(DEFAULT_LOCALE);
  });
});

describe('/404', () => {
  it('should render the not-found page', () => {
    // A real route purely so the build emits 404.html, which is what a static host serves for an
    // unknown path.
    expect((notFoundRoute as RouteOptions).component).toBeDefined();
  });
});
