// The property under test: the copy changes and the document survives (same DOM, same WebGL context).

import { type I18n, setupI18n } from '@lingui/core';
import { I18nProvider, useLingui } from '@lingui/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { getMessages } from '@/i18n/I18n';
import { DEFAULT_LOCALE, type Locale } from '@/i18n/Routing';
import { localeFromPath, useLocaleSwitch } from '@/i18n/useLocaleSwitch';

import { withI18n } from '../helpers/withI18n';

/** Set by the harness on render, so a test can drive the hook without a click. */
let switchTo: (locale: Locale) => Promise<void>;

const Harness = () => {
  const { i18n } = useLingui();

  switchTo = useLocaleSwitch();

  return <span data-testid='locale'>{i18n.locale}</span>;
};

/** A real Lingui instance with a real catalogue, the way `app/Providers.tsx` builds one. */
const renderHarness = (locale: Locale = DEFAULT_LOCALE) => {
  const i18n: I18n = setupI18n({ locale, messages: { [locale]: getMessages(locale) } });
  const { unmount } = render(
    <I18nProvider i18n={i18n}>
      <Harness />
    </I18nProvider>
  );

  return { i18n, unmount };
};

const popTo = (pathname: string) => {
  window.history.replaceState(null, '', pathname);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

/**
 * Clicks an element and reports whether the handler cancelled the event. The document listener
 * cancels on the way past: jsdom logs "Not implemented" for an uncancelled `<a href>` click.
 */
const clickAndReadCancellation = (element: HTMLElement, init: MouseEventInit = {}) => {
  let cancelled: boolean | undefined;

  document.addEventListener(
    'click',
    (event) => {
      cancelled = event.defaultPrevented;
      event.preventDefault();
    },
    { once: true }
  );

  fireEvent(element, new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));

  return cancelled;
};

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  document.documentElement.lang = 'en-US';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('localeFromPath', () => {
  it.each([
    ['/', 'en'],
    ['/en', 'en'],
    ['/fr', 'fr'],
    // An unknown segment and no segment at all both resolve to the default locale.
    ['/about', 'en'],
    ['', 'en']
  ])('should read %s as %s', (pathname, expected) => {
    expect(localeFromPath(pathname)).toBe(expected);
  });
});

describe('useLocaleSwitch', () => {
  it('should swap the catalogue and move the URL, without navigating', async () => {
    renderHarness();

    await act(async () => {
      await switchTo('fr');
    });

    expect(screen.getByTestId('locale')).toHaveTextContent('fr');

    // React does not own `<html lang>`, so the hook has to set it.
    expect(document.documentElement.lang).toBe('fr-FR');

    expect(window.location.pathname).toBe('/fr');
  });

  it('should do nothing when the locale is already active', async () => {
    const { i18n } = renderHarness();
    const activate = vi.spyOn(i18n, 'activate');

    await act(async () => {
      await switchTo('en');
    });

    expect(activate).not.toHaveBeenCalled();
  });

  it('should fall back to a real navigation when the catalogue fails to arrive', async () => {
    const { i18n } = renderHarness();
    const assign = vi.fn();
    const pushState = vi.spyOn(window.history, 'pushState');

    // `location.assign` is non-writable and non-configurable in jsdom, so neither `spyOn` nor
    // assignment reaches it. Replacing the whole object is the only way to observe the call.
    vi.stubGlobal('location', { ...window.location, assign });

    vi.spyOn(i18n, 'load').mockImplementation(() => {
      throw new Error('chunk load failed');
    });

    await act(async () => {
      await switchTo('fr');
    });

    expect(assign).toHaveBeenCalledWith('/fr');

    // And no `pushState`: the URL must not claim a language the page is not in.
    expect(pushState).not.toHaveBeenCalled();
  });

  it('should follow the back button', async () => {
    renderHarness();

    await act(async () => {
      await switchTo('fr');
    });

    popTo('/');

    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('en'));
    expect(document.documentElement.lang).toBe('en-US');
  });

  it('should stop following the URL once unmounted', async () => {
    const { unmount } = renderHarness();

    await act(async () => {
      await switchTo('fr');
    });

    unmount();
    popTo('/');
    await act(async () => {});

    expect(document.documentElement.lang).toBe('fr-FR');
  });
});

describe('LanguageSwitcher', () => {
  it('should switch in place rather than follow its own href', async () => {
    render(withI18n(<LanguageSwitcher />));

    const toFrench = screen.getByRole('link', { name: 'Français' });

    // The href stays real: a crawler follows it, and it works with JavaScript off.
    expect(toFrench).toHaveAttribute('href', '/fr');

    expect(clickAndReadCancellation(toFrench)).toBe(true);

    await waitFor(() => expect(screen.getByRole('link', { name: 'English' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Français' })).not.toBeInTheDocument();
  });

  it.each(['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const)(
    'should leave a %s click to the browser',
    (modifier) => {
      render(withI18n(<LanguageSwitcher />));

      const toFrench = screen.getByRole('link', { name: 'Français' });

      // cmd/ctrl, shift and alt all want the real document at that URL.
      expect(clickAndReadCancellation(toFrench, { [modifier]: true })).toBe(false);
    }
  );
});
