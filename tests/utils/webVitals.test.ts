import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = vi.hoisted(() => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn()
}));

vi.mock('web-vitals', () => handlers);

// Make the dynamic import itself fail. `vi.doMock` rather than a flag: a mocked module is cached
// after its first import and `vi.resetModules()` does not re-run the factory.
const blockTheChunk = () =>
  vi.doMock('web-vitals', () => {
    throw new Error('chunk blocked');
  });

const restoreTheChunk = () => vi.doMock('web-vitals', () => handlers);

import { addTransport, setLogLevel } from '@/utils/logger/Logger';
import { rateVital, reportVital, resetVitalsReporting, startVitalsReporting } from '@/utils/vitals/WebVitals';

describe('rateVital', () => {
  it.each([
    ['LCP', 2000, 'good'],
    ['LCP', 3000, 'needs-improvement'],
    ['LCP', 5000, 'poor'],
    ['CLS', 0.05, 'good'],
    ['CLS', 0.2, 'needs-improvement'],
    ['CLS', 0.4, 'poor'],
    ['INP', 150, 'good'],
    ['INP', 600, 'poor'],
    ['FCP', 1000, 'good'],
    ['TTFB', 2000, 'poor']
  ] as const)('should rate %s at %s as %s', (name, value, expected) => {
    expect(rateVital(name, value)).toBe(expected);
  });

  it('should treat a boundary value as the better rating', () => {
    // Google's thresholds are inclusive: exactly 2500ms LCP is still "good".
    expect(rateVital('LCP', 2500)).toBe('good');
    expect(rateVital('LCP', 2501)).toBe('needs-improvement');
  });
});

describe('reportVital', () => {
  const sink = vi.fn();
  let dispose: () => void;

  beforeEach(() => {
    sink.mockClear();
    setLogLevel('debug');
    dispose = addTransport(sink);
  });

  afterEach(() => {
    dispose();
    setLogLevel('debug');
  });

  const lastRecord = () => sink.mock.calls.at(-1)?.[0];

  it('should report under the vitals scope', () => {
    reportVital({ name: 'LCP', value: 1234, rating: 'good' });
    expect(lastRecord().scope).toBe('vitals');
  });

  it('should raise a poor metric to warn so it clears the production threshold', () => {
    // Production logs at `warn`; a metric arriving at `info` needs debug turned on first.
    reportVital({ name: 'LCP', value: 6000, rating: 'poor' });
    expect(lastRecord().level).toBe('warn');
  });

  it('should keep a healthy metric at info, where production drops it', () => {
    reportVital({ name: 'LCP', value: 900, rating: 'good' });
    expect(lastRecord().level).toBe('info');

    setLogLevel('warn');
    sink.mockClear();
    reportVital({ name: 'LCP', value: 900, rating: 'good' });
    expect(sink).not.toHaveBeenCalled();
  });

  it('should round timing metrics to the millisecond', () => {
    reportVital({ name: 'LCP', value: 1234.5678, rating: 'good' });
    expect(lastRecord().args[1]).toMatchObject({ value: 1235 });
  });

  it('should keep CLS precise, since it is a unitless score', () => {
    reportVital({ name: 'CLS', value: 0.123456, rating: 'good' });
    expect(lastRecord().args[1]).toMatchObject({ value: 0.1235 });
  });

  it('should carry the name and the rating alongside the value', () => {
    reportVital({ name: 'INP', value: 300, rating: 'needs-improvement' });
    expect(lastRecord().args[1]).toEqual({ name: 'INP', value: 300, rating: 'needs-improvement' });
  });
});

describe('startVitalsReporting', () => {
  beforeEach(() => {
    resetVitalsReporting();
    for (const handler of Object.values(handlers)) handler.mockClear();
  });

  afterEach(() => {
    resetVitalsReporting();
    restoreTheChunk();
  });

  it('should subscribe to every Core Web Vital', async () => {
    await startVitalsReporting();

    for (const [name, handler] of Object.entries(handlers)) {
      expect(handler, `${name} was never subscribed`).toHaveBeenCalledOnce();
    }
  });

  it('should be idempotent', async () => {
    await startVitalsReporting();
    await startVitalsReporting();

    expect(handlers.onLCP).toHaveBeenCalledOnce();
  });

  it('should rate and report whatever the library hands back', async () => {
    const sink = vi.fn();
    const dispose = addTransport(sink);
    setLogLevel('debug');

    try {
      await startVitalsReporting();
      const callback = handlers.onLCP.mock.calls[0][0] as (metric: { value: number }) => void;
      callback({ value: 9000 });

      const record = sink.mock.calls.at(-1)?.[0];
      expect(record.level).toBe('warn');
      expect(record.args[1]).toMatchObject({ name: 'LCP', rating: 'poor' });
    } finally {
      dispose();
    }
  });

  it('should survive the library failing to load', async () => {
    blockTheChunk();

    // Measurement is optional; a blocked chunk must never propagate.
    await expect(startVitalsReporting()).resolves.toBeUndefined();
    expect(handlers.onLCP).not.toHaveBeenCalled();
  });

  it('should allow a retry once the library loads again', async () => {
    blockTheChunk();
    await startVitalsReporting();

    // Nothing was subscribed, so re-arming the guard is safe.
    restoreTheChunk();
    await startVitalsReporting();
    expect(handlers.onLCP).toHaveBeenCalledOnce();
  });

  it('should survive one subscription throwing, without re-subscribing the others', async () => {
    handlers.onINP.mockImplementationOnce(() => {
      throw new Error('unsupported entry type');
    });

    await expect(startVitalsReporting()).resolves.toBeUndefined();
    expect(handlers.onLCP).toHaveBeenCalledOnce();

    // The guard stays armed: LCP and CLS registered before INP threw, so a second pass double-reports.
    await startVitalsReporting();
    expect(handlers.onLCP).toHaveBeenCalledOnce();
  });
});
