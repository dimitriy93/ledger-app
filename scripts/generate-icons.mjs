/**
 * Generates Ledger PWA icons as PNGs with zero dependencies.
 * Design: deep-navy rounded square, three "ledger line" rows —
 * bullet + bar — with a sky-blue accent on the middle row.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const BG = [7, 11, 21]; // #070b15
const TEXT = [237, 242, 250]; // #edf2fa
const ACCENT = [92, 184, 246]; // #5cb8f6

// Signed-distance-function coverage of a rounded rect: 0..1 with soft edge.
function roundedRectCoverage(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  const d = Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - radius;
  return Math.min(1, Math.max(0, 0.5 - d));
}

function circleCoverage(px, py, cx, cy, r) {
  const d = Math.hypot(px - cx, py - cy) - r;
  return Math.min(1, Math.max(0, 0.5 - d));
}

function blend(base, over, alpha) {
  return [
    base[0] + (over[0] - base[0]) * alpha,
    base[1] + (over[1] - base[1]) * alpha,
    base[2] + (over[2] - base[2]) * alpha,
  ];
}

/**
 * Renders the icon. `contentScale` shrinks the artwork for maskable icons
 * (safe zone), `roundRadius` rounds the canvas corners (0 = square).
 */
function renderIcon(size, { contentScale = 1, roundRadiusRatio = 0 } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const s = (v) => v * size; // design units (0..1) -> px
  const roundRadius = roundRadiusRatio * size;

  // Artwork geometry in unit space. Content is scaled around the center so
  // maskable icons keep all artwork inside the 80% safe zone.
  const rows = [
    { y: 0.31, bulletX: 0.31, barWidth: 0.4, color: TEXT },
    { y: 0.5, bulletX: 0.31, barWidth: 0.48, color: ACCENT },
    { y: 0.69, bulletX: 0.31, barWidth: 0.3, color: TEXT },
  ];
  const bulletR = 0.042;
  const barH = 0.075;
  const barStart = 0.44;
  const sc = (v) => 0.5 + (v - 0.5) * contentScale; // scale around center

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let color = BG;

      // Canvas shape alpha (rounded corners or full square).
      const canvasAlpha =
        roundRadius > 0 ? roundedRectCoverage(px, py, size / 2, size / 2, size / 2, size / 2, roundRadius) : 1;

      for (const row of rows) {
        const cy = sc(row.y);
        // bullet
        const bAlpha = circleCoverage(px, py, s(sc(row.bulletX)), s(cy), s(bulletR * contentScale));
        if (bAlpha > 0) color = blend(color, row.color, bAlpha);
        // bar
        const barAlpha = roundedRectCoverage(
          px,
          py,
          s(sc(barStart + row.barWidth / 2)),
          s(cy),
          s((row.barWidth * contentScale) / 2),
          s((barH * contentScale) / 2),
          s((barH * contentScale) / 2)
        );
        if (barAlpha > 0) color = blend(color, row.color, barAlpha);
      }

      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(color[0]);
      pixels[offset + 1] = Math.round(color[1]);
      pixels[offset + 2] = Math.round(color[2]);
      pixels[offset + 3] = Math.round(canvasAlpha * 255);
    }
  }
  return pixels;
}

// --- Minimal PNG encoder -------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // Raw scanlines, filter byte 0 per row.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const targets = [
  { file: "icon-192.png", size: 192, opts: { roundRadiusRatio: 0.22 } },
  { file: "icon-512.png", size: 512, opts: { roundRadiusRatio: 0.22 } },
  { file: "icon-maskable-192.png", size: 192, opts: { contentScale: 0.8 } },
  { file: "icon-maskable-512.png", size: 512, opts: { contentScale: 0.8 } },
  // iOS ignores alpha; render a full-bleed square.
  { file: "apple-touch-icon.png", size: 180, opts: {} },
];

for (const { file, size, opts } of targets) {
  const png = encodePNG(renderIcon(size, opts), size);
  writeFileSync(join(outDir, file), png);
  console.log(`generated public/icons/${file}`);
}
