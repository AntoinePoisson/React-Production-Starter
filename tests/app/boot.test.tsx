import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const exposeLogControls = vi.fn();
const printBanner = vi.fn();
const installConsoleBridge = vi.fn();
const startVitalsReporting = vi.fn(() => Promise.resolve());
const useFirstVisit = vi.fn();

vi.mock('@/utils/logger/Logger', () => ({ exposeLogControls }));
vi.mock('@/utils/logger/ConsoleTransport', () => ({ printBanner }));
vi.mock('@/utils/logger/ConsoleBridge', () => ({ installConsoleBridge }));
vi.mock('@/utils/vitals/WebVitals', () => ({ startVitalsReporting }));
vi.mock('@/utils/store/useFirstVisit', () => ({ useFirstVisit }));

const { useBoot } = await import('@/app/Boot');

const Harness = () => {
  useBoot();
  return null;
};

describe('useBoot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should resolve the first-visit flag', () => {
    render(<Harness />);

    expect(useFirstVisit).toHaveBeenCalled();
  });

  it('should expose the log controls and start reporting vitals', () => {
    render(<Harness />);

    // Without exposeLogControls, ?log=debug and window.__log get tree-shaken out of the
    // production bundle and neither works on a deployed page.
    expect(exposeLogControls).toHaveBeenCalled();
    expect(startVitalsReporting).toHaveBeenCalled();
  });

  it('should not patch the console in development', () => {
    vi.stubEnv('MODE', 'development');

    render(<Harness />);

    // Patching it attributes every line to ConsoleBridge.ts instead of the file it was written
    // in, which costs devtools click-to-source.
    expect(installConsoleBridge).not.toHaveBeenCalled();
    expect(printBanner).not.toHaveBeenCalled();
  });

  it('should print the banner before installing the bridge in production', () => {
    vi.stubEnv('MODE', 'production');

    render(<Harness />);

    expect(printBanner).toHaveBeenCalled();
    expect(installConsoleBridge).toHaveBeenCalled();

    // The ordering matters. printBanner is a raw console.info kept outside the pipeline, and a
    // patched console turns it into log.info, which the production threshold of `warn` drops.
    expect(printBanner.mock.invocationCallOrder[0]).toBeLessThan(installConsoleBridge.mock.invocationCallOrder[0]);
  });

  it('should stamp the banner with the build version', () => {
    vi.stubEnv('MODE', 'production');

    render(<Harness />);

    expect(printBanner.mock.calls[0][0]).toContain(__APP_VERSION__);
  });
});
