# Priorities Component Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the "Ability Scores → Priorities" block so priority stats visually dominate, dump stats recede, bare `—` values are gone, and sparse companion builds don't look lopsided.

**Architecture:** Extract the two presentation decisions (is a value a number or a word? which grid layout for N stats?) into pure, unit-tested helpers in `src/lib/stats.ts`. `StatGrid.astro` consumes them for markup; the visual treatment lives in the existing `.stat*` block of `src/styles/global.css`. A two-line content fix removes the last bare `—` values.

**Tech Stack:** Astro (static), TypeScript, Bun test runner (`bun:test`), plain CSS. Bun only — never npm/npx/node.

## Global Constraints

- Use **Bun** (`bun`/`bunx`), never `npm`/`npx`/`node`.
- `bun run build` **must pass** (fails on any unknown `[[glossary term]]`).
- Preserve the ported parchment/bronze visual design; don't restyle beyond this block (CLAUDE.md success criteria).
- Palette variables (from `src/styles/global.css` `:root`): `--parch #eaddbf`, `--parch-2 #e2d4b3`, `--ink-strong #241a0c`, `--ink-dim #6d5e42`, `--ink-mute #8c7c5d`, `--wine #4c1e29`, `--wine-br #7c3241`, `--bronze #a9812f`, `--bronze-br #cfaa5c`, `--bronze-line #b5924a`, `--radius 3px`, `--serif`.
- Browser/visual checks: use the **Orca CLI + Orca embedded browser** via the `orca-cli` skill first; Playwright only if Orca is unavailable.
- **No schema change.** `stat.value` stays a free string (`src/lib/schemas.ts:13-17`).

---

### Task 1: Stat presentation helpers

**Files:**
- Create: `src/lib/stats.ts`
- Test: `tests/stats.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `type ValueKind = 'num' | 'word'`
  - `valueKind(value: string): ValueKind` — `'num'` when the trimmed value is all digits, else `'word'`.
  - `statGridClass(count: number): 'stats--full' | 'stats--few'` — `'stats--full'` when 6 stats are present (full-width 6-column grid), else `'stats--few'` (left-aligned capped-width columns).

- [ ] **Step 1: Write the failing test**

Create `tests/stats.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/stats.test.ts`
Expected: FAIL — cannot resolve `../src/lib/stats` (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/stats.ts`:

```ts
export type ValueKind = 'num' | 'word';

/** All-digit values render as big numbers; everything else as word labels. */
export function valueKind(value: string): ValueKind {
  return /^\d+$/.test(value.trim()) ? 'num' : 'word';
}

/**
 * Full-width six-column grid when all six abilities are present (main
 * characters); otherwise the left-aligned, capped-width layout used by
 * sparse companion builds.
 */
export function statGridClass(count: number): 'stats--full' | 'stats--few' {
  return count >= 6 ? 'stats--full' : 'stats--few';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/stats.test.ts`
Expected: PASS (5 tests / all assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats.ts tests/stats.test.ts
git commit -m "feat: add stat presentation helpers (value kind + grid layout)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Rebuild StatGrid markup + card styling

**Files:**
- Modify: `src/components/StatGrid.astro` (full rewrite of the template)
- Modify: `src/styles/global.css:214-229` (the `/* Stat block */` section)

**Interfaces:**
- Consumes: `valueKind`, `statGridClass` from `src/lib/stats` (Task 1).
- Produces: rendered markup only — grid `<div class="stats stats--full|--few" style="--stat-n:N">`, each `<div class="stat [hi|dump]">` containing `.abbr`, a `.num` **or** `.word` value span, and an optional `.tag`.

- [ ] **Step 1: Rewrite the component template**

Replace the entire contents of `src/components/StatGrid.astro` with:

```astro
---
// "Ability Scores" / "Priorities" block. Priority stats (emphasis: hi) are
// bronze-accented; dump stats recede; numeric values render big, word values
// as labels. Layout switches between a full 6-col grid (MC) and a left-aligned
// capped layout (sparse companions). See docs/superpowers/specs/2026-07-24-*.
import Prose from './Prose.astro';
import { valueKind, statGridClass } from '../lib/stats';
const { scores } = Astro.props; // build.data.abilityScores
const order = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const present = order.filter((k) => scores[k]);
const gridClass = statGridClass(present.length);
---
<section class="blk">
  <p class="eyebrow">Ability Scores</p>
  <h2 class="h">Priorities</h2>
  <div class={`stats ${gridClass}`} style={`--stat-n:${present.length}`}>
    {present.map((k) => {
      const s = scores[k];
      const kind = valueKind(s.value);
      return (
        <div class={`stat ${s.emphasis ?? ''}`}>
          <span class="abbr">{k[0].toUpperCase() + k.slice(1)}</span>
          <span class={kind}>{s.value}</span>
          {s.tag && <span class="tag">{s.tag}</span>}
        </div>
      );
    })}
  </div>
  {scores.note && <Prose text={scores.note} class="dim" />}
</section>
```

- [ ] **Step 2: Replace the Stat block CSS**

In `src/styles/global.css`, replace the current stat block (lines 214-229, from `/* Stat block */` through the `@media` rule) with:

```css
  /* Stat block */
  .stats { display: grid; gap: 8px; margin: 4px 0 16px; }
  .stats--full { grid-template-columns: repeat(6, 1fr); }
  .stats--few { grid-template-columns: repeat(var(--stat-n), minmax(0, 190px)); justify-content: start; }
  .stat {
    position: relative; overflow: hidden; text-align: center; padding: 15px 8px 14px;
    border: 1px solid var(--bronze-line); border-radius: var(--radius);
    background: linear-gradient(180deg, var(--parch), var(--parch-2));
    box-shadow: inset 0 1px 0 rgba(255,247,230,.6);
  }
  .stat .abbr { display: block; font-size: 11px; letter-spacing: .12em; color: var(--wine);
                text-transform: uppercase; font-variant: small-caps; font-weight: 700; }
  .stat .num { display: block; font-family: var(--serif); font-size: 29px; font-weight: 700;
               font-variant-numeric: tabular-nums; margin-top: 5px; line-height: 1; color: var(--ink-strong); }
  .stat .word { display: block; font-size: 14px; font-weight: 700; letter-spacing: .06em; line-height: 1;
                text-transform: uppercase; font-variant: small-caps; color: var(--ink-dim); padding: 8px 0 7px; }
  /* priority */
  .stat.hi { border-color: var(--bronze); background: linear-gradient(180deg, #f4ead0, #ecdcb9); }
  .stat.hi::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
                    background: linear-gradient(90deg, var(--bronze-br), var(--bronze)); }
  .stat.hi .num { color: var(--bronze); font-size: 32px; }
  .stat.hi .word { color: var(--bronze); font-size: 16px; }
  /* dump */
  .stat.dump { opacity: .6; }
  .stat.dump .num, .stat.dump .word { font-size: 14px; color: var(--wine-br); padding: 9px 0 8px; }
  .stat .tag { display: block; font-size: 9px; letter-spacing: .09em; text-transform: uppercase;
               margin-top: 8px; color: var(--ink-mute); }
  @media (max-width: 560px) { .stats--full { grid-template-columns: repeat(3, 1fr); } }
```

- [ ] **Step 3: Build to verify it compiles**

Run: `bun run build`
Expected: build completes with no errors (exit 0). If it fails on a `[[glossary term]]`, that is unrelated to this change — but confirm the error is not in `StatGrid.astro`.

- [ ] **Step 4: Visual check with the Orca browser**

Start the preview: `bun run dev` (note the port, usually 4321).
Using the **orca-cli** skill, open the Orca embedded browser and screenshot:
- `/builds/demonslayer` — the 6-stat main-character grid. Confirm: DEX/CON/WIS are bronze-accented with a bottom rule; STR/CHA are faded; INT is plain; **no `—`** number style appears broken; abbr sits above value.
- `/builds/camellia` — the 2-stat companion. Confirm: two cards left-aligned at ~190px, WIS bronze-accented, no stretching across the full width.

Expected: matches the approved mockups (bronze priority cards dominant, dumps receding, left-aligned sparse layout).

- [ ] **Step 5: Commit**

```bash
git add src/components/StatGrid.astro src/styles/global.css
git commit -m "feat: redesign Priorities block with clear stat hierarchy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Remove bare em-dash values from content

**Files:**
- Modify: `src/content/builds/demonslayer.yaml:38-53` (the `str` and `int` entries under `abilityScores`)

**Interfaces:**
- Consumes: the redesigned component (Task 2), which renders word values legibly.
- Produces: content only.

- [ ] **Step 1: Edit the STR value**

In `src/content/builds/demonslayer.yaml`, under `abilityScores.str`, change:

```yaml
  str:
    value: "—"
    tag: "base*"
    emphasis: dump
```

to:

```yaml
  str:
    value: "base"
    tag: "base*"
    emphasis: dump
```

(Keep `tag: "base*"` — the `*` footnotes the note's `*STR left at base…* ` caveat.)

- [ ] **Step 2: Edit the INT value**

Under `abilityScores.int`, change:

```yaml
  int:
    value: "—"
    tag: don't drop
```

to:

```yaml
  int:
    value: "keep"
    tag: don't drop
```

- [ ] **Step 3: Rebuild and re-check**

Run: `bun run build`
Expected: exit 0.
Then re-screenshot `/builds/demonslayer` via the orca-cli skill. Expected: STR now reads **BASE** (faded, dump style) and INT reads **KEEP** (plain) — no `—` anywhere.

- [ ] **Step 4: Run the full test suite**

Run: `bun test`
Expected: all tests pass (including the new `tests/stats.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/content/builds/demonslayer.yaml
git commit -m "content: replace bare em-dash stat values with intent words

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Direction B / card treatment (hi bronze accent, neutral plain, dump faded) → Task 2 CSS. ✓
- Numeric vs. word rendering → Task 1 `valueKind` + Task 2 markup/CSS. ✓
- Layout by count (6 = full grid w/ 3-up mobile reflow; fewer = left-aligned capped) → Task 1 `statGridClass` + Task 2 `.stats--full`/`.stats--few` + media query. ✓
- Content cleanup (demonslayer `—` → `base`/`keep`) → Task 3. ✓
- No schema change → honored (Global Constraints; `value` untouched). ✓
- Success criteria 1-5 → Task 2 Step 4 + Task 3 Step 3 visual checks + Task 3 Step 4 `bun test` + Task 2 Step 3 `bun run build`. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/vague steps — every code step shows full code. ✓

**Type consistency:** `valueKind`/`statGridClass` signatures and the `'stats--full'|'stats--few'` and `'num'|'word'` string literals are identical across Task 1 (definition), Task 1 tests, and Task 2 (consumption). The markup emits `class={kind}` where `kind` is exactly `'num'`/`'word'`, matching the `.stat .num`/`.stat .word` CSS selectors. ✓
