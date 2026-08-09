import { resolveSiteUrl, toAbsoluteUrl } from './SiteRules';

/**
 * Baked in at build time, so CI has to pass VITE_SITE_URL or every page ships a localhost
 * canonical. Pages are always indexable: keeping a preprod out of the index is an X-Robots-Tag
 * header at the host, not something a build gets to decide.
 */
export const SITE_URL = resolveSiteUrl(import.meta.env.VITE_SITE_URL);

export const absoluteUrl = (path: string): string => toAbsoluteUrl(path, SITE_URL);
