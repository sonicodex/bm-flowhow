# FlowHow — Specification

FlowHow is the product name. Use it in the UI, page titles and the PWA
manifest.

Single source of truth for building the app. Read it fully before writing code.
If something is missing or ambiguous, ask. Do not assume.

Guiding premise: **less is more**. Build only what is written here.

## 0. Files delivered with this spec

| File | What it is |
|------|------------|
| `SPEC.md` | This document. |
| `app/public/theme.css` | Theme tokens: colours, type, spacing, radii, shadows. Use as is. |
| `app/public/flowhow_logotype.svg` | Logo for the header. |
| `app/public/icons/*.svg` | The ten icons listed in Visual style. |
| `app/public/fonts/ibrand.woff` | The display typeface, self-hosted. `ibrand.otf` beside it is the source file, not for the web. The `@font-face` rule in `theme.css` resolves `./fonts/ibrand.woff` from this layout, so do not rearrange it. |
| `reference/prototype.html` | Working single-file prototype. It is the behaviour and look reference for the editor grid, the diagram, the tour, subflows, flow colours and the mobile layout. Open it in a browser. It is not production code: no server, no users, no versioning. |
| `app/public/js/core.js`, `app/test/core.test.js` | The prototype's logic (parsing, validation, layout, tour engine) and its tests. Not reference material: this is the project's shared rules module, imported by the server and served to the browser. One copy of the rules, never two. The hand-written layout is the only part to replace with a library. |
| `reference/*.grid.json` | Both real flows already converted to the grid shape the importer produces. Development fixtures, loaded from the first phase. |
| `reference/Flujo_Instalaciones.xlsx` | A real flow (30 steps) in the import format, with a sheet of open doubts. Use it as test data. |
| `reference/Flujo_Apertura_OT.xlsx` | A second real flow (36 steps), in the same format. It adds a cycle, a three-branch decision and a `link` step to the other flow. Also carries a sheet of open doubts. |
| `reference/Flujo_Instalaciones.resaved.xlsx` | The same first flow, written by a different program. The two files above were written by openpyxl, which stores every cell as an inline string and ships no `xl/sharedStrings.xml` at all; this one has the shared-strings table that Excel and most other writers produce. Same content, different container. The reader must pass on both. |

When this spec and the prototype disagree, this spec wins; log it in
`DECISIONS.md`.

Repository layout: the documents (`SPEC.md`, `PLAN.md`, `DECISIONS.md`,
`CLAUDE.md`, `README.md`) and `reference/` stay at the repository root.
Everything else lives in `app/`, a TypeScript Worker. The theme, the logo, the
icons and the fonts sit in `app/public/`, which the Worker serves directly:
they are the owner's material, not code, but keeping them where they are
served removes a copy step from every run.

## 1. Purpose

A web app where employees learn the operational process flows of their areas
and get certified on them. It is a learning platform, not a diagramming tool.

- Admins define flows by filling tables. Nobody draws or positions boxes.
- The app renders each flow as a flowchart automatically.
- Employees review flows step by step, then take an assessment (later stage).

Scale: one company, about 50 users, about 8 flows.

## 2. Conventions

- **UI language:** Spanish (Colombia), `es-CO`. Time zone `America/Bogota`.
- **Code language:** English for identifiers, comments, commits, docs and tests.
- User-facing text is written in Spanish directly. No i18n framework.
- Nothing domain-specific is hard-coded: areas, flows, steps and tags are
  generic data created by admins.

## 3. Glossary (Spanish UI term → code name)

| UI (es-CO)        | Code            | Meaning |
|-------------------|-----------------|---------|
| Área              | `Area`          | Group of users. Flows are assigned to areas. |
| Flujo             | `Flow`          | A process. Has a name, optional objective, assigned areas. |
| Paso              | `Step`          | A node of a flow. |
| Salida            | `Exit`          | A directed edge from a step to another step, with optional label. |
| Categoría         | `TagCategory`   | Admin-defined attribute kind, e.g. "Responsable". |
| Etiqueta          | `Tag`           | A value inside a category, e.g. "Almacén". |
| Punto guardado    | `SavePoint`     | Temporary snapshot of a draft. |
| Publicación       | `Release`       | Immutable published version `x.y`. |
| Subflujo          | `Subflow`       | A flow contained in a step of another flow. Reusable. |
| Recorrido         | `Tour`          | Step-by-step guided walk through a flow. |
| Revisado          | `Reviewed`      | User completed the tour under the rules in section 7. |

## 4. Roles and permissions

| Role     | Sees                                   | Gets certified      | Edits |
|----------|----------------------------------------|---------------------|-------|
| Standard | Flows assigned to any of their areas   | Yes, on those flows | No    |
| Leader   | All flows                              | Yes, on all flows   | No    |
| Board    | All flows plus the admin layer         | No                  | Yes   |

- **A user belongs to zero, one or more areas.** One user, many areas, in its
  own table. Most employees belong to one, but some work across two, and a
  leader covers the areas they lead.
- Areas decide two things and nothing else: which flows a Standard user sees,
  and which rows a Leader gets in the progress report. A Leader sees every
  flow whatever their areas.
- Board members belong to no area. They see everything.
- **A Standard user must have at least one area.** The server refuses to
  create or save one without, because a Standard user with no area sees no
  flows, and every user must see at least one. Leaders and Board members may
  have none: their role already shows them every flow.
- Having an area is not the same as having something to see. When a Standard
  user's areas have no flow assigned yet, the screen says so and lets the
  admin continue: flows get assigned later.
- `can_edit` and `can_view_admin_layer` are separate permissions, so the
  second can later be granted to another group without edit rights.
- Accounts are created by an admin. No open sign-up.
- Passwords are reset by an admin. No email sending.
- Auth: own login first. Microsoft SSO comes later; do not block it by design.

## 5. Domain model

### Flow

- `name`: required on creation.
- `objective`: optional, one or two sentences.
- Assigned areas: many-to-many. Required at first publication, not at creation.
- `colour`: one of the 12 flow colours (see Visual style). Presentation only:
  changing it is not a new version and never affects certifications.

### Step

- Fixed fields: `title`, `type`, `description`.
  The description is the instructional content shown in the tour.
- Types: `start`, `activity`, `decision`, `wait`, `subflow`, `link`, `end`.
  A `subflow` step also stores which flow it contains (see Subflows), and so
  does a `link` step; both read it from the same `Flujo` column of the import
  format.
- The import format and the UI name the types in Spanish: `Inicio`,
  `Actividad`, `Decisión`, `Espera`, `Subflujo`, `Enlace`, `Fin`.
- Exits: the steps it leads to. On a decision, every exit has a label.
- A decision has two or more branches, not only two. It can be a yes/no
  question ("Sí", "No") or a switch-case with any number of labelled options
  (e.g. "Domicilio", "Recoge en tienda", "Envío nacional"). Editor,
  validation, diagram and tour must all handle N branches.
- Tags: zero or more values per category.
- Each step has a **stable id that survives across versions**. Progress
  tracking and version comparison depend on it.

### Structure rules

- A flow is a graph: branches, merges and cycles are allowed.
- At least one `start`; more than one is allowed.
- A `link` step points to another flow. It may have exits. It is clickable only
  if the user has access to the target flow; otherwise it shows the name only.

### Tags with categories

Admins create categories and their values. The app knows which category a tag
belongs to, so it can filter and highlight the diagram by category.

### Example step table (illustrative data)

```
ID  TYPE      FLUJO        TITLE               DESCRIPTION                      RESPONSABLE      HERRAMIENTA  EXITS
P1  start                  Recibir solicitud   Llega el pedido del cliente.     Ventas           Correo       P2
P2  activity               Revisar inventario  Se consulta si hay existencias.  Almacén          ERP          P3
P3  decision               ¿Hay existencias?   Define si se compra o despacha.  Almacén          ERP          Sí:P5 | No:P4
P4  activity               Comprar material    Se genera la orden de compra.    Compras          ERP, Correo  P2
P5  activity               Despachar pedido    Se alista y se envía.            Almacén, Ventas               P6
P6  link      Facturación  Pasar a facturación  Continúa en el flujo de facturación.                          P7
P7  end                    Pedido cerrado
```

"Responsable" and "Herramienta" are example categories. Each category is a column.

`FLUJO` carries the name of the flow a `link` or a `subflow` step points at, and
is empty for every other type. A `link` or `subflow` without it is an error:
the step would point nowhere.

## 6. Editor (Board only)

- **Flow form:** name, objective, assigned areas.
- **Step grid:** one row per step, spreadsheet-like, with selectors for type,
  tags and exits. Exits are edited inside the step row; there is no separate
  edges table.
- **Connect from either side.** A step can declare what it leads to ("Salidas")
  or what it depends on ("Depende de", its predecessors). Both are two views of
  the same connections, stored once as exits:
  - Adding a new step and filling only its "Depende de" updates the
    predecessor's exits automatically; the admin never has to edit the
    predecessor row.
  - Editing one column refreshes the other, at the latest on save.
  - When the predecessor is a decision, the dependency carries the branch
    label (e.g. `Sí:P3` means "the Sí branch of P3 leads here").
  - An unknown step ID is reported and changes nothing.
  - Import accepts an optional "Depende de" column and merges it with
    "Salidas". Export writes "Salidas" only, the single source of truth.
- **Three ways to fill the same grid:**
  1. Typing in the grid.
  2. Pasting cells copied from Excel.
  3. Uploading an `.xlsx` file based on a downloadable template that already
     contains the existing category columns.
- No CSV and no JSON import. Export uses the template format.
- **Import rules:** always goes through a review screen (row-level errors plus
  the resulting diagram); replaces the whole draft; lands in the draft, never
  publishes; unknown tags are shown for the admin to accept or reject.
- **Live preview:** read-only diagram next to the grid, redrawn while editing.
- **Ease of use here is critical.** Prefer the simplest interaction.

### Publish validations

Publishing is blocked if:

- there is no `start` step;
- a step is unreachable;
- a decision has fewer than two exits or an unlabeled exit;
- a non-`end` step has no exit;
- no area is assigned (first publication only).

## 7. Viewer

### Home screen

- There is no landing page. The root URL is the login screen.
- A logged-in user, or a user who just logged in, lands on the home screen.
- The home screen lists the flows available to that user. For each flow it
  shows its status and the next action:
  - Stage 1: `pending review` or `reviewed`.
  - Stage 2 adds: `pending assessment`, `certified`, `recertification required`.
- Stage 2 also adds access to the user's valid certificates from this screen.
  Leave room for it; do not build it in stage 1.
- Status must never rely on colour alone: always pair it with a text label or
  an icon.

### Flow selector

- The viewer has a selector to switch from one flow to another. Show it only
  when the user has more than one flow assigned, or is a Board member or a
  Leader. A Standard user with a single flow never sees it.
- Subflows are not listed in the selector. A subflow is reached only through
  the flow that contains it.
- This rule is for the viewer. In the editor, Board members must still be
  able to open any flow, subflows included, to edit it.
- A flow is either assigned to areas or used as a subflow, never both. Block
  assigning an area to a flow that another flow contains, and block using an
  area-assigned flow as a subflow, with a clear message in each case.

### Flow viewer

Pattern: whole → parts → whole.

1. **Overview:** full diagram plus the objective, read-only.
2. **Tour:** one step at a time. Current step highlighted, the rest dimmed.
   Side panel with title, description and tags. "Anterior" / "Siguiente".
3. **Free review:** full diagram, click any step, highlight the steps that
   carry a given tag. Unlocked after finishing the tour.

Tour rules:

- **Following the flow always has priority.** A step with one exit leads to
  the next step even if that step was already visited. Loops are walked as
  the flow draws them: in the example, choosing "No" goes to "Comprar
  material", then back to "Revisar inventario", then to the decision again.
- On a decision (any step with more than one exit), the user picks a branch.
  "Siguiente" is disabled until they choose. Every branch is selectable,
  including the ones already taken, which are marked "Ya recorrida".
- The tour returns to a decision only when a branch reaches a dead end: an end
  step or a step with no next step. It then goes back to the nearest decision
  that still has a branch not yet taken, explains why ("Esa rama terminó en
  «X»"), and the user chooses again.
- If no decision has a branch left to take, the tour moves on to another
  unvisited start.
- **Every branch must be walked.** A tour is complete only when every step
  has been visited and every branch of every decision has been taken at least
  once. Visiting all the steps is not enough: if two branches lead to the same
  step, both must still be chosen. A branch counts as pending until the user
  has chosen it, and is marked "Ya recorrida" afterwards.
- This applies to subflows too: the user cannot return to the parent flow
  until the subflow is complete in this sense.
- The tour can be finished once it is complete and the user is at a dead end
  or at a decision. It is not offered in the middle of a path.
- Safety: at a decision whose branches are all taken while other steps are
  still pending, offer "Ir a lo que falta por visitar". A cycle with no
  decision in it must not trap the user: after one full lap with nothing new,
  treat it as a dead end.
- Progress bar: visited steps over total.
- The active step (current step in the tour, selected step in free review)
  shows its tags as badges on the diagram itself, next to the node, in
  addition to the side panel. Each category has its own visual convention,
  and a legend ("Convenciones") above the diagram names them. Conventions are
  theme tokens per category slot, like every other colour.
- **Reviewed** = tour complete (100 % of steps visited and every branch
  taken, subflows included) **and** a minimum time elapsed in the full tour.
  This unlocks the assessment.
- Minimum time = number of steps in the flow x 5 seconds, counting the steps
  of its subflows (nested ones too). A flow with 9 steps requires 45 seconds.
- The minimum is a total for the whole tour, not per step: a user may spend
  less than 5 seconds on a step and continue. It is checked only when the user
  tries to finish the main flow.
- Never check the time, or show the alert, when the user finishes a subflow
  and returns to its parent. Only the end of the main flow's tour triggers it.
- The time rule is invisible to the user: no timer, no countdown, and the
  minimum duration is never stated. If the user tries to finish too early, show
  only: "Fuiste muy veloz, ¿no se te habrá pasado algo?" and let them keep
  reviewing.
- Record the time each user took to complete the tour (per user and flow
  version). It is always at least the minimum time, because the rule blocks earlier
  completion.

Not included: in-tour quiz questions, phases or step groupings.

### Layout

Designed for desktop, usable on mobile.

- Desktop: diagram card on the left, step panel on the right.
- **Action buttons live inside the diagram card, in its bottom right corner**,
  floating over the diagram: "Anterior" and the primary action ("Siguiente",
  "Entrar al subflujo", "Volver a «…»" or "Terminar recorrido"). The same
  corner holds "Iniciar recorrido" in the overview and "Abrir subflujo" in the
  free review. The "too fast" alert appears next to them. Leave enough bottom
  padding in the diagram so the buttons never hide a step for good.
- The step panel holds the content: step type, title, description, tags, and
  the branch choices when the step is a decision.
- Mobile: the step panel goes **above** the diagram, in a minimal form built
  for phones: step type, title, description, tag values as small chips and
  branch choices. Secondary information (the "next step" hint, subflow
  summary, category names) is hidden. The action buttons stay in the bottom
  right corner of the diagram card, side by side. The same order applies to
  the overview and the free review.
- Mobile tour zoom: during the tour the diagram zooms in on the current step,
  framed together with the step the user came from and the next step or
  branches, so the labels stay readable. A "Ver todo" / "Acercar" toggle
  switches between this view and the whole diagram. Zoomed is the default.

### Subflows — stage 2, do not build

Subflows moved out of stage 1: no real flow uses one, so the whole mechanism
would be built and tested against invented data. The `link` step is the
stage 1 feature and is a different thing: it points at another flow, is
clickable only with access, and both real flows exercise it.

The design below stands for stage 2. In stage 1, keep the `subflow` type in
the data model and the import format so a document that carries one is not
rejected, and build none of the behaviour described here.

A step of type `subflow` contains another flow. Subflows are reusable: any
published flow that is not assigned to an area can be used as a subflow by
several parent flows.

- **Diagram:** a single collapsed box with a distinct mark (double border and
  a plus sign). The parent diagram never expands in place.
- **Tour:** on reaching the box, the primary action is "Entrar al subflujo".
  Entering is mandatory: the user cannot continue until the subflow is fully
  toured. The subflow's diagram replaces the parent's, with a breadcrumb
  ("Parent › Subflow"). When done, the primary action is "Volver a «Parent»",
  and the tour continues from the box.
- The breadcrumb lets the user go back to the parent before finishing, but the
  box still requires entering. A finished subflow can be opened again.
- **Progress and "reviewed":** the subflow's steps count toward the parent's
  100 %. Nested subflows count too.
- **Free review:** selecting the box offers "Abrir subflujo", with the same
  breadcrumb.
- **Editor:** the step type "Subflujo" plus a selector of the flow it contains.
  A subflow is edited like any other flow.
- **Publish validations:** the contained flow must exist and be published; a
  flow cannot contain itself, directly or through other subflows.
- **Versions:** the parent always shows the latest published version of the
  subflow. A major release of a subflow invalidates the certifications of
  every flow that contains it, directly or nested. A minor release does not.
- **Access:** whoever can see a flow always sees its subflows. Subflows are
  not assigned to areas; access comes from the parent.
- **Assessment:** a subflow has no assessment or certificate of its own. It is
  assessed as part of the parent flow that contains it.
- **Several parents:** tour progress belongs to the parent flow. A subflow
  toured inside one flow must be toured again inside every other flow that
  contains it.
- Subflows do not appear as rows of their own in the home screen or in the
  progress report; they count inside their parent.

### Progress report (Board and Leaders)

- A table visible only to Board members and Leaders. Standard users never
  see it.
- One row per employee and assigned flow, with these columns:
  - employee name and area;
  - flow and version;
  - reviewed: yes or no, with the date;
  - review time: how long the tour took;
  - certification score: latest attempt only, with its timestamp, shown
    whether the employee passed or failed;
  - certified: yes or no flag.
- Scope: Board members see every employee. A Leader sees only the employees
  who share at least one area with them. The server applies this filter.
- Sortable and filterable by area, flow and certified status.
- Stage 1 delivers the table with the review columns. Stage 2 adds the score
  and the certified flag; leave those columns out until then.

## 8. Versioning

- Version format `x.y`: `x` major, `y` minor. First publication is `1.0`.
- **Draft:** can be saved many times. Each save creates a save point the editor
  can go back to. Going back does not discard later save points.
- Save points are temporary and visible only to editors.
- **Publish** is explicit. The admin marks the change as minor (default) or
  major. Minor: `1.0 → 1.1`. Major: `1.0 → 2.0`.
- Publishing deletes all save points of that draft.
- Every release (major or minor) is kept forever. Any release can be restored:
  it is copied into the draft and published as a new version.
- Users always see the latest release, never a draft.

### Recertification

- A major release invalidates certifications of that flow.
- A certification stores the version it was earned on. Comparison runs from
  that version to the current one.
- The user tours only the changed steps, each preceded by a recap of the
  previous step. Removed steps are listed in an initial summary.
- A step counts as changed if it is new, if its title, description or tags
  changed, or if its incoming or outgoing connections changed.
- The minimum time does not apply to this tour.

## 9. Architecture

- **Shape:** monolith. One web app, one server, one database.
- **Hosting:** Cloudflare Workers.
- **Server:** TypeScript on Workers, with Hono for routing and for rendering
  HTML on the server.
- **Database:** Cloudflare D1, queried with plain SQL through the `DB`
  binding. No ORM: the schema is six tables plus a JSON document.
- **Schema changes:** versioned `.sql` files applied with
  `wrangler d1 migrations`.
- **One copy of the rules.** The tour engine, the structure validation and the
  grid parsing are one module, imported by the server and served to the
  browser. The server never trusts the browser, but both run the same code,
  so a rule cannot drift between them. This is the reason the server is
  TypeScript: in any other language those rules exist twice and must be kept
  in step by hand, forever.
- **Pages:** server-rendered. Only three screens run JavaScript of their own:
  the step grid, the diagram and the tour. Not a single-page app.
- **Diagram:** layered auto-layout computed in the browser, drawn as SVG.
  Coordinates are never stored.
- **Excel and paste:** parsed in the browser into the grid structure, so the
  server validates one single input shape.
- **Authentication:** sessions stored in D1, passwords hashed with Web Crypto.
  No authentication library.
- **PWA:** manifest plus a service worker that caches the app shell only.
  No offline data.
- **Local development:** `wrangler dev` with a local D1 database. No frontend
  build step or bundler unless a real need appears.
- **Tests:** Vitest with `@cloudflare/vitest-plugin` (the package formerly
  named `@cloudflare/vitest-pool-workers`), so they execute inside the Workers
  runtime against a real local D1. Never test the server against a different
  database than the one it runs on.
- **Deployment:** Cloudflare remains the target, but nothing is deployed until
  the owner asks for it.

### Data

- **Regular tables:** user, area, user–area assignment, flow, flow–area
  assignment, tag category, tag.
- **Document per version:** each save point and each release stores the whole
  flow (steps, exits, tags) as one JSON document.
- **Tracking:** visited steps per user and version with timestamps; reviewed
  record per user and version, including the tour duration in seconds.

### Server-enforced rules

Never trust the browser for any of these:

- Flow visibility by area and role.
- The admin layer is never sent to users without the permission.
- Drafts and save points are sent only to editors.
- The "reviewed" rule (100 % and the minimum time) is checked with server
  timestamps.
- Flow structure validation on publish, whatever the input path.
- Whether a linked flow is accessible to the current user.
- The progress report is served only to Board members and Leaders, and a
  Leader receives only the rows of employees who share an area with them.

### Visual style and theming

- Brand: primary blue `#28519D`, on a light neutral background. There is no
  dark mode. Text and surfaces stay neutral.
- Use the tokens in `theme.css`, delivered with this spec, as the starting
  theme. It already defines every value below. Put the logo file
  `flowhow_logotype.svg` in the header.
- **Variations of the brand blue** come only from this palette: `#1E3F78`
  (hover), `#142A4F` (pressed, deepest tone), `#326AC9` (links), `#3D7FF2`
  (highlights; at 10 % on white it is the light tint).
- **App chrome uses the brand blue:** primary buttons, active navigation,
  links.
- **Each flow has its own colour**, chosen by the admin in the flow form from
  this palette of 12: `#28519D`, `#7D6AC2`, `#CA88D6`, `#B45684`, `#902E33`,
  `#E58B52`, `#976C00`, `#A8AC3D`, `#206616`, `#27BF9A`, `#00868D`, `#32B2E8`.
  A new flow gets the first colour not yet in use.
  - The flow colour drives everything that belongs to the flow: the current
    step (filled with the colour and marked by a soft shadow, with no ring or
    extra border around it), visited steps (filled
    with a lighter tone of the same colour, so the walked path is visible at
    a glance; pending steps stay white and dimmed), the borders of visited
    steps and walked arrows (a darker shade), the progress bar, the active
    phase marker, the branch buttons (a light tint) and a colour dot next to the flow name.
  - Text on the flow colour is white or near-black, whichever has more
    contrast. Several colours in the palette are light and need dark text.
  - A subflow shown inside its parent does not use its own colour: it uses the
    parent's colour with lower brightness, darker at each nesting level. Opened
    on its own, the same flow uses its own colour.
- **Category conventions stay neutral** (greys, plus a dashed variant), because
  hue now identifies the flow.
- **Icons:** use the ten SVG files provided (`pending`, `in_progress`, `done`,
  `alert`, `close`, `back`, `link`, `subprocess`, `hold_on`, `zoom`). Status
  icons keep their own colours: pending red `#C23C3C`, in progress blue
  `#27519B`, done green `#00BB02`, alert yellow `#FFC72A`. The other six are
  single-colour and must take the colour of the text around them
  (`currentColor`), so they also work on a filled step.
- **Focus:** every focusable element shows focus with a soft shadow around it
  (the `--shadow-focus` token), not with an outline ring. Keep a transparent
  outline so the focus stays visible in forced-colours mode. Steps in the
  diagram use the drop-shadow variant (`--shadow-focus-svg`).
- **The active step always carries that shadow**, not only on keyboard focus:
  the current step of the tour and the selected step of the free review show
  it from the moment they become active, whether the user is using the mouse,
  touch or the keyboard.
- Colours must stay fully parameterised, so the palette can change without
  touching components:
  - Define every colour once, as a design token (CSS custom property), in a
    single theme file.
  - Name tokens by role, not by colour: for example `--color-primary`,
    `--color-surface`, `--color-text`, `--color-border`, `--shadow-focus`.
    Never `--black` or `--grey-200` in components.
  - No hard-coded colour values anywhere else: not in templates, stylesheets,
    JavaScript, or the SVG diagram. The diagram, the tour and the grid read the
    same tokens.
  - Changing the brand must require editing only the theme file.
- Apply the same rule to typography, spacing and corner radius.
- **Typefaces:** two, each declared once as a token in `theme.css`, with a
  system fallback.
  - Interface text: Google Sans (`--font-family`), from Google Fonts.
  - Titles and display text: iBrand (`--font-display`), self-hosted. The font
    files sit in `app/public/fonts/`, beside `theme.css`, which is the path
    the `@font-face` rule uses.
- **Where iBrand is used:** page titles, section titles and the flow name in
  the viewer header — display sizes only, `--text-lg` and up. Everything else
  is Google Sans: body text, labels, buttons, form fields, table cells, the
  editor grid and the step titles inside the diagram, which are small, dense
  and sit on filled colour.
- **iBrand has one weight.** Display text uses `--weight-display`; never apply
  a bolder weight to it and never let the browser synthesise one
  (`font-synthesis-weight: none`). It already reads heavy at title sizes.
- Style principles: one primary action per screen, generous white space, short
  text, status always visible.

### Administration screens

- Board members use the app's own screens for everything: flows, users
  (create, assign area and role, reset password), areas, tag categories.
- There is no separate admin panel. The technical owner inspects the database
  directly with `wrangler d1 execute`.

## 10. Scope

**Stage 1 — Core (build this):** login, home screen, areas, users, flow editing
and import, assignment to areas, viewer (overview, tour, free review), reviewed
tracking, `link` steps, flow colours, flow selector, progress report (review
columns), versioning, theme tokens.

**Later, do not build yet:**

- Stage 2: assessments, certificates, recertification tour, subflows.
- Stage 3: admin layer (notes, failure marks, metrics, budgets).
- Microsoft SSO.

Design stage 1 so these fit later, but add no code for them.

## 11. Work order

Stage 1 is built in phases, in this order. The order is deliberate: the
product's value is the viewer, and it is built before authentication so that
nothing waits on login. `PLAN.md` holds the current phase plan in detail.

0. **Skeleton.** The Worker, D1 with SQL migrations, one rendered page, the
   shared rules module, the test runner.
1. **Import.** The grid contract, paste from Excel, both real flows loaded
   and published as 1.0.
2. **Diagram.** The flow viewer in overview mode.
3. **Tour.** Decisions, cycles, exits taken, and the "reviewed" rule. Built
   against a stub user.
4. **Accounts.** Login, users, areas, roles and permissions. The
   server-enforced rules of this section are switched on across every screen
   built so far.
5. **Editor.** The step grid, exits and depends-on, save points, publishing.
6. **Closing.** Free review, mobile layout, `link` steps, flow selector,
   progress report, PWA.

Each phase ends runnable and tested. Propose the slices inside a phase before
building it and wait for approval.

### Deployment check (after phase 1)

The local runtime does not enforce production limits (CPU time, plan quotas).
Deploy once to a test address and confirm that the app starts, and reads and
writes the remote D1.

It happens as soon as there is a database and a route, not at the end: the
later it runs, the more expensive a surprise is. The owner triggers it: never
deploy on your own initiative, and report what the deployment needs before
doing it.

## 12. Working agreements

- Ask instead of assuming. Keep answers short and concrete.
- No features, abstractions or dependencies beyond this document.
- Automated tests for every rule in sections 5, 6, 7, 8 and 9. The tour rules
  in section 7 need the most cases.
- Small commits with clear English messages.
- Keep a `DECISIONS.md` at the repository root. Append one dated entry for
  every decision not covered by this document and every deviation from it:
  date, decision, reason, sections of this spec affected. Newest first.
  Never edit this spec yourself; propose the change and wait for approval.
- Check current Cloudflare Workers, D1 and Hono documentation before relying
  on memory; this platform changes fast.
