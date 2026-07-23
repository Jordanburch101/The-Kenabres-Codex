import { test, expect } from 'bun:test';
import {
  kindLabel, sortBuilds, facets, filterBuilds, type DirBuild,
} from '../src/lib/directory';

const mk = (over: Partial<DirBuild>): DirBuild => ({
  slug: 's', name: 'N', tagline: 'T', className: 'Cleric', role: 'Tank',
  kind: 'companion', kindLabel: 'Companion', badges: [], summary: '', tags: [],
  ...over,
});

test('kindLabel maps mc to Main Character', () => {
  expect(kindLabel('mc')).toBe('Main Character');
  expect(kindLabel('companion')).toBe('Companion');
  expect(kindLabel('mercenary')).toBe('Mercenary');
});

test('sortBuilds: featured asc (unset last), then alphabetical', () => {
  const out = sortBuilds([
    mk({ slug: 'z', name: 'Zed' }),
    mk({ slug: 'a', name: 'Aaron' }),
    mk({ slug: 'd', name: 'Demon Slayer', featured: 1 }),
    mk({ slug: 'c', name: 'Camellia', featured: 2 }),
  ]).map((b) => b.slug);
  expect(out).toEqual(['d', 'c', 'a', 'z']);
});

test('facets: present-only, deduped, sorted; kinds carry labels in fixed order', () => {
  const f = facets([
    mk({ kind: 'companion', role: 'Tank', className: 'Paladin' }),
    mk({ kind: 'companion', role: 'Tank', className: 'Cleric' }),
    mk({ kind: 'mc', role: 'Ranged DPS', className: 'Ranger' }),
  ]);
  expect(f.kinds).toEqual([
    { value: 'mc', label: 'Main Character' },
    { value: 'companion', label: 'Companion' },
  ]);
  expect(f.roles).toEqual(['Ranged DPS', 'Tank']);
  expect(f.classes).toEqual(['Cleric', 'Paladin', 'Ranger']);
});

test('filterBuilds: kind/role/class equality and empty = all', () => {
  const builds = [
    mk({ slug: 'tank', kind: 'companion', role: 'Tank', className: 'Paladin' }),
    mk({ slug: 'dps', kind: 'mc', role: 'Ranged DPS', className: 'Ranger' }),
  ];
  const all = { query: '', kind: '', role: '', className: '' };
  expect(filterBuilds(builds, all).map((b) => b.slug)).toEqual(['tank', 'dps']);
  expect(filterBuilds(builds, { ...all, kind: 'mc' }).map((b) => b.slug)).toEqual(['dps']);
  expect(filterBuilds(builds, { ...all, role: 'Tank' }).map((b) => b.slug)).toEqual(['tank']);
  expect(filterBuilds(builds, { ...all, className: 'Ranger' }).map((b) => b.slug)).toEqual(['dps']);
});

test('filterBuilds: query is case-insensitive across name, tagline, class, role, tags', () => {
  const builds = [
    mk({ slug: 'a', name: 'Camellia', tagline: 'Shaman', className: 'Shaman', role: 'Crowd Control', tags: ['poison'] }),
    mk({ slug: 'b', name: 'Seelah', tagline: 'Paladin', className: 'Paladin', role: 'Tank', tags: ['high-ac'] }),
  ];
  const base = { kind: '', role: '', className: '' };
  expect(filterBuilds(builds, { ...base, query: 'POISON' }).map((b) => b.slug)).toEqual(['a']);
  expect(filterBuilds(builds, { ...base, query: 'seel' }).map((b) => b.slug)).toEqual(['b']);
  expect(filterBuilds(builds, { ...base, query: 'crowd' }).map((b) => b.slug)).toEqual(['a']);
  expect(filterBuilds(builds, { ...base, query: '' }).length).toBe(2);
});
