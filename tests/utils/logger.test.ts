import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { consoleTransport, createConsoleTransport, printBanner } from '@/utils/logger/ConsoleTransport';
import {
  type LogRecord,
  addTransport,
  clearTransports,
  createLogger,
  exposeLogControls,
  getLogLevel,
  isLogLevel,
  logger,
  removeTransport,
  setLogLevel,
  toSerializable
} from '@/utils/logger/Logger';

describe('Logger', () => {
  const spies = {
    debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {})
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setLogLevel('debug');
  });

  afterEach(() => {
    setLogLevel('debug');
  });

  describe('scoping', () => {
    it('should prefix messages with the scope', () => {
      createLogger('Canvas').info('ready');
      expect(spies.info).toHaveBeenCalledWith('[Canvas]', 'ready');
    });

    it('should forward every extra argument untouched', () => {
      const error = new Error('boom');
      createLogger('Scene').error('failed', error, 42);
      expect(spies.error).toHaveBeenCalledWith('[Scene]', 'failed', error, 42);
    });

    it('should expose a default logger', () => {
      logger.warn('careful');
      expect(spies.warn).toHaveBeenCalledWith('[app]', 'careful');
    });

    it('should keep loggers independent', () => {
      createLogger('A').debug('one');
      createLogger('B').debug('two');

      expect(spies.debug).toHaveBeenNthCalledWith(1, '[A]', 'one');
      expect(spies.debug).toHaveBeenNthCalledWith(2, '[B]', 'two');
    });

    it('should nest the scope of a child logger', () => {
      createLogger('scene').child('water').debug('ripple');
      expect(spies.debug).toHaveBeenCalledWith('[scene:water]', 'ripple');
    });
  });

  describe('level routing', () => {
    it.each([
      ['debug', 'debug'],
      ['info', 'info'],
      ['warn', 'warn'],
      ['error', 'error']
    ] as const)('should send %s to console.%s', (level, method) => {
      createLogger('Test')[level]('message');
      expect(spies[method]).toHaveBeenCalledOnce();
    });
  });

  describe('threshold', () => {
    it('should drop everything below the current level', () => {
      setLogLevel('warn');
      const log = createLogger('Test');

      log.debug('nope');
      log.info('nope');
      log.warn('yes');
      log.error('yes');

      expect(spies.debug).not.toHaveBeenCalled();
      expect(spies.info).not.toHaveBeenCalled();
      expect(spies.warn).toHaveBeenCalledOnce();
      expect(spies.error).toHaveBeenCalledOnce();
    });

    it('should let errors through at the error level', () => {
      setLogLevel('error');
      const log = createLogger('Test');

      log.warn('nope');
      log.error('yes');

      expect(spies.warn).not.toHaveBeenCalled();
      expect(spies.error).toHaveBeenCalledOnce();
    });

    it('should mute everything at the silent level', () => {
      setLogLevel('silent');
      const log = createLogger('Test');

      log.debug('nope');
      log.info('nope');
      log.warn('nope');
      log.error('nope');

      expect(spies.debug).not.toHaveBeenCalled();
      expect(spies.info).not.toHaveBeenCalled();
      expect(spies.warn).not.toHaveBeenCalled();
      expect(spies.error).not.toHaveBeenCalled();
    });

    it('should apply the level to loggers created before the change', () => {
      const log = createLogger('Test');
      setLogLevel('silent');

      log.error('nope');

      expect(spies.error).not.toHaveBeenCalled();
    });

    it('should report the current level', () => {
      setLogLevel('info');
      expect(getLogLevel()).toBe('info');
    });

    it('should persist the level so it survives a reload', () => {
      setLogLevel('error');
      const stored = Object.keys(localStorage).find((key) => key.endsWith('_logLevel'));
      expect(stored).toBeDefined();
      expect(localStorage.getItem(stored as string)).toBe('error');
    });

    it.each([
      ['debug', true],
      ['silent', true],
      ['verbose', false],
      [null, false],
      [42, false]
    ])('should validate %s as a level: %s', (value, expected) => {
      expect(isLogLevel(value)).toBe(expected);
    });
  });

  describe('rate limiting', () => {
    it('should emit a once() key a single time', () => {
      const log = createLogger('Test');

      log.once('ctx').error('gone');
      log.once('ctx').error('gone');
      log.once('ctx').error('gone');

      expect(spies.error).toHaveBeenCalledOnce();
    });

    it('should track once() keys independently', () => {
      const log = createLogger('Test');

      log.once('a').warn('first');
      log.once('b').warn('second');

      expect(spies.warn).toHaveBeenCalledTimes(2);
    });

    it('should not burn a once() key on a record the level gate already dropped', () => {
      const log = createLogger('Test');
      setLogLevel('silent');
      log.once('ctx').error('suppressed');

      setLogLevel('debug');
      log.once('ctx').error('should still get through');

      expect(spies.error).toHaveBeenCalledOnce();
    });

    it('should throttle every() to one record per window', () => {
      vi.useFakeTimers();
      try {
        const log = createLogger('Frame');

        log.every(1000, 'fps').debug('60');
        vi.advanceTimersByTime(400);
        log.every(1000, 'fps').debug('59');
        vi.advanceTimersByTime(400);
        log.every(1000, 'fps').debug('58');

        expect(spies.debug).toHaveBeenCalledOnce();

        vi.advanceTimersByTime(1000);
        log.every(1000, 'fps').debug('57');

        expect(spies.debug).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should not gate an unrelated call after the gate is consumed', () => {
      const log = createLogger('Test');

      log.once('k').info('first');
      log.info('unrelated');
      log.info('also unrelated');

      expect(spies.info).toHaveBeenCalledTimes(3);
    });
  });

  describe('transports', () => {
    it('should hand a structured record to every transport', () => {
      const sink = vi.fn();
      const dispose = addTransport(sink);

      try {
        createLogger('Canvas').warn('slow frame', 42);

        expect(sink).toHaveBeenCalledOnce();
        const record = sink.mock.calls[0][0] as LogRecord;
        expect(record.level).toBe('warn');
        expect(record.scope).toBe('Canvas');
        expect(record.args).toEqual(['slow frame', 42]);
        expect(typeof record.timestamp).toBe('number');
      } finally {
        dispose();
      }
    });

    it('should stop calling a disposed transport', () => {
      const sink = vi.fn();
      addTransport(sink)();

      createLogger('Test').error('boom');

      expect(sink).not.toHaveBeenCalled();
    });

    it('should stop calling a removed transport', () => {
      const sink = vi.fn();
      addTransport(sink);
      removeTransport(sink);

      createLogger('Test').error('boom');

      expect(sink).not.toHaveBeenCalled();
    });

    it('should not reach the level gate through a transport', () => {
      const sink = vi.fn();
      const dispose = addTransport(sink);

      try {
        setLogLevel('error');
        createLogger('Test').debug('dropped');
        expect(sink).not.toHaveBeenCalled();
      } finally {
        dispose();
      }
    });

    it('should silence the console once every transport is cleared', () => {
      clearTransports();
      try {
        createLogger('Test').error('nowhere');
        expect(spies.error).not.toHaveBeenCalled();
      } finally {
        // Put the default back: the remaining tests assert on the console.
        addTransport(consoleTransport);
      }
    });

    it('should let a transport be bound to a specific console', () => {
      const target = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      };

      createConsoleTransport(target)({
        level: 'warn',
        scope: 'Bound',
        args: ['hello'],
        timestamp: 0
      });

      expect(target.warn).toHaveBeenCalledWith('[Bound]', 'hello');
      expect(spies.warn).not.toHaveBeenCalled();
    });
  });

  describe('toSerializable', () => {
    it('should keep an Error usable after JSON.stringify', () => {
      const error = new Error('boom');
      const payload = toSerializable({ level: 'error', scope: 'Test', args: ['failed', error], timestamp: 0 });

      const roundTripped = JSON.parse(JSON.stringify(payload));

      expect(roundTripped.args[0]).toBe('failed');
      expect(roundTripped.args[1].name).toBe('Error');
      expect(roundTripped.args[1].message).toBe('boom');
      expect(roundTripped.args[1].stack).toBeTruthy();
    });

    it('should emit an ISO timestamp', () => {
      const payload = toSerializable({ level: 'info', scope: 'Test', args: [], timestamp: 0 });
      expect(payload.timestamp).toBe('1970-01-01T00:00:00.000Z');
    });
  });

  describe('exposeLogControls', () => {
    it('should put the level controls on window', () => {
      exposeLogControls();

      const controls = (window as unknown as Record<string, { setLevel: (l: string) => void; getLevel: () => string }>)
        .__log;

      expect(controls).toBeDefined();
      controls.setLevel('warn');
      expect(controls.getLevel()).toBe('warn');
      expect(getLogLevel()).toBe('warn');
    });
  });

  describe('printBanner', () => {
    it('should print the message unprefixed, with its styles', () => {
      printBanner('%c hello ', 'color:red');
      expect(spies.info).toHaveBeenCalledWith('%c hello ', 'color:red');
    });

    it('should ignore the level threshold', () => {
      setLogLevel('silent');
      printBanner('still here');
      expect(spies.info).toHaveBeenCalledWith('still here');
    });
  });
});
