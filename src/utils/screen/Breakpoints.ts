// The one definition of "how wide is this screen". These are Tailwind's own defaults (sm/lg/2xl)
// so a JS decision and a CSS one always agree, and a test compiles Tailwind to prove it.

export const BREAKPOINTS = {
  tablet: 640,
  desktop: 1024,
  wide: 1536
} as const;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

export const BREAKPOINT_ORDER: readonly Breakpoint[] = ['wide', 'desktop', 'tablet', 'mobile'];

/** Tier from a width, without React. The E2E specs assert against this. */
export const breakpointForWidth = (width: number): Breakpoint => {
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
};
