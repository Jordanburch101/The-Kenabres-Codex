# The Kenabres Codex

A browsable *Pathfinder: Wrath of the Righteous* build directory. Static **Astro**
site; each build and each glossary term is a schema-validated **YAML** content
collection entry. Design + plan live in `docs/superpowers/specs/` and
`docs/superpowers/plans/`.

## Commands

This project uses **Bun** — use `bun`/`bunx`, never `npm`/`npx`/`node`.

- `bun install` — install dependencies
- `bun run dev` — local dev server
- `bun run build` — static build to `dist/` (**fails** on any unknown `[[glossary term]]`)
- `bun run test` — Vitest unit tests (run via Bun; not `bun test`, which is Bun's own runner)
- `bun run lint:glossary` — glossary dedup + integrity linter
- Migration/utility scripts run directly with Bun's native TS support, e.g. `bun scripts/migrate-glossary.mjs`

## Conventions

### Browser automation — Orca first, Playwright only as fallback

For **any** browser task — screenshots, the Task 13 visual-parity diff, DOM
checks, driving the preview server — use the **Orca CLI and Orca's embedded
browser** via the `orca-cli` skill **first**. Only fall back to **Playwright**
(or Computer Use) if the Orca browser is genuinely unavailable for the task.
This is the default for all present and future visual verification in this repo.

### Content

- One build per file: `src/content/builds/<slug>.yaml`.
- One glossary term per file: `src/content/glossary/<slug>.yaml`; icons are
  WebP files in `public/glossary-icons/<slug>.webp`.
- Reference glossary terms in prose and table cells with `[[Term]]` (or
  `[[Term|Display]]`, `[[Term|no-wiki]]`). Unknown terms **fail the build** by
  design — add the term (via the authoring skill's grab flow) rather than
  loosening validation.
- **Never inline base64 images** — icons are always WebP files on disk.
- Preserve the ported visual design; don't restyle build pages (see the plan's
  Success Criteria).
