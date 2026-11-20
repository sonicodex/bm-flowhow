// The grid in and out of Excel (SPEC §6, §9), in the browser. In: the paste
// or the .xlsx is read here into the grid; the server receives only the
// grid (phase 5.5; first written for the provisional import screen of phase
// 1.5, now gone). Out: the template and the export, the same format the
// import reads (phase 5.6).
import Core from './core.js';
import { readSheet, XlsxError } from './xlsx.js';
import { writeWorkbook } from './xlsx-write.js';

// The sheet the template and the reference files keep the steps in.
export const SHEET = 'Flujo';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ICON = (name) => `<img class="icon" src="/icons/${name}.svg" alt="" width="18" height="18">`;
/** Problems in table order (a stable sort): the flow's own, with no row, first. */
const byRow = (errors) => errors.slice().sort((a, b) => (a.row ?? -1) - (b.row ?? -1));
const count = (n) => (n === 1 ? '1 problema' : `${n} problemas`);

// The review of an import (SPEC §6), the same in the editor (which replaces
// a draft) and on the flows screen (which creates a flow; phase 8.3).

/** What was read: how many steps, which categories. @param {import('./core.js').Grid} grid */
export function reviewSummary(grid) {
  const steps = grid.rows.length;
  return `<p>${steps === 1 ? '1 paso' : `${steps} pasos`}${grid.categories.length ? ` · categorías: ${esc(grid.categories.join(', '))}` : ' · sin categorías'}.</p>`;
}

/**
 * The server's review: the problems, and the new categories and values to
 * accept, each a checkbox that acceptedIn() reads back.
 * @param {{ errors: { row: number | null, message: string, blocking: boolean }[], newCategories: string[], newTags: { category: string, name: string }[] }} review
 */
export function reviewChecks(review) {
  const list = (errors) => `<ul>${errors.map((e) => `<li>${ICON('alert')}<span>${esc(e.message)}</span></li>`).join('')}</ul>`;
  const blocking = byRow(review.errors.filter((e) => e.blocking));
  const rest = byRow(review.errors.filter((e) => !e.blocking));
  const box = (kind, value, label) => `<label><input type="checkbox" data-new="${kind}" value="${esc(JSON.stringify(value))}" checked> ${esc(label)}</label>`;
  const fresh = review.newCategories.length + review.newTags.length;
  return (
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
      : '')
  );
}

/** The categories and values left checked in a review. @param {ParentNode} el */
export function acceptedIn(el) {
  const boxes = /** @type {HTMLInputElement[]} */ ([...el.querySelectorAll('input[data-new]')]);
  const pick = (kind) => boxes.filter((b) => b.dataset.new === kind && b.checked).map((b) => JSON.parse(b.value));
  return { categories: pick('category'), tags: pick('tag') };
}

/** Pasted cells to { grid, errors }: errors are about the table itself. */
export function gridFromText(text) {
  return Core.tableToGrid(Core.textToTable(text));
}

/** An .xlsx file's bytes to { grid, errors }. A file the reader refuses
    gives its message as the only error. */
export async function gridFromXlsx(bytes) {
  try {
    return Core.tableToGrid(await readSheet(bytes, SHEET));
  } catch (e) {
    if (e instanceof XlsxError) return { grid: null, errors: [{ row: null, message: e.message, blocking: true }] };
    throw e;
  }
}

/**
 * The grid as the import format's table: the fixed columns (Contacto right
 * after Flujo, SPEC §5), every category,
 * and "Salidas" as the one source of the connections (SPEC §6: export
 * writes no "Depende de"), always written with commas (SPEC §5), whatever
 * separator the cell was typed with. Types by their Spanish name.
 * @param {import('./core.js').Grid} grid
 * @returns {string[][]}
 */
export function gridToTable(grid) {
  const head = ['ID', 'Tipo', 'Flujo', 'Contacto', 'Título', 'Descripción', ...grid.categories, 'Salidas'];
  const labels = /** @type {Record<string, string>} */ (Core.TYPE_LABELS);
  return [head].concat(
    grid.rows.map((r) => [r.id, labels[r.type] || r.type, r.ref, r.contact, r.title, r.description, ...grid.categories.map((c) => r.tags[c] || ''), Core.formatExits(Core.parseExits(r.exits))].map((v) => String(v ?? ''))),
  );
}

/** @param {string[][]} table @returns {Uint8Array} */
function flowWorkbook(table) {
  const cats = table[0].length - 7;
  const types = Core.TYPES.map((t) => /** @type {Record<string, string>} */ (Core.TYPE_LABELS)[t]);
  return writeWorkbook([
    {
      name: SHEET,
      rows: table,
      widths: [8, 12, 18, 22, 44, 60, ...Array(cats).fill(22), 22],
      lists: [{ col: 1, values: types, title: 'Tipo', message: `Usa uno de estos tipos: ${types.join(', ')}.` }],
    },
  ]);
}

/**
 * The downloadable template: the headers, with every existing category as a
 * column (SPEC §6), and no steps.
 * @param {string[]} categories @returns {Uint8Array}
 */
export function templateXlsx(categories) {
  return flowWorkbook(gridToTable({ categories, rows: [] }));
}

/**
 * The export: the grid in the template's format (SPEC §6), so it can be
 * edited in Excel and imported again.
 * @param {import('./core.js').Grid} grid @returns {Uint8Array}
 */
export function exportXlsx(grid) {
  return flowWorkbook(gridToTable(grid));
}

/** A file name for the export: "Flujo_" and the flow name, without the
    characters file systems refuse. @param {string} name */
export function exportName(name) {
  const clean = String(name).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim().replace(/\s+/g, '_');
  return `Flujo_${clean || 'sin_nombre'}.xlsx`;
}

export const TEMPLATE_NAME = 'Plantilla_FlowHow.xlsx';
