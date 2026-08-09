// Split out of Site.ts, which reads import.meta.env: that doesn't exist in Node and
// scripts/postbuild.mjs runs there.

export const FALLBACK_URL = 'http://localhost:3000';

const normalise = (url: string): string => url.replace(/\/+$/, '');

export const resolveSiteUrl = (siteUrl: string | undefined): string => normalise(siteUrl || FALLBACK_URL);

// The leading slash has to go: new URL('/fr', 'https://example.com/app') drops the base path,
// which would break every sitemap URL under a sub-path deployment.
export const toAbsoluteUrl = (path: string, siteUrl: string): string =>
  new URL(path.replace(/^\/+/, ''), `${normalise(siteUrl)}/`).toString();
