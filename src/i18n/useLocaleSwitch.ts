import type { Messages } from '@lingui/core';
import { useLingui } from '@lingui/react';
import { useCallback, useEffect } from 'react';

import { DEFAULT_LOCALE, LOCALE_TAGS, type Locale, isLocale, localePath } from './Routing';

/**
 * Changes locale without reloading the document: a navigation would destroy the WebGL context and
 * rebuild it (three.js re-parsed, ~190 kB brotli / ~270 ms of main thread, camera reset).
 *
 * Only `<html lang>` is corrected: `/`, `/en` and `/fr` stay pre-rendered documents behind a real
 * `<a href>`, and crawlers never execute this click.
 */

// Listed rather than `import('./messages/' + locale)`, which makes the bundler emit a chunk for
// everything in the directory, the `.json` sources included.
const CATALOGUES: Record<Locale, () => Promise<{ messages: Messages }>> = {
  en: () => import('./messages/en'),
  fr: () => import('./messages/fr')
};

/**
 * The locale a pathname serves, the inverse of `localePath`. Anything unrecognised is the
 * default locale, `/` included: the bare domain carries no segment.
 */
export const localeFromPath = (pathname: string): Locale => {
  const segment = pathname.split('/')[1];

  return isLocale(segment) ? segment : DEFAULT_LOCALE;
};

/**
 * Returns a function that switches the active locale and moves the URL to match. The `popstate`
 * listener replays the locale of the restored URL, so the history entry stays undoable.
 */
export const useLocaleSwitch = () => {
  const { i18n } = useLingui();

  /** Locale → rendered page. No URL change: this is also what `popstate` needs. */
  const apply = useCallback(
    async (locale: Locale) => {
      if (locale === i18n.locale) return;

      const { messages } = await CATALOGUES[locale]();

      i18n.load(locale, messages);

      // `I18nProvider` re-renders the tree below it; `<Canvas>` renders no message and is left alone.
      i18n.activate(locale);

      document.documentElement.lang = LOCALE_TAGS[locale];
    },
    [i18n]
  );

  useEffect(() => {
    const onPopState = () => void apply(localeFromPath(window.location.pathname));

    window.addEventListener('popstate', onPopState);

    return () => window.removeEventListener('popstate', onPopState);
  }, [apply]);

  return useCallback(
    async (locale: Locale) => {
      try {
        await apply(locale);
      } catch {
        // Catalogue did not arrive (offline tab, chunk lost to a deploy): do what the anchor would.
        window.location.assign(localePath(locale));

        return;
      }

      // After the swap, so a failed switch never leaves the URL claiming a language the page is
      // not in. `pushState`, not `replaceState`: the previous locale stays reachable via back.
      window.history.pushState(null, '', localePath(locale));
    },
    [apply]
  );
};
