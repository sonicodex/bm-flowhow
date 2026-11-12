# DECISIONS

Append-only log of decisions not covered by `SPEC.md` and deviations from it.
Newest first. One entry per decision.

Entry format:

```
## YYYY-MM-DD — <short title>
- Decision: <what>
- Reason: <why>
- Spec sections affected: <list or "none">
```

---

## 2026-11-12 — Server contract for import and publish (phase 1.3)

- Decision:
  - **`parseGrid(body)`** checks the grid's exact shape: every row field
    is text, `tags` has exactly the grid's categories, categories are not
    blank or repeated (ignoring case and accents), at least one row. A
    grid that fails did not come from our parser and is refused whole
    (400), not reviewed row by row.
  - **`reviewGrid`** is read-only. It returns the errors of
    `gridToDraft()` and `validate()` in one list, whether any blocks, the
    categories and tags not yet known, and the compiled flow for the
    review's diagram.
  - **`applyGrid`** reviews again (the server never trusts the review the
    browser saw), refuses if anything blocks, and otherwise replaces the
    draft. An import is a save: it writes the draft and a save point in
    one batch. New categories and tags are created only if they are in
    the accepted list; anything new and not listed is dropped, and a
    dropped category takes its column with them.
  - Accepted categories and tags are written in a batch of their own,
    before the draft, so the document can hold their ids. If the draft
    write then failed they would remain, accepted but unused. That is
    harmless, and simpler than building the document inside SQL.
  - **`publishFlow(db, flowId, "minor"|"major")`**: every validation error
    blocks it (`validate()` with refs, plus the area on the first
    publication). It writes release `1.0`, `x.(y+1)` or `(x+1).0`, and
    deletes the draft and its save points, all in one batch. Two
    simultaneous publications collide on `UNIQUE (flow_id, major, minor)`,
    and the second one gets a message asking to reload.
  - **A new flow** starts with an empty draft. Its colour follows the rule
    in SPEC §9 (first colour not in use; once all twelve are taken, the
    least used, lowest number first). The rule was this entry's choice
    until the owner added it to the spec on 2026-11-12; it is now a
    product rule, and `nextColour()` implements it.
  - Server modules import each other with the `.ts` extension
    (`allowImportingTsExtensions`, `verbatimModuleSyntax`), so the dev
    loader of 1.4 can run them in Node without a build step.
- Reason: SPEC §6, §8 and §9; the owner's decisions for phase 1.
- Spec sections affected: 6, 8, 9.

## 2026-11-12 — One row numbering, one error shape, numeric ids (phase 1.2.6)

- Decision:
  - **Rows are numbered as the spreadsheet does**: the header is row 1, so
    the first step is "Fila 2", in `validate()`, `validateRefs()` and
    `gridToDraft()` alike, and in the phase 5 editor. When the step has an
    ID the message names it: «Fila 14 (P13): no existe un flujo llamado
    «Instalaciones».» A missing ID gives the row alone («Fila 3: falta el
    ID.»); a repeated ID names both rows («Fila 5 (P2): el ID «P2» está
    repetido; también está en la fila 4.»).
  - **One error shape** `{row, message, blocking}` for every problem, and
    each problem is reported once. `gridToDraft()` reports only what it
    alone knows (target flow names, "Depende de"); `validate()` reports
    everything about the steps. An import reviews both lists.
    - Blocking (stop the import): missing ID, repeated ID, unknown type,
      unknown target flow name, and the table-level problems of
      `tableToGrid()`.
    - Not blocking (shown on review, stop only publishing): every
      structure rule of SPEC §6, link and subflow target checks, an
      unknown "Depende de" step, "Flujo" filled on another type.
  - **Flow ids stay numbers.** In the grid a target is the name the user
    wrote; in drafts and compiled flows it is the flow id, a number, never
    converted to text. An empty target is `null`. `lib(id)` receives the id
    as stored, and ids are compared with `===`. The examples in `core.js`
    use numeric ids too.
- Reason: Owner's decisions. A step without a stable ID cannot be tracked
  across versions (SPEC §5), and inventing one would be a silent error.
  The row number exists so that someone finds the error in Excel or the
  grid; naming the ID keeps the message right if rows are reordered. A
  field that changes type depending on where it passed breaks the first
  `===` comparison.
- Spec sections affected: 5, 6.

## 2026-11-12 — Types for core.js live in JSDoc (phase 1.2.5)

- Decision:
  - The functions of `core.js` the server uses (`gridToDraft`, `compile`,
    `validate`, `validateRefs`, and `parseExits`/`parseTags`, which shape
    their results) carry JSDoc types, with the shared shapes as `@typedef`
    at the top of the file (`Grid`, `DraftStep`, `Flow`, `Refs`, ...).
    TypeScript code imports them (`import type { Flow } from
    "../public/js/core.js"`).
  - `tsconfig.json` has `allowJs`, so the types reach the server.
    `tsconfig.core.json` checks `core.js` against its annotations
    (`checkJs`), without `strict`: the layout and tour code stay
    unannotated. `npm run typecheck` runs both, plus the tests, where
    `test/core.types.test.ts` holds `@ts-expect-error` cases that fail the
    typecheck if a type stops being enforced.
  - The change to `core.js` is comments only.
- Alternatives considered: a hand-written `core.d.ts`; `allowJs` alone.
  Rejected: a `.d.ts` is a second statement of the truth, and when a
  signature changes and it does not, TypeScript accepts wrong code
  silently. `allowJs` alone checks nothing.
- Reason: Owner's decision for phase 1.2.5.
- Spec sections affected: 9 (one copy of the rules).

## 2026-11-12 — The .xlsx reader (phase 1.2)

- Decision:
  - `app/public/js/xlsx.js` reads one sheet (by name, "Flujo") as rows of
    text cells. No dependency: the zip is read from its central directory
    and inflated with `DecompressionStream`; the XML is read with regular
    expressions that accept namespace prefixes. Every part is checked
    against its CRC.
  - It understands inline strings (openpyxl), the shared-strings table
    (Excel, LibreOffice), rich-text runs (phonetic hints dropped), `_xHHHH_`
    escapes, plain numbers (kept as written), formulas with a stored
    result, and cells or rows without a reference.
  - It refuses, with an `XlsxError`, anything else: not a zip, ZIP64,
    damaged or encrypted files, compression other than deflate, a missing
    sheet, a formula without a stored result, dates (by number format),
    booleans, error cells, merged cells, CDATA. Every message ends with the
    way out: "Abre el archivo en Excel, copia las celdas de la hoja y
    pégalas en el cuadro de pegado."
  - `app/tools/xlsx-to-grid.mjs` generates `reference/*.grid.json` with the
    same reader and `tableToGrid()`. It reproduces both committed files
    byte for byte, from the openpyxl files and from the re-saved one.
- Reason: Owner's decision 1 (own reader, loud failure, explicit fallback).
  The reference xlsx files have no shared-strings table, so
  `Flujo_Instalaciones.resaved.xlsx` covers the form Excel writes.
- Spec sections affected: 0, 6 (import), 9 (Excel and paste).

## 2026-11-12 — Phase 1 choices and the first change to the rules logic

- Decision:
  - **Link steps keep their target.** `compile()` stores `ref` for `link`
    as well as `subflow`. The import format's column is "Flujo" (the old
    "Subflujo" header is still read); `toTSV()` writes "Flujo".
  - **One validation gate.** `validate(flow, refs)` checks the structure
    and, through `validateRefs()`, the flows that link and subflow steps
    point at. For a link: missing target, target not existing, or the flow
    itself; the target only has to exist, not be published, and flows may
    link to each other. `refs = {selfId, lib}` is required whenever the
    flow has link or subflow steps: without it `validate()` throws, so no
    caller can skip the references by mistake (SPEC §9: one validation,
    shared by import and publish). The example's link P6 now carries its
    target ("Facturación", as in SPEC §5); three original test lines pass
    it. (A first version had a separate `validateLinks()`; merged on the
    owner's instruction.)
  - **`parseTable()` is split** into `tableToGrid()` (a table, from a paste
    or an `.xlsx` sheet, into the grid shape; nothing resolved) and
    `gridToDraft()` (resolves target names, merges "Depende de"), so the
    server validates the same grid the browser sends with the same code.
    `parseTable()` is their composition.
  - **Errors are objects** `{row, message, blocking}`, no longer strings.
    An unknown type no longer becomes "Actividad" silently. The full split
    of what blocks is in "One row numbering, one error shape, numeric ids"
    (phase 1.2.6).
  - **xlsx reader is our own**, with no dependency. It fails loudly on
    anything it does not understand and never guesses; the message tells
    the user to paste from Excel instead.
  - The dev loader is a Node script; TypeScript files import each other
    with the `.ts` extension (`allowImportingTsExtensions`), so Node runs
    it without a new dependency.
  - `tools/` in PLAN.md means `app/tools/`. `/flows` is a provisional
    screen (list and create by name) so the import has a target flow.
- Known gap, not solved now: a link stores its target as an id inside the
  document, which has no foreign key. If the target flow is deleted, old
  releases point at nothing. The viewer must treat such a link as an
  inaccessible target and must not fail.
- Reason: Owner's decisions on the phase 1 proposal. Silent fallbacks hide
  mistakes; a blocking error with a clear message gets fixed.
- Spec sections affected: 5 (Step), 6 (import), 9.

## 2026-11-12 — Rules module moved into the app (phase 0.3)

- Decision:
  - `reference/core.js` is now `app/public/js/core.js`, moved with
    `git mv`. Living in the assets directory, the browser receives the
    same file the server imports, with no copy step.
  - One line changed, none of the logic:
    `if (typeof module !== 'undefined') module.exports = Core;` became
    `export default Core;`. The Worker's bundler (esbuild) refused the
    CommonJS form ("No matching export ... for import \"default\""). The
    browser therefore loads it with `<script type="module">`.
  - `reference/core.test.js` is now `app/test/core.test.js`. Every
    original line is kept verbatim; only the `require` line became
    imports, and each commented block of the original is wrapped in one
    `it()`: 12 cases, 35 assert calls, all passing. The empty
    "no repeats" block of the original had no code and stays empty.
  - Those tests use `node:assert`, as the original did, so the test
    runtime turns on `nodejs_compat` (in `vitest.config.ts` only; the
    Worker does not need it).
- Reason: SPEC §0 and §9: one copy of the rules, imported by the server
  and served to the browser. Moved, not rewritten; typing is a separate
  step.
- Spec sections affected: 0 (the table still lists `reference/core.js`),
  9.

## 2026-11-12 — Schema conventions (phase 0.2)

- Decision:
  - **Names are compared without case or accents, through an app-computed
    key.** `areas`, `flows`, `tag_categories` and `tags` have a `name_key`
    column with the UNIQUE constraint; `users.username` is stored as its
    key. The key is `nameKey()` in `app/src/names.ts`: trimmed, accents
    removed (the eñe included) and lower-cased, so "Diseño", "DISEÑO" and
    "Diseno" are one name. The stored name keeps what the user typed; the
    key is only for comparing. Every "already exists" message names the
    existing spelling and states the rule ("Los nombres se comparan sin
    mayúsculas ni tildes."), so the collision does not look like a bug.
  - **A user belongs to zero, one or more areas**, in `user_areas`
    (composite primary key; user deleted → rows deleted, area still
    referenced → refused, as in `flow_areas`). A Standard user must have at
    least one area: a server rule in `app/src/users.ts`, applied on create
    and on save, not a schema constraint. Leaders and Board members may
    have none (SPEC §4).
  - A `sessions` table is part of the initial schema, because SPEC §9 keeps
    sessions in D1. It stores a hash of the cookie token, not the token.
  - The flow colour is its palette slot, 1–12, mapped to `--flow-N`.
  - `tour_visits` stores `step_path` (with the path prefix for nested
    steps) and `exit_index`, NULL when no exit was taken.
  - `review_records` has one row per user and release.
  - Timestamps are UTC ISO-8601 text; booleans are 0/1 integers with a CHECK.
  - Releases, and the areas a user or flow points to, cannot be deleted
    while referenced (`ON DELETE RESTRICT`).
  - The D1 binding has no `database_id` yet. Local dev and tests need none;
    the remote database is created at the deployment check.
  - `/areas` is a provisional screen (list and create) that proves the
    Worker reads and writes D1. Phase 4 restricts it to the Board.
- Reason: SQLite's `COLLATE NOCASE` folds ASCII letters only, so
  "Almacén" and "ALMACÉN" passed as different names; a test on the real D1
  caught it. Accents are ignored too (owner's decision): if they counted,
  "Diseno" typed for "Diseño" would create a duplicate tag silently and
  split the convention filters; ignored, the collision is visible and is
  fixed by renaming. The import format's "Flujo" column also matches its
  target by name, so that match should be tolerant. Users and areas are
  many-to-many because the Board belongs to no area, a Leader covers one or
  more, and some employees work in two. The rest are the smallest choices
  that cover SPEC §4, §5, §7, §8 and §9.
- Spec sections affected: 4, 5, 7, 8, 9 (Data).

## 2026-11-12 — `@cloudflare/vitest-plugin` instead of `vitest-pool-workers`

- Decision: Tests use `@cloudflare/vitest-plugin` 1.8.1, with Vitest 4.1.12.
- Reason: SPEC §9 named `@cloudflare/vitest-pool-workers`, whose README now
  says it has been renamed to `@cloudflare/vitest-plugin` and will receive
  no more updates (npm does not flag it as deprecated; it is replaced). Its last release (0.23.0) bundles wrangler
  4.124.0; the plugin bundles 4.161.0, the same version the project uses.
  It is the same integration under its new name: tests still run inside
  the Workers runtime against the real bindings.
- Spec sections affected: 9 (Tests), since updated by the owner to name
  the new package.

## 2026-11-12 — Role labels confirmed by the owner

- Decision: The roles show on screen as "Empleado", "Líder" and "Junta
  directiva". In code they stay `standard`, `leader` and `board`.
- Reason: Owner's answer to the open question in "Role labels in the UI".
- Spec sections affected: 4.

## 2026-11-12 — Tests run against the same database as the server

- Decision: Tests always run against the same database engine the server
  runs on: D1, inside the Workers runtime (SPEC §9). No phase is closed on
  tests that ran against anything else.
- Reason: In an earlier implementation a failure passed 62 unit tests in
  green and broke on the server, because the tests ran on a different
  database than production. Only tests on the real engine see where
  engines differ.
- Spec sections affected: 9 (Tests), 11.

## 2026-11-12 — Import contract and flow document shape (entrega 1)

- Decision:
  - **Grid** (what the browser sends; SPEC §9 "one single input shape"):
    `{categories: [names], rows: [{id, type, ref, title, description,
    tags: {category: "a, b"}, exits: "Sí:P5 | No:P4", depends_on}]}`.
    `type` is a type code (`start`, …); the browser maps the Spanish labels
    of SPEC §5. `ref` is the target flow's **name**, so reference files
    carry no database ids.
  - **Document** (stored in drafts, save points, releases):
    `{steps: [{id, type, title, description, ref: flow_id|null,
    tags: [tag_id], exits: [{label, to}]}]}`. Tags are stored by id, so a
    rename does not break past releases. Flow name, objective, colour and
    areas live on `Flow`, not in the document.
  - The step `id` (the "ID" column) is the stable id across versions
    (SPEC §5). Import replaces the whole draft, so matching by that column
    is the only way to keep identity across imports.
  - `Flow.name` is unique, because the import format names subflow and
    link targets by name.
  - *Superseded on 2026-11-12 by "One row numbering, one error shape,
    numeric ids" (phase 1.2.6), which holds the current list:* errors that
    the document cannot hold block the import: missing or duplicate ID,
    unknown type, unknown target flow, a flow pointing to itself, blank or
    duplicate category column. Unknown "Depende de" ids are reported and
    change nothing (SPEC §6). Publish rules (§6) are reported on review but
    only block publishing; a draft may be invalid. (Since 1.2.6 a link to
    its own flow is a reference check: it blocks publishing, not the
    import. A blank or repeated category is refused whole by the grid
    shape check of phase 1.3.)
  - Unknown categories (columns) go through the same accept/reject step as
    unknown tags. Rejecting a category drops its column.
  - Tag and category names match case-insensitively; the stored spelling
    is kept.
  - The flow colour is stored as its palette slot (1–12), which maps to
    the `--flow-N` token; no hex value is stored.
- Reason: SPEC §6 and §9 fix the behaviour but not the shapes; these are
  the smallest shapes that cover them.
- Spec sections affected: 5, 6, 8, 9.

## 2026-11-12 — Reference flows as grid JSON, loaded by a dev endpoint

- Decision:
  - `reference/Flujo_Instalaciones.grid.json` and
    `reference/Flujo_Apertura_OT.grid.json` are the two reference xlsx
    files converted once (sheet "Flujo" only) to the grid shape, with a
    throwaway openpyxl script that is not committed. They are new files in
    `reference/`, added on the owner's instruction (PLAN iteration 1,
    point 1); the xlsx files are untouched.
  - The reference flows have no area ("[POR DEFINIR]"), but the first
    publication requires one (SPEC §6). The loader assigns a placeholder
    area "Desarrollo" to a flow it publishes for the first time.
  - Instalaciones must be loaded before Apertura de OT, whose link P13
    points to it.
- Reason: Exercises the real import contract from entrega 1 without the
  server ever reading an xlsx (SPEC §9). `manage.py` cannot reach the
  local D1 (the django-cf D1 backend only runs inside the Worker).
- Spec sections affected: 6, 9, 11.

## 2026-11-12 — Role labels in the UI

- Status: **Superseded** by "Role labels confirmed by the owner" (above).
- Decision: The roles show as "Estándar", "Líder" and "Junta" in Spanish.
- Reason: SPEC §4 names the roles only in English. To be confirmed by the
  owner before entrega 2 shows them on screen.
- Spec sections affected: 4.

## 2026-11-12 — A subflow always resolves to the child's latest release

- Status: **Suspended** (plan_iteration_3, change E). Subflows are out of
  stage 1: neither reference flow uses one, and this decision existed only
  to reconcile an immutable parent release with later child releases.
  Without subflows the question does not arise. The `subflow` type stays in
  the model and the import format with no behaviour. To be taken up again
  in stage 2.
- Decision: A `subflow` step references the child flow by id, and the
  viewer always resolves it to the child's latest release. Publishing the
  parent does not pin the child's version. Consequences:
  - The parent's release document is immutable, but what users see of it
    changes when the child is republished.
  - `ReviewRecord` stores the version of every flow walked in the tour:
    the parent and each subflow, nested ones included.
  - A major release of any of those flows returns the parent to "Pendiente
    de revisión". A minor release keeps "Revisado". No separate rule is
    needed for subflow majors.
- Alternatives considered:
  - The parent pins the child's version at publish time. Rejected: fixing
    a typo in a subflow would require republishing every parent that
    contains it, directly or nested.
- Reason: §8 says users always see the latest release; §7 Subflows says
  the parent always shows the latest published version of the subflow.
  Storing every walked version in the review record keeps the reviewed
  state correct without pinning.
- Spec sections affected: 7 (Subflows, Reviewed), 8 (Versioning), 9 (Data).

## 2026-11-12 — One "Flujo" column for subflow and link targets

- Decision: The import format has a single column "Flujo" (formerly
  "Subflujo") that names the target flow of both `Subflujo` and `Enlace`
  steps. The "Tipo" column tells them apart. Template and export use the
  same column. The step stores the target in one field (`ref`) for both
  types.
- Alternatives considered:
  - Keep "Subflujo" for both types. Rejected: the header is misleading on
    a link row.
  - Add a separate "Enlace" or "Flujo enlazado" column. Rejected: two
    columns that are never both filled on the same row, and one more
    column in a grid that must stay easy to fill (§6).
- Reason: Both types point to another flow by name; one column covers it
  with the least to fill. Already applied to both reference xlsx files and
  written into SPEC §5 by the owner.
- Spec sections affected: 5 (Step), 6 (Editor, import/export).

## 2026-11-12 — The draft is its own row, not the latest save point

- Decision: Each flow has at most one `Draft` row (one-to-one with `Flow`)
  holding the current working document as JSON. Save points are separate,
  append-only snapshots.
  - "Guardar" writes the document into `Draft` and appends a `SavePoint`
    copy of it.
  - "Volver a este punto" copies that save point into `Draft`. It creates
    no new save point and deletes none of the later ones.
  - Import (after the review screen) and "Restaurar" a release replace the
    `Draft` content and append a save point, so both can be undone.
  - Publish copies `Draft` into a new `Release`, deletes every save point
    of the flow, then deletes the `Draft` row. The next edit opens a new
    draft copied from the latest release.
  - A flow with no release yet always has a `Draft` row (created empty
    with the flow).
- Reason: §8 says going back must not discard later save points. If the
  draft were "the latest save point", going back would need either a
  pointer to the current point or a duplicate save point on every
  rewind. A separate row keeps the current state explicit. It also keeps
  the editor-only boundary (§9 "Drafts and save points are sent only to
  editors") on two tables that only editor views read, instead of a field
  on `Flow`, which every viewer query touches.
- Spec sections affected: 8, 9 (Data, server-enforced rules).

## 2026-11-12 — Auto-layout library for the diagram (provisional)

- Decision: Use `@dagrejs/dagre` (v1.1.5) as the client-side auto-layout
  engine. The UMD build is vendored at
  `app/src/flowhow/spike/static/spike/dagre.min.js` and served as a
  regular script tag. Browser draws SVG by hand; no bundler is
  introduced.
- Status: **Provisional.** The 7-step example used in the Step 0 spike
  is too small to stress a layered layout. This choice is to be
  re-confirmed in the real viewer against the 30-step flow in
  `reference/Flujo_Instalaciones.xlsx`, with attention to edge routing
  around decision diamonds and loop-back arrows. If dagre produces
  unreadable layouts there, fall back to `elkjs` (orthogonal routing,
  ~1 MB bundle).
- Reason: Among the evaluated candidates (`dagre`, `elkjs`, `mermaid`),
  dagre is the smallest and simplest layered-graph layout: active
  maintenance, straightforward graph API, enough control for the
  shapes SPEC requires. `elkjs` is more capable but heavier and more
  complex; `mermaid` is diagrams-as-code and conflicts with the editor
  grid.
- Spec sections affected: 9 (Architecture, diagram).

## 2026-11-12 — `tzdata` added as a runtime dependency

- Decision: Add `tzdata` to the Worker dependencies.
- Reason: Pyodide (the runtime powering Python Workers) ships no IANA
  time zone data, so `zoneinfo.ZoneInfo("America/Bogota")` fails without
  this package. SPEC §2 fixes the time zone, so `tzdata` is required.
- Spec sections affected: 2, 9.

## 2026-11-12 — Worker env vars are bridged into `os.environ`

- Decision: `src/entry.py` copies the Worker's `env` properties
  (`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`) into `os.environ` inside
  `get_app()` before importing the WSGI app.
- Reason: Python Workers expose `.dev.vars` entries as attributes of the
  `env` object, not as process env vars, but Django's settings module is
  loaded at import time and reads `os.environ`. The bridge is the
  shortest fix; it runs on every request but the WSGI import is cached.
- Spec sections affected: 9.

## 2026-11-12 — Dedicated test settings module

- Decision: Tests use `flowhow.test_settings`, which injects a disposable
  `DJANGO_SECRET_KEY` and overrides `DATABASES` to in-memory SQLite before
  re-exporting `flowhow.settings`.
- Reason: Pytest runs outside Pyodide and cannot reach the D1 binding or
  the `.dev.vars` secret. The Django-idiomatic split keeps the production
  settings strict (no hardcoded secret, no SQLite fallback).
- Spec sections affected: 11, 12.

## 2026-11-11 — Step 0 setup choices

- Decision: Django package is named `flowhow`. The Worker name in
  `wrangler.jsonc` stays as `app`, and the Python project in `pyproject.toml`
  stays as `django-worker` for now.
- Reason: Owner's instruction. Minimise churn in template-provided names
  where the product name is not user-visible.
- Spec sections affected: 9 (Architecture, naming).

## 2026-11-11 — Local secret storage

- Decision: `SECRET_KEY` is read from the environment variable
  `DJANGO_SECRET_KEY`. Locally it lives in `app/.dev.vars` (git-ignored).
  A committed `app/.dev.vars.example` documents the expected keys with
  placeholder values.
- Reason: SPEC forbids committing secrets; `.dev.vars` is the
  Workers-native mechanism to inject environment variables during
  `pywrangler dev`.
- Spec sections affected: 9 (Architecture, local development).

## 2026-11-11 — Auth verification in Step 0

- Decision: Step 0 proves "own login works end to end" via Django's
  built-in admin login flow (`createsuperuser` + `/admin/login/`). No
  custom login UI is built in Step 0.
- Reason: The product uses its own non-admin login later (§4 and §7), but
  Step 0 is a feasibility spike. Admin login exercises the same auth
  backend and session cookie path without extra scope.
- Spec sections affected: 4, 7, 11 (Step 0).

## 2026-11-11 — Sample flow data for the layout spike

- Decision: The Step 0 layout demo renders a hardcoded copy of the
  sample flow (based on `reference/Flujo_Instalaciones.xlsx` and the
  illustrative table in §5). The data is placed in an isolated file so
  it can be removed without touching production code paths.
- Reason: Step 0 must not depend on the xlsx parser or the domain model,
  which are later slices.
- Spec sections affected: 11 (Step 0).

## 2026-11-11 — Ignore `PROMPT.md`

- Decision: `PROMPT.md` in the repo root is a local scratch file and is
  added to `.gitignore`.
- Reason: Owner's instruction. Not part of the deliverables.
- Spec sections affected: none.
