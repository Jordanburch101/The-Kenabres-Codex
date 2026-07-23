# Priorities Component Redesign

**Date:** 2026-07-24
**Component:** `src/components/StatGrid.astro` (rendered under the "Ability Scores → Priorities" section of each build page)

## Problem

The current Priorities block renders as six equal-weight cards in a fixed
STR→CHA grid. It reads as messy and hard to scan:

1. **No hierarchy.** The section is called "Priorities" but every card looks the
   same. The existing `hi`/`dump` emphasis (a bronze number vs. slight dimming)
   is far too subtle to communicate what matters.
2. **Bare `—` looks broken.** Stats left at their base value use `"—"` as the
   value string, which reads like a rendering error. Its meaning lives only in a
   detached `tag` (`base*`, `don't drop`).
3. **Sparse builds look lopsided.** Companion builds list only their 2 priority
   stats. Two cards stretched across a 6-column grid float awkwardly.

## Chosen Direction

**Direction B — polished ordered grid.** Keep the familiar STR→CHA ordering
players expect, but restyle for clear hierarchy. (Alternatives considered: a
tier-banded "priority-first" layout, and a ranked-bar leaderboard. Both scored
lower for departing from the expected ability order and over-reshaping a small
block. Decided via visual mockups in the brainstorm companion.)

### Card treatment (all confirmed against real data in the companion)

- **Priority stats (`emphasis: hi`)** — bronze border, a 3px bronze bottom-rule,
  and a larger bronze value. This is the visual anchor.
- **Neutral stats (no emphasis)** — plain parchment card, ink value.
- **Dump stats (`emphasis: dump`)** — reduced opacity (~0.6), smaller value in
  wine. They recede without disappearing.

### Numeric vs. word values

Each stat's `value` is free text. Render it in one of two styles, chosen
automatically:

- **Numeric** (`/^\d+$/`, e.g. `20`, `12`, `18`) → large tabular-nums number
  (the visual centerpiece of the card).
- **Word** (e.g. `MAX`, `DUMP`, `high`, `base`, `keep`) → medium uppercase
  small-caps label, sized down from the number so numbers and words share a
  consistent rhythm.

The optional `tag` renders as the small uppercase caption beneath the value
(unchanged in role), and the optional `note` renders below the grid as before.

### Layout by stat count

- **6 stats (main characters):** `grid-template-columns: repeat(6, 1fr)` — fills
  the panel width, matching today's layout. On narrow screens (≤560px) it
  collapses to `repeat(3, 1fr)` as it does now.
- **Fewer than 6 (companions):** left-aligned columns at a capped width
  (~190px), starting from the left edge like the MC grid — **not** centered and
  **not** stretched. (Confirmed: left-aligned chosen over centered in mockups.)

Rule of thumb: use the full-width 6-column grid when 6 stats are present;
otherwise fall back to the left-aligned capped-width columns. Real data only
ever produces 6 (MC) or 2 (companion); intermediate counts (3–4) use the
left-aligned path and lay out naturally.

## Content Cleanup

The bare `"—"` values existed only to fill the old number slot. In the new
design, `value` should carry the real intent word. Update
`src/content/builds/demonslayer.yaml`:

- `str.value: "—"` → `"base"` (its `tag: "base*"` still footnotes the note's
  STR caveat, so keep the tag).
- `int.value: "—"` → `"keep"` (keep `tag: "don't drop"`).

No other build uses a bare `"—"` value (verified: `regill.yaml` uses word values
like `MAX / buff`, `high`, `solid`, `low`; companions use `MAX`, `secondary`,
`PRIMARY`, etc.). No schema change is required — `value` stays a free string.

## Scope / Non-Goals

- **CSS + markup change to one component** (`StatGrid.astro`) plus the `.stat*`
  rules in `src/styles/global.css`, plus the two-line content fix above.
- **No schema change**, no data-model change beyond the content cleanup.
- **No changes** to any other build section or the surrounding page. Preserve
  the ported parchment/bronze visual design (per CLAUDE.md success criteria).

## Success Criteria

1. On a 6-stat build (Demon Slayer, Regill), priority stats are unmistakably
   dominant at a glance; dump stats clearly recede; no bare `—` appears.
2. Numeric values render as large numbers; word values render as legible
   labels; both sit on a consistent baseline rhythm.
3. On a 2-stat companion (Camellia, Seelah, Sosiel), the cards are left-aligned
   at natural width — no awkward stretching or floating.
4. Narrow-screen (≤560px) layout still works (6-stat grid reflows to 3-up).
5. `bun run build` passes; the design matches the site's existing palette.
