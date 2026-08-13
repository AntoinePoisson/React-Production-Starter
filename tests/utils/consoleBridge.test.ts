/* eslint-disable no-console -- this suite patches and restores console itself, so it has
   to call the very methods the rule is there to discourage. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installConsoleBridge, uninstallConsoleBridge } from '@/utils/logger/ConsoleBridge';
import { consoleTransport } from '@/utils/logger/ConsoleTransport';
import { addTransport, clearTransports, createLogger, setLogLevel } from '@/utils/logger/Logger';

describe('ConsoleBridge', () => {
  beforeEach(() => {
    setLogLevel('debug');
  });

  afterEach(() => {
    uninstallConsoleBridge();
    setLogLevel('debug');
  });

  it('should route console.log into the pipeline under the console scope', () => {
    const sink = vi.fn();
    const dispose = addTransport(sink);

    try {
      installConsoleBridge();
      console.log('stray', 1);

      const record = sink.mock.calls.at(-1)?.[0];
      expect(record.scope).toBe('console');
      expect(record.level).toBe('debug');
      expect(record.args).toEqual(['stray', 1]);
    } finally {
      dispose();
    }
  });

  it.each([
    ['log', 'debug'],
    ['debug', 'debug'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error']
  ] as const)('should map console.%s to the %s level', (method, level) => {
    const sink = vi.fn();
    const dispose = addTransport(sink);

    try {
      installConsoleBridge();
      console[method]('x');
      expect(sink.mock.calls.at(-1)?.[0].level).toBe(level);
    } finally {
      dispose();
    }
  });

  it('should not recurse when the console transport writes back to the console', () => {
    const sink = vi.fn();
    const dispose = addTransport(sink);

    try {
      installConsoleBridge();
      // Would blow the stack if the bound transport called the patched method.
      expect(() => console.warn('round trip')).not.toThrow();
      expect(sink).toHaveBeenCalledOnce();
    } finally {
      dispose();
    }
  });

  it('should be idempotent', () => {
    const sink = vi.fn();
    const dispose = addTransport(sink);

    try {
      installConsoleBridge();
      const patched = console.log;
      installConsoleBridge();

      expect(console.log).toBe(patched);

      console.log('once');
      expect(sink).toHaveBeenCalledOnce();
    } finally {
      dispose();
    }
  });

  it('should restore the original methods on uninstall', () => {
    const original = console.log;

    installConsoleBridge();
    expect(console.log).not.toBe(original);

    uninstallConsoleBridge();
    expect(console.log).toBe(original);
  });

  it('should leave the non-levelled console methods alone', () => {
    const table = console.table;
    const group = console.group;

    installConsoleBridge();

    expect(console.table).toBe(table);
    expect(console.group).toBe(group);
  });

  describe('the console transport it borrows', () => {
    /** Emit through the pipeline and report whether the console sink got it. */
    const writesToTheConsole = (): boolean => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        installConsoleBridge();
        uninstallConsoleBridge();

        spy.mockClear();
        createLogger('probe').warn('after uninstall');

        return spy.mock.calls.length > 0;
      } finally {
        spy.mockRestore();
      }
    };

    it('should put it back when it was registered at install time', () => {
      clearTransports();
      addTransport(consoleTransport);

      expect(writesToTheConsole()).toBe(true);
    });

    it('should not resurrect it when the app had removed it', () => {
      // Production setup is `clearTransports()` then `addTransport(myService)`: uninstall must
      // not put the browser console back in a build that opted out of it.
      clearTransports();

      expect(writesToTheConsole()).toBe(false);

      addTransport(consoleTransport); // Restore the module's default for the rest of the suite.
    });
  });

  it('should still respect the level threshold', () => {
    const sink = vi.fn();
    const dispose = addTransport(sink);

    try {
      installConsoleBridge();
      setLogLevel('error');
      console.log('dropped');

      expect(sink).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });
});
