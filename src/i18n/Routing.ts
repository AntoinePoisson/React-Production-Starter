// `/` and `/en` both serve English, `/fr` serves French. No middleware on a static site, so `/`
// is its own prerendered document and `/en` canonicals to it.

/**
 * Declared rather than inferred, a static build has no request to guess a zone from.
 *
 * @public
 */
export const TIME_ZONE = 'Europe/Paris';

export const LOCALES = ['en', 'fr'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR'
};

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français'
};

// No trailing slash, even though the build writes dist/fr/index.html. Every static host resolves
// /fr to that file, and /fr/ costs a redirect per click on the ones that normalise.
export const localePath = (locale: Locale): string => (locale === DEFAULT_LOCALE ? '/' : `/${locale}`);

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

export const alternateLanguages = (): Record<string, string> => {
  const alternates: Record<string, string> = {};
  for (const locale of LOCALES) alternates[LOCALE_TAGS[locale]] = localePath(locale);
  alternates['x-default'] = localePath(DEFAULT_LOCALE);
  return alternates;
};
