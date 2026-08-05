/**
 * Bridge between the `@theme static` tokens in `app/globals.css` and Three.js materials.
 * Memoised, never called per frame: `getComputedStyle` forces a style resolution.
 */

// Compile-time defaults for the static export and jsdom. Mirror the tokens in globals.css.
const FALLBACK = {
  accent: '#6b8cfa',
  floor: '#e8e4dd',
  prop: '#f4f1ea'
} as const;

export type SceneColorName = keyof typeof FALLBACK;

const CSS_VARIABLE: Record<SceneColorName, string> = {
  accent: '--color-accent',
  floor: '--color-scene-floor',
  prop: '--color-scene-prop'
};

let cache: Record<SceneColorName, string> | null = null;

// null rather than FALLBACK when nothing resolves: the caller memoises the result, so a
// document whose stylesheet has not applied yet would freeze the defaults in for good.
const readFromDocument = (): Record<SceneColorName, string> | null => {
  const styles = getComputedStyle(document.documentElement);
  const entries = Object.entries(CSS_VARIABLE) as [SceneColorName, string][];
  let resolvedAny = false;

  const palette = entries.reduce<Record<SceneColorName, string>>(
    (acc, [name, variable]) => {
      const value = styles.getPropertyValue(variable).trim();
      if (value) resolvedAny = true;
      acc[name] = value || FALLBACK[name];
      return acc;
    },
    { ...FALLBACK }
  );

  return resolvedAny ? palette : null;
};

/** Scene colour from the CSS palette, falling back to the compiled default. Only a real read is cached. */
export const sceneColor = (name: SceneColorName): string => {
  if (typeof document === 'undefined') return FALLBACK[name];

  cache ??= readFromDocument();
  return (cache ?? FALLBACK)[name];
};

/**
 * Drop the memoised palette. Re-key the components owning the affected materials afterwards:
 * a Three.js material holds its own copy of the colour.
 */
export const resetPaletteCache = (): void => {
  cache = null;
};
