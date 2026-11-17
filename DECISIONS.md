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

## 2026-11-17 — Phase 5.10, revised: labels only in the decision; the grid scans again (SPEC §6)

- Decision:
  - **The owner's review of 5.10:**
    - «Agregar paso anterior» showed on every row.
    - A branch label was editable in two places.
    - Salidas sat off screen.
    - Rows of four different heights could no longer be scanned.
    - SPEC §6 was corrected by the owner: a label belongs to its decision
      and is edited only there, and only decision rows grow.
  - **Depende de is a plain field on every row again,** with the step
    suggestions.
    - It shows each predecessor once, and after a decision the labels of
      its branches here, which it cannot change: «P11 (Sí), P14». A branch
      with no label shows «P2 (sin rótulo)».
    - While edited it holds the ids only.
    - Only ids are read (`setDependsOnIds`). What is in parentheses or
      before a colon is ignored, so a label typed there changes nothing.
    - A decision added as a predecessor gets a new branch with no label,
      an empty marked field on the decision's own row, with its message.
    - `predecessorsOf` and `setPredecessors`, the list version, are gone
      with their tests. New tests cover the view, ids only, a decision
      added from here, removal and an unknown id.
  - **Column order in the editor:** Fila, ID, Tipo, Flujo, Título,
    Depende de, Salidas, Descripción, the categories.
    - Connecting from either side is what the editor is for, so it stays
      in view.
    - The export keeps the Excel order (`import-form.js`, unchanged).
    - The width freed goes to Título: 6 → 8.5 × `--space-10`.
    - At 1280px with the preview folded, measured on Instalaciones:
      Salidas ends at x=1225 and the table's visible edge is x=1255.
  - **Two row heights, the owner's choice:**
    - A title shows up to two lines.
    - A description shows one, cut. With no vertical padding while not
      edited, so no part of a second line peeks under it.
    - Both open while edited (up to four lines, then scroll).
    - Only a decision's row is taller, with its branches and «Agregar
      rama».
    - Instalaciones measures 49 or 63px per row, 127 on its four
      decisions. Before, it was 49 to 99px on every row.
    - `resize` is off on these fields, since their height is now set by
      these rules.
  - The phone rules of 5.10 now apply to Salidas only. There is no
    horizontal page scroll on a phone.
  - **Browser checks:**
    - `app/.layout-check/5.10/dep.mjs`, on a throwaway flow deleted
      afterwards, covers Depende de: shown, edited as ids, labels kept, a
      decision added and labelled on its own row, a typed label ignored,
      and an unknown id.
    - `instalaciones.mjs` covers Instalaciones, opened only: measures,
      the full screenshot, a description open while edited, and the
      phone.
- Reason: the owner's review of 5.10 and SPEC §6 as corrected on
  2026-11-17; answers on column order and row heights.
- Spec sections affected: 6.

---

## 2026-11-17 — Phase 5.10: branches edited as lists, nobody types the syntax (SPEC §6)

- *Superseded in part on 2026-11-17 by «Phase 5.10, revised»: Depende de
  is a plain field again and shows labels without editing them; the
  connection columns sit after Título.*
- Decision:
  - **SPEC §6, as changed by the owner:** nobody types `label:target`.
    The cell keeps it (Excel is text, and the same flow travels both
    ways). In the app, though, it is edited as lines.
  - **A decision's Salidas** is a list, one line per branch:
    - a label field, empty with «p. ej. Sí» as placeholder text, which
      suggests without stating;
    - a picker of the flow's steps («P3 — Comprar material»), without the
      step itself and without steps with no id;
    - a × to remove it, and «Agregar rama» below.
    - A decision shows two lines at least, so a missing branch is an
      empty line anyone can see.
    - A line with no step yet lives only on screen; the cell holds only
      complete branches.
    - A target that does not exist (pasted or imported) is shown selected
      as «P9 (no existe)», not lost.
  - **Depende de is a list on every type**, since any step can have several
    predecessors. Each line has a picker of the step before it, and a
    label field only when that step is a decision. Inicio starts with no
    line; other types start with one empty line.
    - Written by `setPredecessors` (grid-edit.js), exactly as on screen.
      Unlike typing the old text cell, emptying a label takes it away.
      A predecessor's other exits and their order stay.
  - **Every other type keeps a plain Salidas field**, with its
    suggestions. When a step stops being a decision, its labels stay in
    that text, so they come back if it becomes a decision again.
  - **No label is ever filled in by the app.** The owner's reason: a
    label put by the app can be false («Sí»/«No» on «¿Quién entrega el
    material?») and would be published without anyone noticing.
  - **Pasting:** text pasted into a label field that has any of
    `, | ; :`, a tab or a line break goes straight into the cell, as
    SPEC §6 says, and the list is drawn again from it. A plain label is
    pasted into its field. The import box is unchanged.
  - **A label cannot hold `, | ;`.** They are taken out as typed, and
    the editor says «Un rótulo no puede llevar coma, | ni ;.».
  - **Messages** (`core.js`, so the import review says the same):
    - The rule message «cada salida necesita un rótulo…» no longer
      exists anywhere.
    - There is one message per branch with no label: «Fila 3 (P2): la
      rama que va a P4 no tiene rótulo.»
    - Fewer than two branches: «…es una decisión, pero solo tiene una
      rama, a P5. Necesita una por cada respuesta posible.» / «…no tiene
      ramas…». No syntax and no examples; the `labelled` helper is gone.
    - «ningún camino desde el Inicio llega…» now says «Elige en su
      Depende de…», since it is a picker.
    - Clicking a problem focuses the row's first marked field (an empty
      label, a missing branch), else its title.
  - **Marks:** an empty label with a step, and an empty picker on a
    decision with fewer than two branches, get `aria-invalid` and a
    border in the colour of problems.
  - **Layout:**
    - Depende de and Salidas widen from 4 to 7 × `--space-10`.
    - At 760px and below they are 5 wide, and each line takes two rows
      (the label above the picker and its ×), so the whole cell fits
      beside the frozen Fila and ID columns.
    - The classes are `grid-branch*`, because `.branch` is the tour's.
  - **Keyboard:** Enter in a label goes to its line's picker.
  - **The editor's hint** no longer shows syntax. It says: «en Depende de
    elige el paso anterior, o en Salidas escribe el ID del siguiente…
    En una decisión, Salidas es una lista de ramas: a cada una le pones
    un rótulo con la respuesta que representa y eliges a qué paso
    lleva.»
  - **One commit**, not the two proposed: both lists are the same code.
  - **Tests:** the grid-edit functions have tests, and the test cases of
    the message tests are kept with the new texts. One more checks that
    no decision message states the rule or shows `Sí:`/`No:`.
  - **Browser check:** `app/.layout-check/5.10/check.mjs`, on a throwaway
    flow deleted afterwards. It covers:
    - unlabelled branches marked, and clicking a problem focusing the
      empty label;
    - Enter going to the picker;
    - labels clearing the problems;
    - adding, picking, removing;
    - a type changed to decision and back;
    - a decision added and labelled from Depende de;
    - a comma typed;
    - pastes of «Almacén:P3 | Proveedor:P4» and «P3, P9»;
    - a title change renaming the pickers;
    - saving, desktop and phone, no horizontal page scroll.
    - Throughout it, the rule message never appeared.
  - It ran against the owner's own `npm run dev` (a terminal started at
    16:09, not mine), which reloads on file changes. A dev server I
    started could not open the locked local database and exited. The
    owner's server and the «Flujo de prueba fase 5» flow were left
    untouched.
- Reason: SPEC §6 as changed by the owner on 2026-11-17; slice 5.10
  approved as proposed.
- Spec sections affected: 6.

---

## 2026-11-17 — Exits separated by a comma (SPEC §5)

- Decision:
  - **The owner's change to SPEC §5:** exits are separated by a comma,
    like every other list in the grid. One grid, one separator. Reading
    still accepts the pipe (and the semicolon, as before), so files
    written before keep working. Writing always uses the comma.
  - **Where it lands:**
    - `core.js` `parseExits` splits on `,`, `|` or `;`, and
      `formatExits` joins with `, `. Everything that writes a Salidas or
      a Depende de cell uses `formatExits`: the grid opened from a draft
      or a release, Depende de rewriting the predecessors, a rename, and
      the messages' examples.
    - The export rewrites each Salidas cell through `parseExits` and
      `formatExits`, so a cell typed with pipes is written with commas.
    - The editor's suggestions complete after the last `,`, `|` or `;`.
    - The editor's hint: «Si son varias, sepáralas con coma, como los
      valores de las categorías, y en una decisión rotula cada una:
      Sí:P5, No:P4.»
    - The examples inside `core.js` (the prototype's flows) are written
      with commas.
  - **A branch label cannot contain a comma**, as SPEC §5 says. No
    stored document had one: checked in the reference grids and in every
    local draft, save point and release before the change.
  - **Round trip:** export then import is compared by connections, not
    by the text of the Salidas cell, as the owner asked. The two
    `reference/*.xlsx` keep their pipes on purpose, as the test that the
    old format still comes in, and are not touched. The test checks that
    they have pipes, that the export has none, and that the connections
    are the same. Tests whose input has pipes keep them; only the
    expected output changed to commas. A new test reads comma, pipe,
    semicolon and a mix.
  - **The problem messages, read in the browser** (the owner asked: the
    tests do not see whether a person understands them). Three changes
    came out of reading them:
    - The examples with «…» read badly («Por ejemplo: Sí:P5, No:….»).
      They now say it in words, with no made-up ids: «Por ejemplo:
      Sí:P5, y No: con el ID del paso al que lleva esa respuesta.» With
      no exit: «…por ejemplo, una con Sí: y otra con No:.»
    - With one exit already labelled «No», the example said «No:P5,
      No:…». The suggested label is now the one still free.
    - The list was grouped by rule, so one row's problems sat far
      apart. The editor's list and the import review now show them in
      table order, the flow's own first (the server's order is
      unchanged).
  - Browser check: `app/.layout-check/messages/check.mjs`, on a
    throwaway flow deleted afterwards, with one case per message. It
    covers:
    - the list read on desktop and phone;
    - a decision fixed by typing «Sí:P3, No:P4»;
    - Depende de shown with a comma, and «No:P2, P1» written into both
      predecessors with commas;
    - suggestions after «Sí:P5, No:»;
    - the hint;
    - no horizontal page scroll.
  - Local state seen, left untouched: a flow «Flujo de prueba fase 5»,
    the owner's.
- Reason: SPEC §5 as changed by the owner on 2026-11-17; owner's request
  to read the messages in the browser.
- Spec sections affected: 5, 6.

---

## 2026-11-17 — Problem messages speak about the row, not the rule

- *Superseded in part on 2026-11-17 by «Exits separated by a comma»: the
  examples are written with commas, the one-exit and no-exit examples
  are worded without «…», and the list is shown in table order.*
- *Superseded in part on 2026-11-17 by «Phase 5.10»: the decision
  messages no longer carry examples. The one about labels is one message
  per branch.*
- Decision:
  - **The owner's finding:** «cada salida de una decisión necesita rótulo
    (ej. Sí:P5 | No:P4)» stated the rule, with ids that were not the
    user's, and did not say what that row lacked. Every message of the
    problem list (`core.js`: `validate`, `validateRefs`, `gridToDraft`)
    now says what happens with that row, using its own data, and what to
    do about it. The rules, and which ones block, are unchanged.
  - **Decisions say how many exits they have, and their example is built
    from the row's own exits:**
    - with no label: «Fila 3 (P2): es una decisión, así que cada salida
      necesita un rótulo que diga qué significa. Por ejemplo: Sí:P3 |
      No:P4.»;
    - a label already there is kept, and the others get Sí and No if
      they are free, then «Opción n»;
    - with one exit: «…solo tiene una salida, a P3. Necesita una por
      cada respuesta, con su rótulo. Por ejemplo: Sí:P3 | No:….»;
    - with none: «…no tiene salidas…», with «…» in place of the steps.
  - **One message per decision.** A decision with fewer than two exits
    gets only the message about its exits, not also the one about labels.
    A decision with no exit no longer also gets «no lleva a ningún paso»,
    the general message. It is still blocked, by its own message.
  - **The example is written with `formatExits`**, the same function
    that writes the Salidas cell, so it follows the grid's separator. It
    shows «|» today, because the comma of SPEC §5 (the owner's pending
    change) is not built yet.
  - The rest, briefly:
    - an exit to a missing id names it, and says that no step has it;
    - «no lleva a ningún paso», with what to write, or to change it to
      Fin;
    - an unreachable step says to write the step before it in its
      Depende de;
    - a flow with no Inicio says which step to change;
    - links and subflows say what is missing and which column to fix;
    - a Flujo cell on another type names that type;
    - an unknown id in Depende de says that no step has it;
    - a missing id, a repeated id, a missing title and an unknown type
      say why it matters for that row.
  - The tests keep every case, with the new texts. New ones cover:
    - the owner's example;
    - a label kept;
    - three exits;
    - one exit and none.
- Reason: owner's report from using the editor (phase 5 testing).
- Spec sections affected: 6 (publish validations: wording only).

## 2026-11-17 — The live preview starts folded away (SPEC §6)

- Decision:
  - **The owner changed SPEC §6:** the preview starts folded away,
    because the grid needs the width more. With the preview open on a
    small screen, the editing columns are squeezed and typing a row
    means scrolling sideways.
  - **The control is a button in the editor's toolbar**, «Mostrar vista
    previa» / «Ocultar vista previa», with `aria-expanded` and
    `aria-controls`.
  - **Folded, the grid takes the whole width.** Nothing is laid out until
    the preview opens; opening draws the current grid at once.
  - **The choice is remembered per person and per device** (the owner's
    answer). It lives in the browser's `localStorage`, under a key that
    carries the user's id (`flowhow.editor.preview.<id>`). So:
    - on a large screen, the person opens it once and it stays open;
    - on their phone, it stays folded unless they open it there;
    - two people sharing a computer each keep their own choice.
    Only «open» is stored. Without storage (private window, site data
    cleared) the editor simply starts folded every time.
    Remembering it on the server, which would add a migration, was not
    chosen: it would follow the person to every device, opening the
    preview on the phone too.
  - Measured at 1280 px wide on Instalaciones, the columns fully in view
    without scrolling sideways:
    - folded: Fila, ID, Tipo, Flujo, Título, Descripción and
      Responsable;
    - open: up to Título.
    On a phone (390 px) the preview was already below the grid, so
    folding it changes nothing there: Fila, ID and Tipo fit either way.
    The squeeze the change removes happens between the phone and a large
    screen.
  - Browser check: `app/.layout-check/preview-fold/check.mjs` on
    Instalaciones, nothing saved. It covers:
    - folded on the first visit;
    - opened, stored under the user's id, still open after a reload;
    - a step clicked on the diagram goes to its row;
    - closed, the key removed, folded after a reload;
    - desktop and phone, with no horizontal page scroll.
- Reason: SPEC §6, as changed by the owner on 2026-11-17.
- Spec sections affected: 6.

---

## 2026-11-17 — Phase 5 closed: the editor (phase 5.9)

- Decision:
  - **Creating a flow leads to its editor**
    (`/flows/:id/edit?creado=1`), not back to the list, as 5.3 left
    pending. A new flow has no steps, and the editor is where they are
    written or imported. The editor says how: «Agregar paso» or
    «Importar desde Excel». The new flow form's hint says it too.
  - **The access table** (`test/access.test.ts`) holds every route the
    phase added, all `editor`:
    - the editor and the draft's save and import review;
    - publishing;
    - save points and versions, with their restore routes;
    - the categories screens.
    The test walks each route as each role.
  - **DEPLOY.md** gains what to measure for the editor after deploying:
    its save, import review and publish on the largest real flow.
  - **CLAUDE.md** lists `xlsx-write.js` beside the reader.
  - **End-to-end browser check**: `app/.layout-check/5.9/check.mjs`, on
    a throwaway flow, deleted afterwards (it left no tour runs). It
    walks the Board's path:
    1. Create the flow from the list, landing on its editor.
    2. Download the template, then import Flujo_Apertura_OT.xlsx
       (36 steps, a link to Instalaciones) through the review.
    3. Add a step connected from «Depende de», drawn in the preview,
       and save with Ctrl+S.
    4. Publish: the panel asks for an area, set in the flow form, then
       1.0.
    5. A change, then 1.1.
    6. Restore 1.0 from «Versiones», published as 1.2.
    7. The flows list shows 1.2, with no draft. The local `empleado`
       (area Desarrollo) finds the flow on the home screen, and gets
       403 on the editor and on publishing.
    The editor, desktop and phone, with no horizontal page scroll.
  - Local state found during the check and left untouched: «Apertura de
    OT» and «Prueba» have drafts from 2026-11-12, from before phase 5.
- Reason: phase 5 plan, slice 5.9.
- Spec sections affected: 6, 8, 9.

## 2026-11-17 — Versions and «Restaurar» (phase 5.8)

- Decision:
  - **«Versiones» is a page of its own**, linked from the editor next to
    «Puntos guardados», with the §9 table pattern. It lists every
    release, newest first, with:
    - the version and the date and time published (Bogotá);
    - who published it and its step count;
    - whether it is the one everyone sees.
  - **«Restaurar» copies a release into the draft and publishes
    nothing** (§8: «copied into the draft and published as a new
    version»). Releases never change. It works as «Volver a este punto»:
    - it adds no save point;
    - it moves the draft's revision, so a save or a publication still
      open from before is refused as a conflict;
    - nothing is lost, because every save left a save point.
    The editor then reloads on the draft and explains what happened.
  - **Restoring the version everyone sees:**
    - With no draft, «Restaurar» is not offered on that version: the
      editor already shows it, so restoring would do nothing. The row
      says «Es la que ves en el editor».
    - With a draft, it is offered, and it means «go back to what
      everyone sees». The editor then says so («El borrador volvió a la
      versión x.y, la que todos ven…»), not «publícalo para que vuelva a
      ser el que todos ven».
    - Found in the browser check, which restored the latest version by
      mistake.
  - The row whose content is already in the draft says «Está en el
    borrador», instead of «Restaurar».
  - Browser check: `app/.layout-check/5.8/check.mjs` on a throwaway
    flow, deleted afterwards. It covers:
    - 1.0 and 2.0 published, then the list;
    - only 1.0 restorable, and restored;
    - the grid and the preview on 1.0's content, the line under the
      title, and the publish panel offering 2.1 or 3.0;
    - desktop and phone, with no horizontal page scroll (the table
      scrolls inside its frame, as every admin table does).
- Reason: phase 5 plan, slice 5.8; SPEC §8.
- Spec sections affected: 8.

## 2026-11-17 — Publishing from the editor (phase 5.7)

- Decision:
  - **«Publicar» sits beside «Guardar»** and opens a panel above the
    grid. Publishing goes through `POST /flows/:id/publish` with
    `{base, bump}`, onto the existing `publishFlow`, which already holds
    the five validations of SPEC §6. Every problem blocks, as before.
  - **Only the saved draft the page has open is published.** `base`
    names its revision. `publishFlow` takes the revision and checks it
    twice: before validating, and inside the write itself (every
    statement of the batch names it). A save by someone else between
    the check and the write therefore publishes nothing and deletes
    nothing. Either way the answer is «Otra persona cambió o publicó
    este borrador; recarga para ver lo que se publicaría.» The dev
    loader still calls it without a revision.
  - **The panel answers before asking**, in this order:
    - unsaved changes: «Primero guarda los cambios», with
      «Guardar y seguir»;
    - a release on screen: nothing to publish;
    - problems in the grid: points at the list under it;
    - first publication with no area: points at «Datos del flujo».
    The server repeats every check; the panel only saves a round trip.
  - **Minor is the default (§8). Each choice shows its version and what
    it means for the people who use the flow in stage 1:**
    - minor: whoever reviewed it stays «Revisado»;
    - major: everyone goes back to «Pendiente de revisión»
      (`tour.ts`).
    The panel does not mention certifications: they are stage 2. The
    first publication shows no choice: it is 1.0.
  - The panel also warns that a release cannot be changed afterwards,
    and that the draft's save points are deleted (§8).
  - After publishing, the editor reloads on the new release with
    «Publicada la versión x.y. Ya la ven las personas de las áreas del
    flujo.» and a link to the flow. If the flow has no area (they were
    removed after the first publication), that sentence is replaced by
    the flow form's own warning (`NO_AREAS_WARNING`): no Empleado sees
    it, only Líderes and the Junta directiva.
  - **Fix (from 5.3):** after the first save over a release, the line
    under the title still said «Estás viendo la versión publicada». It
    now changes to «Borrador sobre la versión publicada…».
  - Not tested: a save landing between the revision check and the
    write. The tests cannot interleave the two; the statements guard it.
  - Browser check: `app/.layout-check/5.7/check.mjs` on a throwaway
    flow, deleted afterwards. It covers:
    - two steps typed, and «Guardar y seguir»;
    - no area, then an area assigned in the flow form;
    - 1.0 published, then «nothing to publish» on the release;
    - a change saved, then a major release: 2.0, by `junta`, with no
      draft or save points left;
    - desktop and phone, with no horizontal scroll.
- Reason: phase 5 plan, slice 5.7; SPEC §6 (publish validations), §8.
- Spec sections affected: 6, 8.

## 2026-11-17 — Template and export (phase 5.6)

- Decision:
  - **An .xlsx writer with no dependency**, `public/js/xlsx-write.js`,
    beside the reader and checked against its JSDoc. It writes only what
    the reader reads back:
    - every cell as an inline string, so Excel never turns «1.10» into
      a number or «1-2» into a date;
    - a bold, frozen header row and column widths;
    - zip entries stored uncompressed, with a fixed date, so the same
      grid gives the same bytes;
    - characters XML cannot carry (control characters other than tab
      and line breaks) are dropped.
  - **One format for both**, the import's: sheet «Flujo», with ID, Tipo,
    Flujo, Título, Descripción, every category in its screen order, and
    Salidas. Types by their Spanish name. No «Depende de» (SPEC §6:
    export writes Salidas only), so the template has none either. An
    import still accepts the column.
  - **The Tipo column offers the seven types as a drop-down list**, in
    both files (rows 2 to 1000, or further for a longer export). It is
    an aid for typing in Excel, not a new rule: the import already
    refuses an unknown type with its row.
  - **Built in the browser, from the grid on screen**, unsaved edits
    included: what you see is what you get. No new route.
    - «Exportar a Excel» sits in the toolbar and downloads
      `Flujo_<nombre>.xlsx` (characters a file name cannot hold are
      replaced).
    - «Descarga la plantilla» sits in the import box, where someone
      starting in Excel is already looking, and downloads
      `Plantilla_FlowHow.xlsx`.
  - Round-trip tests (`test/xlsx-write.test.js`): export, then import,
    gives back both reference flows exactly. It also holds for text
    Excel would change, line breaks, markup characters, an emoji, and
    30 categories (columns past Z).
  - Browser check: `app/.layout-check/5.6/check.mjs` on Instalaciones,
    nothing saved. It downloads the export with an unsaved title and
    the template. openpyxl, a reader independent of ours, opens both:
    one «Flujo» sheet, bold frozen header, the Tipo list. Our reader
    gives back the grid with the unsaved title. Desktop and phone, no
    horizontal scroll.
  - Not verified here: opening the files in Excel itself. Excel shows
    a repair dialog for a package it dislikes even when other readers
    accept it.
- Reason: phase 5 plan, slice 5.6; SPEC §6 (three ways to fill the grid;
  export uses the template format).
- Spec sections affected: 6.

## 2026-11-17 — Import inside the editor (phase 5.5)

- Decision:
  - **«Importar desde Excel» is a button in the editor's toolbar**, next
    to «Agregar paso». It opens a box above the grid with a file field
    (.xlsx, sheet «Flujo») and a paste area. A chosen file wins over the
    paste, and the review says so. The browser reads both into a grid
    (`import-form.js`, which keeps only its two readers). The server
    still receives only the grid (SPEC §9).
  - **The review takes the place of the grid** until it is applied or
    dropped. It shows:
    - the step count and the categories;
    - the problems;
    - the diagram the import would give, drawn as the preview draws it;
    - the new categories and values, all checked, to accept or reject.
    The review comes from a read-only route,
    `POST /flows/:id/draft/review`, which writes nothing.
  - **While something blocks, only the blocking problems are listed.**
    The others are often the same row seen again (a link to a flow that
    does not exist is also "a link with no target"), and the next review
    will show them.
  - **Applying is a save** (`POST /flows/:id/draft`, with `accepted`).
    It goes through the same review, the same conflict check against
    the base, and the same save point. A rejected category goes with
    its column, and a rejected value leaves its cells. The page reloads
    on the new draft with «Importado al borrador…».
  - If the grid holds unsaved edits, the review warns that replacing the
    draft loses them.
  - An import needs at least one row (unlike a save from the grid,
    which may empty the draft).
  - **The provisional screen is gone:** the `/flows/:id/import`,
    `/import/review` and `/import/apply` routes, and the «Importar»
    action in the flows list. Its tests now cover the editor route.
  - The file field stays native: its button text is the browser's own,
    in the browser's language, so a browser in Spanish already shows
    «Seleccionar archivo». (The English «Choose File» in the check's
    screenshots is the headless browser's language.)
  - Browser check: `app/.layout-check/5.5/check.mjs` on a throwaway
    flow, deleted afterwards. It covers:
    - an empty attempt;
    - a blocked paste, with no apply offered, and going back with the
      paste kept;
    - Instalaciones.xlsx over a paste, with 30 nodes drawn, applied;
    - a paste with a new category, rejected, which created nothing;
    - desktop and phone, with no horizontal scroll.
- Reason: phase 5 plan, slice 5.5; SPEC §6 (import rules).
- Spec sections affected: 6, 9.

## 2026-11-17 — Live preview beside the grid (phase 5.4)

- Decision:
  - *Superseded in part on 2026-11-17 by «The live preview starts folded
    away»: the card is no longer always open.*
  - **The viewer's own diagram** (`layoutFlow`, `renderDiagram`), in the
    flow's colour, read-only, in a card beside the grid: two columns,
    3 : 2, as in the prototype. The card stays in view while the grid
    scrolls down (sticky), and its diagram scrolls inside it. Below
    960 px wide it goes under the grid, as SPEC §6 and the plan say for
    the phone; the grid needs the width before the phone breakpoint
    (760 px) does.
  - **What it draws is what the server would store**: `compileGrid`
    (`grid-edit.js`, now shared with `checkGrid`) resolves link targets
    and merges "Depende de", so a step connected only from that column
    shows its arrow at once.
  - **Redrawn while editing**, after the grid's 200 ms pause, and only
    when what the diagram shows changed (`diagramKey`: ids, types,
    titles, exits). Typing a description or a tag redraws nothing.
    Measured on Instalaciones (30 steps): one layout and render takes
    about 1 ms. A grid half typed that the layout cannot draw shows a
    line instead of failing; the next edit redraws.
  - **Diagram and grid point at each other** (proposed with the plan):
    the step whose row has focus carries the active step's shadow
    (`--shadow-focus-svg`, §9), scrolled into view inside the preview
    without moving the page; clicking a step on the diagram goes to its
    row's title. The row lands clear of the frozen columns
    (`scroll-padding-left`).
  - Browser check: `app/.layout-check/5.4/check.mjs` on Instalaciones,
    nothing saved: focus and click marks, a description that does not
    redraw, a title and a new step connected by "Depende de" that do;
    desktop and phone with no horizontal scroll.
- Reason: phase 5 plan, slice 5.4; SPEC §6 (live preview).
- Spec sections affected: 6.

## 2026-11-17 — The step grid (phase 5.3)

- Decision:
  - **`/flows/:id/edit`** (`editor`) is the editor. The flows list's name
    and «Editar» open it; the flow form («Datos del flujo») and the save
    points go back to it. The import screen is still the provisional one,
    linked from the editor, until 5.5. Creating a flow still returns to
    the list (5.9).
  - **One row per step**, columns: Fila (the spreadsheet's row number, as
    every message counts rows), ID, Tipo (selector), Flujo (selector of
    the other flows, enabled only for Enlace and Subflujo), Título,
    Descripción, one column per category, Depende de, Salidas, and a
    button to take the step out. Fila and ID stay frozen while the grid
    scrolls sideways, so a row still says which step it is. Title and
    description grow with their text; Enter moves down the column, as in a
    spreadsheet, except in a description, where it starts a line.
  - The page embeds what the script needs as JSON (`EditorData`): the
    grid and base of 5.2, the ids any release of the flow holds, every
    flow with its latest release reduced to types and refs
    (`flowEntries`, now shared with `flowCatalog`), each category's
    values, and the type labels. `scriptJson` moved to `layout.tsx`, one
    copy for the viewer and the editor.
  - **`public/js/grid-edit.js`** holds the operations, tested in the
    Workers runtime (`test/grid-edit.test.js`); `editor.js` is the page
    wiring, checked in the browser:
    - **The same check as the server**: `checkGrid` runs `gridToDraft`,
      `compile` and `validate` with the same flows, names compared as
      `core.js` does. Rows with problems get a bar and an alert icon by
      their number. Below the grid, the problems in two lists: «Antes de
      guardar» (what blocks a save) and «Para publicar»; each one with a
      row is a button that goes to it.
    - **Depende de** is computed from the exits; editing it rewrites the
      predecessors' exits on leaving the cell (`applyDependsOn`), an
      unknown id is said and changes nothing. Editing Salidas refreshes
      every Depende de as you type.
    - **IDs** (answer 4): a new step gets `P` and the next number after
      every `P<n>` in the grid and in any release, so a removed published
      step never lends its id, and its readers' progress, to a new one.
      A published id is read-only, with the reason in its tooltip and in
      the hint under the grid. Renaming any other rewrites the exits that
      pointed at it; a blank id, a taken one, or one with spaces or the
      separators `| ; : ,` is refused with the reason.
    - **Suggestions** (answer 3): one shared `<datalist>`, refilled for
      the cell in focus. Tag cells offer the category's values; exits and
      Depende de offer the other steps' ids with their titles. Both
      complete the last part of the cell and keep what came before,
      branch labels included («Sí:P1 | No:»).
    - **Taking a step out** is immediate, with «Deshacer» in the message
      that says so.
    - **Saving** (answer 1): «Guardar», or Ctrl/Cmd+S, enabled only with
      changes; «Cambios sin guardar» meanwhile, «Guardado a las …» after,
      and the browser's own warning on leaving with changes. A save
      refused locally for what blocks is not sent. New values (answer 2)
      open a panel with a checkbox each, checked; «Crear y guardar» drops
      the unchecked ones from the cells too, so the screen matches what
      the server keeps. A conflict (answer 5) offers «Recargar» and says
      that unsaved changes are lost.
  - **Fixed**: `.table-scroll` is positioned now. Without it, an
    absolutely placed, visually hidden heading escaped the scroll box's
    clipping and widened the page on a phone.
  - The close icon is drawn through its SVG as a CSS mask, so it takes the
    text colour (§9); an `<img>` cannot.
  - Browser check: `app/.layout-check/5.3/check.mjs` builds a flow in the
    grid as a person would (four steps, connections from both sides, an
    unknown id, a new value rejected, a rename, a removal undone, saving,
    reloading), on desktop and phone with no horizontal scroll and no
    page errors. The throwaway flow was deleted from the local D1.
- Reason: phase 5 plan, slice 5.3, with the owner's answers 1 to 5; SPEC
  §6 (step grid, connect from either side, ease of use).
- Spec sections affected: 6.

## 2026-11-17 — The draft on the server (phase 5.2)

- Decision:
  - **Opening** (`openDraft`, `src/draft.ts`) gives the editor a grid, the
    same shape an import produces, built from the stored document by
    `documentToGrid` (`src/document.ts`): every category is a column, in
    its order; a cell holds the step's values comma-separated; a link
    carries its target's name; "Depende de" is empty. With no draft it
    shows the latest release and **writes nothing**: the draft is created
    by the first save, so opening the editor does not mark a flow as
    having one. Tested: both reference flows read back into the exact
    document they came from.
  - **A save names its base**: `draft:<revision>` or `release:<id>` (the
    latest release when there was no draft; `release:0` for none).
    Migration `0008` adds `drafts.revision`, raised by every write of the
    draft. The write is conditional in SQL itself (`UPDATE … WHERE
    revision = ?`, or an `INSERT` only while the latest release is still
    that one), and the save point is inserted only if that very write put
    the document there. A stale base is refused (answer 5): «Otra persona
    guardó este borrador; recarga para ver sus cambios.» when a draft is
    there, «Otra persona publicó este flujo mientras editabas; recarga
    para ver la versión publicada.» when there is none (publishing deleted
    it). A base in a token, not a timestamp: two writes within one
    millisecond would share a timestamp.
  - **Saving what the draft already holds writes nothing** and adds no
    save point (answer 1: the points must not fill with copies).
  - **`POST /flows/:id/draft`** (`editor`, JSON: `{grid, base,
    accepted?}`) answers `saved` (with the new base, and whether anything
    was written), `confirm` (new categories or values, nothing written;
    the same save sent again with `accepted` creates those and drops the
    rest: answer 2), `blocked` (422), `conflict` (409) or `invalid` (400).
    It goes through `applyGrid`, the import's contract, which gained the
    optional base; without one (dev loader, the provisional import screen)
    it overwrites as before.
  - **An editor's save may have no rows** (`parseGrid(…, {allowEmpty})`);
    an import still needs one. A draft may be invalid, as always: only
    publishing is blocked.
  - **`/flows/:id/save-points`** (`editor`): a table, newest first:
    Guardado (date and time to the second, Bogotá: several saves can fall
    in one minute), Por, Pasos, Es el borrador actual. «Volver a este
    punto» copies the point into the draft, adds no save point, deletes
    none, and raises the revision, so a save still open from before is
    refused. The list takes the way back at the top (`AdminList` gained
    `back` and `notice`). Until 5.3 it is reachable by its URL only, and
    goes back to the flows list.
  - Browser check: `app/.layout-check/5.2/` (the list before and after
    going back to a point; desktop and phone). The throwaway flow it
    created in the local D1 was deleted afterwards.
- Reason: phase 5 plan, slice 5.2, with the owner's answers 1, 2 and 5;
  SPEC §8 (save points, going back), §9 (drafts only to editors).
- Spec sections affected: 6, 8, 9.

## 2026-11-17 — Flow colour and tag categories (phase 5.1)

- Decision:
  - **The flow form takes the colour**: the twelve palette slots as radio
    buttons (`.swatch flow-N`, named «Color N»), the chosen one ringed in
    the text colour so it never relies on hue alone. Anything but a slot
    1–12 is refused. It changes `flows.colour` only: no version.
  - **`/categories`** (access `editor`, like areas; header link
    «Categorías»), the §9 pattern:
    - List: Nombre, Valores, Flujos; actions Editar, Subir/Bajar, and
      Borrar only when never used. A line above the table says the order
      is the template's column order and decides each category's
      convention on the diagram. Moving renumbers every position 1..n.
    - Creating a category goes straight to its form («Categoría creada.
      Agrega sus valores.»), since a category exists to hold values.
      Renaming stays on the form with «Cambios guardados.».
    - The form lists the values in a table (Valor, Flujos; Editar, and
      Borrar when never used) with «Nuevo valor» below. A value opens its
      own rename form, like every row.
    - **"Used" means any draft, save point or release ever held it**
      (`json_each` over the three tables). Flujos counts those flows. The
      condition sits inside the DELETE, so a document written after the
      page was drawn still stops it. The form of a used category or value
      says, and a refused delete repeats: «Como las publicaciones no
      cambian nunca, una categoría o un valor que se usó alguna vez ya no
      se puede borrar. Sí se puede renombrar.» (owner's wording request).
    - Deleting an unused category deletes its values, in one batch.
  - **A category cannot take a fixed column's name** (ID, Tipo, Título,
    Descripción, Salidas, Depende de, Flujo, and their aliases): the
    importer would read that column as the fixed one. `core.js` gained
    `fixedColumn(header)`, which `tableToGrid` now uses too, so the list
    exists once.
  - **A value cannot contain a comma**: the grid separates values with
    one. Names compare ignoring case and accents, as everywhere; a value
    is unique within its category only.
  - `AdminTable` split out of `AdminList` for the values table, and
    `AdminList` gained an optional `note` under the title.
  - Fixed on the way: `.admin-actions form { margin: 0 }` cancelled the
    gap between a row's actions («EditarBorrar» in areas since 4.4); it
    now sets only the block margins.
  - Browser check: `app/.layout-check/5.1/` (categories, a category, new
    category, the flow form; desktop and phone, no horizontal scroll).
- Reason: phase 5 plan, slice 5.1; SPEC §5 (flow colour in the flow form,
  tags with categories), §9 (Administration screens).
- Spec sections affected: 5, 9.

## 2026-11-17 — Phase 5 plan: the editor

- Decision (proposed and approved by the owner before building). Everything
  goes in, nothing cut: the Board keeps importing from Excel, above all to
  create, and also creates and edits inside the app, as in the prototype.
  - **5.1 Flow form and tag categories.** The flow form gains the colour
    (§5: chosen in the flow form; 4.4 left it out). Tag categories and
    their values get the §9 table pattern (deferred from phase 4).
  - **5.2 Draft on the server.** Open (a missing draft is copied from the
    latest release), save through the import contract (`reviewGrid` /
    `applyGrid`: one input shape), save points listed and "Volver a este
    punto".
  - **5.3 The grid.** One row per step; Salidas and Depende de kept in step
    with `core.js`; rows with errors marked; the same `validate()` as the
    server.
  - **5.4 Live preview** beside the grid, redrawn while editing.
  - **5.5 Import inside the editor.** Paste or .xlsx, then the review
    (row errors, the resulting diagram, accept or reject new tags), then
    the draft is replaced. The provisional screen and its routes go.
  - **5.6 Template and export**, an .xlsx writer with no dependency, and a
    round-trip test.
  - **5.7 Publish** from the editor: the five validations, minor or major.
  - **5.8 Versions**: list of releases and "Restaurar" into the draft.
  - **5.9 Closing**: flows list, access table, browser check.
  - The owner's answers:
    1. **An explicit «Guardar»**, each one a save point, and a warning on
       leaving with unsaved changes. No autosave: it would flood the save
       points.
    2. **New tag values typed in the grid** are listed on saving, to
       accept or reject there, as in the import.
    3. **Tags and exits are text cells with suggestions** (existing values;
       step ids with their titles). Fast on the keyboard, and they read and
       write like Excel.
    4. **A step's id** is assigned on adding (`P{n}`, the next free one) and
       editable only while the step is in no release: tour progress hangs
       on it. Renaming rewrites its references inside the draft.
    5. **Two editors at once**: the second save is refused («Otra persona
       guardó este borrador; recarga para ver sus cambios») instead of
       overwriting the first.
    6. **Categories are managed only on their screen**, not from the grid;
       an import may still create them when accepted in its review. A
       category or a value can be renamed always, and deleted only if no
       draft, save point or release ever used it. The message says why:
       releases never change, so what was used once can never be deleted.
    7. **Paste is a text box that replaces the whole draft** through the
       review (§6 import rules). **Pasting a block straight onto the grid's
       cells is out of scope, not ruled out**: it is the first thing
       someone will try, and it is the first candidate if the editor grows.
    8. **No «Copiar tabla»** (the prototype's copy to clipboard): exporting
       already covers that path.
- Reason: SPEC §11 phase 5; owner's approval.
- Spec sections affected: 5 (Flow colour, Tags with categories), 6, 8, 9
  (Administration screens).

## 2026-11-16 — Administration screens as tables (phase 4.4, redone)

- Decision: areas, users and flows follow the one pattern of SPEC §9
  "Administration screens", built once in `app/src/admin.tsx`
  (`AdminList`, `AdminForm`) and used by all three:
  - The list is a `<table>` with the columns SPEC names, plus a last
    "Acciones" column. Counts are numbers, right-aligned; yes/no columns
    say "Sí"/"No"; a flow with no area says "Ninguna"; an unpublished one
    "Sin publicar". A deactivated user's row is greyed and its "Activo"
    says "No".
  - Row actions: areas "Editar" and, only when unused, "Borrar"; users
    "Editar" (resetting and deactivating stay on the form, below it, under
    "La cuenta": they are not one click away from the list); flows "Ver"
    once published, "Editar" (the flow form) and "Importar". The name
    opens the same form as "Editar".
  - Creating has its own form now: `GET /areas/new` and `GET /flows/new`
    (the inline create and rename forms are gone; `GET /areas/:id` is the
    rename form). Saving an area or creating a flow goes back to the list,
    as before; saving a user or a flow's details stays on its form with
    "Cambios guardados.", as before.
  - A refused delete shows its reason above the list.
  - On a phone the table scrolls sideways inside its frame; the page never
    does. While columns are left to the right, the frame's right edge casts
    a shadow (a gradient from `--color-edge`), gone at the end; no text, no
    arrow (owner's request on approving this redo). A small module,
    `/js/table-scroll.js`, sets it; without it the table still scrolls,
    unshaded. Only the right edge: nothing marks columns scrolled past on
    the left. Superseded the same day at the owner's request: the left
    edge now shades too while columns are scrolled past, and goes flat
    again back at the start.
  - The import and review screens (provisional until phase 5) take the
    way back at the top too.
- Reason: owner's request, before testing phase 4; SPEC §9 rewritten by the
  owner.
- Spec sections affected: none (implements §9 Administration screens).

## 2026-11-16 — Accounts and administration screens (phase 4.4)

- Decision:
  - **`can_manage_users`** (owner's correction to 4.2; SPEC §4 rewritten
    by the owner): migration `0006` adds it and marks every Board member.
    A trigger refuses to take it from, or deactivate, the last active
    account that holds it, so the screens, the CLI and raw SQL obey the
    same rule, and two managers removing each other at once cannot both
    succeed. Access level `users` guards every `/users` route.
  - **Permissions on creation come from the role** (`rolePermissions`:
    Board all three, Standard and Leader none). The new-user form has no
    permission checkboxes; the edit form has one per permission, and
    changing the role there leaves them as they are (the form says so).
    That is how a process owner gets `can_edit` and nothing else.
  - **Board members cannot have areas** (§4 "Board members belong to no
    area"): saving one with areas is refused with the reason. Before, the
    server only refused a Standard user without one.
  - **Temporary passwords** (phase 4 plan, answer 2): creating an account
    or resetting one generates a twelve-character password in groups of
    four, from an alphabet without look-alikes, shown once on the answer
    page and never stored in clear. Migration `0007` adds
    `must_change_password`. A reset also closes every session of that
    account. The CLI's `--restablecer` clears the flag: whoever runs it
    typed the password themselves.
  - **«Cambia tu contraseña»** at `/password`, access level `account`
    (signed in, even with a temporary password). Every other level sends
    such a user there first (pages redirect; JSON answers 403 with the
    message). It refuses a password shorter than 8, a mismatch, and the
    temporary one itself. The header shows no links meanwhile.
  - **Saving an Empleado whose areas have no published flow** (creating or
    editing) goes through and says so: «Sus áreas todavía no tienen flujos
    publicados, así que por ahora no verá ninguno…» (§4: the screen says so
    and lets the admin continue). Same rule as the home screen
    (`visibleFlows`).
  - **Deactivate instead of delete**: `setActive`, which also closes the
    account's sessions. Reactivation is a button on the same page.
  - **Areas**: rename, and delete only an area no user and no flow uses;
    each row shows what uses it. Still `editor`.
  - **The flow form** at `/flows/:id/details` (`editor`): name, objective
    and areas. Areas are optional there; the first publication requires
    one. Taking every area from a published flow is allowed and hides it
    from Empleados; after saving, the page warns that no Empleado will see
    it (owner's request on approving phase 4). Not for a draft, which
    nobody sees and which needs an area to publish. Not blocked, only said.
    The subflow/area exclusivity (§7) waits for subflows
    (stage 2).
  - The import screen stays provisional, for editors, until phase 5.
  - Browser check: `app/.layout-check/4.4/` (areas, users, new user, the
    temporary password, edit, the forced change, the flow form; desktop
    and phone, no horizontal scroll). The check account it created in the
    local D1 was deleted afterwards.
- Reason: phase 4 plan, slice 4.4; the owner's correction on
  `can_manage_users` and their two requests (the warning on save, a test
  of the last-manager rule including deactivation).
- Spec sections affected: 4 (Roles and permissions), 6 (Flow form), 9
  (Authentication, Administration screens).

## 2026-11-16 — Home screen (phase 4.3)

- Decision:
  - `/home` (`src/home.tsx`) lists the flows the user sees, by name: one
    card each with the flow's colour dot, name, objective, the review
    status (icon plus label plus detail, the viewer's line, now shared in
    `src/status.tsx`) and the next action as a button-styled link to the
    viewer («Iniciar», «Continuar» or «Repetir recorrido»). The tour
    starts there; the home screen does not start it itself.
  - The list comes from `visibleFlows`, which shares its SQL condition
    with `canSeeFlow`: one visibility rule, written once, for the viewer,
    the tour and the home screen. Never-published flows are left out for
    everyone, the Board included (they are drafts, §8).
  - Empty list: a Standard user reads «Tus áreas todavía no tienen flujos
    asignados. Cuando la Junta directiva te asigne uno, aparecerá aquí.»;
    a Leader or the Board, «Todavía no hay flujos publicados.»
  - The Board gets the same screen: it tours like anyone (phase 4 plan,
    answer 3).
  - Stage 2 certificates: a marked place in the page, nothing built.
  - `reviewStatus` takes only the latest release's version, so the home
    screen does not compile every flow's document.
  - Browser check: `app/.layout-check/4.3/` (Board and Standard, desktop
    and phone; no horizontal scroll on the phone).
- Reason: phase 4 plan, slice 4.3; SPEC §7 Home screen.
- Spec sections affected: 7 (Home screen).

## 2026-11-16 — Permissions on every route (phase 4.2)

- Decision:
  - **A route cannot exist without declaring its access** (owner's
    request: protection must not depend on registration order).
    `src/access.tsx` has a `Router` whose `get`/`post` take the access as
    an argument, so TypeScript refuses a route without it; `index.tsx`
    mounts only Routers. A route added with Hono directly would get past
    the types, so `assertGuarded(app)` runs when the Worker loads and
    throws if any route lacks a guard: `wrangler dev`, the tests and a
    deployment all fail to start. Middleware (`use`, path ending in `*`)
    is not a route; `app.all` on a path is. The global `requireUser` and
    its dependence on order are gone.
  - **Five kinds of access**: `public` (`GET /`, `POST /login`,
    `POST /logout`), `user`, `flow` (signed in and may see the flow in
    `:id`, else 404 as for a missing flow), `editor` (`can_edit`, else
    403), `admin` (`can_view_admin_layer`, else 403; no route uses it
    until stage 3). Flags, never the role.
  - **Administration screens (areas now, users in 4.4) are `editor`**
    (owner's answer): `can_view_admin_layer` is for the admin layer and
    may later go to a group that must not manage users.
    **Suspended for the user screens (2026-11-16, owner):** `can_edit`
    means "may change the content of flows". Managing accounts under it
    is a privilege escalation: an outside process owner given `can_edit`
    could reset the Board's password and promote themselves. The areas
    screen stays `editor` (assigning flows to areas is content). Proposed:
    a third permission, `can_manage_users`, set by the role (Board only),
    with its own access level for the user routes; to settle before 4.4.
    **Settled and built in 4.4** (entry above).
  - **Visibility** (`canSeeFlow`): a published flow; a Standard user
    also needs one of its areas. Leaders and the Board see every
    published flow. The viewer and the four tour routes are `flow`; the
    provisional flows list and import screens are `editor`.
  - **Without a session, an unknown path still goes to the login**, as in
    4.1 (`notFound`); signed in, it is a 404.
  - **The test reads the routes from the app** (`guardedRoutes`) and
    compares them with the access decided for each, written in the test:
    a new route turns it red until someone decides who may reach it. Then
    it walks every route against no session, a Standard user in the
    flow's area, one in another area, a Leader and the Board. A hidden
    flow answers byte for byte what a missing one does.
  - The header shows «Flujos» and «Áreas» to users with `can_edit`. The
    provisional home screen no longer links to `/flows`: until 4.3 a user
    without `can_edit` reaches a flow only by its URL.
  - Not yet: links between flows (a step's `ref`) are not filtered; the
    target answers 404 if hidden. "Whether a linked flow is accessible"
    (§9) lands with the screens that show links.
- Reason: phase 4 plan, slice 4.2; owner's requests on the route test and
  on declaring access.
- Spec sections affected: 4 (Roles and permissions), 9 (Server-enforced
  rules: flow visibility; Administration screens).

## 2026-11-16 — Login and sessions (phase 4.1)

- Decision:
  - **Passwords** (`src/password.ts`): PBKDF2-SHA256 with Web Crypto at
    100,000 iterations (the most Workers accepts), 16-byte salt, stored as
    `pbkdf2-sha256$<iterations>$<salt>$<hash>`, compared in constant time.
    The iteration count travels with each hash, so it can change later.
    Anything that is not such a hash, the empty one included, matches no
    password: accounts without one (a later Microsoft SSO) rely on that.
    Minimum length 8 characters (SPEC sets none; used by the CLI and the
    dev accounts now, by the screens in 4.4).
  - **Sessions** (`src/session.ts`): 32 random bytes in the cookie
    `flowhow_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`,
    7 days); the `sessions` table keeps its SHA-256. The expiry slides to
    7 days from the last use, moved at most once a day so pages do not
    write to D1 each time. An expired session, or one of a deactivated
    user, counts as none and is deleted. A login also deletes that user's
    expired sessions. `createSession(userId)` is the single way in; it does
    not know how the user proved who they are.
  - **CSRF**: Hono's `csrf()` (no new dependency) refuses forms posted
    from another origin, on top of `SameSite=Lax`. The tour's JSON requests
    are not forms; a browser cannot send them across sites without CORS,
    which the app never grants.
  - **Routes**: `GET /` is the login without a session and redirects to
    `/home` with one. `POST /login`, `POST /logout` (a POST, so a link
    elsewhere cannot sign anyone out). Every other route needs a session:
    pages redirect to `/`; the tour's JSON routes answer 401 with «Tu
    sesión terminó. Vuelve a entrar y sigue donde ibas.», which
    `viewer.js` already shows. `/home` is provisional until 4.3.
  - **Failed login**: one message for a wrong password, an unknown user and
    an inactive one («Usuario o contraseña incorrectos.»), 401, the
    username kept in the field, one second of delay, and the same PBKDF2
    work when there is no account, so timing does not tell them apart.
    No lockout (phase 4 plan, answer 6).
  - The header shows the user's name and «Salir». Links by permission
    come in 4.2.
  - **The placeholder user is gone**: `src/current-user.ts` deleted, the
    viewer and the tour use the session user. Migration `0005` deletes
    the placeholder row by username and empty hash, and its runs, visits
    and reviews with it (answer 1). Applied to the owner's local D1: runs
    1–3 and the Apertura review are gone, as approved.
  - **`npm run user:create`** (`tools/user-create.ts`): creates a **Board**
    user only (role `board`, both permissions, no area), or resets any
    user's password with `--restablecer`, which also closes their
    sessions. Narrower than the proposal's `--rol`: the CLI exists for the
    first Board member and for a Board locked out; everyone else is created
    from the screens in 4.4, where the area rule lives. It runs
    `wrangler d1 execute` (local, or `--remote`) with no shell, and only
    the hash leaves the machine. The password is asked twice without echo.
  - **Dev accounts** (answer 5): `npm run db:load` creates `empleado`
    (Standard, area «Desarrollo»), `lider` (Leader, «Desarrollo») and
    `junta` (Board, no area) with `DEV_PASSWORD` from `app/.dev.vars`,
    once; without it, it says so and creates none. `getPlatformProxy` runs
    with `remoteBindings: false`, so the script cannot reach a remote
    binding. `app/.dev.vars.example` lists the key.
  - **`must_change_password` and its screen move to 4.4**, with the reset
    button that sets it. The CLI's reset does not set it: whoever runs it
    types the new password themselves.
  - **`DEPLOY.md`** (owner's request): everything that exists only when
    deploying. Linked from `CLAUDE.md`.
  - **Open risk, in DEPLOY.md**: PBKDF2 at 100,000 iterations takes about
    12 ms on a development Mac; the Workers Free plan allows 10 ms of CPU
    per request. To be measured on `POST /login` at the next deployment.
    The options are Workers Paid or fewer iterations; the owner decides.
  - Browser check: `app/.layout-check/4.1/` (login, wrong password, phone,
    home, header on the phone; cookie flags read from Chrome).
- Reason: phase 4 plan, slice 4.1.
- Spec sections affected: 4 (Roles and permissions), 7 (Home screen), 9
  (Authentication).

## 2026-11-16 — A flow you may not see answers 404, not 403

- Decision: when a signed-in user asks for a flow outside their visibility
  (the viewer, the tour routes, and later the link targets), the server
  answers **404, exactly as for a flow that does not exist**. Not 403.
- Reason: a 403 says "this exists, and it is not for you". Flow ids are
  consecutive numbers, so a Standard user could walk them and learn how
  many flows there are and which ids belong to other areas. With 404 both
  cases look the same, and nothing about other areas leaks. **This is
  intended. Do not "fix" it to 403.** Routes guarded by a permission rather
  than by a flow (Board screens, editor screens) are different: those are
  the same for everyone and reveal nothing, so they answer 403.
- Spec sections affected: 9 (Server-enforced rules: flow visibility).

## 2026-11-16 — Phase 4 plan: accounts

- Decision (proposed and approved by the owner before building):
  - **4.1 Sessions and login.** Web Crypto passwords, sessions in D1, login
    at `/`, the placeholder user removed, `npm run user:create` for the
    first Board user.
  - **4.2 Permissions on everything built.** `requireEditor`
    (`can_edit`) and `requireAdmin` (`can_view_admin_layer`), checked on
    the flags and never on the role, so the admin layer can later go to
    another group (§4). The role sets the flags: Board both, Standard and
    Leader none. One visibility function (Standard: published flows of
    their areas; Leader and Board: all) serves the viewer, the tour and the
    home screen. A test walks every route against no session, a Standard
    user in the flow's area, one in another area, a Leader and the Board.
  - **4.3 Home screen.** The user's flows with status, icon and next
    action; a line when a Standard user's areas have no flows yet; room
    for stage 2 certificates, not built.
  - **4.4 Board screens.** Areas (create, rename, delete only if unused);
    users (list, create, edit, deactivate instead of delete, reset
    password); the flow form (name, objective, areas), so the Board can
    make a flow visible to someone. The import screen stays provisional,
    for editors, until phase 5.
  - The owner's answers:
    1. **The placeholder user's data is deleted**, not moved to a real
       account. It was made by an invented user under rules that have
       since changed; inheriting it would mark as reviewed a flow nobody
       walked, which is the one thing this app certifies.
    2. **Password reset: a one-time temporary password with a forced
       change** (`must_change_password` and a «Cambia tu contraseña»
       screen). It keeps the Board from knowing its people's passwords,
       and adding it later costs much more.
    3. **The Board tours like anyone, and the progress report leaves it
       out.** It should walk a flow before publishing it, the only way to
       notice a badly worded step. "Not certified" (§4) is about the
       assessment, not about reading.
    4. **The flow form goes in 4.4.** Without it the Board cannot make
       anyone see anything.
    5. **Three local dev accounts in `db:load`**, strictly local, unable to
       run against the remote D1.
    6. **Brute force: a fixed delay and the generic message, plus a
       Cloudflare rate limiting rule on `POST /login` at deployment.**
       Counting attempts in D1 ends up locking out legitimate people, the
       Board included.
  - Out of scope: tag category screens (phase 5), Microsoft SSO (later; a
    session does not know how the user got in, so SSO will be another way
    into `createSession`, with a table for the external identity).
- Reason: SPEC §11 phase 4; owner's approval.
- Spec sections affected: 4, 7 (Home screen), 9 (Authentication,
  Server-enforced rules, Administration screens).

## 2026-11-16 — Shorter one-step note; no line for a missing description

- Decision:
  - The one-step branch note is «Otra manera: «El proveedor entrega» (2 de
    3).». The earlier one repeated the whole question right after the user
    read it. The other notes do not repeat the question and stay as they
    are: «Esta opción va directo a «X». Antes de seguir, mira las otras.»
    and «La opción «No» lleva directo a este paso.».
  - A step without a description shows nothing in its place. "Este paso no
    tiene descripción" announced an absence, and in the real flows most
    steps have none.
- Reason: owner, before testing phase 3.6.
- Spec sections affected: 7 (Viewer: step panel).

## 2026-11-16 — One-step branches in a row; "Anterior" can undo a choice (phase 3.6)

- Decision (proposed and approved before building; SPEC §7 updated by the
  owner):
  - **Short branches.** For each branch with a meeting point: `direct`
    (its target is the meeting point), `short` (its step is not a decision
    and its only exit is the meeting point) or `long`. Kept in
    `tour.reach`. When the tour is about to go back to a decision before
    its meeting point, it first looks at the branches still to take that
    meet there. If none is long, it does not go back: it moves on to the
    next short one in sheet order, with ~~«Otra opción de «D»: «label» (2 de
    3).»~~ «Otra manera: «label» (2 de 3).» (see the next entry), and once only direct ones are left it takes them and enters the
    meeting point with «La opción «No» lleva directo a este paso.». The
    user still picks the first branch.
  - **The order picked matters, and that is intended:** a short branch
    first and a long one left goes back to the decision; the long one
    first and only a short one left walks it right after. What decides is
    what is left to walk.
  - In the reference flows: Apertura P7 and P26 walk their branches in a
    row; P34 enters P35 once and takes «No» on the way; Instalaciones P11
    likewise. The direct-branch note (bounce) stays only where a long
    branch is still pending: Instalaciones P9 and P17, Apertura P31.
  - **"Anterior" can undo a choice.** On a decision left behind, its
    branches are live again ("Puedes elegir otra rama: el recorrido
    seguirá desde aquí"). The branch chosen there before only moves the
    view. Another one drops the trail after that decision and goes on from
    the state saved there: each trail entry keeps the path, the pending
    starts and the cycle counter. Steps seen and branches taken stay
    counted, so progress never goes backwards.
  - **Migration 0004**: `tour_visits.rewind_to`, the trail position such a
    choice went back to (NULL on every other row). `tour-log.js` replays
    it by going back there first, and refuses a position past the end, a
    step that is not a decision, or the branch chosen there before.
  - **A fix the random rewinds found:** a decision seen on a branch that
    "Anterior" then undid is no longer on the path, so nothing led back to
    its other branches and the tour could not be finished. The dead-end
    return now has a last resort, after unvisited starts and steps: a
    decision with a branch still to take, reached by a jump ("Ahora sigues
    con una parte del flujo que faltaba.").
  - **Tests:** a random-graph test with random rewinds (2,000 flows in the
    suite; 20,000 checked once by hand), asserting every tour still
    completes and progress never goes backwards; and `tour-log.test.js`,
    random flows with random rewinds applied through the log, replayed to
    the same state. Four phase 3.5 cases changed what they expect because
    their one-step branches are now walked in a row; three got two-step
    branches so they still test going back, the subflow case was rewritten.
  - A run logged under the 3.5 rules that does not replay is closed and a
    clean one opened (3.5's mechanism). The owner's open repeat of Apertura
    on the local database (run 2) was closed that way by the browser check;
    it was restored as it was, and will be closed the same way when the
    owner opens it.
  - Browser check: `app/.layout-check/3.6/`.
- Reason: owner, after testing phase 3.5 live.
- Spec sections affected: 7 (Viewer: tour rules).

## 2026-11-16 — "Empezar de nuevo" whenever a run is open

- Decision: "Empezar de nuevo" shows whenever the user has an open run on
  the flow, whatever the status, and the server no longer refuses it once
  the flow is reviewed. The status carries `open` for this. Before, two
  rules blocked each other: the button needed "Recorrido en curso", and a
  repeat of a reviewed flow stays "Revisado", so it never appeared.
  Starting over abandons only the open run; the saved review is never
  touched.
- Reason: owner, after testing phase 3.5 live.
- Spec sections affected: 7 (Viewer: tour rules).

## 2026-11-16 — The direct-branch note is shown every time; no commented-out tests

- Decision:
  - A branch that goes straight to its meeting point shows «Esta opción va
    directo a «X». Antes de seguir, mira las otras.» every time it is
    chosen while another branch meets there, not only the first time. A
    click that shows nothing is worse than a repeated note: the user cannot
    tell whether it was ignored, broken or wrong. The note is true about
    the process, not a reproach. (Owner's correction of their own earlier
    instruction.)
  - The original lines of the two `core.test.js` cases changed in 3.5 are
    deleted rather than kept as comments: git keeps them, and the reason
    is here and in the commit. Changing them was right because the rule
    changed, which is not the same as changing a test because it fails.
- Reason: owner's review of phase 3.5.
- Spec sections affected: 7 (Viewer: tour rules).

## 2026-11-16 — Branches that meet, "Empezar de nuevo", "Ver el flujo completo" (phase 3.5)

- Decision (approved by the owner before building):
  - **Meeting points** (`core.js`, the first change to the engine in
    phase 3). For each step, its post-dominators: the steps every path
    from it to an end goes through, with every dead end leading to one
    virtual end. A branch's meeting point is the first post-dominator it
    shares with another branch of the same decision. A branch that shares
    only the virtual end with the others has none and keeps the dead-end
    return. Steps inside a closed cycle (no way to an end) have none.
    Computed once per `Tour`, kept in `tour.meet`.
  - **Walking them.** The tour never enters a meeting point while a branch
    that meets there is still to take: it goes back to the nearest such
    decision on the current path, and enters the meeting point once,
    after the last one. A decision walked since then that still has a
    branch to take comes first, so nested branches are not left behind
    (a random flow found this case while it was being built).
  - **A branch straight to the meeting point** (Instalaciones P9, P11,
    P17; Apertura P31, P34) does not enter it while another branch meets
    there. The branch is marked taken and the tour stays at the decision:
    «Esta opción va directo a «X». Antes de seguir, mira las otras.»
    ~~Choosing it again says nothing more (owner: do not repeat the note).~~
    **Superseded** the same day: the note is shown every time (see
    "The direct-branch note is shown every time").
  - Notes for the other return: «Esta rama sigue en «X», igual que las
    otras. Vuelves a la decisión para ver las que faltan.»
  - Nothing else in the rules changes: dead-end returns, every branch
    taken, finishing, repeating a branch.
  - **Two cases in `core.test.js` changed what they expect**, because the
    rule they tested changed: "Sí first" and "every branch must be taken".
    ~~Their original lines stay as comments.~~ **Superseded**: removed,
    git keeps them (same follow-up entry). The case the second guarded
    (every step visited, a branch not taken) now has a flow of its own,
    with two starts.
  - The owner's example was checked against the data first: in Apertura,
    «Externa» does not end at the first contact with the client, it meets
    «Interna» at P25 (P12 → P24 → P25). No reference flow has a branch
    that meets while another ends, so that case uses a built flow.
  - **Migration 0003**: `tour_runs.abandoned_at`, never set together with
    `finished_at`. A run is open while both are NULL; the partial unique
    index is rebuilt on that. The progress report (phase 6) can tell
    finished runs from abandoned ones.
  - **"Empezar de nuevo"**, `POST /flows/:id/tour/restart`: beside
    "Continuar recorrido" in the overview, only while the status is
    "Recorrido en curso". In one batch it abandons the open run and opens
    a clean one on the latest release; the minimum time counts from then.
    Refused once the current major version is reviewed. **Superseded**
    (see "Empezar de nuevo whenever a run is open"). **It asks first**
    (owner's decision): the corner shows «¿Empezar de nuevo? Pierdes los
    pasos que llevas en este recorrido.» with "Cancelar" and "Sí, empezar
    de nuevo".
  - **Runs logged under the old rules** may not replay any more. Steps and
    finishing answer «Las reglas del recorrido cambiaron. Recarga la
    página para seguir.»; starting abandons that run, opens a clean one
    and says so in the tour's message line.
  - **"Ver el flujo completo"**, a link-styled button in the progress row:
    back to the overview, the run stays open. Named so by the owner:
    "salir" would sound like abandoning, next to a button that does.
  - Phase 6 scope (owner's SPEC §7 change, not built): the tour zoom is
    for every screen size, zoomed by default only on phones.
  - Browser check: `app/.layout-check/3.5/` (join-note, direct-note,
    restart-overview, restart-confirm, restarted).
- Reason: SPEC §7 changes after the owner tested phase 3 live.
- Spec sections affected: 7 (Viewer: tour rules, layout).

## 2026-11-13 — "Revisado" in the viewer (phase 3.4)

- Decision:
  - **Status line** under the flow name: icon plus label, never colour
    alone (§7): "Pendiente de revisión" (`pending.svg`), "Recorrido en
    curso" (`in_progress.svg`), "Revisado" (`done.svg`). One function,
    `reviewStatus` in `src/tour.ts`, decides it; phase 4's home screen can
    use the same one.
  - **Revisado** holds while the user has a review on a release with the
    latest release's major version: a minor release keeps it, a major one
    resets it to "Pendiente de revisión" (§8). The line under it gives the
    date of the newest release reviewed, in Bogotá ("El 13 de noviembre de
    2026."), plus ", en la versión 1.0" when that is not the latest.
    After a major release the pending line says "Revisaste la versión 1.0.
    La 2.0 trae cambios importantes."
  - **"Revisado" wins over "en curso"**: someone repeating a reviewed flow
    stays "Revisado" while the new run is open. A run still open on an
    older release after a major one says "Lo empezaste en la versión 1.0 y
    lo terminas en esa versión."
  - **The button**: "Continuar recorrido" while a run is open; otherwise
    "Repetir recorrido" if the current major version is reviewed, else
    "Iniciar recorrido" (also after a major release: it is a new tour).
  - Starting and finishing answer with the new status, and the page
    redraws the line and the button without a reload.
  - Owner's decision on the step title, recorded in SPEC §9 by the owner:
    it stays in Google Sans. What decides the type is what the text is,
    not its size; iBrand only names the page.
  - Browser check: `app/.layout-check/3.4/` (overview pending, in progress,
    after finishing, and after a reload).
- Reason: phase 3 plan, slice 3.4.
- Spec sections affected: 7 (Viewer), 8 (Versioning).

## 2026-11-13 — The tour on screen (phase 3.3)

- Decision:
  - "Iniciar recorrido" turns the same page into the tour (no tabs).
    `public/js/viewer.js` asks the server to start or resume, rebuilds the
    engine from the log with `tour-log.js`, and draws the release the
    server returns, which is the run's own release. Every action is sent
    first and applied to the local engine only once the server has stored
    it; buttons are disabled while it is on its way. A refusal shows the
    server's message next to the buttons. "Anterior", and "Siguiente" while
    going forward again over steps already walked, stay in the browser.
  - Finishing returns to the overview with a note: "Flujo revisado.", plus
    the server's line when a newer version was published meanwhile. The
    status and Continuar / Repetir arrive in 3.4 (done).
  - The step panel follows the prototype: the "Esa rama terminó en «X»…"
    note, type, title, description, tags as chips, and either "Sigue con"
    or the branch buttons, tinted with `--flow-tint-mix` and marked "Ya
    recorrida" with the done icon once taken, plus "Ir a lo que falta por
    visitar" when the engine offers it.
  - The diagram (`renderDiagram(layout, flow, marks)`, still geometry and
    class names only): the current step filled with the flow colour, text
    in `--flow-on`, lifted by `--shadow-focus-svg`, no extra outline;
    visited steps in `--flow-visited-mix`; pending steps and unwalked edges
    in `--color-edge` / `--color-text-dim`. It scrolls to the current step.
  - **Tag badges** beside the current step, as in the prototype: odd
    categories on the left, even ones on the right, values longer than 16
    characters shortened with "…" (the full value in the tooltip). The
    category in position N takes slot `((N − 1) mod 4) + 1` of
    `--color-cat-N`. **A fifth category takes slot 1 again**, so its
    badges look exactly like the first category's, on the same side of the
    step; only the tooltip tells them apart. Today no flow has more than
    two categories. A fifth slot is a `theme.css` change
    for the owner, plus one CSS line per slot.
  - The progress bar's width is set inline (`style="width:N%"`): it is
    data, not a style choice, and no token applies.
  - New `.button-secondary` for "Anterior", and a disabled state for both
    buttons.
  - `.diagram-scroll` now uses `box-sizing: border-box`, so its 76vh
    includes the bottom padding. Before, the card was 88 px taller than
    meant, and on a 900 px screen the tour buttons fell below the window.
    The overview (2.4) changes the same way.
  - Not built (out of scope or later): the "Convenciones" legend (phase 6),
    mobile zoom (phase 6), the review status (3.4).
  - Browser check: `app/.layout-check/3.3/tour-check.mjs` drives real
    Chrome through the DevTools protocol against `npm run dev` (no new
    dependency). Screenshots in the same folder.
- Reason: phase 3 plan, slice 3.3.
- Spec sections affected: 7 (Viewer: tour, layout), 9 (Architecture: theme).

## 2026-11-13 — The tour on the server (phase 3.2)

- Decision:
  - **The log is one row per action**, at the step the tour stood on:
    `choose` a branch at a decision, `skip` ("Ir a lo que falta por
    visitar") at a decision, `next` anywhere else. `exit_index` is the exit
    followed; NULL when the tour did not leave through an exit (a dead end,
    a skip, the engine breaking an endless cycle). The step the tour starts
    on, and the one where the user finishes, have no row: the run's
    `started_at` and `finished_at` carry those times.
  - `public/js/tour-log.js`: `apply(tour, action)` checks one action
    against the engine and returns the row to store; `replay(flow, rows)`
    rebuilds the engine from the log and refuses a log that does not replay
    exactly. Shared with the browser (3.3). `core.js` is untouched.
  - `src/tour.ts`, with the time as a parameter: `startTour` resumes the
    open run on the latest release or opens one; `takeStep` replays,
    checks and stores the action with the server's time; `finishTour`
    requires `canFinish()` and steps × 5 s since `started_at`, then closes
    the run and saves the review in one batch.
  - Writes are conditional on the log length the action was checked
    against, so two tabs cannot interleave actions: the second gets the
    "reload" message.
  - Routes, JSON, as the placeholder user: `POST /flows/:id/tour`,
    `/tour/step` (`{at, action, exit?}`) and `/tour/finish`. A refusal is
    409 with the message to show; a malformed body is 400.
  - **A repeated tour leaves the first review as it was** (insert ignored
    on conflict): the date and duration of the first review stand.
    Confirmed by the owner: that is the moment the person complied, and a
    voluntary repetition must not rewrite it. Each repetition stays as its
    own run in `tour_runs`, so "last time reviewed" can be derived if it is
    ever needed.
  - **A run finishes on the release it started on**, even after a newer
    one is published. Owner's decision: interrupting someone at step 25 of
    36 throws away real work for nothing, and releases are immutable and
    kept forever, so the document being toured still exists. The start
    route resumes the open run on its own release and returns that
    release's flow, for the browser to draw. After a minor release the
    review keeps "Revisado"; after a major one it stays on the old version
    and the new one shows as pending (§8). Finishing a release that is no
    longer the latest returns one line saying so, so "Pendiente de
    revisión" after finishing does not look like a failure.
  - `latestRelease()` moves to `src/flows.ts`, next to `getRelease()`; the
    viewer and the tour share them.
- Found while testing: in Apertura de OT the state "every step visited,
  P34 with one branch" cannot occur. P34 lies on every path, and from P36
  the engine always returns to the nearest decision with a branch left,
  which is P34. So the tests check two things: that Apertura returns to
  P34 for «No» although P35 is visited, and, in a test flow where the twin
  decision comes first, that every step visited with one twin branch
  untaken does not finish.
- Reason: phase 3 plan, slice 3.2.
- Spec sections affected: 7 (Viewer: tour rules).

## 2026-11-13 — Placeholder user, tour runs and the viewer header (phase 3.1)

- Decision:
  - `src/current-user.ts` `currentUser(c)` is the only place that knows
    who is making the request. Until phase 4 it returns a placeholder user,
    "Usuario de prueba" (username `usuario de prueba`, role `standard`, no
    areas), and creates its row on first use. Its password hash is empty,
    which matches no password, so nobody can log in as it. Phase 4 replaces
    the body of that function with the session user.
  - Migration `0002_tour_runs.sql` adds `tour_runs` (user, release,
    `started_at`, `finished_at`, NULL while open). A partial unique index
    allows one open run per user and release, and any number of finished
    ones.
  - **Deviation from the approved slice:** the slice said "a `run_id`
    column in `tour_visits`". Instead `tour_visits` is dropped and
    recreated with `run_id NOT NULL` and without `user_id` and
    `release_id`, which the run already carries. SQLite cannot add a
    NOT NULL foreign key column to an existing table, and keeping the
    user and release on each visit as well would let them disagree with
    the run. The table had never held a row: nothing wrote to it before
    phase 3, and the only D1 outside a local machine (the deployment
    check's) was deleted.
  - Fix from 2.4: the flow name in the viewer header uses iBrand
    (`--font-display`, `--weight-display`, `font-synthesis-weight: none`),
    as SPEC §9 says. The side panel title ("El flujo completo") was left in
    Google Sans; it becomes the step title in 3.3.
  - The objective line is covered by a test that sets an objective on a
    reference flow: it shows under the name, escaped, and no empty line
    appears when the flow has none.
- Reason: phase 3 plan approved by the owner (entry below).
- Spec sections affected: 4 (Roles and permissions), 7 (Viewer), 9 (Typefaces).

## 2026-11-13 — Phase 3 plan: the tour

- Decision: four slices, approved by the owner.
  - **3.1** Placeholder user, tour runs, the objective line, the iBrand fix
    in the viewer header.
  - **3.2** The tour on the server. A shared module rebuilds the `Tour`
    engine from the log (`next`, `choose(i)`, `skip`), so `core.js` stays
    untouched. Routes to start or resume, to take a step, and to finish.
    The server checks every action against the rebuilt engine and stores
    it with its own time.
  - **3.3** The tour on screen: step panel, branch buttons, the "branch
    ended" note, buttons in the diagram card's bottom right corner,
    progress bar, visited/active/pending styling, tag badges.
  - **3.4** "Revisado": status in the viewer, Iniciar / Continuar / Repetir,
    and minor versions keep the review while major ones reset it (§8).
- The owner's answers:
  1. **Tour runs.** "Iniciar recorrido" opens a run, "Continuar" resumes
     the open one, "Repetir" opens a new one without touching the review
     already saved.
  2. **Two tokens in `theme.css`**, added by Claude as a one-off exception
     to the rule of not editing that file: `--flow-visited-mix: 30%` (the
     light tone of visited steps) and `--flow-tint-mix: 12%` (the tint
     behind branch buttons), next to `--flow-shade-mix`. Nothing else in
     the file changes.
  3. **Tag badges use `--color-cat-N`**, by category slot. Phase 6's
     conventions use the same colours, so a neutral badge would have to be
     recoloured later. The legend waits for phase 6. Only four slots are
     defined; the 3.3 report says what happens with a fifth category.
  4. **No tabs.** "Iniciar recorrido" turns the same page into tour mode,
     and finishing returns to the overview with "Revisado". Three tabs with
     one disabled is worse than none.
  5. **The speed warning uses the prototype's full text:** «Fuiste muy
     veloz, ¿no se te habrá pasado algo? Repasa el flujo y vuelve a
     intentarlo.» The first sentence alone scolds without saying what to
     do. This replaces the owner's earlier instruction to use only the
     first sentence; the owner updates SPEC §7.
  6. Not acted on, by the owner's decision: the engine's exit index can
     differ from the sheet's only in drafts (publishing blocks both
     causes), and "Anterior" only moves the view back, so it is not logged.
- Reason: owner's approval of the phase 3 proposal.
- Spec sections affected: 7 (Viewer), 9 (Architecture: theme).

## 2026-11-13 — Known flaw: tour duration is end minus start

- Decision: a review's duration is the time from the start of its run to
  "Terminar recorrido", pauses included. **This is wrong for the progress
  report**, and is accepted only until then: someone will leave the tab
  open and finish the next day, and the Leader will read "14 h" in a
  column meant to say how much time they gave it. It is not fixed now
  because the report does not exist until phase 6. Each visit keeps its
  server time, so the duration can be recomputed later by capping long
  gaps between visits.
- The minimum time (5 s per step) is measured on the same wall clock, and
  that is right: a pause only helps to pass, and what stops someone from
  rushing is having to visit every step and take every branch.
- Reason: owner's decision.
- Spec sections affected: 7 (Viewer: tour, progress report).

## 2026-11-12 — The flow viewer, overview (phase 2.4)

- Decision:
  - `GET /flows/:id` (`src/viewer.tsx`) shows the flow's latest release,
    never the draft. A flow with no release, or an unknown id, is 404.
    Access by area and role comes in phase 4.
  - The server sends the compiled release as JSON inside
    `<script type="application/json">`, with every `<` escaped so step text
    cannot close the script. `public/js/viewer.js` lays it out and draws it
    in the browser (SPEC §9). Without JavaScript the card says so.
  - The page follows the prototype's overview: title with the flow's dot
    and the objective; the diagram card, which scrolls (76vh); the
    "Panorama" panel on the right with the step count; and "Iniciar
    recorrido" floating in the card's bottom right corner. The button does
    nothing until phase 3. On phones (≤ 760 px) the panel goes above the
    diagram.
  - Left out of 2.4: the prototype's phase tabs (Panorama, Recorrido,
    Repaso), the review status, the subflow count in the panel, the flow
    selector, and zoom on phones. On a phone the diagram is shrunk to the
    screen width, as in the prototype, so its text is small until zoom
    arrives.
  - `/flows` links "Ver" for flows with a release.
- Reason: phase 2 plan approved by the owner; SPEC §7 (Layout), §8.
- Spec sections affected: 7, 8, 9.

## 2026-11-12 — The SVG renderer and the flow colours (phase 2.3)

- Decision:
  - `public/js/diagram.js` `renderDiagram(layout, {name, colour})` returns
    the SVG markup. It reads only what the layout adapter returns and
    writes only geometry (positions, sizes, path data, the half circles of
    start and end steps) and class names. A test refuses any colour or
    presentation attribute (`fill`, `stroke`, `font-size`, `rx`, `style`…)
    in the output of both reference flows.
  - **Colour by flow.** The `<svg>` carries `flow-N`, its palette slot.
    `app.css` has one rule per slot: `--flow: var(--flow-N)` and
    `--flow-on`, the text on that colour. White (`--color-on-primary`) or
    near-black (`--color-text`), whichever contrasts more (WCAG formula, as
    in the prototype). A test computes the choice from the hex values in
    `theme.css` and compares it with `app.css`, so a palette change that
    breaks the table fails the tests. Dark text goes on slots 3, 6, 8, 10
    and 12.
  - Outlines, arrows and lines use `--flow-strong`:
    `color-mix(in srgb, var(--flow) var(--flow-shade-mix), var(--color-text))`,
    the prototype's darker shade made with tokens (`--flow-shade-mix` is
    62 % in `theme.css`). Diagram icons fill with `currentColor`, the
    colour of their step (SPEC §9).
  - The overview paints no step with the flow colour, so `--flow-on` shows
    from phase 3 on (the current step). `app/.layout-check/colores.png`
    shows it on all twelve slots.
  - **Step titles are real `<text>`**, wrapped in two lines as the
    prototype does (`wrapTitle`). A longer title is cut with "…" in the
    box; the whole title is in the step's `<title>`. Ctrl+F finds only
    the visible part.
  - **Type is tokens:** step text `--text-sm` (14 px; the prototype used
    13) and branch labels `--text-xs` (12 px; it used 12.5) with
    `--weight-medium`, as in the prototype. The owner confirmed 14 and 12
    as the real scale.
  - The wait and link icons are the geometry of `public/icons/hold_on.svg`
    and `link.svg`, inlined like the prototype does, filled from CSS. The
    files carry a literal fill that cannot be overridden through `<use>`.
  - A subflow step is drawn as an activity.
  - Vitest empties imported `.css` files, so `vitest.config.ts` passes
    `theme.css` and `app.css` to the tests as a binding (`CSS_FILES`).
- Kept as they are (owner, 2026-11-12): the stroke widths computed from
  `--border-width` (`* 1.5`, and `* 3` for the end step), and the
  decision's corner cut and icon positions as geometry in `diagram.js`.
- Contrast: slots 2 and 11 were below WCAG AA (4.46:1 and 4.38:1). The
  owner changed them in `theme.css` (`#7C69C1`, 4.52:1; `#00838A`,
  4.55:1, both with white text). The `--flow-on` table did not change.
- **Icons inherit the text colour.** The six single-colour icons of SPEC
  §9 (link, close, back, subprocess, hold_on, zoom) carried
  `fill: #27519b` inside the file, so they ignored `currentColor`
  everywhere in the app. On the owner's instruction they now say
  `fill: currentColor`. The four status icons (pending, in_progress, done,
  alert) keep their colours. A test checks both groups.
- Reason: owner's instructions for 2.3; SPEC §9 (Visual style).
- Spec sections affected: 9 (Visual style and theming, Diagram).

## 2026-11-12 — The diagram layout adapter (phase 2.2)

- Decision:
  - `public/js/diagram-layout.js` is the only door to the layout engine.
    `layoutFlow(flow)` takes a compiled flow (`compile()` in the browser,
    `documentToFlow()` on the server) and returns `{width, height, nodes,
    edges}`. The SVG renderer reads that and nothing else.
    - Nodes: `{id, x, y, w, h, type, title}`, where `x`, `y` is the centre.
    - Edges: `{from, to, label, back, points, labelAt}`.
  - **Points carry their curves.** `layout()` draws edges as cubic curves,
    straight runs and quadratic entries at the side of a node. A bare list
    of points cannot redraw that, so a point may hold `c`: the control
    points of the curve that ends there (two for cubic, one for
    quadratic, none for a line). A test rebuilds every path of both
    reference flows from the points and compares it with `layout()`'s own,
    so the renderer reproduces the prototype exactly. An engine that only
    gives bare points still fits the contract: its edges are polylines.
  - Every edge runs from source to target, back edges included.
  - **P34 fixed in `core.js`:** `layout()` no longer merges edges with the
    same ends. Each exit is its own edge, and the existing port spreading
    draws two branches to one step as two parallel arrows, in the order
    written (Sí left of No), each with its label.
  - The adapter is type-checked with `core.js` (`tsconfig.core.json`).
- Reason: owner's instruction for phase 2 (one adapter, engine swappable)
  and the 2.1 decision.
- Spec sections affected: 7 (Flow viewer), 9 (Diagram).

## 2026-11-12 — The overview scrolls; the diagram stays vertical

- Decision:
  - **The overview scrolls, and that is all.** FlowHow is not a diagram
    tool. The overview is not meant to be read at once: it is for getting
    oriented before starting, finding one's place during the tour, and
    finding something when coming back to look it up. None of those needs
    36 steps on screen at the same time; learning the process is what the
    step-by-step tour is for. The "Ver todo" toggle that shrinks the
    drawing comes in phase 6 with the mobile work, not before.
  - **The diagram stays vertical** (top to bottom). Boxes are wide and low
    because they carry text, and these flows are deep and narrow: 26
    layers, three or four lanes. With depth going down, each layer costs
    the height of a box: 957 × 3012 px for Apertura de OT. Turned
    sideways, each layer would cost its width, more than 6,000 px, and the
    user would scroll in both directions. To be revisited only if a wide,
    flat flow ever appears.
- Reason: owner's decision, closing the open question of "Diagram layout:
  core.js layout() stays".
- Spec sections affected: 7 (Flow viewer, Layout).

## 2026-11-12 — Assumption: no phases for now (not a closed decision)

- Assumption: the flows are built without phases. The "Dudas" sheets of the
  reference files are for the business area to resolve, and their answers
  will arrive when they arrive. If phases ever exist, they will be one more
  tag category ("Fase: 1", "Fase: 2"). That is additive: it changes
  neither the document model nor the tour.
- Status: **an assumption, to be confirmed** when the "Dudas" are answered.
- Reason: owner's instruction, so that phase 2 is not blocked.
- Spec sections affected: 5 (Tags with categories), 7 ("Not included:
  ... phases or step groupings").

## 2026-11-12 — Diagram layout: core.js layout() stays (phase 2.1)

- Decision: the viewer keeps the layered `layout()` already in `core.js`,
  the one `reference/prototype.html` draws with. Dagre is not added. The
  owner's rule for the check: dagre had to beat `layout()`, which already
  exists, is the look approved in the prototype, and adds no dependency.
- Measurement: both reference flows (Apertura de OT, 36 steps; Instalaciones,
  30) drawn with each engine, with the prototype's node shapes, node size
  (188 × 56) and spacing. Dagre 3.1.3 (`@dagrejs/dagre`, ESM, 49 KB), as a
  multigraph with labelled edges. The images and the script live in
  `app/.layout-check/` (ignored).

  | Criterion | layout() | dagre |
  |---|---|---|
  | Decision shapes, two starts (Instalaciones P1, P2) | clean | clean |
  | Edge crossings; edges over a node; labels over a node or a label | none | none |
  | Branch order | as written (Sí left, No right) | reordered, and not the same at every decision |
  | Branch labels | next to the decision | a long edge carries its label halfway down (P6 «Externa», P9 «Sí», P17 «No») |
  | Cycle P32→P31 | clean loop at the side | loop tangled with the «No» edge |
  | Three-way decision P26 | symmetric | symmetric |
  | Two branches to one step (P34 «Sí», «No» → P35) | **merged: one arrow, «No» lost** | two arrows |
  | Size | 957 × 3012 / 694 × 3244 | 836 × 3092 / 676 × 3308 |

- Defect to fix in 2.2 (*fixed in 2.2*): `layout()` merges edges with the same ends, so
  P34 shows one arrow where there are two paths and loses a label. The
  tour is not affected (it reads the exits of the document), but the
  diagram must draw both.
- *Closed on 2026-11-12, see "The overview scrolls; the diagram stays
  vertical":* **neither engine fits a real flow on one screen.** On a 1440 × 900
  desktop the prototype's diagram card shows about 884 × 580 px. Both
  flows are 26–28 layers deep, about 3000 px high: the card shows 5 of 36
  steps of Apertura de OT (14 %) and 7 of 30 of Instalaciones (23 %),
  about five screens of scrolling. Fitting the whole flow takes the text
  to about 2.4 px. Changing the engine, the spacing or the direction does
  not change this: it is the depth of the flows. How the overview helps
  someone learn a process this long is a product decision for the owner,
  to be taken before 2.4.
- Reason: owner's decision for phase 2; measurement above.
- Spec sections affected: 7 (Layout), 9 (Diagram).

## 2026-11-12 — Deployment check result: the free plan is enough for now

- Result: deployed once to a test address (Worker `flowhow-test`, D1
  `flowhow-test`), migrations applied remotely. Instalaciones was imported
  through the import screen's requests against that address (30 steps, 2
  categories, 9 tags, draft and save point in the remote D1). Measured
  with `wrangler tail`:
  - Cold start: the first request after 15 minutes idle took about 50 ms
    more inside the Worker (79 ms wall, against 31 ms warm). Worker startup
    is 1 ms.
  - CPU per request: pages 1–3 ms. Import review and apply: 5 ms median,
    8 ms maximum warm; up to 17 ms (review), 14 ms (apply) and 12 ms
    (create flow) on the first requests after deploying. Those finished
    with outcome ok. Waiting on D1 does not count as CPU.
  - Requests: static assets do not reach the Worker and do not count;
    only pages do, far below 100,000 a day.
- Decision: stay on the Workers free plan (10 ms CPU per request, 100,000
  requests a day). Only the first import requests after a deployment go
  over 10 ms; imports are rare and Board-only, and can be repeated.
- **Measure again** when the tour (phase 3) and the progress report
  (phase 6) exist: they will add requests and server work. D1's daily
  limits (rows read and written) were not measured.
- The Worker and the D1 were deleted after the check: until phase 4
  there is no authentication, and the URL exposed the Instalaciones flow
  to anyone who found it. `wrangler.jsonc` has no `database_id` again.
- Reason: SPEC §11 deployment check; owner's decision.
- Spec sections affected: 9, 11.

## 2026-11-12 — Provisional import screen (phase 1.5)

- Decision:
  - `/flows` lists and creates flows. `/flows/:id/import` takes a paste or
    an .xlsx, then shows a review, then imports into the draft. It is a
    scaffold to exercise the import contract: phase 5 replaces it with
    the editor and phase 4 restricts it to editors. It reuses the existing
    `app.css` classes only (the text field rule now also covers
    `textarea`).
  - The paste or file is read in the browser by `public/js/import-form.js`
    (SPEC §9). Its two pure functions, `gridFromText` and `gridFromXlsx`,
    are tested in the Workers runtime. The DOM wiring is not tested.
  - The .xlsx sheet read is "Flujo", as in the reference files. If both a
    file and a paste are given, the file wins, and the screen says so.
  - Table-level errors (no headers, an unreadable file) are shown in the
    browser and nothing is sent. Everything else goes to the server, which
    answers 400 for a grid of another shape and 422 for a review that
    blocks, and reviews the grid again on apply.
  - New categories and tags come pre-checked; unchecked ones are dropped.
  - The review shows no diagram yet: the diagram is phase 2.
  - `core.js` gained `textToTable(text)`, the split that `parseTable` used
    inline, so the browser does not repeat it.
- Reason: SPEC §6 import rules; PLAN phase 1; owner's instruction that the
  screen be disposable and invent no visual patterns.
- Spec sections affected: 6, 9.

## 2026-11-12 — Dev load of the reference flows (phase 1.4)

- Decision:
  - `npm run db:load` runs `app/tools/load-dev-flows.ts` in Node, which
    strips the types itself, so there is no build step. It reaches the
    local D1 through wrangler's `getPlatformProxy`, the same state that
    `wrangler dev` uses.
  - The logic lives in `src/devload.ts`, so it is tested inside the
    Workers runtime. It goes through the real contract: `reviewGrid`,
    `applyGrid` accepting every new category and tag, then `publishFlow`.
  - It creates every flow first, then imports them, so links resolve in
    any order. A flow being published for the first time gets the area
    "Desarrollo".
  - **Idempotent:** a flow whose latest release already holds the
    document the grid would produce is left alone. A changed grid
    publishes a minor version. An import that blocks stops the load with
    the row messages.
  - `tools/` is not type-checked: that would need `@types/node`, a new
    dependency. The file is a dozen lines and imports only typed modules.
- Reason: SPEC §11 phase 1 ("both real flows loaded and published as
  1.0"); PLAN phase 1 ("recargarlos no crea versiones nuevas").
- Spec sections affected: 11.

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

- *Partly obsolete (2026-11-12, phase 1.4): there is no dev endpoint and no
  `manage.py`; the loader is `npm run db:load`, see "Dev load of the
  reference flows". The grids are now regenerated by
  `app/tools/xlsx-to-grid.mjs` (phase 1.2), not by a throwaway script.
  The load order no longer matters: all flows are created before any grid
  is read. The placeholder area "Desarrollo" still holds.*
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

- *Obsolete (2026-11-12, phase 2.1): measured against the real flows, dagre
  did not beat the `layout()` already in `core.js`; see "Diagram layout:
  core.js layout() stays". The vendored path named below belonged to the
  Django implementation and no longer exists.*
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
