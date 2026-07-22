// scripts/migrate-glossary.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import sharp from 'sharp';

const SRC = '../wotr-build-guide/index.html';
const OUT_G = 'src/content/glossary';
const OUT_I = 'public/glossary-icons';
mkdirSync(OUT_G, { recursive: true });
mkdirSync(OUT_I, { recursive: true });

const html = readFileSync(SRC, 'utf8');

// Extract the object literals `var T = { ... };` and `var IC = { ... };`
function extractObject(marker) {
  const i = html.indexOf(marker);
  const start = html.indexOf('{', i);
  let depth = 0, j = start;
  for (; j < html.length; j++) {
    const c = html[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { j++; break; } }
  }
  // eslint-disable-next-line no-eval
  return eval('(' + html.slice(start, j) + ')');
}

const T = extractObject('var T ='); // name -> [category, desc, slug|null]
const IC = extractObject('var IC ='); // name -> "data:image/...;base64,...."

const CAT = { cls: 'class', abil: 'ability', feat: 'feat', spell: 'spell', hex: 'hex', mythic: 'mythic', skill: 'skill' };
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let terms = 0, icons = 0;
for (const [name, [cat, desc, wikiSlug]] of Object.entries(T)) {
  const slug = slugify(name);
  const entry = { name, category: CAT[cat] ?? 'ability', desc: desc.replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&minus;/g, '−').replace(/&rarr;/g, '→') };
  if (wikiSlug) entry.wikiSlug = wikiSlug;

  if (IC[name]) {
    const b64 = IC[name].split(',')[1];
    const buf = Buffer.from(b64, 'base64');
    await sharp(buf).resize(64, 64, { fit: 'inside' }).webp({ quality: 82 }).toFile(join(OUT_I, `${slug}.webp`));
    entry.icon = `${slug}.webp`;
    icons++;
  }
  writeFileSync(join(OUT_G, `${slug}.yaml`), yaml.dump(entry, { lineWidth: 100 }));
  terms++;
}
console.log(`Wrote ${terms} glossary terms, ${icons} icons.`);
