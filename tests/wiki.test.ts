import { describe, it, expect } from 'bun:test';
import { wikiUrl } from '../src/lib/wiki';

describe('wikiUrl', () => {
  it('builds a fextralife URL from a slug', () => {
    expect(wikiUrl('Deadly+Aim')).toBe(
      'https://pathfinderwrathoftherighteous.wiki.fextralife.com/Deadly+Aim'
    );
  });
  it('preserves parentheses in slugs', () => {
    expect(wikiUrl('Improved+Critical+(Mythic)')).toContain('Improved+Critical+(Mythic)');
  });
});
