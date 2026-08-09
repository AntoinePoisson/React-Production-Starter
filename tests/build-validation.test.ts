import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SITE_TITLE } from '@/utils/config/Identity';

// process.cwd() rather than import.meta.url: under Vitest's module runner the latter is an
// http:// URL and fileURLToPath refuses it. Vitest always runs from the project root anyway.
const PROJECT_ROOT = process.cwd();

const read = (relativePath: string) => readFileSync(join(PROJECT_ROOT, relativePath), 'utf-8');
const readJson = (relativePath: string) => JSON.parse(read(relativePath));

const packageJson = readJson('package.json');

// Invariants of the build wiring, the part nobody exercises by hand.
describe('Build pipeline', () => {
  const build: string = packageJson.scripts.build;

  it('should compile the catalogues strictly before building', () => {
    // --strict is what refuses a missing translation. Without it the build ships a French page
    // with English fallbacks and says nothing.
    expect(build).toContain('lingui compile --strict');
  });

  it('should run the post-build step after the build', () => {
    // SEO files, service worker, CSP position. `vite build` alone emits a site with none of them.
    expect(build).toContain('scripts/postbuild.mjs');
    expect(build.indexOf('vite build')).toBeLessThan(build.indexOf('scripts/postbuild.mjs'));
  });

  it('should keep the hashed bundles out of the verbatim asset directory', () => {
    expect(read('vite.config.ts')).toContain("assetsDir: 'static'");
  });

  it('should measure bundle sizes against the client output only', () => {
    // dist/server is the render pass, never deployed, so counting its bytes would make the
    // budgets meaningless.
    for (const entry of packageJson['size-limit'] as { path: string }[]) {
      expect(entry.path).toMatch(/^dist\/client\//);
    }
  });
});

describe('Critical path', () => {
  /** Static import specifiers only, an import() expression is not one. */
  const staticImports = (relativePath: string): string[] =>
    [...read(relativePath).matchAll(/^import\b[^;]*?from '([^']+)';/gm)].map((match) => match[1]);

  const PULLS_IN_THREE = /^three$|^@react-three\/|^@\/components\/three\/|^@\/scene\//;

  it('should keep three.js out of the document shell', () => {
    // Every static import the shell makes downloads before first paint. It once imported a loader
    // that only called drei's useProgress, and that put ~220 kB back on the critical path.
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
    // jsdom 30, npm-check-updates 23 and a growing list of others declare
    // ^22.22.2 || ^24.15.0 || >=26.0.0.
    expect(packageJson.engines.node).toBe('>=24.15.0');
  });

  it('should keep TypeScript below 6.1', () => {
    // @typescript-eslint/parser declares typescript >=4.8.4 <6.1.0. Past it, lint breaks.
    // Check with: npm view @typescript-eslint/parser peerDependencies
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
    // At 100% an untested branch fails the run. At 95% it's a budget to spend, and what goes
    // untested is exactly what nobody exercises by hand.
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
    // Drift shows up as a flash of the wrong colour on launch from the home screen, and nowhere
    // else, which is why it survives review.
    expect(manifest.theme_color.toLowerCase()).toBe(cssToken('sky-top'));
    expect(manifest.background_color.toLowerCase()).toBe(cssToken('sky-horizon'));
  });

  it('should use the same light theme-color in the document head', () => {
    expect(metadata).toContain(`light: '${cssToken('sky-top')}'`);
  });

  it('should declare the tokens the 3D scene reads at runtime', () => {
    // Must be @theme static. Tailwind v4 prunes theme variables no utility class references, and
    // Palette.ts reads these through getComputedStyle, which that analysis can't see.
    expect(globalsCss).toContain('@theme static');
    for (const token of ['scene-floor', 'scene-prop', 'accent']) {
      expect(globalsCss).toContain(`--color-${token}:`);
    }
  });
});

describe('Web app manifest', () => {
  const manifest = readJson('public/manifest.json');

  it('should name the app what the rest of the project calls it', () => {
    // Nothing imports the manifest, so an installed PWA is the only place drift shows up.
    // Compared against Identity.ts and package.json rather than literals, initialize.js rewrites
    // all three and this has to hold for the renamed project too.
    expect(manifest.name).toBe(SITE_TITLE);
    expect(manifest.short_name).toBe(SITE_TITLE);
    expect(manifest.description).toBe(packageJson.description);
  });

  it('should ship every icon it declares', () => {
    // A missing icon costs the install prompt on Android, and reports nothing at build time.
    for (const icon of manifest.icons as { src: string }[]) {
      expect(existsSync(join(PROJECT_ROOT, 'public', icon.src)), `${icon.src} is declared but missing`).toBe(true);
    }
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
    // useGLTF(path, DRACO_PATH) points at these rather than a CDN, which keeps the CSP tight and
    // the app offline-capable.
    for (const file of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
      expect(existsSync(join(PROJECT_ROOT, 'public/assets/models/draco', file))).toBe(true);
    }
  });

  it('should ship a 1200x630 social preview', () => {
    const png = readFileSync(join(PROJECT_ROOT, 'public/og-image.png'));

    // PNG IHDR: width and height are big-endian uint32 at byte 16 and 20.
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

describe('Content Security Policy', () => {
  const metadata = read('src/app/Metadata.ts');

  it('should never allow eval', () => {
    // 'unsafe-inline' is a documented compromise (the router injects inline scripts at runtime
    // and we have no nonce). 'unsafe-eval' is not: nothing needs it, and it turns every injected
    // string into executable code.
    expect(metadata).not.toContain("'unsafe-eval'");
  });

  it('should allow the WebAssembly the Draco decoder instantiates', () => {
    expect(metadata).toContain("'wasm-unsafe-eval'");
  });

  // frame-ancestors is asserted absent in tests/app/metadata.test.ts, against the built policy.
  // Not here: this file reads the source, where the word also shows up in the comment explaining
  // why it's missing.

  it('should keep the directives a meta tag does enforce', () => {
    expect(metadata).toContain("object-src 'none'");
    expect(metadata).toContain("base-uri 'self'");
    expect(metadata).toContain("form-action 'self'");
  });

  it('should allow the service worker', () => {
    expect(metadata).toContain("worker-src 'self'");
  });
});
