import { msg } from '@lingui/core/macro';

import { getI18n } from '@/i18n/I18n';
import { LOCALE_TAGS, type Locale, alternateLanguages, localePath } from '@/i18n/Routing';
import { AUTHOR, SITE_TITLE, TWITTER_HANDLE } from '@/utils/config/Identity';
import { absoluteUrl } from '@/utils/config/Site';

const SITE_DESCRIPTION = msg`React + Vite + React Three Fiber starter.`;
const SOCIAL_PREVIEW_ALT = msg`React App Fondation — React + Vite + React Three Fiber starter.`;

// `pnpm assets:brand` regenerates it. Keep the dimensions: some crawlers skip an image without.
const OG_IMAGE = { url: '/og-image.png', width: 1200, height: 630 };

/**
 * Mirrors `--color-sky-top` in globals.css for each scheme.
 *
 * Only `light` is emitted, and one tag is the whole point. The head is deduplicated by `name`,
 * and `media` is not part of that key: declaring the pair shipped whichever came last — the dark
 * one — so the light colour never reached a document and every visitor on a dark OS got a dark
 * browser chrome wrapped around a page that is still light, since nothing sets `[data-theme]`.
 * The failure was invisible in the source and only existed in the built HTML.
 *
 * On the day the dark theme is switched on, emit the pair from `scripts/postbuild.mjs` alongside
 * the CSP move, where nothing deduplicates it. `dark` stays here as that value's one home.
 */
export const THEME_COLOR = { light: '#c9dcf0', dark: '#0b1220' };

/**
 * Delivered as a meta tag because a static site has no server to set headers with.
 * `scripts/postbuild.mjs` moves it after `<meta charset>`, since a meta policy only governs
 * what follows it.
 *
 * `script-src` carries `'unsafe-inline'`: the router injects inline scripts during hydration,
 * and a static site has no per-request nonce to authorise them with. Hashing only the
 * pre-rendered ones is worse — a hash disables `'unsafe-inline'`, and hydration then dies.
 * `frame-ancestors` is absent because browsers ignore it in a meta tag. Set a real policy as a
 * response header at your edge; this is the floor.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // `wasm-unsafe-eval` is for the Draco decoder.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests'
].join('; ');

type Tag = Record<string, string>;

/** Head tags that do not vary by locale. Lives on the root route. */
export const rootHead = (): { meta: Tag[]; links: Tag[] } => ({
  meta: [
    { charSet: 'utf-8' },
    // `httpEquiv`, not `http-equiv`: React drops the HTML spelling and warns.
    { httpEquiv: 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
    {
      name: 'viewport',
      // No `maximum-scale` / `user-scalable=no`: blocking pinch-zoom fails WCAG 1.4.4.
      // `viewport-fit=cover` runs the canvas under the notch; the overlay insets itself.
      content: 'width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover'
    },
    { name: 'author', content: AUTHOR },
    { name: 'format-detection', content: 'telephone=no, address=no, email=no' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: SITE_TITLE },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    // One tag, no `media` — see THEME_COLOR. A second one with the same `name` does not survive
    // the head.
    { name: 'theme-color', content: THEME_COLOR.light }
  ],
  links: [
    { rel: 'icon', href: '/icons/favicon.svg', type: 'image/svg+xml' },
    { rel: 'icon', href: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png', sizes: '180x180' },
    { rel: 'manifest', href: '/manifest.json' }
  ]
});

/**
 * Head tags that vary by locale, so adding a language stays one entry in `LOCALES`.
 *
 * A plain function, not a component: TanStack calls `head` outside the React tree, and an array
 * of tags is far easier to assert than a rendered document.
 */
export const localeHead = (locale: Locale): { meta: Tag[]; links: Tag[] } => {
  // Local instance: this also runs at build time, outside any provider.
  const i18n = getI18n(locale);
  const description = i18n._(SITE_DESCRIPTION);
  const canonical = absoluteUrl(localePath(locale));
  const image = absoluteUrl(OG_IMAGE.url);

  return {
    meta: [
      { title: SITE_TITLE },
      { name: 'description', content: description },
      { name: 'keywords', content: 'react, vite, react three fiber, threejs, template, starter' },
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

      // 1200×630 needs the large card.
      { name: 'twitter:card', content: 'summary_large_image' },
      ...(TWITTER_HANDLE ? [{ name: 'twitter:site', content: TWITTER_HANDLE }] : []),
      { name: 'twitter:title', content: SITE_TITLE },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image }
    ],
    links: [
      { rel: 'canonical', href: canonical },
      // Without these the locales read as duplicate content rather than translations.
      ...Object.entries(alternateLanguages()).map(([tag, path]) => ({
        rel: 'alternate',
        hrefLang: tag,
        href: absoluteUrl(path)
      }))
    ]
  };
};
