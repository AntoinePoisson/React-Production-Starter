// The real failure needs a GLB fetch inside a real canvas, so these verify the contract instead.

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SceneErrorBoundary from '@/components/three/SceneErrorBoundary';

const { errorSpy } = vi.hoisted(() => ({ errorSpy: vi.fn() }));

vi.mock('@/utils/logger/Logger', () => ({
  createLogger: () => ({
    once: () => ({ error: errorSpy }),
    error: errorSpy
  })
}));

function Boom(): React.ReactNode {
  throw new Error('GLB 404');
}

describe('SceneErrorBoundary', () => {
  // React logs every caught error to console.error on its way through a boundary.
  const silenceReact = () => vi.spyOn(console, 'error').mockImplementation(() => {});

  it('should pass a healthy tree through untouched', () => {
    render(
      <SceneErrorBoundary>
        <p>scene</p>
      </SceneErrorBoundary>
    );

    expect(screen.getByText('scene')).toBeInTheDocument();
  });

  it('should swallow a throwing child instead of letting it escape', () => {
    const consoleError = silenceReact();

    expect(() =>
      render(
        <SceneErrorBoundary>
          <Boom />
        </SceneErrorBoundary>
      )
    ).not.toThrow();

    consoleError.mockRestore();
  });

  it('should render the fallback when one is given', () => {
    const consoleError = silenceReact();

    render(
      <SceneErrorBoundary fallback={<p>placeholder</p>}>
        <Boom />
      </SceneErrorBoundary>
    );

    expect(screen.getByText('placeholder')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('should report the failure through the logger, not the console', () => {
    const consoleError = silenceReact();

    render(
      <SceneErrorBoundary>
        <Boom />
      </SceneErrorBoundary>
    );

    // Rate-limited with `once`: a failed subtree re-renders on every parent update.
    expect(errorSpy).toHaveBeenCalledWith('Scene subtree failed to render', expect.any(Error));
    consoleError.mockRestore();
  });
});
