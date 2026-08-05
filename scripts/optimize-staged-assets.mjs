#!/usr/bin/env node

/**
 * Optimises the assets in the staged diff — the pre-commit half of `optimize-assets.mjs`, which
 * walks the whole of `public/assets/` instead.
 *
 * Scoped to what is staged for the same reason the whole hook is scoped to development branches:
 * re-encoding every texture in the project on every commit costs seconds nobody asked to spend,
 * and touches files the commit says nothing about.
 *
 * It reports rather than stages, like the i18n hook. `optimize-assets.mjs` keeps a `.original.{ext}`
 * copy of every file it rewrites, those copies are not git-ignored, and a Draco pass is lossy —
 * quantisation is not something to discover in a diff of a binary. So a run that rewrote anything
 * fails the commit: look at the result, delete the backups you are happy with, restore the ones you
 * are not, and stage the assets yourself.
 *
 * Usage: node scripts/optimize-staged-assets.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { CONFIG, optimizeImage, optimizeModel } from './optimize-assets.mjs';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

const git = (...args) => execFileSync('git', args, { encoding: 'utf-8' });

const PROJECT_ROOT = git('rev-parse', '--show-toplevel').trim();

// Repository-relative, which is what `git diff` speaks: the hook's working directory is not
// something this script gets to assume.
const ASSETS_PREFIX = `${path.relative(PROJECT_ROOT, CONFIG.assetsDir).split(path.sep).join('/')}/`;

/** The backup `optimize-assets.mjs` writes beside a file before rewriting it. */
const backupPathFor = (filePath) => {
  const extension = path.extname(filePath);

  return path.join(path.dirname(filePath), `${path.basename(filePath, extension)}.original${extension}`);
};

/**
 * Staged paths, added/copied/modified only. A deletion has nothing left to optimise, and a
 * rename reaches this list as its destination.
 *
 * `-z` and a NUL split rather than lines: `git diff --name-only` quotes and escapes any path
 * holding a space or a non-ASCII byte, and an asset named `dépliant final.png` is not exotic.
 */
const stagedFiles = () => git('diff', '--cached', '--name-only', '--diff-filter=ACM', '-z').split('\0').filter(Boolean);

const isOptimisable = (relativePath) => {
  if (!relativePath.startsWith(ASSETS_PREFIX)) return false;

  const name = path.basename(relativePath);
  // A backup is not an input. Feeding one back in would optimise the copy kept to undo the
  // optimisation.
  if (name.includes('.original.')) return false;

  const extension = path.extname(name).toLowerCase();

  return CONFIG.modelExtensions.includes(extension) || CONFIG.imageExtensions.includes(extension);
};

async function main() {
  const staged = stagedFiles();

  // Committing a backup is the very thing the failure below exists to prevent, so a staged one is
  // rejected whoever created it — this run, or a `pnpm optimize-assets` earlier in the afternoon.
  const stagedBackups = staged.filter((file) => path.basename(file).includes('.original.'));

  const targets = staged.filter(isOptimisable);

  if (targets.length === 0 && stagedBackups.length === 0) {
    console.info(`${colors.green}✅${colors.reset} No staged assets to optimize`);

    return 0;
  }

  const rewritten = [];

  for (const relativePath of targets) {
    const fullPath = path.join(PROJECT_ROOT, relativePath);

    // Staged, but gone from the working tree — `optimize-assets.mjs` reads the disk, not the index.
    if (!existsSync(fullPath)) continue;

    console.info(`\n${colors.blue}→${colors.reset} ${relativePath}`);

    const extension = path.extname(relativePath).toLowerCase();
    const result = CONFIG.modelExtensions.includes(extension)
      ? await optimizeModel(fullPath)
      : await optimizeImage(fullPath);

    // Anything else left no backup behind: a skip discards the copy it took, and a failed encode
    // restores from it and then discards it.
    if (!result.skipped && !result.error) rewritten.push(relativePath);
  }

  if (rewritten.length === 0 && stagedBackups.length === 0) {
    console.info(`\n${colors.green}✅${colors.reset} Staged assets are already optimized`);

    return 0;
  }

  console.error('');

  if (rewritten.length > 0) {
    console.error(`${colors.red}❌ Staged assets were rewritten — review them before committing.${colors.reset}`);
    console.error('');
    console.error(`   ${colors.bright}Optimized in place, with the original kept beside it:${colors.reset}`);
    for (const file of rewritten) {
      console.error(`     ${file}  ${colors.yellow}→ ${path.basename(backupPathFor(file))}${colors.reset}`);
    }
    console.error('');
    console.error('   Check the result, then either keep it and delete the .original file, or');
    console.error('   restore the .original over it. Stage the assets and commit again.');
  }

  if (stagedBackups.length > 0) {
    console.error(`${colors.red}❌ A .original backup is staged. These are working copies, not assets.${colors.reset}`);
    console.error('');
    for (const file of stagedBackups) console.error(`     ${file}`);
    console.error('');
    console.error('   Unstage it (git restore --staged), then delete it or keep it out of the commit.');
  }

  console.error('');

  return 1;
}

process.exitCode = await main();
