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
// over them.
import Core from './core.js';
import { layoutFlow } from './diagram-layout.js';
import { renderDiagram } from './diagram.js';
import { apply, replay } from './tour-log.js';

const data = document.getElementById('flow-data');
const page = document.querySelector('.viewer');
const cols = page && page.querySelector('.viewer-cols');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const quoted = (s) => `«${esc(s)}»`;
const DONE_ICON = '<img class="icon" src="/icons/done.svg" alt="" width="18" height="18">';
// The same line as StatusLine in src/viewer.tsx, redrawn when the server
// answers a start or a finish with the new status (phase 3.4).
const STATUS_ICONS = { pending: 'pending', in_progress: 'in_progress', reviewed: 'done' };
const showStatus = (status) => {
  const line = document.getElementById('review-status');
  if (!line || !status) return;
  line.dataset.state = status.state;
  line.innerHTML = `<img class="icon" src="/icons/${STATUS_ICONS[status.state]}.svg" alt="" width="18" height="18"><strong>${esc(status.label)}</strong>${status.detail ? `<span class="muted">${esc(status.detail)}</span>` : ''}`;
};

if (data && cols) {
  const { id, name, colour, flow, status: initial } = JSON.parse(data.textContent);
  // The review status, as the server last gave it: it labels the overview's
  // buttons, and "Empezar de nuevo" shows only while it is "en curso".
  let status = initial;
  const overview = cols.innerHTML;
  const drawOverview = () => {
    const box = document.getElementById('diagram');
    if (box) box.innerHTML = renderDiagram(layoutFlow(flow), { name, colour });
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
    // Branches that meet again (phase 3.5).
    if (note.direct) return `<p class="note">Esta opción va directo a ${title(note.direct)}. Antes de seguir, mira las otras.</p>`;
    if (note.joinAt) return `<p class="note">Esta rama sigue en ${title(note.joinAt)}, igual que las otras. Vuelves a la decisión para ver las que faltan.</p>`;
    const why = note.endAt ? `Esa rama terminó en ${title(note.endAt)}. ` : note.loopTo ? 'Ese camino se repite sin llegar a un cierre. ' : '';
    const then = note.returned ? 'Vuelves a esta decisión para ver las otras opciones.' : 'Ahora sigues con una parte del flujo que faltaba.';
    return `<p class="note">${why}${then}</p>`;
  };

  const details = (step, categories) => {
    let out = `<p class="eyebrow">${esc((Core.TYPE_LABELS[step.type] || '').toUpperCase())}</p><h2 class="step-title">${esc(step.title)}</h2>`;
    out += step.description ? `<p class="step-desc">${esc(step.description)}</p>` : '<p class="muted">Este paso no tiene descripción.</p>';
    const rows = categories.filter((c) => step.tags[c] && step.tags[c].length);
    if (rows.length) {
      out += `<dl class="step-tags">${rows.map((c) => `<div><dt>${esc(c)}</dt><dd>${step.tags[c].map((v) => `<span class="chip">${esc(v)}</span>`).join('')}</dd></div>`).join('')}</dl>`;
    }
    return out;
  };

  const exitsPanel = (tour) => {
    const options = tour.options();
    if (!options.length) return '';
    const text = (o) => `${o.label ? `<strong>${esc(o.label)}</strong> · ` : ''}${esc(o.title)}`;
    if (tour.needsChoice()) {
      const buttons = options.map((o) =>
        `<button type="button" class="branch${o.taken ? ' taken' : ''}" data-choose="${o.index}">${text(o)}${o.taken ? `<span class="taken-tag">${DONE_ICON}Ya recorrida</span>` : ''}</button>`,
      ).join('');
      const skip = tour.canSkip() ? '<button type="button" class="branch" data-skip>Ir a lo que falta por visitar</button>' : '';
      const again = options.some((o) => o.taken) ? '<p class="muted small">Puedes repetir una rama ya recorrida.</p>' : '';
      return `<div class="exits"><p class="label">Elige una rama para continuar</p>${buttons}${skip}${again}</div>`;
    }
    const rows = options.map((o) => `<p class="exit-row">${text(o)}${o.visited && tour.atEnd() ? ' (ya visitado)' : ''}</p>`).join('');
    return `<div class="exits"><p class="label">${options.length === 1 ? 'Sigue con' : 'Salidas'}</p>${rows}</div>`;
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

  const scrollToCurrent = (box, layout, current) => {
    const node = layout.nodes.find((n) => n.id === current);
    const svg = box.querySelector('svg');
    if (!node || !svg) return;
    const k = svg.getBoundingClientRect().width / layout.width || 1;
    box.scrollTop = Math.max(0, node.y * k - box.clientHeight / 2);
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
      `<button type="button" class="button-link" data-overview>Ver el flujo completo</button></div>` +
      `<div class="diagram-scroll" id="diagram">${renderDiagram(layout, { name, colour }, marks(tour, toured.categories))}</div>` +
      `<div class="diagram-actions"><p class="tour-message" role="status">${esc(state.message)}</p>` +
      `<button type="button" class="button-secondary" data-prev${tour.pos === 0 ? ' disabled' : ''}>Anterior</button>${primary}</div></div>` +
      `<aside class="card viewer-side">${tour.atEnd() ? noteFor(tour.current().note) : ''}${details(step, toured.categories)}${exitsPanel(tour)}</aside>`;
    if (state.busy) cols.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    scrollToCurrent(document.getElementById('diagram'), layout, tour.current().id);
    const target = (focus && cols.querySelector(focus)) || cols.querySelector('[data-choose]:not(.taken)') || cols.querySelector('[data-finish]') || cols.querySelector('[data-next]:not([disabled])');
    if (target && !target.disabled) target.focus({ preventScroll: true });
  };

  // `status.action` relabels the button: "Repetir recorrido" after a
  // finish, or "Iniciar recorrido" if a major release came out meanwhile.
  const showOverview = (lines) => {
    state = null;
    cols.innerHTML = overview;
    drawOverview();
    const button = cols.querySelector('[data-start]');
    if (button) button.textContent = status.action;
    const restart = cols.querySelector('[data-restart]');
    if (restart) restart.hidden = status.state !== 'in_progress';
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
      return showOverview(['Flujo revisado.', res.json.newer].filter(Boolean));
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

  cols.addEventListener('click', (ev) => {
    const b = ev.target instanceof Element ? ev.target.closest('button') : null;
    if (!b || b.disabled) return;
    if (!state) {
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
    } else if (b.hasAttribute('data-choose')) act({ at, action: 'choose', exit: Number(b.getAttribute('data-choose')) });
    else if (b.hasAttribute('data-skip')) act({ at, action: 'skip' });
    else if (b.hasAttribute('data-finish')) finish();
  });
}
