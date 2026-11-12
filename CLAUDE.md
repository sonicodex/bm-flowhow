# CLAUDE.md

Working notes for Claude Code agents on this repo. Keep it short.

## Source of truth

- `SPEC.md` — the product spec. Only authoritative reference. Do not edit; propose changes.
- `DECISIONS.md` — append dated entries for every decision not covered by SPEC.md
  and every deviation. Newest first. Never delete an entry: mark it obsolete or
  suspended, with the reason.
- `PLAN.md` — build plan, one `plan_iteration_{n}` per revision. Newest first;
  the iteration marked as current is the approved one.
- `reference/` — prototype, the rules module `core.js` and its test cases,
  sample xlsx, and the xlsx converted to grid JSON (development data).
  Do not edit.
- `theme.css` and `assets/` — delivered design tokens and assets. Do not edit.

## Conventions

- UI language is Spanish (Colombia, `es-CO`), time zone `America/Bogota`.
- Code, identifiers, comments, commits and docs are in English.
- Keep changes minimal: no features, abstractions or dependencies beyond SPEC.md.
- Work branch is `devel`. Small commits, clear English messages. Do not push.
- Root holds SPEC, PLAN, DECISIONS, theme, assets and reference. Where the
  app code lives is set in phase 0.
- Secrets live in `.dev.vars` (ignored), never in the repo.
- Everything runs locally on the Workers runtime with a local D1.
  Tests run inside the Workers runtime too, never against another database.
- Do not deploy to Cloudflare on your own. The owner triggers deployments.
- Propose the slices of each phase and wait for approval before building it.
- Ask before assuming. Prefer short, concrete answers.

## Commands

None yet. The commands for the TypeScript project (dev server, D1 migrations,
tests) are written here in phase 0.
