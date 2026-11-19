// The progress report's filters, live (SPEC §9; phase 6.16). Changing a
// filter asks the server for the same page with the new address and swaps
// in its results: the count, the table and «Quitar filtros». Nothing is
// filtered here; the server still decides every row a user may see. The
// page does not reload, so the focus stays on the filter just changed.
// Without JavaScript the form keeps its «Filtrar» button.
import { watchTables } from './table-scroll.js';

const form = document.querySelector('form.report-filters');
const parts = ['report-count', 'report-results', 'report-clear'];

if (form instanceof HTMLFormElement) {
  let latest = 0;
  const apply = async () => {
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === 'string' && v) params.set(k, v);
    const url = `${form.action}${params.size ? `?${params}` : ''}`;
    const ask = ++latest;
    const count = document.getElementById('report-count');
    try {
      const res = await fetch(url, { headers: { accept: 'text/html' } });
      if (!res.ok) throw new Error(String(res.status));
      const page = new DOMParser().parseFromString(await res.text(), 'text/html');
      // A slower, older answer never overwrites a newer one.
      if (ask !== latest) return;
      for (const id of parts) {
        const now = document.getElementById(id);
        const next = page.getElementById(id);
        if (!now || !next) continue;
        // The count keeps its node, so screen readers announce the change.
        if (id === 'report-count') now.textContent = next.textContent;
        else {
          const fresh = document.importNode(next, true);
          now.replaceWith(fresh);
          watchTables(fresh);
        }
      }
      history.replaceState(null, '', url);
    } catch {
      if (ask === latest && count) count.textContent = 'No se pudo filtrar. Revisa tu conexión y vuelve a intentarlo.';
    }
  };
  form.addEventListener('change', apply);
  // Enter in a select would submit the form and reload the page.
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    apply();
  });
}
