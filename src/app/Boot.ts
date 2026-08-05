import { useEffect } from 'react';

import { isProduction } from '@/utils/config/Env';
import { SITE_TITLE } from '@/utils/config/Identity';
import { installConsoleBridge } from '@/utils/logger/ConsoleBridge';
import { printBanner } from '@/utils/logger/ConsoleTransport';
import { exposeLogControls } from '@/utils/logger/Logger';
import { useFirstVisit } from '@/utils/store/useFirstVisit';
import { startVitalsReporting } from '@/utils/vitals/WebVitals';

/** One-time client wiring, run from the root route. An effect never runs during the pre-render. */
export function useBoot(): void {
  useFirstVisit();

  useEffect(() => {
    // Makes `window.__log.setLevel('debug')` work on a deployed page.
    exposeLogControls();

    // Reports into the logger only; costs nothing until a transport is added here.
    void startVitalsReporting();

    if (!isProduction()) return;

    // Before installConsoleBridge: printBanner is a raw `console.info`, and once the console is
    // patched it becomes `log.info` — which the production threshold drops.
    printBanner(
      `%c ${SITE_TITLE} %c v${__APP_VERSION__} `,
      'background:#0f172a;color:#6b8cfa;padding:4px 8px;border-radius:4px 0 0 4px;font-weight:600',
      'background:#6b8cfa;color:#0f172a;padding:4px 8px;border-radius:0 4px 4px 0'
    );

    // Production only: patching the console costs devtools' click-to-source.
    installConsoleBridge();
  }, []);
}
