import { describe, expect, it, vi } from 'vitest';

const createRouter = vi.fn((options: Record<string, unknown>) => ({ options }));

vi.mock('@tanstack/react-router', () => ({ createRouter }));
// Generated from the `src/routes/` file tree by the TanStack plugin, and git-ignored — a unit
// test must not depend on a build artefact being present.
vi.mock('@/routeTree.gen', () => ({ routeTree: { id: '__root__' } }));

const { getRouter } = await import('@/router');

describe('getRouter', () => {
  it('should build a router from the generated route tree', () => {
    const router = getRouter();

    expect(createRouter).toHaveBeenCalledOnce();
    expect(router.options.routeTree).toEqual({ id: '__root__' });
  });

  it('should restore scroll position across navigations', () => {
    createRouter.mockClear();
    getRouter();

    // A full-screen canvas app has no scroll of its own, but the 404 and error pages do — and a
    // back navigation that lands mid-page reads as a broken back button.
    expect(createRouter.mock.calls[0][0].scrollRestoration).toBe(true);
  });

  it('should preload on intent', () => {
    createRouter.mockClear();
    getRouter();

    expect(createRouter.mock.calls[0][0].defaultPreload).toBe('intent');
  });

  it('should return a fresh instance per call', () => {
    // The pre-render pass renders every page in one Node process; a shared router would carry
    // one page's location into the next.
    expect(getRouter()).not.toBe(getRouter());
  });
});
