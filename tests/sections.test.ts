import { test, expect } from 'bun:test';
import { buildSections, SEC } from '../src/lib/sections';
import type { Build } from '../src/lib/schemas';

const base = {
  slug: 's', name: 'N', tagline: '', kind: 'mc', role: '', class: '', tags: [], summary: '',
} as unknown as Build;

test('returns only present sections, in canonical order', () => {
  const build = { ...base, combat: { bullets: ['x'] }, abilityScores: { note: 'y' } } as Build;
  expect(buildSections(build)).toEqual([
    { id: 'ability-scores', label: 'Ability Scores' },
    { id: 'combat', label: 'Combat' },
  ]);
});

test('empty build yields no sections', () => {
  expect(buildSections(base)).toEqual([]);
});

test('SEC ids are unique', () => {
  const ids = Object.values(SEC).map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
});
