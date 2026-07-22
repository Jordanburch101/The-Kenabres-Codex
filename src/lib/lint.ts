import type { GlossaryEntry } from './schemas';
import { normalizeKey } from './normalize';

export interface LintIssue { level: 'error' | 'warn'; kind: string; message: string; }

export function lintGlossary(input: {
  entries: GlossaryEntry[];
  iconFiles: Set<string>;
  referencedNames: Set<string>; // normalized names referenced by any build
}): LintIssue[] {
  const { entries, iconFiles, referencedNames } = input;
  const issues: LintIssue[] = [];
  const byKey = new Map<string, GlossaryEntry>();
  const bySlug = new Map<string, GlossaryEntry>();

  for (const e of entries) {
    const nk = normalizeKey(e.name);
    const prev = byKey.get(nk);
    if (prev) {
      issues.push({ level: 'error', kind: 'collision',
        message: `"${e.name}" collides with "${prev.name}" (normalized "${nk}")` });
    } else byKey.set(nk, e);

    if (e.wikiSlug) {
      const prevSlug = bySlug.get(e.wikiSlug);
      if (prevSlug) issues.push({ level: 'error', kind: 'dup-slug',
        message: `"${e.name}" shares wikiSlug "${e.wikiSlug}" with "${prevSlug.name}"` });
      else bySlug.set(e.wikiSlug, e);
    }
    if (e.icon && !iconFiles.has(e.icon)) {
      issues.push({ level: 'error', kind: 'missing-icon',
        message: `"${e.name}" references missing icon "${e.icon}"` });
    }
    const referenced = referencedNames.has(nk) ||
      (e.aliases ?? []).some((a) => referencedNames.has(normalizeKey(a)));
    if (!referenced) issues.push({ level: 'warn', kind: 'dead',
      message: `"${e.name}" is defined but not referenced by any build` });
  }
  return issues;
}
