import { useSyncExternalStore } from 'react';

import { BREAKPOINTS, type Breakpoint } from './Breakpoints';

/**
 * Current screen tier. useSyncExternalStore rather than useState + a resize listener: matchMedia
 * only fires on a boundary crossing, and the server snapshot avoids a hydration mismatch.
 *
 * Purely visual decisions belong in a Tailwind variant. Use the hook when the tier changes what
 * actually runs, like how many instances the scene draws.
 */

// rem is what Tailwind emits, and in a media query it resolves against the browser's initial font
// size, so a px query would split CSS and JS wherever that size isn't 16.
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

  // globalThis.window, a bare `window` throws ReferenceError where there is no DOM.
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

// 'mobile' on the server, same as readBreakpoint's fallback. FloatingShapes keys its
// instancedMesh on the instance count, so guessing the cheap tier costs an upgrade on the first
// client read instead of a dispose + GPU re-upload during hydration.
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
