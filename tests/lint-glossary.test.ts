import { describe, it, expect } from 'bun:test';
import { lintGlossary } from '../src/lib/lint';

describe('lintGlossary', () => {
  it('flags a normalized-key collision as an error', () => {
    const issues = lintGlossary({
      entries: [
        { name: 'Point Blank Shot', category: 'feat', desc: 'a', aliases: [] },
        { name: 'Point-Blank Shot', category: 'feat', desc: 'b', aliases: [] },
      ] as any,
      iconFiles: new Set(), referencedNames: new Set(['point blank shot']),
    });
    expect(issues.some((i) => i.kind === 'collision' && i.level === 'error')).toBe(true);
  });
  it('flags an alias that collides with another entry as an error', () => {
    const issues = lintGlossary({
      entries: [
        { name: 'Deadly Aim', category: 'feat', desc: 'a', aliases: [] },
        { name: 'Precise Shot', category: 'feat', desc: 'b', aliases: ['Deadly-Aim'] },
      ] as any,
      iconFiles: new Set(), referencedNames: new Set(['deadly aim','precise shot']),
    });
    expect(issues.some((i) => i.kind === 'collision' && i.level === 'error')).toBe(true);
  });
  it('flags a missing icon file', () => {
    const issues = lintGlossary({
      entries: [{ name: 'A', category: 'feat', desc: 'x', icon: 'a.webp', aliases: [] }] as any,
      iconFiles: new Set(), referencedNames: new Set(['a']),
    });
    expect(issues.some((i) => i.kind === 'missing-icon')).toBe(true);
  });
  it('warns on a dead (unreferenced) entry', () => {
    const issues = lintGlossary({
      entries: [{ name: 'Unused', category: 'feat', desc: 'x', aliases: [] }] as any,
      iconFiles: new Set(), referencedNames: new Set(),
    });
    expect(issues.some((i) => i.kind === 'dead' && i.level === 'warn')).toBe(true);
  });
  it('passes a clean glossary', () => {
    const issues = lintGlossary({
      entries: [{ name: 'A', category: 'feat', desc: 'x', aliases: [] }] as any,
      iconFiles: new Set(), referencedNames: new Set(['a']),
    });
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(0);
  });
});
