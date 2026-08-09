// One definition of screen width. Same numbers as Tailwind (sm/lg/2xl).
// A test compiles Tailwind to make sure they stay in sync.

export const BREAKPOINTS = {
  tablet: 640,
  desktop: 1024,
  wide: 1536
} as const;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

export const BREAKPOINT_ORDER: readonly Breakpoint[] = ['wide', 'desktop', 'tablet', 'mobile'];

/** Tier from a width, no React. E2E asserts against this. */
export const breakpointForWidth = (width: number): Breakpoint => {
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
};
