import { describe, it, expect } from 'bun:test';
import { normalizeKey } from '../src/lib/normalize';

describe('normalizeKey', () => {
  it('collapses spacing and punctuation so variants collide', () => {
    expect(normalizeKey('Point-Blank Shot')).toBe(normalizeKey('Point Blank Shot'));
    expect(normalizeKey('Point Blank Shot')).toBe('pointblankshot');
  });
  it('handles parentheses and apostrophes', () => {
    expect(normalizeKey("Death Dealer's (Mythic)")).toBe('deathdealersmythic');
  });
});
