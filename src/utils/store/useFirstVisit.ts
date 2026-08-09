import { useEffect, useRef } from 'react';

import { markAsVisited, isFirstVisit as readFirstVisit } from './SessionStorage';
import useGlobalStore from './Store';

// Effect, not a render-time read — no sessionStorage on the server.
export function useFirstVisit(): void {
  // Strict Mode: the effect writes what it reads, so a second pass would see
  // its own timestamp and flip the store to false. Ref, not a module flag
  // (that would also survive a real remount).
  const resolved = useRef(false);

  useEffect(() => {
    if (resolved.current) return;
    resolved.current = true;

    const firstVisit = readFirstVisit();

    useGlobalStore.getState().setIsFirstVisit(firstVisit);

    if (firstVisit) markAsVisited();
  }, []);
}
