import { describe, it, expect } from 'bun:test';
import { glossaryEntrySchema, buildSchema } from '../src/lib/schemas';

describe('glossaryEntrySchema', () => {
  it('accepts a valid entry', () => {
    const r = glossaryEntrySchema.safeParse({
      name: 'Deadly Aim', category: 'feat',
      desc: 'Trade -1 attack for +2 damage.', wikiSlug: 'Deadly+Aim',
      icon: 'deadly-aim.webp', aliases: ['DA'],
    });
    expect(r.success).toBe(true);
  });
  it('rejects an unknown category', () => {
    const r = glossaryEntrySchema.safeParse({ name: 'X', category: 'weapon', desc: 'y' });
    expect(r.success).toBe(false);
  });
  it('requires name and desc', () => {
    expect(glossaryEntrySchema.safeParse({ category: 'feat', desc: 'y' }).success).toBe(false);
    expect(glossaryEntrySchema.safeParse({ name: 'X', category: 'feat' }).success).toBe(false);
  });
});

describe('buildSchema', () => {
  const minimal = {
    slug: 'wenduag', name: 'Wenduag', tagline: 'Slayer',
    kind: 'companion', role: 'Ranged DPS', class: 'Slayer',
    tags: ['throwing-axe'], summary: 'A [[Slayer]] build.',
  };
  it('accepts a minimal valid build', () => {
    expect(buildSchema.safeParse(minimal).success).toBe(true);
  });
  it('accepts an optional flexible level table', () => {
    const r = buildSchema.safeParse({
      ...minimal,
      levels: { headers: ['Feat', 'Talent'], rows: [{ lv: 1, cells: ['[[Weapon Focus]]', '—'] }] },
    });
    expect(r.success).toBe(true);
  });
  it('rejects an invalid kind', () => {
    expect(buildSchema.safeParse({ ...minimal, kind: 'boss' }).success).toBe(false);
  });
});
