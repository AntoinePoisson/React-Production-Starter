#!/usr/bin/env node

/**
 * Hits the live URL and checks HTML, locales, SEO files, and referenced assets.
 * Run after the host has given you the final URL.
 */

const input = process.argv[2] || process.env.DEPLOYMENT_URL;

if (!input) {
  throw new Error('Pass the deployed site URL as the first argument or DEPLOYMENT_URL.');
}

const siteUrl = new URL(input);
siteUrl.search = '';
siteUrl.hash = '';
siteUrl.pathname = `${siteUrl.pathname.replace(/\/+$/, '')}/`;

const fetchText = async (url, expectedStatus = 200) => {
  const response = await fetch(url, { redirect: 'follow' });

  if (response.status !== expectedStatus) {
    throw new Error(`${url} returned ${response.status}, expected ${expectedStatus}.`);
  }

  return response.text();
};

const home = await fetchText(siteUrl);

if (home.toLowerCase().includes('localhost')) {
  throw new Error('The deployed HTML still contains a localhost URL.');
}

const canonical = home.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1];
if (!canonical || new URL(canonical).href !== siteUrl.href) {
  throw new Error(`The home canonical does not match ${siteUrl}.`);
}

const referencedUrls = [...home.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["']/gi)]
  .map((match) => new URL(match[1], siteUrl))
  .filter((url) => url.origin === siteUrl.origin);

for (const url of new Map(referencedUrls.map((value) => [value.href, value])).values()) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Referenced asset ${url} returned ${response.status}.`);
}

const french = await fetchText(new URL('fr', siteUrl));
if (!french.includes('lang="fr-FR"')) throw new Error('The French page is not rendered with lang="fr-FR".');

const robots = await fetchText(new URL('robots.txt', siteUrl));
const sitemap = await fetchText(new URL('sitemap.xml', siteUrl));
if (!robots.includes(new URL('sitemap.xml', siteUrl).href)) throw new Error('robots.txt advertises the wrong sitemap.');
if (!sitemap.includes(siteUrl.href)) throw new Error('sitemap.xml omits the deployed base URL.');

const notFound = await fetchText(new URL('__deployment-smoke__', siteUrl), 404);
if (!/noindex,\s*nofollow/i.test(notFound)) throw new Error('The static 404 is indexable.');
if (/<script\b/i.test(notFound)) throw new Error('The static 404 still hydrates against the wrong route.');

console.info(`✓ deployment smoke passed: ${siteUrl}`);
