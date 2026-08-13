/** How the logger picks its starting level: resolved once at import time, so every case re-imports. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY_SUFFIX = '_logLevel';

const storageKey = (): string => {
  const key = Object.keys(localStorage).find((candidate) => candidate.endsWith(STORAGE_KEY_SUFFIX));
  expect(key, 'the logger never wrote a level key').toBeDefined();
  return key as string;
};

/** Re-import the logger with the current URL and storage in place. */
const freshLogger = async () => {
  vi.resetModules();
  return import('@/utils/logger/Logger');
};

describe('log level resolution', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  describe('the environment default', () => {
    it('should be debug while developing', async () => {
      vi.stubEnv('MODE', 'development');

      const { getLogLevel } = await freshLogger();
      expect(getLogLevel()).toBe('debug');
    });

    it('should be warn in production', async () => {
      vi.stubEnv('MODE', 'production');

      // Not `silent`: a production build that hides its own warnings and errors cannot be supported.
      const { getLogLevel } = await freshLogger();
      expect(getLogLevel()).toBe('warn');
    });
  });

  describe('the ?log= query parameter', () => {
    it('should win over everything else', async () => {
      window.history.replaceState({}, '', '/?log=error');

      const { getLogLevel } = await freshLogger();
      expect(getLogLevel()).toBe('error');
    });

    it('should persist, so a reload keeps the level', async () => {
      window.history.replaceState({}, '', '/?log=info');

      await freshLogger();
      expect(localStorage.getItem(storageKey())).toBe('info');
    });

    it('should override a previously stored level', async () => {
      window.history.replaceState({}, '', '/?log=silent');
      await freshLogger();
      expect(localStorage.getItem(storageKey())).toBe('silent');

      window.history.replaceState({}, '', '/?log=warn');
      const { getLogLevel } = await freshLogger();
      expect(getLogLevel()).toBe('warn');
    });

    it('should ignore a value that is not a level', async () => {
      window.history.replaceState({}, '', '/?log=chatty');

      const { getLogLevel } = await freshLogger();
      // Falls through to the environment default.
      expect(['debug', 'warn']).toContain(getLogLevel());
    });
  });

  describe('persisted level', () => {
    it('should be restored when no query parameter is present', async () => {
      const { setLogLevel } = await freshLogger();
      setLogLevel('error');

      const reloaded = await freshLogger();
      expect(reloaded.getLogLevel()).toBe('error');
    });

    it('should be ignored when the stored value is not a level', async () => {
      const { setLogLevel } = await freshLogger();
      setLogLevel('error');
      localStorage.setItem(storageKey(), 'nonsense');

      const reloaded = await freshLogger();
      expect(reloaded.getLogLevel()).not.toBe('nonsense');
    });
  });

  describe('when storage is unavailable', () => {
    it('should fall back to the environment default instead of throwing', async () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });

      try {
        // Private browsing or a locked-down embed: logging is not worth a boot failure.
        const { getLogLevel } = await freshLogger();
        expect(['debug', 'warn']).toContain(getLogLevel());
      } finally {
        getItem.mockRestore();
      }
    });

    it('should not throw when the level cannot be written', async () => {
      const { setLogLevel, getLogLevel } = await freshLogger();
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });

      try {
        expect(() => setLogLevel('warn')).not.toThrow();
        // The in-memory level still changed; only persistence was lost.
        expect(getLogLevel()).toBe('warn');
      } finally {
        setItem.mockRestore();
      }
    });
  });

  describe('without a window', () => {
    it('should use the environment default', async () => {
      vi.stubGlobal('window', undefined);

      const { getLogLevel } = await freshLogger();
      expect(['debug', 'warn']).toContain(getLogLevel());
    });

    it('should treat setLogLevel as memory-only', async () => {
      const { setLogLevel, getLogLevel } = await freshLogger();
      vi.stubGlobal('window', undefined);

      expect(() => setLogLevel('silent')).not.toThrow();
      expect(getLogLevel()).toBe('silent');
    });

    it('should make exposeLogControls a no-op', async () => {
      const { exposeLogControls } = await freshLogger();
      vi.stubGlobal('window', undefined);

      expect(() => exposeLogControls()).not.toThrow();
    });
  });
});
