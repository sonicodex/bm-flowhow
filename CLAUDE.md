# CLAUDE.md

Working notes for Claude Code agents on this repo. Keep it short.

## Source of truth

- `SPEC.md` — the product spec. Only authoritative reference. Do not edit; propose changes.
- `DECISIONS.md` — append dated entries for every decision not covered by SPEC.md
  and every deviation. Newest first. Never delete an entry on your own
  initiative: mark it obsolete or suspended, with the reason, so no decision
  is rewritten silently.
- `PLAN.md` — build plan, one `plan_iteration_{n}` per revision. Newest first;
  the iteration marked as current is the approved one.
- `reference/` — prototype, sample xlsx, and the xlsx converted to grid JSON
  (development data). Do not edit.
- `app/public/js/core.js` — the shared rules module (parsing, validation,
  layout, tour engine), moved from `reference/`. The server imports it and
  the browser loads the same file from `/js/core.js` as an ES module. Its
  test cases are `app/test/core.test.js`; keep every one of them.
- `app/public/theme.css`, `flowhow_logotype.svg`, `fonts/`, `icons/` — the
  owner's design tokens and assets, served as they are. Do not edit.

## Conventions

- UI language is Spanish (Colombia, `es-CO`), time zone `America/Bogota`.
- Code, identifiers, comments, commits and docs are in English.
- Keep changes minimal: no features, abstractions or dependencies beyond SPEC.md.
- Work branch is `devel`. Small commits, clear English messages. Do not push.
- Root holds the documents and `reference/`. Everything else lives in `app/`,
  a TypeScript Worker (Hono, server-rendered JSX). `app/public/` is the
  Worker's assets directory; any other path reaches the Worker.
- Schema changes are new files in `app/migrations/`. Never edit a migration
  that has been applied anywhere but your own local database.
- Styles use only `theme.css` tokens: no literal colours, type, spacing or radii.
- Secrets live in `.dev.vars` (ignored), never in the repo.
- Everything runs locally on the Workers runtime with a local D1.
  Tests run inside the Workers runtime too, never against another database.
- Do not deploy to Cloudflare on your own. The owner triggers deployments.
- Propose the slices of each phase and wait for approval before building it.
- Ask before assuming. Prefer short, concrete answers.

## Commands (run from `app/`)

- Install: `npm ci`. It also runs `wrangler types`, which generates
  `worker-configuration.d.ts` (ignored). To add or change a dependency use
  `npx npm@11 install --save-exact <pkg>@<version>`: npm 10 fails resolving
  vitest's peer dependencies ("Cannot read properties of null (reading
  'edgesOut')").
- Apply D1 migrations to the local database: `npm run db:migrate`
  (`app/migrations/*.sql`; local state lives in `app/.wrangler/`, ignored).
- Query the local database: `npx wrangler d1 execute DB --local --command "<sql>"`.
- Dev server: `npm run dev` — serves at `http://localhost:8787`. Apply the
  migrations first.
- Tests: `npm test` — Vitest inside the Workers runtime
  (`@cloudflare/vitest-plugin`), with the bindings from `wrangler.jsonc`.
  Each test starts from an empty local D1 with every migration applied.
- Typecheck: `npm run typecheck` (app) and `npx tsc --noEmit -p test` (tests).
- After changing `wrangler.jsonc`: `npm run types`.
