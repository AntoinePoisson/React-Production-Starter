import type { StorybookConfig } from '@storybook/react-vite';

/** Covers the DOM overlay only. The 3D scene is exercised by `e2e/scene.spec.ts`. */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],

  // Runs axe against every story — the overlay's contrast and focus rules regress silently.
  addons: ['@storybook/addon-a11y'],

  framework: { name: '@storybook/react-vite', options: {} },

  viteFinal: async (config) => {
    // Storybook inherits vite.config.ts, and the TanStack plugin fails outright here with
    // "multiple entries detected". `flat` matters: `tanstackStart()` returns nested arrays.
    const flattened = (config.plugins ?? []).flat(Infinity as never) as unknown[];

    config.plugins = flattened.filter((plugin) => {
      const name = plugin && typeof plugin === 'object' && 'name' in plugin ? String(plugin.name) : '';
      return !name.startsWith('tanstack');
    }) as typeof config.plugins;

    return config;
  }
};

export default config;
