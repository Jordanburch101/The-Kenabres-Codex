# The Kenabres Codex — Home Directory Page (Design)

**Status:** Approved design, ready for implementation planning.
**Date:** 2026-07-23
**Supersedes:** the temporary `src/pages/index.astro` (a plain styled list of 6 builds).
**Context:** This is the "real directory homepage" called for in Phase 2 of
[`phase-1-outcome.md`](../phase-1-outcome.md). The auto-generated `/codex` and the
personalizable rail already exist; this spec covers the home page only.

## Goal

Replace the temporary home page with a **function-first, filterable build directory**:
a search box + Kind/Role/Class filters driving a grid of rich "index cards", under a
logo-banner masthead. It must stay visually consistent with the existing build pages
(same parchment / wine / bronze design tokens, serif small-caps) and reuse established
component patterns rather than inventing new ones.

## Decisions (from brainstorming)

- **Primary job:** filterable directory (function-first), not a curated gallery or a
  narrative landing page. Chosen deliberately to scale as the build library grows,
  even though several facets are sparse at 6 builds.
- **Rail:** stays exactly as on build pages (build list + Reference → The Codex). Search
  and filters live in the **main column** above the grid, not in the rail. The rail's
  build list and the card grid intentionally coexist (quick-jump vs. rich browse).
- **Cards:** rich index cards — name, class chain, two badges, a 3-line summary snippet,
  a footer meta line (role · kind · difficulty), and a favorite star. No external/off-palette
  imagery; parchment cards on-theme with the build hero.
- **Filters:** free-text search (always) + **Kind, Role, Class** ("core three"). Difficulty,
  Mythic path, and Tag filters are explicitly deferred.
- **Logo:** the logo banner replaces the text masthead **site-wide** (home, build pages,
  Codex), since it already contains the title text.
- **Intro copy (plain & functional):**
  - Eyebrow: `Companion & Mercenary Builds`
  - Heading: `Browse the Builds`
  - Lead: `Detailed WOTR build guides — one page each, with stats, level-by-level
    progression, gear, and tactics. Every feat, spell, and mechanic links to a shared
    codex you can look up in a click.`

## Architecture

Astro static site, same as everywhere else. The page is server-rendered at build time so
all cards exist as static HTML (SEO + no-JS friendly); interactivity is layered on by a
single React island.

### Components & files

**New:**
- `src/components/BuildDirectory.tsx` — React island (`client:load`), consistent with
  `RailNav`/`StarButton`. Owns interactive state: search text + selected Kind/Role/Class.
  Renders the toolbar (search input + three `<select>`s + "Clear filters"), the result
  count, the card grid, and the empty state. Filters the (already server-rendered) build
  data client-side; toggles card visibility + count. Per-card star reuses the `favorites`
  store (`isStarred`/`toggleStar`/`subscribe`) — same wiring as `RailNav.Row`.
- `src/lib/directory.ts` — **pure, testable** helpers over the builds collection:
  - `sortBuilds(builds)` → featured rank ascending (unset ranks last), then alphabetical
    by name. (Result order today: The Demon Slayer, Camellia, then the rest A–Z.)
  - `facets(builds)` → `{ kinds, roles, classes }`, each a de-duplicated, present-only
    option list. Kind carries display labels (`mc → "Main Character"`, `companion →
    "Companion"`, `mercenary → "Mercenary"`). Empty options never appear.
  - `matches(build, query)` → case-insensitive substring test across name, tagline,
    class, role, and tags.
- `src/lib/plainText.ts` — `toPlainText(str)`: strips inline markup used in `summary`
  for the card snippet — `**bold**`/`*italic*`/`` `code` `` → plain text, `[[Term]]` and
  `[[Term|Display]]`/`[[Term|no-wiki]]` → the display term, HTML entities decoded. The
  card never renders glossary tooltips or wiki links (no interactive content nested in a
  clickable card). Visual clamp to 3 lines is CSS (`-webkit-line-clamp`).

**Changed:**
- `src/pages/index.astro` — loads the builds collection, computes `sortBuilds` + `facets`
  + per-build `plainSummary` at build time, passes them to `<BuildDirectory client:load />`.
  Renders the eyebrow/heading/lead intro copy above the island.
- `src/components/Masthead.astro` — replaces the text `<h1>` with the logo `<img>`
  (`alt="The Kenabres Codex"`), responsively sized so it doesn't crowd the build hero on
  content pages. Used site-wide via `Base.astro` (unchanged).
- `src/styles/global.css` — add directory styles (`.dir-toolbar`, `.dir-search`,
  `.dir-select`, `.dir-grid`, `.dir-card`, `.dc-*`, empty state) using existing tokens.
  The card reuses the `.badge`/`.badge.gold`/`.badge.crim` classes.

**Asset prerequisite:** the logo image must be added to `public/` as a **WebP** file
(repo convention: images are WebP on disk, never inlined base64). The source art is
provided by the author; conversion to WebP happens during implementation.

### Card markup & accessibility

Mirrors `RailNav.Row` exactly to avoid the invalid-HTML/a11y bug fixed in commit
`b6e8d44` (a `<button>` must not be nested inside an `<a>`):

```
<article class="dir-card">
  <a class="dc-link" href="/builds/<slug>">…name, tagline, badges, summary, foot…</a>
  <button class="dc-star" type="button" aria-pressed=… aria-label="Star/Unstar <name>">★/☆</button>
</article>
```

The `<a>` is a **stretched link** (covers the card as the click target); the star is a
**sibling** button positioned above it in z-order. Never nested.

### Data flow

1. Build time: `index.astro` reads `getCollection('builds')`, runs `sortBuilds` + `facets`,
   and maps each build to a lightweight shape for the island (slug, name, tagline, class,
   role, kind, `plainSummary`, featured, and up to two badges — the build's first two
   `badges` entries). The footer meta line shows `role · kind`, plus `difficultyTarget`
   **only when the build sets it** (no deriving difficulty from tags).
2. Astro renders the island's initial markup (all cards visible) into static HTML.
3. On the client, `BuildDirectory` hydrates: reads star state from `favorites`, and on any
   search/filter change recomputes which cards match (`matches` + select equality) to show
   the visible set + count. The star toggles via `favorites.toggleStar`.

### Edge cases & responsive

- **Zero matches:** a parchment empty-state panel — "No builds match your filters." + a
  "Clear filters" action that resets search + selects.
- **Grid:** `repeat(auto-fill, minmax(288px, 1fr))` → multi-column on desktop, single column
  on narrow screens.
- **Rail:** keeps its existing ≤860px behavior (collapses to a top bar).
- **Toolbar:** filter controls wrap on narrow widths; search stays full-width.

## Testing (bun:test, native runner)

- `directory.test.ts` — `sortBuilds` order (featured-first then alpha; unset featured last);
  `facets` de-dup, present-only, and Kind label mapping; `matches` across each searchable
  field, case-insensitively.
- `plainText.test.ts` — each markup case: bold/italic/code stripping, `[[Term]]`,
  `[[Term|Display]]`, `[[Term|no-wiki]]`, and entity decoding.

Consistent with the existing 28-test suite; no new test runner or dependency.

## Out of scope (deferred)

- Difficulty / Mythic-path / Tag filters (add later without redesign — the toolbar and
  `facets` are structured to extend).
- The rail's "For You" view logic on the home page, and any roster features beyond the
  existing per-build star.
- Restyling build pages beyond the shared masthead swap.

## Success criteria

- `bun run build` passes (no unknown `[[term]]`; static output).
- Home page renders all builds as static cards with no JS; search + Kind/Role/Class filter
  live with JS; count and empty state behave.
- Card star toggles and persists via `favorites` (shared with rail/hero); no nested
  interactive elements.
- Logo banner shows site-wide; build-page visual design is otherwise unchanged.
- New unit tests pass under `bun test`.
