/// <reference types="vite/client" />

// Only VITE_-prefixed variables reach the client bundle, and Vite inlines them at build time, so
// setting one on the host afterwards changes nothing. Local development has safe defaults;
// VITE_SITE_URL is mandatory in CI builds.
interface ImportMetaEnv {
  /** Canonical URL and deployment base path. Required in CI. */
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
