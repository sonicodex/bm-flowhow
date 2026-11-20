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

## 2026-11-20 — Phase 9.4: «Anterior» and «Siguiente» as round buttons

- **The designer's icons as they are:** `step_prev.svg` and `step_next.svg`
  inside a `.step-button`, which only sets the size
  (`--step-button-size`), the round shape and `--shadow-step-button`;
  nothing recolours them. Side by side at the panel's bottom right.
- **Named for screen readers:** `aria-label` and `title` «Anterior» and
  «Siguiente». The image has an empty `alt`.
- **Dimmed when disabled** with `--step-button-disabled-opacity`:
  «Anterior» on the first step; «Siguiente» while a branch waits to be
  chosen on the diagram, or while a step is being saved.
- **«Terminar recorrido» keeps its words**, beside «Anterior». «Entrar al
  subflujo» and «Volver a «…»», which the SPEC lists, are not tour buttons
  in this app: a link step offers «Ir a «…»» inside the panel (6.4), and
  it stays there.
- **Checked in headless Chrome** at 1366×768 and 390×844: 44 × 44 px; the
  first step has «Anterior» dimmed to 0.45; «Siguiente» moves on and
  «Anterior» comes back; on «¿La producción es externa o interna?»
  «Siguiente» is dimmed and the focus goes to the first branch.
- Spec sections affected: none (built as §7 now says).

---

## 2026-11-20 — Phase 9.3: the step panel's content as the mock

- **Tour panel**, in the SPEC's order:
  - the step's type in small grey caps;
  - the title, now in the display face (`--font-display`);
  - the description;
  - one line per category: the name in muted grey, the values as chips in
    that category's convention (`.chip.c1`–`.c4`). These are the
    `--color-cat-N` tokens the diagram's badges and the legend's swatches
    use, with slot 3 dashed. The free review's panel gets them too.
  - **«Próximo paso:»** in bold, and the step in a chip as wide as the
    panel, in the flow's visited tint with the visited border. Where a
    plain step has several ways on, the label is «Próximos pasos:», with
    one chip each. A decision keeps its branch list. A phone still leaves
    the hint out (SPEC §9).
- **Overview panel:** «PANORAMA», «El flujo completo», «Míralo de arriba
  abajo para ubicarte.» and «Después lo recorrerás un paso a la vez.» on two
  lines of one paragraph, the objective in muted text when there is one,
  then the step count.
- **The buttons sit at the panel's bottom right in their own width**, with
  no rule above them, as the mock draws them. The 8.5 rule and full-width
  buttons are gone from the viewer. «Empezar de nuevo» and «Repaso libre»
  sit in the same corner as «Iniciar recorrido».
- **Checked in headless Chrome** against artboards 3 and 4 at 1366×768 and
  390×844, Apertura de OT at «Diseñar y asignar» (the mock's step). The page
  does not scroll.
- Spec sections affected: none (built as §7 now says).

---

## 2026-11-20 — Phase 9.2: the viewer's frame as the mock's artboards 3 and 4

- **One title line:** the dot, the name and the state («Revisado», with the
  date, in small type) on the left; «Flujo» and its selector at the right
  end, 240 px wide. On a phone the selector goes to a line of its own.
- **The objective left the heading.** It goes in the overview panel, before
  the step count (SPEC §7, the owner's answer), styled in 9.3.
- **One card** (`.card.viewer-cols`), `--viewer-gutter` from the window on
  the sides and the bottom. It is a grid:
  - The progress row (or the free review's filter) and the conventions run
    across the whole card, at least `--viewer-progress-height` and
    `--viewer-legend-height` tall, each closed by its hairline.
  - The diagram takes two thirds, and the step panel the last third, as a
    card of its own with `--shadow-panel`, `--space-6` from the outer
    card's edges. In the overview and the tour alike, it hugs its content
    and scrolls inside past the room there is. The mock's tour panel is
    narrower than a third; the SPEC's "about a third" wins.
  - The markup kept its pieces: `.diagram-card` is no longer a card but
    `display: contents`, so the three renderers (overview, tour, free
    review) only lost its `card` class.
- **The card fills the window** as in `38ca7ef`, with the same 320 px
  floor.
- **On a phone** the panel goes above the diagram inside the card, capped
  at 40 % of the window's height. The diagram keeps at least 160 px, and a
  window too short for both scrolls the page.
- **The progress bar** runs to about the middle of the row, as on the mock,
  and the links sit at its right end.
- **Checked in headless Chrome** (Apertura de OT, overview, tour and free
  review):
  - At 1366×768, 1280×800, 900×700 and 390×844 the page does not scroll.
  - At 320×568 the floor applies and the page scrolls: 72 px in the
    overview, 244 px in the tour, where the progress and conventions rows
    wrap.
- Spec sections affected: none (built as §7 now says).

---

## 2026-11-20 — Phase 9.1: the header as the mock's artboard 2

- **The bar** is 56 px (`--header-height`) and the band 30 px
  (`--nav-height`), the owner's corrected tokens.
  - On the right: the user's name in the text colour, then
    `icons/exit.svg` as the sign-out button, drawn in `currentColor`
    (`--color-primary`). The word «Salir» is gone from the screen; it is the
    button's accessible name and its tooltip.
- **The band is the administration menu** (SPEC §9, Navigation):
  - «Flujos» and «Áreas» for editors, «Usuarios» for `can_manage_users`,
    «Reportes» for the Board and Leaders, as before. The «Flujos» that took
    a non-editor to Inicio is gone (8.1, struck through).
  - A Standard user gets no band. Inicio is reached from the logotype.
  - ~~A Leader keeps the band with «Reportes» on every screen but the report
    itself. There it would hold only the screen they are on, which the SPEC
    says the band must never be.~~ Superseded the same day by the owner's
    correction: a Leader always sees the band, with «Flujos» (Inicio, the
    flows they review) and «Reportes» only, the report included.
    - SPEC §9, Navigation still says a Leader keeps the band "for
      Reportes". Proposed to the owner: name «Flujos» and «Reportes» there,
      and drop the line about a menu holding only the current screen, which
      no role can reach now.
- **Service worker** `shell-6`, with `exit.svg`, `step_prev.svg` and
  `step_next.svg`.
- **Checked in headless Chrome** at 1366 and 320 px as `junta`, `lider` and
  `empleado`: bar 56, band 30 or none, no horizontal scroll.
- Spec sections affected: none (built as §9 now says).

---

## 2026-11-20 — The viewer fits the window (SPEC §9, Layout)

- Decision:
  - **The owner changed SPEC §9:** the diagram card and the step panel are
    as tall as what is left of the screen and scroll inside themselves;
    the page does not scroll.
  - **CSS only, unlike the editor's grid.** The viewer's page gets
    `body.viewer-page` (`page: "viewer"` in the renderer, as the login has
    `page: "login"`). The body is a column of the window's height and the
    two cards take what the header and the flow's heading leave. Whatever
    above them changes height (the selector, the objective, the status
    line) needs no script to recompute.
    - The diagram's `max-height: 76vh` stays for the editor's preview and
      the import review; the viewer drops it.
    - The tour's frame took its height from that `max-height`; it now
      takes the card's own height when there is none (`viewer.js`).
  - **The panel's buttons stay at its foot** (`position: sticky`) while its
    content scrolls under them, so «Siguiente» is always in view.
  - **On a phone** the panel stays above the diagram and takes at most half
    of the room; the diagram takes the rest.
  - **A floor:** the two cards never go below 320 px tall (eight
    `--space-10`). In a shorter window, such as a phone held sideways, the
    page scrolls again rather than squeezing the diagram to nothing.
  - **Checked in headless Chrome**, Apertura de OT, overview and tour. The
    page does not scroll at 1280×800, 1440×900, 900×700 and 390×844, and
    the cards end 32 px above the window's bottom. At 320×568 the floor
    applies and the page scrolls 76 px.
- Reason: SPEC §9, rewritten by the owner on 2026-11-20.
- Spec sections affected: none beyond the owner's change.
- Superseded in part by phase 9.2 (2026-11-20): the two sibling cards
  became one card with the panel inside it. The body class, filling the
  window, the floor, the sticky buttons and the frame's height stand.

## 2026-11-20 — Phase 8.5: the tour's panel and the step states

- **The buttons moved from the diagram's corner to the foot of the step
  panel** (SPEC §7, Layout): «Anterior» and the primary action, with the
  «muy rápido» message above them (`.step-actions`).
  - The diagram lost the bottom padding it kept so the floating buttons
    would not hide a step for good.
  - The buttons share the panel's width: side by side when they fit, one
    per line when they do not.
  - «Empezar de nuevo» and its confirmation work in the same place.
- **The overview's panel is a card of its own:**
  - «PANORAMA», the flow's name, «Estás viendo el flujo completo…» and
    how many steps it has;
  - at its foot «Iniciar recorrido» (or «Continuar» / «Repetir»), with
    «Empezar de nuevo» and «Repaso libre» when they apply.
- **Nothing to move in the free review:** it had no corner buttons. A
  link step's «Ir a «…»» was already in the panel.
- **On a phone** the panel still goes above the diagram, now with its
  buttons.
- **«Convenciones» name the step states in the tour** (SPEC §7): «Paso
  actual» and «Paso visitado» first, then the categories.
  - Each swatch is drawn as the diagram draws that state, in the flow's
    colour: Chrome gave the same computed colour for swatch and node.
  - In the tour the legend now always shows, since there are always
    states to name.
  - The free review keeps its categories only: it marks steps as
    selected, highlighted or dimmed, never current or visited.
- **Checked in headless Chrome** as `junta` on «Apertura de OT», at 1280,
  390 and 320 px, with the tour's answers faked so nothing was written:
  - the overview card;
  - the tour after two steps, with no button over the diagram;
  - «Empezar de nuevo» and «Cancelar»;
  - the free review;
  - no horizontal scroll.
- Spec sections affected: none (built as §7 now says).

---

## 2026-11-20 — Phase 8.4: the report's summary

- **«Resumen por flujo»** (SPEC §7, Progress report), on the report screen,
  between the filters and the rows. One line per flow:
  - the flow's name;
  - a bar of the share reviewed;
  - the share as a percentage and a count («33 % · 1 de 3 personas»).
- **Counted from the report's own rows** (`summarize`), so it has the
  same scope (the Board every flow, a Leader the people who share an area
  with them) and cannot disagree with the table.
  - «Reviewed» is the rows' rule: a review of the latest major version.
  - Leaders count among the people a flow is assigned to, as they are
    rows of the report.
- **Filters** (owner's answer): the summary obeys the area and the flow,
  not «Revisado», which would always give 100 % or 0 %.
  - While «Revisado» is set, the summary says so in a line of its own
    (`SUMMARY_SKIPS_REVIEWED`), so nobody takes it for a bug.
  - It changes live with the filters: `report.js` swaps it in with the
    count and the table.
- **The percentage is written by hand**, with a no-break space before the
  sign. On the Workers runtime `Intl`'s es-CO percent writes «33%», and
  elsewhere «33 %».
- **Checked in headless Chrome** as `junta`:
  - at 1280, 390 and 320 px, with no horizontal scroll (on a phone the
    name goes on its own line);
  - with the flow filter, then «Revisado: No», the summary followed the
    flow, kept its counts, and showed the line.
- Spec sections affected: none.

---

## 2026-11-20 — Phase 8.3: importing a flow from the flows screen

- **«Importar flujo»** beside «Nuevo flujo» (SPEC §9, Navigation), as
  areas and users have (`/flows/import`, editors only).
  - The page asks for the flow's name, then a .xlsx or a paste, read in
    the browser by the editor's reader. «Descarga la plantilla» is there
    too.
  - The name's problem (empty, or taken, compared without case or accents)
    is said before the steps are reviewed: there is no flow to review
    without one.
- **The review is the editor's**: the same rules on the server
  (`reviewGrid`), the same problems list, the same checkboxes for new
  categories and values, the same diagram of what would result (in the
  colour the flow will get).
  - The review's HTML moved from `editor.js` to `import-form.js`
    (`reviewSummary`, `reviewChecks`, `acceptedIn`), and both screens
    use it.
  - `reviewGrid` takes a flow that does not exist yet, by its name. No
    step can point at it (`selfId` 0, an id no flow has).
- **Accepting creates the flow with the grid as its draft, unpublished**
  (owner's answer), and opens the editor («Importado al borrador…»).
  - The server reviews again before creating anything. A blocking problem
    or a taken name creates nothing.
  - With new categories or values and no list of the accepted ones, it
    asks first, as the editor's save does.
  - If the draft cannot be written after the flow is created, that flow
    is deleted: nothing is left half made.
- **The editor keeps its own import**, which replaces the draft. Checked
  again in Chrome after the move: same review, same save.
- **`flow-import.js`** joins the service worker's shell.
- **Checked in headless Chrome** with `reference/Flujo_Instalaciones.xlsx`:
  - no name, and a taken name, each gave their message;
  - a new name gave 30 steps, «Sin problemas» and the diagram;
  - «Crear el flujo» (answered by the harness, nothing written) sent the
    grid and went to the editor;
  - no horizontal scroll at 390 px.
- Spec sections affected: none.

---

## 2026-11-20 — Phase 8.2: the login screen

- **Built as SPEC §9, Login screen.** The company's image fills the
  screen, with one white card centred on it:
  - the logotype, «Iniciar sesión», «Usuario» and «Contraseña», «Acceder»;
  - «Si olvidaste tu contraseña, el administrador la restablece.»;
  - the maker's logotype at its foot, small.
  - The login has no header (`page: "login"` in the layout).
  - The line «Si no tienes usuario… pídeselo a la Junta directiva» is gone:
    the card says what SPEC says, and nothing else.
- **The image never holds the card.**
  - It is a lazy `<picture>` (webp, the jpg for a browser without it),
    fixed behind the card. It is not a CSS background.
  - Measured in Chrome with the image held 6 s: as a background it held
    the page's `load`, and the logotype splash, which waits for `load`,
    covered the card until 6.3 s. Lazy, it stays out of `load`: the splash
    left at 2.4 s with the image still on its way, over a readable card.
- **The maker's logotype** has the alt text «Blue Monkey», what it reads.
  It appears on no other page (a test checks Inicio).
- **The brand files stay in `public/brand/`.**
  - CLAUDE.md now lists the folder among the owner's assets that are not
    edited.
  - The three files are in the service worker's shell (`flowhow-shell-5`),
    about 640 KB fetched once when the worker installs.
- **Checked in headless Chrome** at 1280, 390 and 320 px: the card centred,
  no horizontal scroll, the webp downloaded; with a wrong password the card
  only grows by the error line.
- Spec sections affected: none (built as §9 now says).

---

## 2026-11-20 — Phase 8.1: header, navigation and landing

- **Header** (SPEC §9, Navigation): a white bar (`--color-header-surface`,
  `--header-height`) with the logotype and the account, and a dark band
  (`--color-nav-surface`, `--nav-height`) with the navigation,
  right-aligned.
  - The current section is marked with `aria-current="page"` and a bottom
    border in `--color-nav-current`. A section includes its screens below:
    «Flujos» stays current in a flow's editor and viewer and in Categories.
  - The band keeps one line. On a narrow screen it would scroll sideways
    inside itself; at 320 px the Board's four links still fit.
  - At 320 px a long user name is cut with an ellipsis, and the full name
    is its tooltip.
- **Links, each to whoever may use it:**
  - ~~«Flujos»: `/flows` for an editor, Inicio (`/home`) for anyone else
    (owner's answer). So a standard user now sees the band too, with that
    one link.~~ Superseded by phase 9.1 (2026-11-20): «Flujos» is for
    editors only, and a Standard user gets no band.
  - «Áreas»: editors. «Usuarios»: `can_manage_users`. «Reportes»: the Board
    and Leaders.
- **Categories:** out of the navigation, linked from the flows screen
  («Categorías de etiquetas», with a line saying what one is). Their list
  has «Volver a flujos».
- **The first-use wizard** is out of the navigation and out of the offer on
  Inicio; `/setup` still opens for whoever may walk it.
  - The wizard's «Terminar por ahora» and «Sin permiso»'s «Volver al
    inicio» now go to `/`, which sends each user to where they land.
- **Landing** (SPEC §4): the Board on `/report`, everyone else on `/home`.
  It applies after signing in, at `/` with a session, and after choosing a
  new password.
- **Checked in headless Chrome** at 1280, 390 and 320 px as `junta`,
  `lider` and `empleado`: no horizontal scroll, bar 64 px, band 36 px; the
  Board landed on the report, the others on Inicio.
- Spec sections affected: none (built as §4 and §9 now say).

---

## 2026-11-20 — Splash: a safeguard for a move that never leaves

- **Owner's decision:** if a move between sections has not left the page
  after 10 s, the veil lifts by itself. It is not a cap; it keeps the app
  from staying covered when the reader presses the browser's Stop.
- **How:** `splash.js` starts a 10 s timer at the click or the submit. If
  the page is still there when it fires, the veil goes and the pending move
  is forgotten. A page that leaves takes the timer with it, so a normal
  move never meets it.
  - Ten seconds is also how old a move may be for the next page to carry
    the isotype (`src/layout.tsx`), so the two agree: a page that arrives
    later than that shows the logotype.
  - In milliseconds in the script, like the head script's: a safeguard,
    not a duration of the splash, so not a `--splash-*` token.
- **Checked in headless Chrome:**
  - **Stop:** a click with the answer held 20 s, then Stop at 1 s. At 9 s
    the veil was still up; at 11 s it was gone, with no move pending.
  - **The next click:** a normal link still showed the isotype, which
    left at 725 ms.
- Spec sections affected: none.

## 2026-11-20 — Splash: the isotype is held too

- **Owner's change to SPEC §9 and `theme.css`:**
  - The isotype between sections is a minimum, no longer a cap.
  - It stays at least `--splash-section-hold` (725 ms), and longer while
    the next page is not ready.
  - That token replaces `--splash-section-max` (1 s).
- **Both marks now work the same way**, in the inline head script:
  - the veil fades out once its hold has passed and the page has loaded,
    whichever comes last;
  - the logotype's hold counts from the page's start, the isotype's from
    the click (`--splash-elapsed`, carried in `sessionStorage` as before).
- **The CSS cap is gone.** app.css only fades the veil in, grows the mark
  over its hold, and fades it out at `data-splash-leaving`.
- **`splash.js` only starts moves.** It notices the click or the submit,
  fades the isotype in over the clicked page, and leaves the pending move
  in `sessionStorage`.
  - A move started on a page ends that page's own veil: the head
    script's timers leave it alone (`data-splash-move`).
- **A page that asks before letting the reader go** (the editor with
  unsaved changes, the importer's passwords):
  - Without the cap, the veil would have stayed over the page behind the
    browser's question.
  - Now, when that question comes up, the veil goes at once.
  - If the reader leaves after all, the next page still shows the isotype.
  - If they stay, the pending move is forgotten the next time they touch
    or type on the page. Replaces the ten-second rule as the guard; the
    ten seconds stay as a backstop.
- **No upper bound**, as SPEC says.
  - A click that starts a move but never leaves the page would keep the
    veil. Nothing in the app does that today:
    - every download is made in the browser, with `download`, which
      starts no move;
    - the server sends no attachment and no empty (204) answer.
  - ~~The browser's Stop button during a slow move leaves the veil up. A
    reload clears it (with the logotype).~~ Superseded 2026-11-20 («Splash:
    a safeguard for a move that never leaves»): it lifts after 10 s.
- **Checked in headless Chrome** (dev server, `junta`, writes refused, the
  service worker bypassed):
  - **The login form → Inicio, page ready at 0.1 s:** the isotype left at
    725 ms from the submit.
  - **A link whose page answers in 2.5 s:**
    - the isotype stayed up on the clicked page until the new one came;
    - it fades out on the new page as soon as it loads.
  - **A page asking before leaving, reader stays:** dialog shown, veil
    gone, the pending move forgotten at the next touch.
  - **The same, reader leaves (reload):** the logotype, 2 s.
  - **«Atrás»:** no veil.
  - **Reduced motion:** the isotype for 725 ms, then gone at once.
  - **Logotype regression:** still leaves at 2000 ms.
- Spec sections affected: none (built as §9 now says).

## 2026-11-20 — Splash: the logotype is held

- **Owner's change to SPEC §9 and `theme.css`:**
  - The logotype now shows on every page loaded from the server, not once
    per tab.
  - It stays a full `--splash-start-hold` (2 s), which replaces
    `--splash-start-max`.
  - It is a wait, not a cap: it stays its two seconds when the page is
    already ready, and longer when it is not.
  - ~~The isotype between sections does not change.~~ Superseded 2026-11-20 («Splash: the isotype is held too»).
- **Loaded from the server** means any load that is not the second half of
  a move between sections: opening the app, a reload, a typed address, a
  link from elsewhere, «Atrás» when the browser kept no copy.
  - The head script tells them apart with the same `sessionStorage` mark
    as before: a fresh move means the isotype, anything else the
    logotype.
  - The once-per-tab mark (`flowhow-open`) is gone.
  - The login form, leading to Inicio, is a move between sections, so it
    shows the isotype.
- **The hold lives in the inline head script.** It cannot fail to arrive.
  - It starts counting before the first paint.
  - At `load`, it waits whatever is left of the hold, then marks
    `data-splash-leaving`; app.css fades the veil out over
    `--splash-leave`, and the script clears it after that.
  - ~~`splash.js` now handles only the isotype.~~ Superseded 2026-11-20 («Splash: the isotype is held too»): both holds
    are in the head script.
- **No upper bound on the logotype**, as SPEC says. A page whose `load`
  never fires keeps the veil.
- **Reduced motion:** the same hold, then the veil goes with no fade.
- **Checked in headless Chrome** (dev server, `junta`, writes refused, the
  service worker bypassed):
  - **First load and reload:** the page loaded at about 90 ms and the
    logotype still left at exactly 2000 ms.
  - **Load held 3.5 s:** it left at `load`.
  - **The login form, and a link:** each showed the isotype, never the
    logotype. ~~A page slower than the 1 s cap arrived with no visible veil.~~
    Superseded 2026-11-20 («Splash: the isotype is held too»): the isotype now stays until it arrives.
  - **«Atrás»:** no veil.
  - **Reduced motion:** 2 s, then gone at once.
- Spec sections affected: none (built as §9 now says).

## 2026-11-20 — Temporary passwords: 80 bits or more

- **Owner's decision:**
  - The 100 iterations for temporary passwords stay (phase 7.2).
  - Their entropy goes up to 80 bits or more. With almost no stretching,
    its length is the only thing protecting a temporary password if the
    database leaks. Typing a few more characters, once, costs nobody
    anything.
- **Now:** eighteen characters in three groups of six (`abcdef-ghjkmn-pqrstu`)
  from the same 31-symbol alphabet without look-alikes. That is
  18 × log2(31) ≈ 89 bits, about 2^96 SHA-256 operations to guess one from
  a stolen hash.
- **Why eighteen:**
  - each symbol is worth about 4.95 bits;
  - sixteen characters, the shortest even grouping, would give 79.3 bits,
    short of 80;
  - eighteen is the shortest length above 80 that splits evenly into
    groups.
- **Applies to every temporary password:** the importer, «Nuevo usuario»
  and «Restablecer contraseña».
- **Passwords already handed out keep working:** only the generator
  changed, not how passwords are checked.
- **Tests:** a test now holds the format, the alphabet and the 80-bit
  floor.
- **Checked in headless Chrome:** the hand-over card fits on one line at
  390 px. At 320 px it breaks at a hyphen, with no horizontal scroll.
- Spec sections affected: none.

## 2026-11-20 — Phase 7.3: the first-use wizard

- **«Configuración inicial»** (`/setup`) shows three numbered steps: Áreas,
  Usuarios, Flujos.
  - Each step says what there is already, or that there is nothing yet.
  - The open step explains itself, and offers:
    - its importer, opened with `?desde=configuracion` so the importer
      leads back here;
    - «Saltar este paso», or «Terminar por ahora» on the last one, which
      goes to Inicio;
    - a line to do it by hand.
  - The other steps offer «Ir a este paso».
- **No stored state** (owner's decision). The wizard opens on the step
  asked for (`?paso=`), else on the first step with nothing yet. Skipping
  is therefore not remembered: coming back opens on the first empty step.
  When all three have something, no step is open and any can be revisited.
- **The Usuarios step** counts the accounts besides the one looking at it.
  The first Board member is there from the start and does not make the
  step done.
- **The Flujos step:** there is no importer without a flow. The step leads
  to «Nuevo flujo», which creates the flow by its name and opens its
  editor. Since 5.9, the editor's notice points to «Importar desde
  Excel», and tag categories come from that file (SPEC §4).
- **Who:** a new access level, `setup`, needs `can_edit` and
  `can_manage_users` together, because the wizard walks both kinds of
  screen. Anyone else gets 403. It is in the access table and the walk
  over every route.
- **Offered** on Inicio while the app has no flow (any flow, published or
  not), to whoever has `setup`: «Empieza por…», or «Sigue con…» once
  there are areas or other accounts. It goes away with the first flow.
- **Reachable for good:** «Configuración inicial» in the admin navigation
  (owner's decision). The admin layer SPEC names is stage 3's and is not
  built.
- **Checked in headless Chrome** as `junta`, read-only. The local data
  already has everything, so no step was open; then `?paso=usuarios`, its
  importer and that importer's way back, and the phone width. The home
  offer, which needs an app with no flows, is covered by the tests.
- Spec sections affected: none (built as §4 says).

## 2026-11-20 — Phase 7.2: the user importer

- **Where:** from «Usuarios», with `can_manage_users`: «Importar
  usuarios» beside «Nuevo usuario». The review and the result share 7.1's
  screen.
- **Columns:** «Usuario», «Nombre completo», «Rol» and «Áreas».
  - **Rol** uses the names the app shows: Empleado, Líder, Junta
    directiva. Case and accents do not count. The template gives the
    column a drop-down list.
  - **Áreas** are separated by commas and must exist (owner's decision). An
    area whose name holds a comma cannot be named here; it is given in
    the form.
- **Row errors**, every one a row has, not only the first:
  - a missing username, or one over 100 characters;
  - a username repeated in the file, or one that already exists. The
    importer only creates accounts (owner's decision).
  - a missing name, or one over 200 characters;
  - a missing or unknown role;
  - an unknown area;
  - SPEC §4's area rules, with the form's messages: an Empleado with no
    area, or a Junta member with one.
- **Warnings**, which do not block, as the form gives them:
  - an Empleado whose areas have no published flow;
  - a Líder with no area.
- **Accounts:**
  - the role's permissions, as «Nuevo usuario» gives them;
  - `must_change_password`, so the first login leads to «Cambia tu
    contraseña», which exists since 4.4;
  - all of them in one D1 batch, so a username taken in the meantime
    leaves none behind.
- **The list of passwords:**
  - It is shown once, never stored. To see one again, reset that password.
  - «Descargar .xlsx» builds the file in the browser from the page's own
    data, under three lines above the table: that they are temporary
    passwords, that each person must change theirs at the first login,
    and that the file is to be deleted once they are handed out (owner's
    wording).
  - Leaving the result page asks first (`beforeunload`).
- **Temporary passwords are hashed at 100 PBKDF2 iterations, not 10,000.**
  This covers all of them: the importer, «Nuevo usuario» and «Restablecer
  contraseña». A password a person chooses keeps 10,000.
  - **Why:** fifty accounts at 10,000 iterations cost about 60 ms of CPU in
    Node, well over the Workers Free 10 ms. At 100, about 4 ms.
  - **Why it is safe:** ~~a temporary password is random, twelve characters
    from 31, about 59 bits. Stretching makes up for passwords people
    choose; a random one is out of reach without it. With 100 iterations,
    guessing it from a stolen hash takes around 2^66 SHA-256 operations.~~
    Superseded 2026-11-20 («Temporary passwords: 80 bits or more»): it is
    now eighteen characters, about 89 bits, around 2^96 operations.
    It also stops working at its first use.
  - **Timing:** `verifyPassword` tops a cheaper hash up to 10,000
    iterations. A login therefore costs the same whether or not the
    account still has a temporary password, and the time taken does not
    show which accounts are waiting for a first login.
  - DEPLOY §5 asks to measure `POST /users/import` after deploying.
- **Checked in headless Chrome** as `junta`. The review went through and
  «Importar» was faked. Checked:
  - row errors, all of them per row;
  - a clean review with the Líder warning;
  - the result;
  - the downloaded file, read back with `xlsx.js`: the three notes, a
    blank row, then the table;
  - the leave prompt, with real mouse clicks; Chrome shows it only after a
    user gesture.
- Spec sections affected: none (built as §4 says).

## 2026-11-20 — Phase 7.1: the area importer, and what the importers share

- **Shared by the area and user importers** (`src/import-list.tsx`,
  `public/js/import-list.js`):
  - **The browser only reads.** It turns the paste or the .xlsx into a
    table of text cells, using the same `xlsx.js` and paste parser as the
    flows. It decides nothing.
  - **The server checks everything.** It reads the columns, checks every
    row and answers the review. On «Importar» it checks everything again,
    since the review may be stale, and writes in one D1 batch.
  - **Columns:** the first row names them, in any order, compared without
    case or accents.
    - A column that is missing, repeated or unknown refuses the whole file,
      and the message lists the expected columns.
    - An unnamed column is accepted only if it is empty all the way down.
    - Empty rows are skipped.
    - Errors name the row as Excel numbers it, the header being row 1.
  - **The review** has the flow importer's look: the errors first, under
    «No se puede importar: corrige estas filas en Excel y vuelve a
    traerlas». While any row is wrong nothing else is shown and there is
    no «Importar». Then what would come in, as tables.
  - **Limits:** 2000 rows, 40 columns, 1000 characters per cell.
  - **The template** is built in the browser, one sheet with the headers.
  - **`?desde=configuracion`** makes the page's «Volver» and the result's
    link lead back to the first-use wizard (7.3).
- **Areas:**
  - From «Áreas», with `can_edit` (as the screen): «Importar áreas» beside
    «Nueva área». `AdminList` gained a second action for it.
  - One column, «Área».
  - An existing name, compared without case or accents, is matched and not
    touched. The review shows it beside the existing one.
  - Row errors:
    - a repeated name in the file, which names the first row it appears on;
    - a name over 100 characters, the form's limit.
  - An area created by someone else between the review and «Importar»
    refuses the whole import. Nothing is written.
- **Writer:** `writeWorkbook` takes an optional `head`, the index of the
  header row. Rows above it are bold, unwrapped notes, and the panes
  freeze below it. 7.2 uses it for the passwords file. Without `head` the
  output is unchanged, except for one more style in `styles.xml`.
- **Checked in headless Chrome** as `junta`. The review requests were let
  through, since they write nothing. «Importar» was answered by a fake, so
  the local areas are untouched. Checked:
  - nothing chosen;
  - a duplicate shown as a row error, then «Volver»;
  - an .xlsx with an existing name in capitals matched, a pasted text
    ignored, and the note saying so;
  - the result screen;
  - the list at phone width.
- Spec sections affected: none (built as §4 says).

## 2026-11-20 — Brand files: the owner's favicons

- **Where they went:**
  - The PNGs from `favicomatic (1)/` went into `public/app-icon/`, next to
    the install icons, under their own names.
  - `favicon.ico` went to `public/` root, because browsers ask for
    `/favicon.ico` without being told.
  - `loading_isotype.svg` stays at the root next to the logotype. It went
    in with the splash, which uses it.
- **The tags:** those in `code.txt`, with paths made absolute
  (`/app-icon/…`).
  - Every page gets them from `src/layout.tsx`, and «Sin conexión»
    (`public/offline.html`) repeats them. A test checks that both list the
    same files and that every file exists.
  - `application-name` keeps the non-breaking space `code.txt` gives it.
- **Removed:**
  - the SVG favicon link and the provisional `apple-touch-icon.png`, so no
    browser prefers them over the real ones;
  - the empty folder, `code.txt`, and a stray `public/.DS_Store`. The
    `.DS_Store` was never in the repo: `.gitignore` already covers it.
- **Kept provisional:** the manifest's install icons (SVG, 192, 512,
  maskable). The owner's set has no 192, 512 or maskable size.
- **Service worker:**
  - Its list gained `/loading_isotype.svg` and `/js/splash.js` with the
    splash (shell version 3).
  - The favicons stay out of it, as the install icons did (DECISIONS
    2026-11-19): the browser keeps icons itself.
- Spec sections affected: none.

## 2026-11-20 — Splash (SPEC §9, Visual style)

- **When:**
  - ~~**Opening the app** is the first page of the tab (a `sessionStorage`
    mark), and shows the logotype.~~ Superseded 2026-11-20 («Splash: the logotype is held»): every page loaded
    from the server shows it.
  - **A move between sections** is a click on a link of the app, or a form
    submitted, that nothing else prevented. It shows the isotype.
  - **No move:** links with `download`, a `target`, a modifier key, another
    site, a jump inside the same page; the tour and the editor, which never
    leave the page; and a page the browser restores on «Atrás» (bfcache).
- ~~**The cap lives in CSS.** From the first paint, an animation fades the
  veil out by `--splash-start-max` or `--splash-section-max`, so the cap
  holds even when `splash.js` is slow or fails. The script only lifts the
  veil sooner, at the page's `load`.~~ Superseded 2026-11-20 («Splash: the
  logotype is held», then «Splash: the isotype is held too»): neither mark
  has a cap any more; both are held.
- **A move spans two pages.**
  - The isotype fades in over the page that was clicked.
  - The next page shows it already up, before its first paint, through an
    inline script in the `<head>`. That page does not fade it in again.
  - The next page counts the ~~cap~~ hold (Superseded 2026-11-20 («Splash: the isotype is held too»)) from the click, not from its own start:
    `--splash-elapsed`, the time since the click, which the head script
    reads from `sessionStorage`.
  - ~~If the new page takes longer than the cap, it arrives with no veil.~~
    Superseded 2026-11-20 («Splash: the isotype is held too»): the isotype stays on the clicked page until the new one
    arrives.
- **Reduced motion:** no fade and no scale; the veil is shown and hidden
  outright, with the same ~~caps~~ holds (Superseded 2026-11-20 («Splash: the isotype is held too»)).
- ~~**Without `sessionStorage`** (blocked storage) there is no splash at all.
  Pages work the same.~~ Superseded 2026-11-20 («Splash: the logotype is held»): without it there is no move
  between sections to carry, so every page shows the logotype.
- **Checked in headless Chrome** (dev server, `junta`, every write but the
  login refused, the service worker bypassed so responses could be held):
  - **Opening with the load held 3 s:** the veil is hidden at 1.5 s, and
    cleared at `load`.
  - **A move whose page answers in 2.5 s:** on the clicked page the isotype
    fades in, starts leaving at 0.74 s, and is gone at 1.0 s. The new page
    arrives without a veil.
  - **A page answering in 400 ms:** the veil carries over at full opacity
    and fades as soon as the page loads.
  - **«Atrás»:** no veil. A jump inside the page and a cancelled click
    start none.
  - **Reduced motion:** the veil appears and goes with no fade.
- Spec sections affected: none (built as §9 says).

## 2026-11-20 — Password is the only way in (SPEC §4)

- **Decision:** following the owner's SPEC §4 change, Microsoft sign-in and
  codes by email are gone, not deferred. No code existed for either; what
  remained were two comments (`src/password.ts`, `src/session.ts`), a test
  account named `sso` (`test/auth.test.ts`, now `sin-clave`), and two
  passages here, struck through rather than deleted (2026-11-16 «Login and sessions (phase 4.1)» and «Phase 4 plan: accounts»).
- **Kept:** an empty or foreign `password_hash` matches no password. It no
  longer serves password-less accounts, but it still keeps a row without a
  real hash from opening a session.
- Spec sections affected: 4.

## 2026-11-20 — PBKDF2 iterations lowered to 10,000 (a concession to Workers Free)

- **Decision (the owner's):** new password hashes use 10,000 PBKDF2-SHA256
  iterations instead of 100,000, so the account stays on Workers Free.
- **This is a concession, not an improvement.** Each guess against a stolen
  hash costs an attacker ten times less than before. 100,000 was already
  the most Workers accepts.
- **Why 10,000:** it is the highest count measured on the deployed Worker
  whose `POST /login` median CPU stays under 7 ms with margin: 4–5 ms in two
  runs of 25. 12,000 and 15,000 both had a median of 7 ms, and 100,000 had
  23 ms. DEPLOY §5 has the figures.
- **What compensates:**
  - there is no open sign-up (SPEC §4), and only the Board creates
    accounts;
  - there are about 50 accounts;
  - the login waits one second after every failed attempt.
- **Stored hashes keep their count.** `verifyPassword` accepts any count up
  to 100,000 (`MAX_ITERATIONS`). Before this change the ceiling was the
  count for new hashes, so lowering it alone would have locked out every
  existing account, `admin` on the remote D1 included. A hash gets the new
  count only when its password changes.
- **Side effect while old hashes remain:** a failed login against an
  account still at 100,000 takes about 20 ms more than one against an
  unknown username, out of the one-second wait. Resetting the password
  removes the difference.
- **Revert it** if the account moves to Workers Paid (DEPLOY §5).
- Spec sections affected: none (SPEC §9 asks for Web Crypto, not a count).

## 2026-11-19 — First deployment (owner-authorised)

- **The owner authorised it** and asked for DEPLOY.md step by step.
- **Remote D1:** `flowhow-test` (`2fd74d7a-…`, region ENAM). All eight
  migrations applied remotely.
- **The Worker:** `flowhow-test`, deployed at
  `https://flowhow-test.software-jpmb.workers.dev`.
- **Not done, as the owner said:**
  - `db:load` was not run remotely.
  - `DEV_PASSWORD` was not uploaded. The Worker reads no secret.
  - No user was created: the first Board user's password is the owner's
    to type (`user:create --remote`).
- **Local database kept** with `"preview_database_id": "DB"`. Adding the
  `database_id` moved wrangler's local key, and every local command opened
  a new, empty database; the owner's data was still on disk under the old
  key. `DB` is that key. Two empty databases my checks had created under
  the new keys were removed. Recorded in DEPLOY §1.
- **Nothing depends on someone being there** (DEPLOY §6): `d1 migrations
  apply --remote` and `deploy` asked nothing without a terminal. The D1 is
  created once, like the first Board user.
- **Smoke check without a user:** the root shows the login, and a wrong
  password gets «Usuario o contraseña incorrectos.» (401, after the
  one-second wait).
- **`POST /login` CPU:** 21–34 ms over four failed attempts, outcome `ok`.
  That is above the Free plan's nominal 10 ms. Workers Paid or fewer
  iterations is the owner's call (DEPLOY §5).
- Reason: owner's instruction; DEPLOY §1–§5.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.23: the reader opens each sibling of a parallel decision

- Decision (SPEC §7, owner's change):
  - **Engine** (`core.js`):
    - **«Siguiente» waits:** on the step of a parallel decision being read,
      `next()` no longer carries the tour into the next sibling. While
      sibling steps are still to open it returns `{ needSibling: true }`
      and does not move.
    - **New methods:**
      - `siblings()` gives the decision and the exits still to open.
      - `openSibling(k)` opens one, from the step being read. It goes
        back to the decision on the path and enters that sibling.
    - **Notes:** each sibling says which it is. The first now does too:
      «Una manera: «X» (1 de 3)», then «Otra manera: … (2 de 3)».
    - **When all are opened,** «Siguiente» goes to the meeting point
      once.
    - **Unchanged:**
      - Branches that go straight to the meeting point have no step to
        open. They are taken on entering it, as before.
      - Twins (P34) have no sibling steps, so nothing changes for them.
  - **A branch straight to the meeting point waits** (Instalaciones P11):
    picking «Sí» (straight to P12) while «No»'s step P14 is still
    unopened is held as in 6.18: nothing sent, and the tooltip names
    «No».
    - Before, picking «Sí» walked «No» by itself, which is the
      carrying-along the SPEC now rules out.
    - Once P14 is opened, «Siguiente» goes to P12 and takes «Sí» along
      («La opción «Sí» lleva directo a este paso.»).
  - **Log:**
    - Opening a sibling is a `choose` row at the step being read, with
      the decision's exit index. No schema or route change.
    - Replay reads a row at a sibling with siblings left as an opening,
      since «Siguiente» cannot move there.
    - The server refuses `next` there.
    - Runs logged under the old rule, where «Siguiente» carried the tour
      from one sibling to the next, no longer replay. They restart with
      the «Las reglas del recorrido cambiaron…» notice, as in earlier
      slices. The `empleado`'s open run 11 is one of them: it stops at
      Apertura P8. I left its data alone.
  - **Viewer:**
    - On a sibling step with others to open, those siblings are the
      diagram's targets. They carry the decision's edges and labels, so
      hovering lights them as in 6.20.
    - «Siguiente» is disabled. The panel says «Abre en el diagrama las
      otras maneras para seguir» and lists each sibling as «Falta» or
      «Ya vista». On a phone the list is hidden, as on a decision (6.22).
    - The frame (6.21/6.22) takes the decision as the step behind and the
      siblings as the way on.
    - An arrow for a sibling left out follows the decision's edge.
  - **Off-frame arrows, all slices:**
    - They stay whole inside the part of the card on screen.
    - They never cover the step being read: they move above it, or else
      below it.
    - Seen on a phone at P26, where only the current step fits.
  - **Tests:**
    - `core.test.js`: the P26 and P11 cases rewritten for the new rule,
      and «Anterior» opens nothing.
    - The walkers (`run`, the random graphs, `nextAction`) open siblings
      and skip held branches.
    - `tour.test.ts`: P26 through the server, covering the refused
      `next`, the logged openings, the replay and one P30.
  - **Checked in Chrome** (start and steps answered in the browser,
    nothing written):
    - Apertura P7: P9 then P8, the latter with Enter, then «Siguiente»
      to P10.
    - Apertura P26: P28, P29, P27 (1, 2 and 3 of 3), then P30.
    - Instalaciones P11: «Sí» held, «No», then P12.
    - The same at 390×844.
- Reason: SPEC §7 (owner's change), slice 6.23.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.22: a legible frame, and no branch list on a phone

- Decision (SPEC §7 Layout, owner's change):
  - **Phone:** at the phone breakpoint (760px), the panel of a decision
    hides the branch list and «Puedes repetir una rama ya recorrida».
    «Elige la rama en el diagrama» stays: it says where the choice is.
    The skip button («Ir a lo que falta por visitar») stays, as it is not
    a branch.
  - **Minimum legible zoom:** step titles are drawn at `--text-sm`. The
    frame never shows them smaller than `--text-xs`, so the minimum is
    `--text-xs / --text-sm` (0.86 today), read from `theme.css` at run
    time.
  - **What goes in the frame:** the current step always. Then, while
    the frame stays at or above that zoom, in this order:
    1. the way on (the decision's branches, or the next step), nearest
       first;
    2. one step behind;
    3. the step after;
    4. a second step behind.

    Whatever does not fit is left out. If only the current step fits and
    it is still too wide, the diagram keeps the legible size and the card
    scrolls sideways.
  - **Arrows:** each step of the way on that is left out gets an arrow
    at the frame's edge.
    - It sits where the branch's own edge leaves the frame, turned the
      way the edge runs. When the edge has no points, it follows the
      straight line to the step.
    - On a decision the arrow is a button: it carries the branch's
      label, has the branch target's name, and taking it is the same as
      clicking the target (held branches included; their tooltip goes
      above the arrow).
    - The target itself, out of sight, leaves the tab order. Focus goes
      to the first open target in the frame, else to an arrow.
    - Elsewhere the arrow only shows where the flow goes.
    - The view follows by itself: taking the branch makes its step the
      current one, which the next frame is built around.
  - ~~**Seen, not changed:** on a phone at Apertura P6, «Instalaciones»
    sits partly under the decision. It falls half inside the frame while
    its arrow marks it as out. It can still be clicked.~~ Superseded by
    the owner the same day: a target is in the frame or out of it.
    - A step left out is not drawn (`.node.out-of-frame`, hidden), so it
      cannot show half.
    - The edge to it loses its head, also when its arrow is hovered, and
      ends where it leaves the frame by the arrow.
    - A resize frames again without redrawing, so each frame first undoes
      the previous cuts.
    - Checked on a phone at Apertura P6: P13 hidden, one edge cut, no
      head, and «Interna» marked by its arrow.
  - **Checked in Chrome** (start and steps answered in the browser):
    - Instalaciones P9: scale 1.15 on a laptop and 1.00 on a phone (it
      was well below before), with the «Sí» arrow on its line. Clicking
      it held and sent nothing. After «No» and back at P9, the arrow took
      «Sí» and the view moved to «Confirmar la fecha…».
    - Apertura P6 on a phone: 0.88 with an «Interna» arrow, and no
      branch list.
    - «Ver todo» removes the arrows and «Acercar» brings them back.
  - Runs 9 to 11 and visits from 187 on were added while I was working.
    They belong to the `empleado` account at a person's pace, and I left
    them alone.
- Reason: SPEC §7 Layout (owner's change), slice 6.22.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.20: the branch is chosen on the diagram

- Decision (plan_iteration_7, as proposed, with the owner's answers):
  - **Targets:** while the step in view is a decision (the current one, or
    one left behind and reached with «Anterior»), each step a branch
    leads to is a target.
    - It is a button inside the SVG (`role="button"`, `tabindex="0"`,
      `data-branch`), named «Rama «Externa»: ¿El proveedor es la
      litografía?», with «, ya recorrida» once walked.
    - At rest, an open target has the flow's tint and strong outline. A
      walked one keeps its plain look.
    - The diagram is `role="group"` while it has targets.
    - Twins (Apertura P34) share one target. It takes the first branch
      still to take and is named «Rama «Sí» o «No»: …» (owner: the
      decision is parallel, so either does the same).
  - **Lighting:** hovering a target or giving it keyboard focus lights
    the decision's edge to it, its arrow and its label.
    - The edges and labels carry `data-branch-to`. The arrow swaps
      through `data-arrow-rest` and `data-arrow-lit`, because CSS cannot
      restyle a marker per use.
  - **Taking a branch:** a click, Enter or Space takes it. The action,
    the log and the server's check are unchanged.
    - A held branch (6.18) sends nothing, and its note shows as a tooltip
      below the target. Below, because the decision's own tooltip is
      above, and the branch's edge and label are between them.
    - On a target that is also a link step, the link's tooltip goes below
      for the same reason.
  - **Focus:** arriving at a decision puts focus on the first open
    target. The focus chain now skips disabled controls; before, a
    disabled «Siguiente» stopped it and nothing was focused.
  - **The side panel** keeps the step's content and lists each branch
    under «Elige la rama en el diagrama»: label · step, and «Falta» or
    «Ya recorrida». It is a list, not buttons. «Ir a lo que falta por
    visitar» stays a button there, because it is not a branch.
  - **Tests:** a `diagram.test.js` case checks:
    - targets with their names and branches;
    - lightable edges and labels only for the decision in view;
    - one target for twins;
    - no targets without branches.
  - **Checked in Chrome** (start and steps answered in the browser,
    nothing written; run 5 still has no rows):
    - Apertura P6: focus on P7. Hovering P13 lit its edge, arrow and
      «Interna». Tab to P13 and Enter went into Instalaciones. Walking
      on by clicking targets reached P14.
    - Instalaciones P9: a real click on «Sí»'s target sent nothing and
      showed the held tooltip below it.
    - The same at 390×844, once the diagram is scrolled into view.
  - **Seen, not changed:** (both fixed the same day by 6.22)
    - On a phone the diagram sits below the step panel (§9), so the
      targets need a scroll first.
    - At Instalaciones P9 the «Sí» branch runs far down. The 6.21 frame
      takes in the whole branch, so the zoom there is small.
- Reason: SPEC §7 (owner's change); plan_iteration_7, slice 6.20.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.21: the tour zoom on by default, two steps behind and two ahead

- Decision:
  - **On by default on every screen** (owner's change to SPEC §9 Layout).
    «Ver todo» still switches to the whole diagram for the rest of the
    visit, as in 6.8.
  - **The frame:**
    - **Behind:** up to two steps the user walked into the current one
      along the flow's edges. A step the tour jumped or was sent back
      from is not behind, because it is elsewhere on the map. Following
      the trail blindly would stretch the frame across the diagram after
      every return.
    - **Ahead:** on a decision, its branches. Otherwise the next step and
      the one after it, which are the branches when the next step is a
      decision.
  - **The frame fits the card's part on screen, not the card's full
    height** (76vh). On a laptop the card starts about 300 px down, so
    the old frame put a decision's branches below the window. It is
    never less than half the card, so a card that starts low still gets a
    usable frame.
  - **Phone:** §9 puts the step panel above the diagram, so the zoomed
    frame is below the fold there. This does not change in 6.21. The
    owner is told, because 6.20 moves the choice onto the diagram.
  - **Checked in Chrome** on Apertura, at 1280×800 and 390×844, with the
    start and steps answered in the browser:
    - zoom on at the start;
    - at P5, P3 to P7 framed;
    - at P6, P4 and P5 behind, and P7 and P13 (its branches) on screen,
      above the buttons;
    - «Ver todo» shows the whole diagram.
- Reason: SPEC §9 (owner's change); plan_iteration_7, slice 6.21.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.19: the return tooltip at any decision with branches left

- Decision:
  - **When** (owner's change to SPEC §7): the tour stands on a decision
    (the last trail entry, not one viewed again with «Anterior») that is
    not parallel, has at least one branch taken and some left. How it got
    there makes no difference: a dead end, a held meeting point, «Ir a lo
    que falta por visitar», or a loop the flow draws (Apertura P31's
    «No»).
    - 6.17 asked for the engine's `returned` note, which a loop the flow
      draws never sets.
  - The condition is `Tour.branchesLeft()` in `core.js`. It gives the exit
    indices left, or []. The viewer names those branches and makes room
    for the tooltip in the zoomed frame, as before.
  - The side panel explains a return only when the tour sent the user back.
    After a loop the flow draws there is nothing to explain there; the
    tooltip names what is left.
  - **Tests:** a `core.test.js` case covers:
    - the example's P3, with the same shape as P31, after its loop: no
      note, and the tooltip on;
    - viewing it again with «Anterior»: off;
    - a dead end;
    - all branches walked: off;
    - a parallel decision: never.
  - **Checked in Chrome** on Apertura P31. The tour start and every step
    were answered in the browser, so nothing was written. Nothing showed
    at P31 the first time. After «No», P32 and back to P31, the tooltip
    read «Falta la rama «Sí». Elígela para seguir.», with no note in the
    panel. It was gone after «Sí».
  - Runs 9 and 10 (`empleado`, Apertura, 21:12 to 21:15 UTC) are the
    owner's: run 8 closed under 6.18's rules and was restarted.
- Reason: SPEC §7 (owner's change); slice 6.19.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.18: a branch back to its own decision is a retry; a held branch is not taken

- Decision:
  - **The owner's report:** Apertura P31 «¿El cliente pagó?», «Sí»
    chosen on a fresh tour. The tour stayed at the decision, marked «Sí»
    «Ya recorrida» and showed the return tooltip.
    - Diagnosis: P31 was not parallel. Under phase 3.5's hold, «Sí» (straight
      to P33) waited for «No», whose road to P33 goes back through P31 itself.
    - The owner chose A + C and changed SPEC §7.
  - **A. Retries** (`core.js`, `_meetingPoints`):
    - A branch counts as a retry when its own decision post-dominates it,
      that is, when every path from it leads back there (SPEC: «leads back
      to its own decision»). `Tour.retry` keeps it per decision.
    - A retry meets nothing (`meet` null) and holds no branch back.
      Apertura P31 and the example's P3 (`No → Comprar material → Revisar
      inventario`) now have no meeting point: «Sí» goes on at once. «No» is
      walked when the tour comes back to the decision after a dead end, as
      for branches that never meet.
    - **Parallel, without the retries:** a decision is parallel when its
      branches that are not retries, two or more, all reach the same
      meeting point in one step or none. Without this, twin branches next
      to a retry each waited for the other, a deadlock found by the random
      graphs. It follows SPEC's «does not count as one of the branches
      that meet». In the reference flows nothing changes: no parallel
      decision has a retry.
    - The owner approved this rule and the retry definition the same day,
      and wrote both into SPEC §7. They are no longer a decision beyond
      the SPEC.
  - **C. A held branch is not taken** (P9 and P17, where waiting makes
    sense):
    - `Tour.holdsBack(i)` gives the branches to walk before branch i can
      be entered. Those are the pending branches of the same decision with
      steps of their own to its meeting point, or null.
    - When a branch is held, `choose()` returns `{ moved: false, held }`
      and changes nothing. The branch is not «Ya recorrida», nothing is
      visited, and the server refuses it and logs nothing.
    - The viewer asks before sending. It sends nothing, and ~~below that
      branch~~ (superseded the same day by 6.20: in a tooltip below that
      branch's target on the diagram), with `role="status"`, it writes «Sí»
      lleva directo a «Confirmar la fecha de instalación programada», donde
      se une con «No». Recorre primero «No».
      - A branch without a label is named by its step's title.
      - Several branches are listed with «y».
      - Focus stays on the branch. The note goes with the next action.
      - There is no return tooltip: the tour never left the decision.
  - **Never staying put** (SPEC: «The tour never answers a choice by
    doing nothing»):
    - Only branches with steps are waited for. A direct branch whose other
      pending branches are direct too enters the meeting point and takes
      them along, with the twins' note («La opción … lleva directo a este
      paso.»), even when the decision is not parallel.
    - A hold that belongs to an outer decision goes back to that decision,
      with «Esta rama sigue en…».
    - The `direct` note and its text («Esta opción va directo a…, Antes de
      seguir, mira las otras.») are gone.
  - **Tests:**
    - `core.test.js` rewrites four cases of the old rule: «Sí first»,
      «meeting points», «a branch straight to the meeting point» and
      «Instalaciones P17».
    - The random walkers check that a held choice changes nothing and
      names branches that can be walked, that no `direct` return ever
      happens, and that held choices did occur.
    - `tour.test.ts` walks the three decisions of the reference flows
      through the server: Apertura P31, Instalaciones P9 and P17.
  - **The owner's runs:** under the new rule two open runs no longer
    replay, because they contain the old bounce (a row of a held branch
    followed by choosing again):
    - run 8 (`empleado`, Apertura), the very run of the report;
    - run 2 (`junta`, «Flujo de prueba fase 5», P2 «¿Hay plata?», also a
      retry).
    When opened, they close and start clean with «Las reglas del recorrido
    cambiaron…», as in 6.11. They were not touched.
  - **Checked in Chrome:** as junta on Instalaciones, with the step
    requests answered in the browser (run 5 still has no rows). At P9,
    «Sí» sent nothing, stayed unmarked, showed the note below it with
    focus on it, and no tooltip. «No» then walked on and the note was
    gone.
- Reason: SPEC §7 (owner's change); slice 6.18.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.17: the return notice is a tooltip on the decision

- Decision:
  - **Owner's change to SPEC §7:** when the tour goes back to a decision,
    the notice is a tooltip anchored to that decision's node, not 6.13's
    band. It stays until a branch is chosen and names the pending
    branches. The tooltip tokens are the owner's, in `theme.css`.
  - **One tooltip for the app** (`.tooltip` in `app.css`):
    - Dark with light text: `--color-tooltip-surface`,
      `--color-tooltip-text`, `--tooltip-radius`, `--tooltip-padding`,
      `--tooltip-max-width`, `--shadow-tooltip`, and an arrow of
      `--tooltip-arrow`.
    - It sits above the node, arrow down (owner's answer). Only when the
      diagram has no room above, it goes below, arrow up.
    - It lives inside the diagram's scroll box, so it scrolls with the
      diagram. `viewer.js` places it from the node's drawn position, so it
      follows the zoom and the window's size. Sideways it stays inside the
      diagram, and the arrow still points at the node.
  - **The return tooltip:**
    - Text, naming every pending branch (owner's answer):
      - one: «Falta la rama «Sí». Elígela para seguir.»
      - several: «Faltan las ramas «A» y «B». Elige una para seguir.»
      - A branch with no label is named by the title of the step it
        leads to.
    - It shows when the engine's note says `returned` and the decision
      still has untaken branches. It has `role="status"`, so it is
      announced.
    - The diagram scrolls so it is in view. When zoomed, the frame makes
      72 units of room above the decision.
    - The side panel still says why.
  - **The link tooltip** (6.15) moves to the same tooltip (owner's
    answer):
    - The renderer marks link steps with `data-tip` instead of the
      browser's `<title>`, so two tooltips never show at once.
    - It shows on pointer hover and on keyboard focus.
    - Its text is already in the step's accessible name: the link's,
      and now also the free review button's. So the tooltip is
      `aria-hidden`.
    - Every other step keeps its `<title>`, which still shows the full
      title of a label cut short.
  - **Checked in Chrome:**
    - As junta on Instalaciones: P5 «No» → P30 → back to P5. The tooltip
      «Falta la rama «Sí». Elígela para seguir.» sits centred above P5,
      dark with white text, inside the card. It stays in place zoomed,
      and is gone after «Sí».
      - The step requests were answered in the browser, so the owner's
        run 5 was not written to.
    - In Apertura's overview, hovering P13 shows «Lleva al flujo
      «Instalaciones»», with no native tooltip. It goes away on leaving.
  - **P13 report:** run 8 (`empleado`) went past P13 at 20:41 UTC and on
    to P23. Those visits are the owner's; the previous commit's test
    covers the case.
- Reason: SPEC §7 (owner's change and answers); slice 6.17.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.16: the report's filters apply as they change

- Decision:
  - **Live, from the server:** `public/js/report.js` listens for changes
    on the filter form. It asks the server for `/report` with the new
    address and swaps in three parts of the answer: the count, the
    results (table or «Ninguna fila cumple esos filtros.») and «Quitar
    filtros».
    - Nothing is filtered in the browser: the server still decides
      which rows a user may see (SPEC §4).
    - The address is updated with `history.replaceState`, so a reload
      or a shared link shows the same filters, and the sort headings
      come back with them.
    - The page does not reload, so the focus stays on the filter just
      changed. The count keeps its node (`role="status"`), so screen
      readers announce it.
    - A slower, older answer never overwrites a newer one.
    - If the request fails, the count says «No se pudo filtrar. Revisa
      tu conexión y vuelve a intentarlo.»
  - **Without JavaScript** (SPEC §9): «Filtrar» is inside `<noscript>`,
    so the form works as before.
  - `table-scroll.js` exports `watchTables` so a swapped-in table gets
    its edge shade. The other screens load it as before.
  - `report.js` joined the service worker's shell list.
  - **Checked in Chrome** (as junta, owner's local data):
    - «Revisado: No» and then «Flujo: Apertura de OT» left 3 of 11
      rows, with no reload (a marker on `window` survived). The focus
      stayed on each select, and the address and the sort links carried
      the filters.
    - «Quitar filtros» went back to 11.
    - With scripts disabled, the «Filtrar» button shows and filters.
- Reason: SPEC §9 (owner's change); plan_iteration_5, slice 6.16.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.15: link steps lead to the other flow from the overview

- Decision:
  - **The tooltip:** a link step's tooltip (its SVG `<title>`) is «Lleva
    al flujo «X»», with or without access, in the overview, the tour and
    the free review (owner's answer). The name comes from the page's
    `links` (6.4), which the server sends for every link.
  - **The link:** in the overview, with access, the step is a real SVG
    `<a href="/flows/X">`.
    - It leads to X's overview, not into its tour (owner's answer,
      SPEC §7).
    - It is reached with Tab, opened with Enter or a click, and shows the
      active step's shadow on keyboard focus, no ring.
    - Its accessible name is «Enlace: título. Lleva al flujo «X»».
  - **Where it is not a link:**
    - In the tour, the side panel's «Ir a «X»» (6.4) is the way, and it
      continues X's tour.
    - In the free review every step is already a button that selects
      it, and a link inside a button would be two controls in one.
  - **The renderer** takes a fourth argument, `links` (step id → name,
    and `href` when it may be opened). The diagram is `role="group"`
    whenever it holds links or buttons; otherwise it stays a picture.
  - **Checked in Chrome:**
    - Apertura de OT's overview, P13: tooltip «Lleva al flujo
      «Instalaciones»».
    - Clicking it opened `/flows/1` on its overview, with no tour.
    - With Tab the shadow shows, and Enter follows.
- Reason: SPEC §7 (owner's change and answer); plan_iteration_5, slice
  6.15.
- Spec sections affected: none.

## 2026-11-19 — Badges clear of the parallel connector

- Decision:
  - **Owner's decision after 6.14:** a badge never covers a parallel
    connector.
  - **The rule:** when the active step belongs to a parallel group (6.12),
    the sides where a connector leaves it are blocked. Badges on a blocked
    side are stacked above the connector line, their bottom 6 px clear of
    it, instead of centred across it. Badges on a free side do not move.
    - Apertura P8: «WP» (right, towards P9) goes up, «SAC» (left) stays.
    - P28 (between P27 and P29): both sides go up.
  - The canvas still grows to hold them (6.14).
  - **Checked in Chrome:** free review of Apertura de OT, P8 chosen: the
    P8↔P9 connector shows whole, «WP» above it.
- Reason: owner's decision; plan_iteration_5, between 6.14 and 6.15.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.14: «Convenciones» and badges inside the canvas

- Decision:
  - **«Convenciones»** (SPEC §7):
    - A band above the diagram in the tour and in the free review, where
      badges show. The overview has no badges, so it has no legend.
    - One swatch per category, drawn like its badge from the same theme
      tokens (`--color-cat-N`; slot 3 dashed), with the category's name.
    - Slots repeat from the fifth category on, as the badges do.
    - A flow without categories has no legend.
    - On a phone the band keeps the category names: they are the legend
      itself, not the panel's secondary information that §9 hides.
  - **Badges inside the canvas** (SPEC §7):
    - The renderer measures where the active step's badges reach. It
      widens the SVG's `viewBox`, and its size, to hold them with a 4 px
      margin, including towards negative coordinates.
    - Without badges, or with badges inside, the canvas is the layout's
      own size.
    - In the real flows this happens on Instalaciones P18, P19 and P20,
      whose «Responsable» badges went 16 px past the left edge.
  - **The viewer** now converts diagram coordinates to pixels through
    the SVG's `viewBox`, not the layout's width. Centring on the current
    step and bringing highlighted steps into view stay right when the
    canvas has grown.
  - ~~**Known overlap:** a badge drawn on the side of a parallel step covers
    the 6.12 connector while that step is the active one (Apertura P8's
    «WP» over P8↔P9). The connector shows again on the next step.~~
    Superseded by the owner, same day: see «Badges clear of the parallel
    connector».
  - **Checked in Chrome:** free review of Apertura de OT, legend
    «Responsable · Herramienta» above the diagram; P8 (leftmost column)
    chosen, its badges inside the canvas.
- Reason: SPEC §7 (owner's change); plan_iteration_5, slice 6.14.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.13: a notice on the diagram when the tour goes back to a decision

- Decision:
  - **When:** the tour went back to a decision, for any reason (owner's
    answer): a branch ended, a path looped without closing, a branch was
    held at a meeting point, or «Ir a lo que falta por visitar». That is
    every engine note with `returned`.
  - ~~**What:** a band across the top of the diagram card, under the
    progress bar: «Faltan ramas por recorrer en esta decisión. Elige una
    para seguir.»~~
    ~~- It has the alert icon and the yellow edge of every warning, and
      `role="status"`.~~
    Superseded by the owner, same day: see «Phase 6.17: the return notice
    is a tooltip on the decision».
    - The side panel keeps saying why («Esa rama terminó en …»).
  - **How long:** while that decision is the step in view and awaits a
    choice; choosing a branch removes it.
    - A reload or a return to the page shows it again: it comes from the
      engine's note, which the run's log replays.
    - Looking back with «Anterior» does not show it on steps left behind.
  - **Checked in Chrome** on Instalaciones: P5 «No» to P30, «Siguiente»
    back to P5, where the band shows. It survived a reload and went away
    on choosing «Sí».
  - **A slip of mine, undone:** the check continued an open run of the
    owner's on Instalaciones (run 5, started by the owner with no step
    yet), because «Iniciar» continues an open run. The six visits it added
    (88 to 93) were deleted; run 5 is as the owner left it. From now on
    browser checks look for the user's open runs first.
- Reason: SPEC §7 (owner's change); plan_iteration_5, slice 6.13.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.12: parallel branches drawn as parallel

- Decision:
  - **One condition:** `core.js` `parallelBranches(flow)` reads the
    tour's own `Tour.parallel` (6.11). The connector and the tour cannot
    drift.
  - **Which steps are joined:** the steps of a parallel decision's
    one-step branches. A branch straight to the meeting point has no step
    to join:
    - Apertura P34 (both straight there) draws nothing;
    - Instalaciones P11 (one straight, one step) draws nothing, since one
      step alone has nothing to be joined to.
    - Drawn: Apertura P8↔P9 and P27↔P28↔P29.
  - **The drawing:** `layoutFlow()` returns `parallel`, the groups left to
    right. The renderer joins each pair of neighbours with a straight line,
    side to side at the steps' height, 4 px clear of each, with an
    arrowhead at both ends.
    - It is drawn under the steps, with the title «Opciones alternativas».
  - **Everywhere the diagram is drawn:** overview, tour, free review and
    the editor's preview.
    - During the tour it takes the soft tone until both steps are seen,
      like the edges.
  - **Not handled:** two parallel steps that do not share a row. The
    layout always puts them on one row in the real flows. A pair whose
    sides overlap is skipped rather than drawn backwards.
  - **Checked in Chrome** on Apertura de OT: three connectors in the
    overview and in the editor's preview.
- Reason: SPEC §7, Layout (owner's change); plan_iteration_5, slice 6.12.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.11: the branch rule looks at the decision's shape

- Decision:
  - **The rule** (SPEC §7, owner's change): a decision is **parallel** when
    all of these hold:
    - every branch meets at the same step;
    - each branch is one step long (a step that is not a decision and leads
      only to the meeting point) or goes straight there.
  - **What the tour does:**
    - On a parallel decision it walks the branches one after another
      («2 de 3»), as before.
    - On any other decision with a meeting point it always goes back to
      the decision.
    - The order the user picks no longer changes anything.
  - **In the engine,** `Tour.parallel` (decision → meeting point) is
    computed once, from the meeting points and branch lengths the engine
    already had. `_hold` reads it instead of the branches still pending.
    Slice 6.12 draws the same map.
  - **In the real flows:**
    - Apertura P31, Instalaciones P9 and P17 (one branch straight there,
      one long) now go back whichever branch is picked first.
    - Apertura P7, P26, P34 and Instalaciones P11 stay parallel.
  - **Tests:**
    - Three cases that pinned the order-dependent behaviour were rewritten
      (see the header of `test/core.test.js`).
    - New random test: 2000 graphs biased towards one-step branches,
      walked in random orders with rewinds. Every «walked together» note
      must come from a parallel decision, and no return at a meeting point
      may come from one. Both cases occur over a hundred times each.
  - **Tours already open:** the server replays each run's log under the
    current rules. A run that no longer replays restarts, with the notice
    that already exists for it («Las reglas del recorrido cambiaron…»).
    No migration.
- Reason: owner's change to SPEC §7 (`63e82bc`, `df6620b`);
  plan_iteration_5, slice 6.11.
- Spec sections affected: none (the owner wrote them).

## 2026-11-19 — Provisional app icon

- Decision:
  - **Owner's decision:** a provisional icon until the final one comes
    with the interface design.
  - **The icon:** the monkey mark of `flowhow_logotype.svg`, its shapes
    and colours unchanged, centred on white.
    - `public/app-icon/icon.svg` keeps a 10 % margin.
    - `maskable.svg` keeps the mark inside the central 80 % circle
      Android leaves visible.
    - The PNGs (192, 512, maskable 512 and the 180 px
      `apple-touch-icon`) were drawn from those SVGs by Chrome.
  - **Where it lives:** in `public/app-icon/`, apart from the owner's
    `icons/`, which stays untouched. The final icon replaces these files
    under the same names, and nothing else changes.
  - **Wiring:**
    - The manifest lists the SVG, both PNG sizes and the maskable one.
    - ~~Every page, and the «Sin conexión» page, links the SVG as its
      favicon and the `apple-touch-icon`.~~ Superseded 2026-11-20 (Brand
      files): the pages link the owner's favicons; the provisional
      `apple-touch-icon.png` was removed. The manifest's install icons are
      still these.
    - These files are not in the service worker's shell: the browser
      keeps installed icons itself.
  - **Checked in Chrome:** `Page.getAppManifest` and
    `Page.getInstallabilityErrors` report no errors.
- Reason: owner's decision after slice 6.10.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.10: PWA

- Decision:
  - **Manifest** (`public/manifest.webmanifest`):
    - Name «FlowHow», `es-CO`, standalone, opens on `/home`.
    - Background and theme colours are the theme's `--color-bg` and
      `--color-primary`, written as values: a manifest cannot read CSS
      tokens. The page's `theme-color` meta repeats the primary colour.
    - ~~**No icons yet.** The only brand asset is the horizontal logotype,
      and an app icon is the owner's to supply (see below). Until then
      browsers do not offer to install the app; everything else works.~~
      Superseded by the owner, same day: see «Provisional app icon».
  - **Service worker** (`public/sw.js`), registered on every page by
    `js/sw-register.js`.
    - It does no drawing; SPEC §9's "three screens run JavaScript of
      their own" is about screens, and this registration draws nothing.
    - **The shell:** styles, the iBrand font, logo, icons, every browser
      module and the «Sin conexión» page. `test/pwa.test.ts` checks the
      list against `public/`, so a new module cannot be forgotten.
    - **Pages are never cached.** They carry the user's flows, progress
      and session (SPEC: "no offline data"). Without a network, a page
      request gets the «Sin conexión» page, which says nothing about the
      user.
    - Forms, the tour's JSON and other sites (Google Fonts) are left
      alone.
    - **Shell files are fetched network-first,** with the cache as the
      fallback. They are not fingerprinted, and a stale `core.js` against
      a newer server would break the tour. So the cache makes the shell
      available offline; it does not make pages faster.
    - The cache is named by a `VERSION` constant. Bumping it drops the old
      cache.
    - The assets serve `offline.html` at `/offline` and redirect the
      `.html` address. A redirected response cannot answer a navigation,
      so the worker caches `/offline`.
  - **Checked in Chrome:**
    - The worker activates and caches 27 files, no page among them.
    - With the network cut for the page and for the worker, `/report`
      showed «Sin conexión», styled and with the logo. Back online, the
      report again.
- Reason: phase 6 plan (plan_iteration_3), slice 6.10; SPEC §9,
  Architecture.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.9: the progress report

- Decision:
  - **Owner's answers to the gaps in SPEC §7, Progress report:**
    1. **Rows:** Empleados and Leaders, the people who get certified. A
       Leader has a row for every published flow (§4); an Empleado for
       the published flows of their areas. The Board is never a row, since
       it is not certified.
    2. **Scope:** the Board sees every row. A Leader sees the rows of the
       people who share at least one area with them, other Leaders and
       themselves included (§4, §9).
    3. **Área column:** all of the person's areas, in every row. The area
       filter finds a row by any of them.
    4. **Status filter:** «Revisado sí / no» from stage 1. The certified
       filter joins it in stage 2.
    5. **Deactivated accounts** are not in the report.
    6. **A Leader without areas** shares one with nobody. The page says
       why it is empty instead of showing an empty table.
       - The user screens warn when a Leader is saved without areas,
         without blocking: SPEC §4 allows it.
  - **Built:**
    - `GET /report`, a new access kind `report` (Board and Leaders, by
      role: SPEC gives the report to roles, not to a permission).
      Anyone else gets 403. «Reporte» is in their menu.
    - Columns: Nombre, Área, Flujo, Versión, Revisado, Tiempo de revisión.
      No score or certified columns until stage 2.
    - **Revisado** follows the home screen's rule: a review of a release
      with the latest's major version.
      - «Sí · date», with «en la versión x.y» when that was not the latest.
      - «No», with «revisó la versión x.y» when a major release asks for a
        new review.
      - The review counted is the first one of the newest release
        reviewed, as on the home screen.
    - **Tiempo de revisión:** that review's duration («12 min 34 s»,
      «1 h 1 min»); «—» when not reviewed.
    - **Filters and order** live in the address (`area`, `flujo`,
      `revisado`, `orden`, `dir`). They can be bookmarked and need no
      JavaScript; anything not understood is ignored.
      - Each sortable heading is a link with `aria-sort`, and it keeps the
        filters.
      - Empty values sort last in either direction; ties go by name, then
        flow.
      - The area and flow filters list only what appears in the
        viewer's own report.
- Reason: phase 6 plan (plan_iteration_3), slice 6.9; SPEC §4, §7, §9;
  owner's answers.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.8: phone layout and tour zoom

- Decision:
  - **Phone layout (≤ 760 px, the prototype's breakpoint):**
    - The step panel already went above the diagram (phase 3). Now it
      takes its minimal form: type, title, description, the tag values
      as chips without their category names, and the branch choices.
    - The "next step" hint («Sigue con» / «Salidas») goes.
    - A link's «Flujo» and «Contacto» keep their names: they are not tag
      categories, and without them the two values would be unlabelled.
    - The action buttons stay in the diagram card's bottom right corner,
      side by side. The overview and the free review keep the same order.
  - **Tour zoom, on every screen:**
    - «Acercar» / «Ver todo» sits in the progress bar, with the zoom icon
      in the text colour (a mask, like the close icon) and `aria-pressed`.
    - Zoomed frames the current step with the step the user came from and
      the next step or branches. When the current step has tags, the
      frame leaves room beside it for their badges.
    - The frame is enlarged to the card's width, up to twice its size,
      and never taller than the room the card gives the diagram. On a
      phone it is shrunk to fit instead.
    - Zoomed is the default on a phone and «Ver todo» elsewhere. The
      choice holds while the page is open and is not saved. A resized
      window reframes it.
    - Only the tour zooms. The overview and the free review show the
      whole diagram, as SPEC §9 asks.
  - **Checked in Chrome:**
    - At 1280 px, zoomed on P6: the frame was enlarged 1.5 times.
    - At 390 px the tour opened zoomed; P14's badges fit, with no
      sideways page scroll.
    - The test runs were removed from the local database afterwards.
- Reason: phase 6 plan (plan_iteration_3), slice 6.8; SPEC §9, Layout.
- Spec sections affected: none.

## 2026-11-19 — Flow selector: the keyboard waits for Enter

- Decision:
  - **Mouse or touch:** choosing a flow opens it at once.
  - **Keyboard:** the arrows only move the choice, even where they change
    a closed select (Windows). The flow opens on Enter, or when the select
    loses focus with another flow chosen. Tabbing through without changing
    it opens nothing.
  - No «Abrir» button.
  - The last input decides: a key press marks the select as keyboard-driven
    until the next pointer press on it.
  - Checked in Chrome: an arrow left the page in place, then Enter opened
    the flow; an arrow and Tab opened it; a mouse choice opened it at
    once; tabbing through stayed.
- Reason: owner's decision after reviewing slice 6.7.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.7: the flow selector in the viewer

- Decision:
  - **Who sees it** (SPEC §7, Flow selector): the Board and Leaders,
    always, even with a single flow to show. A Standard user sees it only
    with more than one flow.
  - **What it lists:** the flows this user may open, the same list as the
    home screen (`visibleFlows`): published, by name, the current one
    chosen. Subflows are out of stage 1, so none can appear.
  - **Where:** a «Flujo» select above the flow's title, as in the
    prototype.
  - ~~**How it opens a flow:** choosing one opens its viewer at once.~~
    Superseded by the owner, same day: see «Flow selector: the keyboard
    waits for Enter». A tour open on the flow left behind stays open, as
    when following a link.
    - With no JavaScript the select does nothing; the viewer needs it
      anyway.
- Reason: phase 6 plan (plan_iteration_3), slice 6.7; SPEC §7.
- Spec sections affected: none.

## 2026-11-19 — Free review: the view goes to the highlighted steps

- Decision:
  - **Pressing a value** moves the diagram to the steps that carry it.
    - When they all fit, their span is centred.
    - When they do not, the first one goes near the top and the rest
      follow below.
  - **Anything else** (choosing a step, changing the category) leaves the
    view where the user left it. Before this, every redraw of the review
    sent the diagram back to the top: a fault of 6.6, fixed here.
  - Checked in Chrome on Instalaciones: Admin and Almacén (one step each)
    centred; SAC (thirteen steps) starts at P4; choosing a step kept the
    view.
- Reason: owner's decision after reviewing slice 6.6.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.6: free review in the viewer

- Decision:
  - **Where it opens:**
    - Once the flow is reviewed, the overview offers «Repaso libre» beside
      the tour's buttons. Before that the button is in the page, hidden,
      like «Empezar de nuevo».
    - Finishing the tour opens the free review straight away, with the
      «Flujo revisado.» note, as the prototype does.
    - «Ver el panorama» goes back to the overview.
  - **What it shows:** the whole diagram of the page's release (the
    latest), as the overview does. Nothing of it reaches the server.
    - Every step is a button (focusable, Enter or Space, `aria-pressed`).
      The diagram becomes `role="group"`, since buttons inside
      `role="img"` would be hidden from assistive technology.
    - The chosen step carries the active step's shadow and its badges
      (SPEC §7, §9). The side panel shows its details, the same as in the
      tour. On a link step it adds the 6.4 panel: Flujo, Contacto and
      «Ir a «X»».
  - **«Resaltar por»:** a category select, then one chip per value it
    takes in this flow (sorted, es-CO). The steps carrying the pressed
    value are filled with the flow colour, as the tour's current step is,
    and the rest are dimmed. Pressing the chip again clears it.
    - A flow without categories shows no select.
    - ~~The view does not scroll to the highlighted steps.~~ Superseded
      by the owner, same day: see «Free review: the view goes to the
      highlighted steps».
  - **Not here:** «Abrir subflujo» (SPEC §7). Subflows are out of stage 1
    (PLAN.md).
- Reason: phase 6 plan (plan_iteration_3), slice 6.6; SPEC §7, §9.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.5: the home screen says where an open tour was left

- Decision:
  - **The line:** a flow's card says «Quedaste en «título».» under its
    status line whenever the user has a tour open on it. That includes a
    repeat of a flow already reviewed and a tour left by following a link
    (SPEC §7).
  - **What it names:** the step's title, not its ID. People know a step
    by its title; IDs are the editor's.
  - **How it is read:** the step is the one the run's log replays to
    (`openRunStep`, the server's own `replay`), on the run's own release,
    which may be older than the latest.
    - A run that no longer replays under the current rules gets no line.
      It restarts when opened.
  - **No line** with no open run, and none once the tour is finished.
- Reason: phase 6 plan (plan_iteration_3), slice 6.5; SPEC §7.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.4: link steps lead to the other flow in the viewer

- Decision:
  - **What the server sends:**
    - With the flow, the viewer gets `links`: for each flow a link step
      points to, its current name and whether this user can open it
      (`visibleFlows`, the same rule as the routes).
    - Nothing else about the other flow is sent, and its viewer still
      answers 404 to someone who cannot see it.
    - Starting a tour sends the `links` of the run's own release, which
      may be older than the page's.
  - **In the tour,** a link step's panel lists «Flujo» and, when there is
    one, «Contacto», in the same rows as the tags, whether or not the user
    has access (SPEC §5, §7).
    - With access, «Ir a «X»» follows, a link styled as the secondary
      button.
    - Without access there is no button and no extra text: the name only,
      as SPEC §5 says.
    - The link's own exits stay listed below («Sigue con»), and
      «Siguiente» stays in the diagram's corner: two different actions,
      both offered.
  - **«Ir a «X»» opens `/flows/X?recorrido=1`.** The viewer drops the
    parameter and goes straight into the tour, exactly as «Iniciar» or
    «Continuar» would.
    - An open run in X continues where it was. Otherwise a new one
      starts at X's beginning.
    - Nothing is abandoned on arrival (SPEC §7); «Empezar de nuevo»
      stays the user's choice.
    - The tour left behind stays open and the home screen lists it as in
      progress. Naming its step there is slice 6.5.
  - **Not here:** clicking a link node in the diagram. The overview is
    read-only, and choosing any step on the diagram belongs to free
    review (slice 6.6), which will offer the same «Ir a».
  - **Checked in Chrome as the Board:**
    - Walked Apertura de OT to P13 through «Interna». The panel showed
      Instalaciones, «Jefe de instalación», «Ir a «Instalaciones»» and
      «Sigue con».
    - Following it opened Instalaciones' tour at P1, with
      `?recorrido=1` gone from the address.
    - Home then listed both tours in progress.
    - The test runs were removed from the local database afterwards.
- Reason: phase 6 plan (plan_iteration_3), slice 6.4; SPEC §5, §7.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.3: P13 of Apertura de OT gets its contact in the reference file

- Decision:
  - **The edit:** `reference/Flujo_Apertura_OT.xlsx` gains a «Contacto»
    column right after «Flujo», as in the template (the owner's answer 4).
    P13, the link to Instalaciones, holds «Jefe de instalación». The
    owner authorised this edit of `reference/`.
  - **How:** an edit of the sheet's XML, not a rewrite with
    `xlsx-write.js`, which would have dropped the «Dudas» and «Ficha»
    sheets and the formatting.
    - Every cell from D on moved one column right, with its width.
    - The new D column is 22 wide, as in the template, and takes each
      row's style.
    - The sheet's dimension went to `A1:I37`.
    - The script refused to run if the sheet had anything it does not
      account for: merged cells, formulas, validations, filters, links,
      tables. It had none.
    - Every other zip entry was copied byte for byte, in the same order.
      The script was one-off and is not committed.
  - **Checked before replacing the file:**
    - Read with our own reader (`tools/xlsx-to-grid.mjs`), the new file
      gives the committed grid row for row.
    - The only difference is a `contact` key on every row, empty except
      on P13.
  - **The grid:** `Flujo_Apertura_OT.grid.json` was regenerated with the
    same tool. `Flujo_Instalaciones` is untouched: it has no link, and a
    file without the column still reads as before.
  - **Local database:** `db:load` published Apertura de OT 1.2, whose P13
    stores the contact. Instalaciones stays on 1.0, and a second load
    changes nothing.
- Reason: phase 6 plan (plan_iteration_3), slice 6.3; SPEC §5.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.2: the contact in the editor's grid

- Decision:
  - **The column:** «Contacto» is a column of its own, right after Flujo,
    as wide as Flujo (4 × `--space-10`). This is the owner's answer 1.
  - **Where it is edited:**
    - On Enlace and Subflujo rows it is a plain text field, with the
      placeholder «p. ej. Jefe de instalación».
    - On every other row it is empty and disabled, as Flujo is.
  - **Changing the type:** a row that stops being Enlace or Subflujo
    loses its contact along with its flow (SPEC §6: a row that points
    nowhere has nobody to point to). Back to Enlace, the field opens
    empty.
  - **Width:** the grid is 160px wider. At 1280px, Salidas still starts in
    view, cut at its right edge; the rest is reached with the grid's own
    horizontal scroll.
  - **Checked in Chrome on Apertura de OT:**
    - P13 takes «Jefe de instalación», saves to the draft and is still
      there after a reload.
    - P1 shows the field disabled.
    - P13 turned into Actividad clears and disables it.
- Reason: phase 6 plan (plan_iteration_3), slice 6.2; SPEC §6.
- Spec sections affected: none.

## 2026-11-19 — Phase 6.1: the contact of links and subflows in the data, import and export

- Decision:
  - **Where it lives:**
    - `contact` is a field of the grid row, of the draft step and of the
      compiled step: free text, optional, trimmed.
    - It is kept only on `link` and `subflow` steps. A compiled step of
      any other type has `contact: ""`.
  - **Not in SQL:** the contact lives in the stored document of each
    version, so there is no migration.
    - `DocStep.contact` is written only when it has a value. Documents
      stored before it existed, and every step without one, stay
      byte-for-byte as they were. Re-running `db:load` changes nothing,
      and no release changes shape.
  - **Reading:**
    - The Contacto column is read under the headers «Contacto» or
      «Contact», in any case or accent.
    - A table without that column gives rows no `contact` key. A file
      written before it existed reads into exactly the grid it always
      did, which keeps the committed `reference/*.grid.json` valid until
      6.3.
    - A contact on any other type is dropped with a warning that does not
      block, worded like Flujo's (SPEC §5).
    - `parseGrid` accepts a row without `contact`; when present, it must
      be text.
  - **Writing:**
    - The template, the export and `toTSV` write «Contacto» right after
      «Flujo» (SPEC §5).
    - Export writes the cell as the grid holds it, as it already does for
      Flujo.
  - **A consequence:** «Contacto» is now a fixed column, so no tag
    category can be called that, as with every other fixed header. No
    category in the reference flows has that name.
  - **The editor carries the contact through:**
    - Its rows come from the stored document with `contact`, and a save
      sends it back.
    - A new row starts with an empty one.
    - The cell that shows and edits it is slice 6.2.
- Reason: phase 6 plan (plan_iteration_3), slice 6.1; SPEC §5.
- Spec sections affected: none.

## 2026-11-19 — Areas back beside the action buttons; grid scrollbars always shown (SPEC §6)

- Decision:
  - **The owner changed SPEC §6 again.** The assigned areas leave the flow
    data panel: publishing depends on them, so they are visible without
    opening anything. The panel keeps name, objective and colour. Both
    of the grid's scrollbars stay visible at all times.
  - **The areas selector is back where b5eca22 put it:** its own line,
    right above the toolbar, unchanged.
    - Publishing with no area opens the selector and focuses its first
      area. The panel stays as it is.
  - **Scrollbars:** the grid's scrollbars are styled through
    `::-webkit-scrollbar`, with tokens only. This makes Chrome, Edge and
    Safari on macOS draw classic bars that are always shown, instead of
    overlay bars that appear only while scrolling.
    - `scrollbar-width` and `scrollbar-color` are left unset: where
      either is set, Chrome ignores the `::-webkit-scrollbar` rules.
    - Firefox follows the system setting and cannot be made to show
      them.
  - **The grid's height is fitted whenever the page changes size,** not
    only `.editor`. That covers the site header too.
    - Measured at 1280×800, 1366×768 and 1280×650, with the publish
      notice above: the grid ends 25px above the window's bottom in
      each.
  - **Known limit:** with the flow data panel open, there is no room
    left below it on a laptop screen. The grid keeps its floor (a third
    of the window) and its bottom bar sits below the window until the
    page is scrolled or the panel is folded. Measured at 1280×800: the
    grid ends at y=1077.
  - One message per field in the panel, the third point of this review,
    was already done in 32185c6.
- Reason: SPEC §6, rewritten by the owner on 2026-11-19.
- Spec sections affected: none beyond the owner's change.

## 2026-11-19 — The flow data panel replaces «Datos del flujo» (SPEC §6)

- Decision:
  - **The owner changed SPEC §6:** name, objective, colour and areas all
    live in the editor, in a panel above the grid that starts folded. The
    separate page goes.
  - **The panel works like the import box.** It is a section above the
    grid, hidden at first and opened by «Datos del flujo», which used to
    be the link to the page and is now a button in the same place.
    - It holds Nombre, Objetivo, the twelve colour swatches, and the
      areas selector from b5eca22, unchanged.
    - Folded, the grid keeps its height (775 at 1280×800, as before).
      Opened, the grid fits what is left, never below a third of the
      window.
  - **Each field is saved at once, with no version** (SPEC §6: none of
    the four is part of the draft).
    - Name and objective save on `change` (leaving the field, or Enter on
      the name); colour on picking a swatch. `POST /flows/:id/details`
      now takes JSON, one field per request, and answers with the value
      as saved (trimmed). Requests go one after another.
    - A blank or taken name is refused with the form's messages. What
      was typed stays in the field, marked invalid, and the title does
      not change.
    - A saved name changes the page title, the heading and the preview.
      A saved colour repaints the editor and the preview.
    - **One message per field, the owner's choice.** Name, objective and
      colour each have their own message under them; the areas already
      had theirs. One field's error stays until that field is saved,
      whatever is saved in the others. The name's message is its
      `aria-describedby`.
  - **Publishing with no area** says so in the message panel, opens the
    flow data panel with the selector open, and focuses its first area.
    - The selector now closes on a press outside it (`pointerdown`), not
      a click: the click on Publicar that opens it would otherwise also
      close it.
  - **Removed:** `GET /flows/:id/details`, the form page,
    `saveFlowDetails` and `FlowDetails`. They are replaced by
    `saveFlowField`. Creating a flow still asks for the name and lands
    in the editor.
- Reason: SPEC §6, rewritten by the owner on 2026-11-19.
- Spec sections affected: none beyond the owner's change.
- Superseded in part (2026-11-19, entry above): the areas selector left
  the panel and went back above the toolbar. Publishing with no area
  opens the selector, not the panel.

## 2026-11-19 — The grid fits the window; the areas move up to the editor

- Decision:
  - **The owner's review, points 1 and 2:** the editor scrolled twice (the
    page, then the grid), and assigning areas meant leaving for «Datos del
    flujo», where the publish panel also sent you mid-work.
  - **The grid scrolls inside its frame, both ways.**
    - `editor.js` sets the frame's height to what is left of the window
      below the grid's top, so the horizontal bar is in view on arrival.
      Never below a third of the window, for a short one.
    - Recomputed when what sits above changes height (a message, the
      import box) and on resize.
    - The header row is sticky at the top, as Fila and ID are at the
      left; the corner cells stay over both.
    - Measured on Instalaciones: at 1280×800 the grid ends at y=775, at
      1440×900 at 875, at 390×844 at 819. The hint and the problem list
      are still below the grid, reached by scrolling the page.
  - **«Áreas que lo ven», a drop-down of checkboxes above the toolbar.**
    - The same data as the flow form, which keeps its own.
    - Saved at once on each change (`POST /flows/:id/areas`, the whole
      set as JSON), with no «Guardar» and no version: areas are not part
      of the draft, and a second save button for them would make the
      draft's ambiguous. One request at a time; a change made meanwhile
      goes after it. On failure the boxes go back to what is saved.
    - A published flow left with no area gets the flow form's warning
      next to the selector.
    - The publish panel's «Falta asignar un área» opens the selector
      instead of linking to «Datos del flujo».
  - `EditorData.areas` (a count) is replaced by `areaIds` and
    `areaOptions`.
- Reason: the owner's review of 2026-11-19.
- Spec sections affected: §6 (Flow form lists the areas; they are now
  also edited above the grid). Proposed to the owner: add «and above the
  grid» to the Flow form line.
  - Done by the owner in `fca0c53`: §6 now says the areas are also edited
    above the grid, and that none of the flow form's four fields is part
    of the draft.
- Superseded in part (2026-11-19, entry above): the selector no longer
  sits above the toolbar but inside the flow data panel, and the flow form
  page is gone. The grid's height, the selector itself and saving areas at
  once stand.

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
    or resetting one generates a ~~twelve-character password in groups of
    four~~ (superseded 2026-11-20: eighteen characters in groups of six,
    «Temporary passwords: 80 bits or more»), from an alphabet without look-alikes, shown once on the answer
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
    password: ~~accounts without one (a later Microsoft SSO) rely on that.~~
    Superseded 2026-11-20: SPEC §4 dropped Microsoft and codes by email;
    the rule stays so a row without a real hash never opens a session.
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
  - Out of scope: tag category screens (phase 5), ~~Microsoft SSO (later; a
    session does not know how the user got in, so SSO will be another way
    into `createSession`, with a table for the external identity).~~
    Superseded 2026-11-20: SPEC §4 dropped Microsoft sign-in and codes by
    email; password is the only way in.
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
    likewise. ~~The direct-branch note (bounce) stays only where a long
    branch is still pending: Instalaciones P9 and P17, Apertura P31.~~
    Superseded by the owner on 2026-11-19: see «Phase 6.18: a branch back
    to its own decision is a retry; a held branch is not taken».
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
  - ~~A branch that goes straight to its meeting point shows «Esta opción va
    directo a «X». Antes de seguir, mira las otras.» every time it is
    chosen while another branch meets there, not only the first time.~~ A
    click that shows nothing is worse than a repeated note: the user cannot
    tell whether it was ignored, broken or wrong. The note is true about
    the process, not a reproach. (Owner's correction of their own earlier
    instruction.)
    Superseded by the owner on 2026-11-19: see «Phase 6.18: a branch back
    to its own decision is a retry; a held branch is not taken».
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
  - ~~**A branch straight to the meeting point** (Instalaciones P9, P11,
    P17; Apertura P31, P34) does not enter it while another branch meets
    there. The branch is marked taken and the tour stays at the decision:
    «Esta opción va directo a «X». Antes de seguir, mira las otras.»~~
    Superseded by the owner on 2026-11-19: see «Phase 6.18: a branch back
    to its own decision is a retry; a held branch is not taken».
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
