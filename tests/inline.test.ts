// tests/inline.test.ts
import { describe, it, expect } from 'bun:test';
import { buildGlossaryIndex } from '../src/lib/glossary';
import { renderInline } from '../src/lib/inline';

const idx = buildGlossaryIndex([
  { name: 'Deadly Aim', category: 'feat', desc: 'd', wikiSlug: 'Deadly+Aim', icon: 'deadly-aim.webp', aliases: [] },
  { name: 'Bleeding Attack', category: 'ability', desc: 'b', aliases: [] },
] as any);

describe('renderInline', () => {
  it('renders bold and preserves entities', () => {
    expect(renderInline('**DEX** is key &mdash; really', idx))
      .toBe('<b>DEX</b> is key &mdash; really');
  });
  it('renders a known term as a .wl anchor with icon + tooltip data', () => {
    const html = renderInline('Take [[Deadly Aim]] early', idx);
    expect(html).toContain('class="wl"');
    expect(html).toContain('href="https://pathfinderwrathoftherighteous.wiki.fextralife.com/Deadly+Aim"');
    expect(html).toContain('data-desc="d"');
    expect(html).toContain('glossary-icons/deadly-aim.webp');
    expect(html).toContain('>Deadly Aim</a>');
  });
  it('renders a no-wiki term as a tooltip span (no href)', () => {
    const html = renderInline('[[Bleeding Attack]] bleeds', idx);
    expect(html).toContain('class="wl"');
    expect(html).not.toContain('href=');
  });
  it('throws on an unknown term (build must fail)', () => {
    expect(() => renderInline('[[Made Up Feat]]', idx)).toThrow(/Unknown glossary term/);
  });
  it('escapes bare angle brackets in prose', () => {
    const html = renderInline('if a<b and c>d', idx);
    expect(html).toContain('a&lt;b');
    expect(html).toContain('c&gt;d');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<d>');
  });
  it('protects data-desc from markdown corruption', () => {
    const idx2 = buildGlossaryIndex([
      { name: 'Foo', category: 'feat', desc: 'stacks with *Weapon Focus*', wikiSlug: 'Foo', aliases: [] },
    ] as any);
    const html = renderInline('[[Foo]]', idx2);
    expect(html).toContain('data-desc="stacks with &#42;Weapon Focus&#42;"');
    expect(html).not.toContain('<i>');
  });
});
