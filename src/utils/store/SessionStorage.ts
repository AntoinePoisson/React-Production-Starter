/**
 * First-visit flag, resolved into the store by useFirstVisit(). Namespaced per project so apps
 * sharing an origin never collide. A timestamp rather than a boolean, so a visit older than the
 * window counts as a first visit again.
 */

// || and not ??. CI passes these as ${{ vars.X }}, which is the empty string when the repository
// variable is unset, and '' ?? 'app' is ''.
const STORAGE_KEY = `${import.meta.env.VITE_MAIN_WEBSITE_NAME || 'app'}_${import.meta.env.VITE_PROJECT_NAME || 'react-app-fondation'}_firstVisit`;
const EXPIRATION_DAYS = 3;

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
    // private browsing
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

export const resetVisitFlag = (): void => {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage unavailable
  }
};
