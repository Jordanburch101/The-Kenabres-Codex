# Home Directory Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary home page with a filterable build directory — logo-banner masthead (site-wide), search + Kind/Role/Class filters, and a grid of rich index cards.

**Architecture:** Astro static site. `index.astro` computes the sorted build list + filter facets + plain-text summaries at build time and renders all cards as static HTML via a single React island (`BuildDirectory.tsx`, `client:load`) that owns search/filter state and per-card favorite stars. Pure, testable helpers (`directory.ts`, `plainText.ts`) hold all logic; the island is a thin view. Reuses the existing `favorites` store and the `RailNav.Row` sibling-link-+-button markup pattern (no nested interactive elements).

**Tech Stack:** Astro 5, React 19 islands, TypeScript, Bun (runtime + `bun:test`), existing `global.css` design tokens.

**Design spec:** [`docs/superpowers/specs/2026-07-23-home-directory-design.md`](../specs/2026-07-23-home-directory-design.md)

## Global Constraints

- **Toolchain:** Bun only — `bun` / `bunx`, never `npm`/`npx`/`node`. Tests use `bun:test`. Run all: `bun test`. Build: `bun run build`.
- **Tests** live in `tests/<module>.test.ts`, import from `bun:test` and from `../src/lib/<module>`.
- **Content invariant:** authored strings never contain raw HTML tags; the inline renderer generates all tags. `toPlainText` only strips markup — it never emits HTML.
- **Images are WebP files on disk** in `public/` — never inline base64.
- **Preserve the ported visual design.** Use only the existing CSS custom properties (`--parch`, `--wine`, `--bronze-line`, `--ink*`, etc.) and the `--serif` font. Do not restyle build pages beyond the shared masthead swap.
- **Accessibility:** a `<button>` must never be nested inside an `<a>` (see commit `b6e8d44`). Card link and star button are siblings.
- **Intro copy (verbatim):**
  - Eyebrow: `Companion & Mercenary Builds`
  - Heading: `Browse the Builds`
  - Lead: `Detailed WOTR build guides — one page each, with stats, level-by-level progression, gear, and tactics. Every feat, spell, and mechanic links to a shared codex you can look up in a click.`

---

### Task 1: `plainText.ts` — strip inline markup for card snippets

**Files:**
- Create: `src/lib/plainText.ts`
- Test: `tests/plainText.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `toPlainText(input: string): string` — resolves `[[Term]]` / `[[Term|Display]]` / `[[Term|no-wiki]]` to the display term (same semantics as `resolveTerm`), strips `**bold**` / `*italic*` / `` `code` ``, decodes common HTML entities, and trims. Emits plain text only (no HTML).

- [ ] **Step 1: Write the failing test**

Create `tests/plainText.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/plainText.test.ts`
Expected: FAIL — `toPlainText` cannot be found / module missing.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/plainText.ts`:

```ts
// Strip the authored inline markup (bold/italic/code + [[glossary]] refs) and
// decode the handful of HTML entities used in build summaries, producing a
// plain-text snippet for directory cards. Mirrors the [[term]] display / no-wiki
// semantics of resolveTerm (glossary.ts) and the markdown subset of inline.ts,
// but emits text instead of HTML.

const ENTITIES: Record<string, string> = {
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export function toPlainText(input: string): string {
  let s = input;

  // [[Term]] / [[Term|Display]] / [[Term|no-wiki]] -> display term.
  // Matches resolveTerm: display = alias unless alias is 'no-wiki'.
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, raw: string) => {
    const [term, alias] = raw.split('|').map((x) => x.trim());
    return alias && alias !== 'no-wiki' ? alias : term;
  });

  // Inline markdown: bold before italic (mirrors inline.ts ordering).
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1$2');
  s = s.replace(/`([^`]+)`/g, '$1');

  // Decode the entities the summaries actually use; leave unknown ones intact.
  s = s.replace(/&[a-zA-Z]+;|&#\d+;/g, (m) => ENTITIES[m] ?? m);

  return s.trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/plainText.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/plainText.ts tests/plainText.test.ts
git commit -m "feat: toPlainText helper for directory card summaries"
```

---

### Task 2: `directory.ts` — build-time data shaping (sort, facets, filter)

**Files:**
- Create: `src/lib/directory.ts`
- Test: `tests/directory.test.ts`

**Interfaces:**
- Consumes: `Build` type from `./schemas`; `toPlainText` from `./plainText`.
- Produces:
  - `interface DirBuild { slug; name; tagline; className; role; kind: 'companion'|'mc'|'mercenary'; kindLabel; difficulty?; badges: {label; style}[]; summary; tags: string[]; featured?: number }`
  - `interface Facets { kinds: {value: string; label: string}[]; roles: string[]; classes: string[] }`
  - `interface DirFilter { query: string; kind: string; role: string; className: string }` (`''` means "all")
  - `kindLabel(kind: string): string`
  - `toDirBuild(b: Build): DirBuild`
  - `sortBuilds(builds: DirBuild[]): DirBuild[]` — featured asc (unset last), then name `localeCompare`
  - `facets(builds: DirBuild[]): Facets`
  - `filterBuilds(builds: DirBuild[], f: DirFilter): DirBuild[]`

- [ ] **Step 1: Write the failing test**

Create `tests/directory.test.ts`:

```ts
import { test, expect } from 'bun:test';
import {
  kindLabel, sortBuilds, facets, filterBuilds, type DirBuild,
} from '../src/lib/directory';

const mk = (over: Partial<DirBuild>): DirBuild => ({
  slug: 's', name: 'N', tagline: 'T', className: 'Cleric', role: 'Tank',
  kind: 'companion', kindLabel: 'Companion', badges: [], summary: '', tags: [],
  ...over,
});

test('kindLabel maps mc to Main Character', () => {
  expect(kindLabel('mc')).toBe('Main Character');
  expect(kindLabel('companion')).toBe('Companion');
  expect(kindLabel('mercenary')).toBe('Mercenary');
});

test('sortBuilds: featured asc (unset last), then alphabetical', () => {
  const out = sortBuilds([
    mk({ slug: 'z', name: 'Zed' }),
    mk({ slug: 'a', name: 'Aaron' }),
    mk({ slug: 'd', name: 'Demon Slayer', featured: 1 }),
    mk({ slug: 'c', name: 'Camellia', featured: 2 }),
  ]).map((b) => b.slug);
  expect(out).toEqual(['d', 'c', 'a', 'z']);
});

test('facets: present-only, deduped, sorted; kinds carry labels in fixed order', () => {
  const f = facets([
    mk({ kind: 'companion', role: 'Tank', className: 'Paladin' }),
    mk({ kind: 'companion', role: 'Tank', className: 'Cleric' }),
    mk({ kind: 'mc', role: 'Ranged DPS', className: 'Ranger' }),
  ]);
  expect(f.kinds).toEqual([
    { value: 'mc', label: 'Main Character' },
    { value: 'companion', label: 'Companion' },
  ]);
  expect(f.roles).toEqual(['Ranged DPS', 'Tank']);
  expect(f.classes).toEqual(['Cleric', 'Paladin', 'Ranger']);
});

test('filterBuilds: kind/role/class equality and empty = all', () => {
  const builds = [
    mk({ slug: 'tank', kind: 'companion', role: 'Tank', className: 'Paladin' }),
    mk({ slug: 'dps', kind: 'mc', role: 'Ranged DPS', className: 'Ranger' }),
  ];
  const all = { query: '', kind: '', role: '', className: '' };
  expect(filterBuilds(builds, all).map((b) => b.slug)).toEqual(['tank', 'dps']);
  expect(filterBuilds(builds, { ...all, kind: 'mc' }).map((b) => b.slug)).toEqual(['dps']);
  expect(filterBuilds(builds, { ...all, role: 'Tank' }).map((b) => b.slug)).toEqual(['tank']);
  expect(filterBuilds(builds, { ...all, className: 'Ranger' }).map((b) => b.slug)).toEqual(['dps']);
});

test('filterBuilds: query is case-insensitive across name, tagline, class, role, tags', () => {
  const builds = [
    mk({ slug: 'a', name: 'Camellia', tagline: 'Shaman', className: 'Shaman', role: 'Crowd Control', tags: ['poison'] }),
    mk({ slug: 'b', name: 'Seelah', tagline: 'Paladin', className: 'Paladin', role: 'Tank', tags: ['high-ac'] }),
  ];
  const base = { kind: '', role: '', className: '' };
  expect(filterBuilds(builds, { ...base, query: 'POISON' }).map((b) => b.slug)).toEqual(['a']);
  expect(filterBuilds(builds, { ...base, query: 'seel' }).map((b) => b.slug)).toEqual(['b']);
  expect(filterBuilds(builds, { ...base, query: 'crowd' }).map((b) => b.slug)).toEqual(['a']);
  expect(filterBuilds(builds, { ...base, query: '' }).length).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/directory.test.ts`
Expected: FAIL — module `../src/lib/directory` not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/directory.ts`:

```ts
import type { Build } from './schemas';
import { toPlainText } from './plainText';

export interface DirBuild {
  slug: string;
  name: string;
  tagline: string;
  className: string;
  role: string;
  kind: 'companion' | 'mc' | 'mercenary';
  kindLabel: string;
  difficulty?: string;
  badges: { label: string; style: 'gold' | 'crim' | 'plain' }[];
  summary: string;
  tags: string[];
  featured?: number;
}

export interface Facets {
  kinds: { value: string; label: string }[];
  roles: string[];
  classes: string[];
}

export interface DirFilter {
  query: string;
  kind: string;
  role: string;
  className: string;
}

const KIND_LABEL: Record<string, string> = {
  mc: 'Main Character',
  companion: 'Companion',
  mercenary: 'Mercenary',
};
const KIND_ORDER = ['mc', 'companion', 'mercenary'];

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function toDirBuild(b: Build): DirBuild {
  return {
    slug: b.slug,
    name: b.name,
    tagline: b.tagline,
    className: b.class,
    role: b.role,
    kind: b.kind,
    kindLabel: kindLabel(b.kind),
    difficulty: b.difficultyTarget,
    badges: (b.badges ?? []).slice(0, 2),
    summary: toPlainText(b.summary),
    tags: b.tags ?? [],
    featured: b.featured,
  };
}

export function sortBuilds(builds: DirBuild[]): DirBuild[] {
  return [...builds].sort((a, b) => {
    const fa = a.featured ?? Infinity;
    const fb = b.featured ?? Infinity;
    if (fa !== fb) return fa - fb;
    return a.name.localeCompare(b.name);
  });
}

export function facets(builds: DirBuild[]): Facets {
  const uniqSorted = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
  const kinds = KIND_ORDER
    .filter((k) => builds.some((b) => b.kind === k))
    .map((k) => ({ value: k, label: kindLabel(k) }));
  return {
    kinds,
    roles: uniqSorted(builds.map((b) => b.role)),
    classes: uniqSorted(builds.map((b) => b.className)),
  };
}

export function filterBuilds(builds: DirBuild[], f: DirFilter): DirBuild[] {
  const q = f.query.trim().toLowerCase();
  return builds.filter((b) => {
    if (f.kind && b.kind !== f.kind) return false;
    if (f.role && b.role !== f.role) return false;
    if (f.className && b.className !== f.className) return false;
    if (q) {
      const hay = [b.name, b.tagline, b.className, b.role, ...b.tags].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/directory.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/directory.ts tests/directory.test.ts
git commit -m "feat: directory data helpers (sort, facets, filter)"
```

---

### Task 3: `BuildDirectory.tsx` island + directory styles

**Files:**
- Create: `src/components/BuildDirectory.tsx`
- Modify: `src/styles/global.css` (append the directory styles at end of file)

**Interfaces:**
- Consumes: `DirBuild`, `Facets`, `DirFilter`, `filterBuilds` from `../lib/directory`; `favorites` from `../lib/favorites`.
- Produces: default export `BuildDirectory({ builds: DirBuild[]; facets: Facets })` — used by `index.astro` as `<BuildDirectory client:load builds={...} facets={...} />`.

- [ ] **Step 1: Write the component**

Create `src/components/BuildDirectory.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { favorites } from '../lib/favorites';
import { filterBuilds, type DirBuild, type Facets } from '../lib/directory';

interface Props {
  builds: DirBuild[];
  facets: Facets;
}

function Card({ b, starred, onToggle }: { b: DirBuild; starred: boolean; onToggle: (slug: string) => void }) {
  return (
    <article className="dir-card">
      <a className="dc-link" href={`/builds/${b.slug}`}>
        <h3 className="dc-name">{b.name}</h3>
        <p className="dc-tagline">{b.tagline}</p>
        {b.badges.length > 0 && (
          <div className="dc-badges">
            {b.badges.map((bd, i) => (
              <span key={i} className={bd.style && bd.style !== 'plain' ? `badge ${bd.style}` : 'badge'}>
                {bd.label}
              </span>
            ))}
          </div>
        )}
        <p className="dc-summary">{b.summary}</p>
        <div className="dc-foot">
          <span className="role">{b.role}</span>
          <span className="sep">·</span>
          <span>{b.kindLabel}</span>
          {b.difficulty && (
            <>
              <span className="sep">·</span>
              <span>{b.difficulty}</span>
            </>
          )}
        </div>
      </a>
      <button
        type="button"
        className={`dc-star${starred ? ' filled' : ''}`}
        aria-pressed={starred}
        aria-label={starred ? `Unstar ${b.name}` : `Star ${b.name}`}
        onClick={() => onToggle(b.slug)}
      >
        {starred ? '★' : '☆'}
      </button>
    </article>
  );
}

export default function BuildDirectory({ builds, facets }: Props) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [role, setRole] = useState('');
  const [className, setClassName] = useState('');
  const [starred, setStarred] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setStarred(favorites.getStarred());
    sync();
    return favorites.subscribe(sync);
  }, []);

  const visible = useMemo(
    () => filterBuilds(builds, { query, kind, role, className }),
    [builds, query, kind, role, className],
  );

  const clear = () => {
    setQuery('');
    setKind('');
    setRole('');
    setClassName('');
  };

  const total = builds.length;
  const count = visible.length;

  return (
    <>
      <div className="dir-toolbar">
        <input
          className="dir-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search builds — name, class, tag…"
          aria-label="Search builds"
        />
        <div className="dir-filters">
          <label className="dir-field">
            <span className="label">Kind</span>
            <select className="dir-select" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All kinds</option>
              {facets.kinds.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </label>
          <label className="dir-field">
            <span className="label">Role</span>
            <select className="dir-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              {facets.roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="dir-field">
            <span className="label">Class</span>
            <select className="dir-select" value={className} onChange={(e) => setClassName(e.target.value)}>
              <option value="">All classes</option>
              {facets.classes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <button type="button" className="dir-reset" onClick={clear}>Clear filters</button>
        </div>
      </div>

      <p className="dir-count">
        {count === total ? `Showing all ${total} builds` : `Showing ${count} of ${total} builds`}
      </p>

      {count === 0 ? (
        <div className="dir-empty">
          <p>No builds match your filters.</p>
          <button type="button" className="dir-reset" onClick={clear}>Clear filters</button>
        </div>
      ) : (
        <div className="dir-grid">
          {visible.map((b) => (
            <Card key={b.slug} b={b} starred={starred.includes(b.slug)} onToggle={(s) => favorites.toggleStar(s)} />
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Append the directory styles**

Append to the end of `src/styles/global.css`:

```css
  /* ---- Home directory (cards + toolbar) ---- */
  .dir-head .btitle {
    font-family: var(--serif); font-weight: 600; font-variant: small-caps; letter-spacing: .02em;
    font-size: clamp(25px, 4.4vw, 36px); line-height: 1.05; margin: 2px 0 0; color: var(--ink-strong);
    text-wrap: balance;
  }
  .dir-head .btitle::first-letter { color: var(--wine); font-size: 1.18em; }
  .dir-head .lead { color: var(--ink-dim); margin: 10px 0 0; max-width: 64ch; }

  .dir-toolbar {
    margin: 26px 0 0; padding: 16px 18px; border: 1px solid var(--bronze-line); border-radius: var(--radius);
    background: rgba(255,250,238,.4); box-shadow: inset 0 1px 0 rgba(255,247,230,.5);
  }
  .dir-search {
    width: 100%; padding: 11px 14px; font-family: var(--serif); font-size: 15px;
    background: rgba(255,250,238,.7); border: 1px solid var(--bronze-line); border-radius: 3px; color: var(--ink);
  }
  .dir-search::placeholder { color: var(--ink-mute); }
  .dir-search:focus { outline: 2px solid var(--bronze); outline-offset: 1px; }
  .dir-filters { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; align-items: flex-end; }
  .dir-field { display: flex; flex-direction: column; gap: 3px; }
  .dir-field .label {
    font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: var(--wine); font-weight: 700; padding-left: 2px;
  }
  .dir-select {
    appearance: none; font-family: var(--serif); font-size: 13.5px; font-variant: small-caps; letter-spacing: .03em;
    color: var(--ink-strong); padding: 7px 30px 7px 12px; border: 1px solid var(--bronze-line); border-radius: 3px;
    cursor: pointer; min-width: 132px;
    background-image:
      linear-gradient(180deg, var(--parch), var(--parch-2)),
      url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="7"><path d="M0 0l5 6 5-6z" fill="%234c1e29"/></svg>');
    background-repeat: no-repeat, no-repeat;
    background-position: 0 0, right 11px center;
    background-size: auto, 10px 7px;
  }
  .dir-reset {
    font-family: var(--serif); font-size: 12px; font-variant: small-caps; letter-spacing: .05em;
    color: var(--wine); background: transparent; border: 0; border-bottom: 1px dotted var(--wine);
    cursor: pointer; padding: 2px 1px;
  }
  .dir-reset:hover { color: var(--wine-br); }
  .dir-count { font-size: 12.5px; color: var(--ink-dim); margin: 14px 2px 0; font-style: italic; }

  .dir-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(288px, 1fr)); gap: 16px; margin-top: 12px; }
  .dir-card {
    position: relative; background: linear-gradient(180deg, var(--parch), var(--parch-2));
    border: 1px solid var(--bronze-line); border-left: 3px solid var(--wine); border-radius: var(--radius);
    box-shadow: inset 0 1px 0 rgba(255,247,230,.5);
    transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
  }
  .dir-card:hover {
    transform: translateY(-2px); border-left-color: var(--wine-br);
    box-shadow: inset 0 1px 0 rgba(255,247,230,.6), 0 10px 24px rgba(30,14,8,.32);
  }
  .dc-link { display: flex; flex-direction: column; gap: 8px; height: 100%; padding: 16px 18px 14px; text-decoration: none; color: inherit; }
  .dc-name {
    font-family: var(--serif); font-weight: 600; font-variant: small-caps; letter-spacing: .02em;
    font-size: 20px; line-height: 1.1; margin: 0; color: var(--ink-strong); padding-right: 26px;
  }
  .dc-name::first-letter { color: var(--wine); font-size: 1.15em; }
  .dc-tagline { font-size: 12px; color: var(--wine); font-weight: 600; font-variant: small-caps; letter-spacing: .05em; margin: -4px 0 0; }
  .dc-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .dc-summary {
    font-size: 13.5px; line-height: 1.5; color: var(--ink); margin: 2px 0 0;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .dc-foot {
    margin-top: auto; padding-top: 10px; border-top: 1px solid rgba(140,110,60,.28);
    font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-mute);
    display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  }
  .dc-foot .role { color: var(--wine); font-weight: 700; }
  .dc-foot .sep { opacity: .5; }
  .dc-star {
    position: absolute; top: 12px; right: 13px; z-index: 2; appearance: none; border: 0; background: transparent;
    cursor: pointer; font-size: 16px; line-height: 1; color: #b6a577; padding: 2px; transition: color .12s ease;
  }
  .dc-star:hover { color: var(--bronze-br); }
  .dc-star.filled { color: var(--bronze-br); text-shadow: 0 0 8px rgba(207,170,92,.5); }
  .dc-star:focus-visible { outline: 2px solid var(--bronze-br); outline-offset: 1px; }
  .dir-empty {
    margin-top: 16px; padding: 28px 20px; text-align: center; border: 1px dashed rgba(181,146,74,.5);
    border-radius: var(--radius); background: rgba(255,250,238,.35); color: var(--ink-dim);
  }
  .dir-empty p { margin: 0 0 8px; font-style: italic; }
  @media (max-width: 560px) {
    .dir-filters { gap: 8px; }
    .dir-field { flex: 1 1 40%; }
    .dir-select { width: 100%; min-width: 0; }
  }
```

- [ ] **Step 3: Type-check via build (island is wired up in Task 4, so just confirm it compiles)**

Run: `bunx astro check`
Expected: no errors introduced by `BuildDirectory.tsx` / the CSS. (If `astro check` is unavailable, this is verified by `bun run build` in Task 4.)

- [ ] **Step 4: Commit**

```bash
git add src/components/BuildDirectory.tsx src/styles/global.css
git commit -m "feat: BuildDirectory island + directory card/toolbar styles"
```

---

### Task 4: Rewrite `index.astro` to render the directory

**Files:**
- Modify (replace whole file): `src/pages/index.astro`

**Interfaces:**
- Consumes: `getCollection('builds')`; `toDirBuild`, `sortBuilds`, `facets` from `../lib/directory`; `BuildDirectory` island.
- Produces: the home page at `/`.

- [ ] **Step 1: Replace `src/pages/index.astro` with:**

```astro
---
// Home directory: sorted build cards + search/Kind/Role/Class filters.
// All cards render to static HTML at build time; BuildDirectory (client:load)
// layers on search, filtering, and per-card favorite stars.
import { getCollection } from 'astro:content';
import Base from '../layouts/Base.astro';
import BuildDirectory from '../components/BuildDirectory';
import { toDirBuild, sortBuilds, facets } from '../lib/directory';

const builds = sortBuilds((await getCollection('builds')).map((b) => toDirBuild(b.data)));
const facetData = facets(builds);
---
<Base title="The Kenabres Codex">
  <div class="wrap">
    <div class="dir-head">
      <p class="eyebrow">Companion &amp; Mercenary Builds</p>
      <h2 class="btitle">Browse the Builds</h2>
      <p class="lead">Detailed WOTR build guides — one page each, with stats, level-by-level progression, gear, and tactics. Every feat, spell, and mechanic links to a shared codex you can look up in a click.</p>
    </div>
    <BuildDirectory client:load builds={builds} facets={facetData} />
  </div>
</Base>
```

- [ ] **Step 2: Build to verify it compiles and passes the strict `[[term]]` check**

Run: `bun run build`
Expected: build completes with no errors; `dist/index.html` written.

- [ ] **Step 3: Confirm cards render statically (no-JS baseline) in the built HTML**

Run: `grep -c 'dir-card' dist/index.html`
Expected: `6` (one per build — cards are server-rendered before hydration).

- [ ] **Step 4: Run the full test suite (nothing regressed)**

Run: `bun test`
Expected: PASS — all prior tests plus the new `plainText`/`directory` tests.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: home page renders the filterable build directory"
```

---

### Task 5: Logo-banner masthead (site-wide)

**Files:**
- Modify: `src/components/Masthead.astro`
- Modify: `src/styles/global.css` (append masthead-logo styles)
- Asset: `public/kenabres-codex-logo.webp` (see prerequisite)

**Asset prerequisite:** The author provides the logo art. Convert it to WebP and place it at `public/kenabres-codex-logo.webp` before this task's visual check. If the source is a PNG at `<path>`, convert with:
`bunx sharp-cli --input <path> --output public/kenabres-codex-logo.webp` — or any WebP encoder. Do **not** inline base64. The `<img>` `src` is `/kenabres-codex-logo.webp`; the build does not fail if the file is missing (the image simply 404s until it lands), so code and asset can be committed independently.

**Interfaces:**
- Consumes: nothing (static component rendered by `Base.astro`).
- Produces: the site-wide masthead — a linked logo image replacing the former text `<h1>`.

- [ ] **Step 1: Replace `src/components/Masthead.astro` with:**

```astro
---
// Site-wide masthead. The logo banner (public/kenabres-codex-logo.webp) already
// contains the title text, so it replaces the former text <h1> everywhere.
---
<header class="masthead">
  <a class="masthead-logo" href="/" aria-label="The Kenabres Codex — home">
    <img src="/kenabres-codex-logo.webp" alt="The Kenabres Codex" />
  </a>
</header>
```

- [ ] **Step 2: Append masthead-logo styles to `src/styles/global.css`:**

```css
  /* ---- Masthead logo banner ---- */
  .masthead-logo { display: block; }
  .masthead-logo img {
    display: block; width: 100%; max-width: 620px; height: auto; margin: 0 auto;
    filter: drop-shadow(0 6px 18px rgba(0,0,0,.6));
  }
  @media (max-width: 720px) { .masthead-logo img { max-width: 92%; } }
```

- [ ] **Step 3: Build to verify it compiles**

Run: `bun run build`
Expected: build completes; `grep -c 'masthead-logo' dist/index.html` returns `1`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Masthead.astro src/styles/global.css
git commit -m "feat: logo-banner masthead site-wide"
```

---

### Task 6: Visual verification (Orca browser)

**Files:** none (verification only).

- [ ] **Step 1: Start the preview server**

Run: `bun run build && bun run preview` (preview serves `dist/` on a local port; note the URL).

- [ ] **Step 2: Verify the home page in the Orca browser** (per `CLAUDE.md`, Orca first)

Use the `orca-cli` skill's embedded browser to open the preview URL and confirm:
- Logo banner shows at top (or a broken-image placeholder if the asset is not yet dropped in — note which).
- Intro copy reads "Browse the Builds" with the plain functional lead.
- Six cards render in the grid; each shows name, class chain, up to two badges, a clamped summary, and a `role · kind[ · difficulty]` footer.
- Typing in search narrows the grid and updates the count; Kind/Role/Class selects filter; "Clear filters" resets; filtering to nothing shows the empty state.
- Clicking a card's star fills it; reload persists it (localStorage), and the same build shows starred in the rail.
- Rail is unchanged from build pages.

- [ ] **Step 3: Check a build page still looks right**

Open `/builds/camellia` in the Orca browser; confirm the logo masthead sits above the build hero and the build page design is otherwise unchanged.

- [ ] **Step 4: Final full check**

Run: `bun run build && bun test`
Expected: build succeeds; all tests pass.

---

## Self-Review

**Spec coverage:**
- Filterable directory replacing temp home → Tasks 2, 3, 4. ✓
- Rail unchanged; filters in main column → Task 4 (rail untouched; toolbar in `.wrap`). ✓
- Rich index cards (name, class chain, 2 badges, 3-line summary, role·kind·difficulty, star) → Task 3 `Card` + CSS. ✓
- Search + Kind/Role/Class facets, present-only, mc→Main Character → Task 2 `facets`/`filterBuilds`. ✓
- Sort featured-first then alpha → Task 2 `sortBuilds`. ✓
- Plain-text summary, no nested interactive content → Task 1 + Task 3 sibling link/button. ✓
- Logo masthead site-wide, WebP on disk → Task 5. ✓
- Intro copy verbatim → Global Constraints + Task 4. ✓
- Empty state + responsive → Task 3 (`.dir-empty`, media query) + `.dir-grid` auto-fill. ✓
- Tests for directory + plainText → Tasks 1, 2. ✓
- Deferred (Difficulty/Mythic/Tag filters, For You on home) → not implemented, by design. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. The only external dependency is the logo asset, explicitly handled as a prerequisite that does not block the build.

**Type consistency:** `DirBuild`/`Facets`/`DirFilter` defined in Task 2 are consumed with identical field names in Task 3 (`className`, `kindLabel`, `difficulty`, `badges[].style`) and Task 4 (`toDirBuild`, `sortBuilds`, `facets`). `favorites` methods (`getStarred`, `subscribe`, `toggleStar`) match `favorites.ts`. Card markup mirrors `RailNav.Row` (sibling `<a>` + `<button>`).
