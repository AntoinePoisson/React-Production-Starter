import { readFileSync } from 'fs';
import path from 'path';

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// three.js doesn't run under jsdom. Keep the props so a test can drive onCreated.
const { canvasProps, monitorProps } = vi.hoisted(() => ({
  canvasProps: [] as Record<string, unknown>[],
  monitorProps: [] as Record<string, unknown>[]
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, className, ...rest }: { children: React.ReactNode; className?: string }) => {
    canvasProps.push({ className, ...rest });
    return (
      <div
        className={className}
        data-testid='mock-canvas'
      >
        {children}
      </div>
    );
  }
}));

vi.mock('@react-three/drei', () => ({
  PerformanceMonitor: (props: Record<string, unknown>) => {
    monitorProps.push(props);
    return null;
  }
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams()
}));

import ThreeCanvas from '@/components/three/Canvas';

import { withI18n } from './helpers/withI18n';

describe('ThreeCanvas', () => {
  it('should not claim a layout through classes R3F overrides', () => {
    // R3F spreads className onto a div it already inline-styles position/width/height on, and an
    // inline style beats a class.
    render(
      withI18n(
        <ThreeCanvas>
          <div>Test content</div>
        </ThreeCanvas>
      )
    );

    const canvas = screen.getByTestId('mock-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveClass('outline-none');

    for (const overridden of ['fixed', 'top-0', 'left-0', 'h-full', 'w-full']) {
      expect(canvas, `"${overridden}" loses to R3F's inline style, it states nothing`).not.toHaveClass(overridden);
    }
  });

  it('should render its children inside the canvas', () => {
    render(
      withI18n(
        <ThreeCanvas>
          <div>Scene content</div>
        </ThreeCanvas>
      )
    );

    expect(screen.getByText('Scene content')).toBeInTheDocument();
  });

  it('should not try to guard gestures with a utility class', () => {
    // R3F puts className on its wrapper div, not on the <canvas>, so the rule goes in globals.css.
    render(
      withI18n(
        <ThreeCanvas>
          <div />
        </ThreeCanvas>
      )
    );

    expect(screen.getByTestId('mock-canvas')).not.toHaveClass('touch-none');
  });

  it('should expose an accessible, focusable scene region', () => {
    render(withI18n(<ThreeCanvas>{null}</ThreeCanvas>));

    const props = canvasProps.at(-1);
    expect(props?.role).toBe('region');
    expect(props?.tabIndex).toBe(0);
    // The label carries the keyboard commands too, so CameraKeyboardControls is discoverable
    // without a second copy of the instructions living in the overlay.
    expect(props?.['aria-label']).toMatch(/arrow keys/i);
    expect(props?.['aria-label']).toMatch(/drag/i);
  });

  it('should adapt its DPR to measured rendering performance', () => {
    monitorProps.length = 0;
    render(withI18n(<ThreeCanvas>{null}</ThreeCanvas>));

    expect(canvasProps.at(-1)?.dpr).toEqual([1, 1.5]);
    expect(monitorProps.at(-1)?.flipflops).toBe(3);

    act(() => (monitorProps.at(-1)?.onIncline as () => void)());
    expect(canvasProps.at(-1)?.dpr).toEqual([1, 2]);

    act(() => (monitorProps.at(-1)?.onDecline as () => void)());
    expect(canvasProps.at(-1)?.dpr).toEqual([1, 1]);

    act(() => (monitorProps.at(-1)?.onFallback as () => void)());
    expect(canvasProps.at(-1)?.dpr).toEqual([1, 1]);
  });

  it('should have that gesture rule declared on the canvas itself', () => {
    // Nothing in R3F sets touch-action. The runtime value comes from OrbitControls, which clears
    // it on disconnect(), so the rule has to live in the CSS.
    const css = readFileSync(path.join(__dirname, '..', 'src', 'app', 'globals.css'), 'utf-8');

    expect(css).toMatch(/canvas\s*\{[^}]*touch-action:\s*none/);
  });

  describe('onCreated', () => {
    /** Render, then call onCreated with a stand-in for the R3F root state. */
    const create = () => {
      canvasProps.length = 0;
      render(
        withI18n(
          <ThreeCanvas>
            <div />
          </ThreeCanvas>
        )
      );

      const domElement = document.createElement('canvas');
      const root = {
        gl: { domElement, getContext: vi.fn() },
        camera: { position: { x: 0, y: 2.5, z: 8 } },
        scene: { children: [] }
      };

      const onCreated = canvasProps.at(-1)?.onCreated as (state: typeof root) => void;
      expect(onCreated, 'ThreeCanvas no longer passes onCreated').toBeTypeOf('function');
      onCreated(root);

      return { domElement, root };
    };

    it('should expose the renderer, camera and scene on the canvas element', () => {
      const { domElement, root } = create();

      // The E2E suite reads these instead of canvas.getContext(), which triggers context loss on
      // WebKit. Renaming __r3fRenderer breaks e2e/utils/webVitals and e2e/scene.spec.ts.
      const exposed = domElement as unknown as Record<string, unknown>;
      expect(exposed.__r3fRenderer).toBe(root.gl);
      expect(exposed.__r3fCamera).toBe(root.camera);
      expect(exposed.__r3fScene).toBe(root.scene);
    });

    it('should not throw when called twice', () => {
      expect(() => {
        create();
        create();
      }).not.toThrow();
    });

    it('should stop contextmenu at the canvas so the right-click menu survives', () => {
      const { domElement } = create();

      // Stand-in for the R3F container, where drei connects OrbitControls. Its handler
      // preventDefaults every contextmenu, so it must never be reached.
      const container = document.createElement('div');
      const orbitControlsHandler = vi.fn((event: Event) => event.preventDefault());
      container.appendChild(domElement);
      container.addEventListener('contextmenu', orbitControlsHandler);
      document.body.appendChild(container);

      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      domElement.dispatchEvent(event);

      expect(orbitControlsHandler).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);

      container.remove();
    });
  });
});
