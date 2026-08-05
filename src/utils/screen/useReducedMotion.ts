import { useSyncExternalStore } from 'react';

/**
 * Whether the visitor has asked for reduced motion.
 *
 * `globals.css` handles transitions and keyframes; a three.js frame loop is JavaScript, so
 * `autoRotate` and `useFrame` have to gate on the query themselves. WCAG 2.2.2 is about
 * *automatic* movement: orbiting by drag is unaffected.
 */

const QUERY = '(prefers-reduced-motion: reduce)';

// Lazily created and shared: one MediaQueryList for the app, not one per component.
let mediaQuery: MediaQueryList | null = null;

const getMediaQuery = (): MediaQueryList | null => {
  if (mediaQuery) return mediaQuery;

  // `globalThis.window`: a bare `window` throws ReferenceError where there is no DOM.
  const matchMedia = globalThis.window?.matchMedia;
  if (typeof matchMedia !== 'function') return null;

  mediaQuery = matchMedia.call(window, QUERY);
  return mediaQuery;
};

/** The preference, read without React. `true` where there is nothing to ask: do not move on a guess. */
export const readPrefersReducedMotion = (): boolean => getMediaQuery()?.matches ?? true;

// "reduced" on the server, so the first client render is still.
const getServerSnapshot = (): boolean => true;

const subscribe = (callback: () => void): (() => void) => {
  const query = getMediaQuery();
  if (!query) return () => {};

  query.addEventListener('change', callback);

  return () => query.removeEventListener('change', callback);
};

export const usePrefersReducedMotion = (): boolean =>
  useSyncExternalStore(subscribe, readPrefersReducedMotion, getServerSnapshot);

/** Test seam: drops the cached MediaQueryList so a new stub takes effect. */
export const resetReducedMotionCache = (): void => {
  mediaQuery = null;
};
