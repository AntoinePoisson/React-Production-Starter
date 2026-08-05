import { type ConsoleLike, consoleTransport, createConsoleTransport } from './ConsoleTransport';
import { type WritableLevel, addTransport, createLogger, removeTransport } from './Logger';

/**
 * Routes stray `console.*` into the logging pipeline, so a dependency's warning (three.js, a
 * loader) reaches the transports instead of only a visitor's devtools. It does not rescue a
 * stray `console.log`: `removeConsole` strips those from the app bundle, and `log`/`debug` map
 * to `debug`, which the production threshold discards. Do not raise the mapping.
 *
 * Production only (see `app/Providers.tsx`): patching the console attributes every line to this
 * file in devtools instead of its call site.
 */

const LEVEL_BY_METHOD = {
  log: 'debug',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error'
} as const satisfies Record<string, WritableLevel>;

type PatchedMethod = keyof typeof LEVEL_BY_METHOD;

const METHODS = Object.keys(LEVEL_BY_METHOD) as PatchedMethod[];

const log = createLogger('console');

// Everything the bridge has to undo, or `null` when it is not installed.
interface Installation {
  originals: Pick<Console, PatchedMethod>;
  transport: ReturnType<typeof createConsoleTransport>;
  // Restore `consoleTransport` only if it was registered: an app may have removed it on purpose
  // so a real service is the only sink.
  restoreConsoleTransport: boolean;
}

let installation: Installation | null = null;

/** Patch `console` so its output flows through the pipeline. Idempotent, so HMR cannot nest wrappers. */
export const installConsoleBridge = (): void => {
  if (installation !== null) return;

  // Capture before patching: the transport must call the originals or it recurses. Stored by
  // reference and invoked with `.call(console, …)` rather than pre-bound, so uninstall restores
  // the real method instead of a `bind` wrapper.
  const captured: Pick<Console, PatchedMethod> = {
    log: console.log,
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  };
  // Swap the call-time console transport for one pinned to those originals.
  const restoreConsoleTransport = removeTransport(consoleTransport);
  const transport = createConsoleTransport({
    debug: (...args) => captured.debug.call(console, ...args),
    info: (...args) => captured.info.call(console, ...args),
    warn: (...args) => captured.warn.call(console, ...args),
    error: (...args) => captured.error.call(console, ...args)
  } satisfies ConsoleLike);
  addTransport(transport);

  installation = { originals: captured, transport, restoreConsoleTransport };

  for (const method of METHODS) {
    console[method] = (...args: unknown[]) => {
      log[LEVEL_BY_METHOD[method]](...args);
    };
  }
};

/** Restore the untouched console. */
export const uninstallConsoleBridge = (): void => {
  if (installation === null) return;

  for (const method of METHODS) {
    console[method] = installation.originals[method];
  }

  removeTransport(installation.transport);
  if (installation.restoreConsoleTransport) addTransport(consoleTransport);
  installation = null;
};
