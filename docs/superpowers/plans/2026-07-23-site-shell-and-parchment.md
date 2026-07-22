# Site Shell & Parchment Texture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap every page in a persistent app shell (left rail + grand masthead + slim footer) so content stops floating, and give the parchment content panels a subtle vellum texture.

**Architecture:** `Base.astro` renders `.layout` = `<Rail>` (fixed, full-height, left) + `.content` (offset by rail width) containing `<Masthead>` → `<slot/>` → `<SiteFooter>`. Pages stop rendering their own `<main class="content">` and just emit their `.wrap` panel into the slot. The rail is data-driven from the `builds` collection (grouped by `kind`) plus an optional per-build "On this page" section list. The vellum texture is a pre-baked tileable WebP layered onto `.wrap`.

**Tech Stack:** Astro 5, TypeScript, Bun (runtime + `bun:test`), `sharp` (texture baking). Ported chrome CSS already lives in `src/styles/global.css`.

## Global Constraints

- **Bun only** — use `bun`/`bunx`, never `npm`/`npx`/`node`. Scripts run via `bun scripts/<file>.mjs`.
- Tests use **Bun's native runner** (`import { test, expect } from 'bun:test'`), never Vitest.
- `bun run build` **must stay green** — it fails on any unknown `[[glossary term]]`; do not introduce new unresolved terms.
- **No base64 images** — images are WebP files on disk (the texture goes in `public/textures/`).
- **Preserve the ported visual design** of build sections — this project adds chrome + texture only; do not restyle existing sections.
- **Reuse the already-ported chrome CSS** in `global.css` (`.masthead`, `.layout`, `.rail*`, `.nav*`, `.content`, the `@media (max-width:860px)` collapse). Net-new CSS is limited to the footer, the vellum layer, the rail section-links, and small tweaks.
- Visual checks: **Orca browser first**, Playwright only as fallback.

---

### Task 1: Parchment vellum texture — generator, asset, CSS

**Files:**
- Create: `scripts/gen-parchment.mjs`
- Create (generated): `public/textures/parchment-vellum.webp`
- Modify: `src/styles/global.css` (the `.wrap` `background` block, lines ~133–137)

**Interfaces:**
- Produces: the asset `public/textures/parchment-vellum.webp` (256×256, RGBA, low-alpha warm grain), referenced by CSS at `url("/textures/parchment-vellum.webp")`.

- [ ] **Step 1: Write the generator script**

Create `scripts/gen-parchment.mjs`. It uses a seeded PRNG so the tile is reproducible, writes a 256×256 RGBA raw buffer of warm-umber grain at very low, varied alpha (fine "vellum" tooth), and encodes it losslessly to WebP (lossless preserves the subtle alpha exactly):

```js
// Bakes the seamless "fine vellum" parchment tile used by .wrap.
// Deterministic (seeded PRNG) so re-running reproduces the same file.
// Run: bun scripts/gen-parchment.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SIZE = 256;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x4b454e41); // "KENA"
const buf = Buffer.alloc(SIZE * SIZE * 4);
for (let i = 0; i < SIZE * SIZE; i++) {
  const o = i * 4;
  buf[o] = 60; buf[o + 1] = 44; buf[o + 2] = 20; // warm umber
  buf[o + 3] = Math.floor(rand() * 18);          // alpha 0..17 (≈ up to 6.7%)
}

mkdirSync('public/textures', { recursive: true });
const out = 'public/textures/parchment-vellum.webp';
await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 4 } })
  .webp({ lossless: true })
  .toFile(out);

const meta = await sharp(out).metadata();
console.log(`wrote ${out} ${meta.width}x${meta.height} hasAlpha=${meta.hasAlpha}`);
```

- [ ] **Step 2: Generate the tile and verify it**

Run: `bun scripts/gen-parchment.mjs`
Expected output: `wrote public/textures/parchment-vellum.webp 256x256 hasAlpha=true`

- [ ] **Step 3: Layer the texture onto `.wrap`**

In `src/styles/global.css`, add the tile as the **top** background layer of `.wrap` (prepend it before the existing gradients). Replace:

```css
    background:
      radial-gradient(90% 60% at 15% 8%, rgba(255,251,238,.55), transparent 55%),
      radial-gradient(80% 55% at 92% 96%, rgba(120,92,50,.12), transparent 55%),
      radial-gradient(60% 40% at 60% 50%, rgba(150,120,70,.06), transparent 60%),
      linear-gradient(160deg, var(--parch), var(--parch-2));
```

with:

```css
    background:
      url("/textures/parchment-vellum.webp") repeat top left / 256px 256px,
      radial-gradient(90% 60% at 15% 8%, rgba(255,251,238,.55), transparent 55%),
      radial-gradient(80% 55% at 92% 96%, rgba(120,92,50,.12), transparent 55%),
      radial-gradient(60% 40% at 60% 50%, rgba(150,120,70,.06), transparent 60%),
      linear-gradient(160deg, var(--parch), var(--parch-2));
```

- [ ] **Step 4: Verify the build still passes**

Run: `bun run build`
Expected: build succeeds, no errors. (Visual confirmation of the texture happens in Task 6's Orca pass.)

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-parchment.mjs public/textures/parchment-vellum.webp src/styles/global.css
git commit -m "feat: bake + apply fine-vellum parchment texture to content panels"
```

---

### Task 2: Rail grouping helper

**Files:**
- Create: `src/lib/rail.ts`
- Test: `tests/rail.test.ts`

**Interfaces:**
- Consumes: `Build` type from `src/lib/schemas.ts`.
- Produces:
  - `type RailBuild = Pick<Build,'slug'|'name'|'kind'|'class'|'role'>`
  - `interface RailGroup { kind: Build['kind']; label: string; builds: RailBuild[] }`
  - `groupBuilds(builds: RailBuild[]): RailGroup[]` — groups by `kind` in fixed order (MC → Companions → Mercenaries), sorts each group by `name`, omits empty groups.
  - `shortName(name: string): string` — the part before the em dash (rail display name).

- [ ] **Step 1: Write the failing tests**

Create `tests/rail.test.ts`:

```ts
import { test, expect } from 'bun:test';
import { groupBuilds, shortName, type RailBuild } from '../src/lib/rail';

const b = (slug: string, name: string, kind: RailBuild['kind']): RailBuild =>
  ({ slug, name, kind, class: 'X', role: 'Y' });

test('groups by kind in MC → Companions → Mercenaries order', () => {
  const groups = groupBuilds([
    b('cam', 'Camellia', 'companion'),
    b('ds', 'Demon Slayer', 'mc'),
    b('merc', 'Hired Blade', 'mercenary'),
  ]);
  expect(groups.map((g) => g.kind)).toEqual(['mc', 'companion', 'mercenary']);
});

test('omits empty groups', () => {
  const groups = groupBuilds([b('ds', 'Demon Slayer', 'mc')]);
  expect(groups.map((g) => g.label)).toEqual(['Main Character']);
});

test('sorts builds by name within a group', () => {
  const groups = groupBuilds([
    b('wen', 'Wenduag', 'companion'),
    b('cam', 'Camellia', 'companion'),
    b('ember', 'Ember', 'companion'),
  ]);
  expect(groups[0].builds.map((x) => x.name)).toEqual(['Camellia', 'Ember', 'Wenduag']);
});

test('shortName takes the part before the em dash', () => {
  expect(shortName('Camellia — The Poisoner')).toBe('Camellia');
  expect(shortName('Seelah')).toBe('Seelah');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/rail.test.ts`
Expected: FAIL (cannot resolve `../src/lib/rail`).

- [ ] **Step 3: Implement `src/lib/rail.ts`**

```ts
import type { Build } from './schemas';

export type RailBuild = Pick<Build, 'slug' | 'name' | 'kind' | 'class' | 'role'>;
export interface RailGroup {
  kind: Build['kind'];
  label: string;
  builds: RailBuild[];
}

const GROUP_ORDER: { kind: Build['kind']; label: string }[] = [
  { kind: 'mc', label: 'Main Character' },
  { kind: 'companion', label: 'Companions' },
  { kind: 'mercenary', label: 'Mercenaries' },
];

export function groupBuilds(builds: RailBuild[]): RailGroup[] {
  return GROUP_ORDER.map(({ kind, label }) => ({
    kind,
    label,
    builds: builds
      .filter((b) => b.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.builds.length > 0);
}

export const shortName = (name: string): string => name.split('—')[0].trim();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/rail.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rail.ts tests/rail.test.ts
git commit -m "feat: add rail build-grouping helper"
```

---

### Task 3: Build-page section helper (single source of truth)

**Files:**
- Create: `src/lib/sections.ts`
- Test: `tests/sections.test.ts`

**Interfaces:**
- Consumes: `Build` type from `src/lib/schemas.ts`.
- Produces:
  - `interface SectionRef { id: string; label: string }`
  - `const SEC` — canonical map of build sections (`key` matches a `Build` field; `id` is the DOM anchor; `label` is the rail text). **The `id`s here are the authoritative anchor ids used in `builds/[id].astro`.**
  - `buildSections(build: Build): SectionRef[]` — present sections in canonical render order.

- [ ] **Step 1: Write the failing tests**

Create `tests/sections.test.ts`:

```ts
import { test, expect } from 'bun:test';
import { buildSections, SEC } from '../src/lib/sections';
import type { Build } from '../src/lib/schemas';

const base = {
  slug: 's', name: 'N', tagline: '', kind: 'mc', role: '', class: '', tags: [], summary: '',
} as unknown as Build;

test('returns only present sections, in canonical order', () => {
  const build = { ...base, combat: { bullets: ['x'] }, abilityScores: { note: 'y' } } as Build;
  expect(buildSections(build)).toEqual([
    { id: 'ability-scores', label: 'Ability Scores' },
    { id: 'combat', label: 'Combat' },
  ]);
});

test('empty build yields no sections', () => {
  expect(buildSections(base)).toEqual([]);
});

test('SEC ids are unique', () => {
  const ids = Object.values(SEC).map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/sections.test.ts`
Expected: FAIL (cannot resolve `../src/lib/sections`).

- [ ] **Step 3: Implement `src/lib/sections.ts`**

```ts
import type { Build } from './schemas';

export interface SectionRef {
  id: string;
  label: string;
}

// Canonical build-page sections, in render order. `key` is the Build field whose
// presence decides whether the section renders. The `id` values MUST match the
// anchor ids used in src/pages/builds/[id].astro.
export const SEC = {
  identity:      { key: 'identity',      id: 'core-identity',     label: 'Core Identity' },
  abilityScores: { key: 'abilityScores', id: 'ability-scores',    label: 'Ability Scores' },
  skills:        { key: 'skills',        id: 'skills',            label: 'Skills' },
  levels:        { key: 'levels',        id: 'level-progression', label: 'Level Progression' },
  picks:         { key: 'picks',         id: 'key-picks',         label: 'Key Picks' },
  gear:          { key: 'gear',          id: 'gear',              label: 'Gear' },
  mythic:        { key: 'mythic',        id: 'mythic-path',       label: 'Mythic Path' },
  combat:        { key: 'combat',        id: 'combat',            label: 'Combat' },
} as const;

const ORDER = Object.values(SEC);

export function buildSections(build: Build): SectionRef[] {
  return ORDER
    .filter((s) => build[s.key as keyof Build] != null)
    .map((s) => ({ id: s.id, label: s.label }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/sections.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sections.ts tests/sections.test.ts
git commit -m "feat: add build-page section source-of-truth helper"
```

---

### Task 4: Rail component

**Files:**
- Create: `src/components/Rail.astro`
- Modify: `src/styles/global.css` (add `.rail-sec` / `.rail-onpage` styles + `.nav` text-decoration; hide `.rail-onpage` in the existing mobile media block)

**Interfaces:**
- Consumes: `groupBuilds`, `shortName` from `src/lib/rail.ts`; `SectionRef` from `src/lib/sections.ts`; the `builds` collection.
- Props: `{ activeSlug?: string; sections?: SectionRef[] }`.

- [ ] **Step 1: Create `src/components/Rail.astro`**

```astro
---
import { getCollection } from 'astro:content';
import { groupBuilds, shortName } from '../lib/rail';
import type { SectionRef } from '../lib/sections';

interface Props {
  activeSlug?: string;
  sections?: SectionRef[];
}
const { activeSlug, sections = [] } = Astro.props;

const groups = groupBuilds((await getCollection('builds')).map((b) => b.data));
---
<aside class="rail" aria-label="Party builds">
  <div class="rail-head">
    <p class="rail-kicker">Pathfinder · WOTR</p>
    <p class="rail-title">Kenabres Codex</p>
    <div class="rail-rule"></div>
  </div>
  <nav class="rail-list">
    {groups.map((g) => (
      <>
        <div class="rail-div">{g.label}</div>
        {g.builds.map((b) => (
          <a class={`nav${b.slug === activeSlug ? ' active' : ''}`} href={`/builds/${b.slug}`}>
            <span class="nav-name">{shortName(b.name)}</span>
            <span class="nav-role">{b.class} · {b.role}</span>
          </a>
        ))}
      </>
    ))}

    {sections.length > 0 && (
      <div class="rail-onpage">
        <div class="rail-div">On this page</div>
        {sections.map((s) => (
          <a class="rail-sec" href={`#${s.id}`}>{s.label}</a>
        ))}
      </div>
    )}

    <div class="rail-div">Reference</div>
    <a class="nav" href="/codex">
      <span class="nav-name">The Codex</span>
      <span class="nav-role">Feats · Spells · Mechanics</span>
    </a>
  </nav>
</aside>
```

- [ ] **Step 2: Add rail-section CSS**

In `src/styles/global.css`, immediately after the `.content{margin-left:264px;}` line (line ~350), add:

```css
  .nav{text-decoration:none;}
  .rail-onpage{display:flex;flex-direction:column;}
  .rail-sec{display:block;padding:4px 13px 4px 22px;margin-left:13px;
    color:#a89468;font-size:12.5px;text-decoration:none;font-variant:small-caps;letter-spacing:.03em;
    border-left:1px solid rgba(181,146,74,.18);}
  .rail-sec:hover{color:#f0dcb4;border-left-color:var(--bronze-br);}
```

- [ ] **Step 3: Hide "On this page" on mobile**

In `src/styles/global.css`, replace the existing mobile media block:

```css
  @media (max-width:860px){
    .rail{position:static;width:auto;height:auto;flex-direction:column;box-shadow:none;border-right:none;
      border-bottom:1px solid rgba(181,146,74,.42);}
    .rail-list{flex-direction:row;flex-wrap:wrap;align-items:stretch;}
    .nav{flex:1 1 auto;}
    .rail-div,.rail-foot{display:none;}
    .content{margin-left:0;}
  }
```

with (adds `.rail-onpage{display:none;}`):

```css
  @media (max-width:860px){
    .rail{position:static;width:auto;height:auto;flex-direction:column;box-shadow:none;border-right:none;
      border-bottom:1px solid rgba(181,146,74,.42);}
    .rail-list{flex-direction:row;flex-wrap:wrap;align-items:stretch;}
    .nav{flex:1 1 auto;}
    .rail-div,.rail-foot,.rail-onpage{display:none;}
    .content{margin-left:0;}
  }
```

- [ ] **Step 4: Verify it compiles**

Run: `bun run build`
Expected: build succeeds. (The rail is not yet mounted by `Base`; this step only confirms the component and CSS compile without error.)

- [ ] **Step 5: Commit**

```bash
git add src/components/Rail.astro src/styles/global.css
git commit -m "feat: add Rail component + rail section-link styles"
```

---

### Task 5: Masthead + SiteFooter components

**Files:**
- Create: `src/components/Masthead.astro`
- Create: `src/components/SiteFooter.astro`
- Modify: `src/styles/global.css` (add `.site-foot` styles)

**Interfaces:**
- Produces: `<Masthead />` (constant branding band; reuses `.masthead` CSS) and `<SiteFooter />` (slim disclaimer/credit strip). No props.

- [ ] **Step 1: Create `src/components/Masthead.astro`**

```astro
---
---
<header class="masthead">
  <p class="kicker">Pathfinder: Wrath of the Righteous</p>
  <h1>The Kenabres Codex</h1>
  <div class="rule"></div>
</header>
```

- [ ] **Step 2: Create `src/components/SiteFooter.astro`**

```astro
---
---
<footer class="site-foot">
  <p>
    A fan project — not affiliated with Owlcat Games or Paizo. Build guides credit
    their original creators. <a href="/codex">Browse the Codex →</a>
  </p>
</footer>
```

- [ ] **Step 3: Add footer CSS**

In `src/styles/global.css`, append at the end of the file:

```css
  .site-foot{max-width:var(--wrap);margin:8px auto 44px;padding:18px 24px 0;
    border-top:1px solid rgba(181,146,74,.28);text-align:center;}
  .site-foot p{margin:0;color:#8c7c5d;font-size:12.5px;font-style:italic;}
  .site-foot a{color:#b59a63;text-decoration:none;border-bottom:1px dotted currentColor;font-style:normal;}
  .site-foot a:hover{color:var(--bronze-br);}
```

- [ ] **Step 4: Verify it compiles**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/Masthead.astro src/components/SiteFooter.astro src/styles/global.css
git commit -m "feat: add Masthead + SiteFooter components"
```

---

### Task 6: Assemble the shell in Base + wire all pages

**Files:**
- Modify: `src/layouts/Base.astro`
- Modify: `src/pages/builds/[id].astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/codex/index.astro`
- Modify: `src/styles/global.css` (add `.build-anchor` scroll offset)

**Interfaces:**
- Consumes: `<Rail>`, `<Masthead>`, `<SiteFooter>` (Tasks 4–5); `buildSections`, `SEC` (Task 3); `SectionRef` type.
- `Base` props become `{ title?: string; activeSlug?: string; sections?: SectionRef[] }`.

- [ ] **Step 1: Rewrite `src/layouts/Base.astro`**

Replace the whole file with:

```astro
---
import '../styles/global.css';
import TermTooltip from '../components/TermTooltip.astro';
import Rail from '../components/Rail.astro';
import Masthead from '../components/Masthead.astro';
import SiteFooter from '../components/SiteFooter.astro';
import type { SectionRef } from '../lib/sections';

interface Props {
  title?: string;
  activeSlug?: string;
  sections?: SectionRef[];
}
const { title = 'The Kenabres Codex', activeSlug, sections } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body>
    <div class="layout">
      <Rail activeSlug={activeSlug} sections={sections} />
      <div class="content">
        <Masthead />
        <slot />
        <SiteFooter />
      </div>
    </div>
    <TermTooltip />
  </body>
</html>
```

- [ ] **Step 2: Add `.build-anchor` scroll offset CSS**

In `src/styles/global.css`, append at the end of the file:

```css
  .build-anchor{scroll-margin-top:24px;}
```

- [ ] **Step 3: Wire `src/pages/builds/[id].astro`**

Update the imports to add the section helper (add below the existing component imports):

```astro
import { buildSections, SEC } from '../../lib/sections';
```

Change the frontmatter tail (after `const { build } = Astro.props;`) to compute sections:

```astro
const { build } = Astro.props;
const sections = buildSections(build);
```

Replace the template body (everything from `<Base ...>` to `</Base>`) with — note the `<main class="content">` wrapper is removed (the shell owns `.content`) and each optional section is wrapped in a `.build-anchor` with the canonical id from `SEC`:

```astro
<Base title={build.name} activeSlug={build.slug} sections={sections}>
  <div class="wrap">
    <BuildHero {...build} />

    {build.identity && (
      <div class="build-anchor" id={SEC.identity.id}>
        <GearRows gear={build.identity} eyebrow="Core Identity" heading="Who You're Building" />
      </div>
    )}

    {build.abilityScores && (
      <div class="build-anchor" id={SEC.abilityScores.id}>
        <StatGrid scores={build.abilityScores} />
      </div>
    )}

    {build.skills && (
      <div class="build-anchor" id={SEC.skills.id}>
        <section class="blk">
          <p class="eyebrow">Skills</p>
          <h2 class="h">Where the Points Go</h2>
          <Prose text={build.skills.main} />
          {build.skills.note && (
            <div class="note-box"><Prose text={build.skills.note} /></div>
          )}
        </section>
      </div>
    )}

    {build.levels && (
      <div class="build-anchor" id={SEC.levels.id}><LevelTable levels={build.levels} /></div>
    )}

    {build.picks && (
      <div class="build-anchor" id={SEC.picks.id}><PicksList picks={build.picks} /></div>
    )}

    {build.gear && (
      <div class="build-anchor" id={SEC.gear.id}><GearRows gear={build.gear} /></div>
    )}

    {build.mythic && (
      <div class="build-anchor" id={SEC.mythic.id}><MythicBlock mythic={build.mythic} /></div>
    )}

    {build.combat && (
      <div class="build-anchor" id={SEC.combat.id}><CombatList combat={build.combat} /></div>
    )}

    {build.footnotes && <Footnotes footnotes={build.footnotes} video={build.video} />}
  </div>
</Base>
```

- [ ] **Step 4: Wire `src/pages/index.astro`**

Replace the template body (from `<Base ...>` to `</Base>`) with — the `<main class="content">` wrapper is dropped and the duplicate site-title `<h1>` is removed (the masthead now carries it):

```astro
<Base title="The Kenabres Codex">
  <div class="wrap">
    <div class="hero">
      <p class="eyebrow">Companion &amp; Mercenary Builds</p>
      <h2 class="btitle">Choose Your Champion</h2>
      <p class="dim">Guides forged in the ashes of the Worldwound — one page per build, each cross-linked to a shared codex of every feat, spell, and mechanic it uses.</p>
    </div>

    <section class="blk">
      <div class="rows">
        {builds.map((b) => (
          <a class="row build-row" href={`/builds/${b.slug}`}>
            <span class="k">{b.name}</span>
            <span class="v">
              {b.role}
              {b.class && ` — ${b.class}${b.archetype ? ` (${b.archetype})` : ''}`}
              <span class="dim"> · {kindLabel(b.kind)}</span>
            </span>
          </a>
        ))}
      </div>
    </section>

    <p class="dim" style="margin-top: 32px;">
      <a href="/codex">Browse the Codex — every feat, spell &amp; mechanic referenced across these builds →</a>
    </p>
  </div>
</Base>
```

(The `<style>` block at the bottom of the file and the frontmatter are unchanged.)

- [ ] **Step 5: Wire `src/pages/codex/index.astro`**

Drop the `<main class="content">` wrapper. Change line ~66 from:

```astro
  <main class="content"><div class="wrap">
```

to:

```astro
  <div class="wrap">
```

and change the closing (line ~125) from:

```astro
  </div></main>
```

to:

```astro
  </div>
```

- [ ] **Step 6: Run the full test suite**

Run: `bun test`
Expected: PASS — all prior tests plus the new `rail` and `sections` tests (Phase 1 had 28; now 28 + 7 = 35).

- [ ] **Step 7: Run the build**

Run: `bun run build`
Expected: build succeeds with no unresolved glossary terms and no errors; `dist/` regenerates.

- [ ] **Step 8: Visual verification (Orca browser first)**

Start the dev server (`bun run dev`) and, using the `orca-cli` skill's embedded browser, verify:
  - **Build page** (e.g. `/builds/camellia`): full-height rail on the left; Camellia highlighted under "Companions"; "On this page" lists its sections and each anchor scrolls to the right section; grand masthead above the content; slim footer below; faint vellum tooth visible on the parchment panel; no horizontal scroll.
  - **Homepage** (`/`): shell present; masthead shows the wordmark with **no** duplicate title in the body; no "On this page" block in the rail.
  - **Codex** (`/codex`): shell present; content framed, not floating.
  - **Mobile width (~700px)**: rail collapses to a horizontal band above the content; group dividers + "On this page" hidden; content spans full width.

- [ ] **Step 9: Commit**

```bash
git add src/layouts/Base.astro src/pages/builds/\[id\].astro src/pages/index.astro src/pages/codex/index.astro src/styles/global.css
git commit -m "feat: assemble app shell in Base and wire rail/masthead/footer into all pages"
```

---

## Self-Review

**Spec coverage:**
- App shell in `Base.astro` (Rail + Masthead + slot + Footer) → Task 6 (+ components in Tasks 4–5). ✓
- Full-height rail, masthead over content column, constant on every page → Tasks 4–6. ✓
- Rail grouped by `kind`, empty groups omitted, sorted → Task 2 (tested) + Task 4. ✓
- "On this page" section links, build pages only, single source of truth, hidden on mobile → Task 3 (tested) + Task 4 (`.rail-onpage` + media hide) + Task 6 (anchors from `SEC`). ✓
- Reference → `/codex` link in rail → Task 4. ✓
- Footer: disclaimer + creator credit + Codex link → Task 5. ✓
- Fine-vellum texture baked to a tileable WebP on disk, panels only → Task 1. ✓
- Reuse ported chrome CSS; net-new CSS limited to footer/vellum/rail-section → Tasks 1,4,5,6 only add those. ✓
- Responsive collapse (already-ported breakpoint) → Task 4 amends that block. ✓
- Homepage keeps body content, just gains shell (no cards/filters) → Task 6 Step 4. ✓
- `/codex` gains shell, layout otherwise unchanged → Task 6 Step 5. ✓
- Tests green, build green, Orca visual → Task 6 Steps 6–8. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete content. ✓

**Type consistency:** `RailBuild`/`RailGroup`/`groupBuilds`/`shortName` (Task 2) used identically in Task 4. `SectionRef`/`SEC`/`buildSections` (Task 3) used identically in Tasks 4 and 6. `Base` props `{ title, activeSlug, sections }` (Task 6 Step 1) match the props passed by `[id].astro` (Task 6 Step 3) and the absence of them on `index`/`codex` (optional). `SEC.*.id` values match the `buildSections` test expectations. ✓
