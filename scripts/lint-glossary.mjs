import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { lintGlossary } from '../src/lib/lint.ts';

const G = 'src/content/glossary';
const B = 'src/content/builds';
const ICONS = 'public/glossary-icons';

const entries = readdirSync(G).filter((f) => f.endsWith('.yaml'))
  .map((f) => yaml.load(readFileSync(join(G, f), 'utf8')));
const iconFiles = new Set(existsSync(ICONS) ? readdirSync(ICONS) : []);

const referencedNames = new Set();
for (const f of readdirSync(B).filter((f) => f.endsWith('.yaml'))) {
  const text = readFileSync(join(B, f), 'utf8');
  for (const m of text.matchAll(/\[\[([^\]|]+)/g)) {
    referencedNames.add(m[1].trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  }
}

const issues = lintGlossary({ entries, iconFiles, referencedNames });
for (const i of issues) console[i.level === 'error' ? 'error' : 'warn'](`[${i.level}] ${i.kind}: ${i.message}`);
const errors = issues.filter((i) => i.level === 'error').length;
console.log(`\n${errors} error(s), ${issues.length - errors} warning(s).`);
process.exit(errors ? 1 : 0);
