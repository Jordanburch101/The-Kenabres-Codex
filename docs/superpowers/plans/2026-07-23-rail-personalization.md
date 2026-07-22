# Rail Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Directory⇄For You toggle, build starring (hero + rail hover), a Recently Viewed list, and a curator-controlled Featured section to the rail — all client-side via localStorage.

**Architecture:** Two React islands (`RailNav`, `StarButton`) share one `localStorage`-backed `favorites` store. Pure list-composition helpers live in `src/lib/rail.ts`; the store lives in `src/lib/favorites.ts`. The Featured section is data-driven (renders server-side from a new `featured` schema field); starred/recent/selected-view are client state reconciled on mount to avoid hydration mismatch.

**Tech Stack:** Astro 5, `@astrojs/react` + React 19 (added by this plan), TypeScript, Bun (runtime + `bun:test`).

## Global Constraints

- **Bun only** — `bun`/`bunx`, never npm/npx/node. Add deps with `bun add`. Tests use `bun:test`.
- `bun run build` **must stay green** (fails on unknown `[[glossary term]]`). Note: `bun run build` does NOT type-check, so React JSX transpiles via the integration regardless of tsconfig.
- **No base64 images**; **preserve the ported visual design** — this adds chrome/behavior only, no restyle of existing rows or sections.
- **Reuse existing rail chrome CSS** (`.rail`, `.rail-head`, `.rail-div`, `.nav`, `.nav-name`, `.nav-role`, `.nav.active`, `.rail-list`, `.rail-onpage`, `.rail-sec`, the `@media (max-width:860px)` collapse). Net-new CSS limited to `.nav--build`, `.rail-star`, `.rail-toggle`, `.rail-empty`, `.star-btn`.
- **React islands** per the design decision; only `RailNav` and `StarButton` hydrate.
- **Hydration-safe:** server + first client render show the **Directory default with no stars**; the mount effect reconciles to stored state.
- **Graceful degradation:** if `localStorage` is unavailable/blocked, the store falls back to in-memory (never throws).
- localStorage keys: `kc:starred`, `kc:recent`, `kc:view`. Starred = newest-first. Recent stored cap = 10, For You shows 6 excluding starred.

---

### Task 1: React integration + `featured` schema field + seed

**Files:**
- Modify: `package.json` + lockfile (via `bun add`)
- Modify: `astro.config.mjs`
- Modify: `src/lib/schemas.ts:39` (add `featured` to `buildSchema`)
- Modify: `src/content/builds/demonslayer.yaml`, `src/content/builds/camellia.yaml` (seed ranks)

**Interfaces:**
- Produces: `@astrojs/react` integration enabling `.tsx` islands; `Build.featured?: number`.

- [ ] **Step 1: Add React dependencies**

Run:
```bash
bun add @astrojs/react react react-dom
bun add -d @types/react @types/react-dom
```
Expected: deps added to `package.json`, `bun.lock` updated.

- [ ] **Step 2: Register the integration**

Replace `astro.config.mjs` with:
```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://the-kenabres-codex.vercel.app',
  integrations: [react()],
  // static output (default); Vercel serves dist/ as-is
});
```

- [ ] **Step 3: Add the `featured` field to the build schema**

In `src/lib/schemas.ts`, inside `buildSchema`, add the `featured` line right after `difficultyTarget`:
```ts
  difficultyTarget: z.string().optional(),
  featured: z.number().optional(), // curator rank; lower = higher. Unset ⇒ not featured.
```

- [ ] **Step 4: Seed an initial featured ranking (flagged for curator adjustment)**

Add a top-level `featured:` key to two builds (YAML key order is irrelevant; place it after the existing `role:` line). These are **placeholders for the curator to re-rank**:
- `src/content/builds/demonslayer.yaml`: add `featured: 1`
- `src/content/builds/camellia.yaml`: add `featured: 2`

- [ ] **Step 5: Verify the build**

Run: `bun run build`
Expected: build succeeds, 8 pages, no errors. (No islands mounted yet; the integration + schema change must not break the build.)

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock astro.config.mjs src/lib/schemas.ts src/content/builds/demonslayer.yaml src/content/builds/camellia.yaml
git commit -m "feat: add React integration + featured build field (seeded)"
```

---

### Task 2: The `favorites` localStorage store

**Files:**
- Create: `src/lib/favorites.ts`
- Test: `tests/favorites.test.ts`

**Interfaces:**
- Produces: `type RailView = 'directory' | 'foryou'`; `interface StorageLike { getItem; setItem }`; `interface FavoritesStore { getStarred, isStarred, toggleStar, getRecent, recordView, getView, setView, subscribe }`; `createFavoritesStore(storage): FavoritesStore`; singleton `favorites`.

- [ ] **Step 1: Write the failing tests**

Create `tests/favorites.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/favorites.test.ts`
Expected: FAIL (cannot resolve `../src/lib/favorites`).

- [ ] **Step 3: Implement `src/lib/favorites.ts`**

```ts
// Client-side personalization store (localStorage-backed), shared by the rail
// island and the hero star button. Factory form so tests inject a fake storage.

export type RailView = 'directory' | 'foryou';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface FavoritesStore {
  getStarred(): string[];
  isStarred(slug: string): boolean;
  toggleStar(slug: string): void;
  getRecent(): string[];
  recordView(slug: string): void;
  getView(): RailView;
  setView(v: RailView): void;
  subscribe(cb: () => void): () => void;
}

const K_STARRED = 'kc:starred';
const K_RECENT = 'kc:recent';
const K_VIEW = 'kc:view';
const RECENT_CAP = 10;

function readArray(storage: StorageLike, key: string): string[] {
  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeArray(storage: StorageLike, key: string, value: string[]): void {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function createFavoritesStore(storage: StorageLike): FavoritesStore {
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((cb) => cb());

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('kc:')) emit();
    });
  }

  return {
    getStarred: () => readArray(storage, K_STARRED),
    isStarred: (slug) => readArray(storage, K_STARRED).includes(slug),
    toggleStar(slug) {
      const cur = readArray(storage, K_STARRED);
      const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [slug, ...cur];
      writeArray(storage, K_STARRED, next);
      emit();
    },
    getRecent: () => readArray(storage, K_RECENT),
    recordView(slug) {
      const cur = readArray(storage, K_RECENT);
      const next = [slug, ...cur.filter((s) => s !== slug)].slice(0, RECENT_CAP);
      writeArray(storage, K_RECENT, next);
      emit();
    },
    getView() {
      try {
        return storage.getItem(K_VIEW) === 'foryou' ? 'foryou' : 'directory';
      } catch { return 'directory'; }
    },
    setView(v) {
      try { storage.setItem(K_VIEW, v); } catch { /* ignore */ }
      emit();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
  };
}

function safeStorage(): StorageLike {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__kc_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch { /* fall through to in-memory */ }
  const mem = new Map<string, string>();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k, v) => { mem.set(k, v); },
  };
}

export const favorites: FavoritesStore = createFavoritesStore(safeStorage());
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/favorites.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/favorites.ts tests/favorites.test.ts
git commit -m "feat: add localStorage-backed favorites store"
```

---

### Task 3: Pure rail composition helpers (`featuredBuilds`, `forYouSections`)

**Files:**
- Modify: `src/lib/rail.ts`
- Test: `tests/rail.test.ts` (append cases)

**Interfaces:**
- Consumes: `Build` (now with `featured`).
- Produces: `RailBuild` extended to include `featured`; `featuredBuilds(builds): RailBuild[]`; `forYouSections(builds, starredSlugs, recentSlugs, cap?): { starred: RailBuild[]; recent: RailBuild[] }`. (`groupBuilds`, `shortName` unchanged.)

- [ ] **Step 1: Write the failing tests (append to `tests/rail.test.ts`)**

Add these imports/tests to the existing `tests/rail.test.ts` (extend the import line to include the new functions):
```ts
import { groupBuilds, shortName, featuredBuilds, forYouSections, type RailBuild } from '../src/lib/rail';

// ... existing tests stay ...

const fb = (slug: string, name: string, featured?: number): RailBuild =>
  ({ slug, name, kind: 'companion', class: 'X', role: 'Y', featured });

test('featuredBuilds: only ranked, sorted by rank then name', () => {
  const out = featuredBuilds([
    fb('c', 'Camellia', 2),
    fb('a', 'Ada'),          // unranked -> excluded
    fb('d', 'Demon', 1),
    fb('e', 'Ember', 2),     // same rank as Camellia -> name breaks tie
  ]);
  expect(out.map((b) => b.slug)).toEqual(['d', 'c', 'e']);
});

test('forYouSections: starred order preserved; recent excludes starred and caps', () => {
  const builds = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => fb(s, s.toUpperCase()));
  const { starred, recent } = forYouSections(
    builds,
    ['b', 'a'],                               // starred, newest-first
    ['a', 'c', 'd', 'e', 'f', 'g', 'b'],      // recent, most-recent-first
    3,
  );
  expect(starred.map((x) => x.slug)).toEqual(['b', 'a']);
  expect(recent.map((x) => x.slug)).toEqual(['c', 'd', 'e']); // excludes a,b; capped at 3
});

test('forYouSections: stale slugs (not in builds) are dropped', () => {
  const builds = [fb('a', 'A')];
  const { starred, recent } = forYouSections(builds, ['ghost'], ['gone', 'a'], 6);
  expect(starred).toEqual([]);
  expect(recent.map((x) => x.slug)).toEqual(['a']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/rail.test.ts`
Expected: FAIL (`featuredBuilds`/`forYouSections` not exported).

- [ ] **Step 3: Extend `src/lib/rail.ts`**

Change the `RailBuild` type to include `featured`, and append the two helpers:
```ts
export type RailBuild = Pick<Build, 'slug' | 'name' | 'kind' | 'class' | 'role' | 'featured'>;
```
Append at the end of the file:
```ts
export function featuredBuilds(builds: RailBuild[]): RailBuild[] {
  return builds
    .filter((b) => b.featured != null)
    .sort((a, b) => (a.featured! - b.featured!) || a.name.localeCompare(b.name));
}

export function forYouSections(
  builds: RailBuild[],
  starredSlugs: string[],
  recentSlugs: string[],
  cap = 6,
): { starred: RailBuild[]; recent: RailBuild[] } {
  const bySlug = new Map(builds.map((b) => [b.slug, b]));
  const starred = starredSlugs.map((s) => bySlug.get(s)).filter((b): b is RailBuild => !!b);
  const starredSet = new Set(starredSlugs);
  const recent = recentSlugs
    .filter((s) => !starredSet.has(s))
    .map((s) => bySlug.get(s))
    .filter((b): b is RailBuild => !!b)
    .slice(0, cap);
  return { starred, recent };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/rail.test.ts`
Expected: PASS (existing 4 + 3 new = 7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rail.ts tests/rail.test.ts
git commit -m "feat: add featuredBuilds + forYouSections rail helpers"
```

---

### Task 4: `RailNav` island + rail CSS + wire into `Rail.astro`

**Files:**
- Create: `src/components/RailNav.tsx`
- Modify: `src/styles/global.css` (append `.nav--build`, `.rail-star`, `.rail-toggle`, `.rail-empty`)
- Modify: `src/components/Rail.astro` (mount the island; keep static onpage + reference)

**Interfaces:**
- Consumes: `groupBuilds`, `featuredBuilds`, `forYouSections`, `shortName`, `RailBuild` (rail.ts); `favorites`, `RailView` (favorites.ts).
- Props: `{ builds: RailBuild[]; activeSlug?: string }`.

- [ ] **Step 1: Create `src/components/RailNav.tsx`**

```tsx
import { Fragment, useEffect, useState } from 'react';
import { groupBuilds, featuredBuilds, forYouSections, shortName, type RailBuild } from '../lib/rail';
import { favorites, type RailView } from '../lib/favorites';

interface Props {
  builds: RailBuild[];
  activeSlug?: string;
}

function Row({ b, activeSlug, starred, onToggle }: {
  b: RailBuild; activeSlug?: string; starred: boolean; onToggle: (slug: string) => void;
}) {
  const name = shortName(b.name);
  return (
    <a className={`nav nav--build${b.slug === activeSlug ? ' active' : ''}`} href={`/builds/${b.slug}`}>
      <span className="nav-txt">
        <span className="nav-name">{name}</span>
        <span className="nav-role">{b.class} · {b.role}</span>
      </span>
      <button
        type="button"
        className={`rail-star${starred ? ' filled' : ''}`}
        aria-pressed={starred}
        aria-label={starred ? `Unstar ${name}` : `Star ${name}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(b.slug); }}
      >{starred ? '★' : '☆'}</button>
    </a>
  );
}

export default function RailNav({ builds, activeSlug }: Props) {
  const [view, setView] = useState<RailView>('directory');
  const [starred, setStarred] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => {
      setView(favorites.getView());
      setStarred(favorites.getStarred());
      setRecent(favorites.getRecent());
    };
    if (activeSlug) favorites.recordView(activeSlug);
    sync();
    return favorites.subscribe(sync);
  }, [activeSlug]);

  const isStarred = (slug: string) => starred.includes(slug);
  const toggle = (slug: string) => favorites.toggleStar(slug);

  const featured = featuredBuilds(builds);
  const groups = groupBuilds(builds);
  const foryou = forYouSections(builds, starred, recent);

  return (
    <>
      <div className="rail-toggle" role="tablist" aria-label="Rail view">
        <button type="button" role="tab" aria-selected={view === 'directory'}
          className={view === 'directory' ? 'on' : ''}
          onClick={() => favorites.setView('directory')}>Directory</button>
        <button type="button" role="tab" aria-selected={view === 'foryou'}
          className={view === 'foryou' ? 'on' : ''}
          onClick={() => favorites.setView('foryou')}>For You</button>
      </div>

      <nav className="rail-list">
        {view === 'directory' ? (
          <>
            {featured.length > 0 && (
              <>
                <div className="rail-div">★ Featured</div>
                {featured.map((b) => (
                  <Row key={`f-${b.slug}`} b={b} activeSlug={activeSlug} starred={isStarred(b.slug)} onToggle={toggle} />
                ))}
              </>
            )}
            {groups.map((g) => (
              <Fragment key={g.kind}>
                <div className="rail-div">{g.label}</div>
                {g.builds.map((b) => (
                  <Row key={`${g.kind}-${b.slug}`} b={b} activeSlug={activeSlug} starred={isStarred(b.slug)} onToggle={toggle} />
                ))}
              </Fragment>
            ))}
          </>
        ) : (
          <>
            {foryou.starred.length === 0 && foryou.recent.length === 0 && (
              <div className="rail-empty">
                <span className="rail-empty-star">☆</span>
                Star a build to pin it here. Builds you open will show up under Recently Viewed.
              </div>
            )}
            {foryou.starred.length > 0 && (
              <>
                <div className="rail-div">Starred</div>
                {foryou.starred.map((b) => (
                  <Row key={`s-${b.slug}`} b={b} activeSlug={activeSlug} starred={true} onToggle={toggle} />
                ))}
              </>
            )}
            {foryou.recent.length > 0 && (
              <>
                <div className="rail-div">Recently Viewed</div>
                {foryou.recent.map((b) => (
                  <Row key={`r-${b.slug}`} b={b} activeSlug={activeSlug} starred={isStarred(b.slug)} onToggle={toggle} />
                ))}
              </>
            )}
          </>
        )}
      </nav>
    </>
  );
}
```

- [ ] **Step 2: Append the CSS**

Append to `src/styles/global.css`:
```css
  /* rail personalization */
  .rail-toggle { display:flex; gap:3px; margin:13px 12px 4px; padding:3px; border-radius:7px;
    background:rgba(0,0,0,.35); border:1px solid rgba(181,146,74,.22); }
  .rail-toggle button { flex:1; appearance:none; cursor:pointer; border:0; border-radius:5px; padding:6px 4px;
    font-family:var(--serif); font-size:11px; font-variant:small-caps; letter-spacing:.08em; color:#a98a5a; background:transparent; }
  .rail-toggle button.on { color:#f6e7c6; background:linear-gradient(180deg,var(--wine-br),var(--wine-2)); box-shadow:inset 0 0 0 1px var(--bronze-br); }
  .rail-toggle button:focus-visible { outline:2px solid var(--bronze-br); outline-offset:1px; }

  .nav--build { flex-direction:row; align-items:center; justify-content:space-between; gap:8px; }
  .nav--build .nav-txt { display:flex; flex-direction:column; gap:2px; min-width:0; }
  .rail-star { flex:0 0 auto; appearance:none; border:0; background:transparent; cursor:pointer;
    font-size:14px; line-height:1; padding:2px 3px; color:#8a7550; opacity:0; transition:opacity .12s ease, color .12s ease; }
  .nav--build:hover .rail-star, .nav--build.active .rail-star { opacity:1; }
  .rail-star.filled { opacity:1; color:var(--bronze-br); }
  .rail-star:hover { color:var(--bronze-br); }
  .rail-star:focus-visible { opacity:1; outline:2px solid var(--bronze-br); outline-offset:1px; }

  .rail-empty { margin:16px 14px; padding:16px; border:1px dashed rgba(181,146,74,.3); border-radius:6px;
    text-align:center; color:#8c7c5d; font-size:12px; font-style:italic; line-height:1.5; }
  .rail-empty-star { display:block; font-size:22px; color:#6d5c3c; margin-bottom:8px; }
```

- [ ] **Step 3: Wire the island into `src/components/Rail.astro`**

Replace the entire file with:
```astro
---
import { getCollection } from 'astro:content';
import RailNav from './RailNav';
import type { SectionRef } from '../lib/sections';
import type { RailBuild } from '../lib/rail';

interface Props {
  activeSlug?: string;
  sections?: SectionRef[];
}
const { activeSlug, sections = [] } = Astro.props;

const builds: RailBuild[] = (await getCollection('builds')).map((b) => ({
  slug: b.data.slug,
  name: b.data.name,
  kind: b.data.kind,
  class: b.data.class,
  role: b.data.role,
  featured: b.data.featured,
}));
---
<aside class="rail" aria-label="Party builds">
  <div class="rail-head">
    <p class="rail-kicker">Pathfinder · WOTR</p>
    <p class="rail-title">Kenabres Codex</p>
    <div class="rail-rule"></div>
  </div>

  <RailNav client:load builds={builds} activeSlug={activeSlug} />

  {sections.length > 0 && (
    <nav class="rail-list rail-onpage">
      <div class="rail-div">On this page</div>
      {sections.map((s) => (
        <a class="rail-sec" href={`#${s.id}`}>{s.label}</a>
      ))}
    </nav>
  )}

  <nav class="rail-list">
    <div class="rail-div">Reference</div>
    <a class="nav" href="/codex">
      <span class="nav-name">The Codex</span>
      <span class="nav-role">Feats · Spells · Mechanics</span>
    </a>
  </nav>
</aside>
```

- [ ] **Step 4: Verify the build**

Run: `bun run build`
Expected: build succeeds, 8 pages, no errors (the island bundles; `client:load` emits hydration JS).

- [ ] **Step 5: Commit**

```bash
git add src/components/RailNav.tsx src/styles/global.css src/components/Rail.astro
git commit -m "feat: RailNav island (toggle + featured + starred + recently viewed)"
```

---

### Task 5: `StarButton` island + wire into `BuildHero.astro` + hero CSS

**Files:**
- Create: `src/components/StarButton.tsx`
- Modify: `src/components/BuildHero.astro` (import + render the button; destructure `slug`)
- Modify: `src/styles/global.css` (append `.star-btn`)

**Interfaces:**
- Consumes: `favorites` (favorites.ts).
- Props: `{ slug: string }`.

- [ ] **Step 1: Create `src/components/StarButton.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { favorites } from '../lib/favorites';

export default function StarButton({ slug }: { slug: string }) {
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    const sync = () => setStarred(favorites.isStarred(slug));
    sync();
    return favorites.subscribe(sync);
  }, [slug]);

  return (
    <button
      type="button"
      className={`star-btn${starred ? ' on' : ''}`}
      aria-pressed={starred}
      onClick={() => favorites.toggleStar(slug)}
    >
      <span aria-hidden="true">{starred ? '★' : '☆'}</span>
      {starred ? 'Starred' : 'Star'}
    </button>
  );
}
```

- [ ] **Step 2: Render it in `src/components/BuildHero.astro`**

Add the import below the existing component imports:
```astro
import StarButton from './StarButton';
```
Add `slug` to the destructured props (add it to the existing `const { ... } = Astro.props;` list):
```astro
  slug,
```
Render the button as the first child inside `.hero` (immediately after `<div class="hero">`):
```astro
<div class="hero">
  <StarButton client:load slug={slug} />
  <h2 class="btitle">{title}</h2>
```

- [ ] **Step 3: Append the hero star CSS**

Append to `src/styles/global.css`:
```css
  .star-btn { position:absolute; top:14px; right:16px; z-index:2; appearance:none; cursor:pointer;
    display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:3px;
    font-family:var(--serif); font-size:12px; font-variant:small-caps; letter-spacing:.06em;
    color:var(--wine); background:rgba(255,250,238,.55); border:1px solid var(--bronze-line); }
  .star-btn:hover { color:#fff; background:var(--wine); border-color:var(--bronze-br); }
  .star-btn.on { color:#2a1e0a; background:linear-gradient(180deg,#d8b467,#b78f3d); border-color:#e0c07a; }
  .star-btn:focus-visible { outline:2px solid var(--bronze-br); outline-offset:2px; }
```

- [ ] **Step 4: Verify build + full suite**

Run: `bun run build`
Expected: succeeds, 8 pages, no errors.
Run: `bun test`
Expected: PASS — prior 35 + favorites(5) + rail(3 new) = 43.

- [ ] **Step 5: Commit**

```bash
git add src/components/StarButton.tsx src/components/BuildHero.astro src/styles/global.css
git commit -m "feat: hero StarButton island + star control styling"
```

---

## Self-Review

**Spec coverage:**
- React islands prerequisite (integration install + config) → Task 1. ✓
- `featured` schema field + seed → Task 1. ✓
- `favorites` store (factory, keys, star newest-first, recent cap/dedupe, view, subscribe, graceful degradation, cross-tab) → Task 2 (tested). ✓
- Pure helpers `featuredBuilds` + `forYouSections` (rank order, starred order, recent-excludes-starred + cap, stale-slug drop) → Task 3 (tested). ✓
- Directory view (Featured on top + groups) + For You view (Starred + Recently Viewed + empty state) + toggle + row hover star + recordView on mount → Task 4. ✓
- Hero star button → Task 5. ✓
- Hydration-safe defaults (Directory/no stars on SSR + first render, effect reconciles) → Tasks 4 & 5 (`useState` defaults + `useEffect`). ✓
- Reuse chrome CSS; net-new limited to the five named classes; static Reference row keeps column layout via `.nav--build` modifier (not a global `.nav` change) → Tasks 4 & 5. ✓
- Responsive: `.rail-onpage` stays hidden on mobile (unchanged); toggle + rows wrap → no media changes needed. ✓
- Out of scope (roster, sync, analytics, drag-reorder) → not present. ✓

**Placeholder scan:** No TBD/TODO; complete code in every code step. The seeded `featured` ranks are intentional placeholders, explicitly flagged in Task 1 Step 4. ✓

**Type consistency:** `RailBuild` gains `featured` in Task 3 and is the prop element type used by `Rail.astro` (Task 4 Step 3) and `RailNav` (Task 4 Step 1). `favorites`/`RailView` from Task 2 are consumed identically in Tasks 4 & 5. `createFavoritesStore(storage)` signature matches the Task 2 test usage. `featuredBuilds`/`forYouSections` signatures match their Task 3 tests and their `RailNav` call sites. ✓
