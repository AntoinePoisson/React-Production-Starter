#!/usr/bin/env node

/**
 * Pre-commit half of optimize-assets.mjs, scoped to the staged diff instead of the whole of
 * public/assets/. Re-encoding every texture in the project on each commit costs seconds nobody
 * asked to spend and touches files the commit says nothing about.
 *
 * Reports rather than stages, like the i18n hook. optimize-assets.mjs keeps a .original.{ext}
 * copy of everything it rewrites, those copies aren't gitignored, and a Draco pass is lossy.
 * So a run that rewrote anything fails the commit: check the result, delete the backups you're
 * happy with, restore the ones you aren't, then stage the assets yourself.
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

// Repo-relative, which is what git diff speaks. The hook's working directory isn't something
// this script gets to assume.
const ASSETS_PREFIX = `${path.relative(PROJECT_ROOT, CONFIG.assetsDir).split(path.sep).join('/')}/`;

/** The backup optimize-assets.mjs writes beside a file before rewriting it. */
const backupPathFor = (filePath) => {
  const extension = path.extname(filePath);

  return path.join(path.dirname(filePath), `${path.basename(filePath, extension)}.original${extension}`);
};

/**
 * Added/copied/modified only. A deletion has nothing left to optimise and a rename reaches this
 * list as its destination.
 *
 * -z and a NUL split rather than lines: git diff --name-only quotes and escapes any path holding
 * a space or a non-ASCII byte, and an asset called `dépliant final.png` isn't exotic.
 */
const stagedFiles = () => git('diff', '--cached', '--name-only', '--diff-filter=ACM', '-z').split('\0').filter(Boolean);

const isOptimisable = (relativePath) => {
  if (!relativePath.startsWith(ASSETS_PREFIX)) return false;

  const name = path.basename(relativePath);
  // A backup isn't an input. Feeding one back in optimises the copy kept to undo the optimisation.
  if (name.includes('.original.')) return false;

  const extension = path.extname(name).toLowerCase();

  return CONFIG.modelExtensions.includes(extension) || CONFIG.imageExtensions.includes(extension);
};

async function main() {
  const staged = stagedFiles();

  // A staged backup gets rejected whoever created it: this run, or a `pnpm optimize-assets` from
  // earlier in the day.
  const stagedBackups = staged.filter((file) => path.basename(file).includes('.original.'));

  const targets = staged.filter(isOptimisable);

  if (targets.length === 0 && stagedBackups.length === 0) {
    console.info(`${colors.green}✅${colors.reset} No staged assets to optimize`);

    return 0;
  }

  const rewritten = [];

  for (const relativePath of targets) {
    const fullPath = path.join(PROJECT_ROOT, relativePath);

    // Staged but gone from the working tree. optimize-assets.mjs reads disk, not the index.
    if (!existsSync(fullPath)) continue;

    console.info(`\n${colors.blue}→${colors.reset} ${relativePath}`);

    const extension = path.extname(relativePath).toLowerCase();
    const result = CONFIG.modelExtensions.includes(extension)
      ? await optimizeModel(fullPath)
      : await optimizeImage(fullPath);

    // Anything else left no backup behind: a skip discards the copy it took, a failed encode
    // restores from it and then discards it.
    if (!result.skipped && !result.error) rewritten.push(relativePath);
  }

  if (rewritten.length === 0 && stagedBackups.length === 0) {
    console.info(`\n${colors.green}✅${colors.reset} Staged assets are already optimized`);

    return 0;
  }

  console.error('');

  if (rewritten.length > 0) {
    console.error(`${colors.red}❌ Staged assets were rewritten. Review them before committing.${colors.reset}`);
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
