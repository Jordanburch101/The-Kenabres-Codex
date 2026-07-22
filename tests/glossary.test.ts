// tests/glossary.test.ts
import { describe, it, expect } from 'bun:test';
import { buildGlossaryIndex, resolveTerm } from '../src/lib/glossary';

const entries = [
  { name: 'Deadly Aim', category: 'feat', desc: 'd', wikiSlug: 'Deadly+Aim', icon: 'deadly-aim.webp', aliases: [] },
  { name: 'Point Blank Shot', category: 'feat', desc: 'p', wikiSlug: 'Point+Blank+Shot', aliases: ['Point-Blank Shot'] },
  { name: 'Bleeding Attack', category: 'ability', desc: 'b', aliases: [] },
] as any;

describe('buildGlossaryIndex / resolveTerm', () => {
  const idx = buildGlossaryIndex(entries);

  it('resolves by exact name to a wiki link + icon', () => {
    const r = resolveTerm(idx, 'Deadly Aim');
    expect(r.display).toBe('Deadly Aim');
    expect(r.href).toContain('/Deadly+Aim');
    expect(r.icon).toBe('deadly-aim.webp');
  });
  it('resolves an alias to the canonical entry', () => {
    const r = resolveTerm(idx, 'Point-Blank Shot');
    expect(r.href).toContain('/Point+Blank+Shot');
  });
  it('supports display aliasing: Name|Display', () => {
    const r = resolveTerm(idx, 'Deadly Aim|Aim');
    expect(r.display).toBe('Aim');
    expect(r.href).toContain('/Deadly+Aim');
  });
  it('supports |no-wiki (tooltip, no link)', () => {
    const r = resolveTerm(idx, 'Bleeding Attack');
    expect(r.href).toBeUndefined();
    expect(r.desc).toBe('b');
  });
  it('throws on an unknown term', () => {
    expect(() => resolveTerm(idx, 'Nonexistent Feat')).toThrow(/Unknown glossary term/);
  });
  it('throws when two entries share a normalized key', () => {
    expect(() => buildGlossaryIndex([
      { name: 'Point Blank Shot', category: 'feat', desc: 'a', aliases: [] },
      { name: 'point-blank shot', category: 'feat', desc: 'b', aliases: [] },
    ] as any)).toThrow(/duplicate/i);
  });
  it('throws when two distinct entries share the same name', () => {
    expect(() => buildGlossaryIndex([
      { name: 'Deadly Aim', category: 'feat', desc: 'a', aliases: [] },
      { name: 'Deadly Aim', category: 'feat', desc: 'b', aliases: [] },
    ] as any)).toThrow(/duplicate/i);
  });
});
