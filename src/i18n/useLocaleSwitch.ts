import type { Messages } from '@lingui/core';
import { useLingui } from '@lingui/react';
import { useCallback, useEffect } from 'react';

import { publicPath, routePath } from '@/utils/config/Site';

import { DEFAULT_LOCALE, LOCALE_TAGS, type Locale, isLocale, localePath } from './Routing';

/**
 * Locale switching without a document reload, which would destroy the WebGL context and rebuild
 * it: three.js reparsed, ~270ms of main thread, camera back to its starting position. Only
 * <html lang> is corrected, the canonical and hreflang tags stay as prerendered.
 */

// Listed one by one. `import('./messages/' + locale)` makes the bundler emit a chunk for
// everything in the directory, .json sources included.
const CATALOGUES: Record<Locale, () => Promise<{ messages: Messages }>> = {
  en: () => import('./messages/en'),
  fr: () => import('./messages/fr')
};

export const localeFromPath = (pathname: string): Locale => {
  const segment = routePath(pathname).split('/')[1];

  return isLocale(segment) ? segment : DEFAULT_LOCALE;
};

// The popstate listener replays the locale of the restored URL, so back stays undoable.
export const useLocaleSwitch = () => {
  const { i18n } = useLingui();

  const apply = useCallback(
    async (locale: Locale) => {
      if (locale === i18n.locale) return;

      const { messages } = await CATALOGUES[locale]();

      i18n.load(locale, messages);
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
        // Catalogue never arrived (offline tab, chunk lost to a deploy). Fall back to what the
        // anchor would have done on its own.
        window.location.assign(publicPath(localePath(locale)));

        return;
      }

      // After the swap, so a failed switch never leaves the URL claiming a language the page is
      // not in. pushState so the previous locale stays reachable with the back button.
      window.history.pushState(null, '', publicPath(localePath(locale)));
    },
    [apply]
  );
};
