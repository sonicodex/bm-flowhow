// The provisional import screen (phase 1.5): what the browser module reads,
// and the routes that review and apply it.
import { env } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { gridFromText, gridFromXlsx } from '../public/js/import-form.js';
import instalaciones from '../../reference/Flujo_Instalaciones.grid.json';
import apertura from '../../reference/Flujo_Apertura_OT.grid.json';

const file = (name) => Uint8Array.from(atob(env.XLSX_FIXTURES[name]), (c) => c.charCodeAt(0));
const fetch = (path, body) =>
  exports.default.fetch('http://example.com' + path, body ? { method: 'POST', body, redirect: 'manual' } : undefined);
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
    expect(html).toContain('Instalaciones — sin publicar, con borrador');
    expect((await fetch('/flows', form([['name', 'instalaciónes']]))).status).toBe(422);
  });
});

describe('/flows/:id/import', () => {
  it('reviews a grid without writing, then imports it with the accepted tags only', async () => {
    const id = await newFlow('Instalaciones');
    expect((await fetch(`/flows/${id}/import`)).status).toBe(200);
    const grid = JSON.stringify(instalaciones);
    const review = await fetch(`/flows/${id}/import/review`, form([['grid', grid]]));
    expect(review.status).toBe(200);
    const html = await review.text();
    expect(html).toContain('30 pasos; categorías: Responsable, Herramienta.');
    expect(html).toContain('Importar al borrador');
    expect(await env.DB.prepare('SELECT count(*) AS n FROM tags').first('n')).toBe(0);

    const applied = await fetch(`/flows/${id}/import/apply`, form([['grid', grid], ['category', 'Responsable'], ['tag', JSON.stringify(['Responsable', 'Almacén'])]]));
    expect(applied.status).toBe(303);
    expect(applied.headers.get('location')).toBe(`/flows/${id}/import?done=1`);
    expect((await env.DB.prepare('SELECT name FROM tags').all()).results).toEqual([{ name: 'Almacén' }]);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM save_points WHERE flow_id = ?').bind(id).first('n')).toBe(1);
  });

  it('shows blocking errors with their rows and offers no import', async () => {
    const id = await newFlow('Apertura de OT');
    const res = await fetch(`/flows/${id}/import/review`, form([['grid', JSON.stringify(apertura)]]));
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain('Fila 14 (P13): no existe un flujo llamado «Instalaciones». (bloquea la importación)');
    expect(html).not.toContain('Importar al borrador');
    const apply = await fetch(`/flows/${id}/import/apply`, form([['grid', JSON.stringify(apertura)]]));
    expect(apply.status).toBe(422);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM save_points').first('n')).toBe(0);
  });

  it('refuses a grid of another shape with 400, and an unknown flow with 404', async () => {
    const id = await newFlow('X');
    expect((await fetch(`/flows/${id}/import/review`, form([['grid', '{"rows":[]}']]))).status).toBe(400);
    expect((await fetch(`/flows/${id}/import/apply`, form([['grid', 'no']]))).status).toBe(400);
    expect((await fetch('/flows/999/import')).status).toBe(404);
    expect((await fetch('/flows/abc/import')).status).toBe(404);
  });
});
