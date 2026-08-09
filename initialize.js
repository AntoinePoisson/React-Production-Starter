#!/usr/bin/env node

/**
 * Turns the starter into your project. Run once, then delete.
 *
 *   node initialize.js
 *   node initialize.js --dry-run
 *   node initialize.js --yes
 *   node initialize.js --name="My App" --url=https://example.com
 *
 * Stdlib only — this runs before `pnpm install`.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m'
};

/** What the template calls itself. All of these get rewritten. */
export const TEMPLATE = {
  title: 'React App Fondation',
  slug: 'react-app-fondation',
  description: 'React + Vite + React Three Fiber production starter',
  author: 'Antoine Poisson',
  namespace: 'app'
};

/** "My Great App" → "my-great-app". A slug is left as-is. */
export const toSlug = (name) =>
  name
    .normalize('NFD')
    // Strip accents. Package names are [a-z0-9-._~].
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** "my-great-app" → "My Great App". Capitals in the input are kept. */
export const toTitle = (name) =>
  name
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => (word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');

/** Site URL, with an optional deploy path. */
export const toSiteUrl = (url) => {
  if (!url) return '';

  try {
    const parsed = new URL(url.includes('://') ? url : `https://${url}`);
    parsed.search = '';
    parsed.hash = '';

    return parsed.href.replace(/\/+$/, '');
  } catch {
    return '';
  }
};

// Old name, same thing.
export const toOrigin = toSiteUrl;

/** Longest first. Slug-before-title leaves a half-rewritten string nothing else matches. */
export const buildReplacements = (answers) => {
  const pairs = [
    [TEMPLATE.description, answers.description],
    [TEMPLATE.title, answers.title],
    [TEMPLATE.slug, answers.slug],
    [TEMPLATE.author, answers.author]
  ];

  if (answers.namespace && answers.namespace !== TEMPLATE.namespace) {
    pairs.push([`"${TEMPLATE.namespace}"`, `"${answers.namespace}"`]);
  }

  return (
    pairs
      // Skip no-ops so they don't show up as "changed".
      .filter(([from, to]) => to && from !== to)
      .sort(([a], [b]) => b.length - a.length)
  );
};

export const applyReplacements = (content, replacements) =>
  replacements.reduce((text, [from, to]) => text.split(from).join(to), content);

const REWRITE_FILES = [
  'package.json',
  'README.md',
  'LICENSE',
  'doc/WORKFLOW.md',
  '.env.example',
  'public/manifest.json',
  'public/humans.txt',
  'public/icons/favicon.svg',
  'src/utils/config/Identity.ts',
  'src/utils/store/SessionStorage.ts',
  'src/utils/logger/Logger.ts',
  'src/app/Metadata.ts',
  'src/app/pages/NotFound.tsx',
  'src/components/ui/Overlay.tsx',
  'scripts/generate-brand-assets.mjs',
  'scripts/postbuild.mjs',
  'vitest.config.ts',
  'src/i18n/messages/en.json',
  'src/i18n/messages/fr.json'
];

/** Gone if you drop the 3D demo. */
const DEMO_PATHS = ['src/scene/demo', 'public/assets/models/demo', 'public/assets/models/draco'];

const read = (relativePath) => {
  const full = join(PROJECT_ROOT, relativePath);
  return existsSync(full) ? readFileSync(full, 'utf-8') : null;
};

const write = (relativePath, content, dryRun) => {
  if (dryRun) return;
  writeFileSync(join(PROJECT_ROOT, relativePath), content);
};

const parseFlags = (argv) => {
  const flags = { dryRun: false, yes: false };

  for (const arg of argv) {
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--yes' || arg === '-y') flags.yes = true;
    else if (arg.startsWith('--name=')) flags.name = arg.slice('--name='.length);
    else if (arg.startsWith('--url=')) flags.url = arg.slice('--url='.length);
    else if (arg.startsWith('--author=')) flags.author = arg.slice('--author='.length);
    else if (arg.startsWith('--description=')) flags.description = arg.slice('--description='.length);
  }

  return flags;
};

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  console.info('');
  console.info(`${colors.bold}${colors.blue}React App Fondation${colors.reset} project initialisation`);
  console.info(`${colors.dim}Answers are used to rewrite every place the template names itself.${colors.reset}`);
  if (flags.dryRun) console.info(`${colors.yellow}Dry run: nothing will be written.${colors.reset}`);
  console.info('');

  const rl = flags.yes ? null : createInterface({ input: stdin, output: stdout });

  /** Ask, or take the default when running unattended. */
  const ask = async (question, fallback) => {
    if (!rl) return fallback;

    const suffix = fallback ? ` ${colors.dim}(${fallback})${colors.reset}` : '';
    const answer = (await rl.question(`${question}${suffix}: `)).trim();

    return answer || fallback;
  };

  const confirm = async (question, fallback = false) => {
    if (!rl) return fallback;

    const answer = (await rl.question(`${question} ${colors.dim}(${fallback ? 'Y/n' : 'y/N'})${colors.reset}: `))
      .trim()
      .toLowerCase();

    if (!answer) return fallback;
    return answer.startsWith('y') || answer.startsWith('o');
  };

  const rawName = flags.name ?? (await ask('Project name', TEMPLATE.title));
  const title = toTitle(rawName);
  const slug = toSlug(rawName);

  const description = flags.description ?? (await ask('Description', TEMPLATE.description));
  const author = flags.author ?? (await ask('Author', TEMPLATE.author));
  const rawUrl = flags.url ?? (await ask('Production URL', ''));
  const siteUrl = toSiteUrl(rawUrl);
  const namespace = await ask('Storage namespace', TEMPLATE.namespace);

  const dropDemo = await confirm('Remove the 3D demo scene (model, Draco decoder, floating shapes)?', false);
  const resetGit = await confirm('Reset git history and create the develop / main / prod branches?', false);

  if (rawUrl && !siteUrl) {
    console.warn(`${colors.yellow}⚠ "${rawUrl}" is not a valid URL, leaving the site URL unset.${colors.reset}`);
  }

  const answers = { title, slug, description, author, namespace };
  const replacements = buildReplacements(answers);

  console.info('');
  console.info(`${colors.bold}Renaming${colors.reset}`);
  for (const [from, to] of replacements) {
    console.info(`  ${colors.dim}${from}${colors.reset} -> ${colors.green}${to}${colors.reset}`);
  }
  if (replacements.length === 0) console.info(`  ${colors.dim}(nothing to rename)${colors.reset}`);
  console.info('');

  let rewritten = 0;

  for (const relativePath of REWRITE_FILES) {
    const before = read(relativePath);
    if (before === null) continue;

    const after = applyReplacements(before, replacements);
    if (after === before) continue;

    write(relativePath, after, flags.dryRun);
    rewritten++;
    console.info(`  ${colors.green}✓${colors.reset} ${relativePath}`);
  }

  if (siteUrl) {
    const envExample = read('.env.example');
    if (envExample) {
      write('.env.example', envExample.replace(/^VITE_SITE_URL=.*$/m, `VITE_SITE_URL=${siteUrl}`), flags.dryRun);
      console.info(`  ${colors.green}✓${colors.reset} .env.example ${colors.dim}(VITE_SITE_URL)${colors.reset}`);
    }

    // A local .env so `pnpm dev` works straight away. Gitignored.
    write(
      '.env',
      [
        `VITE_PROJECT_NAME="${slug}"`,
        `VITE_MAIN_WEBSITE_NAME="${namespace}"`,
        'VITE_SITE_URL=http://localhost:3000',
        ''
      ].join('\n'),
      flags.dryRun
    );
    console.info(`  ${colors.green}✓${colors.reset} .env ${colors.dim}(created)${colors.reset}`);
  }

  const packageJson = read('package.json');
  if (packageJson) {
    write('package.json', packageJson.replace(/"version":\s*"[^"]*"/, '"version": "0.0.0"'), flags.dryRun);
  }

  for (const manifest of ['config/release-please/manifest-preprod.json', 'config/release-please/manifest-prod.json']) {
    if (read(manifest) !== null) write(manifest, '{ ".": "0.0.0" }\n', flags.dryRun);
  }

  write(
    'CHANGELOG.md',
    [
      '# Changelog',
      '',
      'All notable changes to this project will be documented in this file.',
      '',
      'This changelog is automatically generated by [Release Please](https://github.com/googleapis/release-please)',
      'based on [Conventional Commits](https://www.conventionalcommits.org/).',
      ''
    ].join('\n'),
    flags.dryRun
  );

  console.info(
    `  ${colors.green}✓${colors.reset} version reset to 0.0.0 ${colors.dim}(+ manifests, CHANGELOG)${colors.reset}`
  );

  if (dropDemo) {
    for (const path of DEMO_PATHS) {
      const full = join(PROJECT_ROOT, path);
      if (!existsSync(full)) continue;
      if (!flags.dryRun) rmSync(full, { recursive: true, force: true });
      console.info(`  ${colors.red}−${colors.reset} ${path}`);
    }

    console.info('');
    console.info(`${colors.yellow}The demo is gone, two references to it are not:${colors.reset}`);
    console.info('  · src/scene/Experiences.tsx still imports DemoModel and FloatingShapes');
    console.info('  · vitest.config.ts still excludes src/scene/demo/** from coverage');
    console.info(`  ${colors.dim}Deliberate: emptying your scene graph is not this script's call.${colors.reset}`);
  }

  // ── Git ────────────────────────────────────────────────────────────────────
  if (resetGit && !flags.dryRun) {
    const { execSync } = await import('node:child_process');
    try {
      rmSync(join(PROJECT_ROOT, '.git'), { recursive: true, force: true });
      execSync('git init -b develop', { cwd: PROJECT_ROOT, stdio: 'ignore' });
      console.info('');
      console.info(
        `  ${colors.green}✓${colors.reset} git history reset, on branch ${colors.bold}develop${colors.reset}`
      );
      console.info(`  ${colors.dim}Commit, then: git branch main && git branch prod${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}✗ git init failed: ${error.message}${colors.reset}`);
    }
  }

  console.info('');
  if (flags.dryRun) {
    console.info(`${colors.yellow}Dry run: ${rewritten} file(s) would change, nothing written.${colors.reset}`);
  } else {
    console.info(`${colors.green}${colors.bold}Done.${colors.reset} ${rewritten} file(s) rewritten.`);
    console.info('');
    console.info('Next:');
    console.info(
      `  ${colors.dim}1.${colors.reset} pnpm install       ${colors.dim}# installs the git hooks${colors.reset}`
    );
    console.info(
      `  ${colors.dim}2.${colors.reset} pnpm assets:brand  ${colors.dim}# regenerate icons from your own mark${colors.reset}`
    );
    console.info(`  ${colors.dim}3.${colors.reset} pnpm dev`);
    console.info('');
    console.info(`  ${colors.dim}Then delete this script, it has done its job.${colors.reset}`);
  }
  console.info('');

  rl?.close();
}

// Only when this file is the entry point, so importing it from a test runs the exports and
// nothing else.
if (import.meta.main) await main();
