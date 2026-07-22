import type { GlossaryEntry } from './schemas';
import { normalizeKey } from './normalize';
import { wikiUrl } from './wiki';

export type GlossaryIndex = Map<string, GlossaryEntry>;
export interface ResolvedTerm {
  display: string;
  href?: string;
  icon?: string;
  desc: string;
  category: GlossaryEntry['category'];
}

export function buildGlossaryIndex(entries: GlossaryEntry[]): GlossaryIndex {
  const index: GlossaryIndex = new Map();
  for (const e of entries) {
    for (const key of [e.name, ...(e.aliases ?? [])]) {
      const nk = normalizeKey(key);
      const existing = index.get(nk);
      if (existing && existing !== e) {
        throw new Error(`Glossary duplicate: "${key}" collides with "${existing.name}"`);
      }
      index.set(nk, e);
    }
  }
  return index;
}

export function resolveTerm(index: GlossaryIndex, raw: string): ResolvedTerm {
  const [lookupRaw, aliasRaw] = raw.split('|').map((s) => s.trim());
  const entry = index.get(normalizeKey(lookupRaw));
  if (!entry) throw new Error(`Unknown glossary term: "${lookupRaw}"`);
  const display = aliasRaw && aliasRaw !== 'no-wiki' ? aliasRaw : lookupRaw;
  const linkable = entry.wikiSlug && aliasRaw !== 'no-wiki';
  return {
    display,
    href: linkable ? wikiUrl(entry.wikiSlug!) : undefined,
    icon: entry.icon,
    desc: entry.desc,
    category: entry.category,
  };
}
