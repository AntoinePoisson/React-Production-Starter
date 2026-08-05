import { create } from 'zustand';

/**
 * Global store, intentionally minimal: only genuinely cross-cutting state belongs here (read by
 * unrelated components, or written from outside React). A store subscription is a re-render.
 */
interface StoreState {
  /** Resolved on mount by `useFirstVisit()`; `false` until then, so server and client agree. */
  isFirstVisit: boolean;
}

interface StoreActions {
  setIsFirstVisit: (value: boolean) => void;
}

type GlobalState = StoreState & StoreActions;

const useGlobalStore = create<GlobalState>()((set) => ({
  isFirstVisit: false,

  setIsFirstVisit: (value) => set({ isFirstVisit: value })
}));

export default useGlobalStore;
