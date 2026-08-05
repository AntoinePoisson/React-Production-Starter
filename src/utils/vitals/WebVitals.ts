import { createLogger } from '@/utils/logger/Logger';

/**
 * Core Web Vitals from real devices, reported through the logging pipeline. Dynamically
 * imported to stay off the critical path, and the plain `web-vitals` build rather than
 * `attribution` (~4× the size). Records go to the logger; sending them is a transport decision.
 */

const log = createLogger('vitals');

/** Google's thresholds. */
const THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  INP: { good: 200, needsImprovement: 500 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 }
} as const;

export type VitalName = keyof typeof THRESHOLDS;
export type VitalRating = 'good' | 'needs-improvement' | 'poor';

export const rateVital = (name: VitalName, value: number): VitalRating => {
  const { good, needsImprovement } = THRESHOLDS[name];
  if (value <= good) return 'good';
  if (value <= needsImprovement) return 'needs-improvement';
  return 'poor';
};

export interface VitalReport {
  name: VitalName;
  value: number;
  rating: VitalRating;
}

/** `poor` logs at `warn` so it clears the production threshold; good ones stay at `info`. */
export const reportVital = ({ name, value, rating }: VitalReport): void => {
  // Sub-millisecond precision is noise for a field metric.
  const rounded = name === 'CLS' ? Number(value.toFixed(4)) : Math.round(value);
  const payload = { name, value: rounded, rating };

  if (rating === 'poor') log.warn(name, payload);
  else log.info(name, payload);
};

let started = false;

/** Subscribe to every Core Web Vital. Idempotent; resolves on library load, not on metrics. */
export const startVitalsReporting = async (): Promise<void> => {
  if (started || typeof window === 'undefined') return;
  started = true;

  // Separated from the subscriptions so the catch below can tell the two apart.
  let library: typeof import('web-vitals');

  try {
    library = await import('web-vitals');
  } catch (error) {
    // Nothing was subscribed, so re-arming the guard is safe and lets a caller retry.
    started = false;
    log.once('vitals-load-failed').warn('Web Vitals reporting unavailable', error);

    return;
  }

  try {
    const { onCLS, onFCP, onINP, onLCP, onTTFB } = library;

    const handle =
      (name: VitalName) =>
      ({ value }: { value: number }): void =>
        reportVital({ name, value, rating: rateVital(name, value) });

    onLCP(handle('LCP'));
    onCLS(handle('CLS'));
    onINP(handle('INP'));
    onFCP(handle('FCP'));
    onTTFB(handle('TTFB'));
  } catch (error) {
    // `started` stays true: one of these can throw after the earlier ones registered (e.g.
    // `onINP` with no `event` entry type), and a retry would then double-subscribe the rest.
    log.once('vitals-subscribe-failed').warn('Some Web Vitals could not be subscribed', error);
  }
};

/** Test seam: lets a suite re-run the subscription. */
export const resetVitalsReporting = (): void => {
  started = false;
};
