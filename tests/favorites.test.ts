import { test, expect } from 'bun:test';
import { createFavoritesStore, type StorageLike } from '../src/lib/favorites';

function fakeStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => (m.has(k) ? m.get(k)! : null), setItem: (k, v) => { m.set(k, v); } };
}

test('toggleStar adds newest-first and removes on second toggle', () => {
  const s = createFavoritesStore(fakeStorage());
  s.toggleStar('a');
  s.toggleStar('b');
  expect(s.getStarred()).toEqual(['b', 'a']);
  expect(s.isStarred('a')).toBe(true);
  s.toggleStar('a');
  expect(s.getStarred()).toEqual(['b']);
  expect(s.isStarred('a')).toBe(false);
});

test('recordView moves to front, dedupes, caps at 10', () => {
  const s = createFavoritesStore(fakeStorage());
  for (let i = 0; i < 12; i++) s.recordView(`b${i}`);
  s.recordView('b3');
  const recent = s.getRecent();
  expect(recent[0]).toBe('b3');
  expect(recent.length).toBe(10);
  expect(recent.filter((x) => x === 'b3').length).toBe(1);
});

test('getView defaults to directory; setView persists', () => {
  const s = createFavoritesStore(fakeStorage());
  expect(s.getView()).toBe('directory');
  s.setView('foryou');
  expect(s.getView()).toBe('foryou');
});

test('subscribe fires on mutation and unsubscribe stops it', () => {
  const s = createFavoritesStore(fakeStorage());
  let n = 0;
  const off = s.subscribe(() => { n++; });
  s.toggleStar('a');
  s.recordView('a');
  s.setView('foryou');
  expect(n).toBe(3);
  off();
  s.toggleStar('b');
  expect(n).toBe(3);
});

test('corrupt storage value degrades to empty', () => {
  const store = fakeStorage();
  store.setItem('kc:starred', 'not json');
  const s = createFavoritesStore(store);
  expect(s.getStarred()).toEqual([]);
});
