import { describe, it, expect } from 'bun:test';
import { valueKind, statGridClass } from '../src/lib/stats';

describe('valueKind', () => {
  it('treats all-digit values as numbers', () => {
    expect(valueKind('20')).toBe('num');
    expect(valueKind('12')).toBe('num');
    expect(valueKind(' 18 ')).toBe('num'); // tolerant of whitespace
  });
  it('treats non-digit values as words', () => {
    expect(valueKind('MAX')).toBe('word');
    expect(valueKind('DUMP')).toBe('word');
    expect(valueKind('base')).toBe('word');
    expect(valueKind('MAX / buff')).toBe('word');
    expect(valueKind('—')).toBe('word');
  });
});

describe('statGridClass', () => {
  it('uses the full 6-column grid only when all six stats are present', () => {
    expect(statGridClass(6)).toBe('stats--full');
  });
  it('uses the left-aligned few layout for fewer than six stats', () => {
    expect(statGridClass(2)).toBe('stats--few');
    expect(statGridClass(3)).toBe('stats--few');
    expect(statGridClass(4)).toBe('stats--few');
  });
});
