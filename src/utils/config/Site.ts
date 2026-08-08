import { basePathFromSiteUrl, resolveSiteUrl, toAbsoluteUrl, withBasePath, withoutBasePath } from './SiteRules';

/**
 * Baked in at build time. CI must pass VITE_SITE_URL or every page ships a
 * localhost canonical. Pages are always indexable — keep a preprod out of
 * Google with an X-Robots-Tag at the host, not here.
 */
export const SITE_URL = resolveSiteUrl(import.meta.env.VITE_SITE_URL);
export const SITE_BASE_PATH = basePathFromSiteUrl(SITE_URL);

export const absoluteUrl = (path: string): string => toAbsoluteUrl(path, SITE_URL);
export const publicPath = (path: string): string => withBasePath(path, SITE_BASE_PATH);
export const routePath = (pathname: string): string => withoutBasePath(pathname, SITE_BASE_PATH);
