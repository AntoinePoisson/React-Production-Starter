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

// three.js has no WebGL context under jsdom. Stubbing the renderer rather than the canvas module
// keeps the shell's own `lazy(() => import(…))` calls on the real path.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid='canvas'>{children}</div>,
  useFrame: () => {},
  useThree: () => ({})
}));

vi.mock('@react-three/drei', () => ({
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

/**
 * The document shell. There is no `index.html`: this component renders `<html>` itself, which is
 * what lets `<html lang>` differ per locale without the two duplicated root layouts Next needed.
 */
describe('Root route', () => {
  it('should link the stylesheet alongside the root head tags', () => {
    const { links, meta } = root.head();

    expect(links.some((link) => link.rel === 'stylesheet')).toBe(true);
    expect(meta[0]).toEqual({ charSet: 'utf-8' });
  });

  it('should declare a boundary for every abnormal state', () => {
    // A route with no `errorComponent` renders a blank page on a thrown error, which is
    // indistinguishable from a build that never booted.
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

    // Rendered to markup rather than into jsdom, because that is what the build actually does:
    // `<html>` is a document-level element React treats specially when mounting into a
    // container, and the attribute under test would never appear there.
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

    // This placement is the whole reason a language switch keeps its WebGL context: `/` and
    // `/fr` are different routes, so a scene mounted inside either one is destroyed and rebuilt
    // on every switch — a full three.js re-parse, and the camera back at its starting position.
    expect(await screen.findByTestId('canvas')).toBeInTheDocument();
  });

  it('should not pre-render the canvas', () => {
    pathname = '/';

    // three.js needs a WebGL context and the pre-render runs in Node. The overlay, by contrast,
    // must be in that HTML — which is why only one of the two is wrapped in `<ClientOnly>`.
    const Shell = root.shellComponent;

    expect(renderToStaticMarkup(<Shell>{null}</Shell>)).not.toContain('data-testid="canvas"');
  });
});
