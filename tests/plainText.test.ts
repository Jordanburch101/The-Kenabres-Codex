import { test, expect } from 'bun:test';
import { toPlainText } from '../src/lib/plainText';

test('strips bold, italic, and code markers', () => {
  expect(toPlainText('a **bold** and *italic* and `code` end'))
    .toBe('a bold and italic and code end');
});

test('resolves [[Term]] to the term text', () => {
  expect(toPlainText('cast [[Stinking Cloud]] now')).toBe('cast Stinking Cloud now');
});

test('resolves [[Term|Display]] to the display text', () => {
  expect(toPlainText('a [[Shaman|shaman dip]] here')).toBe('a shaman dip here');
});

test('resolves [[Term|no-wiki]] to the term (no-wiki is not a display alias)', () => {
  expect(toPlainText('use [[Best Jokes|no-wiki]] often')).toBe('use Best Jokes often');
});

test('decodes common HTML entities', () => {
  expect(toPlainText('demons &mdash; Trap &amp; Lock')).toBe('demons — Trap & Lock');
});

test('handles a real summary fragment', () => {
  expect(toPlainText('One spell renders a whole pack useless: **[[Stinking Cloud]]** nauseates enemies'))
    .toBe('One spell renders a whole pack useless: Stinking Cloud nauseates enemies');
});
