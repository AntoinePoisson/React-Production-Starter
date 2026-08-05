/** Unit tests for the first-visit flag and its timestamp-based expiration. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isFirstVisit, markAsVisited, resetVisitFlag } from '@/utils/store/SessionStorage';

describe('SessionStorage Utility', () => {
  let storageStore: Record<string, string> = {};

  const createMockStorage = () => ({
    getItem: vi.fn((key: string) => storageStore[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storageStore[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storageStore[key];
    }),
    clear: vi.fn(() => {
      storageStore = {};
    }),
    get length() {
      return Object.keys(storageStore).length;
    },
    key: vi.fn((index: number) => Object.keys(storageStore)[index] || null)
  });

  let mockSessionStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storageStore = {};
    mockSessionStorage = createMockStorage();

    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
      configurable: true
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    // Unstub first: the next beforeEach defines a property on `window`, which throws if a test
    // left it stubbed away.
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('isFirstVisit()', () => {
    it('should return true when no timestamp is stored (first visit)', () => {
      expect(isFirstVisit()).toBe(true);
      expect(mockSessionStorage.getItem).toHaveBeenCalled();
    });

    it('should return true when timestamp is expired (>3 days)', () => {
      const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000;
      storageStore['app_react-app-fondation_firstVisit'] = fourDaysAgo.toString();

      expect(isFirstVisit()).toBe(true);
    });

    it('should return true when timestamp is exactly 3 days old (boundary)', () => {
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000 + 1);
      storageStore['app_react-app-fondation_firstVisit'] = threeDaysAgo.toString();

      expect(isFirstVisit()).toBe(true);
    });

    it('should return false when timestamp is recent (<3 days)', () => {
      const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000;
      storageStore['app_react-app-fondation_firstVisit'] = oneDayAgo.toString();

      expect(isFirstVisit()).toBe(false);
    });

    it('should return false when timestamp is just set (0 seconds ago)', () => {
      storageStore['app_react-app-fondation_firstVisit'] = Date.now().toString();

      expect(isFirstVisit()).toBe(false);
    });

    it('should return false when timestamp is 2 days 23 hours ago (edge case)', () => {
      const almostThreeDays = Date.now() - (2 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000);
      storageStore['app_react-app-fondation_firstVisit'] = almostThreeDays.toString();

      expect(isFirstVisit()).toBe(false);
    });

    it('should return true when stored value is not a valid number (corrupted data)', () => {
      storageStore['app_react-app-fondation_firstVisit'] = 'invalid-timestamp';

      expect(isFirstVisit()).toBe(true);
    });

    it('should return true when stored value is empty string', () => {
      storageStore['app_react-app-fondation_firstVisit'] = '';

      expect(isFirstVisit()).toBe(true);
    });

    it('should return true when stored value is NaN-producing string', () => {
      storageStore['app_react-app-fondation_firstVisit'] = 'abc123';

      expect(isFirstVisit()).toBe(true);
    });

    it('should return true when sessionStorage.getItem throws an error', () => {
      mockSessionStorage.getItem.mockImplementation(() => {
        throw new Error('sessionStorage not available');
      });

      expect(isFirstVisit()).toBe(true);
      expect(mockSessionStorage.getItem).toHaveBeenCalled();
    });

    it('should handle negative timestamps gracefully', () => {
      storageStore['app_react-app-fondation_firstVisit'] = '-1000';

      expect(isFirstVisit()).toBe(true);
    });

    it('should handle future timestamps gracefully', () => {
      const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
      storageStore['app_react-app-fondation_firstVisit'] = tomorrow.toString();

      // now - lastVisit is negative, so never > threeDaysInMs: a future stamp reads as recent.
      expect(isFirstVisit()).toBe(false);
    });
  });

  describe('markAsVisited()', () => {
    it('should store current timestamp in sessionStorage', () => {
      const currentTime = Date.now();
      markAsVisited();

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'app_react-app-fondation_firstVisit',
        currentTime.toString()
      );
      expect(storageStore['app_react-app-fondation_firstVisit']).toBe(currentTime.toString());
    });

    it('should update existing timestamp when called multiple times', () => {
      const firstTime = Date.now();
      markAsVisited();
      expect(storageStore['app_react-app-fondation_firstVisit']).toBe(firstTime.toString());

      vi.advanceTimersByTime(60 * 60 * 1000);

      const secondTime = Date.now();
      markAsVisited();
      expect(storageStore['app_react-app-fondation_firstVisit']).toBe(secondTime.toString());

      expect(secondTime).toBeGreaterThan(firstTime);
    });

    it('should not throw when sessionStorage.setItem fails', () => {
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => markAsVisited()).not.toThrow();
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
    });

    it('should silently fail in private browsing mode (storage unavailable)', () => {
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => markAsVisited()).not.toThrow();
    });
  });

  describe('resetVisitFlag()', () => {
    it('should remove the timestamp from sessionStorage', () => {
      storageStore['app_react-app-fondation_firstVisit'] = Date.now().toString();

      resetVisitFlag();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('app_react-app-fondation_firstVisit');
      expect(storageStore['app_react-app-fondation_firstVisit']).toBeUndefined();
    });

    it('should work even if no timestamp was previously stored', () => {
      expect(() => resetVisitFlag()).not.toThrow();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('app_react-app-fondation_firstVisit');
    });

    it('should not throw when sessionStorage.removeItem fails', () => {
      mockSessionStorage.removeItem.mockImplementation(() => {
        throw new Error('sessionStorage not available');
      });

      expect(() => resetVisitFlag()).not.toThrow();
      expect(mockSessionStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full workflow: first visit → mark → check → reset → check', () => {
      expect(isFirstVisit()).toBe(true);

      markAsVisited();

      expect(isFirstVisit()).toBe(false);

      resetVisitFlag();

      expect(isFirstVisit()).toBe(true);
    });

    it('should handle time-based expiration workflow', () => {
      markAsVisited();
      expect(isFirstVisit()).toBe(false);

      // 2 days: still inside the window.
      vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);
      expect(isFirstVisit()).toBe(false);

      // 4 days total: expired.
      vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);
      expect(isFirstVisit()).toBe(true);
    });

    it('should handle rapid successive calls (stress test)', () => {
      for (let i = 0; i < 100; i++) {
        markAsVisited();
      }

      expect(isFirstVisit()).toBe(false);

      resetVisitFlag();
      expect(isFirstVisit()).toBe(true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle sessionStorage being completely unavailable', () => {
      Object.defineProperty(window, 'sessionStorage', {
        get() {
          throw new Error('sessionStorage is not defined');
        },
        configurable: true
      });

      expect(isFirstVisit()).toBe(true);
      expect(() => markAsVisited()).not.toThrow();
      expect(() => resetVisitFlag()).not.toThrow();
    });

    it('should handle sessionStorage returning null unexpectedly', () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      expect(isFirstVisit()).toBe(true);
    });

    it('should handle very large timestamp values (year 9999)', () => {
      const farFuture = new Date('9999-12-31').getTime();
      storageStore['app_react-app-fondation_firstVisit'] = farFuture.toString();

      expect(() => isFirstVisit()).not.toThrow();
      expect(isFirstVisit()).toBe(false);
    });

    it('should handle very small timestamp values (year 1970)', () => {
      storageStore['app_react-app-fondation_firstVisit'] = '0';

      expect(isFirstVisit()).toBe(true);
    });
  });

  describe('Environment-specific behavior', () => {
    it('should use correct storage key based on environment variables', () => {
      markAsVisited();

      // Only the suffix is asserted: the namespace prefix comes from env vars not stubbed here.
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('_firstVisit'),
        expect.any(String)
      );
    });

    it('should calculate 3-day expiration correctly', () => {
      const now = Date.now();

      const almostExpired = now - (3 * 24 * 60 * 60 * 1000 - 1000);
      storageStore['app_react-app-fondation_firstVisit'] = almostExpired.toString();
      expect(isFirstVisit()).toBe(false);

      const justExpired = now - (3 * 24 * 60 * 60 * 1000 + 1000);
      storageStore['app_react-app-fondation_firstVisit'] = justExpired.toString();
      expect(isFirstVisit()).toBe(true);
    });
  });
  // No DOM (the static export renders in Node) or a storage API that throws (Safari private
  // mode). Neither is worth failing a page load over, so all three helpers degrade.
  describe('hostile environments', () => {
    it('should assume a first visit when there is no window', () => {
      vi.stubGlobal('window', undefined);
      expect(isFirstVisit()).toBe(true);
    });

    it('should skip marking the visit when there is no window', () => {
      vi.stubGlobal('window', undefined);
      expect(() => markAsVisited()).not.toThrow();
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('should skip resetting the flag when there is no window', () => {
      vi.stubGlobal('window', undefined);
      expect(() => resetVisitFlag()).not.toThrow();
      expect(mockSessionStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should assume a first visit when reading storage throws', () => {
      mockSessionStorage.getItem.mockImplementationOnce(() => {
        throw new DOMException('denied', 'SecurityError');
      });

      expect(isFirstVisit()).toBe(true);
    });

    it('should swallow a write failure', () => {
      mockSessionStorage.setItem.mockImplementationOnce(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });

      expect(() => markAsVisited()).not.toThrow();
    });

    it('should swallow a removal failure', () => {
      mockSessionStorage.removeItem.mockImplementationOnce(() => {
        throw new DOMException('denied', 'SecurityError');
      });

      expect(() => resetVisitFlag()).not.toThrow();
    });
  });
});
