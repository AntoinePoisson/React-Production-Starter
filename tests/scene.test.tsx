// Three.js does not run under jsdom: these verify composition. Pixels belong in the Playwright suite.

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({ camera: {}, scene: {}, gl: {} })),
  extend: vi.fn()
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: (props: Record<string, unknown>) => (
    <div
      data-autorotate={String(props.autoRotate ?? false)}
      data-enablepan={String(props.enablePan ?? true)}
      data-maxdistance={String(props.maxDistance ?? '')}
      data-mindistance={String(props.minDistance ?? '')}
      data-testid='orbit-controls'
    />
  ),
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useProgress: vi.fn(() => ({ progress: 0 })),
  useGLTF: Object.assign(
    vi.fn(() => ({ nodes: { DemoShape: { geometry: {} } }, materials: {}, scene: {} })),
    { preload: vi.fn() }
  )
}));

import Environment from '@/scene/environment/Environment';
import Experiences from '@/scene/Experiences';

describe('Environment', () => {
  it('should mount without throwing', () => {
    expect(() => render(<Environment />)).not.toThrow();
  });

  it('should provide both a fill light and a shadow-casting key light', () => {
    const { container } = render(<Environment />);

    expect(container.querySelector('ambientlight')).not.toBeNull();

    // React drops boolean-`true` props on unknown elements, so `castShadow` never reaches the
    // DOM here. The shadow-* props do serialise, so they are what identifies the key light.
    const key = container.querySelector('directionallight');
    expect(key).not.toBeNull();
    expect(key?.getAttribute('shadow-mapsize-width')).toBe('1024');
    expect(Number(key?.getAttribute('intensity'))).toBeGreaterThan(1);
  });

  it('should keep the shadow frustum tight rather than the map large', () => {
    // The measured cost is the shadow pass, not the texture size; read Environment.tsx before widening.
    const { container } = render(<Environment />);
    const key = container.querySelector('directionallight');

    const extent = Number(key?.getAttribute('shadow-camera-right'));
    expect(extent).toBeGreaterThan(0);
    expect(extent).toBeLessThanOrEqual(16);
  });

  it('should give the scene a ground plane', () => {
    const { container } = render(<Environment />);

    const mesh = container.querySelector('mesh');
    expect(mesh).not.toBeNull();
    expect(mesh?.querySelector('circlegeometry')).not.toBeNull();
    // Laid flat: a quarter turn about X.
    expect(mesh?.getAttribute('rotation')).toContain(String(-Math.PI / 2));
  });

  it('should take its ground colour from the palette rather than a literal', () => {
    const { container } = render(<Environment />);
    const material = container.querySelector('meshstandardmaterial');

    // jsdom resolves no stylesheet, so this is Palette.ts's fallback: it must match the token.
    expect(material?.getAttribute('color')).toBe('#e8e4dd');
  });

  it('should render no sky object', () => {
    // The gradient is CSS behind a transparent canvas. drei's <Sky /> measured ~8 ms/frame.
    const { container } = render(<Environment />);
    expect(container.querySelector('sky')).toBeNull();
  });
});

describe('Experiences', () => {
  it('should mount the whole demo scene without throwing', () => {
    expect(() => render(<Experiences />)).not.toThrow();
  });

  it('should include the environment', () => {
    const { container } = render(<Experiences />);
    expect(container.querySelector('ambientlight')).not.toBeNull();
  });

  it('should install orbit controls with the demo constraints', () => {
    const { getByTestId } = render(<Experiences />);
    const controls = getByTestId('orbit-controls');

    expect(controls.dataset.autorotate).toBe('true');
    expect(controls.dataset.enablepan).toBe('false');
    expect(Number(controls.dataset.mindistance)).toBeLessThan(Number(controls.dataset.maxdistance));
  });
});
