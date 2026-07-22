import type { Build } from './schemas';

export type RailBuild = Pick<Build, 'slug' | 'name' | 'kind' | 'class' | 'role'>;
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
