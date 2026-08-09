import { useSyncExternalStore } from 'react';

import { BREAKPOINTS, type Breakpoint } from './Breakpoints';

/**
 * Current screen tier. matchMedia via useSyncExternalStore — only fires on a
 * boundary cross, and the server snapshot avoids a hydration mismatch.
 *
 * Visual-only? Use a Tailwind variant. This hook is for when the tier changes
 * what actually runs (instance counts, etc.).
 */

// rem, same as Tailwind. A px query would disagree wherever the root font isn't 16.
const REM = 16;

const QUERIES = {
  tablet: `(min-width: ${BREAKPOINTS.tablet / REM}rem)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop / REM}rem)`,
  wide: `(min-width: ${BREAKPOINTS.wide / REM}rem)`
} as const;

type BreakpointQueries = Record<keyof typeof QUERIES, MediaQueryList>;

let mediaQueries: BreakpointQueries | null = null;

const getMediaQueries = (): BreakpointQueries | null => {
  if (mediaQueries) return mediaQueries;

  // globalThis.window — a bare `window` throws where there's no DOM.
  const matchMedia = globalThis.window?.matchMedia;
  if (typeof matchMedia !== 'function') return null;

  mediaQueries = {
    tablet: matchMedia.call(window, QUERIES.tablet),
    desktop: matchMedia.call(window, QUERIES.desktop),
    wide: matchMedia.call(window, QUERIES.wide)
  };
  return mediaQueries;
};

export const readBreakpoint = (): Breakpoint => {
  const queries = getMediaQueries();
  if (!queries) return 'mobile';

  if (queries.wide.matches) return 'wide';
  if (queries.desktop.matches) return 'desktop';
  if (queries.tablet.matches) return 'tablet';
  return 'mobile';
};

// 'mobile' on the server. FloatingShapes keys its mesh on instance count, so
// guessing cheap costs an upgrade on first client read, not a GPU re-upload mid-hydrate.
const getServerSnapshot = (): Breakpoint => 'mobile';

const subscribe = (callback: () => void): (() => void) => {
  const queries = getMediaQueries();
  if (!queries) return () => {};

  const lists = Object.values(queries);
  for (const list of lists) list.addEventListener('change', callback);

  return () => {
    for (const list of lists) list.removeEventListener('change', callback);
  };
};

export const useBreakpoint = (): Breakpoint => useSyncExternalStore(subscribe, readBreakpoint, getServerSnapshot);

export const useIsMobile = (): boolean => useBreakpoint() === 'mobile';

export const resetBreakpointCache = (): void => {
  mediaQueries = null;
};
