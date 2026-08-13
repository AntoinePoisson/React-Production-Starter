// jsdom has no layout engine: `matchMedia` is stubbed to evaluate `min-width` against a width we control.

import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BREAKPOINTS } from '@/utils/screen/Breakpoints';
import { readBreakpoint, resetBreakpointCache, useBreakpoint, useIsMobile } from '@/utils/screen/useBreakpoint';

type Listener = () => void;

/** The browser default a `rem` in a media query resolves against. */
const ROOT_FONT_SIZE = 16;

/** A matchMedia stub backed by a mutable viewport width. */
function installViewport(initialWidth: number) {
  let width = initialWidth;
  const listeners = new Set<Listener>();

  window.matchMedia = ((query: string) => {
    // Both units: the queries are written in `rem` (what Tailwind emits) and the widths
    // under test are CSS pixels. A px-only parser reads every `rem` query as `min: 0`.
    const match = query.match(/([0-9.]+)(px|rem)/);
    const min = match ? Number(match[1]) * (match[2] === 'rem' ? ROOT_FONT_SIZE : 1) : 0;
    return {
      get matches() {
        return width >= min;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  resetBreakpointCache();

  return {
    resize(next: number) {
      width = next;
      act(() => {
        for (const listener of [...listeners]) listener();
      });
    },
    listenerCount: () => listeners.size
  };
}

describe('useBreakpoint', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    resetBreakpointCache();
  });

  afterEach(() => {
    // Unstub first: a stubbed-away `window` makes the next line throw.
    vi.unstubAllGlobals();
    window.matchMedia = originalMatchMedia;
    resetBreakpointCache();
  });

  it.each([
    [375, 'mobile'],
    [BREAKPOINTS.tablet, 'tablet'],
    [BREAKPOINTS.desktop, 'desktop'],
    [BREAKPOINTS.wide, 'wide']
  ] as const)('should report %ipx as %s', (width, expected) => {
    installViewport(width);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe(expected);
  });

  it('should re-render when a boundary is crossed', () => {
    const viewport = installViewport(375);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');

    viewport.resize(800);
    expect(result.current).toBe('tablet');

    viewport.resize(1600);
    expect(result.current).toBe('wide');

    viewport.resize(320);
    expect(result.current).toBe('mobile');
  });

  it('should unsubscribe every listener on unmount', () => {
    const viewport = installViewport(1024);
    const { unmount } = renderHook(() => useBreakpoint());
    expect(viewport.listenerCount()).toBeGreaterThan(0);

    unmount();
    expect(viewport.listenerCount()).toBe(0);
  });

  it('should share MediaQueryList objects across hook instances', () => {
    const viewport = installViewport(1024);
    renderHook(() => useBreakpoint());
    const afterFirst = viewport.listenerCount();

    renderHook(() => useBreakpoint());
    // The stub pools listeners in one Set, so this counts subscriptions; the sharing is the cache.
    expect(viewport.listenerCount()).toBe(afterFirst * 2);
  });

  describe('useIsMobile', () => {
    it('should be true below the tablet boundary and false at it', () => {
      installViewport(BREAKPOINTS.tablet - 1);
      expect(renderHook(() => useIsMobile()).result.current).toBe(true);

      installViewport(BREAKPOINTS.tablet);
      expect(renderHook(() => useIsMobile()).result.current).toBe(false);
    });
  });

  describe('environments without a viewport', () => {
    it('should render the mobile tier on the server', () => {
      // The server snapshot has to match `readBreakpoint`'s fallback, or hydration re-keys
      // anything sized by the tier. `mobile` asks the least of the device.
      const html = renderToString(<BreakpointProbe />);
      expect(html).toContain('mobile');
    });

    it('should report mobile when window is absent entirely', () => {
      vi.stubGlobal('window', undefined);
      resetBreakpointCache();

      // Read without React: react-dom cannot render without a window.
      expect(readBreakpoint()).toBe('mobile');
    });

    it('should report mobile when matchMedia is missing', () => {
      (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
      resetBreakpointCache();

      expect(readBreakpoint()).toBe('mobile');
      const { result } = renderHook(() => useBreakpoint());
      expect(result.current).toBe('mobile');
    });

    it('should hand back a no-op unsubscribe when there is nothing to subscribe to', () => {
      (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
      resetBreakpointCache();

      const { unmount } = renderHook(() => useBreakpoint());
      expect(() => unmount()).not.toThrow();
    });
  });
});

function BreakpointProbe() {
  return <span>{useBreakpoint()}</span>;
}
