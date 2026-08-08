/// <reference types="vite/client" />

// Only VITE_* reach the client, and they're inlined at build time.
// Setting one on the host afterwards does nothing. VITE_SITE_URL is required in CI.
interface ImportMetaEnv {
  /** Canonical URL + deploy base. Required in CI. */
  readonly VITE_SITE_URL?: string;
  /** Prefix for client storage keys. */
  readonly VITE_PROJECT_NAME?: string;
  readonly VITE_MAIN_WEBSITE_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** From package.json, injected in vite.config.ts. */
declare const __APP_VERSION__: string;
