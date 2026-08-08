import type { Messages } from '@lingui/core';
import { useLingui } from '@lingui/react';
import { useCallback, useEffect } from 'react';

import { publicPath, routePath } from '@/utils/config/Site';

import { DEFAULT_LOCALE, LOCALE_TAGS, type Locale, isLocale, localePath } from './Routing';

/**
 * Swap locale without a reload. A reload would kill the WebGL context
 * (three.js reparsed, camera reset). Only <html lang> is updated here —
 * canonical / hreflang stay as prerendered.
 */

// One import per locale. `import('./messages/' + locale)` would emit a chunk
// for everything in that folder, .json included.
const CATALOGUES: Record<Locale, () => Promise<{ messages: Messages }>> = {
  en: () => import('./messages/en'),
  fr: () => import('./messages/fr')
};

export const localeFromPath = (pathname: string): Locale => {
  const segment = routePath(pathname).split('/')[1];

  return isLocale(segment) ? segment : DEFAULT_LOCALE;
};

// Back button should undo the language swap.
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
        // Catalogue didn't arrive (offline, or a deploy ate the chunk). Just follow the href.
        window.location.assign(publicPath(localePath(locale)));

        return;
      }

      // After the swap, so a failed switch never leaves the URL lying.
      // pushState so back still works.
      window.history.pushState(null, '', publicPath(localePath(locale)));
    },
    [apply]
  );
};
