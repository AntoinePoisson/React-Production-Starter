import type { LogRecord, WritableLevel } from './Logger';

// Only this file and ConsoleBridge.ts get to name `console`, see the eslint override.

export type ConsoleLike = Record<WritableLevel, (...args: unknown[]) => void>;

export const createConsoleTransport =
  (target: ConsoleLike) =>
  (record: LogRecord): void => {
    target[record.level](`[${record.scope}]`, ...record.args);
  };

/**
 * Default transport. Resolves console[level] at call time instead of capturing it, so an SDK that
 * wraps the console later still sees everything. The bridge can't keep that and replaces it.
 */
export const consoleTransport = (record: LogRecord): void => {
  console[record.level](`[${record.scope}]`, ...record.args);
};

/** Outside the pipeline on purpose: no gate, no scope, and %c needs the format string first. */
export const printBanner = (message: string, ...styles: string[]): void => {
  console.info(message, ...styles);
};
