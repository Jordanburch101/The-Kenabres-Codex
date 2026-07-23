import type { Build } from './schemas';
import { toPlainText } from './plainText';

export interface DirBuild {
  slug: string;
  name: string;
  tagline: string;
  className: string;
  role: string;
  kind: 'companion' | 'mc' | 'mercenary';
  kindLabel: string;
  difficulty?: string;
  badges: { label: string; style: 'gold' | 'crim' | 'plain' }[];
  summary: string;
  tags: string[];
  featured?: number;
}

export interface Facets {
  kinds: { value: string; label: string }[];
  roles: string[];
  classes: string[];
}

export interface DirFilter {
  query: string;
  kind: string;
  role: string;
  className: string;
}

const KIND_LABEL: Record<string, string> = {
  mc: 'Main Character',
  companion: 'Companion',
  mercenary: 'Mercenary',
};
const KIND_ORDER = ['mc', 'companion', 'mercenary'];

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function toDirBuild(b: Build): DirBuild {
  return {
    slug: b.slug,
    name: b.name,
    tagline: b.tagline,
    className: b.class,
    role: b.role,
    kind: b.kind,
    kindLabel: kindLabel(b.kind),
    difficulty: b.difficultyTarget,
    badges: (b.badges ?? []).slice(0, 2),
    summary: toPlainText(b.summary),
    tags: b.tags ?? [],
    featured: b.featured,
  };
}

export function sortBuilds(builds: DirBuild[]): DirBuild[] {
  return [...builds].sort((a, b) => {
    const fa = a.featured ?? Infinity;
    const fb = b.featured ?? Infinity;
    if (fa !== fb) return fa - fb;
    return a.name.localeCompare(b.name);
  });
}

export function facets(builds: DirBuild[]): Facets {
  const uniqSorted = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
  const kinds = KIND_ORDER
    .filter((k) => builds.some((b) => b.kind === k))
    .map((k) => ({ value: k, label: kindLabel(k) }));
  return {
    kinds,
    roles: uniqSorted(builds.map((b) => b.role)),
    classes: uniqSorted(builds.map((b) => b.className)),
  };
}

export function filterBuilds(builds: DirBuild[], f: DirFilter): DirBuild[] {
  const q = f.query.trim().toLowerCase();
  return builds.filter((b) => {
    if (f.kind && b.kind !== f.kind) return false;
    if (f.role && b.role !== f.role) return false;
    if (f.className && b.className !== f.className) return false;
    if (q) {
      const hay = [b.name, b.tagline, b.className, b.role, ...b.tags].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
