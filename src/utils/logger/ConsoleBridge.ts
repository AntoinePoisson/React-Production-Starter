import { type ConsoleLike, consoleTransport, createConsoleTransport } from './ConsoleTransport';
import { type WritableLevel, addTransport, createLogger, removeTransport } from './Logger';

/**
 * Routes stray console.* into the pipeline, so a dependency's warning reaches the transports and
 * not only a visitor's devtools. It won't rescue a console.log: log/debug map to `debug`, which
 * production drops. Don't raise the mapping.
 *
 * Production only, patching the console costs devtools click-to-source.
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

// Everything the bridge has to undo, or null when it isn't installed.
interface Installation {
  originals: Pick<Console, PatchedMethod>;
  transport: ReturnType<typeof createConsoleTransport>;
  // Only put consoleTransport back if it was registered in the first place.
  restoreConsoleTransport: boolean;
}

let installation: Installation | null = null;

/** Idempotent, otherwise HMR nests wrappers. */
export const installConsoleBridge = (): void => {
  if (installation !== null) return;

  // Capture before patching or the transport recurses. By reference and called with
  // .call(console, ...), so uninstall puts back the real method and not a bind wrapper.
  const captured: Pick<Console, PatchedMethod> = {
    log: console.log,
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  };
  // Swap the call-time transport for one pinned to those originals.
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
