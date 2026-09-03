import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SITE_TITLE } from '@/utils/config/Identity';

// process.cwd(), not import.meta.url — Vitest's runner makes that an http://
// URL and fileURLToPath refuses it. We're always at the project root anyway.
const PROJECT_ROOT = process.cwd();

const read = (relativePath: string) => readFileSync(join(PROJECT_ROOT, relativePath), 'utf-8');
const readJson = (relativePath: string) => JSON.parse(read(relativePath));

const packageJson = readJson('package.json');

// Build wiring. The stuff nobody clicks through by hand.
describe('Build pipeline', () => {
  const build: string = packageJson.scripts.build;

  it('should compile the catalogues strictly before building', () => {
    // --strict refuses a missing translation. Without it, French pages silently fall back to EN.
    expect(build).toContain('lingui compile --strict');
  });

  it('should run the post-build step after the build', () => {
    // SEO files, SW, CSP position. `vite build` alone ships none of that.
    expect(build).toContain('scripts/postbuild.mjs');
    expect(build.indexOf('vite build')).toBeLessThan(build.indexOf('scripts/postbuild.mjs'));
  });

  it('should keep the hashed bundles out of the verbatim asset directory', () => {
    expect(read('vite.config.ts')).toContain("assetsDir: 'static'");
  });

  it('should measure bundle sizes against the client output only', () => {
    // dist/server is the render pass, never deployed. Don't count it.
    for (const entry of packageJson['size-limit'] as { path: string }[]) {
      expect(entry.path).toMatch(/^dist\/client\//);
    }
  });
});

describe('Critical path', () => {
  /** Static imports only. `import()` doesn't count. */
  const staticImports = (relativePath: string): string[] =>
    [...read(relativePath).matchAll(/^import\b[^;]*?from '([^']+)';/gm)].map((match) => match[1]);

  const PULLS_IN_THREE = /^three$|^@react-three\/|^@\/components\/three\/|^@\/scene\//;

  it('should keep three.js out of the document shell', () => {
    // Static imports in the shell download before first paint. A loader that
    // called useProgress once put ~220 kB back on the critical path.
    for (const specifier of staticImports('src/routes/__root.tsx')) {
      expect(specifier, `__root.tsx statically imports ${specifier}`).not.toMatch(PULLS_IN_THREE);
    }
  });

  it('should keep the boot fallback free of the 3D bundle', () => {
    for (const specifier of staticImports('src/components/ui/BootLoader.tsx')) {
      expect(specifier, `BootLoader.tsx statically imports ${specifier}`).not.toMatch(PULLS_IN_THREE);
    }
  });
});

describe('Toolchain pins', () => {
  it('should pin the package manager', () => {
    expect(packageJson.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
  });

  it('should declare the Node floor its dependencies require', () => {
    // jsdom 30 and a few others want ^22.22.2 || ^24.15.0 || >=26.
    expect(packageJson.engines.node).toBe('>=24.15.0');
  });

  it('should keep TypeScript below 6.1', () => {
    // @typescript-eslint/parser: typescript <6.1. Past that, lint breaks.
    expect(packageJson.devDependencies.typescript).toMatch(/^\^5\./);
  });
});

describe('TypeScript configuration', () => {
  const tsconfig = read('tsconfig.json');

  it('should be strict', () => {
    expect(tsconfig).toContain('"strict": true');
    expect(tsconfig).toContain('"noUnusedLocals": true');
    expect(tsconfig).toContain('"noUnusedParameters": true');
  });

  it('should alias @/ to src/', () => {
    expect(tsconfig).toContain('"@/*": ["./src/*"]');
  });
});

describe('Test configuration', () => {
  const vitestConfig = read('vitest.config.ts');

  it('should enforce full coverage', () => {
    // 100%. At 95% the untested bits are exactly the ones nobody clicks.
    expect(vitestConfig).toContain('statements: 100');
    expect(vitestConfig).toContain('branches: 100');
    expect(vitestConfig).toContain('functions: 100');
    expect(vitestConfig).toContain('lines: 100');
  });

  it('should exclude only the placeholder scene and generated files', () => {
    expect(vitestConfig).toContain('src/scene/demo/**');
    expect(vitestConfig).toContain('src/routeTree.gen.ts');
  });
});

describe('Theme consistency', () => {
  const globalsCss = read('src/app/globals.css');
  const manifest = readJson('public/manifest.json');
  const metadata = read('src/app/Metadata.ts');

  const cssToken = (name: string): string => {
    const match = globalsCss.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8})`));
    expect(match, `--color-${name} not found in globals.css`).not.toBeNull();
    return (match as RegExpMatchArray)[1].toLowerCase();
  };

  it('should paint the manifest in the same colours as the page', () => {
    // Wrong colour flash when you launch from the home screen. Easy to miss.
    expect(manifest.theme_color.toLowerCase()).toBe(cssToken('sky-top'));
    expect(manifest.background_color.toLowerCase()).toBe(cssToken('sky-horizon'));
  });

  it('should use the same light theme-color in the document head', () => {
    expect(metadata).toContain(`light: '${cssToken('sky-top')}'`);
  });

  it('should declare the tokens the 3D scene reads at runtime', () => {
    // @theme static — v4 drops unused tokens, and Palette.ts reads these at runtime.
    expect(globalsCss).toContain('@theme static');
    for (const token of ['scene-floor', 'scene-prop', 'accent']) {
      expect(globalsCss).toContain(`--color-${token}:`);
    }
  });
});

describe('Web app manifest', () => {
  const manifest = readJson('public/manifest.json');

  it('should name the app what the rest of the project calls it', () => {
    // Nothing imports the manifest, so drift only shows up on an installed PWA.
    // Compared to Identity.ts / package.json — initialize.js rewrites all three.
    expect(manifest.name).toBe(SITE_TITLE);
    expect(manifest.short_name).toBe(SITE_TITLE);
    expect(manifest.description).toBe(packageJson.description);
  });

  it('should ship every icon it declares', () => {
    // Missing icon = no install prompt on Android, and the build says nothing.
    for (const icon of manifest.icons as { src: string }[]) {
      expect(existsSync(join(PROJECT_ROOT, 'public', icon.src)), `${icon.src} is declared but missing`).toBe(true);
    }
  });
});

describe('Brand icons', () => {
  const svgFiles = readdirSync(join(PROJECT_ROOT, 'public'), { recursive: true })
    .map(String)
    .filter((name) => name.endsWith('.svg'));

  it('should find the vector source the raster icons are generated from', () => {
    expect(svgFiles).toContain(join('icons', 'favicon.svg'));
  });

  it.each(svgFiles)('should parse %s as strict XML', (name) => {
    // Favicon is parsed as XML. One bad comment and the tab icon is just empty —
    // no console, no PNG fallback. The generate script still reads it with a regex.
    const document = new DOMParser().parseFromString(read(join('public', name)), 'image/svg+xml');
    const error = document.querySelector('parsererror');

    expect(error?.textContent ?? '').toBe('');
  });
});

describe('Repository hygiene', () => {
  const gitignore = read('.gitignore');

  it('should ignore every env file but the example', () => {
    expect(gitignore).toContain('.env*');
    expect(gitignore).toContain('!.env.example');
  });

  it('should commit the env example', () => {
    expect(existsSync(join(PROJECT_ROOT, '.env.example'))).toBe(true);
  });

  it('should ignore the generated catalogues and route tree', () => {
    expect(gitignore).toContain('src/i18n/messages/*.ts');
    expect(gitignore).toContain('src/routeTree.gen.ts');
  });

  it('should ship the local Draco decoder', () => {
    // Local decoder, not a CDN — keeps the CSP tight and works offline.
    for (const file of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
      expect(existsSync(join(PROJECT_ROOT, 'public/assets/models/draco', file))).toBe(true);
    }
  });

  it('should ship a 1200x630 social preview', () => {
    const png = readFileSync(join(PROJECT_ROOT, 'public/og-image.png'));

    // PNG IHDR: width/height are big-endian uint32 at bytes 16 and 20.
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

describe('Content Security Policy', () => {
  const metadata = read('src/app/Metadata.ts');

  it('should never allow eval', () => {
    // 'unsafe-inline' we have to live with (router injects scripts, no nonce).
    // 'unsafe-eval' we don't.
    expect(metadata).not.toContain("'unsafe-eval'");
  });

  it('should allow the WebAssembly the Draco decoder instantiates', () => {
    expect(metadata).toContain("'wasm-unsafe-eval'");
  });

  // frame-ancestors is checked in metadata.test.ts against the built policy.
  // Not here — this file reads the source, and the word is in a comment.

  it('should keep the directives a meta tag does enforce', () => {
    expect(metadata).toContain("object-src 'none'");
    expect(metadata).toContain("base-uri 'self'");
    expect(metadata).toContain("form-action 'self'");
  });

  it('should allow the service worker', () => {
    expect(metadata).toContain("worker-src 'self'");
  });
});
