import { isDevelopment } from '@/utils/config/Env';

import { consoleTransport } from './ConsoleTransport';

// Logger → level gate → transports. A real service is one addTransport() in Boot.ts.
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** `silent` is a threshold, not a severity. */
export type WritableLevel = Exclude<LogLevel, 'silent'>;

const SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100
};

export const isLogLevel = (value: unknown): value is LogLevel =>
  typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);

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
 * For a real endpoint: toSerializable, batch, flush on pagehide (not beforeunload —
 * Safari mobile is flaky and it kills bfcache). Widen connect-src if it's cross-origin.
 */
export const addTransport = (transport: LogTransport): (() => void) => {
  transports.add(transport);
  return () => {
    transports.delete(transport);
  };
};

export const removeTransport = (transport: LogTransport): boolean => transports.delete(transport);

export const clearTransports = (): void => {
  transports.clear();
};

/** JSON.stringify turns an Error into {}, so flatten first. */
export const toSerializable = (record: LogRecord): Record<string, unknown> => ({
  level: record.level,
  scope: record.scope,
  timestamp: new Date(record.timestamp).toISOString(),
  args: record.args.map((arg) =>
    arg instanceof Error ? { name: arg.name, message: arg.message, stack: arg.stack } : arg
  )
});

// || not ??. CI passes ${{ vars.X }} as '' when unset, and '' ?? 'app' is still ''.
const STORAGE_KEY = `${import.meta.env.VITE_MAIN_WEBSITE_NAME || 'app'}_${import.meta.env.VITE_PROJECT_NAME || 'react-app-fondation'}_logLevel`;

// ?log=debug wins and is persisted, so it applies from the first frame.
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
    // private mode / storage off
  }

  return fallback;
};

let currentLevel: LogLevel = resolveInitialLevel();

export const getLogLevel = (): LogLevel => currentLevel;

export const setLogLevel = (level: LogLevel): void => {
  currentLevel = level;

  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch {
    // oh well
  }
};

/** window.__log. Call this or the helpers get tree-shaken out of the prod bundle. */
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

  /** Once for this key. Chain a level. */
  once: (key: string) => Logger;

  /** At most once per `ms`. Fine inside useFrame. */
  every: (ms: number, key: string) => Logger;

  /** Nested scope: createLogger('scene').child('water'). */
  child: (scope: string) => Logger;
}

const emit = (level: WritableLevel, scope: string, args: unknown[]): void => {
  const record: LogRecord = { level, scope, args, timestamp: Date.now() };
  for (const transport of transports) transport(record);
};

export const createLogger = (scope: string): Logger => {
  const seenOnce = new Set<string>();
  const lastEmitAt = new Map<string, number>();

  // Rate-limit slot for the next write. Don't leave a dangling once()/every() —
  // it stays armed and gates whatever logs next.
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
    // Level first so a filtered record doesn't burn a once() key.
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

export const logger = createLogger('app');
