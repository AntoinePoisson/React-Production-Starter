import { msg } from '@lingui/core/macro';

import { getI18n } from '@/i18n/I18n';
import { LOCALE_TAGS, type Locale, alternateLanguages, localePath } from '@/i18n/Routing';
import { AUTHOR, SITE_TITLE, TWITTER_HANDLE } from '@/utils/config/Identity';
import { absoluteUrl, publicPath } from '@/utils/config/Site';

const SITE_DESCRIPTION = msg`A production-ready React foundation for fast, accessible and multilingual WebGL experiences.`;
const SOCIAL_PREVIEW_ALT = msg`React App Fondation — a production-ready React and WebGL starter.`;

// From `pnpm assets:brand`. Keep width/height, some crawlers skip the image otherwise.
const OG_IMAGE = { url: '/og-image.png', width: 1200, height: 630 };

// Same as --color-sky-top. Only `light`: the head dedupes by name and ignores media,
// so emitting both just ships whichever came last.
export const THEME_COLOR = { light: '#c9dcf0', dark: '#0b1220' };

/**
 * Meta tag — no server to set headers. postbuild.mjs moves it after <meta charset>
 * because a meta CSP only applies to what comes after it.
 *
 * 'unsafe-inline' is the compromise: the router injects scripts at hydration and we
 * have no nonce. frame-ancestors is ignored in a meta tag, and upgrade-insecure-requests
 * breaks WebKit on localhost. Put those on the real edge policy. This is the floor.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Draco decoder.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

type Tag = Record<string, string>;

export const rootHead = (): { meta: Tag[]; links: Tag[] } => ({
  meta: [
    { charSet: 'utf-8' },
    // httpEquiv, not http-equiv — React drops the HTML spelling.
    { httpEquiv: 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
    {
      name: 'viewport',
      // Don't lock pinch-zoom (WCAG 1.4.4).
      content: 'width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover'
    },
    { name: 'author', content: AUTHOR },
    { name: 'format-detection', content: 'telephone=no, address=no, email=no' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: SITE_TITLE },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'theme-color', content: THEME_COLOR.light }
  ],
  links: [
    { rel: 'icon', href: publicPath('/icons/favicon.svg'), type: 'image/svg+xml' },
    { rel: 'icon', href: publicPath('/icons/favicon-32x32.png'), sizes: '32x32', type: 'image/png' },
    { rel: 'apple-touch-icon', href: publicPath('/icons/apple-touch-icon.png'), sizes: '180x180' },
    { rel: 'manifest', href: publicPath('/manifest.json') }
  ]
});

export const localeHead = (locale: Locale): { meta: Tag[]; links: Tag[] } => {
  const i18n = getI18n(locale);
  const description = i18n._(SITE_DESCRIPTION);
  const canonical = absoluteUrl(localePath(locale));
  const image = absoluteUrl(OG_IMAGE.url);

  return {
    meta: [
      { title: SITE_TITLE },
      { name: 'description', content: description },
      // No keywords tag. Nobody reads those anymore.
      { name: 'robots', content: 'index, follow' },

      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: canonical },
      { property: 'og:locale', content: LOCALE_TAGS[locale].replace('-', '_') },
      { property: 'og:site_name', content: SITE_TITLE },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: description },
      { property: 'og:image', content: image },
      { property: 'og:image:width', content: String(OG_IMAGE.width) },
      { property: 'og:image:height', content: String(OG_IMAGE.height) },
      { property: 'og:image:alt', content: i18n._(SOCIAL_PREVIEW_ALT) },

      { name: 'twitter:card', content: 'summary_large_image' },
      ...(TWITTER_HANDLE ? [{ name: 'twitter:site', content: TWITTER_HANDLE }] : []),
      { name: 'twitter:title', content: SITE_TITLE },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image }
    ],
    links: [
      { rel: 'canonical', href: canonical },
      // Without these, Google treats the locales as duplicates.
      ...Object.entries(alternateLanguages()).map(([tag, path]) => ({
        rel: 'alternate',
        hrefLang: tag,
        href: absoluteUrl(path)
      }))
    ]
  };
};
