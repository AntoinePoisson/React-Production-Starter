#!/usr/bin/env node

/**
 * Optimizes images (.jpg, .jpeg, .png, .webp) and 3D models (.glb, .gltf) under public/assets/.
 * Everything runs locally through sharp and gltf-transform, nothing is uploaded anywhere.
 *
 * Originals are kept beside the file as .original.{ext} and already-optimized files are skipped.
 *
 * CONFIG, optimizeModel and optimizeImage are exported for optimize-staged-assets.mjs, which
 * runs the same per-file work over the staged diff instead of the whole tree.
 *
 * Usage:
 *   pnpm optimize-assets                      # everything
 *   node scripts/optimize-assets.mjs models   # only models
 *   node scripts/optimize-assets.mjs textures # only images
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'public/assets');

export const CONFIG = {
  assetsDir: ASSETS_DIR,
  modelExtensions: ['.glb', '.gltf'],
  imageExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  skipIfOriginalExists: true,
  // 82 is the usual sweet spot for photographic content. A texture headed for a GPU gets
  // resampled anyway, so going higher mostly buys file size.
  jpegQuality: 82,
  webpQuality: 82,
  pngCompressionLevel: 9,
  pngEffort: 10
};

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

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

async function getFileSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

/**
 * Undoes a backup this run created. The copy has to be taken before the work starts (sharp can't
 * safely write to the file it's reading from) but plenty of runs then write nothing, and leaving
 * the copy behind makes skipIfOriginalExists skip the file forever.
 *
 * restore also copies the backup back over the target, for an encode that threw mid-write.
 * A backup that existed before this run is left alone, it isn't ours.
 */
async function discardBackup(backup, filePath, { restore = false } = {}) {
  if (backup.existed) return;

  try {
    if (restore) await fs.copyFile(backup.path, filePath);
    await fs.unlink(backup.path);
  } catch {
    // Best effort, a failed cleanup shouldn't fail the run.
  }
}

async function createBackup(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const basename = path.basename(filePath, ext);
  const backupPath = path.join(dir, `${basename}.original${ext}`);

  try {
    await fs.access(backupPath);
    return { existed: true, path: backupPath };
  } catch {
    await fs.copyFile(filePath, backupPath);
    return { existed: false, path: backupPath };
  }
}

export async function optimizeModel(filePath) {
  const originalSize = await getFileSize(filePath);
  const backup = await createBackup(filePath);

  if (backup.existed && CONFIG.skipIfOriginalExists) {
    console.info(`  ${colors.yellow}⏭  Skipped${colors.reset} (already optimized)`);
    return { skipped: true, originalSize, newSize: originalSize };
  }

  try {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule()
    });

    const document = await io.read(filePath);

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

    // Same guard as optimizeImage. An already-quantised model, or one small enough that the
    // Draco header costs more than it saves, comes out bigger.
    //
    // Only for .glb: it's a single self-contained file, so comparing in memory is exact. A .gltf
    // writes sibling files (.bin, textures) whose total is what actually changed, so that path
    // keeps writing unconditionally.
    const isBinary = path.extname(filePath).toLowerCase() === '.glb';

    if (isBinary) {
      const output = Buffer.from(await io.writeBinary(document));

      if (output.length >= originalSize) {
        console.info(`  ${colors.yellow}⏭  Skipped${colors.reset} (already optimal)`);
        // Nothing written, so nothing to back up.
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
 * In place, keeping the format. A .png with transparency re-encoded as JPEG loses the alpha
 * channel, and a texture referenced by a .gltf can't change extension without editing the model.
 * Converting to WebP/AVIF is a separate decision.
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
    // Read from the backup, sharp can't safely write to the file it's still reading.
    const pipeline = sharp(backup.path);

    if (extension === '.png') {
      pipeline.png({ compressionLevel: CONFIG.pngCompressionLevel, effort: CONFIG.pngEffort });
    } else if (extension === '.webp') {
      pipeline.webp({ quality: CONFIG.webpQuality });
    } else {
      pipeline.jpeg({ quality: CONFIG.jpegQuality, mozjpeg: true });
    }

    const output = await pipeline.toBuffer();

    // Some assets are already optimal, writing a larger file back is a regression.
    if (output.length >= originalSize) {
      console.info(`  ${colors.yellow}⏭  Skipped${colors.reset} (already optimal)`);
      // Nothing written, so nothing to back up.
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

async function optimizeAssets(type = 'all') {
  console.info(`${colors.bright}${colors.blue}🚀 Asset Optimization${colors.reset}\n`);

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

  if (stats.models.optimized > 0 || stats.images.optimized > 0) {
    console.info(`${colors.bright}ℹ️  Note:${colors.reset} Original files backed up with .original.{ext} extension`);
    console.info(`${colors.bright}ℹ️  To restore:${colors.reset} Rename .original files back to original names\n`);
  }
}

// Only runs when this file is the entry point, so importing it optimizes nothing.
if (import.meta.main) {
  // 'all', 'models', or 'textures'
  const type = process.argv[2] || 'all';

  optimizeAssets(type).catch((error) => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  });
}
