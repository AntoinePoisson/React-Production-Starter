import { setupI18n } from '@lingui/core';

import { messages as en } from './messages/en';
import { messages as fr } from './messages/fr';
import type { Locale } from './Routing';

// messages/{locale}.ts comes from `lingui compile` (gitignored).
// One i18n per locale. The prerender builds every locale in one process,
// and a shared instance + activate() races.
const CATALOGS = { en, fr } satisfies Record<Locale, unknown>;

export const getI18n = (locale: Locale) => setupI18n({ locale, messages: { [locale]: CATALOGS[locale] } });

export const getMessages = (locale: Locale) => CATALOGS[locale];
