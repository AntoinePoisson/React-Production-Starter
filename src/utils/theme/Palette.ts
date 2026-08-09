// Bridge between the @theme static tokens and the three.js materials. Memoised, and never call it
// per frame: getComputedStyle forces a style resolution.

// Defaults for the static export and for jsdom. Mirrors the tokens in globals.css.
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

// null rather than FALLBACK when nothing resolves. The caller memoises the result, so a document
// whose stylesheet hasn't applied yet would freeze the defaults in for good.
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

export const sceneColor = (name: SceneColorName): string => {
  if (typeof document === 'undefined') return FALLBACK[name];

  cache ??= readFromDocument();
  return (cache ?? FALLBACK)[name];
};

// Re-key the components owning the affected materials afterwards, a three.js material keeps its
// own copy of the colour.
export const resetPaletteCache = (): void => {
  cache = null;
};
