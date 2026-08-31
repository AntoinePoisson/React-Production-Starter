#!/usr/bin/env node

/**
 * Regenerates every raster brand asset from public/icons/favicon.svg. A script rather than a
 * folder of hand-exported PNGs because "export eight sizes, remember the maskable safe zone,
 * remember the OG aspect ratio" is the step everyone skips.
 *
 * Replace the mark in favicon.svg and rerun. That file is the tab icon the browser actually
 * loads, so generating the rasters from anything else lets the two drift apart.
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

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIR = join(PROJECT_ROOT, 'public/icons');
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
const MARK_SOURCE = join(ICONS_DIR, 'favicon.svg');

/**
 * Mirrors the @theme static tokens in globals.css. Literals rather than parsed out of the CSS:
 * this runs in Node with no stylesheet to resolve, and a build asset that silently changed colour
 * because a token moved would be worse than an obvious duplicate.
 */
const COLORS = {
  ink: '#0f172a',
  accent: '#6b8cfa',
  ground: '#e9eef2'
};

const TITLE = 'React App Fondation';

/**
 * Only the .fg path is read. The background rect and the prefers-color-scheme block stay with the
 * SVG: a PNG has no theme, and each raster draws its own ground below.
 */
async function readMark() {
  const svg = await readFile(MARK_SOURCE, 'utf-8');
  const box = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  // Two passes, so the attribute order inside the tag doesn't matter.
  const tag = svg.match(/<path\b[^>]*class="fg"[^>]*>/)?.[0];
  const path = tag?.match(/\sd="([^"]+)"/)?.[1];

  if (!box || box[1] !== box[2] || !path) {
    throw new Error(`${MARK_SOURCE} needs a square viewBox and a <path class="fg" d="…"> mark.`);
  }

  return { box: Number(box[1]), path };
}

const MARK = await readMark();

/**
 * Scales the source viewBox, not the mark: favicon.svg carries its own padding, so the visible
 * mark ends up smaller than these numbers suggest. Maskable icons get masked to a circle, a
 * squircle or a rounded square depending on the launcher, and only the central 80% circle is
 * guaranteed visible — hence a second, tighter variant rather than one shared file.
 */
const MASKABLE_SCALE = 0.7;
const STANDARD_SCALE = 0.92;

const markLayer = (size, scale) => {
  const drawn = size * scale;
  const offset = (size - drawn) / 2;

  return `<g transform="translate(${offset} ${offset}) scale(${drawn / MARK.box})"><path fill="${COLORS.accent}" d="${MARK.path}"/></g>`;
};

const iconLayer = ({ size, scale, rounded, x = 0, y = 0 }) =>
  `<g transform="translate(${x} ${y})">
    <rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="${COLORS.ink}"/>
    ${markLayer(size, scale)}
  </g>`;

const svgIcon = ({ size, scale, rounded }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${iconLayer({ size, scale, rounded })}</svg>`;

const OG_SIZE = { width: 1200, height: 630 };
const OG_MARGIN = 100;
const OG_ICON = 160;
const OG_GAP = 48;

/**
 * The app icon and the name, on a flat ground. Nothing else: og:description already carries the
 * sentence, and a second copy inside the image only goes stale.
 *
 * One text element, no committed font file, so the wordmark renders with whatever the machine
 * running this resolves. The PNG is committed, so that machine is the author's and never CI.
 */
function svgOgImage() {
  const textX = OG_MARGIN + OG_ICON + OG_GAP;
  // Arial Bold averages ~0.56em per character. Rough, but enough to keep a long project name
  // inside the canvas without font metrics to measure with.
  const available = OG_SIZE.width - textX - OG_MARGIN;
  const fontSize = Math.min(62, Math.floor(available / (TITLE.length * 0.56)));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE.width}" height="${OG_SIZE.height}" viewBox="0 0 ${OG_SIZE.width} ${OG_SIZE.height}">
  <rect width="${OG_SIZE.width}" height="${OG_SIZE.height}" fill="${COLORS.ground}"/>
  ${iconLayer({ size: OG_ICON, scale: STANDARD_SCALE, rounded: true, x: OG_MARGIN, y: (OG_SIZE.height - OG_ICON) / 2 })}
  <text x="${textX}" y="${OG_SIZE.height / 2 + fontSize * 0.35}" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="-2">${TITLE}</text>
</svg>`;
}

/** Max compression, these ship on every share and every install. */
const toPng = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, effort: 10 }).toBuffer();

const OUTPUTS = [
  {
    file: join(ICONS_DIR, 'favicon-32x32.png'),
    svg: () => svgIcon({ size: 32, scale: STANDARD_SCALE, rounded: true })
  },
  {
    // iOS composites onto white and applies its own rounding, so this one stays opaque and
    // square. Rounding it here produces visible corners on the home screen.
    file: join(ICONS_DIR, 'apple-touch-icon.png'),
    svg: () => svgIcon({ size: 180, scale: STANDARD_SCALE, rounded: false })
  },
  {
    file: join(ICONS_DIR, 'icon-192x192.png'),
    svg: () => svgIcon({ size: 192, scale: STANDARD_SCALE, rounded: true })
  },
  {
    file: join(ICONS_DIR, 'icon-512x512.png'),
    svg: () => svgIcon({ size: 512, scale: STANDARD_SCALE, rounded: true })
  },
  {
    file: join(ICONS_DIR, 'icon-192-maskable.png'),
    svg: () => svgIcon({ size: 192, scale: MASKABLE_SCALE, rounded: false })
  },
  {
    file: join(ICONS_DIR, 'icon-512-maskable.png'),
    svg: () => svgIcon({ size: 512, scale: MASKABLE_SCALE, rounded: false })
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
    data: await toPng(svgIcon({ size, scale: STANDARD_SCALE, rounded: true }))
  }))
);
const ico = packIco(icoImages);
await writeFile(join(PUBLIC_DIR, 'favicon.ico'), ico);
console.info(`${colors.green}✓${colors.reset} public/favicon.ico ${formatBytes(ico.length)} (${ICO_SIZES.join('/')})`);

console.info(
  `\n${colors.blue}Regenerated from public/icons/favicon.svg.${colors.reset} Check any replacement\n` +
    `mark against https://maskable.app before shipping it.\n`
);
