/**
 * First-visit flag in sessionStorage, resolved into the store by `useFirstVisit()`. The key is
 * namespaced per project so apps sharing an origin never collide. Timestamped, not boolean: a
 * visit older than the expiration window counts as a first visit again.
 */

// `||`, not `??`: CI passes these as `${{ vars.X }}`, which renders as the empty string when the
// repository variable is unset, and `'' ?? 'jasd'` is `''`.
const STORAGE_KEY = `${import.meta.env.VITE_MAIN_WEBSITE_NAME || 'app'}_${import.meta.env.VITE_PROJECT_NAME || 'react-app-fondation'}_firstVisit`;
const EXPIRATION_DAYS = 3;

/** True on a first visit, or when the stored timestamp is older than EXPIRATION_DAYS. */
export const isFirstVisit = (): boolean => {
  if (typeof window === 'undefined') return true;

  try {
    const storedTimestamp = sessionStorage.getItem(STORAGE_KEY);

    if (storedTimestamp === null) return true;

    const lastVisit = parseInt(storedTimestamp, 10);
    if (isNaN(lastVisit)) return true;

    const now = Date.now();
    const threeDaysInMs = EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

    return now - lastVisit > threeDaysInMs;
  } catch {
    // sessionStorage unavailable (private browsing)
    return true;
  }
};

export const markAsVisited = (): void => {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(STORAGE_KEY, Date.now().toString());
  } catch {
    // sessionStorage unavailable
  }
};

/** Clears the stored flag (used by tests). */
export const resetVisitFlag = (): void => {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage unavailable
  }
};
