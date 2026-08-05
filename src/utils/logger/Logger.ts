import { isDevelopment } from '@/utils/config/Env';

import { consoleTransport } from './ConsoleTransport';

/**
 * Logging pipeline: scoped loggers write records, the level gate filters them, survivors go to
 * every registered transport. Shipping logs to a real service is one `addTransport` call at boot.
 */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Every level a record can actually carry. `silent` is a threshold, not a severity. */
export type WritableLevel = Exclude<LogLevel, 'silent'>;

/** Ordered severities; `silent` sits above everything. */
const SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100
};

export const isLogLevel = (value: unknown): value is LogLevel =>
  typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);

/** What a transport receives. Structured rather than pre-formatted: formatting is a transport's job. */
export interface LogRecord {
  level: WritableLevel;
  scope: string;
  args: unknown[];
  timestamp: number;
}

export type LogTransport = (record: LogRecord) => void;

const transports = new Set<LogTransport>([consoleTransport]);

/**
 * Register a sink. Returns a disposer.
 *
 * For a real endpoint: serialise with `toSerializable`, batch the records and flush on
 * `pagehide`/`visibilitychange` (not `beforeunload`, unreliable on mobile Safari and blocks the
 * bfcache), and widen `connect-src` in `app/ContentSecurityPolicy.tsx` if it is cross-origin.
 */
export const addTransport = (transport: LogTransport): (() => void) => {
  transports.add(transport);
  return () => {
    transports.delete(transport);
  };
};

/** Unregister a sink. The return value lets a caller put back only what it took away. */
export const removeTransport = (transport: LogTransport): boolean => transports.delete(transport);

/** Drop every transport, console included. */
export const clearTransports = (): void => {
  transports.clear();
};

/** Flatten a record for `JSON.stringify`, which turns an `Error` into `{}` and loses the stack. */
export const toSerializable = (record: LogRecord): Record<string, unknown> => ({
  level: record.level,
  scope: record.scope,
  timestamp: new Date(record.timestamp).toISOString(),
  args: record.args.map((arg) =>
    arg instanceof Error ? { name: arg.name, message: arg.message, stack: arg.stack } : arg
  )
});

// `||`, not `??`: CI passes these as `${{ vars.X }}`, which is the empty string when the
// repository variable is unset, and the key would collapse to one shared by the whole origin.
const STORAGE_KEY = `${import.meta.env.VITE_MAIN_WEBSITE_NAME || 'app'}_${import.meta.env.VITE_PROJECT_NAME || 'react-app-fondation'}_logLevel`;

// `?log=debug` wins and is persisted, so the level applies from the first frame. That is the
// only way to trace a startup bug on a deployed page.
const resolveInitialLevel = (): LogLevel => {
  const fallback: LogLevel = isDevelopment() ? 'debug' : 'warn';
  if (typeof window === 'undefined') return fallback;

  try {
    const fromQuery = new URLSearchParams(window.location.search).get('log');
    if (isLogLevel(fromQuery)) {
      localStorage.setItem(STORAGE_KEY, fromQuery);
      return fromQuery;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLogLevel(stored)) return stored;
  } catch {
    // Private browsing, or storage disabled.
  }

  return fallback;
};

let currentLevel: LogLevel = resolveInitialLevel();

export const getLogLevel = (): LogLevel => currentLevel;

/** Change the threshold. Persisted, so it survives a reload. */
export const setLogLevel = (level: LogLevel): void => {
  currentLevel = level;

  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch {
    // Not persisting is not worth failing over.
  }
};

/**
 * Expose the level controls on `window.__log`. Without this call nothing references them and
 * they are tree-shaken out of the production bundle. Called from `app/Providers.tsx`.
 */
export const exposeLogControls = (): void => {
  if (typeof window === 'undefined') return;

  (window as unknown as Record<string, unknown>).__log = {
    setLevel: setLogLevel,
    getLevel: getLogLevel,
    levels: LOG_LEVELS
  };
};

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;

  /** Emit at most one record for `key`, ever. Chain a level onto it. */
  once: (key: string) => Logger;

  /** Emit at most one record for `key` per `ms`. Safe to call every frame. */
  every: (ms: number, key: string) => Logger;

  /** Derive a logger with a nested scope: `createLogger('scene').child('water')`. */
  child: (scope: string) => Logger;
}

const emit = (level: WritableLevel, scope: string, args: unknown[]): void => {
  const record: LogRecord = { level, scope, args, timestamp: Date.now() };
  for (const transport of transports) transport(record);
};

/** Create a scoped logger. The scope is normally the component or module name. */
export const createLogger = (scope: string): Logger => {
  const seenOnce = new Set<string>();
  const lastEmitAt = new Map<string, number>();

  // Pending rate-limit, consumed by the next write. One mutable slot rather than an object per
  // call, so `log.every(16, 'fps')` allocates nothing in `useFrame`. A dangling `once()`/`every()`
  // with no level call after it stays armed and gates whatever is logged next: write both as one
  // expression.
  let gateMode: 'once' | 'every' | null = null;
  let gateKey = '';
  let gateMs = 0;

  const passesGate = (): boolean => {
    if (gateMode === null) return true;

    const mode = gateMode;
    const key = gateKey;
    const ms = gateMs;
    gateMode = null; // consumed either way

    if (mode === 'once') {
      if (seenOnce.has(key)) return false;
      seenOnce.add(key);
      return true;
    }

    const now = Date.now();
    const last = lastEmitAt.get(key);
    if (last !== undefined && now - last < ms) return false;
    lastEmitAt.set(key, now);
    return true;
  };

  const write = (level: WritableLevel, args: unknown[]): void => {
    // Level first, so a filtered record does not burn a `once` key.
    if (SEVERITY[level] < SEVERITY[currentLevel]) {
      gateMode = null;
      return;
    }
    if (!passesGate()) return;

    emit(level, scope, args);
  };

  const logger: Logger = {
    debug: (...args) => write('debug', args),
    info: (...args) => write('info', args),
    warn: (...args) => write('warn', args),
    error: (...args) => write('error', args),

    once: (key) => {
      gateMode = 'once';
      gateKey = key;
      return logger;
    },

    every: (ms, key) => {
      gateMode = 'every';
      gateKey = key;
      gateMs = ms;
      return logger;
    },

    child: (childScope) => createLogger(`${scope}:${childScope}`)
  };

  return logger;
};

/** Fallback logger for code with no scope of its own. */
export const logger = createLogger('app');
