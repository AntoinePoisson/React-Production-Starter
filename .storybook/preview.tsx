import { I18nProvider } from '@lingui/react';
import type { Preview } from '@storybook/react-vite';

import { getI18n } from '../src/i18n/I18n';
import { LOCALES, type Locale } from '../src/i18n/Routing';

import '../src/app/globals.css';

// Locale toolbar, not one story per language. French labels run longer — check the layout.
const preview: Preview = {
  globalTypes: {
    locale: {
      description: 'Active locale',
      toolbar: {
        icon: 'globe',
        items: LOCALES.map((locale) => ({ value: locale, title: locale.toUpperCase() })),
        dynamicTitle: true
      }
    }
  },

  initialGlobals: { locale: 'en' },

  decorators: [
    (Story, context) => {
      const locale = context.globals.locale as Locale;

      // Keyed on the locale so a switch remounts the tree. getI18n returns a fresh instance per
      // locale, and a provider handed a new one without a remount keeps the old catalogue.
      return (
        <I18nProvider
          key={locale}
          i18n={getI18n(locale)}
        >
          <Story />
        </I18nProvider>
      );
    }
  ],

  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: {
      // Reports in the panel. Switch to 'error' to fail the story once the backlog is clear.
      test: 'todo'
    },
    backgrounds: {
      // The app paints the sky gradient on <body>, which a story doesn't inherit.
      options: {
        sky: { name: 'Sky', value: 'linear-gradient(180deg, #c9dcf0 0%, #e9eef2 62%)' },
        dark: { name: 'Dark', value: '#0b1220' }
      }
    },
    initialGlobals: { backgrounds: { value: 'sky' } }
  }
};

export default preview;
