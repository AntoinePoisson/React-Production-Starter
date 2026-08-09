// CSS tokens → three.js. Memoised. Don't call per frame — getComputedStyle is not free.

// jsdom / SSR fallback. Same values as globals.css.
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

// null if nothing resolved. The caller memoises, so a document whose CSS
// hasn't applied yet would freeze the defaults forever.
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

// Re-key the components that own the materials after this — three.js keeps its own copy.
export const resetPaletteCache = (): void => {
  cache = null;
};
