import { test, expect } from 'bun:test';
import { groupBuilds, shortName, featuredBuilds, forYouSections, type RailBuild } from '../src/lib/rail';

const b = (slug: string, name: string, kind: RailBuild['kind']): RailBuild =>
  ({ slug, name, kind, class: 'X', role: 'Y' });

test('groups by kind in MC → Companions → Mercenaries order', () => {
  const groups = groupBuilds([
    b('cam', 'Camellia', 'companion'),
    b('ds', 'Demon Slayer', 'mc'),
    b('merc', 'Hired Blade', 'mercenary'),
  ]);
  expect(groups.map((g) => g.kind)).toEqual(['mc', 'companion', 'mercenary']);
});

test('omits empty groups', () => {
  const groups = groupBuilds([b('ds', 'Demon Slayer', 'mc')]);
  expect(groups.map((g) => g.label)).toEqual(['Main Character']);
});

test('sorts builds by name within a group', () => {
  const groups = groupBuilds([
    b('wen', 'Wenduag', 'companion'),
    b('cam', 'Camellia', 'companion'),
    b('ember', 'Ember', 'companion'),
  ]);
  expect(groups[0].builds.map((x) => x.name)).toEqual(['Camellia', 'Ember', 'Wenduag']);
});

test('shortName takes the part before the em dash', () => {
  expect(shortName('Camellia — The Poisoner')).toBe('Camellia');
  expect(shortName('Seelah')).toBe('Seelah');
});

const fb = (slug: string, name: string, featured?: number): RailBuild =>
  ({ slug, name, kind: 'companion', class: 'X', role: 'Y', featured });

test('featuredBuilds: only ranked, sorted by rank then name', () => {
  const out = featuredBuilds([
    fb('c', 'Camellia', 2),
    fb('a', 'Ada'),          // unranked -> excluded
    fb('d', 'Demon', 1),
    fb('e', 'Ember', 2),     // same rank as Camellia -> name breaks tie
  ]);
  expect(out.map((b) => b.slug)).toEqual(['d', 'c', 'e']);
});

test('forYouSections: starred order preserved; recent excludes starred and caps', () => {
  const builds = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => fb(s, s.toUpperCase()));
  const { starred, recent } = forYouSections(
    builds,
    ['b', 'a'],                               // starred, newest-first
    ['a', 'c', 'd', 'e', 'f', 'g', 'b'],      // recent, most-recent-first
    3,
  );
  expect(starred.map((x) => x.slug)).toEqual(['b', 'a']);
  expect(recent.map((x) => x.slug)).toEqual(['c', 'd', 'e']); // excludes a,b; capped at 3
});

test('forYouSections: stale slugs (not in builds) are dropped', () => {
  const builds = [fb('a', 'A')];
  const { starred, recent } = forYouSections(builds, ['ghost'], ['gone', 'a'], 6);
  expect(starred).toEqual([]);
  expect(recent.map((x) => x.slug)).toEqual(['a']);
});
