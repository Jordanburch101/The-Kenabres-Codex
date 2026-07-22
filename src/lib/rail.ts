import type { Build } from './schemas';

export type RailBuild = Pick<Build, 'slug' | 'name' | 'kind' | 'class' | 'role' | 'featured'>;
export interface RailGroup {
  kind: Build['kind'];
  label: string;
  builds: RailBuild[];
}

const GROUP_ORDER: { kind: Build['kind']; label: string }[] = [
  { kind: 'mc', label: 'Main Character' },
  { kind: 'companion', label: 'Companions' },
  { kind: 'mercenary', label: 'Mercenaries' },
];

export function groupBuilds(builds: RailBuild[]): RailGroup[] {
  return GROUP_ORDER.map(({ kind, label }) => ({
    kind,
    label,
    builds: builds
      .filter((b) => b.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.builds.length > 0);
}

export const shortName = (name: string): string => name.split('—')[0].trim();

export function featuredBuilds(builds: RailBuild[]): RailBuild[] {
  return builds
    .filter((b) => b.featured != null)
    .sort((a, b) => (a.featured! - b.featured!) || a.name.localeCompare(b.name));
}

export function forYouSections(
  builds: RailBuild[],
  starredSlugs: string[],
  recentSlugs: string[],
  cap = 6,
): { starred: RailBuild[]; recent: RailBuild[] } {
  const bySlug = new Map(builds.map((b) => [b.slug, b]));
  const starred = starredSlugs.map((s) => bySlug.get(s)).filter((b): b is RailBuild => !!b);
  const starredSet = new Set(starredSlugs);
  const recent = recentSlugs
    .filter((s) => !starredSet.has(s))
    .map((s) => bySlug.get(s))
    .filter((b): b is RailBuild => !!b)
    .slice(0, cap);
  return { starred, recent };
}
