/**
 * Generate the PWA icons (public/icons/icon-192.png, icon-512.png) without any
 * image library: a dark rounded tile with five staff lines and an amber note.
 * PNG encoding is done by hand with zlib from Node.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = [0x1c, 0x1a, 0x17];
const LINE = [0xf1, 0xec, 0xe4];
const AMBER = [0xe0, 0xa8, 0x4a];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeIcon(size) {
  const s = size / 512; // design in a 512 grid
  const radius = 96 * s;
  const lineGap = 44 * s;
  const firstLine = 176 * s;
  const lineHalf = 5 * s;
  const headCx = 300 * s;
  const headCy = firstLine + lineGap * 3; // sits on the fourth line
  const headRx = 58 * s;
  const headRy = 40 * s;
  const stemX = headCx + headRx * 0.82;
  const stemTop = headCy - 190 * s;
  const stemW = 14 * s;
  const angle = 0.35;

  return png(size, (x, y) => {
    // Rounded corners: outside the rounded square is transparent-ish, but PNG
    // RGB has no alpha, so keep the tile square and dark.
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) return BG;

    // Note head (rotated ellipse)
    const dx = x + 0.5 - headCx;
    const dy = y + 0.5 - headCy;
    const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
    if ((rx / headRx) ** 2 + (ry / headRy) ** 2 <= 1) return AMBER;
    // Stem
    if (x >= stemX - stemW / 2 && x <= stemX + stemW / 2 && y >= stemTop && y <= headCy) return AMBER;

    // Staff lines
    for (let i = 0; i < 5; i++) {
      const ly = firstLine + lineGap * i;
      if (Math.abs(y + 0.5 - ly) <= lineHalf && x > 72 * s && x < size - 72 * s) return LINE;
    }
    return BG;
  });
}

for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, makeIcon(size));
  console.log(`wrote ${file}`);
}
