// The step grid (SPEC §6; phase 5.3): one row per step, typed in place. The
// operations live in grid-edit.js; this file draws the table, keeps
// "Depende de" and "Salidas" in step, checks the grid as the server will,
// redraws the preview beside it (phase 5.4), and saves it
// (POST /flows/:id/draft, src/draft.ts).
import Core from './core.js';
import { layoutFlow } from './diagram-layout.js';
import { renderDiagram } from './diagram.js';
import { exportName, exportXlsx, gridFromText, gridFromXlsx, TEMPLATE_NAME, templateXlsx } from './import-form.js';
import {
  blankRow, branchesOf, checkGrid, cleanLabel, compileGrid, dependsOnIds, dependsOnView, diagramKey, dropValues, nextStepId, renameStep,
  setBranches, setDependsOnIds, stepOptions, suggestions, toSave,
} from './grid-edit.js';

const dataEl = document.getElementById('editor-data');
const table = document.getElementById('step-grid');
const panel = document.getElementById('editor-panel');
const problems = document.getElementById('problems');
const statusEl = document.getElementById('save-status');
const saveButton = document.querySelector('[data-save]');
const addButton = document.querySelector('[data-add]');
const preview = document.getElementById('preview');
const previewCard = document.getElementById('preview-card');
const previewToggle = document.querySelector('[data-preview-toggle]');
const importBox = document.getElementById('import-box');
const importButton = document.querySelector('[data-import]');
const reviewEl = document.getElementById('import-review');
const cols = document.querySelector('.editor-cols');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Problems in table order (a stable sort): the flow's own, with no row, first. */
const byRow = (errors) => errors.slice().sort((a, b) => (a.row ?? -1) - (b.row ?? -1));
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
      cell(i, 'dep', dependsOnView(rows, i), `Depende de, fila ${n}`, ' list="cell-suggestions"') +
      `<td data-cell="exits" data-r="${i}" data-key="${esc(cellKey(i))}">${cellInner(i)}</td>` +
      `<td><textarea data-r="${i}" data-f="description" rows="1" aria-label="Descripción, fila ${n}">${esc(r.description)}</textarea></td>` +
      grid.categories.map((c) => cell(i, 'tag', r.tags[c], `${c}, fila ${n}`, ` data-c="${esc(c)}" list="cell-suggestions"`)).join('') +
      `<td><button type="button" class="icon-button" data-remove="${i}" aria-label="Quitar el paso de la fila ${n}"><span class="icon-close" aria-hidden="true"></span></button></td>` +
      '</tr>'
    );
  }

  function render() {
    const head =
      '<thead><tr><th scope="col" class="grid-num">Fila</th><th scope="col" class="c-id">ID</th><th scope="col" class="c-type">Tipo</th>' +
      // Depende de and Salidas right after the title: connecting steps from
      // either side is what the editor is for, so it stays in view on a
      // laptop (SPEC §6). The export keeps the Excel order (import-form.js).
      '<th scope="col" class="c-ref">Flujo</th><th scope="col" class="c-title">Título</th>' +
      '<th scope="col" class="c-dep">Depende de</th><th scope="col" class="c-exits">Salidas</th><th scope="col" class="c-desc">Descripción</th>' +
      grid.categories.map((c) => `<th scope="col" class="c-tag">${esc(c)}</th>`).join('') +
      '<th scope="col" class="c-remove"><span class="visually-hidden">Quitar</span></th></tr></thead>';
    const span = grid.categories.length + 9;
    const body = rows.length
      ? rows.map(rowHtml).join('')
      : `<tr><td colspan="${span}" class="grid-empty">Este flujo todavía no tiene pasos. Agrega el primero con «Agregar paso», o impórtalos desde Excel.</td></tr>`;
    table.innerHTML = head + '<tbody>' + body + '</tbody>';
    refresh();
  }

  const field = (i, f) => table.querySelector(`[data-r="${i}"][data-f="${f}"]`);

  // ---- Connections (SPEC §6; phase 5.10, revised). Nobody types the
  // label:target syntax; the cell still holds it (grid-edit.js), which is
  // what reaches Excel.
  //  - A decision's "Salidas" is a list, one line per branch: a label field
  //    and a step picker, with a way to add and remove one. A label is
  //    edited only here. A line with no step yet lives only on screen.
  //  - Every other "Salidas" is a plain field: there is normally one exit.
  //  - "Depende de" is a plain field on every row. It picks predecessors by
  //    id and shows a decision's labels in parentheses, «P2 (Sí)», which it
  //    never changes; while it is edited it holds the ids only.
  // Only decision rows grow; every other row stays one line. ----

  const optionText = (o) => (o.title ? `${o.id} — ${o.title}` : o.id);

  /** What the Salidas cell shows; when it changes, the cell is drawn again. */
  function cellKey(i) {
    if (rows[i].type !== 'decision') return 'text';
    const options = stepOptions(rows, i).map((o) => o.id).join(' ');
    return `${rows[i].exits}|${options}`;
  }

  /** A decision's branches, and an empty second one when it has fewer than two. */
  function storedLines(i) {
    const lines = branchesOf(rows, i);
    while (lines.length < 2) lines.push({ label: '', to: '' });
    return lines;
  }

  function cellInner(i, lines = null) {
    const n = i + 2;
    if (rows[i].type !== 'decision') {
      return `<input type="text" data-r="${i}" data-f="exits" value="${esc(rows[i].exits)}" aria-label="Salidas, fila ${n}" autocomplete="off" list="cell-suggestions">`;
    }
    lines = lines || storedLines(i);
    const options = stepOptions(rows, i);
    const done = lines.filter((l) => l.to).length;
    const items = lines.map((l, b) => {
      const m = b + 1;
      const missingLabel = l.to && !l.label.trim();
      const missingStep = !l.to && done < 2;
      const known = !l.to || options.some((o) => o.id === l.to);
      const choices =
        `<option value="">Elige un paso</option>` +
        (known ? '' : `<option value="${esc(l.to)}" selected>${esc(l.to)} (no existe)</option>`) +
        options.map((o) => `<option value="${esc(o.id)}" data-step="${esc(o.id)}"${o.id === l.to ? ' selected' : ''}>${esc(optionText(o))}</option>`).join('');
      return (
        '<div class="grid-branch">' +
        `<input type="text" data-r="${i}" data-f="exits" data-k="label" data-b="${b}" value="${esc(l.label)}" placeholder="p. ej. Sí" autocomplete="off"` +
        ` aria-label="Rótulo de la rama ${m}, fila ${n}"${missingLabel ? ' aria-invalid="true"' : ''}>` +
        `<select data-r="${i}" data-f="exits" data-k="to" data-b="${b}" aria-label="Paso al que lleva la rama ${m}, fila ${n}"${missingStep ? ' aria-invalid="true"' : ''}>${choices}</select>` +
        `<button type="button" class="icon-button" data-r="${i}" data-f="exits" data-k="remove" data-b="${b}" aria-label="Quitar la rama ${m}, fila ${n}">` +
        '<span class="icon-close" aria-hidden="true"></span></button>' +
        '</div>'
      );
    });
    return (
      `<div class="grid-branches">${items.join('')}` +
      `<button type="button" class="button-link grid-branch-add" data-r="${i}" data-f="exits" data-k="add" aria-label="Agregar rama, fila ${n}">Agregar rama</button></div>`
    );
  }

  const cellOf = (i) => table.querySelector(`td[data-cell="exits"][data-r="${i}"]`);

  /** The lines as they are on screen, the empty ones included. */
  const screenLines = (td) =>
    [...td.querySelectorAll('.grid-branch')].map((el) => ({ label: el.querySelector('[data-k="label"]').value, to: el.querySelector('[data-k="to"]').value }));

  /** Draws a Salidas cell again, from the given lines or the stored ones, keeping focus on the same control. */
  function drawCell(i, lines = null, focus = null) {
    const td = cellOf(i);
    if (!td) return;
    td.innerHTML = cellInner(i, lines);
    td.dataset.key = cellKey(i);
    if (focus) td.querySelector(`[data-k="${focus.k}"]${focus.b === undefined ? '' : `[data-b="${focus.b}"]`}`)?.focus();
  }

  // Rewrites the connection cells from the rows, except the one being edited,
  // which keeps what is on screen.
  function syncConnections() {
    rows.forEach((r, i) => {
      const dep = field(i, 'dep');
      if (dep && dep !== document.activeElement) dep.value = dependsOnView(rows, i);
      const td = cellOf(i);
      if (!td) return;
      const key = cellKey(i);
      if (key === 'text' && td.dataset.key === 'text') {
        const input = td.querySelector('input');
        if (input !== document.activeElement) input.value = r.exits;
      } else if (td.contains(document.activeElement) && key !== 'text' && td.dataset.key !== 'text') td.dataset.key = key;
      else if (td.dataset.key !== key) drawCell(i);
    });
  }

  // A step's title changed: the pickers that name it say the new one.
  function renameOptions(i) {
    const id = String(rows[i].id).trim();
    if (!id) return;
    const text = optionText({ id, title: String(rows[i].title || '').trim() });
    table.querySelectorAll(`option[data-step="${CSS.escape(id)}"]`).forEach((o) => {
      o.textContent = text;
    });
  }

  function onLine(t, ev) {
    const i = Number(t.dataset.r);
    const td = cellOf(i);
    const k = t.dataset.k;
    const b = Number(t.dataset.b);
    if (k === 'label' && ev.type === 'input') {
      const clean = cleanLabel(t.value);
      if (clean.cut) {
        t.value = clean.label;
        say('Un rótulo no puede llevar coma, | ni ;.', 'error');
      }
      if (!t.value.trim() && screenLines(td)[b].to) t.setAttribute('aria-invalid', 'true');
      else t.removeAttribute('aria-invalid');
      setBranches(rows, i, screenLines(td));
      td.dataset.key = cellKey(i);
    } else if (k === 'to' && ev.type === 'change') {
      if (panelKind === 'error') say('');
      const lines = screenLines(td);
      setBranches(rows, i, lines);
      drawCell(i, lines, { k, b });
    } else if (k === 'add' && ev.type === 'click') {
      const lines = screenLines(td).concat([{ label: '', to: '' }]);
      drawCell(i, lines, { k: 'label', b: lines.length - 1 });
      return;
    } else if (k === 'remove' && ev.type === 'click') {
      const lines = screenLines(td);
      lines.splice(b, 1);
      setBranches(rows, i, lines);
      const kept = lines.length >= 2 ? lines : null;
      drawCell(i, kept, { k: 'remove', b: Math.min(b, (kept || storedLines(i)).length - 1) });
    } else return;
    syncConnections();
    later();
  }

  // Text pasted into a branch (from Excel, say "Sí:P3, No:P4") goes straight
  // into the cell, as SPEC §6 asks: the list is drawn again from it. A plain
  // label, with none of the cell's signs, is pasted into its field.
  table.addEventListener('paste', (ev) => {
    const t = ev.target;
    if (t.dataset.k !== 'label') return;
    const text = (ev.clipboardData?.getData('text/plain') || '').trim();
    if (!/[,|;:\t\n]/.test(text)) return;
    ev.preventDefault();
    const i = Number(t.dataset.r);
    rows[i].exits = text.replace(/\s*[\t\n]+\s*/g, ', ');
    say('');
    drawCell(i, null, { k: 'label', b: 0 });
    syncConnections();
    later();
  });

  // "Depende de" holds the ids while it is edited, and shows the labels again after.
  table.addEventListener('focusin', (ev) => {
    const t = ev.target;
    if (t.dataset.f === 'dep' && !t.dataset.k) t.value = dependsOnIds(rows, Number(t.dataset.r));
  });
  table.addEventListener('focusout', (ev) => {
    const t = ev.target;
    if (t.dataset.f === 'dep' && rows[Number(t.dataset.r)]) t.value = dependsOnView(rows, Number(t.dataset.r));
  });

  // ---- Checking ----

  const dirty = () => JSON.stringify(toSave(grid)) !== savedJson;

  function refresh() {
    const compiled = compileGrid(grid, ctx);
    const errors = checkGrid(grid, ctx, compiled);
    drawPreview(compiled.flow);
    const bad = new Set(errors.filter((e) => e.row !== null).map((e) => e.row));
    table.querySelectorAll('tr[data-row]').forEach((tr) => {
      const has = bad.has(Number(tr.dataset.row));
      tr.classList.toggle('has-error', has);
      tr.querySelector('.grid-alert').hidden = !has;
    });
    const item = (e) =>
      `<li>${ICON('alert')}${e.row === null ? `<span>${esc(e.message)}</span>` : `<button type="button" class="button-link" data-goto="${e.row}">${esc(e.message)}</button>`}</li>`;
    // In table order, so a row's problems sit together; the flow's own first.
    const blocking = byRow(errors.filter((e) => e.blocking));
    const rest = byRow(errors.filter((e) => !e.blocking));
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

  // ---- The preview (SPEC §6: read-only, beside the grid, redrawn while
  // editing). Laid out again only when what it draws changed. ----

  let drawn = null;
  /** The step whose row has focus: marked on the diagram as the active step. */
  let selected = '';

  function drawPreview(flow) {
    // Folded away: nothing is laid out until it opens.
    if (previewCard.hidden) return;
    const key = diagramKey(flow);
    if (key === drawn) return;
    drawn = key;
    try {
      preview.innerHTML = renderDiagram(layoutFlow(flow), { name: data.name, colour: data.colour });
    } catch {
      // A grid half typed can be one no layout expects; the next edit redraws.
      preview.innerHTML = '<p class="muted">La vista previa se dibuja de nuevo cuando la tabla esté completa.</p>';
    }
    markSelected();
  }

  function markSelected() {
    preview.querySelectorAll('.node.selected').forEach((g) => g.classList.remove('selected'));
    const node = selected && preview.querySelector(`.node[data-id="${CSS.escape(selected)}"]`);
    if (!node) return;
    node.classList.add('selected');
    // Keep it in view inside the preview, without moving the page.
    const box = preview.getBoundingClientRect();
    const at = node.getBoundingClientRect();
    if (at.top < box.top || at.bottom > box.bottom) preview.scrollTop += at.top - box.top - (box.height - at.height) / 2;
    if (at.left < box.left || at.right > box.right) preview.scrollLeft += at.left - box.left - (box.width - at.width) / 2;
  }

  // Open or folded (SPEC §6): folded by default, so the grid has the width.
  // The choice is remembered per person on this device: a large screen
  // opens it once, a phone keeps it folded. Storage may be unavailable;
  // then it simply starts folded every time.
  const previewKey = `flowhow.editor.preview.${data.userId}`;
  function showPreview(open, remember) {
    previewCard.hidden = !open;
    cols.classList.toggle('is-folded', !open);
    previewToggle.setAttribute('aria-expanded', String(open));
    previewToggle.textContent = open ? 'Ocultar vista previa' : 'Mostrar vista previa';
    if (remember) {
      try {
        if (open) localStorage.setItem(previewKey, 'open');
        else localStorage.removeItem(previewKey);
      } catch {
        // Not remembered; the editor works the same.
      }
    }
    if (open) {
      drawn = null;
      drawPreview(compileGrid(grid, ctx).flow);
    }
  }
  previewToggle.addEventListener('click', () => showPreview(previewCard.hidden, true));
  try {
    if (localStorage.getItem(previewKey) === 'open') showPreview(true, false);
  } catch {
    // Starts folded.
  }

  table.addEventListener('focusin', (ev) => {
    const r = rows[Number(ev.target.dataset?.r)];
    const id = r ? String(r.id).trim() : '';
    if (id !== selected) {
      selected = id;
      markSelected();
    }
  });

  // A step on the diagram leads to its row.
  preview.addEventListener('click', (ev) => {
    const node = ev.target.closest('.node[data-id]');
    if (!node) return;
    const i = rows.findIndex((r) => String(r.id).trim() === node.dataset.id);
    const el = i === -1 ? null : field(i, 'title');
    if (!el) return;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    el.focus({ preventScroll: true });
    selected = node.dataset.id;
    markSelected();
  });

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
    if (t.dataset.k) return onLine(t, ev);
    if (panelKind === 'error') say('');
    const i = Number(t.dataset.r);
    const r = rows[i];
    if (!r) return;
    const f = t.dataset.f;
    if (f === 'title' || f === 'description') {
      r[f] = t.value;
      if (f === 'title') renameOptions(i);
    }
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
    if (t.dataset.k) return onLine(t, ev);
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
      // "Salidas" becomes a list of branches on a decision, a plain field
      // otherwise; "Depende de" elsewhere shows or drops its labels.
      syncConnections();
    } else if (f === 'ref') r.ref = t.value;
    else if (f === 'id') {
      const res = renameStep(rows, i, t.value);
      if (!res.ok) {
        say(esc(res.message), 'error');
        t.value = r.id;
      } else {
        say('');
        selected = String(r.id).trim();
      }
      syncConnections();
    } else if (f === 'dep') {
      const message = setDependsOnIds(rows, i, t.value);
      say(message ? esc(message) : '', message ? 'error' : 'status');
      t.value = document.activeElement === t ? dependsOnIds(rows, i) : dependsOnView(rows, i);
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
    if (t.dataset.k === 'label') {
      ev.preventDefault();
      t.closest('.grid-branch').querySelector('[data-k="to"]').focus();
      return;
    }
    if (t.dataset.k) return;
    if (!(t.tagName === 'INPUT' || (t.tagName === 'TEXTAREA' && t.dataset.f === 'title'))) return;
    ev.preventDefault();
    t.dispatchEvent(new Event('change', { bubbles: true }));
    const same = `[data-r="${Number(t.dataset.r) + 1}"][data-f="${t.dataset.f}"]` + (t.dataset.c ? `[data-c="${CSS.escape(t.dataset.c)}"]` : '');
    const next = table.querySelector(same);
    if (next) next.focus();
  });

  table.addEventListener('click', (ev) => {
    const line = ev.target.closest('[data-k="add"], [data-k="remove"]');
    if (line) return onLine(line, ev);
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
    // The row's first marked field (an empty label, a missing branch), else its title.
    const tr = table.querySelector(`tr[data-row="${Number(b.dataset.goto)}"]`);
    const el = tr?.querySelector('[aria-invalid="true"]:not([hidden])') || field(Number(b.dataset.goto), 'title');
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

  /** @returns {Promise<boolean>} whether the grid is now saved */
  async function save(accepted) {
    const errors = refresh();
    if (errors.some((e) => e.blocking)) {
      say('No se guardó: primero corrige los problemas de la lista «Antes de guardar».', 'error');
      problems.scrollIntoView({ block: 'nearest' });
      return false;
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
      // The first save over a release makes a draft: the line under the
      // title says so (the same words as src/editor.tsx sourceLine).
      if (data.published && !base.startsWith('draft:') && answer.base.startsWith('draft:')) {
        document.getElementById('source-line').textContent = `Borrador sobre la versión publicada ${data.published}. Nadie lo ve hasta que lo publiques.`;
      }
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
    return answer.status === 'saved';
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
    if ((dirty() || areasBusy || dataBusy) && !leaving) ev.preventDefault();
  });

  // ---- The flow's data (SPEC §6): a panel above the grid that starts
  // folded, as the import box does. None of it is part of the draft: each
  // change is saved at once, with no Guardar and no version. Name,
  // objective and colour go one field per request (POST /flows/:id/details),
  // one request after another. ----

  const dataBox = document.getElementById('flow-data');
  const dataButton = document.querySelector('[data-flow-data]');
  const dataStatus = document.getElementById('flow-data-status');
  const nameInput = document.getElementById('flow-name');
  const objectiveInput = document.getElementById('flow-objective');
  let dataQueue = Promise.resolve();
  let dataBusy = 0;

  function openData(open, focus = true) {
    dataBox.hidden = !open;
    dataButton.setAttribute('aria-expanded', String(open));
    if (!focus) return;
    if (open) nameInput.focus();
    else dataButton.focus();
  }
  dataButton.addEventListener('click', () => openData(dataBox.hidden));

  function dataSay(text, kind = '') {
    dataStatus.textContent = text;
    dataStatus.className = kind === 'error' ? 'form-error' : 'muted';
  }

  /** Saves one field; `shown` puts the saved value on the page. */
  function saveField(body, input, shown) {
    dataBusy++;
    dataSay('Guardando…');
    dataQueue = dataQueue.then(async () => {
      let answer;
      try {
        const res = await fetch(`/flows/${data.flowId}/details`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        answer = await res.json();
      } catch {
        answer = { status: 'invalid', error: 'No se pudo guardar: revisa la conexión y vuelve a intentarlo.' };
      }
      dataBusy--;
      if (answer.status === 'saved') {
        input?.removeAttribute('aria-invalid');
        shown(answer.value);
        if (!dataBusy) dataSay('Guardado.');
      } else {
        input?.setAttribute('aria-invalid', 'true');
        dataSay(answer.error || 'No se pudo guardar.', 'error');
      }
    });
  }

  const redrawPreview = () => {
    drawn = null;
    drawPreview(compileGrid(grid, ctx).flow);
  };
  // What is typed stays in the field when it is refused, so it can be fixed.
  nameInput.addEventListener('change', () =>
    saveField({ name: nameInput.value }, nameInput, (name) => {
      nameInput.value = name;
      data.name = name;
      ctx.name = name;
      document.getElementById('flow-name-title').textContent = name;
      document.title = `Editar ${name} · FlowHow`;
      redrawPreview();
    }));
  objectiveInput.addEventListener('change', () =>
    saveField({ objective: objectiveInput.value }, objectiveInput, (objective) => {
      objectiveInput.value = objective;
    }));
  const section = document.querySelector('.editor');
  dataBox.querySelector('.swatches').addEventListener('change', (ev) => {
    const colour = Number(ev.target.value);
    saveField({ colour }, null, () => {
      section.classList.replace(`flow-${data.colour}`, `flow-${colour}`);
      data.colour = colour;
      redrawPreview();
    });
  });

  // ---- The flow's areas, in the same panel (DECISIONS, 2026-11-19), saved
  // at once on each change (POST /flows/:id/areas). One request at a time;
  // a change made meanwhile is sent after it, with the whole set. ----

  const picker = document.getElementById('area-picker');
  const areaSummary = picker.querySelector('[data-area-summary]');
  const areasStatus = document.getElementById('areas-status');
  let areasBusy = false;
  let areasAgain = false;

  const checkedAreas = () => [...picker.querySelectorAll('input[name="area"]:checked')].map((b) => Number(b.value));
  function showAreas(ids) {
    const names = data.areaOptions.filter((a) => ids.includes(a.id)).map((a) => a.name);
    areaSummary.textContent = names.length ? names.join(', ') : 'Ninguna';
  }
  function areasSay(text, kind = '') {
    areasStatus.textContent = text;
    areasStatus.className = kind === 'error' ? 'form-error' : kind === 'warning' ? 'form-warning' : 'muted';
  }

  async function saveAreas() {
    if (areasBusy) {
      areasAgain = true;
      return;
    }
    areasBusy = true;
    areasSay('Guardando las áreas…');
    let answer;
    do {
      areasAgain = false;
      const sent = checkedAreas();
      try {
        const res = await fetch(`/flows/${data.flowId}/areas`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ areaIds: sent }),
        });
        answer = await res.json();
      } catch {
        answer = { status: 'invalid', error: 'No se pudieron guardar las áreas: revisa la conexión y vuelve a intentarlo.' };
      }
      if (answer.status === 'saved') data.areaIds = sent;
    } while (areasAgain);
    areasBusy = false;
    if (answer.status === 'saved') {
      areasSay(answer.warning || 'Áreas guardadas.', answer.warning ? 'warning' : '');
      return;
    }
    // What is shown goes back to what is saved.
    for (const b of picker.querySelectorAll('input[name="area"]')) b.checked = data.areaIds.includes(Number(b.value));
    showAreas(data.areaIds);
    areasSay(answer.error || 'No se pudieron guardar las áreas.', 'error');
  }

  picker.addEventListener('change', () => {
    showAreas(checkedAreas());
    saveAreas();
  });
  // A drop-down: it closes on a press outside it, and with Escape. On the
  // press, not the click: the click on Publicar that opens it would
  // otherwise reach here and close it again.
  document.addEventListener('pointerdown', (ev) => {
    if (picker.open && !picker.contains(ev.target)) picker.open = false;
  });
  picker.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && picker.open) {
      picker.open = false;
      picker.querySelector('summary').focus();
    }
  });

  // ---- The grid's height (DECISIONS, 2026-11-19): at most what is left of
  // the window below the grid's top, so its horizontal bar is in view
  // without scrolling the page; the rows scroll inside it, under a header
  // that stays put. Never below a third of the window, for a short one. ----

  const scroller = table.closest('.table-scroll');
  const frame = scroller.parentElement;
  function fitGrid() {
    if (cols.hidden) return;
    const top = frame.getBoundingClientRect().top + window.scrollY;
    const edges = frame.offsetHeight - scroller.offsetHeight + (parseFloat(getComputedStyle(frame).marginBottom) || 0);
    scroller.style.maxHeight = `${Math.max(window.innerHeight - top - edges, window.innerHeight / 3)}px`;
  }
  // What sits above the grid changes height (a message, the import box):
  // the section's size changes with it. Setting the same height again
  // changes nothing, so this does not loop.
  new ResizeObserver(fitGrid).observe(document.querySelector('.editor'));
  window.addEventListener('resize', fitGrid);

  // ---- Publish (SPEC §6 publish validations, §8; phase 5.7). What is
  // published is the saved draft this page has open (`base`): the panel
  // asks to save first, says what blocks, and offers minor (the default)
  // or major with what each means for the people who use the flow. ----

  const publishButton = document.querySelector('[data-publish]');
  const next = (bump) => {
    const [major, minor] = data.published.split('.').map(Number);
    return bump === 'major' ? `${major + 1}.0` : `${major}.${minor + 1}`;
  };
  const actions = (main) =>
    `<div class="editor-message-actions">${main}<button type="button" class="button-secondary" data-close>Volver a la tabla</button></div>`;

  function openPublish() {
    if (dirty()) {
      say('<h2>Primero guarda los cambios</h2><p>Se publica lo guardado, y la tabla tiene cambios sin guardar.</p>' +
        actions('<button type="button" class="button-primary" data-save-publish>Guardar y seguir</button>'));
      return;
    }
    if (!base.startsWith('draft:')) {
      say(`<h2>No hay nada que publicar</h2><p>Lo que ves es la versión publicada ${esc(data.published || '')}. Cambia algo y guárdalo para publicar una versión nueva.</p>` + actions(''));
      return;
    }
    const problemsNow = refresh();
    if (problemsNow.length) {
      say(`<h2>Todavía no se puede publicar</h2><p>Corrige ${count(problemsNow.length)} de la lista bajo la tabla y guarda.</p>` + actions(''));
      problems.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (!data.published && !data.areaIds.length) {
      // The panel opens on the selector, so the area is chosen here.
      say('<h2>Falta asignar un área</h2><p>La primera publicación necesita al menos un área: sin ella nadie vería el flujo. Elígela en «Áreas que lo ven» y vuelve a publicar.</p>' + actions(''));
      openData(true, false);
      picker.open = true;
      (picker.querySelector('input, a') || picker.querySelector('summary')).focus();
      return;
    }
    const choice = data.published
      ? '<fieldset class="choice-list"><legend>¿Qué tipo de cambio es?</legend>' +
        `<label><input type="radio" name="bump" value="minor" checked> <strong>Menor: ${esc(data.published)} → ${next('minor')}</strong></label>` +
        '<p class="muted">Ajustes que no cambian el proceso. Quien ya lo revisó sigue como «Revisado».</p>' +
        `<label><input type="radio" name="bump" value="major"> <strong>Mayor: ${esc(data.published)} → ${next('major')}</strong></label>` +
        '<p class="muted">El proceso cambió. Todos deben recorrerlo de nuevo: vuelven a «Pendiente de revisión».</p></fieldset>'
      : '<p>Será la versión 1.0, la primera. Desde ese momento la ven las personas de las áreas del flujo.</p>';
    say('<h2>Publicar</h2>' + choice + '<p class="muted">La versión publicada no se puede cambiar después; los puntos guardados de este borrador se borran.</p>' +
      actions(`<button type="button" class="button-primary" data-confirm-publish>${data.published ? 'Publicar' : 'Publicar la versión 1.0'}</button>`));
  }

  async function publish(button) {
    const bump = panel.querySelector('input[name="bump"]:checked')?.value || 'minor';
    button.disabled = true;
    let answer;
    try {
      const res = await fetch(`/flows/${data.flowId}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ base, bump }),
      });
      answer = await res.json();
    } catch {
      answer = { status: 'invalid', error: 'No se pudo publicar: revisa la conexión y vuelve a intentarlo.' };
    }
    if (answer.status === 'published') {
      leaving = true;
      location.href = `/flows/${data.flowId}/edit?publicada=${encodeURIComponent(answer.version)}`;
      return;
    }
    if (answer.status === 'conflict') {
      say(`${esc(answer.message)} <button type="button" class="button-link" data-reload>Recargar</button>`, 'error');
    } else if (answer.status === 'blocked') {
      say(`<h2>No se publicó</h2><ul class="plain-list">${answer.errors.map((e) => `<li>${esc(e.message)}</li>`).join('')}</ul>`, 'error');
    } else say(esc(answer.message || answer.error || 'No se pudo publicar.'), 'error');
  }

  publishButton.addEventListener('click', openPublish);
  panel.addEventListener('click', async (ev) => {
    const t = ev.target;
    if (t.closest('[data-close]')) say('');
    else if (t.closest('[data-save-publish]') && (await save())) openPublish();
    else if (t.closest('[data-confirm-publish]')) publish(t.closest('[data-confirm-publish]'));
  });

  // ---- Template and export (SPEC §6; phase 5.6): built here, from the grid
  // on screen, unsaved edits included: what you see is what you get. ----

  const download = (bytes, name) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  document.querySelector('[data-export]').addEventListener('click', () => download(exportXlsx(toSave(grid)), exportName(data.name)));
  document.querySelector('[data-template]').addEventListener('click', () => download(templateXlsx(Object.keys(data.values)), TEMPLATE_NAME));

  // ---- Import (SPEC §6 import rules; phase 5.5): a paste or an .xlsx,
  // read here into a grid, reviewed by the server, shown with the diagram
  // it would give, and applied as a save that replaces the whole draft. ----

  const importErrors = document.getElementById('import-errors');
  const importFile = document.getElementById('import-file');
  const importPaste = document.getElementById('import-paste');

  const listErrors = (el, errors) => {
    el.innerHTML = errors.map((e) => `<li>${esc(e.message)}</li>`).join('');
    el.hidden = !errors.length;
  };

  function openImport(open) {
    importBox.hidden = !open;
    importButton.setAttribute('aria-expanded', String(open));
    if (open) (importFile.files.length ? importFile : importPaste).focus();
    else importButton.focus();
  }
  importButton.addEventListener('click', () => openImport(importBox.hidden));
  importBox.querySelector('[data-import-cancel]').addEventListener('click', () => openImport(false));
  // A message about what was chosen goes once the choice changes.
  importPaste.addEventListener('input', () => listErrors(importErrors, []));
  importFile.addEventListener('change', () => listErrors(importErrors, []));

  importBox.querySelector('[data-import-review]').addEventListener('click', async () => {
    // A file, when one is chosen, wins over the paste, and the screen says so.
    const fromFile = importFile.files.length > 0;
    if (!fromFile && !importPaste.value.trim()) {
      listErrors(importErrors, [{ message: 'Elige un archivo .xlsx o pega las celdas copiadas de Excel.' }]);
      return;
    }
    const read = fromFile ? await gridFromXlsx(new Uint8Array(await importFile.files[0].arrayBuffer())) : gridFromText(importPaste.value);
    if (read.errors.length) {
      listErrors(importErrors, read.errors);
      return;
    }
    listErrors(importErrors, []);
    let review;
    try {
      const res = await fetch(`/flows/${data.flowId}/draft/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ grid: read.grid }),
      });
      review = await res.json();
    } catch {
      review = { status: 'invalid', error: 'No se pudo revisar: revisa la conexión y vuelve a intentarlo.' };
    }
    if (review.status !== 'review') {
      listErrors(importErrors, [{ message: review.error }]);
      return;
    }
    showReview(read.grid, review, fromFile && importPaste.value.trim() ? 'Se leyó el archivo; lo pegado no se tuvo en cuenta.' : '');
  });

  function showReview(imported, review, note) {
    const steps = imported.rows.length;
    const list = (errors) => `<ul>${errors.map((e) => `<li>${ICON('alert')}<span>${esc(e.message)}</span></li>`).join('')}</ul>`;
    const blocking = byRow(review.errors.filter((e) => e.blocking));
    const rest = byRow(review.errors.filter((e) => !e.blocking));
    const box = (kind, value, label) =>
      `<label><input type="checkbox" data-new="${kind}" value="${esc(JSON.stringify(value))}" checked> ${esc(label)}</label>`;
    const fresh = review.newCategories.length + review.newTags.length;
    reviewEl.innerHTML =
      '<h2 id="review-title">Revisión de la importación</h2>' +
      `<p>${steps === 1 ? '1 paso' : `${steps} pasos`}${imported.categories.length ? ` · categorías: ${esc(imported.categories.join(', '))}` : ' · sin categorías'}.</p>` +
      (note ? `<p class="muted">${esc(note)}</p>` : '') +
      (dirty() ? '<p class="form-warning">Los cambios que no has guardado en la tabla se pierden al reemplazarla.</p>' : '') +
      '<div class="editor-cols"><div class="editor-main">' +
      '<div class="card editor-problems">' +
      (blocking.length ? `<h2>No se puede importar: corrige estas filas en Excel y vuelve a traerlas</h2>${list(blocking)}` : '') +
      // While something blocks, the rest is noise: it can wait for the next review.
      (!blocking.length && rest.length ? `<h2>Se puede importar; para publicar habrá que corregir ${count(rest.length)}</h2>${list(rest)}` : '') +
      (!review.errors.length ? `<p class="editor-ok">${ICON('done')}<span>Sin problemas.</span></p>` : '') +
      '</div>' +
      (!blocking.length && fresh
        ? '<fieldset class="choice-list"><legend>Categorías y valores nuevos</legend>' +
          '<p class="muted">Se crean los marcados. Lo que desmarques se quita: una categoría, con su columna; un valor, de las celdas que lo traen.</p>' +
          review.newCategories.map((c) => box('category', c, `Categoría nueva: ${c}`)).join('') +
          review.newTags.map((t) => box('tag', t, `${t.category}: ${t.name}`)).join('') +
          '</fieldset>'
        : '') +
      '<div id="review-message"></div>' +
      '<div class="editor-message-actions">' +
      (blocking.length ? '' : '<button type="button" class="button-primary" data-apply>Reemplazar el borrador</button>') +
      '<button type="button" class="button-secondary" data-back>Volver al editor</button></div>' +
      '</div><aside class="card editor-preview" aria-label="Diagrama que resultaría"><h2>Así quedaría</h2><div class="diagram-scroll" id="review-diagram"></div></aside></div>';
    const diagram = reviewEl.querySelector('#review-diagram');
    try {
      diagram.innerHTML = renderDiagram(layoutFlow(compileGrid(imported, ctx).flow), { name: data.name, colour: data.colour });
    } catch {
      diagram.innerHTML = '<p class="muted">No se puede dibujar hasta corregir las filas marcadas.</p>';
    }
    cols.hidden = true;
    importBox.hidden = true;
    panel.innerHTML = '';
    reviewEl.hidden = false;
    reviewEl.querySelector('h2').setAttribute('tabindex', '-1');
    reviewEl.querySelector('h2').focus();

    reviewEl.querySelector('[data-back]').addEventListener('click', () => {
      reviewEl.hidden = true;
      reviewEl.innerHTML = '';
      cols.hidden = false;
      openImport(true);
    });
    reviewEl.querySelector('[data-apply]')?.addEventListener('click', async (ev) => {
      const button = ev.currentTarget;
      button.disabled = true;
      const boxes = [...reviewEl.querySelectorAll('input[data-new]')];
      const pick = (kind) => boxes.filter((b) => b.dataset.new === kind && b.checked).map((b) => JSON.parse(b.value));
      let answer;
      try {
        const res = await fetch(`/flows/${data.flowId}/draft`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ grid: imported, base, accepted: { categories: pick('category'), tags: pick('tag') } }),
        });
        answer = await res.json();
      } catch {
        answer = { status: 'invalid', error: 'No se pudo guardar: revisa la conexión y vuelve a intentarlo.' };
      }
      if (answer.status === 'saved') {
        leaving = true;
        location.href = `/flows/${data.flowId}/edit?importado=1`;
        return;
      }
      button.disabled = false;
      const message = answer.status === 'conflict' ? answer.message : answer.status === 'blocked' ? answer.errors.map((e) => e.message).join(' ') : answer.error;
      reviewEl.querySelector('#review-message').innerHTML = `<p class="form-error" role="alert">${esc(message || 'No se pudo importar.')}</p>`;
    });
  }

  render();
}
