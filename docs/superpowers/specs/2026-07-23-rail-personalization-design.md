# The Kenabres Codex — Rail Personalization (Star / Recently Viewed / Featured) — Design Spec

**Status:** Design approved, ready for implementation plan.
**Context:** The site shell shipped a static, grouped rail (`Rail.astro`). This adds
client-side personalization to that rail: a **Directory ⇄ For You** toggle, the ability
to **star** builds (pin them), a **Recently Viewed** list, and a curator-controlled
**Featured** section. This is the localStorage-personalization idea from Phase 3, applied
to the rail (a full "party roster" remains out of scope).

Companion docs: [site-shell spec](2026-07-23-site-shell-and-parchment-design.md),
[Phase 1 outcome](../phase-1-outcome.md). Brainstorm mockups persisted in
`.superpowers/brainstorm/` (gitignored); the approved layout is `rail-states.html`.

## Purpose

Let a visitor curate their own view of the rail — pin favorite builds, see what they
recently opened, and (via a curator-set order) surface featured builds — all client-side,
no backend.

## What it is / isn't

- **Is:** a `RailNav` React island with a Directory/For You toggle, star toggles (rail
  hover + build-page hero), a Recently Viewed list, a curated Featured section, and a
  `localStorage`-backed favorites store shared across islands.
- **Isn't:** a party-roster builder, accounts/sync, or any server state. No analytics —
  "popularity" is a curator-set `featured` rank, not a measured metric.

## Locked decisions (from brainstorming)

- **Toggle:** `Directory` (default) ⇄ `For You`. The last-used view persists per visitor.
- **Directory view:** a **Featured** section on top (builds with a `featured` rank, in
  rank order), then the existing grouped-by-kind list (Main Character / Companions /
  Mercenaries, alphabetical). Featured builds also appear in their group (duplication
  accepted).
- **For You view:** **Starred** (newest-starred first) then **Recently Viewed** (last 6,
  most-recent first, excluding any build already in Starred). Each section hides when
  empty; if both are empty, a single hint is shown.
- **Star control:** a labelled "★ Star" toggle in the build-page **hero**, plus a star
  that appears on **rail row hover** (filled when starred); clicking the rail star toggles
  without navigating.
- **Recently Viewed** is recorded when a build page is opened.
- Persistence: starred set, recently-viewed list, and selected view all live in
  `localStorage` and survive navigation/visits (and sync across tabs).

## Data / schema

Add one optional field to `buildSchema` (`src/lib/schemas.ts`):

```ts
featured: z.number().optional(),   // curator rank; lower = higher. Unset ⇒ not featured.
```

Seed an initial ranking on a **small** subset (e.g. `featured: 1` on the Demon Slayer MC,
`featured: 2` on one companion) as a starting point — explicitly flagged for the curator to
adjust. The Featured section hides entirely when no build has a rank.

## Architecture

Two React islands sharing one store; the rest of the rail stays static Astro.

**Prerequisite setup:** the project currently ships zero client JS via any framework
(its one interactive component, `TermTooltip.astro`, uses a plain Astro `<script>`), and
no React is installed. This feature adds React per the original design's "React islands"
decision, so the plan's first task installs `@astrojs/react` + `react` + `react-dom` (via
`bun add`) and registers the integration in `astro.config.mjs`. Only the two new
components hydrate; everything else stays static.

- **`src/lib/favorites.ts`** — the client store, **factory-based for testability**:
  `createFavoritesStore(storage)` returns the API below over an injected `Storage`-like
  backend; a default singleton `favorites` binds it to `globalThis.localStorage`. Keys:
  `kc:starred`, `kc:recent`, `kc:view`.
  - `getStarred(): string[]` — slugs, newest-starred first.
  - `isStarred(slug): boolean`
  - `toggleStar(slug): void` — unshifts to front if absent, removes if present.
  - `getRecent(): string[]` — slugs, most-recent first (stored cap: 10).
  - `recordView(slug): void` — moves slug to front, dedups, caps.
  - `getView(): 'directory' | 'foryou'` / `setView(v): void`
  - `subscribe(cb): () => void` — fires on any mutation and on cross-tab `storage` events.

- **`src/lib/rail.ts`** (extend with **pure** composition helpers — no storage):
  - `featuredBuilds(builds): RailBuild[]` — those with `featured != null`, sorted by
    `featured` asc then `name`.
  - `forYouSections(builds, starredSlugs, recentSlugs, cap = 6): { starred: RailBuild[];
    recent: RailBuild[] }` — `starred` in `starredSlugs` order; `recent` in `recentSlugs`
    order, excluding starred, capped at `cap`. (`groupBuilds`/`shortName` unchanged.)

- **`src/components/RailNav.tsx`** (React, `client:load`) — props `{ builds: RailBuild[]
  (incl. `featured`); activeSlug?: string }`. Renders the toggle + the active view using
  the pure helpers, using the existing `.rail-div`/`.nav`/`.nav-name`/`.nav-role`/
  `.nav.active` classes plus new `.rail-toggle`/`.rail-star`/`.rail-empty`. On mount:
  reads the store, and if `activeSlug` is set (build pages) calls
  `favorites.recordView(activeSlug)`. Subscribes to the store for live updates. To avoid
  hydration mismatch, server + first client render show the **Directory default with no
  stars**; the effect then reconciles to stored state.

- **`src/components/StarButton.tsx`** (React, `client:load`) — props `{ slug: string }`.
  The hero star toggle; reads `favorites.isStarred`, calls `toggleStar`, subscribes for
  live state. Rendered in `BuildHero.astro`.

- **`Rail.astro`** — keeps the static `.rail-head` (wordmark), mounts `<RailNav
  client:load builds={…} activeSlug={activeSlug} />`, and keeps the **static** "On this
  page" (`sections`) block and Reference → `/codex` link **below** the island (build pages
  only for "On this page"). It passes the builds' `slug/name/kind/class/role/featured`.

## CSS

Reuse the existing rail chrome. Net-new, small: `.rail-toggle` (segmented control),
`.rail-star` (row star, revealed on `.nav:hover`, filled variant), `.rail-empty` (For You
empty hint), and a hero `.star-btn`. No restyle of existing rail rows.

## Responsive

Below the existing 860px breakpoint the rail is already a horizontal band; the toggle stays
at the top and rows wrap as today. "On this page" stays hidden on mobile (unchanged).

## Edge cases

- Build referenced in `localStorage` but no longer present (slug removed): composition
  helpers operate on the real build list, so stale slugs are simply dropped.
- Same build starred and recently viewed: it appears only under Starred (Recently Viewed
  excludes starred).
- localStorage unavailable/blocked: the store degrades to in-memory (no throw); the rail
  still works, just doesn't persist.

## Testing

- **`favorites` store** (via `createFavoritesStore` + a Map-backed fake `Storage`): star
  toggle + newest-first order, `recordView` front-move/dedupe/cap, view get/set,
  subscribe firing. (bun:test — no real `localStorage` needed.)
- **`rail.ts` pure helpers:** `featuredBuilds` (rank asc then name; unset excluded);
  `forYouSections` (starred order preserved; recent excludes starred; cap respected).
- Build + full suite stay green; Orca visual pass: toggle switches views, hero star + rail
  hover star both update the For You/Starred list live, Recently Viewed populates after
  visiting builds, empty state on a fresh profile, persistence across a reload.

## Out of scope (YAGNI)

Party-roster assembly, cross-device sync/accounts, real popularity analytics, drag-reorder
of starred builds, per-section collapse.
