import { createFileRoute, notFound } from '@tanstack/react-router';

import { localeHead } from '@/app/Metadata';
import Home from '@/app/pages/Home';
import { type Locale, isLocale } from '@/i18n/Routing';

/**
 * /en, /fr. One dynamic segment so a new locale is: LOCALES + a line in vite.config.ts.
 *
 * $locale matches anything, so reject unknowns or /nonsense renders the home
 * page with a canonical claiming to be a language.
 */
export const Route = createFileRoute('/$locale')({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) throw notFound();
  },
  head: ({ params }) => (isLocale(params.locale) ? localeHead(params.locale as Locale) : {}),
  component: Home
});
