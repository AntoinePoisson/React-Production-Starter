import { useSyncExternalStore } from 'react';

// CSS handles transitions. A useFrame loop is JS, so autoRotate etc. have to
// check this themselves.

const QUERY = '(prefers-reduced-motion: reduce)';

let mediaQuery: MediaQueryList | null = null;

const getMediaQuery = (): MediaQueryList | null => {
  if (mediaQuery) return mediaQuery;

  // globalThis.window — a bare `window` throws where there's no DOM.
  const matchMedia = globalThis.window?.matchMedia;
  if (typeof matchMedia !== 'function') return null;

  mediaQuery = matchMedia.call(window, QUERY);
  return mediaQuery;
};

export const readPrefersReducedMotion = (): boolean => getMediaQuery()?.matches ?? true;

// Reduced on the server so the first client render matches.
const getServerSnapshot = (): boolean => true;

const subscribe = (callback: () => void): (() => void) => {
  const query = getMediaQuery();
  if (!query) return () => {};

  query.addEventListener('change', callback);

  return () => query.removeEventListener('change', callback);
};

export const usePrefersReducedMotion = (): boolean =>
  useSyncExternalStore(subscribe, readPrefersReducedMotion, getServerSnapshot);

export const resetReducedMotionCache = (): void => {
  mediaQuery = null;
};
