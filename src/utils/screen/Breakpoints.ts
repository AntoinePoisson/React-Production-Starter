/**
 * The one definition of "how wide is this screen" in the app.
 *
 * The boundaries are Tailwind's own defaults (`sm` / `lg` / `2xl`), so a JavaScript decision and
 * a CSS one always agree. `tests/utils/breakpoints.test.ts` compiles Tailwind and fails on drift.
 */

/** Lower bound of each tier above `mobile`, in CSS pixels. */
export const BREAKPOINTS = {
  tablet: 640,
  desktop: 1024,
  wide: 1536
} as const;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

/** Ordered widest-first, the order a resolver has to test them in. */
export const BREAKPOINT_ORDER: readonly Breakpoint[] = ['wide', 'desktop', 'tablet', 'mobile'];

/** Resolve a tier from a width, without React. E2E specs and plain modules assert against it. */
export const breakpointForWidth = (width: number): Breakpoint => {
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
};
