// MODE rather than PROD/DEV. Vite replaces all three statically, but MODE keeps the third value
// Vitest sets ('test') and it's the one vi.stubEnv can move.

export const isProduction = (): boolean => {
  return import.meta.env.MODE === 'production';
};

export const isDevelopment = (): boolean => {
  return import.meta.env.MODE === 'development';
};

export const getEnvironment = (): string => {
  return import.meta.env.MODE || 'development';
};
