import { renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetVisitFlag } from '@/utils/store/SessionStorage';
import useGlobalStore from '@/utils/store/Store';
import { useFirstVisit } from '@/utils/store/useFirstVisit';

describe('useFirstVisit', () => {
  beforeEach(() => {
    resetVisitFlag();
    useGlobalStore.setState({ isFirstVisit: false });
  });

  afterEach(() => {
    resetVisitFlag();
  });

  it('should flag a first visit in the store', () => {
    renderHook(() => useFirstVisit());

    expect(useGlobalStore.getState().isFirstVisit).toBe(true);
  });

  it('should mark the session as visited', () => {
    renderHook(() => useFirstVisit());

    // A second mount now sees a returning visitor.
    useGlobalStore.setState({ isFirstVisit: false });
    renderHook(() => useFirstVisit());

    expect(useGlobalStore.getState().isFirstVisit).toBe(false);
  });

  it('should not flag a first visit when the session is already marked', () => {
    renderHook(() => useFirstVisit());
    useGlobalStore.setState({ isFirstVisit: false });

    renderHook(() => useFirstVisit());

    expect(useGlobalStore.getState().isFirstVisit).toBe(false);
  });

  it('should survive Strict Mode, which replays the effect that wrote the flag', () => {
    // The effect reads a value it also writes: without a guard the replayed pass reads back
    // its own timestamp and overwrites the store with false, killing the entrance animation.
    renderHook(() => useFirstVisit(), { wrapper: StrictMode });

    expect(useGlobalStore.getState().isFirstVisit).toBe(true);
  });
});
