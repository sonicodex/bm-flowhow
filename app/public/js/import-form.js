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
 * The grid as the import format's table: the fixed columns, every category,
 * and "Salidas" as the one source of the connections (SPEC §6: export
 * writes no "Depende de"), always written with commas (SPEC §5), whatever
 * separator the cell was typed with. Types by their Spanish name.
 * @param {import('./core.js').Grid} grid
 * @returns {string[][]}
 */
export function gridToTable(grid) {
  const head = ['ID', 'Tipo', 'Flujo', 'Título', 'Descripción', ...grid.categories, 'Salidas'];
  const labels = /** @type {Record<string, string>} */ (Core.TYPE_LABELS);
  return [head].concat(
    grid.rows.map((r) => [r.id, labels[r.type] || r.type, r.ref, r.title, r.description, ...grid.categories.map((c) => r.tags[c] || ''), Core.formatExits(Core.parseExits(r.exits))].map((v) => String(v ?? ''))),
  );
}

/** @param {string[][]} table @returns {Uint8Array} */
function flowWorkbook(table) {
  const cats = table[0].length - 6;
  const types = Core.TYPES.map((t) => /** @type {Record<string, string>} */ (Core.TYPE_LABELS)[t]);
  return writeWorkbook([
    {
      name: SHEET,
      rows: table,
      widths: [8, 12, 18, 44, 60, ...Array(cats).fill(22), 22],
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
