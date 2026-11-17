// Import inside the editor (phase 5.5; first the provisional screen of
// phase 1.5): what the browser module reads, the review route, and applying
// the import as a save that replaces the draft.
import { env } from 'cloudflare:test';
import { signIn } from './session.ts';
import { tableRows } from './table.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import { gridFromText, gridFromXlsx } from '../public/js/import-form.js';
import instalaciones from '../../reference/Flujo_Instalaciones.grid.json';
import apertura from '../../reference/Flujo_Apertura_OT.grid.json';

const file = (name) => Uint8Array.from(atob(env.XLSX_FIXTURES[name]), (c) => c.charCodeAt(0));
/** @type {import('./session.ts').Signed} */
let board;
beforeEach(async () => {
  board = await signIn();
});
const fetch = (path, body) => board.fetch(path, body ? { method: 'POST', body } : undefined);
const form = (fields) => {
  const f = new URLSearchParams();
  for (const [k, v] of fields) f.append(k, v);
  return f;
};
const newFlow = async (name) => {
  await fetch('/flows', form([['name', name]]));
  return env.DB.prepare('SELECT id FROM flows WHERE name = ?').bind(name).first('id');
};

describe('import-form.js (runs in the browser)', () => {
  it('reads the .xlsx files into the reference grids', async () => {
    expect((await gridFromXlsx(file('Flujo_Instalaciones.xlsx'))).grid).toEqual(instalaciones);
    expect((await gridFromXlsx(file('Flujo_Instalaciones.resaved.xlsx'))).grid).toEqual(instalaciones);
    expect((await gridFromXlsx(file('Flujo_Apertura_OT.xlsx'))).grid).toEqual(apertura);
  });

  it('gives the reader\'s message when it refuses a file', async () => {
    const read = await gridFromXlsx(new Uint8Array([1, 2, 3]));
    expect(read.errors).toHaveLength(1);
    expect(read.errors[0].message).toMatch(/^No se pudo leer el archivo: .*pégalas en el cuadro de pegado\.$/);
  });

  it('reads pasted cells', () => {
    expect(gridFromText('ID\tTipo\tTítulo\tSalidas\nA\tInicio\tUno\tB\nB\tFin\tDos\t').grid.rows.map((r) => [r.id, r.type])).toEqual([['A', 'start'], ['B', 'end']]);
    expect(gridFromText('').errors.map((e) => e.message)).toEqual(['No hay nada pegado.']);
  });
});

describe('/flows', () => {
  it('creates a flow and lists it unpublished, with its draft', async () => {
    expect((await fetch('/flows', form([['name', 'Instalaciones']]))).status).toBe(303);
    const html = await (await fetch('/flows')).text();
    // Name, published version, draft, areas, actions.
    expect(tableRows(html)).toEqual([['Instalaciones', 'Sin publicar', 'Sí', 'Ninguna', 'Editar']]);
    expect((await fetch('/flows', form([['name', 'instalaciónes']]))).status).toBe(422);
  });
});

const post = (path, body) => board.fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const count = async (sql, ...args) => env.DB.prepare(sql).bind(...args).first('n');

describe('POST /flows/:id/draft/review', () => {
  it('reviews an import without writing anything, naming the new categories and values', async () => {
    const id = await newFlow('Instalaciones');
    const res = await post(`/flows/${id}/draft/review`, { grid: instalaciones });
    expect(res.status).toBe(200);
    const review = await res.json();
    expect(review).toMatchObject({ status: 'review', blocking: false, newCategories: ['Responsable', 'Herramienta'] });
    expect(review.newTags).toContainEqual({ category: 'Responsable', name: 'Almacén' });
    expect(await count('SELECT count(*) AS n FROM tags')).toBe(0);
    expect(await count('SELECT count(*) AS n FROM tag_categories')).toBe(0);
    expect(await count('SELECT count(*) AS n FROM save_points WHERE flow_id = ?', id)).toBe(0);
    expect(await env.DB.prepare('SELECT revision FROM drafts WHERE flow_id = ?').bind(id).first('revision')).toBe(1);
  });

  it('marks the blocking rows, and the save refuses them too', async () => {
    const id = await newFlow('Apertura de OT');
    const review = await (await post(`/flows/${id}/draft/review`, { grid: apertura })).json();
    expect(review.blocking).toBe(true);
    expect(review.errors.map((e) => e.message)).toContain('Fila 14 (P13): no existe un flujo llamado «Instalaciones».');
    const saved = await post(`/flows/${id}/draft`, { grid: apertura, base: 'draft:1', accepted: { categories: [], tags: [] } });
    expect(saved.status).toBe(422);
    expect(await count('SELECT count(*) AS n FROM save_points')).toBe(0);
  });

  it('applies as a save that replaces the whole draft, with the accepted values only', async () => {
    const id = await newFlow('Instalaciones');
    const accepted = { categories: ['Responsable'], tags: [{ category: 'Responsable', name: 'Almacén' }] };
    const res = await post(`/flows/${id}/draft`, { grid: instalaciones, base: 'draft:1', accepted });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'saved', base: 'draft:2', saved: true });
    expect((await env.DB.prepare('SELECT name FROM tags').all()).results).toEqual([{ name: 'Almacén' }]);
    expect(await count('SELECT count(*) AS n FROM save_points WHERE flow_id = ?', id)).toBe(1);
    const steps = await count("SELECT json_array_length(document, '$.steps') AS n FROM drafts WHERE flow_id = ?", id);
    expect(steps).toBe(30);
    const page = await (await board.fetch(`/flows/${id}/edit?importado=1`)).text();
    expect(page).toContain('Importado al borrador. Revísalo aquí; nadie lo ve hasta que lo publiques.');
  });

  it('refuses a grid of another shape, an empty import, and an unknown flow', async () => {
    const id = await newFlow('X');
    expect((await post(`/flows/${id}/draft/review`, { grid: { rows: [] } })).status).toBe(400);
    expect((await post(`/flows/${id}/draft/review`, { grid: { categories: [], rows: [] } })).status).toBe(400);
    expect((await board.fetch(`/flows/${id}/draft/review`, { method: 'POST', body: 'no' })).status).toBe(400);
    expect((await post('/flows/999/draft/review', { grid: instalaciones })).status).toBe(404);
  });

  it('leaves no provisional import screen behind', async () => {
    const id = await newFlow('Y');
    expect((await board.fetch(`/flows/${id}/import`)).status).toBe(404);
    const page = await (await board.fetch(`/flows/${id}/edit`)).text();
    expect(page).toContain('data-import="true" aria-expanded="false" aria-controls="import-box"');
    expect(page).toContain('<section class="card editor-import" id="import-box" aria-labelledby="import-title" hidden="">');
    // The template and the export (phase 5.6) are built in the browser.
    expect(page).toContain('<button type="button" class="button-secondary" data-export="true">Exportar a Excel</button>');
    expect(page).toContain('<button type="button" class="button-link" data-template="true">Descarga la plantilla</button>: trae las columnas');
  });
});
