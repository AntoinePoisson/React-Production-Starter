import { defineConfig } from '@lingui/cli';
import type { CatalogFormatter, MessageType } from '@lingui/conf';
import { generateMessageId } from '@lingui/message-utils/generateMessageId';

import { DEFAULT_LOCALE, LOCALES } from './src/i18n/Routing';

/**
 * { "English sentence": "translation" } instead of Lingui's message-hash keys, the hash gets
 * recomputed on parse. Downside: no translator comment and no ICU context, so two messages
 * identical in English but different in French collide. Reword one of them.
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
 * Catalogues are generated from the code by `pnpm i18n`, only the translations are written by
 * hand. Tagged for knip, which can't see that the Lingui CLI reads this export.
 *
 * @public
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
  // package.json is type: module, and the default cjs namespace emits module.exports into a .js
  // file that Node then refuses to load.
  compileNamespace: 'ts'
});
