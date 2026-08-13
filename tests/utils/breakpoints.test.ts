// The last block compiles Tailwind and asserts our pixel values are the framework's own.
// Drift shows up as a footer hidden by CSS at one width while a hook reports the wider tier.

import tailwindcss from '@tailwindcss/postcss';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import { BREAKPOINTS, BREAKPOINT_ORDER, breakpointForWidth } from '@/utils/screen/Breakpoints';

describe('Breakpoints', () => {
  describe('breakpointForWidth', () => {
    it.each([
      [320, 'mobile'],
      [375, 'mobile'],
      [639, 'mobile'],
      [640, 'tablet'],
      [768, 'tablet'],
      [1023, 'tablet'],
      [1024, 'desktop'],
      [1440, 'desktop'],
      [1535, 'desktop'],
      [1536, 'wide'],
      [1920, 'wide'],
      [3440, 'wide']
    ] as const)('should resolve %ipx to %s', (width, expected) => {
      expect(breakpointForWidth(width)).toBe(expected);
    });

    it('should treat every boundary as inclusive of the wider tier', () => {
      expect(breakpointForWidth(BREAKPOINTS.tablet)).toBe('tablet');
      expect(breakpointForWidth(BREAKPOINTS.tablet - 1)).toBe('mobile');
      expect(breakpointForWidth(BREAKPOINTS.desktop)).toBe('desktop');
      expect(breakpointForWidth(BREAKPOINTS.desktop - 1)).toBe('tablet');
      expect(breakpointForWidth(BREAKPOINTS.wide)).toBe('wide');
      expect(breakpointForWidth(BREAKPOINTS.wide - 1)).toBe('desktop');
    });

    it('should degrade to mobile for nonsensical widths', () => {
      expect(breakpointForWidth(0)).toBe('mobile');
      expect(breakpointForWidth(-100)).toBe('mobile');
    });
  });

  describe('BREAKPOINT_ORDER', () => {
    it('should list every tier exactly once, widest first', () => {
      expect(BREAKPOINT_ORDER).toEqual(['wide', 'desktop', 'tablet', 'mobile']);
      expect(new Set(BREAKPOINT_ORDER).size).toBe(BREAKPOINT_ORDER.length);
    });

    it('should cover every tier breakpointForWidth can return', () => {
      const produced = new Set([0, 640, 1024, 1536].map(breakpointForWidth));
      expect(new Set(BREAKPOINT_ORDER)).toEqual(produced);
    });
  });

  describe('agreement with Tailwind', () => {
    // Tailwind v4 is CSS-first: compiling one utility per variant is the only way to read its values.
    it('should use the same pixel values Tailwind generates its variants from', async () => {
      const { css } = await postcss([tailwindcss()]).process(
        `@import 'tailwindcss';\n@source inline("sm:mt-1 lg:mt-2 2xl:mt-3");`,
        { from: `${process.cwd()}/app/globals.css` }
      );

      const root = postcss.parse(css);

      const pixelsFor = (variant: string, marker: string): number => {
        let params: string | null = null;
        root.walkAtRules('media', (atRule) => {
          atRule.walkRules((rule) => {
            if (rule.selector.includes(marker)) params = atRule.params;
          });
        });

        expect(params, `Tailwind emitted no media query for the "${variant}" variant`).not.toBeNull();
        const rem = (params as unknown as string).match(/([0-9.]+)rem/);
        expect(rem, `"${variant}" media query is not expressed in rem: ${params}`).not.toBeNull();
        return Number((rem as RegExpMatchArray)[1]) * 16;
      };

      expect(pixelsFor('sm', 'mt-1')).toBe(BREAKPOINTS.tablet);
      expect(pixelsFor('lg', 'mt-2')).toBe(BREAKPOINTS.desktop);
      expect(pixelsFor('2xl', 'mt-3')).toBe(BREAKPOINTS.wide);
    });
  });
});
