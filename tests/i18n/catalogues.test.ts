// Same guarantee as `lingui compile --strict` in `pnpm build`, at unit-test speed: no build needed.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, LOCALES } from '@/i18n/Routing';

const MESSAGES_DIR = join(process.cwd(), 'src/i18n/messages');

const readCatalogue = (locale: string): Record<string, string> =>
  JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf-8'));

const catalogues = new Map(LOCALES.map((locale) => [locale, readCatalogue(locale)]));
const reference = catalogues.get(DEFAULT_LOCALE)!;
const translated = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

describe('translation catalogues', () => {
  it('should ship one file per declared locale', () => {
    const files = readdirSync(MESSAGES_DIR)
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', ''));

    expect(files.sort()).toEqual([...LOCALES].sort());
  });

  it('should extract at least the copy the app renders', () => {
    expect(Object.keys(reference).length).toBeGreaterThan(0);
  });

  it.each(translated)('should translate every entry in %s', (locale) => {
    const missing = Object.keys(reference).filter((key) => !catalogues.get(locale)?.[key]);

    // An empty value silently falls back to English.
    expect(missing).toEqual([]);
  });

  it.each(translated)('should carry no orphan entry in %s', (locale) => {
    // `lingui extract --clean` removes these; an orphan means someone hand-edited the file.
    const orphans = Object.keys(catalogues.get(locale) ?? {}).filter((key) => !(key in reference));

    expect(orphans).toEqual([]);
  });

  it.each(translated)('should keep every placeholder in %s', (locale) => {
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    // A dropped `{percent}` renders a sentence that reads fine and says nothing.
    for (const key of Object.keys(reference)) {
      expect(placeholders(catalogues.get(locale)![key]), `${locale}: ${key}`).toEqual(placeholders(key));
    }
  });

  it('should be sorted alphabetically, so a near-duplicate is visible in review', () => {
    const keys = Object.keys(reference);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('should key the source catalogue by its own English sentence', () => {
    for (const [key, value] of Object.entries(reference)) expect(value).toBe(key);
  });
});
