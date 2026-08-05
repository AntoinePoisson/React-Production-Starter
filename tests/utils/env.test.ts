/** Unit tests for the environment detection helpers. */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getEnvironment, isDevelopment, isProduction } from '@/utils/config/Env';

describe('Environment Configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isProduction', () => {
    it('should return true when MODE is production', () => {
      vi.stubEnv('MODE', 'production');
      expect(isProduction()).toBe(true);
    });

    it('should return false when MODE is development', () => {
      vi.stubEnv('MODE', 'development');
      expect(isProduction()).toBe(false);
    });

    it('should return false when MODE is test', () => {
      vi.stubEnv('MODE', 'test');
      expect(isProduction()).toBe(false);
    });

    it('should return false when MODE is undefined', () => {
      vi.stubEnv('MODE', undefined);
      expect(isProduction()).toBe(false);
    });

    it('should be a pure function (no side effects)', () => {
      vi.stubEnv('MODE', 'production');
      const result1 = isProduction();
      const result2 = isProduction();
      expect(result1).toBe(result2);
    });
  });

  describe('isDevelopment', () => {
    it('should return true when MODE is development', () => {
      vi.stubEnv('MODE', 'development');
      expect(isDevelopment()).toBe(true);
    });

    it('should return false when MODE is production', () => {
      vi.stubEnv('MODE', 'production');
      expect(isDevelopment()).toBe(false);
    });

    it('should return false when MODE is test', () => {
      vi.stubEnv('MODE', 'test');
      expect(isDevelopment()).toBe(false);
    });

    it('should return false when MODE is undefined', () => {
      vi.stubEnv('MODE', undefined);
      expect(isDevelopment()).toBe(false);
    });

    it('should be a pure function (no side effects)', () => {
      vi.stubEnv('MODE', 'development');
      const result1 = isDevelopment();
      const result2 = isDevelopment();
      expect(result1).toBe(result2);
    });
  });

  describe('getEnvironment', () => {
    it('should return "production" when MODE is production', () => {
      vi.stubEnv('MODE', 'production');
      expect(getEnvironment()).toBe('production');
    });

    it('should return "development" when MODE is development', () => {
      vi.stubEnv('MODE', 'development');
      expect(getEnvironment()).toBe('development');
    });

    it('should return "test" when MODE is test', () => {
      vi.stubEnv('MODE', 'test');
      expect(getEnvironment()).toBe('test');
    });

    it('should return "development" as default when MODE is undefined', () => {
      vi.stubEnv('MODE', undefined);
      expect(getEnvironment()).toBe('development');
    });

    it('should handle custom environment names', () => {
      vi.stubEnv('MODE', 'staging');
      expect(getEnvironment()).toBe('staging');
    });

    it('should be a pure function (no side effects)', () => {
      vi.stubEnv('MODE', 'production');
      const result1 = getEnvironment();
      const result2 = getEnvironment();
      expect(result1).toBe(result2);
    });

    it('should return a string', () => {
      vi.stubEnv('MODE', 'production');
      expect(typeof getEnvironment()).toBe('string');
    });
  });

  describe('Environment Consistency', () => {
    it('should have mutually exclusive production and development states', () => {
      vi.stubEnv('MODE', 'production');
      expect(isProduction() && isDevelopment()).toBe(false);

      vi.stubEnv('MODE', 'development');
      expect(isProduction() && isDevelopment()).toBe(false);
    });

    it('should match getEnvironment with isProduction', () => {
      vi.stubEnv('MODE', 'production');
      expect(getEnvironment() === 'production').toBe(isProduction());
    });

    it('should match getEnvironment with isDevelopment', () => {
      vi.stubEnv('MODE', 'development');
      expect(getEnvironment() === 'development').toBe(isDevelopment());
    });
  });

  describe('Default Test Environment', () => {
    it('should detect test environment correctly', () => {
      // Vitest sets MODE to 'test' by default
      if (process.env.MODE === 'test') {
        expect(isProduction()).toBe(false);
        expect(isDevelopment()).toBe(false);
        expect(getEnvironment()).toBe('test');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string MODE', () => {
      vi.stubEnv('MODE', '');
      expect(getEnvironment()).toBe('development');
      expect(isProduction()).toBe(false);
      expect(isDevelopment()).toBe(false);
    });

    it('should handle case-sensitive environment names', () => {
      vi.stubEnv('MODE', 'Production');
      expect(isProduction()).toBe(false);
      expect(getEnvironment()).toBe('Production');
    });

    it('should handle whitespace in MODE', () => {
      vi.stubEnv('MODE', ' production ');
      expect(isProduction()).toBe(false);
      expect(getEnvironment()).toBe(' production ');
    });
  });

  describe('Function Exports', () => {
    it('should export isProduction function', () => {
      expect(isProduction).toBeDefined();
      expect(typeof isProduction).toBe('function');
    });

    it('should export isDevelopment function', () => {
      expect(isDevelopment).toBeDefined();
      expect(typeof isDevelopment).toBe('function');
    });

    it('should export getEnvironment function', () => {
      expect(getEnvironment).toBeDefined();
      expect(typeof getEnvironment).toBe('function');
    });
  });
});
