import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_LABELS,
  LOCALE_TAGS,
  alternateLanguages,
  isLocale,
  localePath
} from '@/i18n/Routing';

describe('locale configuration', () => {
  it('should include the default locale in the list', () => {
    expect(LOCALES).toContain(DEFAULT_LOCALE);
  });

  it('should describe every locale it declares', () => {
    // A locale with no tag renders `lang="undefined"`; with no label, an empty switcher entry.
    for (const locale of LOCALES) {
      expect(LOCALE_TAGS[locale], `${locale} has no BCP 47 tag`).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(LOCALE_LABELS[locale], `${locale} has no label`).toBeTruthy();
    }
  });

  it('should label each locale in its own language', () => {
    expect(LOCALE_LABELS.fr).toBe('Français');
    expect(LOCALE_LABELS.en).toBe('English');
  });

  describe('localePath', () => {
    it('should serve the default locale from the root, with no prefix', () => {
      // The reason for the `(default)` route group: no prefix, so no redirect on the entry URL.
      expect(localePath(DEFAULT_LOCALE)).toBe('/');
    });

    it('should prefix every other locale', () => {
      for (const locale of LOCALES.filter((candidate) => candidate !== DEFAULT_LOCALE)) {
        expect(localePath(locale)).toBe(`/${locale}`);
      }
    });

    it('should leave no trailing slash for a server to redirect away', () => {
      // `trailingSlash: false` plus `drop-trailing-slash` at the edge: `/fr/` is a 307 to
      // `/fr`, so a link written with the slash pays a round trip on every click.
      for (const locale of LOCALES.filter((candidate) => candidate !== DEFAULT_LOCALE)) {
        expect(localePath(locale)).not.toMatch(/\/$/);
      }
    });
  });

  describe('isLocale', () => {
    it.each([
      ['en', true],
      ['fr', true],
      ['de', false],
      ['', false],
      [null, false],
      [42, false]
    ])('should validate %s as %s', (value, expected) => {
      expect(isLocale(value)).toBe(expected);
    });
  });

  describe('alternateLanguages', () => {
    it('should list every locale by its BCP 47 tag', () => {
      const alternates = alternateLanguages();
      for (const locale of LOCALES) {
        expect(alternates[LOCALE_TAGS[locale]]).toBe(localePath(locale));
      }
    });

    it('should declare an x-default pointing at the default locale', () => {
      // Without it, Google picks for a visitor whose language matches none of the alternates.
      expect(alternateLanguages()['x-default']).toBe(localePath(DEFAULT_LOCALE));
    });

    it('should have one entry per locale, plus x-default', () => {
      expect(Object.keys(alternateLanguages())).toHaveLength(LOCALES.length + 1);
    });
  });
});
