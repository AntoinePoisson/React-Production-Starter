import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div
      className={className}
      data-testid='mock-canvas'
    >
      {children}
    </div>
  ),
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({
    camera: { position: { set: vi.fn() } },
    scene: {},
    gl: { domElement: document.createElement('canvas') }
  })),
  extend: vi.fn()
}));

vi.mock('@react-three/drei', () => ({
  Preload: () => <div data-testid='mock-preload'>Preload</div>,
  useGLTF: Object.assign(
    vi.fn(() => ({ nodes: {}, materials: {}, scene: {} })),
    { preload: vi.fn() }
  ),
  OrbitControls: () => <div data-testid='mock-orbit-controls' />,
  Sky: () => <div data-testid='mock-sky' />,
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useProgress: vi.fn(() => ({ progress: 42 }))
}));

import ThreeCanvas from '@/components/three/Canvas';
import CanvasLoader, { InsideCanvasLoader } from '@/components/three/Loader';
import BootLoader from '@/components/ui/BootLoader';
import Overlay from '@/components/ui/Overlay';
import useGlobalStore from '@/utils/store/Store';

import { withI18n } from './helpers/withI18n';

describe('Component Smoke Tests', () => {
  describe('ThreeCanvas', () => {
    it('should mount with children', () => {
      const { getByText } = render(
        withI18n(
          <ThreeCanvas>
            <div>Test Content</div>
          </ThreeCanvas>
        )
      );

      expect(getByText('Test Content')).toBeInTheDocument();
      expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
    });
  });

  describe('Loaders', () => {
    it('should report the loading progress', () => {
      render(withI18n(<CanvasLoader />));
      expect(screen.getByText('42% loaded')).toBeInTheDocument();
    });

    it('should render the in-canvas variant', () => {
      render(withI18n(<InsideCanvasLoader />));
      expect(screen.getByText('42% loaded')).toBeInTheDocument();
    });

    it('should render the boot fallback without a progress reading', () => {
      // No percentage: the shell renders this before anything starts loading, and reading drei
      // for the number is what dragged three.js into the first load.
      render(withI18n(<BootLoader />));
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });
  });

  describe('Overlay', () => {
    it('should render its copy', () => {
      render(withI18n(<Overlay />));

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('React App Fondation');
    });

    it('should animate its entrance only on a first visit', () => {
      // The class lives on <FirstVisitReveal>, which is what reads the store.
      act(() => {
        useGlobalStore.setState({ isFirstVisit: true });
      });
      const first = render(withI18n(<Overlay />));
      expect(first.container.firstChild).toHaveClass('enter-fade');

      act(() => {
        useGlobalStore.setState({ isFirstVisit: false });
      });
      const returning = render(withI18n(<Overlay />));
      expect(returning.container.firstChild).not.toHaveClass('enter-fade');
    });

    it('should offer a language switcher', () => {
      const { getByRole } = render(withI18n(<Overlay />));

      const nav = getByRole('navigation', { name: 'Language' });
      expect(nav).toBeInTheDocument();
      expect(nav.querySelector('a')).toHaveAttribute('href', '/fr');
    });

    it('should keep its copy selectable', () => {
      // pointer-events-none on the container lets a drag orbit the camera, and also kills text
      // selection, so every block of copy opts back in.
      const { container } = render(withI18n(<Overlay />));

      expect(container.firstChild).toHaveClass('pointer-events-none');

      for (const copy of [screen.getByRole('heading', { level: 1 }), ...Array.from(container.querySelectorAll('p'))]) {
        expect(copy).toHaveClass('pointer-events-auto');
      }
    });
  });

  describe('Critical Dependencies', () => {
    it('should expose zustand', async () => {
      const zustand = await import('zustand');
      expect(zustand.create).toBeDefined();
    });

    it('should expose @react-three/fiber', async () => {
      const fiber = await import('@react-three/fiber');
      expect(fiber.Canvas).toBeDefined();
    });

    it('should expose @react-three/drei', async () => {
      const drei = await import('@react-three/drei');
      expect(drei.useGLTF).toBeDefined();
    });
  });
});
