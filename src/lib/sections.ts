import type { Build } from './schemas';

export interface SectionRef {
  id: string;
  label: string;
}

// Canonical build-page sections, in render order. `key` is the Build field whose
// presence decides whether the section renders. The `id` values MUST match the
// anchor ids used in src/pages/builds/[id].astro.
export const SEC = {
  identity:      { key: 'identity',      id: 'core-identity',     label: 'Core Identity' },
  abilityScores: { key: 'abilityScores', id: 'ability-scores',    label: 'Ability Scores' },
  skills:        { key: 'skills',        id: 'skills',            label: 'Skills' },
  levels:        { key: 'levels',        id: 'level-progression', label: 'Level Progression' },
  picks:         { key: 'picks',         id: 'key-picks',         label: 'Key Picks' },
  gear:          { key: 'gear',          id: 'gear',              label: 'Gear' },
  mythic:        { key: 'mythic',        id: 'mythic-path',       label: 'Mythic Path' },
  combat:        { key: 'combat',        id: 'combat',            label: 'Combat' },
} as const;

const ORDER = Object.values(SEC);

export function buildSections(build: Build): SectionRef[] {
  return ORDER
    .filter((s) => build[s.key as keyof Build] != null)
    .map((s) => ({ id: s.id, label: s.label }));
}
