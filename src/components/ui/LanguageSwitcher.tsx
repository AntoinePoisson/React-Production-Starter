import { useLingui } from '@lingui/react/macro';

import { LOCALES, LOCALE_LABELS, LOCALE_TAGS, type Locale, localePath } from '@/i18n/Routing';
import { useLocaleSwitch } from '@/i18n/useLocaleSwitch';

/**
 * Switches locale. Anchors, not a `<select>`: a real URL works before hydration, opens in a new tab
 * and is followed by crawlers. The click handler is an enhancement on top: `useLocaleSwitch` swaps
 * the catalogue in place so the WebGL context survives; without it the page reloads.
 *
 * Each label carries its own `lang` (WCAG 3.1.2): the labels are native-only, so an `en-US`
 * document would have a screen reader say "Français" with an English voice. `hrefLang` is not read
 * for pronunciation and does not cover it.
 */
export default function LanguageSwitcher() {
  const { t, i18n } = useLingui();
  const switchTo = useLocaleSwitch();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, locale: Locale) => {
    // Modified clicks belong to the browser: they want the real document at that URL.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    void switchTo(locale);
  };

  return (
    <nav
      aria-label={t`Language`}
      // `ml-auto` rather than the parent's `justify-between`: the sibling <footer> is
      // `hidden sm:block`, so below 640px this would fall back to flex-start.
      className='pointer-events-auto ml-auto flex items-center gap-2 text-xs sm:text-sm'
    >
      {LOCALES.map((locale) =>
        locale === i18n.locale ? (
          <span
            key={locale}
            aria-current='page'
            className='text-ink font-medium'
            lang={LOCALE_TAGS[locale]}
          >
            {LOCALE_LABELS[locale]}
          </span>
        ) : (
          <a
            key={locale}
            className='text-ink-subtle hover:text-ink underline-offset-4 hover:underline'
            href={localePath(locale)}
            hrefLang={LOCALE_TAGS[locale]}
            lang={LOCALE_TAGS[locale]}
            rel='alternate'
            onClick={(event) => handleClick(event, locale)}
          >
            {LOCALE_LABELS[locale]}
          </a>
        )
      )}
    </nav>
  );
}
