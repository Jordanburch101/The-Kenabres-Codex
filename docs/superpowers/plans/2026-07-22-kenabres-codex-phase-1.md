# The Kenabres Codex — Phase 1 (Platform + Parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Astro static site with schema-validated YAML build + glossary content collections, a `[[term]]` resolver with strict build-time validation, a dedup linter, migrate the 6 prototype builds and the glossary/icons, and render per-build pages at visual parity with the prototype — deployable to Vercel.

**Architecture:** Astro SSG. Builds and glossary terms are YAML files in two content collections, validated by Zod schemas kept in a plain `src/lib/schemas.ts` (so they're unit-testable without the `astro:content` virtual module). Prose fields and table cells are rendered by a small inline renderer that resolves `[[Term]]` against the glossary (link + icon + tooltip) and **throws on unknown terms**, failing the build. Icons are WebP files in `public/glossary-icons/`. Components port the prototype's CSS/markup verbatim to preserve the design.

**Tech Stack:** Astro 5, TypeScript, `astro/zod`, `astro/loaders` (`glob`), Vitest (unit tests), `sharp` (icon conversion), `js-yaml` (Node migration scripts). Deploy: Vercel static.

## Global Constraints

- **Astro** ≥ 5.0; Node ≥ 18.14. Content config lives in `src/content.config.ts`.
- **YAML** for all content entries; **Zod** schemas are the validation contract.
- **Glossary is shared**: one file per term in `src/content/glossary/`; terms referenced by name/alias via `[[Term]]`.
- **Strict fail** on unknown `[[term]]` — never render a broken link.
- **Icons**: WebP files in `public/glossary-icons/<slug>.webp`; no base64, no object storage.
- **Preserve the prototype's visual design** — port its CSS verbatim; do not restyle.
- Prototype source of truth for migration: `../wotr-build-guide/index.html` (sibling repo).
- Single curator; static output only (no backend/DB/auth).
- **Browser automation** (screenshots, parity diffs, DOM checks): use the **Orca
  CLI + Orca embedded browser** via the `orca-cli` skill **first**; fall back to
  Playwright/Computer Use only if the Orca browser is unavailable. (See `CLAUDE.md`.)
- Commit after every task. Conventional-commit messages.

---

## Success Criteria (Definition of Done)

Phase 1 is complete when **all** of the following hold:

1. **Visual parity — the bar for "looks like the reference."** Each of the 6
   migrated build pages (`/builds/<slug>`) is **visually indistinguishable** from
   its corresponding tab in the deployed prototype: hero, badges, video embed +
   maker credit (top & bottom), ability-score grid, level table (including
   `[[term]]` links, inline icons, and hover tooltips), skills, picks, gear rows
   with ⓘ flags, mythic block, combat list, and footnotes. Verified by
   side-by-side screenshot comparison at desktop (1280px) and mobile (390px)
   widths — see Task 13, which is a hard gate.
2. **Strict glossary integrity.** `npm run build` **fails** on any unknown
   `[[term]]`; no unknown-term escapes ship.
3. **Linter clean.** `scripts/lint-glossary.mjs` exits 0 — no duplicate,
   normalized-collision, dup-slug, or missing-icon errors. (Dead-entry *warnings*
   are acceptable.)
4. **Tests green.** `npm test` passes (wiki, normalize, schemas, glossary,
   inline, lint).
5. **Full content migration.** All 6 builds + the full glossary (~162 terms,
   ~108 icons) exist as YAML + WebP; **no base64 remains** and nothing references
   the prototype file at runtime.
6. **Static deploy.** Builds to `dist/` and deploys on Vercel; `/`, every
   `/builds/<slug>`, and `/codex` load with working tooltips and icons.
7. **Repeatable authoring.** The authoring skill exists and a dry-run (add one
   term to a build) completes the full loop: generate → build-fails-on-missing →
   grab/enrich → lint → rebuild.

**Explicitly NOT a Phase 1 success condition** (do not block on these): the
directory homepage with cards/filters, the sidebar rework, and the localStorage
roster/favorites — Phase 2/3. The Phase 1 homepage is a plain build list.

---

## File Structure

```
src/
  content.config.ts          # registers builds + glossary collections
  content/
    builds/<slug>.yaml        # one file per build
    glossary/<slug>.yaml      # one file per term
  lib/
    schemas.ts                # buildSchema, glossaryEntrySchema (Zod) — unit-tested
    wiki.ts                   # wikiUrl(slug)
    normalize.ts              # normalizeKey(name)
    glossary.ts               # buildGlossaryIndex(entries), resolveTerm(index, raw)
    inline.ts                 # renderInline(text, index) -> HTML string
  components/
    Prose.astro               # wraps renderInline
    TermTooltip.astro         # the single floating tooltip + client script
    VideoEmbed.astro          # youtube-nocookie player + maker credit
    BuildHero.astro
    StatGrid.astro
    LevelTable.astro
    PicksList.astro
    GearRows.astro
    MythicBlock.astro
    CombatList.astro
    Footnotes.astro
  layouts/
    Base.astro                # <head>, global CSS, theme
  styles/
    global.css                # ported verbatim from prototype <style>
  pages/
    index.astro               # temporary build list (Phase 2 replaces with directory)
    builds/[id].astro         # per-build page
    codex/index.astro         # auto-generated glossary index + reverse lookup
scripts/
  grab.sh                     # promoted from prototype (link/icon fetch, sharp step)
  migrate-glossary.mjs        # T/IC + base64 -> glossary/*.yaml + public/glossary-icons/*.webp
  lint-glossary.mjs           # dedup + integrity linter
tests/
  wiki.test.ts
  schemas.test.ts
  normalize.test.ts
  glossary.test.ts
  inline.test.ts
  lint-glossary.test.ts
```

---

### Task 1: Scaffold Astro project + tooling

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/pages/index.astro` (placeholder), `src/layouts/Base.astro` (minimal)

**Interfaces:**
- Produces: a buildable Astro project; `npm run build`, `npm test` commands.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "the-kenabres-codex",
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "lint:glossary": "node scripts/lint-glossary.mjs"
  },
  "dependencies": {
    "astro": "^5.2.0"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "sharp": "^0.33.0",
    "js-yaml": "^4.1.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://the-kenabres-codex.vercel.app',
  // static output (default); Vercel serves dist/ as-is
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
.astro/
.vercel/
```

- [ ] **Step 6: Create minimal `src/layouts/Base.astro`**

```astro
---
const { title = 'The Kenabres Codex' } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 7: Create placeholder `src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base>
  <main><h1>The Kenabres Codex</h1></main>
</Base>
```

- [ ] **Step 8: Install and verify build**

Run: `npm install && npm run build`
Expected: build completes, `dist/index.html` exists.

- [ ] **Step 9: Verify test runner works**

Run: `npm test`
Expected: "No test files found" (exit 0) — runner is wired.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "chore: scaffold Astro project and test tooling"
```

---

### Task 2: `wikiUrl` helper

**Files:**
- Create: `src/lib/wiki.ts`
- Test: `tests/wiki.test.ts`

**Interfaces:**
- Produces: `wikiUrl(slug: string): string` — builds the Fextralife URL from a slug (e.g. `Deadly+Aim`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/wiki.test.ts
import { describe, it, expect } from 'vitest';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wiki.test.ts`
Expected: FAIL — cannot find module `../src/lib/wiki`.

- [ ] **Step 3: Implement**

```ts
// src/lib/wiki.ts
const BASE = 'https://pathfinderwrathoftherighteous.wiki.fextralife.com/';
export function wikiUrl(slug: string): string {
  return BASE + slug;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wiki.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/wiki.ts tests/wiki.test.ts && git commit -m "feat: add wikiUrl helper"
```

---

### Task 3: `normalizeKey` helper

**Files:**
- Create: `src/lib/normalize.ts`
- Test: `tests/normalize.test.ts`

**Interfaces:**
- Produces: `normalizeKey(name: string): string` — lowercases and strips spaces, hyphens, and punctuation. Used by the glossary index (alias matching) and the linter (collision detection).

- [ ] **Step 1: Write the failing test**

```ts
// tests/normalize.test.ts
import { describe, it, expect } from 'vitest';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/normalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/normalize.ts
export function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/normalize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/normalize.ts tests/normalize.test.ts && git commit -m "feat: add normalizeKey helper"
```

---

### Task 4: Zod schemas (`glossaryEntrySchema`, `buildSchema`)

**Files:**
- Create: `src/lib/schemas.ts`
- Test: `tests/schemas.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `glossaryEntrySchema` — validates `{ name, category, desc, wikiSlug?, icon?, aliases? }`.
    - `category`: enum `feat | spell | hex | mythic | class | skill | ability`.
    - `wikiSlug`: optional string (absent ⇒ no wiki link, tooltip only).
  - `buildSchema` — validates a build (fields below). Exports inferred types `GlossaryEntry`, `Build`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/schemas.test.ts
import { describe, it, expect } from 'vitest';
import { glossaryEntrySchema, buildSchema } from '../src/lib/schemas';

describe('glossaryEntrySchema', () => {
  it('accepts a valid entry', () => {
    const r = glossaryEntrySchema.safeParse({
      name: 'Deadly Aim', category: 'feat',
      desc: 'Trade -1 attack for +2 damage.', wikiSlug: 'Deadly+Aim',
      icon: 'deadly-aim.webp', aliases: ['DA'],
    });
    expect(r.success).toBe(true);
  });
  it('rejects an unknown category', () => {
    const r = glossaryEntrySchema.safeParse({ name: 'X', category: 'weapon', desc: 'y' });
    expect(r.success).toBe(false);
  });
  it('requires name and desc', () => {
    expect(glossaryEntrySchema.safeParse({ category: 'feat', desc: 'y' }).success).toBe(false);
    expect(glossaryEntrySchema.safeParse({ name: 'X', category: 'feat' }).success).toBe(false);
  });
});

describe('buildSchema', () => {
  const minimal = {
    slug: 'wenduag', name: 'Wenduag', tagline: 'Slayer',
    kind: 'companion', role: 'Ranged DPS', class: 'Slayer',
    tags: ['throwing-axe'], summary: 'A [[Slayer]] build.',
  };
  it('accepts a minimal valid build', () => {
    expect(buildSchema.safeParse(minimal).success).toBe(true);
  });
  it('accepts an optional flexible level table', () => {
    const r = buildSchema.safeParse({
      ...minimal,
      levels: { headers: ['Feat', 'Talent'], rows: [{ lv: 1, cells: ['[[Weapon Focus]]', '—'] }] },
    });
    expect(r.success).toBe(true);
  });
  it('rejects an invalid kind', () => {
    expect(buildSchema.safeParse({ ...minimal, kind: 'boss' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/schemas.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/schemas.ts
import { z } from 'astro/zod';

export const glossaryEntrySchema = z.object({
  name: z.string(),
  category: z.enum(['feat', 'spell', 'hex', 'mythic', 'class', 'skill', 'ability']),
  desc: z.string(),
  wikiSlug: z.string().optional(),
  icon: z.string().optional(),
  aliases: z.array(z.string()).default([]),
});
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;

const stat = z.object({
  value: z.string(),
  tag: z.string().optional(),
  emphasis: z.enum(['hi', 'dump']).optional(),
});

const table = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.union([
    z.object({ lv: z.union([z.number(), z.string()]), cells: z.array(z.string()) }),
    z.array(z.string()),
  ])),
});

export const buildSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  kind: z.enum(['companion', 'mc', 'mercenary']),
  role: z.string(),
  class: z.string(),
  archetype: z.string().optional(),
  race: z.string().optional(),
  alignment: z.string().optional(),
  mythicPath: z.string().optional(),
  difficultyToPlay: z.string().optional(),
  difficultyTarget: z.string().optional(),
  dlc: z.string().optional(),
  patch: z.string().optional(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  video: z.object({
    youtubeId: z.string(),
    creator: z.string(),
    creatorUrl: z.string().optional(),
  }).optional(),
  badges: z.array(z.object({ label: z.string(), style: z.enum(['gold', 'crim', 'plain']).default('plain') })).optional(),
  summary: z.string(),
  abilityScores: z.object({
    str: stat.optional(), dex: stat.optional(), con: stat.optional(),
    int: stat.optional(), wis: stat.optional(), cha: stat.optional(),
    note: z.string().optional(),
  }).optional(),
  skills: z.object({ main: z.string(), note: z.string().optional() }).optional(),
  identity: z.array(z.object({ k: z.string(), v: z.string() })).optional(),
  levels: z.object({
    headers: z.array(z.string()),
    rows: z.array(z.object({ lv: z.union([z.number(), z.string()]), cells: z.array(z.string()) })),
    note: z.string().optional(),
  }).optional(),
  picks: z.array(z.object({
    heading: z.string(),
    intro: z.string().optional(),
    items: z.array(z.object({ tag: z.string().optional(), name: z.string(), note: z.string() })),
  })).optional(),
  gear: z.array(z.object({ k: z.string(), v: z.string(), flag: z.string().optional() })).optional(),
  mythic: z.object({ intro: z.string().optional(), table: table.optional(), note: z.string().optional() }).optional(),
  combat: z.object({ bullets: z.array(z.string()), closer: z.string().optional() }).optional(),
  footnotes: z.array(z.string()).optional(),
});
export type Build = z.infer<typeof buildSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/schemas.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts tests/schemas.test.ts && git commit -m "feat: add build and glossary Zod schemas"
```

---

### Task 5: Register content collections

**Files:**
- Create: `src/content.config.ts`
- Create: `src/content/glossary/deadly-aim.yaml` (seed, so the build has content)
- Create: `src/content/builds/_sample.yaml` (temporary seed; removed in Task 10)

**Interfaces:**
- Consumes: `buildSchema`, `glossaryEntrySchema` (Task 4).
- Produces: collections `builds` and `glossary`, queryable via `getCollection`.

- [ ] **Step 1: Write `src/content.config.ts`**

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { buildSchema, glossaryEntrySchema } from './lib/schemas';

const builds = defineCollection({
  loader: glob({ base: './src/content/builds', pattern: '**/*.yaml' }),
  schema: buildSchema,
});
const glossary = defineCollection({
  loader: glob({ base: './src/content/glossary', pattern: '**/*.yaml' }),
  schema: glossaryEntrySchema,
});

export const collections = { builds, glossary };
```

- [ ] **Step 2: Seed one glossary entry**

```yaml
# src/content/glossary/deadly-aim.yaml
name: Deadly Aim
category: feat
desc: Trade -1 ranged attack for +2 ranged damage; scales with base attack bonus.
wikiSlug: Deadly+Aim
icon: deadly-aim.webp
```

- [ ] **Step 3: Seed a temporary sample build**

```yaml
# src/content/builds/_sample.yaml
slug: _sample
name: Sample
tagline: temporary
kind: companion
role: DPS
class: Slayer
tags: [sample]
summary: Uses [[Deadly Aim]] to verify the pipeline.
```

- [ ] **Step 4: Verify the build compiles the collections**

Run: `npm run build`
Expected: build succeeds; `.astro/` types generated; no schema errors.

- [ ] **Step 5: Commit**

```bash
git add src/content.config.ts src/content/ && git commit -m "feat: register builds and glossary content collections"
```

---

### Task 6: Glossary index + `resolveTerm`

**Files:**
- Create: `src/lib/glossary.ts`
- Test: `tests/glossary.test.ts`

**Interfaces:**
- Consumes: `GlossaryEntry` (Task 4), `normalizeKey` (Task 3), `wikiUrl` (Task 2).
- Produces:
  - `buildGlossaryIndex(entries: GlossaryEntry[]): GlossaryIndex` — map of normalized name **and** each alias → entry; throws on a duplicate normalized key (surfacing dupes early).
  - `resolveTerm(index, raw): ResolvedTerm` where `raw` is the inside of `[[...]]` and may be `Name`, `Name|display`, or `Name|no-wiki`. Returns `{ display, href?, icon?, desc, category }`. **Throws** `Error('Unknown glossary term: "<name>"')` if not found.

- [ ] **Step 1: Write the failing test**

```ts
// tests/glossary.test.ts
import { describe, it, expect } from 'vitest';
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/glossary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/glossary.ts
import type { GlossaryEntry } from './schemas';
import { normalizeKey } from './normalize';
import { wikiUrl } from './wiki';

export type GlossaryIndex = Map<string, GlossaryEntry>;
export interface ResolvedTerm {
  display: string;
  href?: string;
  icon?: string;
  desc: string;
  category: GlossaryEntry['category'];
}

export function buildGlossaryIndex(entries: GlossaryEntry[]): GlossaryIndex {
  const index: GlossaryIndex = new Map();
  for (const e of entries) {
    for (const key of [e.name, ...(e.aliases ?? [])]) {
      const nk = normalizeKey(key);
      const existing = index.get(nk);
      if (existing && existing.name !== e.name) {
        throw new Error(`Glossary duplicate: "${key}" collides with "${existing.name}"`);
      }
      index.set(nk, e);
    }
  }
  return index;
}

export function resolveTerm(index: GlossaryIndex, raw: string): ResolvedTerm {
  const [lookupRaw, aliasRaw] = raw.split('|').map((s) => s.trim());
  const entry = index.get(normalizeKey(lookupRaw));
  if (!entry) throw new Error(`Unknown glossary term: "${lookupRaw}"`);
  const display = aliasRaw && aliasRaw !== 'no-wiki' ? aliasRaw : lookupRaw;
  const linkable = entry.wikiSlug && aliasRaw !== 'no-wiki';
  return {
    display,
    href: linkable ? wikiUrl(entry.wikiSlug!) : undefined,
    icon: entry.icon,
    desc: entry.desc,
    category: entry.category,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/glossary.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/glossary.ts tests/glossary.test.ts && git commit -m "feat: add glossary index and term resolver"
```

---

### Task 7: Inline renderer (`renderInline`)

**Files:**
- Create: `src/lib/inline.ts`
- Test: `tests/inline.test.ts`

**Interfaces:**
- Consumes: `GlossaryIndex`, `resolveTerm` (Task 6).
- Produces: `renderInline(text: string, index: GlossaryIndex): string` — converts an authored prose string to safe HTML: `**bold**`→`<b>`, `*em*`→`<i>`, `` `code` ``→`<code>`, and `[[Term]]`→ a `.wl` anchor (or `<span>` for `no-wiki`) carrying `data-desc`, `data-cat`, and an inline `<img>` icon when present. Existing HTML entities (`&mdash;`, `&amp;`, …) pass through unchanged. Raw `<`/`>` are escaped. **Propagates the throw** from `resolveTerm` on unknown terms, so the build fails.

- [ ] **Step 1: Write the failing test**

```ts
// tests/inline.test.ts
import { describe, it, expect } from 'vitest';
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/inline.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/inline.ts
import type { GlossaryIndex } from './glossary';
import { resolveTerm } from './glossary';

const ICON_BASE = '/glossary-icons/';

// Escape only bare < and >; leave &entities; intact.
function escapeAngles(s: string): string {
  return s.replace(/<(?![a-z/])/gi, '&lt;');
}

export function renderInline(text: string, index: GlossaryIndex): string {
  // 1) Resolve [[terms]] first (before markdown), replacing with HTML.
  let out = text.replace(/\[\[([^\]]+)\]\]/g, (_m, raw) => {
    const t = resolveTerm(index, raw);
    const icon = t.icon ? `<img class="ic-in" src="${ICON_BASE}${t.icon}" alt="">` : '';
    const attrs = `class="wl" data-cat="${t.category}" data-desc="${t.desc.replace(/"/g, '&quot;')}"`;
    if (t.href) {
      return `<a ${attrs} href="${t.href}" target="_blank" rel="noopener">${icon}${t.display}</a>`;
    }
    return `<span ${attrs}>${icon}${t.display}</span>`;
  });
  // 2) Inline markdown.
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  return escapeAngles(out);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/inline.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inline.ts tests/inline.test.ts && git commit -m "feat: add inline prose + [[term]] renderer"
```

---

### Task 8: Glossary linter script

**Files:**
- Create: `scripts/lint-glossary.mjs`
- Test: `tests/lint-glossary.test.ts` (imports the pure `lintGlossary` function)
- Refactor: extract the pure logic into `src/lib/lint.ts` so it is testable; the script is a thin CLI wrapper.

**Interfaces:**
- Consumes: `normalizeKey` (Task 3).
- Produces: `lintGlossary({ entries, iconFiles, referencedNames }): LintIssue[]` where `LintIssue = { level: 'error'|'warn', kind: string, message: string }`. Flags: exact duplicate name, normalized-key collision, shared `wikiSlug`, missing icon file, dead entry (defined but unreferenced → warn).

- [ ] **Step 1: Write the failing test**

```ts
// tests/lint-glossary.test.ts
import { describe, it, expect } from 'vitest';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lint-glossary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure logic**

```ts
// src/lib/lint.ts
import type { GlossaryEntry } from './schemas';
import { normalizeKey } from './normalize';

export interface LintIssue { level: 'error' | 'warn'; kind: string; message: string; }

export function lintGlossary(input: {
  entries: GlossaryEntry[];
  iconFiles: Set<string>;
  referencedNames: Set<string>; // normalized names referenced by any build
}): LintIssue[] {
  const { entries, iconFiles, referencedNames } = input;
  const issues: LintIssue[] = [];
  const byKey = new Map<string, GlossaryEntry>();
  const bySlug = new Map<string, GlossaryEntry>();

  for (const e of entries) {
    const nk = normalizeKey(e.name);
    const prev = byKey.get(nk);
    if (prev) {
      issues.push({ level: 'error', kind: 'collision',
        message: `"${e.name}" collides with "${prev.name}" (normalized "${nk}")` });
    } else byKey.set(nk, e);

    if (e.wikiSlug) {
      const prevSlug = bySlug.get(e.wikiSlug);
      if (prevSlug) issues.push({ level: 'error', kind: 'dup-slug',
        message: `"${e.name}" shares wikiSlug "${e.wikiSlug}" with "${prevSlug.name}"` });
      else bySlug.set(e.wikiSlug, e);
    }
    if (e.icon && !iconFiles.has(e.icon)) {
      issues.push({ level: 'error', kind: 'missing-icon',
        message: `"${e.name}" references missing icon "${e.icon}"` });
    }
    const referenced = referencedNames.has(nk) ||
      (e.aliases ?? []).some((a) => referencedNames.has(normalizeKey(a)));
    if (!referenced) issues.push({ level: 'warn', kind: 'dead',
      message: `"${e.name}" is defined but not referenced by any build` });
  }
  return issues;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lint-glossary.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the CLI wrapper**

```js
// scripts/lint-glossary.mjs
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { lintGlossary } from '../src/lib/lint.ts';

const G = 'src/content/glossary';
const B = 'src/content/builds';
const ICONS = 'public/glossary-icons';

const entries = readdirSync(G).filter((f) => f.endsWith('.yaml'))
  .map((f) => yaml.load(readFileSync(join(G, f), 'utf8')));
const iconFiles = new Set(existsSync(ICONS) ? readdirSync(ICONS) : []);

const referencedNames = new Set();
for (const f of readdirSync(B).filter((f) => f.endsWith('.yaml'))) {
  const text = readFileSync(join(B, f), 'utf8');
  for (const m of text.matchAll(/\[\[([^\]|]+)/g)) {
    referencedNames.add(m[1].trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  }
}

const issues = lintGlossary({ entries, iconFiles, referencedNames });
for (const i of issues) console[i.level === 'error' ? 'error' : 'warn'](`[${i.level}] ${i.kind}: ${i.message}`);
const errors = issues.filter((i) => i.level === 'error').length;
console.log(`\n${errors} error(s), ${issues.length - errors} warning(s).`);
process.exit(errors ? 1 : 0);
```

> Note: run the script with a TS-aware runner — `npx tsx scripts/lint-glossary.mjs` (add `tsx` to devDependencies), or precompile. If preferred, port `lint.ts`/`normalize.ts` to `.mjs` to avoid the TS import.

- [ ] **Step 6: Verify the CLI runs against seed content**

Run: `npx tsx scripts/lint-glossary.mjs`
Expected: exits 0 (seed `deadly-aim` referenced by `_sample`); may warn about any unreferenced seeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/lint.ts scripts/lint-glossary.mjs tests/lint-glossary.test.ts package.json
git commit -m "feat: add glossary dedup + integrity linter"
```

---

### Task 9: Migrate the glossary (T/IC + base64 → YAML + WebP)

**Files:**
- Create: `scripts/migrate-glossary.mjs`
- Output: `src/content/glossary/*.yaml`, `public/glossary-icons/*.webp`

**Interfaces:**
- Consumes: the prototype `../wotr-build-guide/index.html` (the `var T = {…}` and `var IC = {…}` objects).
- Produces: one glossary YAML per `T` entry (name, category, desc, wikiSlug from the `T` slug, `icon` when the term has an `IC` entry), and a decoded+`sharp`-converted WebP per `IC` entry.

- [ ] **Step 1: Write the migration script**

```js
// scripts/migrate-glossary.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import sharp from 'sharp';

const SRC = '../wotr-build-guide/index.html';
const OUT_G = 'src/content/glossary';
const OUT_I = 'public/glossary-icons';
mkdirSync(OUT_G, { recursive: true });
mkdirSync(OUT_I, { recursive: true });

const html = readFileSync(SRC, 'utf8');

// Extract the object literals `var T = { ... };` and `var IC = { ... };`
function extractObject(marker) {
  const i = html.indexOf(marker);
  const start = html.indexOf('{', i);
  let depth = 0, j = start;
  for (; j < html.length; j++) {
    const c = html[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { j++; break; } }
  }
  // eslint-disable-next-line no-eval
  return eval('(' + html.slice(start, j) + ')');
}

const T = extractObject('var T ='); // name -> [category, desc, slug|null]
const IC = extractObject('var IC ='); // name -> "data:image/...;base64,...."

const CAT = { cls: 'class', abil: 'ability', feat: 'feat', spell: 'spell', hex: 'hex', mythic: 'mythic', skill: 'skill' };
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let terms = 0, icons = 0;
for (const [name, [cat, desc, wikiSlug]] of Object.entries(T)) {
  const slug = slugify(name);
  const entry = { name, category: CAT[cat] ?? 'ability', desc: desc.replace(/&mdash;/g, '—') };
  if (wikiSlug) entry.wikiSlug = wikiSlug;

  if (IC[name]) {
    const b64 = IC[name].split(',')[1];
    const buf = Buffer.from(b64, 'base64');
    await sharp(buf).resize(64, 64, { fit: 'inside' }).webp({ quality: 82 }).toFile(join(OUT_I, `${slug}.webp`));
    entry.icon = `${slug}.webp`;
    icons++;
  }
  writeFileSync(join(OUT_G, `${slug}.yaml`), yaml.dump(entry, { lineWidth: 100 }));
  terms++;
}
console.log(`Wrote ${terms} glossary terms, ${icons} icons.`);
```

- [ ] **Step 2: Run the migration**

Run: `npx tsx scripts/migrate-glossary.mjs` (or `node` if the imports are plain JS)
Expected: `Wrote 162 glossary terms, 108 icons.` (counts from the prototype).

- [ ] **Step 3: Delete the seed `deadly-aim.yaml` if the migration produced its own**

Run: `ls src/content/glossary/deadly-aim.yaml` — keep the migrated one; ensure no duplicate.

- [ ] **Step 4: Lint the migrated glossary**

Run: `npx tsx scripts/lint-glossary.mjs`
Expected: 0 errors (warnings for not-yet-referenced terms are fine until builds are migrated).

- [ ] **Step 5: Verify the build still compiles with the full glossary**

Run: `npm run build`
Expected: success (all entries pass `glossaryEntrySchema`).

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-glossary.mjs src/content/glossary public/glossary-icons
git commit -m "feat: migrate glossary terms + icons from prototype"
```

---

### Task 10: Port the design (global CSS + Prose/Tooltip) and remove seeds

**Files:**
- Create: `src/styles/global.css` (verbatim port), `src/components/Prose.astro`, `src/components/TermTooltip.astro`
- Modify: `src/layouts/Base.astro` (import global CSS, include TermTooltip)
- Delete: `src/content/builds/_sample.yaml`

**Interfaces:**
- Consumes: `renderInline` (Task 7), `getCollection('glossary')`, `buildGlossaryIndex` (Task 6).
- Produces: `<Prose text={string} />` (renders inline prose+terms via `set:html`); a global tooltip behaviour matching the prototype (hover `.wl` → floating tip with icon + name + `data-desc`).

- [ ] **Step 1: Port the stylesheet verbatim**

Copy the entire contents between `<style>` and `</style>` in `../wotr-build-guide/index.html` into `src/styles/global.css`. Do not edit rules. (This is the exact design being preserved — a verbatim copy, not new CSS.)

- [ ] **Step 2: Build the glossary index once, expose it to components**

Create `src/lib/loadGlossary.ts`:

```ts
import { getCollection } from 'astro:content';
import { buildGlossaryIndex } from './glossary';

export async function loadGlossaryIndex() {
  const entries = (await getCollection('glossary')).map((e) => e.data);
  return buildGlossaryIndex(entries);
}
```

- [ ] **Step 3: Create `Prose.astro`**

```astro
---
import { renderInline } from '../lib/inline';
import { loadGlossaryIndex } from '../lib/loadGlossary';
const { text, as = 'p', class: cls = '' } = Astro.props;
const idx = await loadGlossaryIndex();
const html = renderInline(text, idx);       // throws on unknown term → build fails
const Tag = as;
---
<Tag class={cls} set:html={html} />
```

- [ ] **Step 4: Create `TermTooltip.astro`**

Port the tooltip DOM + client script from the prototype's `<script>` (the `tip` element, `show(a)`, mouseover/mouseout on `a.wl`). Read `data-desc`/`data-cat` from the anchor and render icon+name+desc. Include it once in `Base.astro`.

- [ ] **Step 5: Wire `Base.astro`**

```astro
---
import '../styles/global.css';
import TermTooltip from '../components/TermTooltip.astro';
const { title = 'The Kenabres Codex' } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>{title}</title></head>
  <body>
    <slot />
    <TermTooltip />
  </body>
</html>
```

- [ ] **Step 6: Remove the sample build**

Run: `rm src/content/builds/_sample.yaml`

- [ ] **Step 7: Verify build (glossary index + Prose compile)**

Add a temporary `<Prose text="Take [[Deadly Aim]] &mdash; **early**" />` to `index.astro`, run `npm run build`, confirm the anchor + icon render in `dist/index.html`, then revert the temporary line.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: port global stylesheet, Prose renderer, and term tooltip"
```

---

### Task 11: Build-page section components

**Files:**
- Create: `src/components/{VideoEmbed,BuildHero,StatGrid,LevelTable,PicksList,GearRows,MythicBlock,CombatList,Footnotes}.astro`

**Interfaces:**
- Consumes: `Build` (Task 4) field shapes; `Prose` (Task 10).
- Produces: one component per build section, each taking its slice of `build.data` as props and emitting markup with the **same class names as the prototype** (`.hero`, `.badges`, `.stats`, `.levels`, `.picks`, `.rows`, `.gear`, `.footnotes`, `.video`, `.vidcredit`, etc.) so the ported CSS applies unchanged.

For each component, mirror the prototype's markup for that section (see `../wotr-build-guide/index.html`, the Wenduag build block, `id="build-wenduag"`). Example — `StatGrid.astro`:

```astro
---
import Prose from './Prose.astro';
const { scores } = Astro.props; // build.data.abilityScores
const order = ['str','dex','con','int','wis','cha'];
---
<section class="blk">
  <p class="eyebrow">Ability Scores</p>
  <h2 class="h">Priorities</h2>
  <div class="stats">
    {order.map((k) => scores[k] && (
      <div class={`stat ${scores[k].emphasis ?? ''}`}>
        <span class="abbr">{k[0].toUpperCase()+k.slice(1)}</span>
        <span class="num">{scores[k].value}</span>
        {scores[k].tag && <span class="tag">{scores[k].tag}</span>}
      </div>
    ))}
  </div>
  {scores.note && <Prose text={scores.note} class="dim" />}
</section>
```

`LevelTable.astro` renders `<table class="levels">` with `headers` + `rows` (each cell via `<Prose as="span" text={cell} />`). `VideoEmbed.astro` reproduces the lazy `data-src` iframe + `.vidcredit` maker caption. `GearRows.astro`, `PicksList.astro`, `MythicBlock.astro`, `CombatList.astro`, `Footnotes.astro`, `BuildHero.astro` each mirror their prototype block.

- [ ] **Step 1: Create `VideoEmbed.astro`** — port the `.video` iframe (`data-src`) + `.vidcredit` markup; props `{ youtubeId, creator, creatorUrl }`.
- [ ] **Step 2: Create `StatGrid.astro`** (code above).
- [ ] **Step 3: Create `LevelTable.astro`** — `<table class="levels">`, headers + per-cell `<Prose as="span">`.
- [ ] **Step 4: Create `PicksList.astro`, `GearRows.astro`, `MythicBlock.astro`, `CombatList.astro`, `Footnotes.astro`, `BuildHero.astro`** mirroring the prototype markup.
- [ ] **Step 5: Verify build** — `npm run build` compiles all components (no route yet).
- [ ] **Step 6: Commit**

```bash
git add src/components && git commit -m "feat: add build-page section components"
```

---

### Task 12: Per-build route `builds/[id].astro`

**Files:**
- Create: `src/pages/builds/[id].astro`

**Interfaces:**
- Consumes: `getCollection('builds')`, all Task-11 components.
- Produces: a static page per build at `/builds/<slug>` composing the sections in canonical order, omitting any absent section.

- [ ] **Step 1: Write the route**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../../layouts/Base.astro';
import BuildHero from '../../components/BuildHero.astro';
import VideoEmbed from '../../components/VideoEmbed.astro';
import StatGrid from '../../components/StatGrid.astro';
import LevelTable from '../../components/LevelTable.astro';
import PicksList from '../../components/PicksList.astro';
import GearRows from '../../components/GearRows.astro';
import MythicBlock from '../../components/MythicBlock.astro';
import CombatList from '../../components/CombatList.astro';
import Footnotes from '../../components/Footnotes.astro';

export async function getStaticPaths() {
  const builds = await getCollection('builds');
  return builds.map((b) => ({ params: { id: b.data.slug }, props: { build: b.data } }));
}
const { build } = Astro.props;
---
<Base title={build.name}>
  <main class="content"><div class="wrap">
    <BuildHero build={build} />
    {build.video && <VideoEmbed {...build.video} />}
    {build.abilityScores && <StatGrid scores={build.abilityScores} />}
    {build.skills && <section class="blk">…skills…</section>}
    {build.levels && <LevelTable levels={build.levels} />}
    {build.picks && <PicksList picks={build.picks} />}
    {build.gear && <GearRows gear={build.gear} />}
    {build.mythic && <MythicBlock mythic={build.mythic} />}
    {build.combat && <CombatList combat={build.combat} />}
    {build.footnotes && <Footnotes items={build.footnotes} />}
  </div></main>
</Base>
```

- [ ] **Step 2: Verify build** — `npm run build`; expect `dist/builds/…` (none yet until Task 13 adds builds, so 0 pages — that's fine).
- [ ] **Step 3: Commit**

```bash
git add src/pages/builds && git commit -m "feat: add per-build dynamic route"
```

---

### Task 13: Migrate the 6 builds to YAML (Wenduag first, then the rest)

**Files:**
- Create: `src/content/builds/{wenduag,demonslayer,seelah,ember,camellia,sosiel}.yaml`

**Interfaces:**
- Consumes: `buildSchema`, all components/route.
- Produces: 6 validated builds rendering at parity with the prototype.

- [ ] **Step 1: Author `wenduag.yaml`** by transcribing the prototype's `id="build-wenduag"` block into the schema, converting every `<a class="wl" href=…>Term</a>` to `[[Term]]` and every ⓘ flag to a `flag:` field. Use the spec's Wenduag example as the shape.
- [ ] **Step 2: Verify Wenduag renders at parity — HARD GATE**

Capture the new page and the reference at matched widths and compare:

```bash
npm run build && npx astro preview &        # serves dist/ on :4321
npx http-server ../wotr-build-guide -p 8080 & # serves the prototype
```

Using the **Orca browser** (via the `orca-cli` skill; fall back to Playwright
only if the Orca browser is unavailable), screenshot
`http://localhost:4321/builds/wenduag` and the prototype's Wenduag tab
(`http://localhost:8080/index.html`, click the Wenduag tab) at **1280px** and
**390px** widths, and diff them. **Parity gate:**
hero, badges, video embed + maker credit (top & bottom), stat grid, level table
(term links + inline icons + hover tooltip), skills, picks, gear (with ⓘ flags),
mythic, combat, and footnotes are visually indistinguishable. Fix CSS/markup
ports until they match. **Do not proceed to the other 5 builds until Wenduag
passes this gate** (it validates the shared components + CSS port once).

- [ ] **Step 3: Lint** — `npx tsx scripts/lint-glossary.mjs`; expect 0 errors. Any `[[term]]` the migration script didn't create fails the `npm run build` (unknown term) — add the missing term via the grab flow (Task 15 skill) or a manual glossary entry.
- [ ] **Step 4: Repeat Steps 1–3 for `demonslayer`, `seelah`, `ember`, `camellia`, `sosiel`.**
- [ ] **Step 5: Full build + lint**

Run: `npm run build && npx tsx scripts/lint-glossary.mjs`
Expected: 6 build pages emitted; 0 lint errors; dead-entry warnings drop as terms get referenced.

- [ ] **Step 6: Commit** (one commit per build is fine)

```bash
git add src/content/builds && git commit -m "content: migrate 6 builds from prototype"
```

---

### Task 14: Temporary home + auto-generated Codex index

**Files:**
- Modify: `src/pages/index.astro` (list builds — link cards; full directory is Phase 2)
- Create: `src/pages/codex/index.astro` (glossary index + reverse lookup)

**Interfaces:**
- Consumes: `getCollection('builds')`, `getCollection('glossary')`.
- Produces: `/` listing builds; `/codex` auto-generated glossary with, per term, the list of builds that reference it.

- [ ] **Step 1: Home page lists builds**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../layouts/Base.astro';
const builds = await getCollection('builds');
---
<Base>
  <main class="content"><div class="wrap">
    <h1>The Kenabres Codex</h1>
    <ul>{builds.map((b) => <li><a href={`/builds/${b.data.slug}`}>{b.data.name}</a> — {b.data.role}</li>)}</ul>
  </div></main>
</Base>
```

- [ ] **Step 2: Codex index with reverse lookup**

Build a `term → builds[]` map by scanning each build's `[[terms]]` (reuse the normalized-name extraction from the linter), then render every glossary entry with its "used in" list. (No hand-maintained glossary.)

- [ ] **Step 3: Verify build** — `/` and `/codex` render; reverse lookup shows e.g. "Deadly Aim — used in: Demon Slayer, Wenduag".
- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/pages/codex && git commit -m "feat: temporary home list + auto-generated codex index"
```

---

### Task 15: Deploy to Vercel + the authoring skill

**Files:**
- Create: `vercel.json` (if needed for static), skill doc under the user's skills dir (path TBD with owner).
- Promote: `scripts/grab.sh` from the prototype scratchpad into `scripts/`.

**Interfaces:**
- Produces: a live static deploy; a documented, repeatable authoring workflow.

- [ ] **Step 1: Confirm static output deploys**

Run: `npm run build` then deploy the repo on Vercel (framework preset: Astro; output `dist/`). Verify `/`, `/builds/wenduag`, `/codex` load and tooltips/icons work.

- [ ] **Step 2: Promote `grab.sh`** into `scripts/`, updating its final step to save `public/glossary-icons/<slug>.webp` via `sharp` (matching Task 9).

- [ ] **Step 3: Write the authoring skill** documenting the loop: paste transcript → generate `builds/<slug>.yaml` with `[[terms]]` → `npm run build` (unknown terms fail) → for each missing term, fuzzy-check existing names/aliases, then dispatch the sub-agent grab (verify slug, fetch+`sharp` icon, draft desc) → write `glossary/<term>.yaml` → `lint:glossary` → rebuild → deploy. Reference the sub-agent pattern and `grab.sh`.

- [ ] **Step 4: Dry-run the skill** on one small edit (e.g. add a term to an existing build) to confirm the loop.

- [ ] **Step 5: Commit**

```bash
git add scripts/grab.sh vercel.json && git commit -m "chore: deploy config + promote grab.sh; add authoring skill"
```

---

## Self-Review

**Spec coverage:**
- Astro SSG + React islands → Tasks 1–15 (React islands deferred to Phase 2/3 per spec phasing; none needed for parity). ✓
- YAML content collections + Zod → Tasks 4, 5. ✓
- Build schema (fixed-ish + generic picks + flexible level table) → Task 4. ✓
- Glossary shared collection, one file per term → Tasks 5, 9. ✓
- `[[term]]` resolver, strict build-time fail → Tasks 6, 7, 10. ✓
- Canonical + aliases → Task 6. ✓
- Dedup linter (exact/collision/slug/missing-icon/dead) → Task 8. ✓
- Icons as WebP files via sharp, migrate base64, no S3 → Task 9. ✓
- Auto-generated Index + reverse lookup → Task 14. ✓
- Migration from prototype (builds + CSS + video/credits) → Tasks 10, 11, 13. ✓
- Authoring skill (sub-agent grab, fuzzy dedup) → Task 15. ✓
- Deploy Vercel static → Task 15. ✓
- Directory homepage/filters, sidebar, localStorage roster → **Phase 2/3, out of scope for this plan** (temporary home in Task 14). ✓

**Placeholder scan:** Task 11 and Task 13 intentionally say "mirror the prototype block" / "transcribe the prototype block" — these are *verbatim-port* instructions against a concrete source file (`../wotr-build-guide/index.html`), not vague placeholders; the class names and structure are enumerated. Task 15 skill-doc path is marked "TBD with owner" — a genuine decision point, not code.

**Type consistency:** `renderInline(text, index)`, `resolveTerm(index, raw)`, `buildGlossaryIndex(entries)`, `lintGlossary({entries,iconFiles,referencedNames})`, `wikiUrl(slug)`, `normalizeKey(name)` are used consistently across tasks and tests. Icon path is `/glossary-icons/<slug>.webp` in both `inline.ts` (Task 7) and the migration (Task 9). Schema field names match component props (Tasks 4, 11).

## Open decisions for the owner

- Skill install location (repo `.claude/skills/` vs. user-global).
- Vercel vs. Cloudflare Pages (spec allows either; plan assumes Vercel).
