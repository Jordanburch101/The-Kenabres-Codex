#!/usr/bin/env bun
// grab-term.mjs — add or refresh one glossary term.
//
//   bun scripts/grab-term.mjs "Deadly Aim" feat "Deadly+Aim"
//   bun scripts/grab-term.mjs "<Name>" <category> "<WikiSlug>" ["one-line description"]
//
// Verifies the Fextralife page exists, grabs its infobox icon, converts it to a
// 64px WebP in public/glossary-icons/, and writes src/content/glossary/<slug>.yaml.
// If a description is omitted, a TODO placeholder is written for you to fill in.
// Fextralife 502s intermittently, so page/image fetches retry.
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import yaml from 'js-yaml';

const [name, category, wikiSlug, desc] = process.argv.slice(2);
if (!name || !category || !wikiSlug) {
  console.error('usage: bun scripts/grab-term.mjs "<Name>" <category> "<WikiSlug>" ["desc"]');
  process.exit(2);
}
const CATS = ['feat', 'spell', 'hex', 'mythic', 'class', 'skill', 'ability'];
if (!CATS.includes(category)) { console.error(`category must be one of: ${CATS.join(', ')}`); process.exit(2); }

const BASE = 'https://pathfinderwrathoftherighteous.wiki.fextralife.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function get(url, { binary = false } = {}) {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) return binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch {}
    await new Promise((res) => setTimeout(res, 1000));
  }
  return null;
}

const pageUrl = `${BASE}/${wikiSlug}`;
const page = await get(pageUrl);
if (!page || page.length < 20000 || /does not yet have|Create this page/i.test(page)) {
  console.error(`WARNING: ${pageUrl} did not resolve to a real page — writing entry with no wikiSlug (tooltip only).`);
}
const pageOk = page && page.length >= 20000 && !/does not yet have|Create this page/i.test(page);

// Find the infobox icon: first /file/... image whose filename shares a word with the term.
let iconField;
if (pageOk) {
  const imgs = [...page.matchAll(/src="(\/file\/[^"]+\.(?:png|jpe?g|webp))"/gi)].map((m) => m[1]);
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  const hit = imgs.find((p) => tokens.some((t) => p.toLowerCase().includes(t))) || imgs.find((p) => /64px|feats?|ability|mythic|spell|class/i.test(p));
  if (hit) {
    const buf = await get(BASE + hit, { binary: true });
    if (buf && buf.length > 200) {
      await sharp(buf).resize(64, 64, { fit: 'inside' }).webp({ quality: 82 })
        .toFile(join('public/glossary-icons', `${slug}.webp`));
      iconField = `${slug}.webp`;
      console.log(`icon -> public/glossary-icons/${slug}.webp`);
    }
  }
  if (!iconField) console.error('note: no infobox icon found; entry written without an icon (fine — icons are optional).');
}

const entry = { name, category, desc: desc || `TODO: one-line description of ${name}.` };
if (pageOk) entry.wikiSlug = wikiSlug;
if (iconField) entry.icon = iconField;

const out = join('src/content/glossary', `${slug}.yaml`);
if (existsSync(out)) console.error(`note: overwriting existing ${out}`);
writeFileSync(out, yaml.dump(entry, { lineWidth: 100 }));
console.log(`wrote ${out}`);
if (!desc) console.log('▲ fill in the desc field, then `bun run build` + `bun run lint:glossary`.');
