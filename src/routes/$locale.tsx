import { createFileRoute, notFound } from '@tanstack/react-router';

import { localeHead } from '@/app/Metadata';
import Home from '@/app/pages/Home';
import { type Locale, isLocale } from '@/i18n/Routing';

/**
 * `/en` and `/fr`. One dynamic segment rather than a file per language, so adding a locale is
 * one entry in `LOCALES` plus a line in `vite.config.ts`.
 *
 * The segment matches anything, so an unknown one has to be rejected — otherwise `/nonsense`
 * renders the home page under a canonical claiming to be a language.
 */
export const Route = createFileRoute('/$locale')({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) throw notFound();
  },
  head: ({ params }) => (isLocale(params.locale) ? localeHead(params.locale as Locale) : {}),
  component: Home
});
