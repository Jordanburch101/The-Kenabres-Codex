// Bakes the seamless "fine vellum" parchment tile used by .wrap.
// Deterministic (seeded PRNG) so re-running reproduces the same file.
// Run: bun scripts/gen-parchment.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SIZE = 256;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x4b454e41); // "KENA"
const buf = Buffer.alloc(SIZE * SIZE * 4);
for (let i = 0; i < SIZE * SIZE; i++) {
  const o = i * 4;
  buf[o] = 60; buf[o + 1] = 44; buf[o + 2] = 20; // warm umber
  buf[o + 3] = Math.floor(rand() * 18);          // alpha 0..17 (≈ up to 6.7%)
}

mkdirSync('public/textures', { recursive: true });
const out = 'public/textures/parchment-vellum.webp';
await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 4 } })
  .webp({ lossless: true })
  .toFile(out);

const meta = await sharp(out).metadata();
console.log(`wrote ${out} ${meta.width}x${meta.height} hasAlpha=${meta.hasAlpha}`);
