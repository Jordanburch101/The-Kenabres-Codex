# The Kenabres Codex

A browsable *Pathfinder: Wrath of the Righteous* build directory. Static **Astro**
site; each build and each glossary term is a schema-validated **YAML** content
collection entry. Design + plan live in `docs/superpowers/specs/` and
`docs/superpowers/plans/`.

## Commands

- `npm run dev` — local dev server
- `npm run build` — static build to `dist/` (**fails** on any unknown `[[glossary term]]`)
- `npm test` — Vitest unit tests
- `npm run lint:glossary` — glossary dedup + integrity linter

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
