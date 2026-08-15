#!/usr/bin/env node

/**
 * Same as optimize-assets.mjs, but only the staged files. Don't re-encode
 * the whole tree on every commit.
 *
 * Reports, doesn't stage (same idea as the i18n hook). .original copies aren't
 * gitignored and Draco is lossy, so if anything was rewritten the commit fails:
 * check, drop the backups you like, restore the ones you don't, then `git add`.
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

// Repo-relative — that's what git diff speaks. Don't assume cwd.
const ASSETS_PREFIX = `${path.relative(PROJECT_ROOT, CONFIG.assetsDir).split(path.sep).join('/')}/`;

/** Backup written next to a file before it's rewritten. */
const backupPathFor = (filePath) => {
  const extension = path.extname(filePath);

  return path.join(path.dirname(filePath), `${path.basename(filePath, extension)}.original${extension}`);
};

/**
 * Added / copied / modified. A delete has nothing left to crush; a rename
 * shows up as its destination.
 *
 * -z + NUL split. `git diff --name-only` quotes paths with spaces, and
 * `dépliant final.png` isn't that exotic.
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
