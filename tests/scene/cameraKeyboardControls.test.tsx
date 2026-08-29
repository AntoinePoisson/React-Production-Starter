import { fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { canvas, invalidate } = vi.hoisted(() => ({ canvas: document.createElement('canvas'), invalidate: vi.fn() }));

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ gl: { domElement: canvas }, invalidate })
}));

import CameraKeyboardControls from '@/scene/CameraKeyboardControls';
import { applyCameraKey } from '@/scene/CameraKeyboardControlsRules';

const controls = () =>
  ({
    getAzimuthalAngle: vi.fn(() => 1),
    setAzimuthalAngle: vi.fn(),
    getPolarAngle: vi.fn(() => 1),
    setPolarAngle: vi.fn(),
    dollyIn: vi.fn(),
    dollyOut: vi.fn(),
    reset: vi.fn(),
    update: vi.fn()
  }) as unknown as OrbitControlsImpl;

describe('applyCameraKey', () => {
  it.each([
    ['ArrowLeft', 'setAzimuthalAngle'],
    ['ArrowRight', 'setAzimuthalAngle'],
    ['ArrowUp', 'setPolarAngle'],
    ['ArrowDown', 'setPolarAngle'],
    ['+', 'dollyIn'],
    ['=', 'dollyIn'],
    ['-', 'dollyOut'],
    ['_', 'dollyOut'],
    ['Home', 'reset']
  ])('should handle %s with %s', (key, method) => {
    const instance = controls();

    expect(applyCameraKey(key, instance)).toBe(true);
    expect(instance[method as keyof OrbitControlsImpl]).toHaveBeenCalled();
    expect(instance.update).toHaveBeenCalledOnce();
  });

  it('should leave unrelated keys alone', () => {
    const instance = controls();

    expect(applyCameraKey('Enter', instance)).toBe(false);
    expect(instance.update).not.toHaveBeenCalled();
  });
});

describe('CameraKeyboardControls', () => {
  beforeEach(() => {
    invalidate.mockClear();
    canvas.remove();
  });

  it('should control the camera from the focusable scene wrapper', () => {
    const wrapper = document.createElement('div');
    wrapper.dataset.sceneRoot = '';
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);
    const instance = controls();
    const ref = createRef<OrbitControlsImpl>();
    ref.current = instance;

    const { unmount } = render(<CameraKeyboardControls controlsRef={ref} />);
    const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
    wrapper.dispatchEvent(event);

    expect(instance.reset).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(invalidate).toHaveBeenCalledOnce();

    unmount();
    fireEvent.keyDown(wrapper, { key: 'Home' });
    expect(instance.reset).toHaveBeenCalledOnce();
    wrapper.remove();
  });

  it('should fall back to the canvas and ignore input until controls exist', () => {
    document.body.appendChild(canvas);
    const ref = createRef<OrbitControlsImpl>();

    render(<CameraKeyboardControls controlsRef={ref} />);
    fireEvent.keyDown(canvas, { key: 'ArrowLeft' });

    expect(invalidate).not.toHaveBeenCalled();
  });
});
