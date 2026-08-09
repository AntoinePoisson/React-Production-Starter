import { create } from 'zustand';

/**
 * Keep this small. Only stuff that really is shared across the app.
 * Every subscription is a re-render.
 */
interface StoreState {
  /** Set on mount by useFirstVisit(). false until then, so SSR and client match. */
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
