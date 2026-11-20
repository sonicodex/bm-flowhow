// «Importar flujo» on the flows screen (SPEC §9, Navigation; phase 8.3):
// the paste or the .xlsx is read here into a grid, with the editor's reader
// (import-form.js); the server reviews it (POST /flows/import/review), and
// accepting creates the flow with that grid as its draft (POST
// /flows/import, src/flows-screen.tsx). The review is the editor's.
import { layoutFlow } from './diagram-layout.js';
import { renderDiagram } from './diagram.js';
import { compileGrid } from './grid-edit.js';
import { acceptedIn, gridFromText, gridFromXlsx, reviewChecks, reviewSummary, TEMPLATE_NAME, templateXlsx } from './import-form.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const dataEl = document.getElementById('flow-import-data');
const box = document.getElementById('import-box');
const reviewEl = document.getElementById('import-review');

if (dataEl && box && reviewEl) {
  const data = JSON.parse(dataEl.textContent);
  const nameInput = /** @type {HTMLInputElement} */ (document.getElementById('import-name'));
  const fileInput = /** @type {HTMLInputElement} */ (document.getElementById('import-file'));
  const paste = /** @type {HTMLTextAreaElement} */ (document.getElementById('import-paste'));
  const errorsEl = document.getElementById('import-errors');

  const listErrors = (errors) => {
    errorsEl.innerHTML = errors.map((e) => `<li>${esc(e.message)}</li>`).join('');
    errorsEl.hidden = !errors.length;
  };
  // A message about what was chosen goes once the choice changes.
  for (const el of [nameInput, paste]) el.addEventListener('input', () => listErrors([]));
  fileInput.addEventListener('change', () => listErrors([]));

  box.querySelector('[data-template]').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([templateXlsx(data.categories)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: TEMPLATE_NAME });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });

  const post = async (path, body, failure) => {
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return await res.json();
    } catch {
      return { status: 'invalid', error: failure };
    }
  };

  box.querySelector('[data-import-review]').addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      listErrors([{ message: 'Escribe el nombre del flujo.' }]);
      nameInput.focus();
      return;
    }
    // A file, when one is chosen, wins over the paste, and the screen says so.
    const fromFile = fileInput.files.length > 0;
    if (!fromFile && !paste.value.trim()) {
      listErrors([{ message: 'Elige un archivo .xlsx o pega las celdas copiadas de Excel.' }]);
      return;
    }
    const read = fromFile ? await gridFromXlsx(new Uint8Array(await fileInput.files[0].arrayBuffer())) : gridFromText(paste.value);
    if (read.errors.length) {
      listErrors(read.errors);
      return;
    }
    listErrors([]);
    const review = await post('/flows/import/review', { name, grid: read.grid }, 'No se pudo revisar: revisa la conexión y vuelve a intentarlo.');
    if (review.status !== 'review') {
      listErrors([{ message: review.error }]);
      return;
    }
    showReview(name, read.grid, review, fromFile && paste.value.trim() ? 'Se leyó el archivo; lo pegado no se tuvo en cuenta.' : '');
  });

  function showReview(name, grid, review, note) {
    const blocking = review.errors.some((e) => e.blocking);
    reviewEl.innerHTML =
      `<h2 id="review-title">Revisión de «${esc(name)}»</h2>` +
      reviewSummary(grid) +
      (note ? `<p class="muted">${esc(note)}</p>` : '') +
      '<div class="editor-cols"><div class="editor-main">' +
      reviewChecks(review) +
      '<div id="review-message"></div>' +
      '<div class="editor-message-actions">' +
      (blocking ? '' : '<button type="button" class="button-primary" data-apply>Crear el flujo</button>') +
      '<button type="button" class="button-secondary" data-back>Volver</button></div>' +
      '</div><aside class="card editor-preview" aria-label="Diagrama que resultaría"><h2>Así quedaría</h2><div class="diagram-scroll" id="review-diagram"></div></aside></div>';
    const diagram = reviewEl.querySelector('#review-diagram');
    try {
      diagram.innerHTML = renderDiagram(layoutFlow(compileGrid(grid, { flowId: 0, name, flows: data.flows }).flow), { name, colour: data.colour });
    } catch {
      diagram.innerHTML = '<p class="muted">No se puede dibujar hasta corregir las filas marcadas.</p>';
    }
    box.hidden = true;
    reviewEl.hidden = false;
    const title = reviewEl.querySelector('h2');
    title.setAttribute('tabindex', '-1');
    title.focus();

    reviewEl.querySelector('[data-back]').addEventListener('click', () => {
      reviewEl.hidden = true;
      reviewEl.innerHTML = '';
      box.hidden = false;
      nameInput.focus();
    });
    reviewEl.querySelector('[data-apply]')?.addEventListener('click', async (ev) => {
      const button = /** @type {HTMLButtonElement} */ (ev.currentTarget);
      button.disabled = true;
      const answer = await post('/flows/import', { name, grid, accepted: acceptedIn(reviewEl) }, 'No se pudo crear: revisa la conexión y vuelve a intentarlo.');
      if (answer.status === 'saved') {
        location.href = `/flows/${answer.id}/edit?importado=1`;
        return;
      }
      button.disabled = false;
      const message = answer.status === 'blocked' ? answer.errors.map((e) => e.message).join(' ') : answer.error;
      reviewEl.querySelector('#review-message').innerHTML = `<p class="form-error" role="alert">${esc(message || 'No se pudo crear el flujo.')}</p>`;
    });
  }
}
