import { type ConsoleLike, consoleTransport, createConsoleTransport } from './ConsoleTransport';
import { type WritableLevel, addTransport, createLogger, removeTransport } from './Logger';

/**
 * Funnel stray console.* into the pipeline so a dep's warning hits the transports,
 * not just the visitor's devtools. Won't save a console.log — that maps to debug,
 * which prod drops. Don't raise the mapping.
 *
 * Prod only. Patching console kills click-to-source.
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

// What we have to undo. Null when not installed.
interface Installation {
  originals: Pick<Console, PatchedMethod>;
  transport: ReturnType<typeof createConsoleTransport>;
  // Only put consoleTransport back if it was there to begin with.
  restoreConsoleTransport: boolean;
}

let installation: Installation | null = null;

/** Idempotent — HMR would otherwise nest wrappers. */
export const installConsoleBridge = (): void => {
  if (installation !== null) return;

  // Capture first or the transport recurses. Keep the real methods (not a bind)
  // so uninstall can put them back.
  const captured: Pick<Console, PatchedMethod> = {
    log: console.log,
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  };
  // Swap the default transport for one pinned to the originals.
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

export const uninstallConsoleBridge = (): void => {
  if (installation === null) return;

  for (const method of METHODS) {
    console[method] = installation.originals[method];
  }

  removeTransport(installation.transport);
  if (installation.restoreConsoleTransport) addTransport(consoleTransport);
  installation = null;
};
