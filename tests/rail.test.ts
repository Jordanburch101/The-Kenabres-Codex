import { test, expect } from 'bun:test';
import { groupBuilds, shortName, type RailBuild } from '../src/lib/rail';

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
