/** Unit tests for the CSS ↔ Three.js colour bridge. */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetPaletteCache, sceneColor } from '@/utils/theme/Palette';

describe('Palette', () => {
  afterEach(() => {
    // Unstub before touching `document`: one test stubs it away entirely.
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty('--color-accent');
    document.documentElement.style.removeProperty('--color-scene-floor');
    document.documentElement.style.removeProperty('--color-scene-prop');
    resetPaletteCache();
  });

  it('should fall back to the compiled default when the token is not set', () => {
    resetPaletteCache();
    expect(sceneColor('accent')).toBe('#6b8cfa');
    expect(sceneColor('floor')).toBe('#e8e4dd');
    expect(sceneColor('prop')).toBe('#f4f1ea');
  });

  it('should read the value from the document when the token is set', () => {
    document.documentElement.style.setProperty('--color-accent', '#123456');
    resetPaletteCache();

    expect(sceneColor('accent')).toBe('#123456');
  });

  it('should memoise the read so a frame loop cannot trigger style resolution', () => {
    document.documentElement.style.setProperty('--color-accent', '#111111');
    resetPaletteCache();
    expect(sceneColor('accent')).toBe('#111111');

    // Changed behind the cache's back: still the old value until the cache is dropped.
    document.documentElement.style.setProperty('--color-accent', '#222222');
    expect(sceneColor('accent')).toBe('#111111');

    resetPaletteCache();
    expect(sceneColor('accent')).toBe('#222222');
  });

  it('should return the compiled default when there is no document', () => {
    vi.stubGlobal('document', undefined);
    resetPaletteCache();

    // The static export path: materials are built in Node, where no stylesheet was ever resolved.
    expect(sceneColor('accent')).toBe('#6b8cfa');
    expect(sceneColor('floor')).toBe('#e8e4dd');
    expect(sceneColor('prop')).toBe('#f4f1ea');
  });

  it('should not memoise a read that resolved nothing', () => {
    resetPaletteCache();

    // A scene chunk evaluating before the stylesheet applies sees tokens computing to nothing; caching
    // that would pin the defaults for the lifetime of the page.
    expect(sceneColor('accent')).toBe('#6b8cfa');

    document.documentElement.style.setProperty('--color-accent', '#654321');
    expect(sceneColor('accent')).toBe('#654321');
  });

  it('should resolve every token from a single read', () => {
    document.documentElement.style.setProperty('--color-accent', '#aaaaaa');
    document.documentElement.style.setProperty('--color-scene-floor', '#bbbbbb');
    document.documentElement.style.setProperty('--color-scene-prop', '#cccccc');
    resetPaletteCache();

    expect([sceneColor('accent'), sceneColor('floor'), sceneColor('prop')]).toEqual(['#aaaaaa', '#bbbbbb', '#cccccc']);
  });
});
