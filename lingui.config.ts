import { defineConfig } from '@lingui/cli';
import type { CatalogFormatter, MessageType } from '@lingui/conf';
import { generateMessageId } from '@lingui/message-utils/generateMessageId';

import { DEFAULT_LOCALE, LOCALES } from './src/i18n/Routing';

/**
 * Flat JSON: { "English sentence": "translation" } instead of hash keys.
 * Downside: two identical English strings with different French collide. Reword one.
 */
const flatJson = (): CatalogFormatter => ({
  catalogExtension: '.json',

  serialize: (catalog) =>
    `${JSON.stringify(
      Object.fromEntries(Object.entries(catalog).map(([id, entry]) => [entry.message ?? id, entry.translation ?? ''])),
      null,
      2
    )}\n`,

  parse: (content) =>
    Object.fromEntries(
      Object.entries(JSON.parse(content) as Record<string, string>).map(([message, translation]) => [
        generateMessageId(message),
        { message, translation, obsolete: false, origin: [] } satisfies MessageType
      ])
    )
});

/**
 * Catalogues come from `pnpm i18n`. Only the translations are handwritten.
 * @public — knip can't see that the Lingui CLI reads this.
 */
export default defineConfig({
  sourceLocale: DEFAULT_LOCALE,
  locales: [...LOCALES],
  catalogs: [
    {
      path: '<rootDir>/src/i18n/messages/{locale}',
      include: ['src']
    }
  ],
  format: flatJson(),
  orderBy: 'message',
  // type: module — default cjs compile would emit module.exports into a .js Node refuses.
  compileNamespace: 'ts'
});
