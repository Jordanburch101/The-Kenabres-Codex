---
name: add-build
description: Add a new build guide to The Kenabres Codex from a build video/transcript — write the YAML, enrich the shared glossary for any new terms, validate, and deploy. Use when the user pastes a WOTR build transcript or asks to add/update a build in this repo.
---

# Add a Build to The Kenabres Codex

This repo is a static Astro directory of *Pathfinder: WotR* build guides. Each build is one
schema-validated YAML file; a shared glossary powers wiki links, tooltips, and icons via a
`[[Term]]` syntax. Toolchain is **Bun** (`bun`/`bunx`, never npm/npx/node).

## The loop

1. **Write the build.** Create `src/content/builds/<slug>.yaml` matching `buildSchema`
   (`src/lib/schemas.ts`). Copy the shape from an existing build (e.g.
   `src/content/builds/wenduag.yaml`) — it's the canonical example. Key rules:
   - Normalize tabletop terms to in-game names; reference any feat/spell/ability/class/skill
     with **`[[Term]]`** (aliasing: `[[Canonical|Displayed]]`, tooltip-only: leave `wikiSlug`
     off the glossary entry). `[[…]]` works in prose, notes, table cells, pick items, gear
     values, identity values, combat bullets, and footnotes — **not** in `badges[].label`
     (badge labels are plain text).
   - `name` = the build's on-screen title; `tagline` = its subtitle (verbatim, don't invent).
   - Section titles are **fixed** by the components (consistency across the directory); the
     one per-build-variable section is `picks` — its `heading` per group is shown, so use it
     for "Spells" vs "On-Hit Effects" vs "Buffs".
   - Flag uncertain proper nouns (exact gear names, locations) with a `flag:` on the gear/row,
     or in `footnotes`. Never invent facts silently.
   - Add `video: { youtubeId, creator }` and the maker credit renders top + bottom.

2. **Build — it fails on unknown terms (by design).** Run `bun run build`. If a `[[Term]]`
   isn't in the glossary the build **fails naming it**. Do NOT downgrade the term to plain
   text — enrich the glossary instead (next step). This strict failure is the guardrail.

3. **Enrich the glossary for each new term.** The glossary is shared, so first check for an
   existing entry (including aliases) before adding — avoid duplicates:
   ```
   grep -ril "<term>" src/content/glossary/          # existing entry?
   bun run lint:glossary                             # duplicates/collisions/missing icons
   ```
   If it's genuinely new, add it (verifies the wiki page, grabs + converts the icon):
   ```
   bun scripts/grab-term.mjs "<Name>" <category> "<WikiSlug>" ["one-line description"]
   ```
   `category` ∈ feat | spell | hex | mythic | class | skill | ability. Fill the `desc` if you
   didn't pass one. For a term with no wiki page, hand-write the YAML with no `wikiSlug`
   (tooltip only). For a name variant of an existing term, add it to that entry's `aliases`
   instead of creating a new file.
   - For a batch of new terms, dispatch cheap sub-agents that each run `grab-term.mjs` (the
     Fextralife site 502s intermittently, so the script retries) — mirror how the original
     glossary was migrated.

4. **Validate.** Loop until clean:
   ```
   bun run build            # 0 unknown-term failures
   bun run lint:glossary    # 0 errors (dead-entry warnings are fine)
   bun test                 # unit tests still green
   ```

5. **Parity-check the page** (optional but recommended for a re-created build): serve it and
   compare against the source video / any reference. Use the **Orca browser** first
   (`orca-cli` skill), Playwright only as a fallback — see `CLAUDE.md`.

6. **Deploy.** `vercel --yes --scope jordan-burchs-projects` (the `the-kenabres-codex`
   project). Verify the alias `https://the-kenabres-codex.vercel.app/builds/<slug>/` serves.

## Notes
- Icons live as WebP files in `public/glossary-icons/` — never base64.
- The `/codex` page and its "used in" reverse lookup regenerate automatically from the
  glossary + builds; no manual index maintenance.
- The design (CSS) is ported verbatim from the prototype and should not be restyled here;
  the directory homepage, filters, and localStorage roster are Phase 2/3 (see the spec).
