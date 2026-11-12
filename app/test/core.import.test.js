// New cases for the rules module (phase 1.1): link targets, the "Flujo"
// column, one validation gate, the grid shape, and unknown types that block.
import assert from 'node:assert';
import { describe, it } from 'vitest';
import C from '../public/js/core.js';
import instalaciones from '../../reference/Flujo_Instalaciones.grid.json';
import apertura from '../../reference/Flujo_Apertura_OT.grid.json';

const flowWith = (steps) => C.compile({ name: 'x', categories: [], steps });
const linkFlow = (ref) => flowWith([
  { id: 'A', type: 'start', title: 'a', exits: 'B' },
  { id: 'B', type: 'link', ref, title: 'b', exits: 'C' },
  { id: 'C', type: 'end', title: 'c', exits: '' },
]);
const table = (text) => text.split('\n').map((l) => l.split('\t'));
const messages = (errors) => errors.map((e) => e.message);

describe('compile', () => {
  it('keeps the target of link and subflow steps, and of no other type', () => {
    const f = flowWith([
      { id: 'A', type: 'start', ref: 'x', title: 'a', exits: 'B' },
      { id: 'B', type: 'link', ref: 'f1', title: 'b', exits: 'C' },
      { id: 'C', type: 'subflow', ref: 'f2', title: 'c', exits: 'D' },
      { id: 'D', type: 'end', ref: 'x', title: 'd', exits: '' },
    ]);
    assert.deepStrictEqual(f.steps.map((s) => s.ref), ['', 'f1', 'f2', '']);
  });
});

describe('parseTable with the Flujo column', () => {
  const text = 'ID\tTipo\tFlujo\tTítulo\tSalidas\nA\tInicio\t\tUno\tB\nB\tEnlace\tFacturación\tDos\tC\nC\tFin\t\tTres\t';

  it('resolves the target of a link and does not make Flujo a category', () => {
    const p = C.parseTable(text, (n) => (n === 'Facturación' ? 'f9' : null));
    assert.deepStrictEqual(p.errors, []);
    assert.deepStrictEqual(p.categories, []);
    assert.strictEqual(p.steps[1].ref, 'f9');
    assert.strictEqual(C.compile({ name: 'x', categories: [], steps: p.steps }).steps[1].ref, 'f9');
  });

  it('blocks a link whose target flow does not exist', () => {
    const p = C.parseTable(text, () => null);
    assert.deepStrictEqual(p.errors, [{ row: 1, message: 'Fila 3: no existe un flujo llamado «Facturación».', blocking: true }]);
  });

  it('still reads the old Subflujo header', () => {
    const p = C.parseTable(text.replace('Flujo', 'Subflujo'), () => 'f9');
    assert.deepStrictEqual(p.categories, []);
    assert.strictEqual(p.steps[1].ref, 'f9');
  });

  it('round-trips a flow with a link through toTSV, with the Flujo header', () => {
    const draft = { name: 'x', categories: ['Responsable'], steps: [
      { id: 'A', type: 'start', title: 'a', description: '', tags: { Responsable: 'Ventas' }, exits: 'B' },
      { id: 'B', type: 'link', ref: 'f9', title: 'b', description: 'Sigue en otro flujo.', tags: { Responsable: '' }, exits: 'C' },
      { id: 'C', type: 'end', title: 'c', description: '', tags: { Responsable: '' }, exits: '' },
    ] };
    const tsv = C.toTSV(draft, (id) => (id === 'f9' ? 'Facturación' : ''));
    assert.strictEqual(tsv.split('\n')[0], 'ID\tTipo\tFlujo\tTítulo\tDescripción\tResponsable\tSalidas');
    const p = C.parseTable(tsv, (n) => (n === 'Facturación' ? 'f9' : null));
    assert.deepStrictEqual(p.errors, []);
    assert.deepStrictEqual(C.compile({ name: 'x', categories: p.categories, steps: p.steps }), C.compile(draft));
  });

  it('warns, without blocking, when Flujo is filled on a step that is not a link', () => {
    const p = C.parseTable('ID\tTipo\tFlujo\tTítulo\nA\tFin\tFacturación\tUno', () => 'f9');
    assert.deepStrictEqual(p.errors, [{ row: 0, message: 'Fila 2: la columna Flujo solo se usa en pasos Enlace o Subflujo; se ignoró «Facturación».', blocking: false }]);
    assert.strictEqual(p.steps[0].ref, undefined);
  });
});

describe('validateRefs on link steps', () => {
  const lib = (id) => ({ inst: { name: 'Instalaciones', published: null }, self: { name: 'Yo', published: null } }[id] || null);

  it('accepts a link to an existing flow, published or not', () => {
    assert.deepStrictEqual(C.validateRefs(linkFlow('inst'), 'self', lib), []);
  });

  it('reports a missing target, an unknown target and a link to its own flow', () => {
    assert.deepStrictEqual(messages(C.validateRefs(linkFlow(''), 'self', lib)), ['Paso B: falta el flujo de destino (columna Flujo).']);
    assert.deepStrictEqual(messages(C.validateRefs(linkFlow('zzz'), 'self', lib)), ['Paso B: el flujo de destino ya no existe.']);
    assert.deepStrictEqual(messages(C.validateRefs(linkFlow('self'), 'self', lib)), ['Paso B: un enlace no puede apuntar a su propio flujo.']);
  });

  it('allows two flows that link to each other', () => {
    const both = (id) => ({ a: { name: 'A', published: null }, b: { name: 'B', published: null } }[id] || null);
    assert.deepStrictEqual(C.validateRefs(linkFlow('b'), 'a', both), []);
    assert.deepStrictEqual(C.validateRefs(linkFlow('a'), 'b', both), []);
  });
});

describe('validate: one gate for structure and references', () => {
  const lib = (id) => ({ inst: { name: 'Instalaciones', published: null } }[id] || null);

  it('includes the reference errors with the structure errors', () => {
    const f = flowWith([
      { id: 'A', type: 'start', title: 'a', exits: 'B' },
      { id: 'B', type: 'link', title: 'b', exits: '' },
    ]);
    assert.deepStrictEqual(messages(C.validate(f, { selfId: 'self', lib })), [
      'Paso B: no tiene salida y no es de tipo Fin.',
      'Paso B: falta el flujo de destino (columna Flujo).',
    ]);
  });

  it('refuses to run without refs on a flow with link or subflow steps', () => {
    assert.throws(() => C.validate(linkFlow('inst')), /pass \{ selfId, lib \}/);
    assert.deepStrictEqual(C.validate(linkFlow('inst'), { selfId: 'self', lib }), []);
  });

  it('needs no refs on a flow without link or subflow steps', () => {
    assert.deepStrictEqual(C.validate(C.compile(C.EXAMPLE_SUB)), []);
  });
});

describe('tableToGrid', () => {
  it('maps headers in any case and accent, Spanish types to codes, and skips blank rows', () => {
    const read = C.tableToGrid([
      ['TÍTULO', 'id', 'tipo', 'DESCRIPCION', 'Responsable', 'flujo', 'Depende de', 'salidas'],
      ['Uno', 'A', 'Inicio', 'Desc', 'Ventas, Almacén', '', '', 'B'],
      ['', '', '', '', '', '', '', ''],
      ['Dos', 'B', 'Enlace', '', '', 'Facturación', 'A', ''],
    ]);
    assert.deepStrictEqual(read.errors, []);
    assert.deepStrictEqual(read.grid, {
      categories: ['Responsable'],
      rows: [
        { id: 'A', type: 'start', ref: '', title: 'Uno', description: 'Desc', tags: { Responsable: 'Ventas, Almacén' }, exits: 'B', depends_on: '' },
        { id: 'B', type: 'link', ref: 'Facturación', title: 'Dos', description: '', tags: { Responsable: '' }, exits: '', depends_on: 'A' },
      ],
    });
  });

  it('keeps an unknown type as written, for gridToDraft to report', () => {
    const read = C.tableToGrid(table('ID\tTipo\tTítulo\nA\tTarea\tUno'));
    assert.strictEqual(read.grid.rows[0].type, 'Tarea');
  });

  it('blocks a repeated category column instead of losing one of them', () => {
    const read = C.tableToGrid(table('ID\tTítulo\tResponsable\tresponsable\nA\tUno\tVentas\tCompras'));
    assert.deepStrictEqual(read.errors, [{ row: null, message: 'La columna «responsable» está repetida.', blocking: true }]);
  });

  it('blocks a table without the ID and Título headers, or without steps', () => {
    assert.deepStrictEqual(messages(C.tableToGrid(table('Paso\tNombre\nA\tUno')).errors), ['La primera fila debe traer los encabezados. Como mínimo: ID y Título.']);
    assert.deepStrictEqual(messages(C.tableToGrid(table('ID\tTítulo')).errors), ['Solo llegó la fila de encabezados.']);
    assert.deepStrictEqual(messages(C.tableToGrid([]).errors), ['No hay nada pegado.']);
  });
});

describe('gridToDraft', () => {
  it('blocks an unknown type and says which types exist', () => {
    const p = C.parseTable('ID\tTipo\tTítulo\nA\tTarea\tUno');
    assert.deepStrictEqual(p.errors, [{ row: 0, message: 'Fila 2: tipo «Tarea» no reconocido. Usa Inicio, Actividad, Decisión, Espera, Subflujo, Enlace o Fin.', blocking: true }]);
  });

  it('reports an unknown "Depende de" step without blocking, and changes nothing', () => {
    const p = C.gridToDraft({ categories: [], rows: [
      { id: 'A', type: 'start', ref: '', title: 'a', description: '', tags: {}, exits: 'B', depends_on: '' },
      { id: 'B', type: 'end', ref: '', title: 'b', description: '', tags: {}, exits: '', depends_on: 'ZZ' },
    ] });
    assert.deepStrictEqual(p.errors, [{ row: 1, message: 'Fila 3: depende de «ZZ», que no existe.', blocking: false }]);
    assert.strictEqual(p.steps[0].exits, 'B');
  });

  it('reads Instalaciones (30 steps) with no errors and a valid structure', () => {
    const p = C.gridToDraft(instalaciones, () => null);
    assert.deepStrictEqual(p.errors, []);
    const f = C.compile({ name: 'Instalaciones', categories: p.categories, steps: p.steps });
    assert.strictEqual(f.steps.length, 30);
    assert.deepStrictEqual(C.validate(f), []);
  });

  it('resolves Apertura de OT P13 to Instalaciones, and blocks while it does not exist', () => {
    const p = C.gridToDraft(apertura, (n) => (n === 'Instalaciones' ? 'inst' : null));
    assert.deepStrictEqual(p.errors, []);
    const f = C.compile({ name: 'Apertura de OT', categories: p.categories, steps: p.steps });
    assert.strictEqual(f.steps.length, 36);
    const p13 = f.steps.find((s) => s.id === 'P13');
    assert.strictEqual(p13.type, 'link');
    assert.strictEqual(p13.ref, 'inst');
    assert.deepStrictEqual(C.validate(f, { selfId: 'apertura', lib: (id) => (id === 'inst' ? { name: 'Instalaciones', published: null } : null) }), []);

    const missing = C.gridToDraft(apertura, () => null);
    assert.deepStrictEqual(missing.errors, [{ row: 12, message: 'Fila 14: no existe un flujo llamado «Instalaciones».', blocking: true }]);
  });
});
