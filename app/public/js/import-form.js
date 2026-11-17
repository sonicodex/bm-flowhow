// Reading an import (SPEC §6, §9): the paste or the .xlsx is read here, in
// the browser, into the grid; the server receives only the grid. Used by
// the editor (editor.js, phase 5.5); first written for the provisional
// import screen of phase 1.5, now gone.
import Core from './core.js';
import { readSheet, XlsxError } from './xlsx.js';

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
