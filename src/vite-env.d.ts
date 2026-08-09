/// <reference types="vite/client" />

// Only VITE_-prefixed variables reach the client bundle, and Vite inlines them at build time, so
// setting one on the host afterwards changes nothing. All optional: the app has to behave with
// none of them set.
interface ImportMetaEnv {
  /** Required in CI, or every page ships a localhost canonical. */
  readonly VITE_SITE_URL?: string;
  /** Namespaces client storage keys. */
  readonly VITE_PROJECT_NAME?: string;
  readonly VITE_MAIN_WEBSITE_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by `define` in vite.config.ts, read out of package.json. */
declare const __APP_VERSION__: string;
