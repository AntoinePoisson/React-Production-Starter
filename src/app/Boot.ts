import { useEffect } from 'react';

import { isProduction } from '@/utils/config/Env';
import { SITE_TITLE } from '@/utils/config/Identity';
import { installConsoleBridge } from '@/utils/logger/ConsoleBridge';
import { printBanner } from '@/utils/logger/ConsoleTransport';
import { exposeLogControls } from '@/utils/logger/Logger';
import { useFirstVisit } from '@/utils/store/useFirstVisit';
import { startVitalsReporting } from '@/utils/vitals/WebVitals';

// One-time client wiring. An effect, so it never runs during the prerender.
export function useBoot(): void {
  useFirstVisit();

  useEffect(() => {
    exposeLogControls();
    void startVitalsReporting();

    if (!isProduction()) return;

    // Keep this above installConsoleBridge. It's a raw console.info, and a patched console turns
    // it into log.info, which production filters out.
    printBanner(
      `%c ${SITE_TITLE} %c v${__APP_VERSION__} `,
      'background:#0f172a;color:#6b8cfa;padding:4px 8px;border-radius:4px 0 0 4px;font-weight:600',
      'background:#6b8cfa;color:#0f172a;padding:4px 8px;border-radius:0 4px 4px 0'
    );

    // Prod only, patching the console breaks devtools click-to-source.
    installConsoleBridge();
  }, []);
}
