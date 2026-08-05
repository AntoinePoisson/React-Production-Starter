import { type Page, test as base } from '@playwright/test';

import { type WebVitalsMetrics, collectWebVitals, setupWebVitals } from '../utils/webVitals';

type WebVitalsPage = Page & {
  getWebVitals: () => Promise<WebVitalsMetrics>;
};

export const test = base.extend<{ pageWithVitals: WebVitalsPage }>({
  pageWithVitals: async ({ page }, use) => {
    // Must run before any navigation.
    await setupWebVitals(page);

    const pageWithVitals = page as WebVitalsPage;
    pageWithVitals.getWebVitals = async () => {
      return await collectWebVitals(page);
    };

    await use(pageWithVitals); // eslint-disable-line react-hooks/rules-of-hooks
  }
});

export { expect } from '@playwright/test';
