import { useLingui } from '@lingui/react/macro';

import { LOCALES, LOCALE_LABELS, LOCALE_TAGS, type Locale, localePath } from '@/i18n/Routing';
import { useLocaleSwitch } from '@/i18n/useLocaleSwitch';

/**
 * Anchors rather than a <select>: a real URL works before hydration, opens in a new tab and gets
 * followed by crawlers. The click handler is enhancement on top.
 *
 * Each label carries its own lang (WCAG 3.1.2), or a screen reader on an en-US document reads
 * "Français" with an English voice. hrefLang isn't used for pronunciation and doesn't cover it.
 */
export default function LanguageSwitcher() {
  const { t, i18n } = useLingui();
  const switchTo = useLocaleSwitch();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, locale: Locale) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    void switchTo(locale);
  };

  return (
    <nav
      aria-label={t`Language`}
      // ml-auto and not the parent's justify-between: the sibling footer is hidden sm:block, so
      // below 640px this would fall back to flex-start.
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
