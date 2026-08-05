/// <reference types="vite/client" />

/**
 * Only `VITE_`-prefixed variables reach the client bundle — Vite inlines them at build time, so
 * a value set at runtime on the host changes nothing. Every one is optional on purpose: the app
 * has to behave sanely with none of them set, and `SiteRules.ts` is where that is decided.
 */
interface ImportMetaEnv {
  /** Base URL — canonical, og:url, robots.txt, sitemap.xml. Required in CI. */
  readonly VITE_SITE_URL?: string;
  /** Namespaces client storage keys. */
  readonly VITE_PROJECT_NAME?: string;
  readonly VITE_MAIN_WEBSITE_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by `define` in vite.config.ts, read from package.json. */
declare const __APP_VERSION__: string;
