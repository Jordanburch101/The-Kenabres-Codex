# The Kenabres Codex — Design Spec

**Date:** 2026-07-22
**Owner:** jordan@runn.io
**Repo:** https://github.com/Jordanburch101/The-Kenabres-Codex
**Status:** Approved design, pre-implementation

## Purpose

Turn the single-file *Pathfinder: Wrath of the Righteous* (WOTR) build guide
(prototype: a ~1,500-line hand-authored `index.html`) into a proper, browsable
**build directory** — a static site that scales to 100–200 builds, where each
build is structured data rendered into a consistent page, and a shared glossary
powers wiki links, tooltips, and icons across every build.

The name is in-universe: **Kenabres** is the frontier crusader city where WOTR
opens; the Codex is the curated collection of champion builds kept there.

## What it is / isn't

- **Is:** a browsable directory — a landing page listing builds as cards with
  search + filter (class, role, companion, difficulty, tags), and a dedicated
  page per build. Content authored by a single curator (the owner), Claude-
  assisted, via a repeatable skill.
- **Isn't:** not user-generated (no public uploads, no submission queue); not a
  full web app; no backend, database, or auth. Fully static output.

## Background

The prototype (`wotr-build-guide`, its own spec dated 2026-07-20) proved the
content model and visual design but has two structural problems this project
fixes:

1. **Monolith.** One HTML file holds all builds; adding a build means hand-
   editing ~200 lines of HTML. Doesn't scale to 200 builds.
2. **Hard-coded glossary.** Wiki links, tooltips, and icons come from two giant
   inline JS maps (`T` and `IC`) plus base64-embedded images. Fragile, non-
   reusable, and the single biggest maintenance pain.

The visual design of the prototype is liked and is **preserved** — this is a
re-platforming, not a redesign.

## Architecture

- **Framework: [Astro](https://astro.build)** (static site generation).
  - Content-heavy directory sites are Astro's core use case.
  - Ships **zero JS by default** — build pages stay as fast/clean as the current
    static HTML. SEO-friendly, instant loads.
  - **React islands** for the interactive pieces only (search/filter, and the
    Phase-3 localStorage roster). React earns its place per-component; static
    HTML everywhere else.
- **Content: Astro content collections**, one collection for `builds` and one
  for `glossary`. Entries authored as **YAML**, validated by **Zod schemas**.
  - YAML chosen over JSON/TS: easiest to author and diff, allows comments,
    nested lists (level tables) stay readable.
  - The Zod schema is the contract — a missing field or bad tag fails the build
    at compile time instead of shipping broken.
- **Hosting:** static output to **Vercel** (current host) or Cloudflare Pages —
  interchangeable; no infra beyond the CDN. Default to Vercel for continuity.
- **Tooling: Bun** — the package manager, script runner, and TS runtime for the
  whole project (`bun`/`bunx`, never `npm`/`npx`/`node`). Bun's native TypeScript
  support runs the migration/lint scripts directly (no `tsx`). Tests use
  **Bun's built-in test runner** (`bun test`) — no separate test framework.

## The build schema

One YAML file per build in the `builds` collection. Mostly-fixed schema
(consistent pages, filterable), with two points of deliberate flexibility.

### Classification (powers directory cards + filters)

`slug`, `name`, `tagline`, `kind` (companion | mc | mercenary), `role`,
`class`, `archetype`, `race`, `alignment`, `mythicPath`, `difficultyToPlay`,
`difficultyTarget`, `tags[]`. Optional: `dlc`, `patch`, `updated` (date).

### Media & credit

`video: { youtubeId, creator, creatorUrl? }` — drives the embedded player and
the top/bottom build-maker credit (as in the prototype).

### Content sections (fixed set, canonical render order; any may be omitted)

- `summary` — the intro paragraph (markdown + `[[terms]]`).
- `abilityScores` — per-stat `{ value, tag?, emphasis? }` (emphasis: hi | dump)
  plus a `note`.
- `skills` — `{ main, note }`.
- `levels` — **flexible columns**: `{ headers: [...], rows: [{ lv, cells: [...] }], note? }`.
  Columns vary by class (Ranger's "Combat Style / Terrain / Key Spell" vs.
  Slayer's "Slayer Talent / Sneak Attack" vs. Paladin's "Class / Feat /
  Notable"), so headers are per-build rather than fixed field names.
- `picks` — **one generic list section** covering the place builds differ most
  (casters have "Spells," Wenduag has "On-Hit Effects," others "Buffs"):
  `[{ heading, intro?, items: [{ tag?, name, note }] }]`.
- `gear` — `[{ k, v, flag? }]` (keyed rows; `flag` = the ⓘ verify-in-game note).
- `mythic` — `{ intro?, table?: { headers, rows }, note? }`.
- `combat` — `{ bullets: [...], closer? }`.
- `footnotes` — `[...]` (the "Verify In-Game" list).

**Design decisions baked in:**
1. **Fixed-ish schema, not a freeform `sections[]` array** — keeps pages
   consistent and filterable; the one axis of real variation is absorbed by the
   generic `picks` section with a custom heading.
2. **Flexible level-table columns** — `headers` + `rows` of `cells` rather than
   fixed column names, to handle every class's labelling.

All prose fields and table cells accept inline markdown (`**bold**`) and the
`[[Term]]` glossary syntax (below).

## The glossary system

The core reusability win. Terms (feats, spells, hexes, mythic abilities,
classes, skills, class abilities) are **shared across builds** — `[[Deadly Aim]]`
appears in many builds — so the glossary lives once, normalized, and builds
reference terms by name.

### 1. Shared `glossary` collection

**One file per term** (`glossary/deadly-aim.yaml`) — least merge-conflict-prone
when the skill adds terms, and each term owns its metadata. Schema:

```yaml
name: Deadly Aim
category: feat            # feat | spell | hex | mythic | class | skill | ability
desc: Trade −1 ranged attack for +2 ranged damage; scales with BAB.
wikiSlug: Deadly+Aim      # → fextralife URL, built automatically
icon: deadly-aim.webp     # file in glossary/icons/
aliases: [Point-Blank Shot, PBS]   # optional; absorbs name drift
```

### 2. `[[Term]]` resolver (remark/rehype plugin), validated at build time

Scans every prose string and table cell:
- **found** (by name or alias) → renders the wiki link + hover tooltip + inline
  icon (same look as the prototype, zero hand-written HTML);
- **missing** → **build fails** with `Unknown glossary term "[[Foo]]" in
  builds/<slug>.yaml`. This strict fail is the guardrail that eliminates the
  prototype's silent-breakage fragility.
- **Aliasing / display syntax:** `[[Improved Quarry|Quarry]]` links the former,
  displays the latter; `[[Bleeding Attack|no-wiki]]` = tooltip but no wiki page.

**Decision: strict fail on unknown terms** (approved). The only escape hatch is
defining the term or using an alias.

### 3. Icons as WebP files (no base64, no object storage)

- The full icon library is ~260 KB today and ~1–1.5 MB at 500 terms — trivial;
  **stored as version-controlled files**, CDN-cached. **R2/S3 explicitly not
  needed** (that's for large or user-uploaded media, which this never has).
- Base64 was a prototype constraint (self-contained Artifact / strict CSP) and
  is dropped: files let the browser/CDN cache each shared icon **once** instead
  of re-embedding it on every page, and let Astro hash/optimize them.
- **One-time migration** decodes the ~108 base64 blobs out of the prototype
  `index.html` into named files.
- New icons: the grab agents pipe the fetched image through **`sharp`** (already
  an Astro dependency; cross-platform) → resize 64px → WebP → strip metadata →
  `glossary/icons/<slug>.webp`.

### 4. The glossary linter (local + CI)

Makes the system durable against duplicates (already hit twice in the prototype:
`Point-Blank Shot` vs `Point Blank Shot`; `Mythic Critical` vs
`Improved Critical (Mythic)`). Flags:
- **exact duplicates** — same name/slug in two files (collection loader hard-errors);
- **probable duplicates** — entries whose *normalized keys* collide
  (lowercase, strip spaces/hyphens/punctuation) or share a `wikiSlug` → "merge";
- **missing icon file** — entry references an icon not on disk;
- **dead entries** — defined but referenced by no build (hygiene; uses the
  reverse index);
- **(optional, on-demand)** broken `wikiSlug` — a 200-check against fextralife;
  *not* run every build because fextralife 502s intermittently.

### 5. Auto-generated Index + reverse lookup

The Index/glossary page generates from the collection (no hand maintenance).
Because the store is normalized, each term gets **reverse lookup for free** —
"used in: Wenduag, Demon Slayer, …" — a genuine directory feature and a way to
spot inconsistencies.

## The authoring skill

A repeatable skill captures the whole "video → build page" process. Its loop:

1. **Generate** the build YAML from a pasted transcript/notes, using `[[terms]]`
   freely and normalizing tabletop terms to in-game names.
2. **Extract** all `[[terms]]` across builds; **diff** against the glossary.
3. **Fuzzy pre-check** each missing term against existing names **and aliases**
   (normalized + fuzzy). Close match → **add an alias** to the existing entry
   (flag to the curator: *"Point-Blank Shot ≈ existing Point Blank Shot —
   aliasing, not adding. OK?"*), never a duplicate file.
4. **Enrich** genuinely-new terms via **cheaper-model sub-agents** (the proven
   `grab.sh` pipeline): verify the fextralife slug, fetch the icon → `sharp` →
   WebP file, draft the one-line description → write `glossary/<term>.yaml`.
5. **Lint** (dedup + integrity) and **build** (strict `[[term]]` validation).
6. **Deploy** (Vercel/Cloudflare).

The sub-agent link/icon collection and the `grab.sh` helper already exist from
the prototype and are promoted to permanent tooling here.

## Directory homepage & filtering (Phase 2 focus)

- Landing page lists builds as **cards** (character portrait/role/class/tags).
- **Search** (name/tags) + **filters** (class, role, companion/kind, difficulty,
  mythic path). Implemented as a React island over the static build list.
- **Sidebar rework** — the prototype's tab rail becomes real directory
  navigation (grouped/filterable), preserving the visual style.

## localStorage roster (Phase 3)

- Personal, client-only: **favorite** builds and assemble a **roster** of your
  party for quick reference. No accounts, no server — `localStorage` only.
- A React island; does not turn the site into an app.

## Migration from the prototype

1. Extract the 6 existing builds' content from `index.html` into `builds/*.yaml`.
2. Migrate the `T`/`IC` maps into the `glossary` collection + decode base64 →
   `glossary/icons/*.webp`.
3. Port the CSS and hero/section markup into Astro components, preserving the
   design (theme, hero, video embed + credits, tables, tooltips).
4. Reproduce the video embed behaviour (lazy per-tab `src`, `youtube-nocookie`,
   build-maker credit top + bottom).

## Phasing

- **Phase 1 — Platform + parity:** Astro scaffold, build + glossary schemas, the
  `[[term]]` resolver + linter, migrate the 6 builds and the glossary/icons,
  per-build pages that match the current design, and the authoring skill. Ship
  at parity with the prototype.
- **Phase 2 — Directory:** homepage cards, search/filter, sidebar rework,
  auto-generated Index with reverse lookup.
- **Phase 3 — Personalization:** localStorage favorites + roster.

## Data-structure example (Wenduag, trimmed)

```yaml
slug: wenduag
name: Wenduag — The Throwing-Axe Machine Gun
tagline: Slayer · Spawn Slayer archetype
kind: companion
role: Ranged DPS
class: Slayer
archetype: Spawn Slayer
alignment: Chaotic Evil
mythicPath: Any
difficultyToPlay: Medium
tags: [throwing-axe, two-weapon-fighting, sneak-attack, dispel, non-caster]
video: { youtubeId: -R9s12qkaOM, creator: cRPG Bro }
summary: >
  A rebuild of fighter-Wenduag into a [[Slayer]] who dual-wields **throwing
  axes**…
abilityScores:
  dex: { value: MAX, tag: to-hit, emphasis: hi }
  note: "**DEX is the star** — it drives your attack rolls…"
levels:
  headers: [Normal Feat, Slayer Talent, "Sneak Attack · Class Feature"]
  rows:
    - { lv: 1, cells: ["[[Weapon Focus]] (Throwing Axe)", "—", "Recruit"] }
    - { lv: 2, cells: ["—", "Combat Style: [[Two-Weapon Fighting]]", "—"] }
picks:
  - heading: On-Hit Effects & Party Buffs
    items:
      - { tag: HIT, name: "[[Dispelling Attack]]", note: "each hit strips a buff…" }
gear:
  - { k: Weapon, v: "**Throwing axes**, dual-wielded…", flag: "verify axe name" }
mythic: { intro: "Path-agnostic…", table: { headers: [Rank, Pick, Why], rows: [] } }
combat: { bullets: ["**Pre-buff.** Size spells…"], closer: "The upshot…" }
footnotes: ["**Level-up increases** into DEX…"]
```

## Locked decisions

- Name: **The Kenabres Codex**.
- **Bun** as package manager / script runner / TS runtime / test runner (not npm; no Vitest).
- **Astro** SSG + **React islands** for interactivity; static host (Vercel/CF).
- **YAML content collections** + **Zod** schemas.
- Build schema: **fixed-ish** + generic `picks` + **flexible level-table columns**.
- Glossary: **shared collection, one file per term**, **canonical + aliases**,
  `[[term]]` resolver with **strict build-time failure**.
- Icons: **WebP files via `sharp`**, migrated from base64; **no R2/S3**.
- **Single curator**, no uploads; curation via the authoring **skill**
  (sub-agent link/icon collection + dedup linter).

## Out of scope (YAGNI)

- User-generated content / public submissions / moderation.
- Backend, database, authentication.
- Object storage (R2/S3).
- An interactive character planner (this is a reference directory).
- Automated transcript fetching (owner pastes the transcript).
