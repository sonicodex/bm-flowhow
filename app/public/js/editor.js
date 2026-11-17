// The step grid (SPEC §6; phase 5.3): one row per step, typed in place. The
// operations live in grid-edit.js; this file draws the table, keeps
// "Depende de" and "Salidas" in step, checks the grid as the server will,
// and saves it (POST /flows/:id/draft, src/draft.ts).
import Core from './core.js';
import { blankRow, checkGrid, dependsOnText, dropValues, nextStepId, renameStep, setDependsOn, suggestions, toSave } from './grid-edit.js';

const dataEl = document.getElementById('editor-data');
const table = document.getElementById('step-grid');
const panel = document.getElementById('editor-panel');
const problems = document.getElementById('problems');
const statusEl = document.getElementById('save-status');
const saveButton = document.querySelector('[data-save]');
const addButton = document.querySelector('[data-add]');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ICON = (name, alt = '') => `<img class="icon" src="/icons/${name}.svg" alt="${esc(alt)}" width="18" height="18">`;
const POINTING = new Set(['link', 'subflow']);

if (dataEl && table) {
  const data = JSON.parse(dataEl.textContent);
  const grid = data.grid;
  const rows = grid.rows;
  const locked = new Set(data.lockedIds);
  const ctx = { flowId: data.flowId, name: data.name, flows: data.flows };
  let base = data.base;
  let savedJson = JSON.stringify(toSave(grid));
  let saving = false;
  let leaving = false;
  /** The last step taken out, to put back. */
  let removed = null;

  // ---- Drawing ----

  const datalist = document.createElement('datalist');
  datalist.id = 'cell-suggestions';
  document.body.append(datalist);

  const cell = (i, f, value, label, extra = '') =>
    `<td><input type="text" data-r="${i}" data-f="${f}" value="${esc(value)}" aria-label="${esc(label)}" autocomplete="off"${extra}></td>`;

  function rowHtml(r, i) {
    const n = i + 2;
    const isLocked = locked.has(String(r.id).trim());
    const types = data.types.map((t) => `<option value="${t.value}"${t.value === r.type ? ' selected' : ''}>${esc(t.label)}</option>`).join('');
    const known = data.types.some((t) => t.value === r.type);
    const typeOptions = (known ? '' : `<option value="${esc(r.type)}" selected>${esc(r.type)}</option>`) + types;
    const others = data.flows.filter((f) => f.id !== data.flowId);
    const refKnown = !r.ref || others.some((f) => Core.norm(f.name) === Core.norm(r.ref));
    const refOptions =
      '<option value="">—</option>' +
      (refKnown ? '' : `<option value="${esc(r.ref)}" selected>${esc(r.ref)}</option>`) +
      others.map((f) => `<option value="${esc(f.name)}"${Core.norm(f.name) === Core.norm(r.ref) ? ' selected' : ''}>${esc(f.name)}</option>`).join('');
    return (
      `<tr data-row="${i}">` +
      `<th scope="row" class="grid-num"><span class="grid-alert" hidden>${ICON('alert', 'Con problemas')}</span>${n}</th>` +
      cell(i, 'id', r.id, `ID, fila ${n}`, isLocked ? ' readonly class="locked" title="Este paso ya está publicado: su ID no cambia."' : '') +
      `<td><select data-r="${i}" data-f="type" aria-label="Tipo, fila ${n}">${typeOptions}</select></td>` +
      `<td><select data-r="${i}" data-f="ref" aria-label="Flujo de destino, fila ${n}"${POINTING.has(r.type) ? '' : ' disabled'}>${refOptions}</select></td>` +
      `<td><textarea data-r="${i}" data-f="title" rows="1" aria-label="Título, fila ${n}">${esc(r.title)}</textarea></td>` +
      `<td><textarea data-r="${i}" data-f="description" rows="1" aria-label="Descripción, fila ${n}">${esc(r.description)}</textarea></td>` +
      grid.categories.map((c) => cell(i, 'tag', r.tags[c], `${c}, fila ${n}`, ` data-c="${esc(c)}" list="cell-suggestions"`)).join('') +
      cell(i, 'dep', dependsOnText(rows, i), `Depende de, fila ${n}`, ' list="cell-suggestions"') +
      cell(i, 'exits', r.exits, `Salidas, fila ${n}`, ' list="cell-suggestions"') +
      `<td><button type="button" class="icon-button" data-remove="${i}" aria-label="Quitar el paso de la fila ${n}"><span class="icon-close" aria-hidden="true"></span></button></td>` +
      '</tr>'
    );
  }

  function render() {
    const head =
      '<thead><tr><th scope="col" class="grid-num">Fila</th><th scope="col" class="c-id">ID</th><th scope="col" class="c-type">Tipo</th>' +
      '<th scope="col" class="c-ref">Flujo</th><th scope="col" class="c-title">Título</th><th scope="col" class="c-desc">Descripción</th>' +
      grid.categories.map((c) => `<th scope="col" class="c-tag">${esc(c)}</th>`).join('') +
      '<th scope="col" class="c-dep">Depende de</th><th scope="col" class="c-exits">Salidas</th><th scope="col" class="c-remove"><span class="visually-hidden">Quitar</span></th></tr></thead>';
    const span = grid.categories.length + 9;
    const body = rows.length
      ? rows.map(rowHtml).join('')
      : `<tr><td colspan="${span}" class="grid-empty">Este flujo todavía no tiene pasos. Agrega el primero con «Agregar paso», o impórtalos desde Excel.</td></tr>`;
    table.innerHTML = head + '<tbody>' + body + '</tbody>';
    refresh();
  }

  const field = (i, f) => table.querySelector(`[data-r="${i}"][data-f="${f}"]`);

  // Rewrites the connection cells from the rows, except the one being typed in.
  function syncConnections() {
    rows.forEach((r, i) => {
      const dep = field(i, 'dep');
      const exits = field(i, 'exits');
      if (dep && dep !== document.activeElement) dep.value = dependsOnText(rows, i);
      if (exits && exits !== document.activeElement) exits.value = r.exits;
    });
  }

  // ---- Checking ----

  const dirty = () => JSON.stringify(toSave(grid)) !== savedJson;

  function refresh() {
    const errors = checkGrid(grid, ctx);
    const bad = new Set(errors.filter((e) => e.row !== null).map((e) => e.row));
    table.querySelectorAll('tr[data-row]').forEach((tr) => {
      const has = bad.has(Number(tr.dataset.row));
      tr.classList.toggle('has-error', has);
      tr.querySelector('.grid-alert').hidden = !has;
    });
    const item = (e) =>
      `<li>${ICON('alert')}${e.row === null ? `<span>${esc(e.message)}</span>` : `<button type="button" class="button-link" data-goto="${e.row}">${esc(e.message)}</button>`}</li>`;
    const blocking = errors.filter((e) => e.blocking);
    const rest = errors.filter((e) => !e.blocking);
    problems.innerHTML = !errors.length
      ? `<p class="editor-ok">${ICON('done')}<span>La tabla no tiene problemas.</span></p>`
      : (blocking.length ? `<h2>Antes de guardar, corrige ${count(blocking.length)}</h2><ul>${blocking.map(item).join('')}</ul>` : '') +
        (rest.length ? `<h2>Para publicar, corrige ${count(rest.length)}</h2><ul>${rest.map(item).join('')}</ul>` : '');
    showDirty();
    return errors;
  }
  const count = (n) => (n === 1 ? '1 problema' : `${n} problemas`);

  let timer = 0;
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 200);
  };

  function showDirty() {
    if (saving) return;
    const d = dirty();
    saveButton.disabled = !d;
    if (d) statusEl.textContent = 'Cambios sin guardar';
    else if (statusEl.textContent === 'Cambios sin guardar') statusEl.textContent = '';
  }

  // ---- Messages above the grid ----

  // What the panel shows: an error goes away with the next edit, a question
  // (new values) stays until answered.
  let panelKind = '';
  function say(html, kind = 'status') {
    panelKind = html ? kind : '';
    panel.innerHTML = html ? `<div class="card editor-message${kind === 'error' ? ' is-error' : ''}" role="${kind === 'error' ? 'alert' : 'status'}">${html}</div>` : '';
  }

  // ---- Editing ----

  table.addEventListener('input', (ev) => {
    const t = ev.target;
    if (panelKind === 'error') say('');
    const i = Number(t.dataset.r);
    const r = rows[i];
    if (!r) return;
    const f = t.dataset.f;
    if (f === 'title' || f === 'description') r[f] = t.value;
    else if (f === 'tag') r.tags[t.dataset.c] = t.value;
    else if (f === 'exits') {
      r.exits = t.value;
      syncConnections();
    } else return fillSuggestions(t);
    if (t.list) fillSuggestions(t);
    later();
  });

  table.addEventListener('change', (ev) => {
    const t = ev.target;
    const i = Number(t.dataset.r);
    const r = rows[i];
    if (!r) return;
    const f = t.dataset.f;
    if (f === 'type') {
      r.type = t.value;
      const ref = field(i, 'ref');
      ref.disabled = !POINTING.has(r.type);
      if (ref.disabled) {
        r.ref = '';
        ref.value = '';
      }
    } else if (f === 'ref') r.ref = t.value;
    else if (f === 'id') {
      const res = renameStep(rows, i, t.value);
      if (!res.ok) {
        say(esc(res.message), 'error');
        t.value = r.id;
      } else say('');
      syncConnections();
    } else if (f === 'dep') {
      const message = setDependsOn(rows, i, t.value);
      say(message ? esc(message) : '', message ? 'error' : 'status');
      t.value = dependsOnText(rows, i);
      syncConnections();
    } else return;
    refresh();
  });

  // Suggestions for the cell in focus: one datalist, refilled for it.
  function fillSuggestions(t) {
    const f = t.dataset.f;
    let options = [];
    let kind = 'steps';
    if (f === 'tag') {
      options = (data.values[t.dataset.c] || []).map((v) => ({ value: v }));
      kind = 'tags';
    } else if (f === 'exits' || f === 'dep') {
      const own = String(rows[Number(t.dataset.r)].id).trim();
      options = rows.filter((r) => String(r.id).trim() && String(r.id).trim() !== own).map((r) => ({ value: String(r.id).trim(), label: r.title }));
    } else return;
    datalist.innerHTML = suggestions(t.value, options, kind)
      .map((o) => `<option value="${esc(o.value)}"${o.label ? ` label="${esc(o.label)}"` : ''}></option>`)
      .join('');
  }
  table.addEventListener('focusin', (ev) => {
    if (ev.target.list) fillSuggestions(ev.target);
  });

  // Enter moves down the column, as in a spreadsheet: in every cell but a
  // description, where it starts a new line. A title is a textarea only so
  // that a long one shows whole; it has no lines of its own.
  table.addEventListener('keydown', (ev) => {
    const t = ev.target;
    if (ev.key !== 'Enter' || ev.isComposing || ev.shiftKey) return;
    if (!(t.tagName === 'INPUT' || (t.tagName === 'TEXTAREA' && t.dataset.f === 'title'))) return;
    ev.preventDefault();
    t.dispatchEvent(new Event('change', { bubbles: true }));
    const same = `[data-r="${Number(t.dataset.r) + 1}"][data-f="${t.dataset.f}"]` + (t.dataset.c ? `[data-c="${CSS.escape(t.dataset.c)}"]` : '');
    const next = table.querySelector(same);
    if (next) next.focus();
  });

  table.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-remove]');
    if (!b) return;
    const i = Number(b.dataset.remove);
    const [row] = rows.splice(i, 1);
    removed = { row, index: i };
    render();
    say(`Se quitó el paso «${esc(row.title || row.id)}». <button type="button" class="button-link" data-undo>Deshacer</button>`);
    const next = table.querySelector(`[data-remove="${Math.min(i, rows.length - 1)}"]`);
    (next || addButton).focus();
  });

  panel.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-undo]') && removed) {
      rows.splice(removed.index, 0, removed.row);
      const at = removed.index;
      removed = null;
      say('');
      render();
      field(at, 'title').focus();
    }
  });

  problems.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-goto]');
    if (!b) return;
    const el = field(Number(b.dataset.goto), 'title');
    if (el) {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      el.focus();
    }
  });

  addButton.addEventListener('click', () => {
    rows.push(blankRow(grid.categories, nextStepId(rows, data.lockedIds)));
    removed = null;
    say('');
    render();
    field(rows.length - 1, 'title').focus();
  });

  // ---- Saving ----

  async function save(accepted) {
    const errors = refresh();
    if (errors.some((e) => e.blocking)) {
      say('No se guardó: primero corrige los problemas de la lista «Antes de guardar».', 'error');
      problems.scrollIntoView({ block: 'nearest' });
      return;
    }
    saving = true;
    saveButton.disabled = true;
    statusEl.textContent = 'Guardando…';
    const sent = toSave(grid);
    let answer;
    try {
      const res = await fetch(`/flows/${data.flowId}/draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ grid: sent, base, ...(accepted ? { accepted } : {}) }),
      });
      answer = await res.json();
    } catch {
      answer = { status: 'invalid', error: 'No se pudo guardar: revisa la conexión y vuelve a intentarlo.' };
    }
    saving = false;
    statusEl.textContent = '';
    if (answer.status === 'saved') {
      base = answer.base;
      savedJson = JSON.stringify(sent);
      say('');
      const at = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' });
      statusEl.textContent = answer.saved ? `Guardado a las ${at}` : 'No había cambios que guardar';
    } else if (answer.status === 'confirm') confirmNew(answer);
    else if (answer.status === 'conflict') {
      say(`${esc(answer.message)} <button type="button" class="button-link" data-reload>Recargar</button> <span class="muted">(se pierden los cambios que no has guardado)</span>`, 'error');
    } else if (answer.status === 'blocked') {
      say(`No se guardó: ${answer.errors.map((e) => esc(e.message)).join(' ')}`, 'error');
    } else say(esc(answer.error || 'No se pudo guardar.'), 'error');
    showDirty();
  }

  // New values typed in the grid: accept or reject each before anything is
  // written (phase 5 plan, answer 2). Rejected ones leave the cells too.
  function confirmNew(answer) {
    const item = (kind, value, label) =>
      `<label><input type="checkbox" data-new="${kind}" value="${esc(JSON.stringify(value))}" checked> ${esc(label)}</label>`;
    say(
      '<h2>Valores nuevos</h2><p>Estos valores no existían. Marca los que quieres crear; los que desmarques se quitan de la tabla.</p>' +
        '<div class="choice-list">' +
        answer.newCategories.map((c) => item('category', c, `Categoría nueva: ${c}`)).join('') +
        answer.newTags.map((t) => item('tag', t, `${t.category}: ${t.name}`)).join('') +
        '</div><div class="editor-message-actions"><button type="button" class="button-primary" data-accept>Crear y guardar</button>' +
        '<button type="button" class="button-secondary" data-cancel>Volver a la tabla</button></div>',
      'question',
    );
    panel.querySelector('input').focus();
  }

  panel.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-reload]')) {
      leaving = true;
      location.reload();
    } else if (ev.target.closest('[data-cancel]')) {
      say('');
      showDirty();
    } else if (ev.target.closest('[data-accept]')) {
      const boxes = [...panel.querySelectorAll('input[data-new]')];
      const pick = (kind, checked) => boxes.filter((b) => b.dataset.new === kind && b.checked === checked).map((b) => JSON.parse(b.value));
      const rejected = pick('tag', false);
      if (rejected.length) {
        dropValues(grid, rejected);
        render();
      }
      save({ categories: pick('category', true), tags: pick('tag', true) });
    }
  });

  saveButton.addEventListener('click', () => save());
  document.addEventListener('keydown', (ev) => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      document.activeElement?.dispatchEvent(new Event('change', { bubbles: true }));
      if (dirty() && !saving) save();
    }
  });

  window.addEventListener('beforeunload', (ev) => {
    if (dirty() && !leaving) ev.preventDefault();
  });

  render();
}
