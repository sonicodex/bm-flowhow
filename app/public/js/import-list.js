// The importers of areas and users in the browser (SPEC §4; phase 7). It
// reads the paste or the .xlsx into a table of text cells, and shows what
// the server answers: the review, then the result. Every check is the
// server's (src/import-list.tsx); nothing here decides what is valid.
import Core from './core.js';
import { readSheet, XlsxError } from './xlsx.js';
import { writeWorkbook } from './xlsx-write.js';

const config = JSON.parse(document.getElementById('import-data').textContent);
const box = document.getElementById('import-box');
const reviewEl = document.getElementById('import-review');
const errorsEl = document.getElementById('import-errors');
const fileInput = document.getElementById('import-file');
const pasteInput = document.getElementById('import-paste');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ICON = (name) => `<img class="icon" src="/icons/${name}.svg" alt="" width="18" height="18">`;

const listErrors = (messages) => {
  errorsEl.innerHTML = messages.map((m) => `<li>${esc(m)}</li>`).join('');
  errorsEl.hidden = !messages.length;
};
pasteInput.addEventListener('input', () => listErrors([]));
fileInput.addEventListener('change', () => listErrors([]));

function download(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

box.querySelector('[data-template]').addEventListener('click', () => {
  const t = config.template;
  download(writeWorkbook([{ name: config.sheet, rows: [t.columns], widths: t.widths, lists: t.lists }]), t.name);
});

// The table as read, without the empty rows Excel leaves at the end.
async function readInput() {
  if (fileInput.files.length) {
    try {
      return { table: await readSheet(new Uint8Array(await fileInput.files[0].arrayBuffer()), config.sheet) };
    } catch (e) {
      if (e instanceof XlsxError) return { error: e.message };
      throw e;
    }
  }
  return { table: Core.textToTable(pasteInput.value) };
}

async function post(url, table, failure) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ table }) });
    return await res.json();
  } catch {
    return { status: 'invalid', error: failure };
  }
}

const groupHtml = (g) =>
  `<h2>${esc(g.title)}</h2>` +
  (g.note ? `<p class="muted">${esc(g.note)}</p>` : '') +
  '<div class="table-frame"><div class="table-scroll"><table class="admin-table"><thead><tr>' +
  g.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('') +
  '</tr></thead><tbody>' +
  g.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('') +
  '</tbody></table></div></div>';

const warningsHtml = (warnings) => warnings.map((w) => `<p class="form-warning">${esc(w)}</p>`).join('');

function show(html) {
  box.hidden = true;
  reviewEl.innerHTML = html;
  reviewEl.hidden = false;
  const title = reviewEl.querySelector('h2');
  title.setAttribute('tabindex', '-1');
  title.focus();
}

box.querySelector('[data-import-review]').addEventListener('click', async () => {
  const fromFile = fileInput.files.length > 0;
  if (!fromFile && !pasteInput.value.trim()) {
    listErrors(['Elige un archivo .xlsx o pega las celdas copiadas de Excel.']);
    return;
  }
  const read = await readInput();
  if (read.error) {
    listErrors([read.error]);
    return;
  }
  const table = read.table;
  const review = await post(config.reviewUrl, table, 'No se pudo revisar: revisa la conexión y vuelve a intentarlo.');
  if (review.status !== 'review') {
    listErrors([review.error]);
    return;
  }
  listErrors([]);
  const note = fromFile && pasteInput.value.trim() ? 'Se leyó el archivo; lo pegado no se tuvo en cuenta.' : '';
  const blocked = review.errors.length > 0;
  show(
    '<h2 id="review-title">Revisión de la importación</h2>' +
      `<p>${esc(review.summary)}</p>` +
      (note ? `<p class="muted">${esc(note)}</p>` : '') +
      '<div class="card editor-problems">' +
      (blocked
        ? `<h2>No se puede importar: corrige estas filas en Excel y vuelve a traerlas</h2><ul>${review.errors.map((e) => `<li>${ICON('alert')}<span>${esc(e.message)}</span></li>`).join('')}</ul>`
        : `<p class="editor-ok">${ICON('done')}<span>Sin problemas.</span></p>`) +
      '</div>' +
      // While something blocks, the rest is noise: it can wait for the next review.
      (blocked ? '' : warningsHtml(review.warnings) + review.groups.map(groupHtml).join('')) +
      '<div id="review-message"></div>' +
      '<div class="editor-message-actions">' +
      (blocked ? '' : '<button type="button" class="button-primary" data-apply>Importar</button>') +
      '<button type="button" class="button-secondary" data-back>Volver</button></div>',
  );
  reviewEl.querySelector('[data-back]').addEventListener('click', () => {
    reviewEl.hidden = true;
    reviewEl.innerHTML = '';
    box.hidden = false;
    (fromFile ? fileInput : pasteInput).focus();
  });
  reviewEl.querySelector('[data-apply]')?.addEventListener('click', async (ev) => {
    ev.currentTarget.disabled = true;
    const answer = await post(config.applyUrl, table, 'No se pudo importar: revisa la conexión y vuelve a intentarlo. No se escribió nada.');
    if (answer.status !== 'saved') {
      ev.currentTarget.disabled = false;
      reviewEl.querySelector('#review-message').innerHTML = `<p class="form-error" role="alert">${esc(answer.error)}</p>`;
      return;
    }
    showSaved(answer);
  });
});

// The result. What it lists may be shown only this once (the passwords):
// leaving the page asks first.
function showSaved(answer) {
  show(
    `<h2 id="review-title">${esc(answer.title)}</h2>` +
      `<p role="status">${esc(answer.message)}</p>` +
      warningsHtml(config.keepWarning ? [config.keepWarning, ...answer.warnings] : answer.warnings) +
      (answer.download ? '<p><button type="button" class="button-primary" data-download>Descargar .xlsx</button></p>' : '') +
      answer.groups.map(groupHtml).join('') +
      `<div class="editor-message-actions"><a class="button-secondary" href="${esc(config.done.href)}">${esc(config.done.label)}</a></div>`,
  );
  const d = answer.download;
  if (d) {
    reviewEl.querySelector('[data-download]').addEventListener('click', () => {
      const rows = [...d.notes.map((n) => [n]), [], d.columns, ...d.rows];
      download(writeWorkbook([{ name: d.sheet, rows, head: d.notes.length + 1, widths: d.columns.map(() => 28) }]), d.name);
    });
  }
  if (config.keepWarning) {
    window.addEventListener('beforeunload', (ev) => {
      ev.preventDefault();
      ev.returnValue = '';
    });
  }
}
