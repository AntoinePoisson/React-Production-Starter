/**
 * Locale routing: `/` and `/en` both serve English, `/fr` serves French. A static site has no
 * middleware, so `/` is pre-rendered as its own document rather than redirecting; `/en` canonicals
 * to `/`.
 */

/**
 * Time zone used to format dates. Declared, not inferred: a static build has no request to guess
 * from. Nothing consumes it yet, hence `@public` to keep knip off it.
 *
 * @public
 */
export const TIME_ZONE = 'Europe/Paris';

export const LOCALES = ['en', 'fr'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** BCP 47 tags, for `<html lang>`, `og:locale` and `hreflang`. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR'
};

/** Each locale labelled in its own language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français'
};

/**
 * The canonical path for a locale; the default locale lives at the root. No trailing slash even
 * though the build writes `dist/fr/index.html`: linking to `/fr/` costs a redirect per click on
 * hosts that normalise, and every static host resolves `/fr` to that file.
 */
export const localePath = (locale: Locale): string => (locale === DEFAULT_LOCALE ? '/' : `/${locale}`);

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/** `hreflang` alternates, including the `x-default` a crawler falls back to. */
export const alternateLanguages = (): Record<string, string> => {
  const alternates: Record<string, string> = {};
  for (const locale of LOCALES) alternates[LOCALE_TAGS[locale]] = localePath(locale);
  alternates['x-default'] = localePath(DEFAULT_LOCALE);
  return alternates;
};
