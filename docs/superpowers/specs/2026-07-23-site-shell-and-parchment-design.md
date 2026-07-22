# The Kenabres Codex — Site Shell & Parchment Texture — Design Spec

**Status:** Design approved, ready for implementation plan.
**Context:** Phase 1 shipped per-build pages, an auto-generated `/codex`, and the
glossary system, but `Base.astro` renders a bare `<slot>` — no site chrome. Every
page is a lone centered `.wrap` panel on the dark surround, so content "floats in
the middle" instead of being framed the way the prototype was. This project
restores the app-shell (rail + masthead + footer) and gives the parchment panels a
real texture. It is a chrome/visual project — a **subset of Phase 2**, deliberately
excluding the homepage cards + search/filter, which remain Phase 2.

Companion docs: the [Phase 1 design spec](2026-07-22-the-kenabres-codex-design.md)
and [Phase 1 outcome](../phase-1-outcome.md). Brainstorm mockups persisted in
`.superpowers/brainstorm/` (gitignored).

## Purpose

Wrap every page in a persistent shell so build/codex/home pages read as one framed
directory, and replace the flat parchment fill with a subtle vellum texture.

## What it is / isn't

- **Is:** a site shell (`Rail` + `Masthead` + `SiteFooter`) rendered by `Base.astro`
  around all pages; a fine-vellum texture on the parchment content panels.
- **Isn't:** a restyle of build sections (the ported visual design is preserved per
  CLAUDE.md), and **not** the homepage cards / search / filter or a `/codex`
  redesign — those stay Phase 2.

## Prior art already in the repo

Most chrome CSS was ported from the prototype into `src/styles/global.css` during
Phase 1 but is **currently unused** (no markup emits it): `.masthead`, `.layout`,
`.rail` (+ `.rail-head/-kicker/-title/-rule/-list/-div/-foot`),
`.content{margin-left:264px}`, and a `max-width` breakpoint that collapses the rail
to a horizontal band. `.content`'s left margin already assumes the **full-height
rail** model (the approved layout). Implementation is therefore mostly "emit the
markup + wire the data + add texture + add footer," reusing existing CSS; net-new
CSS is limited to the footer, the vellum layer, and small rail tweaks (active
state, "on this page" section links).

## Architecture — the shell

`Base.astro` stops rendering a bare slot and instead composes:

```
<body>
  <div class="layout">
    <Rail activeSlug sections />         {/* fixed, full-height, left */}
    <div class="content">                {/* offset by rail width */}
      <Masthead />                       {/* grand branding band */}
      <slot />                           {/* page sections render here */}
      <SiteFooter />
    </div>
  </div>
  <TermTooltip />
</body>
```

Three new components in `src/components/`:

- **`Rail.astro`** — full-height left navigation.
- **`Masthead.astro`** — constant site branding band (over the content column).
- **`SiteFooter.astro`** — slim disclaimer/credit strip.

**Props / data flow.** `Base.astro` gains two optional props beyond `title`:

- `activeSlug?: string` — which build to highlight in the rail.
- `sections?: { id: string; label: string }[]` — the "On this page" list.

Pages that render sections (build pages) pass both; `index.astro` and
`codex/index.astro` pass neither. Each page stops wrapping its own content in a
top-level `<main class="content"><div class="wrap">` — the shell owns `.content`;
pages render the `.wrap` panel(s) and their sections into the slot. (Exact split of
"who renders `.wrap`" is settled in the plan; the panel + its texture stay a page
concern, the `.content` offset is the shell's.)

## The Rail (`Rail.astro`)

- Loads `getCollection('builds')`, groups by `kind` in fixed order — **Main
  Character → Companions → Mercenaries** — and renders only non-empty groups (a
  "Mercenaries" heading appears automatically the first time a mercenary build is
  added; today only Main Character + Companions render). Within a group, sort by
  `name`.
- Rail head: compact wordmark (kicker "Pathfinder · WOTR" + small-caps
  "Kenabres Codex" + rule) — intentionally smaller than the masthead so the two
  don't compete.
- Each build entry: link to `/builds/<slug>` showing `name` and `class · role`;
  `.active` (wine highlight + bronze left-border) when `slug === activeSlug`.
- **"On this page"** divider + one anchor link per entry in `sections`, rendered
  only when `sections` is non-empty (i.e. build pages). Hidden on mobile.
- **Reference** divider → link to `/codex` ("The Codex — Feats · Spells ·
  Mechanics").

**Rail grouping is pure and testable:** a helper (e.g. `src/lib/rail.ts`
`groupBuilds(builds)`) returns the ordered, non-empty groups. Unit-tested for group
order, empty-group omission, and intra-group sort.

## "On this page" — single source of truth

To prevent the rail's section list from drifting from the sections a build page
actually renders, `builds/[id].astro` defines one canonical ordered array of
sections — `{ id, label, present: boolean }` — derived from which build fields are
populated. The page uses it both to (a) render each `<section id=...>` (adding the
stable `id` anchors, which the sections do not all currently have) and (b) build the
`sections` prop passed to `Base` (filtered to `present`). Anchor ids are stable,
kebab-case, page-local (e.g. `ability-scores`, `level-progression`, `combat`).

## Masthead (`Masthead.astro`)

Constant on **every page**: kicker "Pathfinder: Wrath of the Righteous", wordmark
"The Kenabres Codex" (small-caps, bronze drop-cap), bronze rule. Sits above
`.content`'s slot (approved Variant A — masthead over the content column, not a
full-width top banner). Reuses the existing `.masthead` CSS. The build name is not
repeated here — it lives in the build hero.

## Footer (`SiteFooter.astro`)

One slim strip at the bottom of the content column: a fan-project disclaimer ("not
affiliated with Owlcat Games or Paizo"), a note that build guides credit their
original creators, and a quiet link to `/codex`. Dark, understated, top bronze
hairline. New CSS (`.site-foot`), a few lines.

## Parchment texture — fine vellum

- **Asset:** a seamless, tileable WebP at `public/textures/parchment-vellum.webp`,
  generated **once** by a committed helper (`scripts/gen-parchment.mjs`, run with
  Bun + `sharp`) from the approved feTurbulence recipe (`type=fractalNoise`,
  `baseFrequency≈0.9`, `numOctaves=2`, `stitchTiles=stitch`). Keeping the generator
  in-repo documents how the tile was produced and lets us regenerate/tune it. Tile
  size ~256–512px.
- **Application:** a low-opacity (~6–8%) repeating background layer on the parchment
  **content panels only** (`.wrap`) — via an extra `background-image` /
  `background-repeat` layer or a `::before`, composited so it adds tooth without
  shifting the panel color. The dark surround, rail, masthead, and footer stay
  untextured.
- **Rationale:** honors the repo rule "images are files on disk, no base64"; a true
  background-repeater (as originally envisioned); no runtime SVG-filter cost. The
  tile is low-contrast enough that repetition is invisible.
- **No change** to the existing body dark-surround background or the panel's
  layered warm gradient — the vellum sits on top of them.

## Responsive

Below ~860px (the already-ported breakpoint), the rail goes from fixed left column
to a static horizontal band above the content; the masthead stacks above it;
`.content` drops its left margin. The "On this page" list is hidden on mobile
(redundant with a short scroll). No hamburger/drawer.

## Parity & scope guardrails

- Preserve the ported visual design of build sections — this project adds chrome and
  texture only (CLAUDE.md invariant).
- Homepage keeps its current placeholder body content; it only gains the shell.
  Cards/search/filter remain Phase 2.
- `/codex` gains the shell; its internal layout is unchanged (a per-category "on this
  page" list there is a possible future nicety, out of scope now).

## Testing / verification

- `bun test` stays green; add unit tests for `groupBuilds` (order, empty-group
  omission, sort) and for the build-page `sections` derivation if it's factored into
  a pure helper.
- `bun run build` stays green (glossary strictness unaffected).
- Orca-browser visual check (Playwright fallback per CLAUDE.md): a build page, the
  homepage, and `/codex` at desktop + mobile widths — content is framed by rail +
  masthead + footer (no floating), vellum visible on panels, rail highlight + "on
  this page" anchors work.

## Locked decisions

- App shell in `Base.astro`; three components (`Rail`, `Masthead`, `SiteFooter`).
- Full-height left rail; masthead over the content column; constant on every page.
- Rail grouped by `kind` (MC → Companions → Mercenaries), empty groups omitted.
- "On this page" section links in the rail, build pages only, single source of truth
  with the page's rendered sections; hidden on mobile.
- Fine-vellum texture, baked to a tileable WebP on disk, panels only.
- Reuse the already-ported chrome CSS; net-new CSS limited to footer + vellum layer
  + rail active/section tweaks.

## Out of scope (YAGNI)

Homepage build cards, search, filters; `/codex` redesign; mobile drawer/hamburger;
per-page dynamic masthead; sticky/collapsing masthead on scroll (possible later).
