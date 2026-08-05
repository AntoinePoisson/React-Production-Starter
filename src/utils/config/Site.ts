import { resolveSiteUrl, toAbsoluteUrl } from './SiteRules';

/**
 * The origin this build is for — canonical, og:url, robots.txt, sitemap.xml.
 *
 * Baked in at build time, so CI has to pass `VITE_SITE_URL` or every page ships a localhost
 * canonical. The pages are always declared indexable: keeping a preprod out of the index is the
 * host's job, through an `X-Robots-Tag` response header, not something a build can decide.
 */
export const SITE_URL = resolveSiteUrl(import.meta.env.VITE_SITE_URL);

export const absoluteUrl = (path: string): string => toAbsoluteUrl(path, SITE_URL);
