// Split from Site.ts — that one reads import.meta.env, which doesn't exist in Node
// (postbuild.mjs runs there).

export const FALLBACK_URL = 'http://localhost:3000';

const normalise = (url: string): string => url.replace(/\/+$/, '');

export const resolveSiteUrl = (siteUrl: string | undefined): string => normalise(siteUrl || FALLBACK_URL);

/**
 * Path the host mounts us under. Empty = origin root.
 * Derived from VITE_SITE_URL so canonicals, Vite base, router and asset URLs
 * all agree. The GH Pages project URL is why this exists.
 */
export const basePathFromSiteUrl = (siteUrl: string): string => {
  return new URL(resolveSiteUrl(siteUrl)).pathname.replace(/\/+$/, '');
};

/** Prefix a path with the deploy base, without doubling it. */
export const withBasePath = (path: string, basePath: string): string => {
  const suffix = `/${path.replace(/^\/+/, '')}`;
  if (!basePath) return suffix;
  if (suffix === basePath || suffix.startsWith(`${basePath}/`)) return suffix;

  return `${basePath}${suffix}`;
};

/** Strip the deploy base, back to what the route tree expects. */
export const withoutBasePath = (pathname: string, basePath: string): string => {
  if (!basePath) return pathname || '/';
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);

  return pathname || '/';
};

// Drop the leading slash — new URL('/fr', 'https://example.com/app') eats the base path.
export const toAbsoluteUrl = (path: string, siteUrl: string): string =>
  new URL(path.replace(/^\/+/, ''), `${normalise(siteUrl)}/`).toString();
