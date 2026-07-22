# The Kenabres Codex — Phase 1 Outcome & Handoff

**Status:** Phase 1 complete, merged to `main`, live at **https://the-kenabres-codex.vercel.app**.
Companion docs: the [design spec](specs/2026-07-22-the-kenabres-codex-design.md) and the
[Phase 1 plan](plans/2026-07-22-kenabres-codex-phase-1.md). Authoring workflow: the
`add-build` skill in `.claude/skills/`. This file captures the non-obvious context that the
task-by-task scratch ledger (`.superpowers/sdd/progress.md`, gitignored) held during the build.

## What shipped
Astro static site: YAML content collections (Zod), a `[[term]]` resolver with **strict
build-time failure**, a dedup linter, 162 glossary terms + 108 WebP icons, 9 section
components (prototype CSS ported verbatim), a per-build route, all 6 builds, a temporary home
+ auto-generated `/codex` (with "used in" reverse lookup). 28 unit tests (`bun test`).

## Key decisions (not obvious from the code)
- **Content model:** authored strings are **plain text + inline markdown (`**b**`,`*i*`,`` `c` ``)
  + HTML entities (`&mdash;`…) + `[[Term]]` glossary refs**. They must **NOT** contain raw HTML
  tags — the inline renderer (`src/lib/inline.ts`) escapes bare `<`/`>` and generates the only
  tags. Keep this invariant when authoring builds.
- **Section titles are fixed** per component (directory consistency). The only per-build-variable
  section is `picks`, which renders its per-group `heading`. Don't add per-build title fields for
  the other sections without reconsidering this.
- **Glossary:** shared, one file per term (`src/content/glossary/<slug>.yaml`), name + `aliases`;
  unknown `[[term]]` **fails the build** on purpose. Icons are WebP files in
  `public/glossary-icons/` — never base64.
- **Toolchain:** Bun everywhere; tests use **Bun's native runner** (`bun:test`), not Vitest.
- **Visual checks:** Orca browser first, Playwright only as fallback (see `CLAUDE.md`).
- **Parity reference:** the prototype `../wotr-build-guide/index.html` (sibling repo); each build
  is the `id="build-<slug>"` block. Hero `name`/`tagline` must match its `<h2 class="btitle">`/
  `<p class="subtitle">` verbatim.

## Deploy
- Its **own** Vercel project `the-kenabres-codex` (scope `jordan-burchs-projects`), alias
  **the-kenabres-codex.vercel.app**. The prototype is a **separate** project (`wotr-build-guide`)
  — never deploy over it.
- Command: `vercel --prod --yes --scope jordan-burchs-projects --name the-kenabres-codex`
  (the `--name` is required — Vercel derives an invalid uppercase name from the folder otherwise).
  A bare `vercel --yes` creates a *preview* that does **not** move the alias; use `--prod` to update it.

## Deferred Phase-1 follow-ups (non-blocking; from the final review)
- Share the `[[term]]` extraction regex + `normalizeKey` between `scripts/lint-glossary.mjs` and
  `src/pages/codex/index.astro` (currently duplicated). The codex scans `JSON.stringify(build.data)`
  → a latent false-positive only if a build ever uses the `string[]` mythic-row variant (none do).
- `resolveTerm`: `no-wiki` sentinel is case-sensitive; `raw.split('|')` silently drops a 3rd+ segment.
- No unit test for the linter's `dup-slug` check.
- `escapeAttr` in `inline.ts` doesn't neutralize `<`/`>` in `data-desc` (trusted content; latent).
- `Prose.astro` rebuilds the glossary index on every render — memoize (build-time only, ~1s total).
- Level/mythic tables recover the prototype's `.empty` cell dimming but not `.feat`/`.style-cell`
  per-cell classes (would need per-cell schema metadata) — design-parity nuance only.
- `Footnotes.astro` omits the prototype's trailing italic "Source: …" line (no schema field).

## Phase 2 / 3 (next)
- **Phase 2:** the real **directory homepage** (build cards + filter by class/role/companion/
  difficulty/tags) replacing the temporary `src/pages/index.astro`, and the **sidebar rework**;
  auto-generated `/codex` already exists. Interactive bits = React islands.
- **Phase 3:** **localStorage** favorites + a personal roster (React island; no backend).
Each phase gets its own spec → plan → subagent-driven execution, same as Phase 1.
