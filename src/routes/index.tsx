import { createFileRoute } from '@tanstack/react-router';

import { localeHead } from '@/app/Metadata';
import Home from '@/app/pages/Home';
import { DEFAULT_LOCALE } from '@/i18n/Routing';

// Default locale, no redirect. /en renders the same page and canonicals here.
export const Route = createFileRoute('/')({
  head: () => localeHead(DEFAULT_LOCALE),
  component: Home
});
