import type { LogRecord, WritableLevel } from './Logger';

// Only this file and ConsoleBridge.ts get to say `console`.

export type ConsoleLike = Record<WritableLevel, (...args: unknown[]) => void>;

export const createConsoleTransport =
  (target: ConsoleLike) =>
  (record: LogRecord): void => {
    target[record.level](`[${record.scope}]`, ...record.args);
  };

/**
 * Default transport. Looks up console[level] at call time so an SDK that wraps
 * console later still sees us. The bridge can't do that and replaces this.
 */
export const consoleTransport = (record: LogRecord): void => {
  console[record.level](`[${record.scope}]`, ...record.args);
};

/** Outside the pipeline: no gate, no scope. %c needs the format string first. */
export const printBanner = (message: string, ...styles: string[]): void => {
  console.info(message, ...styles);
};
