import { useEffect } from 'react';

import { isProduction } from '@/utils/config/Env';
import { SITE_TITLE } from '@/utils/config/Identity';
import { installConsoleBridge } from '@/utils/logger/ConsoleBridge';
import { printBanner } from '@/utils/logger/ConsoleTransport';
import { exposeLogControls } from '@/utils/logger/Logger';
import { useFirstVisit } from '@/utils/store/useFirstVisit';
import { startVitalsReporting } from '@/utils/vitals/WebVitals';

// Client-only setup. Effect so it never runs during prerender.
export function useBoot(): void {
  useFirstVisit();

  useEffect(() => {
    exposeLogControls();
    void startVitalsReporting();

    if (!isProduction()) return;

    // Before the console bridge — that's a raw console.info. After the patch
    // it becomes log.info and prod drops it.
    printBanner(
      `%c ${SITE_TITLE} %c v${__APP_VERSION__} `,
      'background:#0f172a;color:#6b8cfa;padding:4px 8px;border-radius:4px 0 0 4px;font-weight:600',
      'background:#6b8cfa;color:#0f172a;padding:4px 8px;border-radius:0 4px 4px 0'
    );

    // Prod only. Patching console kills click-to-source in devtools.
    installConsoleBridge();
  }, []);
}
