// MODE, not PROD/DEV. Vite replaces all three, but MODE also has 'test'
// (Vitest) and that's the one vi.stubEnv can move.

export const isProduction = (): boolean => {
  return import.meta.env.MODE === 'production';
};

export const isDevelopment = (): boolean => {
  return import.meta.env.MODE === 'development';
};

export const getEnvironment = (): string => {
  return import.meta.env.MODE || 'development';
};
