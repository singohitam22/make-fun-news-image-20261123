// make.fun news-image-20261123 entry.
// A newspaper front page summing up the world's news of Monday 23 November
// 2026: two tankers struck in the Strait of Hormuz off Oman's Khasab
// (UKMTO reports vs Iran's mine claim), the COP31 collapse in Antalya,
// the Democrats' historic House majority, Poland accusing Russia of an
// airspace provocation, and more. The artwork is entry.png next to
// this file; this program checks it meets the competition limits and copies
// it to the output directory.
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const LIMIT_BYTES = 1024 * 1024;
const LIMIT_PX = 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

// CRC-32 (IEEE 802.3), used to verify every PNG chunk.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Unfilter one scanline row (PNG filter types 0-4) into `out`.
// `prev` is the previous row's unfiltered bytes, or null for the first row.
function unfilterRow(raw, filter, out, prev) {
  const bpp = 3; // RGB, 8-bit
  for (let i = 0; i < raw.length; i++) {
    const a = i >= bpp ? out[i - bpp] : 0;
    const b = prev ? prev[i] : 0;
    const c = prev && i >= bpp ? prev[i - bpp] : 0;
    let v = raw[i];
    if (filter === 1) v += a;
    else if (filter === 2) v += b;
    else if (filter === 3) v += (a + b) >> 1;
    else if (filter === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    } else if (filter !== 0) {
      die(`unknown PNG filter type ${filter}`);
    }
    out[i] = v & 0xff;
  }
}

const here = new URL('./entry.png', import.meta.url);
if (!existsSync(here)) die('entry.png is missing next to main.ts');
const bytes = readFileSync(here);

if (bytes.length > LIMIT_BYTES) {
  die(`entry.png is ${bytes.length} bytes, above the 1 MiB limit`);
}
if (bytes.length < 45) die('entry.png is too small to be a valid PNG');
for (let i = 0; i < PNG_MAGIC.length; i++) {
  if (bytes[i] !== PNG_MAGIC[i]) die('entry.png is not a PNG file');
}
// PNG IHDR: width and height are big-endian uint32 at offsets 16 and 20.
const width = bytes.readUInt32BE(16);
const height = bytes.readUInt32BE(20);
if (width !== LIMIT_PX || height !== LIMIT_PX) {
  die(`entry.png is ${width}x${height}, expected ${LIMIT_PX}x${LIMIT_PX}`);
}

// Walk every chunk: verify each CRC, require IHDR first with 8-bit RGB
// non-interlaced data, require at least one IDAT carrying image data, and
// require IEND as the last chunk with nothing after it. A truncated file,
// a file with a corrupt chunk, or a file with trailing bytes fails here
// even though its magic bytes and dimensions look right.
let offset = 8;
let sawIHDR = false;
let sawIEND = false;
let idatBytes = 0;
const idatParts = [];
let first = true;
while (offset < bytes.length) {
  if (offset + 8 > bytes.length) die('truncated PNG chunk header');
  const len = bytes.readUInt32BE(offset);
  const type = bytes.toString('latin1', offset + 4, offset + 8);
  const dataStart = offset + 8;
  const dataEnd = dataStart + len;
  if (dataEnd + 4 > bytes.length) die(`PNG chunk ${type} is truncated`);
  if (crc32(bytes.subarray(offset + 4, dataEnd)) !== bytes.readUInt32BE(dataEnd)) {
    die(`PNG chunk ${type} fails its CRC check`);
  }
  if (first && type !== 'IHDR') die('first PNG chunk is not IHDR');
  first = false;
  if (type === 'IHDR') {
    if (len !== 13) die('IHDR chunk has the wrong length');
    if (bytes.readUInt32BE(dataStart) !== LIMIT_PX || bytes.readUInt32BE(dataStart + 4) !== LIMIT_PX) {
      die('IHDR dimensions do not match the 1024x1024 limit');
    }
    if (bytes[dataStart + 8] !== 8) die(`IHDR bit depth is ${bytes[dataStart + 8]}, expected 8`);
    if (bytes[dataStart + 9] !== 2) die(`IHDR color type is ${bytes[dataStart + 9]}, expected 2 (truecolor RGB)`);
    if (bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0) {
      die('IHDR uses an unsupported compression or filter method');
    }
    if (bytes[dataStart + 12] !== 0) die('interlaced PNGs are not accepted');
    sawIHDR = true;
  }
  if (type === 'IDAT' && len > 0) {
    idatParts.push(bytes.subarray(dataStart, dataEnd));
    idatBytes += len;
  }
  offset = dataEnd + 4;
  if (type === 'IEND') {
    if (len !== 0) die('IEND chunk must be empty');
    if (offset !== bytes.length) die('trailing bytes after the IEND chunk');
    sawIEND = true;
    break;
  }
}
if (!sawIHDR) die('PNG has no IHDR chunk');
if (!sawIEND) die('PNG has no IEND chunk');
if (idatBytes === 0) die('PNG has no image data (empty IDAT)');

// Inflate the image data and reject a near-blank picture: unfilter the
// scanlines, sample pixels on a grid, and require a real range of colours.
// A solid-colour frame (or one with a speck of content) fails here even
// though its structure above is valid.
let raw;
try {
  raw = inflateSync(Buffer.concat(idatParts));
} catch {
  die('PNG image data (IDAT) does not inflate');
}
const stride = width * 3 + 1; // one filter byte + 3 bytes per RGB pixel
if (raw.length !== stride * height) die('inflated PNG data has the wrong size');
const px = Buffer.alloc(width * height * 3);
for (let y = 0; y < height; y++) {
  const filter = raw[y * stride];
  const prev = y === 0 ? null : px.subarray((y - 1) * width * 3, y * width * 3);
  unfilterRow(
    raw.subarray(y * stride + 1, (y + 1) * stride),
    filter,
    px.subarray(y * width * 3, (y + 1) * width * 3),
    prev,
  );
}
const colourCounts = new Map();
const step = 16;
let sampled = 0;
for (let y = 0; y < height; y += step) {
  for (let x = 0; x < width; x += step) {
    const i = (y * width + x) * 3;
    const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    colourCounts.set(key, (colourCounts.get(key) ?? 0) + 1);
    sampled++;
  }
}
let topCount = 0;
for (const n of colourCounts.values()) if (n > topCount) topCount = n;
if (colourCounts.size < 16) {
  die(`entry.png uses only ${colourCounts.size} distinct colours on a ${sampled}-pixel sample, looks blank`);
}
if (topCount / sampled > 0.99) {
  die(`entry.png is ${(100 * topCount / sampled).toFixed(1)}% one colour, looks blank`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
copyFileSync(here, join(outDir, 'entry.png'));
console.log(`entry.png (${bytes.length} bytes, ${width}x${height}) -> ${join(outDir, 'entry.png')}`);
