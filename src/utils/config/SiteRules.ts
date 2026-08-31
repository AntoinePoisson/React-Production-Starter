// Split out of Site.ts, which reads import.meta.env: that doesn't exist in Node and
// scripts/postbuild.mjs runs there.

export const FALLBACK_URL = 'http://localhost:3000';

const normalise = (url: string): string => url.replace(/\/+$/, '');

export const resolveSiteUrl = (siteUrl: string | undefined): string => normalise(siteUrl || FALLBACK_URL);

/**
 * The pathname a static host mounts the app under. Empty means the origin root. Deriving it from
 * VITE_SITE_URL keeps canonical URLs, Vite's public base, the router and hand-written asset URLs
 * on the same rule — the GitHub Pages project URL is the regression this exists for.
 */
export const basePathFromSiteUrl = (siteUrl: string): string => {
  return new URL(resolveSiteUrl(siteUrl)).pathname.replace(/\/+$/, '');
};

/** Prefix a route or public asset with the deployment base, without ever duplicating it. */
export const withBasePath = (path: string, basePath: string): string => {
  const suffix = `/${path.replace(/^\/+/, '')}`;
  if (!basePath) return suffix;
  if (suffix === basePath || suffix.startsWith(`${basePath}/`)) return suffix;

  return `${basePath}${suffix}`;
};

/** Turn a browser pathname back into the route tree's root-relative form. */
export const withoutBasePath = (pathname: string, basePath: string): string => {
  if (!basePath) return pathname || '/';
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);

  return pathname || '/';
};

// The leading slash has to go: new URL('/fr', 'https://example.com/app') drops the base path,
// which would break every sitemap URL under a sub-path deployment.
export const toAbsoluteUrl = (path: string, siteUrl: string): string =>
  new URL(path.replace(/^\/+/, ''), `${normalise(siteUrl)}/`).toString();
