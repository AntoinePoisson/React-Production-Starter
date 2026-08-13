// jsdom answers no media queries: `matchMedia` is stubbed with a `matches` we control.

import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  readPrefersReducedMotion,
  resetReducedMotionCache,
  usePrefersReducedMotion
} from '@/utils/screen/useReducedMotion';

type Listener = () => void;

/** A matchMedia stub backed by a mutable preference. */
function installPreference(initial: boolean) {
  let reduced = initial;
  const listeners = new Set<Listener>();

  window.matchMedia = ((query: string) =>
    ({
      get matches() {
        return reduced;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    }) as unknown as MediaQueryList) as typeof window.matchMedia;

  resetReducedMotionCache();

  return {
    set(next: boolean) {
      reduced = next;
      act(() => {
        for (const listener of [...listeners]) listener();
      });
    },
    listenerCount: () => listeners.size
  };
}

function MotionProbe() {
  return <span>{String(usePrefersReducedMotion())}</span>;
}

describe('usePrefersReducedMotion', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    resetReducedMotionCache();
  });

  afterEach(() => {
    // Unstub first: a stubbed-away `window` makes the next line throw.
    vi.unstubAllGlobals();
    window.matchMedia = originalMatchMedia;
    resetReducedMotionCache();
  });

  it('should report the preference the media query carries', () => {
    installPreference(true);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true);

    installPreference(false);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });

  it('should follow the preference changing at runtime', () => {
    const preference = installPreference(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    preference.set(true);
    expect(result.current).toBe(true);
  });

  it('should unsubscribe on unmount', () => {
    const preference = installPreference(true);
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    expect(preference.listenerCount()).toBe(1);

    unmount();
    expect(preference.listenerCount()).toBe(0);
  });

  it('should share one MediaQueryList across hook instances', () => {
    const preference = installPreference(false);
    renderHook(() => usePrefersReducedMotion());
    renderHook(() => usePrefersReducedMotion());

    // Pooled by the stub into one Set; the sharing itself is the module-level cache.
    expect(preference.listenerCount()).toBe(2);
  });

  describe('environments that cannot be asked', () => {
    it('should assume reduced motion in the pre-rendered HTML', () => {
      // Opposite default from `useBreakpoint`: a wrong motion guess moves the page for someone
      // who asked it not to.
      installPreference(false);
      expect(renderToString(<MotionProbe />)).toContain('true');
    });

    it('should assume reduced motion when window is absent entirely', () => {
      vi.stubGlobal('window', undefined);
      resetReducedMotionCache();

      // Read without React: react-dom cannot render without a window.
      expect(readPrefersReducedMotion()).toBe(true);
    });

    it('should assume reduced motion when matchMedia is missing', () => {
      vi.stubGlobal('window', {});
      resetReducedMotionCache();

      expect(readPrefersReducedMotion()).toBe(true);
    });

    it('should subscribe to nothing rather than throw when matchMedia is missing', () => {
      vi.stubGlobal('window', {});
      resetReducedMotionCache();

      // React calls the unsubscribe on unmount whatever the environment turned out to be.
      const { unmount } = renderHook(() => usePrefersReducedMotion());
      expect(() => unmount()).not.toThrow();
    });
  });
});
