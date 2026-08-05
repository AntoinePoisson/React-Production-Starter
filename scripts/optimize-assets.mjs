#!/usr/bin/env node

/**
 * Asset Optimization Script
 *
 * Optimizes images (.jpg, .jpeg, .png, .webp) and 3D models (.glb, .gltf) under
 * public/assets/.
 *
 * Features:
 * - Image optimization with sharp — local, offline, no API key, no upload
 * - GLTF/GLB optimization with Draco compression (60-70% size reduction)
 * - Preserves original files with .original.{ext} naming
 * - Skips already optimized files
 * - Displays size reduction statistics
 *
 * This used to call the TinyPNG API, which meant an account, a key in `.env`, a network
 * round trip per file, a monthly quota, and every texture in the project being uploaded to
 * a third party. `sharp` is already in the tree (it renders the brand assets) and does the
 * same job locally.
 *
 * Scope note: it walks `public/assets/` as a whole, not just `public/assets/models/`. The
 * old path meant `textures` mode looked for images inside the models folder, so a texture
 * anywhere else was never touched.
 *
 * `CONFIG`, `optimizeModel` and `optimizeImage` are exported for
 * `scripts/optimize-staged-assets.mjs`, which runs the same per-file work over the staged diff
 * instead of over the whole tree. Everything below `import.meta.main` only runs when this file
 * is the entry point, so importing it optimises nothing.
 *
 * Usage:
 *   pnpm optimize-assets # Optimize all assets (recommended)
 *   node scripts/optimize-assets.mjs all # Optimize all
 *   node scripts/optimize-assets.mjs models # Only models
 *   node scripts/optimize-assets.mjs textures # Only images
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, dedup, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'public/assets');

// Configuration
export const CONFIG = {
  assetsDir: ASSETS_DIR,
  modelExtensions: ['.glb', '.gltf'],
  imageExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  skipIfOriginalExists: true, // Skip optimization if .original file exists
  /**
   * Quality settings.
   *
   * 82 is the usual sweet spot for photographic content; textures destined for a GPU are
   * resampled anyway, so pushing higher mostly buys file size. `effort` trades encode time
   * for a few percent — worth it for an asset committed once and served forever.
   */
  jpegQuality: 82,
  webpQuality: 82,
  pngCompressionLevel: 9,
  pngEffort: 10
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

/**
 * Get all files recursively from a directory
 */
async function getAllFiles(dirPath, extensions) {
  const files = [];

  async function scan(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext) && !entry.name.includes('.original.')) {
          files.push(fullPath);
        }
      }
    }
  }

  await scan(dirPath);
  return files;
}

/**
 * Get file size in bytes
 */
async function getFileSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

/**
 * Undo a backup this run created, leaving the tree exactly as it was found.
 *
 * The backup has to be taken *before* the work starts — sharp cannot safely write to the
 * file it is reading from — but plenty of runs then decide to write nothing: an asset that
 * is already optimal, or one whose encode threw. Leaving the copy behind in those cases is
 * not harmless: `skipIfOriginalExists` reads it as proof the file was already processed, so
 * every later run skips it and the retry never happens — and a byte-identical duplicate is
 * left in the working tree for someone to commit.
 *
 * `restore` also copies the backup back over the target: an encode that threw mid-write
 * leaves a truncated file, and the whole point of taking the copy was to be able to undo
 * that. A backup that already existed before this run is left alone — it is not ours.
 */
async function discardBackup(backup, filePath, { restore = false } = {}) {
  if (backup.existed) return;

  try {
    if (restore) await fs.copyFile(backup.path, filePath);
    await fs.unlink(backup.path);
  } catch {
    // Best effort: failing to clean up a backup must not fail the optimization run.
  }
}

/**
 * Create backup of original file
 */
async function createBackup(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const basename = path.basename(filePath, ext);
  const backupPath = path.join(dir, `${basename}.original${ext}`);

  // Check if backup already exists
  try {
    await fs.access(backupPath);
    return { existed: true, path: backupPath };
  } catch {
    // Backup doesn't exist, create it
    await fs.copyFile(filePath, backupPath);
    return { existed: false, path: backupPath };
  }
}

/**
 * Optimize GLTF/GLB model with Draco compression
 */
export async function optimizeModel(filePath) {
  const originalSize = await getFileSize(filePath);
  const backup = await createBackup(filePath);

  if (backup.existed && CONFIG.skipIfOriginalExists) {
    console.info(`  ${colors.yellow}⏭  Skipped${colors.reset} (already optimized)`);
    return { skipped: true, originalSize, newSize: originalSize };
  }

  try {
    // Initialize IO with Draco support
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule()
    });

    const document = await io.read(filePath);

    // Apply optimizations
    await document.transform(
      dedup(), // Remove duplicate vertex data
      prune(), // Remove unused data
      draco({
        method: 'edgebreaker',
        encodeSpeed: 5,
        decodeSpeed: 5,
        quantizePosition: 14,
        quantizeNormal: 10,
        quantizeTexcoord: 12,
        quantizeColor: 8,
        quantizeGeneric: 12
      })
    );

    /**
     * Same guard as `optimizeImage`: a model that is already quantised, or small enough
     * that the Draco header outweighs what it saves, comes out bigger — and writing that
     * back is a regression dressed up as an optimization. `skipIfOriginalExists` would
     * then make every later run skip the file, so the regression is permanent.
     *
     * `.glb` is a single self-contained file, so serialising it in memory and comparing
     * is exact. A `.gltf` writes a set of sibling files (`.bin`, textures) whose total is
     * what actually changed, and comparing only the JSON would be meaningless — so that
     * path keeps writing unconditionally. Prefer `.glb`: this script never converts one
     * form to the other, it writes back over whatever it was given.
     */
    const isBinary = path.extname(filePath).toLowerCase() === '.glb';

    if (isBinary) {
      const output = Buffer.from(await io.writeBinary(document));

      if (output.length >= originalSize) {
        console.info(`  ${colors.yellow}⏭  Skipped${colors.reset} (already optimal)`);
        // Nothing was written, so nothing needs backing up.
        await discardBackup(backup, filePath);
        return { skipped: true, originalSize, newSize: originalSize };
      }

      await fs.writeFile(filePath, output);
    } else {
      await io.write(filePath, document);
    }

    const newSize = await getFileSize(filePath);
    const saved = originalSize - newSize;
    const percent = ((saved / originalSize) * 100).toFixed(1);

    console.info(
      `  ${colors.green}✓ Optimized${colors.reset} ${formatBytes(originalSize)} → ${formatBytes(newSize)} (${colors.green}-${percent}%${colors.reset})`
    );

    return { skipped: false, originalSize, newSize, saved, percent };
  } catch (error) {
    console.error(`  ${colors.red}✗ Error:${colors.reset} ${error.message}`);
    await discardBackup(backup, filePath, { restore: true });
    return { skipped: false, error: true, originalSize, newSize: originalSize };
  }
}

/**
 * Optimize an image in place with sharp, keeping its format.
 *
 * Format-preserving on purpose: a `.png` with transparency re-encoded as JPEG loses the
 * alpha channel, and a texture referenced by a `.gltf` cannot change extension without
 * editing the model. Converting to WebP/AVIF is a separate, deliberate decision.
 */
export async function optimizeImage(filePath) {
  const originalSize = await getFileSize(filePath);
  const backup = await createBackup(filePath);

  if (backup.existed && CONFIG.skipIfOriginalExists) {
    console.info(`  ${colors.yellow}⏭  Skipped${colors.reset} (already optimized)`);
    return { skipped: true, originalSize, newSize: originalSize };
  }

  try {
    const extension = path.extname(filePath).toLowerCase();
    // Read from the backup, not the target: sharp cannot safely write to the file it is
    // still reading from.
    const pipeline = sharp(backup.path);

    if (extension === '.png') {
      pipeline.png({ compressionLevel: CONFIG.pngCompressionLevel, effort: CONFIG.pngEffort });
    } else if (extension === '.webp') {
      pipeline.webp({ quality: CONFIG.webpQuality });
    } else {
      pipeline.jpeg({ quality: CONFIG.jpegQuality, mozjpeg: true });
    }

    const output = await pipeline.toBuffer();

    // Some assets are already optimal. Writing a larger file back would be a regression
    // dressed up as an optimization.
    if (output.length >= originalSize) {
      console.info(`  ${colors.yellow}⏭  Skipped${colors.reset} (already optimal)`);
      // Nothing was written, so nothing needs backing up.
      await discardBackup(backup, filePath);
      return { skipped: true, originalSize, newSize: originalSize };
    }

    await fs.writeFile(filePath, output);

    const newSize = output.length;
    const saved = originalSize - newSize;
    const percent = ((saved / originalSize) * 100).toFixed(1);

    console.info(
      `  ${colors.green}✓ Optimized${colors.reset} ${formatBytes(originalSize)} → ${formatBytes(newSize)} (${colors.green}-${percent}%${colors.reset})`
    );

    return { skipped: false, originalSize, newSize, saved, percent };
  } catch (error) {
    console.error(`  ${colors.red}✗ Error:${colors.reset} ${error.message}`);
    await discardBackup(backup, filePath, { restore: true });
    return { skipped: false, error: true, originalSize, newSize: originalSize };
  }
}

/**
 * Main optimization function
 */
async function optimizeAssets(type = 'all') {
  console.info(`${colors.bright}${colors.blue}🚀 Asset Optimization${colors.reset}\n`);

  // Check if assets directory exists
  try {
    await fs.access(CONFIG.assetsDir);
  } catch {
    console.error(`${colors.red}Error: Assets directory not found: ${CONFIG.assetsDir}${colors.reset}`);
    process.exit(1);
  }

  const stats = {
    models: { total: 0, optimized: 0, skipped: 0, errors: 0, savedBytes: 0 },
    images: { total: 0, optimized: 0, skipped: 0, errors: 0, savedBytes: 0 }
  };

  // Optimize models
  if (type === 'all' || type === 'models') {
    console.info(`${colors.bright}📦 Optimizing 3D Models${colors.reset}`);
    const modelFiles = await getAllFiles(CONFIG.assetsDir, CONFIG.modelExtensions);
    stats.models.total = modelFiles.length;

    if (modelFiles.length === 0) {
      console.info(`  ${colors.yellow}No model files found${colors.reset}\n`);
    } else {
      for (const file of modelFiles) {
        const relativePath = path.relative(PROJECT_ROOT, file);
        console.info(`\n${colors.blue}→${colors.reset} ${relativePath}`);

        const result = await optimizeModel(file);
        if (result.skipped) stats.models.skipped++;
        else if (result.error) stats.models.errors++;
        else {
          stats.models.optimized++;
          stats.models.savedBytes += result.saved || 0;
        }
      }
      console.info('');
    }
  }

  // Optimize images
  if (type === 'all' || type === 'textures') {
    console.info(`${colors.bright}🖼️  Optimizing Images${colors.reset}`);
    const imageFiles = await getAllFiles(CONFIG.assetsDir, CONFIG.imageExtensions);
    stats.images.total = imageFiles.length;

    if (imageFiles.length === 0) {
      console.info(`  ${colors.yellow}No image files found${colors.reset}\n`);
    } else {
      for (const file of imageFiles) {
        const relativePath = path.relative(PROJECT_ROOT, file);
        console.info(`\n${colors.blue}→${colors.reset} ${relativePath}`);

        const result = await optimizeImage(file);
        if (result.skipped) stats.images.skipped++;
        else if (result.error) stats.images.errors++;
        else {
          stats.images.optimized++;
          stats.images.savedBytes += result.saved || 0;
        }
      }
      console.info('');
    }
  }

  // Print summary
  console.info(`${colors.bright}📊 Summary${colors.reset}`);
  console.info('─'.repeat(50));

  if (type === 'all' || type === 'models') {
    console.info(`${colors.bright}Models:${colors.reset}`);
    console.info(`  Total: ${stats.models.total}`);
    console.info(`  Optimized: ${colors.green}${stats.models.optimized}${colors.reset}`);
    console.info(`  Skipped: ${colors.yellow}${stats.models.skipped}${colors.reset}`);
    console.info(`  Errors: ${colors.red}${stats.models.errors}${colors.reset}`);
    console.info(`  Saved: ${colors.green}${formatBytes(stats.models.savedBytes)}${colors.reset}`);
  }

  if (type === 'all' || type === 'textures') {
    console.info(`${colors.bright}Images:${colors.reset}`);
    console.info(`  Total: ${stats.images.total}`);
    console.info(`  Optimized: ${colors.green}${stats.images.optimized}${colors.reset}`);
    console.info(`  Skipped: ${colors.yellow}${stats.images.skipped}${colors.reset}`);
    console.info(`  Errors: ${colors.red}${stats.images.errors}${colors.reset}`);
    console.info(`  Saved: ${colors.green}${formatBytes(stats.images.savedBytes)}${colors.reset}`);
  }

  const totalSaved = stats.models.savedBytes + stats.images.savedBytes;
  console.info('─'.repeat(50));
  console.info(`${colors.bright}${colors.green}Total Saved: ${formatBytes(totalSaved)}${colors.reset}\n`);

  // Show note about originals
  if (stats.models.optimized > 0 || stats.images.optimized > 0) {
    console.info(`${colors.bright}ℹ️  Note:${colors.reset} Original files backed up with .original.{ext} extension`);
    console.info(`${colors.bright}ℹ️  To restore:${colors.reset} Rename .original files back to original names\n`);
  }
}

// ─── Below here only runs when the script is executed, not when it is imported ──
if (import.meta.main) {
  // 'all', 'models', or 'textures'
  const type = process.argv[2] || 'all';

  optimizeAssets(type).catch((error) => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  });
}
