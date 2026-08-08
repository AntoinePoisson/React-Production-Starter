import { useLingui } from '@lingui/react/macro';

import { LOCALES, LOCALE_LABELS, LOCALE_TAGS, type Locale, localePath } from '@/i18n/Routing';
import { useLocaleSwitch } from '@/i18n/useLocaleSwitch';
import { publicPath } from '@/utils/config/Site';

/**
 * Real <a href>s, not a <select>. Works before hydration, opens in a new tab,
 * crawlers can follow. The click handler is just enhancement.
 *
 * lang on each label — otherwise a screen reader on an English page reads
 * "Français" with an English voice. hrefLang doesn't cover pronunciation.
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
      // ml-auto, not justify-between on the parent — the footer is hidden below sm.
      className='pointer-events-auto ml-auto flex items-center text-xs sm:text-sm'
    >
      {LOCALES.map((locale) =>
        locale === i18n.locale ? (
          <span
            key={locale}
            aria-current='page'
            className='text-ink flex min-h-11 items-center rounded-lg px-3 font-medium'
            lang={LOCALE_TAGS[locale]}
          >
            {LOCALE_LABELS[locale]}
          </span>
        ) : (
          <a
            key={locale}
            className='text-ink-subtle hover:text-ink flex min-h-11 items-center rounded-lg px-3 underline-offset-4 hover:underline'
            href={publicPath(localePath(locale))}
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
