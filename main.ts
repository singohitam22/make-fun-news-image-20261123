// news-image-20261123 — entrypoint (Node 22, standard library only).
//
// Copies the front-page image (entry.png) that this repository holds into
// the make.fun output directory, after checking that the image is a whole
// PNG of 1024 by 1024 pixels and at most 1 MiB. The run writes exactly the
// bytes it read, so two runs produce identical output.

import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_BYTES = 1024 * 1024;
const EXPECTED_WIDTH = 1024;
const EXPECTED_HEIGHT = 1024;

const repoRoot = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(repoRoot, "entry.png");
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const outputPath = join(outputDir, "entry.png");

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

let sourceStat;
try {
  sourceStat = statSync(sourcePath);
} catch {
  fail(`entry.png not found at ${sourcePath}`);
}
if (sourceStat.size > MAX_BYTES) {
  fail(`entry.png is ${sourceStat.size} bytes, over the 1 MiB limit`);
}

const bytes = readFileSync(sourcePath);
if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
  fail("entry.png does not start with the PNG signature");
}
if (bytes.length < 24 || bytes.toString("ascii", 12, 16) !== "IHDR") {
  fail("entry.png has no IHDR chunk where one is expected");
}
const width = bytes.readUInt32BE(16);
const height = bytes.readUInt32BE(20);
if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
  fail(`entry.png is ${width}x${height}, expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`);
}

mkdirSync(outputDir, { recursive: true });
copyFileSync(sourcePath, outputPath);

const writtenStat = statSync(outputPath);
if (writtenStat.size !== sourceStat.size) {
  fail(`wrote ${writtenStat.size} bytes, expected ${sourceStat.size}`);
}

// Whole-image check on the copy itself: a valid PNG ends with the 12-byte
// IEND chunk (zero length, "IEND", CRC ae 42 60 82). If the copy were cut
// short, the gate would refuse it, so fail here instead of shipping it.
const written = readFileSync(outputPath);
const IEND = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
if (written.length < 12 || !written.subarray(written.length - 12).equals(IEND)) {
  fail("written entry.png does not end with a valid IEND chunk");
}
console.log(`wrote ${outputPath} (${writtenStat.size} bytes, ${width}x${height})`);
