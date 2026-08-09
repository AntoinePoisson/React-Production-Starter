#!/usr/bin/env node

/**
 * Regenerates every raster brand asset from one vector source. A script rather than a folder of
 * hand-exported PNGs because "export eight sizes, remember the maskable safe zone, remember the
 * OG aspect ratio" is the step everyone skips. Edit MARK and COLORS below and rerun.
 *
 * Produces:
 *   public/icons/favicon-32x32.png            browser tab (legacy raster path)
 *   public/icons/apple-touch-icon.png    180  iOS home screen, opaque, no transparency
 *   public/icons/icon-192x192.png        192  manifest, purpose "any"
 *   public/icons/icon-512x512.png        512  manifest, purpose "any"
 *   public/icons/icon-192-maskable.png   192  manifest, purpose "maskable"
 *   public/icons/icon-512-maskable.png   512  manifest, purpose "maskable"
 *   public/og-image.png             1200x630  Open Graph / Twitter card
 *   public/favicon.ico              16/32/48  legacy tab icon
 *
 * Usage: pnpm assets:brand
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIR = join(PROJECT_ROOT, 'public/icons');
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');

/**
 * Mirrors the @theme static tokens in globals.css. Literals rather than parsed out of the CSS:
 * this runs in Node with no stylesheet to resolve, and a build asset that silently changed colour
 * because a token moved would be worse than an obvious duplicate.
 */
const COLORS = {
  ink: '#0f172a',
  accent: '#6b8cfa',
  skyTop: '#c9dcf0',
  skyHorizon: '#e9eef2'
};

// Drawn in a 100x100 box so every size below is one scale factor away. Geometric and text-free
// on purpose, text would need a font file committed to the repo to render the same everywhere.
const MARK = (fill) => `<path fill="${fill}" d="M50 18 84 76H16L50 18Z"/>`;

// Maskable icons get masked to a circle, a squircle or a rounded square depending on the
// launcher, and only the central 80% circle is guaranteed visible. 55% keeps the mark clear of
// every mask, at the cost of looking smaller than the "any" variant. Hence two separate files.
const MASKABLE_MARK_RATIO = 0.55;
const STANDARD_MARK_RATIO = 0.72;

const svgIcon = ({ size, background, markRatio, rounded }) => {
  const markSize = size * markRatio;
  const offset = (size - markSize) / 2;
  const radius = rounded ? size * 0.22 : 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/>
  <g transform="translate(${offset} ${offset}) scale(${markSize / 100})">${MARK(COLORS.accent)}</g>
</svg>`;
};

const svgOgImage = () => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.skyTop}"/>
      <stop offset="62%" stop-color="${COLORS.skyHorizon}"/>
      <stop offset="100%" stop-color="${COLORS.skyHorizon}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#sky)"/>
  <!-- Mark and rule are centred as a group, not each on its own, otherwise the rule reads as a
       stray element on a very empty canvas. -->
  <g transform="translate(490 190) scale(2.2)">${MARK(COLORS.accent)}</g>
  <rect x="530" y="418" width="140" height="6" rx="3" fill="${COLORS.ink}" opacity="0.18"/>
</svg>`;

/** Max compression, these ship on every share and every install. */
const toPng = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, effort: 10 }).toBuffer();

const OUTPUTS = [
  {
    file: join(ICONS_DIR, 'favicon-32x32.png'),
    svg: () => svgIcon({ size: 32, background: COLORS.ink, markRatio: STANDARD_MARK_RATIO, rounded: true })
  },
  {
    // iOS composites onto white and applies its own rounding, so this one stays opaque and
    // square. Rounding it here produces visible corners on the home screen.
    file: join(ICONS_DIR, 'apple-touch-icon.png'),
    svg: () => svgIcon({ size: 180, background: COLORS.ink, markRatio: STANDARD_MARK_RATIO, rounded: false })
  },
  {
    file: join(ICONS_DIR, 'icon-192x192.png'),
    svg: () => svgIcon({ size: 192, background: COLORS.ink, markRatio: STANDARD_MARK_RATIO, rounded: true })
  },
  {
    file: join(ICONS_DIR, 'icon-512x512.png'),
    svg: () => svgIcon({ size: 512, background: COLORS.ink, markRatio: STANDARD_MARK_RATIO, rounded: true })
  },
  {
    file: join(ICONS_DIR, 'icon-192-maskable.png'),
    svg: () => svgIcon({ size: 192, background: COLORS.ink, markRatio: MASKABLE_MARK_RATIO, rounded: false })
  },
  {
    file: join(ICONS_DIR, 'icon-512-maskable.png'),
    svg: () => svgIcon({ size: 512, background: COLORS.ink, markRatio: MASKABLE_MARK_RATIO, rounded: false })
  },
  {
    file: join(PUBLIC_DIR, 'og-image.png'),
    svg: svgOgImage
  }
];

/**
 * sharp cant write ICO and pulling a dependancy in for a 22-line container format seemed silly.
 * Modern ICO entries may hold a PNG payload verbatim, supported by every browser still getting
 * updates, so this only has to write the directory header.
 *
 * Layout: 6-byte ICONDIR, one 16-byte ICONDIRENTRY per image, then the payloads.
 */
function packIco(images) {
  const HEADER_BYTES = 6;
  const ENTRY_BYTES = 16;

  const header = Buffer.alloc(HEADER_BYTES);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon (2 would be a cursor)
  header.writeUInt16LE(images.length, 4);

  let offset = HEADER_BYTES + ENTRY_BYTES * images.length;

  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(ENTRY_BYTES);
    // 0 means 256 in this field, which is why it is a single byte.
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette size, 0 for truecolour
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
}

/** The sizes a .ico actually gets consulted for: tab, taskbar, the odd legacy shortcut. */
const ICO_SIZES = [16, 32, 48];

const colors = { reset: '\x1b[0m', green: '\x1b[32m', blue: '\x1b[36m' };
const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

await mkdir(ICONS_DIR, { recursive: true });

for (const { file, svg } of OUTPUTS) {
  const buffer = await toPng(svg());
  await writeFile(file, buffer);
  console.info(`${colors.green}✓${colors.reset} ${file.replace(`${PROJECT_ROOT}/`, '')} ${formatBytes(buffer.length)}`);
}

// public/ is copied through verbatim, so this lands at /favicon.ico.
const icoImages = await Promise.all(
  ICO_SIZES.map(async (size) => ({
    size,
    data: await toPng(svgIcon({ size, background: COLORS.ink, markRatio: STANDARD_MARK_RATIO, rounded: true }))
  }))
);
const ico = packIco(icoImages);
await writeFile(join(PUBLIC_DIR, 'favicon.ico'), ico);
console.info(`${colors.green}✓${colors.reset} public/favicon.ico ${formatBytes(ico.length)} (${ICO_SIZES.join('/')})`);

console.info(
  `\n${colors.blue}Placeholders regenerated.${colors.reset} Replace MARK and COLORS above with your own\n` +
    `artwork, then rerun. The maskable variants keep the mark inside the central 80% circle,\n` +
    `check any replacement against https://maskable.app before shipping it.\n`
);
