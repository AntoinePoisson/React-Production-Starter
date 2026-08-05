import type { LogRecord, WritableLevel } from './Logger';

// Only this file and `ConsoleBridge.ts` may name `console`; see the override in eslint.config.mjs.

/** The console surface a transport needs. `Console` itself is far wider. */
export type ConsoleLike = Record<WritableLevel, (...args: unknown[]) => void>;

/** Transport bound to a console object; `ConsoleBridge` passes pre-patch originals to avoid recursion. */
export const createConsoleTransport =
  (target: ConsoleLike) =>
  (record: LogRecord): void => {
    target[record.level](`[${record.scope}]`, ...record.args);
  };

/**
 * The default transport. Resolves `console[level]` at call time rather than capturing it, so an
 * SDK that wraps the console later still sees everything. The bridge cannot keep that property
 * and replaces this transport.
 */
export const consoleTransport = (record: LogRecord): void => {
  console[record.level](`[${record.scope}]`, ...record.args);
};

/** Styled console signature. Outside the pipeline: no gate, no scope, and `%c` needs the format string first. */
export const printBanner = (message: string, ...styles: string[]): void => {
  console.info(message, ...styles);
};
