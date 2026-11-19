// The flow viewer (SPEC §7). The server embeds the latest release as JSON;
// the layout is computed here, in the browser (SPEC §9), and drawn as SVG.
// Overview (phase 2.4) and tour (phase 3.3) share the page: "Iniciar
// recorrido" turns it into the tour, and finishing returns to the overview.
//
// The tour is decided on the server. The browser keeps a copy of the Tour
// engine, rebuilt from the server's log (tour-log.js), proposes each action,
// and applies it only once the server has accepted and stored it.
// "Anterior" only moves the view back over steps already walked, so it never
// reaches the server, and neither does "Siguiente" while going forward again
// over them. Choosing a different branch on a decision left behind does
// (phase 3.6).
import Core from './core.js';
import { layoutFlow } from './diagram-layout.js';
import { CATEGORY_SLOTS, renderDiagram } from './diagram.js';
import { apply, replay } from './tour-log.js';

const data = document.getElementById('flow-data');
const page = document.querySelector('.viewer');
const cols = page && page.querySelector('.viewer-cols');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const quoted = (s) => `«${esc(s)}»`;
const DONE_ICON = '<img class="icon" src="/icons/done.svg" alt="" width="18" height="18">';
// The same line as StatusLine in src/status.tsx, redrawn when the server
// answers a start or a finish with the new status (phase 3.4).
const STATUS_ICONS = { pending: 'pending', in_progress: 'in_progress', reviewed: 'done' };
const showStatus = (status) => {
  const line = document.getElementById('review-status');
  if (!line || !status) return;
  line.dataset.state = status.state;
  line.innerHTML = `<img class="icon" src="/icons/${STATUS_ICONS[status.state]}.svg" alt="" width="18" height="18"><strong>${esc(status.label)}</strong>${status.detail ? `<span class="muted">${esc(status.detail)}</span>` : ''}`;
};

// The flow selector (phase 6.7). Chosen with the mouse or by touch, a
// flow opens at once. From the keyboard the arrows only move the choice
// (on some systems they change a closed select): it opens on Enter or
// when the select loses focus. A tour open here stays open, as when
// following a link.
const picker = document.querySelector('[data-flow-select]');
if (picker instanceof HTMLSelectElement) {
  const here = picker.value;
  let keyboard = false;
  const open = () => {
    if (picker.value !== here) location.assign(`/flows/${encodeURIComponent(picker.value)}`);
  };
  picker.addEventListener('pointerdown', () => {
    keyboard = false;
  });
  picker.addEventListener('keydown', (ev) => {
    keyboard = true;
    if (ev.key === 'Enter') {
      ev.preventDefault();
      open();
    }
  });
  picker.addEventListener('change', () => {
    if (!keyboard) open();
  });
  picker.addEventListener('blur', open);
}

if (data && cols) {
  const { id, name, colour, flow, status: initial, links: initialLinks } = JSON.parse(data.textContent);
  // Where each link leads, by target flow id: its name, and whether this
  // user can open it (phase 6.4). `links` follows what is shown: the tour's
  // own release replaces it, and the overview and the free review use the
  // page's.
  const pageLinks = initialLinks || {};
  let links = pageLinks;
  // The review status, as the server last gave it: it labels the overview's
  // buttons, and "Empezar de nuevo" shows whenever a run is open.
  let status = initial;
  const overview = cols.innerHTML;
  // Link steps on the diagram (SPEC §7; phase 6.15): the tooltip names the
  // flow they lead to, with or without access; in the overview, with
  // access, the step opens that flow's overview, not its tour.
  const linkMarks = (shown, open) =>
    Object.fromEntries(
      shown.steps
        .filter((s) => s.type === 'link' && s.ref != null && links[s.ref])
        .map((s) => [s.id, { name: links[s.ref].name, ...(open && links[s.ref].open ? { href: `/flows/${encodeURIComponent(s.ref)}` } : {}) }]),
    );
  const drawOverview = () => {
    const box = document.getElementById('diagram');
    if (box) box.innerHTML = renderDiagram(layoutFlow(flow), { name, colour }, undefined, linkMarks(flow, true));
  };
  drawOverview();

  /** @type {{ flow: any, layout: any, tour: any, busy: boolean, message: string } | null} */
  let state = null;

  const post = async (path, body) => {
    const res = await fetch(`/flows/${id}/tour${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  };

  const noteFor = (note) => {
    if (!note) return '';
    const title = (stepId) => quoted(state.tour.byId.get(stepId).title);
    // Branches that meet again (phase 3.5); one-step ones walked in a row (3.6).
    const option = (d, k) => { const e = state.tour.exitsOf(d)[k]; return quoted(e.label || state.tour.byId.get(e.to).title); };
    if (note.alt) return `<p class="note">Otra manera: ${option(note.alt, note.exit)} (${note.n} de ${note.total}).</p>`;
    if (note.alsoDirect) {
      const names = note.exits.map((k) => option(note.alsoDirect, k));
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
      return `<p class="note">${names.length > 1 ? `Las opciones ${list} llevan` : `La opción ${list} lleva`} directo a este paso.</p>`;
    }
    if (note.direct) return `<p class="note">Esta opción va directo a ${title(note.direct)}. Antes de seguir, mira las otras.</p>`;
    if (note.joinAt) return `<p class="note">Esta rama sigue en ${title(note.joinAt)}, igual que las otras. Vuelves a la decisión para ver las que faltan.</p>`;
    const why = note.endAt ? `Esa rama terminó en ${title(note.endAt)}. ` : note.loopTo ? 'Ese camino se repite sin llegar a un cierre. ' : '';
    const then = note.returned ? 'Vuelves a esta decisión para ver las otras opciones.' : 'Ahora sigues con una parte del flujo que faltaba.';
    return `<p class="note">${why}${then}</p>`;
  };

  const details = (step, categories) => {
    let out = `<p class="eyebrow">${esc((Core.TYPE_LABELS[step.type] || '').toUpperCase())}</p><h2 class="step-title">${esc(step.title)}</h2>`;
    // No description, nothing shown: most real steps have none.
    if (step.description) out += `<p class="step-desc">${esc(step.description)}</p>`;
    const rows = categories.filter((c) => step.tags[c] && step.tags[c].length);
    if (rows.length) {
      out += `<dl class="step-tags">${rows.map((c) => `<div><dt>${esc(c)}</dt><dd>${step.tags[c].map((v) => `<span class="chip">${esc(v)}</span>`).join('')}</dd></div>`).join('')}</dl>`;
    }
    return out;
  };

  // A link step (SPEC §5, §7; phase 6.4): the other flow and its contact,
  // whether or not this user can open it; with access, the way there. It
  // opens that flow's own tour, from its start or where it was left; the
  // tour here stays open, and its exits are still offered below.
  const linkPanel = (step) => {
    if (step.type !== 'link' || step.ref == null) return '';
    const target = links[step.ref];
    const other = target ? target.name : 'otro flujo';
    const rows = [['Flujo', other]].concat(step.contact ? [['Contacto', step.contact]] : []);
    const go = target && target.open ? `<a class="button-secondary link-go" href="/flows/${encodeURIComponent(step.ref)}?recorrido=1">Ir a ${quoted(other)}</a>` : '';
    return `<div class="link-target"><dl class="step-tags">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${go}</div>`;
  };

  const exitsPanel = (tour) => {
    const options = tour.options();
    if (!options.length) return '';
    const text = (o) => `${o.label ? `<strong>${esc(o.label)}</strong> · ` : ''}${esc(o.title)}`;
    // At the last step, or on a decision "Anterior" came back to (phase 3.6).
    if (tour.canChoose()) {
      const buttons = options.map((o) =>
        `<button type="button" class="branch${o.taken ? ' taken' : ''}" data-choose="${o.index}">${text(o)}${o.taken ? `<span class="taken-tag">${DONE_ICON}Ya recorrida</span>` : ''}</button>`,
      ).join('');
      const skip = tour.canSkip() ? '<button type="button" class="branch" data-skip>Ir a lo que falta por visitar</button>' : '';
      const again = options.some((o) => o.taken) ? '<p class="muted small">Puedes repetir una rama ya recorrida.</p>' : '';
      const head = tour.atEnd() ? 'Elige una rama para continuar' : 'Puedes elegir otra rama: el recorrido seguirá desde aquí';
      return `<div class="exits"><p class="label">${head}</p>${buttons}${skip}${again}</div>`;
    }
    const rows = options.map((o) => `<p class="exit-row">${text(o)}${o.visited && tour.atEnd() ? ' (ya visitado)' : ''}</p>`).join('');
    // The "next step" hint: secondary, so a phone leaves it out (SPEC §9).
    return `<div class="exits exits-hint"><p class="label">${options.length === 1 ? 'Sigue con' : 'Salidas'}</p>${rows}</div>`;
  };

  const marks = (tour, categories) => {
    const current = tour.current().id;
    const step = tour.step();
    return {
      state: (stepId) => (stepId === current ? 'current' : tour.visited.has(stepId) ? 'visited' : 'dim'),
      walked: (from, to) => tour.visited.has(from) && tour.visited.has(to),
      badges: {
        id: current,
        items: categories.flatMap((category, index) => (step.tags[category] || []).map((value) => ({ category, index, value }))),
      },
    };
  };

  // From the diagram's coordinates to pixels in the drawn SVG. Read from its
  // viewBox, not from the layout: the canvas grows to hold badges (6.14).
  const frame = (svg) => {
    const vb = svg.viewBox.baseVal;
    const k = svg.getBoundingClientRect().width / vb.width || 1;
    return { x: (v) => (v - vb.x) * k, y: (v) => (v - vb.y) * k };
  };

  const scrollToCurrent = (box, layout, current) => {
    const node = layout.nodes.find((n) => n.id === current);
    const svg = box.querySelector('svg');
    if (!node || !svg) return;
    box.scrollTop = Math.max(0, frame(svg).y(node.y) - box.clientHeight / 2);
  };

  // ---- Tour zoom (SPEC §9, Layout; phase 6.8): on every screen, the
  // diagram can frame the current step with the one the user came from and
  // the next ones, so the labels stay readable. Zoomed is the default on a
  // phone; the choice holds for the rest of the visit to this page. ----
  const PHONE = window.matchMedia('(max-width: 760px)');
  let zoomed = PHONE.matches;
  // Room beside the current step for its tag badges, and around the frame.
  const BADGE_ROOM = 96;
  const FRAME_PAD = 24;
  // How much a frame may be enlarged to fill the card.
  const MAX_SCALE = 2;

  const zoomTo = (box, layout, tour) => {
    const svg = box.querySelector('svg');
    if (!svg) return;
    const current = tour.current().id;
    const ids = new Set([current, ...tour.options().map((o) => o.to)]);
    if (tour.pos > 0) ids.add(tour.trail[tour.pos - 1].id);
    const nodes = layout.nodes.filter((n) => ids.has(n.id));
    if (!nodes.length) return;
    const step = tour.step();
    const tagged = Object.values(step.tags || {}).some((v) => v && v.length);
    const side = (n) => (n.id === current && tagged ? BADGE_ROOM : 0);
    const x0 = Math.max(0, Math.min(...nodes.map((n) => n.x - n.w / 2 - side(n))) - FRAME_PAD);
    const x1 = Math.min(layout.width, Math.max(...nodes.map((n) => n.x + n.w / 2 + side(n))) + FRAME_PAD);
    const room = (n) => (n.id === current && pendingBranches(tour).length ? TIP_ROOM : 0);
    const y0 = Math.max(0, Math.min(...nodes.map((n) => n.y - n.h / 2 - room(n))) - FRAME_PAD);
    const y1 = Math.min(layout.height, Math.max(...nodes.map((n) => n.y + n.h / 2)) + FRAME_PAD);
    const w = x1 - x0;
    const h = y1 - y0;
    // Enlarged to the card's width, up to MAX_SCALE, and never taller than
    // the room the card gives the diagram.
    const style = getComputedStyle(box);
    const roomW = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const roomH = parseFloat(style.maxHeight) - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const k = Math.max(0.1, Math.min(MAX_SCALE, roomW / w, roomH > 0 ? roomH / h : MAX_SCALE));
    svg.setAttribute('viewBox', `${x0} ${y0} ${w} ${h}`);
    svg.setAttribute('width', String(Math.round(w * k)));
    svg.setAttribute('height', String(Math.round(h * k)));
    box.scrollTop = 0;
    box.scrollLeft = 0;
  };

  // A resized window changes the room the frame is enlarged into.
  let resizing = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizing);
    resizing = requestAnimationFrame(() => {
      const box = document.getElementById('diagram');
      if (state && zoomed && box) zoomTo(box, state.layout, state.tour);
      // The tooltip follows its node.
      if (state && box) showReturnTip(box, state.tour);
      hideHoverTip();
    });
  });

  const zoomToggle = () =>
    `<button type="button" class="button-link zoom-toggle" data-zoom aria-pressed="${zoomed}"><span class="icon-zoom" aria-hidden="true"></span>${zoomed ? 'Ver todo' : 'Acercar'}</button>`;

  // «Convenciones» (SPEC §7; phase 6.14): what each badge style stands for,
  // above the diagram wherever badges show (the tour and the free review).
  // Category slots repeat from the fifth on, as the badges do.
  const legend = (categories) =>
    categories.length
      ? `<div class="legend"><span class="legend-title">Convenciones</span>${categories.map((c, i) => `<span class="legend-item"><span class="legend-swatch c${(i % CATEGORY_SLOTS) + 1}" aria-hidden="true"></span>${esc(c)}</span>`).join('')}</div>`
      : '';

  // ---- Tooltips (SPEC §7; phase 6.17): one look for all of them, dark
  // with light text (theme.css tooltip tokens), above the node they speak
  // of with the arrow down; below it only when the diagram has no room
  // above. They live inside the diagram's scroll box, so they move with it.
  const TIP_GAP = 4;
  const placeTip = (box, node, tip) => {
    const b = box.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    const anchor = r.left - b.left + box.scrollLeft + r.width / 2;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    // Kept inside the diagram sideways; the arrow still points at the node.
    const x = Math.max(w / 2 + TIP_GAP, Math.min(anchor, box.scrollWidth - w / 2 - TIP_GAP));
    const top = r.top - b.top + box.scrollTop;
    const below = top - h - TIP_GAP * 2 < 0;
    tip.classList.toggle('below', below);
    tip.style.left = `${x}px`;
    tip.style.top = `${below ? top + r.height : top}px`;
    tip.style.setProperty('--tip-arrow-x', `${anchor - x + w / 2}px`);
    return below ? top + r.height : top - h - TIP_GAP * 2;
  };

  // The tooltip of a step that has one (a link step: where it leads), on
  // pointer hover and on keyboard focus. Its text is also in the step's
  // accessible name, so the tooltip itself is hidden from screen readers.
  const hideHoverTip = () => document.querySelectorAll('.tooltip-hover').forEach((t) => t.remove());
  const showHoverTip = (target) => {
    hideHoverTip();
    if (!(target instanceof Element)) return;
    const node = target.closest('[data-tip]') || target.querySelector('[data-tip]');
    const box = node && node.closest('.diagram-scroll');
    if (!node || !box) return;
    const tip = document.createElement('div');
    tip.className = 'tooltip tooltip-hover';
    tip.setAttribute('aria-hidden', 'true');
    tip.textContent = node.getAttribute('data-tip');
    box.append(tip);
    placeTip(box, node, tip);
  };

  // When the tour went back to a decision, for whatever reason, a tooltip
  // on that decision names the branches still to walk, until one is chosen
  // (SPEC §7; phase 6.17, replacing 6.13's band). The side panel says why.
  const pendingBranches = (tour) => {
    const note = tour.current().note;
    if (!tour.atEnd() || !note || !note.returned || !tour.canChoose()) return [];
    return tour.options().filter((o) => !o.taken).map((o) => o.label || o.title);
  };
  const returnText = (pending) => {
    const names = new Intl.ListFormat('es', { type: 'conjunction' }).format(pending.map((p) => `«${p}»`));
    return pending.length === 1 ? `Falta la rama ${names}. Elígela para seguir.` : `Faltan las ramas ${names}. Elige una para seguir.`;
  };
  // Room above the decision for the tooltip when the tour is zoomed.
  const TIP_ROOM = 72;
  const showReturnTip = (box, tour) => {
    box.querySelector('.tooltip-return')?.remove();
    const pending = pendingBranches(tour);
    const node = pending.length ? box.querySelector(`.node[data-id="${CSS.escape(tour.current().id)}"]`) : null;
    if (!node) return;
    const tip = document.createElement('div');
    tip.className = 'tooltip tooltip-return';
    tip.setAttribute('role', 'status');
    tip.textContent = returnText(pending);
    box.append(tip);
    const top = placeTip(box, node, tip);
    // In view: the diagram scrolls up if the tooltip starts above it.
    if (top < box.scrollTop) box.scrollTop = Math.max(0, top);
  };


  const renderTour = (focus) => {
    const { tour, flow: toured, layout } = state;
    const total = toured.steps.length;
    const seen = tour.visited.size;
    const step = tour.step();
    const finish = tour.canFinish();
    const choice = tour.needsChoice();
    const primary = finish
      ? '<button type="button" class="button-primary" data-finish>Terminar recorrido</button>'
      : `<button type="button" class="button-primary" data-next${choice ? ' disabled' : ''}>Siguiente</button>`;
    cols.innerHTML =
      `<div class="card diagram-card">` +
      `<div class="tour-progress"><span>Pasos visitados: ${seen} de ${total}</span>` +
      `<div class="bar" role="progressbar" aria-label="Pasos visitados" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${seen}"><div style="width:${Math.round((seen / total) * 100)}%"></div></div>` +
      // Back to the overview; the run stays open (phase 3.5).
      `${zoomToggle()}<button type="button" class="button-link" data-overview>Ver el flujo completo</button></div>` +
      legend(toured.categories) +
      `<div class="diagram-scroll" id="diagram">${renderDiagram(layout, { name, colour }, marks(tour, toured.categories), linkMarks(toured, false))}</div>` +
      `<div class="diagram-actions"><p class="tour-message" role="status">${esc(state.message)}</p>` +
      `<button type="button" class="button-secondary" data-prev${tour.pos === 0 ? ' disabled' : ''}>Anterior</button>${primary}</div></div>` +
      `<aside class="card viewer-side">${tour.atEnd() ? noteFor(tour.current().note) : ''}${details(step, toured.categories)}${linkPanel(step)}${exitsPanel(tour)}</aside>`;
    if (state.busy) cols.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const box = document.getElementById('diagram');
    if (zoomed) zoomTo(box, layout, tour);
    else scrollToCurrent(box, layout, tour.current().id);
    showReturnTip(box, tour);
    const target = (focus && cols.querySelector(focus)) || cols.querySelector('[data-choose]:not(.taken)') || cols.querySelector('[data-finish]') || cols.querySelector('[data-next]:not([disabled])');
    if (target && !target.disabled) target.focus({ preventScroll: true });
  };

  // `status.action` relabels the button: "Repetir recorrido" after a
  // finish, or "Iniciar recorrido" if a major release came out meanwhile.
  const showOverview = (lines) => {
    state = null;
    review = null;
    links = pageLinks;
    cols.innerHTML = overview;
    drawOverview();
    const button = cols.querySelector('[data-start]');
    if (button) button.textContent = status.action;
    const restart = cols.querySelector('[data-restart]');
    if (restart) restart.hidden = !status.open;
    const free = cols.querySelector('[data-review]');
    if (free) free.hidden = status.state !== 'reviewed';
    const side = cols.querySelector('.viewer-side');
    if (side && lines.length) side.insertAdjacentHTML('afterbegin', `<p class="note">${DONE_ICON}<span>${lines.map(esc).join(' ')}</span></p>`);
  };

  // Sends one action; applied to the local engine only once stored.
  const act = async (action, focus) => {
    if (state.busy) return;
    state.busy = true;
    state.message = '';
    renderTour(focus);
    const res = await post('/step', action).catch(() => ({ ok: false, json: {} }));
    state.busy = false;
    if (res.ok) apply(state.tour, action);
    else state.message = res.json.error || 'No se pudo guardar el paso. Revisa la conexión e inténtalo de nuevo.';
    renderTour(focus);
  };

  const finish = async () => {
    if (state.busy) return;
    state.busy = true;
    renderTour('[data-finish]');
    const res = await post('/finish').catch(() => ({ ok: false, json: {} }));
    state.busy = false;
    if (res.ok) {
      status = res.json.status;
      showStatus(status);
      // Finishing unlocks the free review, and it opens (SPEC §7).
      return showReview(['Flujo revisado.', res.json.newer].filter(Boolean));
    }
    state.message = res.json.error || 'No se pudo terminar el recorrido. Revisa la conexión e inténtalo de nuevo.';
    renderTour('[data-finish]');
  };

  // "Iniciar", "Continuar" or "Repetir" (path ''), or "Empezar de nuevo"
  // once confirmed (path '/restart').
  const start = async (button, path) => {
    button.disabled = true;
    const res = await post(path).catch(() => ({ ok: false, json: {} }));
    const tour = res.ok ? replay(res.json.flow, res.json.log) : null;
    if (!tour) {
      button.disabled = false;
      const actions = cols.querySelector('.diagram-actions');
      actions.querySelector('.tour-message')?.remove();
      actions.insertAdjacentHTML('afterbegin', `<p class="tour-message" role="status">${esc(res.json.error || 'No se pudo iniciar el recorrido. Recarga la página e inténtalo de nuevo.')}</p>`);
      return;
    }
    status = res.json.status;
    showStatus(status);
    links = res.json.links || {};
    state = { flow: res.json.flow, layout: layoutFlow(res.json.flow), tour, busy: false, message: res.json.notice || '' };
    renderTour();
  };

  // "Empezar de nuevo" sits beside "Continuar recorrido" and throws away the
  // steps walked so far, so it asks first (owner's decision, phase 3.5).
  const confirmRestart = () => {
    const actions = cols.querySelector('.diagram-actions');
    actions.dataset.saved = actions.innerHTML;
    actions.innerHTML =
      '<p class="tour-message" role="status">¿Empezar de nuevo? Pierdes los pasos que llevas en este recorrido.</p>' +
      '<button type="button" class="button-secondary" data-cancel>Cancelar</button>' +
      '<button type="button" class="button-primary" data-confirm-restart>Sí, empezar de nuevo</button>';
    actions.querySelector('[data-cancel]').focus();
  };
  const cancelRestart = () => {
    const actions = cols.querySelector('.diagram-actions');
    actions.innerHTML = actions.dataset.saved || '';
    delete actions.dataset.saved;
    cols.querySelector('[data-restart]')?.focus();
  };

  // ---- Free review (SPEC §7; phase 6.6): the whole diagram, any step
  // chosen to see its panel, and the steps that carry a tag highlighted.
  // Unlocked once the flow is reviewed. It reads the page's release, the
  // latest, as the overview does; nothing of it reaches the server. ----

  /** @type {{ selected: string, cat: string, val: string, notes: string[] } | null} */
  let review = null;
  const reviewLayout = () => layoutFlow(flow);
  let laidOut = null;

  const showReview = (notes = []) => {
    state = null;
    links = pageLinks;
    review = { selected: '', cat: '', val: '', notes };
    renderReview();
  };

  // Brings the highlighted steps into view: their whole span centred when
  // it fits, otherwise the first of them near the top.
  const scrollToHits = (box, layout, ids) => {
    const nodes = layout.nodes.filter((n) => ids.includes(n.id));
    const svg = box.querySelector('svg');
    if (!nodes.length || !svg) return;
    const f = frame(svg);
    const top = f.y(Math.min(...nodes.map((n) => n.y - n.h / 2)));
    const bottom = f.y(Math.max(...nodes.map((n) => n.y + n.h / 2)));
    const left = f.x(Math.min(...nodes.map((n) => n.x - n.w / 2)));
    const right = f.x(Math.max(...nodes.map((n) => n.x + n.w / 2)));
    const margin = box.clientHeight / 8;
    box.scrollTop = Math.max(0, bottom - top <= box.clientHeight - 2 * margin ? (top + bottom - box.clientHeight) / 2 : top - margin);
    box.scrollLeft = Math.max(0, right - left <= box.clientWidth ? (left + right - box.clientWidth) / 2 : left);
  };

  // `jump`: bring the highlighted steps into view (a value was just
  // pressed). Otherwise the view stays where the user left it.
  const renderReview = (focus, jump = false) => {
    const { selected, cat, val, notes } = review;
    const old = document.getElementById('diagram');
    const kept = old ? { top: old.scrollTop, left: old.scrollLeft } : null;
    laidOut = laidOut || reviewLayout();
    const step = flow.steps.find((s) => s.id === selected) || null;
    const values = cat ? [...new Set(flow.steps.flatMap((s) => s.tags[cat] || []))].sort((a, b) => a.localeCompare(b, 'es-CO')) : [];
    const carries = (id) => (flow.steps.find((s) => s.id === id)?.tags[cat] || []).includes(val);
    const marks = {
      clickable: true,
      walked: () => true,
      state: (id) => [id === selected ? 'selected' : '', cat && val ? (carries(id) ? 'hit' : 'dim') : ''].filter(Boolean).join(' '),
      badges: step ? { id: step.id, items: flow.categories.flatMap((category, index) => (step.tags[category] || []).map((value) => ({ category, index, value }))) } : undefined,
    };
    const filter =
      '<div class="review-filter">' +
      (flow.categories.length
        ? `<label for="hl-cat">Resaltar por</label><select id="hl-cat"><option value="">Nada</option>${flow.categories.map((c) => `<option value="${esc(c)}"${c === cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>` +
          (values.length ? `<div class="review-values">${values.map((v) => `<button type="button" class="chip-button" data-hl="${esc(v)}" aria-pressed="${v === val}">${esc(v)}</button>`).join('')}</div>` : '')
        : '') +
      '<button type="button" class="button-link" data-overview>Ver el panorama</button></div>';
    const intro =
      '<p class="eyebrow">REPASO LIBRE</p><h2 class="step-title">Explora con libertad</h2>' +
      `<p>Toca cualquier paso para ver su detalle${flow.categories.length ? ', o resalta los pasos que llevan una etiqueta' : ''}.</p>`;
    cols.innerHTML =
      `<div class="card diagram-card">${filter}${legend(flow.categories)}<div class="diagram-scroll" id="diagram">${renderDiagram(laidOut, { name, colour }, marks, linkMarks(flow, false))}</div></div>` +
      `<aside class="card viewer-side">${notes.length ? `<p class="note">${DONE_ICON}<span>${notes.map(esc).join(' ')}</span></p>` : ''}` +
      `${step ? details(step, flow.categories) + linkPanel(step) : intro}</aside>`;
    const box = document.getElementById('diagram');
    if (box && jump && cat && val) scrollToHits(box, laidOut, flow.steps.filter((s) => carries(s.id)).map((s) => s.id));
    else if (box && kept) {
      box.scrollTop = kept.top;
      box.scrollLeft = kept.left;
    }
    const target = focus && cols.querySelector(focus);
    if (target) target.focus({ preventScroll: true });
  };

  const selectNode = (node) => {
    review.selected = node.getAttribute('data-id');
    review.notes = [];
    renderReview(`.node[data-id="${CSS.escape(review.selected)}"]`);
  };

  cols.addEventListener('change', (ev) => {
    if (!review || !(ev.target instanceof HTMLSelectElement) || ev.target.id !== 'hl-cat') return;
    review.cat = ev.target.value;
    review.val = '';
    renderReview('#hl-cat');
  });

  cols.addEventListener('keydown', (ev) => {
    if (!review || (ev.key !== 'Enter' && ev.key !== ' ')) return;
    const node = ev.target instanceof Element ? ev.target.closest('.node.clickable') : null;
    if (!node) return;
    ev.preventDefault();
    selectNode(node);
  });

  cols.addEventListener('pointerover', (ev) => {
    if (ev.target instanceof Element && ev.target.closest('[data-tip]')) showHoverTip(ev.target);
  });
  cols.addEventListener('pointerout', (ev) => {
    const from = ev.target instanceof Element ? ev.target.closest('[data-tip]') : null;
    if (from && !(ev.relatedTarget instanceof Node && from.contains(ev.relatedTarget))) hideHoverTip();
  });
  cols.addEventListener('focusin', (ev) => showHoverTip(ev.target));
  cols.addEventListener('focusout', hideHoverTip);

  cols.addEventListener('click', (ev) => {
    if (review) {
      const node = ev.target instanceof Element ? ev.target.closest('.node.clickable') : null;
      if (node) return selectNode(node);
      const chip = ev.target instanceof Element ? ev.target.closest('[data-hl]') : null;
      if (chip) {
        const v = chip.getAttribute('data-hl');
        review.val = review.val === v ? '' : v;
        return renderReview(`[data-hl="${CSS.escape(v)}"]`, true);
      }
      if (ev.target instanceof Element && ev.target.closest('[data-overview]')) showOverview([]);
      return;
    }
    const b = ev.target instanceof Element ? ev.target.closest('button') : null;
    if (!b || b.disabled) return;
    if (!state) {
      if (b.hasAttribute('data-review')) return showReview();
      if (b.hasAttribute('data-start')) start(b, '');
      else if (b.hasAttribute('data-restart')) confirmRestart();
      else if (b.hasAttribute('data-cancel')) cancelRestart();
      else if (b.hasAttribute('data-confirm-restart')) start(b, '/restart');
      return;
    }
    if (b.hasAttribute('data-overview')) {
      if (!state.busy) showOverview([]);
      return;
    }
    if (b.hasAttribute('data-zoom')) {
      zoomed = !zoomed;
      return renderTour('[data-zoom]');
    }
    const tour = state.tour;
    const at = tour.current().id;
    if (b.hasAttribute('data-prev')) {
      tour.prev();
      state.message = '';
      renderTour('[data-prev]');
    } else if (b.hasAttribute('data-next')) {
      if (!tour.atEnd()) {
        tour.next();
        state.message = '';
        renderTour('[data-next]');
      } else act({ at, action: 'next' }, '[data-next]');
    } else if (b.hasAttribute('data-choose')) {
      const exit = Number(b.getAttribute('data-choose'));
      if (tour.atEnd()) act({ at, action: 'choose', exit });
      else if (tour.current().chose === exit) {
        // The branch chosen here before: only the view moves.
        tour.choose(exit);
        state.message = '';
        renderTour();
      } else act({ at, action: 'choose', exit, back: tour.pos });
    }
    else if (b.hasAttribute('data-skip')) act({ at, action: 'skip' });
    else if (b.hasAttribute('data-finish')) finish();
  });

  // Arriving from a link (phase 6.4): straight into this flow's tour, as
  // «Iniciar» or «Continuar» would. An open run continues; nothing is
  // thrown away on arrival (SPEC §7).
  if (new URLSearchParams(location.search).has('recorrido')) {
    history.replaceState(null, '', location.pathname);
    const button = cols.querySelector('[data-start]');
    if (button) start(button, '');
  }
}
