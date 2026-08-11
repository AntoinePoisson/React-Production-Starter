import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const useBoot = vi.fn();
let pathname = '/';

vi.mock('@tanstack/react-router', () => ({
  createRootRoute: (options: unknown) => options,
  HeadContent: () => <meta data-testid='head-content' />,
  Scripts: () => <script data-testid='scripts' />,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname } })
}));

vi.mock('@/app/Boot', () => ({ useBoot }));
vi.mock('@/app/globals.css?url', () => ({ default: '/assets/globals.css' }));

// No WebGL context under jsdom. Stub the renderer and not the canvas module, so the shell's own
// lazy(() => import(...)) calls stay on the real path.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid='canvas'>{children}</div>,
  useFrame: () => {},
  useThree: () => ({
    invalidate: () => {},
    setFrameloop: () => {},
    gl: { domElement: document.createElement('canvas') }
  })
}));

vi.mock('@react-three/drei', () => ({
  PerformanceMonitor: () => null,
  OrbitControls: () => null,
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useProgress: () => ({ progress: 100, active: false }),
  useGLTF: Object.assign(() => ({ nodes: {}, materials: {} }), { preload: () => {} })
}));

const { Route } = await import('@/routes/__root');

type RootOptions = {
  head: () => { meta: Record<string, string>[]; links: Record<string, string>[] };
  shellComponent: (props: { children: React.ReactNode }) => React.ReactElement;
  notFoundComponent: unknown;
  errorComponent: unknown;
  pendingComponent: unknown;
};

const root = Route as unknown as RootOptions;

describe('Root route', () => {
  it('should link the stylesheet alongside the root head tags', () => {
    const { links, meta } = root.head();

    expect(links.some((link) => link.rel === 'stylesheet')).toBe(true);
    expect(meta[0]).toEqual({ charSet: 'utf-8' });
  });

  it('should declare a boundary for every abnormal state', () => {
    // A route with no errorComponent renders a blank page on a throw, which is impossible to
    // tell apart from a build that never booted.
    expect(root.notFoundComponent).toBeDefined();
    expect(root.errorComponent).toBeDefined();
    expect(root.pendingComponent).toBeDefined();
  });

  it.each([
    ['/', 'en-US'],
    ['/en', 'en-US'],
    ['/fr', 'fr-FR'],
    ['/nonsense', 'en-US']
  ])('should stamp %s with lang=%s', (path, expected) => {
    pathname = path;

    const Shell = root.shellComponent;

    // Markup, not jsdom — that's what the build does. <html> is document-level,
    // so the lang attribute wouldn't show up if we mounted into a container.
    expect(renderToStaticMarkup(<Shell>{null}</Shell>)).toContain(`<html lang="${expected}">`);
  });

  it('should run the client boot wiring', () => {
    pathname = '/';
    useBoot.mockClear();

    const Shell = root.shellComponent;
    render(<Shell>{null}</Shell>);

    expect(useBoot).toHaveBeenCalled();
  });

  it('should mount the canvas in the shell, above the page', async () => {
    pathname = '/';

    const Shell = root.shellComponent;
    render(<Shell>{null}</Shell>);

    // This placement is the whole reason a language switch keeps its WebGL context. / and /fr
    // are different routes, so a scene mounted inside either gets destroyed and rebuilt on every
    // switch: full three.js reparse, camera back at its starting position.
    expect(await screen.findByTestId('canvas')).toBeInTheDocument();
  });

  it('should not pre-render the canvas', () => {
    pathname = '/';

    // three.js needs a WebGL context and the prerender runs in Node. The overlay does have to be
    // in that HTML, which is why only one of the two is wrapped in <ClientOnly>.
    const Shell = root.shellComponent;

    expect(renderToStaticMarkup(<Shell>{null}</Shell>)).not.toContain('data-testid="canvas"');
  });

  it('should leave the dedicated static 404 free of the WebGL scene', () => {
    pathname = '/404';
    const Shell = root.shellComponent;

    expect(renderToStaticMarkup(<Shell>{null}</Shell>)).not.toContain('data-testid="canvas"');
  });
});
