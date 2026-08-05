/**
 * Origin resolution, with no dependency on how the environment is read.
 *
 * Split from `Site.ts` because that one reads `import.meta.env`, which does not exist in Node —
 * and `scripts/postbuild.mjs` runs there. Both share these functions rather than each carrying
 * a copy of the rule.
 */

export const FALLBACK_URL = 'http://localhost:3000';

/** Strip the trailing slash: `new URL(path, base)` and every comparison assume none. */
const normalise = (url: string): string => url.replace(/\/+$/, '');

export const resolveSiteUrl = (siteUrl: string | undefined): string => normalise(siteUrl || FALLBACK_URL);

/**
 * Absolute URL for a path on this site. The leading slash has to be stripped: a root-relative
 * reference resets to the origin, so `new URL('/fr', 'https://example.com/app')` drops the base
 * path — which would kill every URL in the sitemap under a sub-path deployment.
 */
export const toAbsoluteUrl = (path: string, siteUrl: string): string =>
  new URL(path.replace(/^\/+/, ''), `${normalise(siteUrl)}/`).toString();
