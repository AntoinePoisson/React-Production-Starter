import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import useGlobalStore from '@/utils/store/Store';

describe('Global Store', () => {
  beforeEach(() => {
    act(() => {
      useGlobalStore.setState({ isFirstVisit: false });
    });
  });

  describe('Initial State', () => {
    it('should not assume a first visit before it is resolved', () => {
      const { result } = renderHook(() => useGlobalStore());
      expect(result.current.isFirstVisit).toBe(false);
    });
  });

  describe('First Visit Flag', () => {
    it('should flag a first visit', () => {
      const { result } = renderHook(() => useGlobalStore());

      act(() => {
        result.current.setIsFirstVisit(true);
      });

      expect(result.current.isFirstVisit).toBe(true);
    });

    it('should clear the flag', () => {
      const { result } = renderHook(() => useGlobalStore());

      act(() => {
        result.current.setIsFirstVisit(true);
        result.current.setIsFirstVisit(false);
      });

      expect(result.current.isFirstVisit).toBe(false);
    });
  });

  describe('Store Sharing', () => {
    it('should share state across hook instances', () => {
      const first = renderHook(() => useGlobalStore());
      const second = renderHook(() => useGlobalStore());

      act(() => {
        first.result.current.setIsFirstVisit(true);
      });

      expect(second.result.current.isFirstVisit).toBe(true);
    });

    it('should be readable outside React via getState()', () => {
      act(() => {
        useGlobalStore.getState().setIsFirstVisit(true);
      });

      expect(useGlobalStore.getState().isFirstVisit).toBe(true);
    });
  });
});
