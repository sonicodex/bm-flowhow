// Provisional import screen (phase 1.5; the editor replaces it in phase 5).
// The paste or the .xlsx is read here, in the browser, into the grid; the
// server receives only the grid (SPEC §9).
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

function wire(form) {
  const text = form.querySelector('[name=paste]');
  const file = form.querySelector('[name=file]');
  const grid = form.querySelector('[name=grid]');
  const errors = form.querySelector('[data-errors]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errors.replaceChildren();
    const read = file.files.length ? await gridFromXlsx(await file.files[0].arrayBuffer()) : gridFromText(text.value);
    if (read.errors.length) {
      for (const e of read.errors) errors.append(Object.assign(document.createElement('li'), { textContent: e.message }));
      errors.hidden = false;
      return;
    }
    errors.hidden = true;
    grid.value = JSON.stringify(read.grid);
    form.submit();
  });
}

if (typeof document !== 'undefined') {
  for (const form of document.querySelectorAll('form[data-import]')) wire(form);
}
