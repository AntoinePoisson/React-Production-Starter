import { useEffect, useRef } from 'react';

import { markAsVisited, isFirstVisit as readFirstVisit } from './SessionStorage';
import useGlobalStore from './Store';

// An effect and not a render-time read, sessionStorage doesn't exist on the server.
export function useFirstVisit(): void {
  // Strict Mode guard: the effect writes the value it reads, so the second pass would see its own
  // timestamp and set the store to false. A ref rather than a module flag, which would also
  // survive a real remount.
  const resolved = useRef(false);

  useEffect(() => {
    if (resolved.current) return;
    resolved.current = true;

    const firstVisit = readFirstVisit();

    useGlobalStore.getState().setIsFirstVisit(firstVisit);

    if (firstVisit) markAsVisited();
  }, []);
}
