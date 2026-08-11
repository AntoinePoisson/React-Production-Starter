import { I18nProvider } from '@lingui/react';

import { getI18n } from '@/i18n/I18n';
import { DEFAULT_LOCALE, type Locale } from '@/i18n/Routing';

/** Real catalogues, not stubs. */
export const withI18n = (node: React.ReactNode, locale: Locale = DEFAULT_LOCALE) => (
  <I18nProvider i18n={getI18n(locale)}>{node}</I18nProvider>
);
