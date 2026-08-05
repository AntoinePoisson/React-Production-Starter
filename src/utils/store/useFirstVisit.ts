import { useEffect, useRef } from 'react';

import { markAsVisited, isFirstVisit as readFirstVisit } from './SessionStorage';
import useGlobalStore from './Store';

/**
 * Resolves the first-visit flag into the store, once, on mount. An effect rather than a
 * render-time read: sessionStorage does not exist on the server. Call it once, high in the tree
 * (app/Providers.tsx); read it with `useGlobalStore((state) => state.isFirstVisit)`.
 */
export function useFirstVisit(): void {
  // Strict Mode guard: the effect writes the value it reads, so the second pass would see its own
  // timestamp and set the store to false. A ref, not a module flag, which survives real remounts.
  const resolved = useRef(false);

  useEffect(() => {
    if (resolved.current) return;
    resolved.current = true;

    const firstVisit = readFirstVisit();

    useGlobalStore.getState().setIsFirstVisit(firstVisit);

    if (firstVisit) markAsVisited();
  }, []);
}
