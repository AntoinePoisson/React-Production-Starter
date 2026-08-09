import type { StorybookConfig } from '@storybook/react-vite';

// DOM overlay only, the 3D scene is covered by e2e/scene.spec.ts.
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],

  // axe on every story, contrast and focus rules regress silently otherwise.
  addons: ['@storybook/addon-a11y'],

  framework: { name: '@storybook/react-vite', options: {} },

  viteFinal: async (config) => {
    // Storybook inherits vite.config.ts and the TanStack plugin dies here with "multiple entries
    // detected". The flat() matters, tanstackStart() returns nested arrays.
    const flattened = (config.plugins ?? []).flat(Infinity as never) as unknown[];

    config.plugins = flattened.filter((plugin) => {
      const name = plugin && typeof plugin === 'object' && 'name' in plugin ? String(plugin.name) : '';
      return !name.startsWith('tanstack');
    }) as typeof config.plugins;

    return config;
  }
};

export default config;
