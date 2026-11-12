// New cases for the rules module (phases 1.1 and 1.2.6): link targets, the
// "Flujo" column, one validation gate, the grid shape, one row numbering,
// one error shape, and flow ids that stay numbers.
import assert from 'node:assert';
import { describe, it } from 'vitest';
import C from '../public/js/core.js';
import instalaciones from '../../reference/Flujo_Instalaciones.grid.json';
import apertura from '../../reference/Flujo_Apertura_OT.grid.json';

// Flow ids are numbers, as D1 stores them.
const INST = 10, SELF = 20, FACT = 9;

const flowWith = (steps) => C.compile({ name: 'x', categories: [], steps });
const linkFlow = (ref) => flowWith([
  { id: 'A', type: 'start', title: 'a', exits: 'B' },
  { id: 'B', type: 'link', ref, title: 'b', exits: 'C' },
  { id: 'C', type: 'end', title: 'c', exits: '' },
]);
const table = (text) => text.split('\n').map((l) => l.split('\t'));
const messages = (errors) => errors.map((e) => e.message);
const lib = (id) => ({ [INST]: { name: 'Instalaciones', published: null }, [SELF]: { name: 'Yo', published: null } }[id] || null);
// What an import reviews: the grid's own problems, then the steps' (validate).
const review = (grid, resolve = () => null, refs = { selfId: SELF, lib }) => {
  const d = C.gridToDraft(grid, resolve);
  return d.errors.concat(C.validate(C.compile({ name: 'x', categories: d.categories, steps: d.steps }), refs));
};
const row = (id, type, extra = {}) => ({ id, type, ref: '', title: 't' + id, description: '', tags: {}, exits: '', depends_on: '', ...extra });

describe('compile', () => {
  it('keeps the target of link and subflow steps, and of no other type', () => {
    const f = flowWith([
      { id: 'A', type: 'start', ref: 5, title: 'a', exits: 'B' },
      { id: 'B', type: 'link', ref: 1, title: 'b', exits: 'C' },
      { id: 'C', type: 'subflow', ref: 2, title: 'c', exits: 'D' },
      { id: 'D', type: 'end', ref: 5, title: 'd', exits: '' },
    ]);
    assert.deepStrictEqual(f.steps.map((s) => s.ref), [null, 1, 2, null]);
  });
});

describe('parseTable with the Flujo column', () => {
  const text = 'ID\tTipo\tFlujo\tTítulo\tSalidas\nA\tInicio\t\tUno\tB\nB\tEnlace\tFacturación\tDos\tC\nC\tFin\t\tTres\t';

  it('resolves the target of a link and does not make Flujo a category', () => {
    const p = C.parseTable(text, (n) => (n === 'Facturación' ? FACT : null));
    assert.deepStrictEqual(p.errors, []);
    assert.deepStrictEqual(p.categories, []);
    assert.strictEqual(p.steps[1].ref, FACT);
    assert.strictEqual(C.compile({ name: 'x', categories: [], steps: p.steps }).steps[1].ref, FACT);
  });

  it('blocks a link whose target flow does not exist', () => {
    const p = C.parseTable(text, () => null);
    assert.deepStrictEqual(p.errors, [{ row: 1, message: 'Fila 3 (B): no existe un flujo llamado «Facturación».', blocking: true }]);
  });

  it('still reads the old Subflujo header', () => {
    const p = C.parseTable(text.replace('Flujo', 'Subflujo'), () => FACT);
    assert.deepStrictEqual(p.categories, []);
    assert.strictEqual(p.steps[1].ref, FACT);
  });

  it('round-trips a flow with a link through toTSV, with the Flujo header', () => {
    const draft = { name: 'x', categories: ['Responsable'], steps: [
      { id: 'A', type: 'start', title: 'a', description: '', tags: { Responsable: 'Ventas' }, exits: 'B' },
      { id: 'B', type: 'link', ref: FACT, title: 'b', description: 'Sigue en otro flujo.', tags: { Responsable: '' }, exits: 'C' },
      { id: 'C', type: 'end', title: 'c', description: '', tags: { Responsable: '' }, exits: '' },
    ] };
    const tsv = C.toTSV(draft, (id) => (id === FACT ? 'Facturación' : ''));
    assert.strictEqual(tsv.split('\n')[0], 'ID\tTipo\tFlujo\tTítulo\tDescripción\tResponsable\tSalidas');
    const p = C.parseTable(tsv, (n) => (n === 'Facturación' ? FACT : null));
    assert.deepStrictEqual(p.errors, []);
    assert.deepStrictEqual(C.compile({ name: 'x', categories: p.categories, steps: p.steps }), C.compile(draft));
  });

  it('warns, without blocking, when Flujo is filled on a step that is not a link', () => {
    const p = C.parseTable('ID\tTipo\tFlujo\tTítulo\nA\tFin\tFacturación\tUno', () => FACT);
    assert.deepStrictEqual(p.errors, [{ row: 0, message: 'Fila 2 (A): la columna Flujo solo se usa en pasos Enlace o Subflujo; se ignoró «Facturación».', blocking: false }]);
    assert.strictEqual(p.steps[0].ref, undefined);
  });
});

describe('validateRefs on link steps', () => {
  it('accepts a link to an existing flow, published or not', () => {
    assert.deepStrictEqual(C.validateRefs(linkFlow(INST), SELF, lib), []);
  });

  it('reports a missing target, an unknown target and a link to its own flow', () => {
    assert.deepStrictEqual(messages(C.validateRefs(linkFlow(null), SELF, lib)), ['Fila 3 (B): falta el flujo de destino (columna Flujo).']);
    assert.deepStrictEqual(messages(C.validateRefs(linkFlow(99), SELF, lib)), ['Fila 3 (B): el flujo de destino ya no existe.']);
    assert.deepStrictEqual(messages(C.validateRefs(linkFlow(SELF), SELF, lib)), ['Fila 3 (B): un enlace no puede apuntar a su propio flujo.']);
  });

  it('allows two flows that link to each other', () => {
    const both = (id) => ({ 1: { name: 'A', published: null }, 2: { name: 'B', published: null } }[id] || null);
    assert.deepStrictEqual(C.validateRefs(linkFlow(2), 1, both), []);
    assert.deepStrictEqual(C.validateRefs(linkFlow(1), 2, both), []);
  });
});

describe('validate: one gate for structure and references', () => {
  it('includes the reference errors with the structure errors', () => {
    const f = flowWith([
      { id: 'A', type: 'start', title: 'a', exits: 'B' },
      { id: 'B', type: 'link', title: 'b', exits: '' },
    ]);
    assert.deepStrictEqual(messages(C.validate(f, { selfId: SELF, lib })), [
      'Fila 3 (B): no tiene salida y no es de tipo Fin.',
      'Fila 3 (B): falta el flujo de destino (columna Flujo).',
    ]);
  });

  it('refuses to run without refs on a flow with link or subflow steps', () => {
    assert.throws(() => C.validate(linkFlow(INST)), /pass \{ selfId, lib \}/);
    assert.deepStrictEqual(C.validate(linkFlow(INST), { selfId: SELF, lib }), []);
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

  it('keeps an unknown type as written, for validate to report', () => {
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
  it('reports an unknown "Depende de" step without blocking, and changes nothing', () => {
    const p = C.gridToDraft({ categories: [], rows: [row('A', 'start', { exits: 'B' }), row('B', 'end', { depends_on: 'ZZ' })] });
    assert.deepStrictEqual(p.errors, [{ row: 1, message: 'Fila 3 (B): depende de «ZZ», que no existe.', blocking: false }]);
    assert.strictEqual(p.steps[0].exits, 'B');
  });

  it('leaves the step checks to validate', () => {
    const p = C.gridToDraft({ categories: [], rows: [row('', 'Tarea'), row('A', 'end'), row('A', 'end')] });
    assert.deepStrictEqual(p.errors, []);
  });

  it('reads Instalaciones (30 steps) with no errors and a valid structure', () => {
    const p = C.gridToDraft(instalaciones, () => null);
    assert.deepStrictEqual(p.errors, []);
    const f = C.compile({ name: 'Instalaciones', categories: p.categories, steps: p.steps });
    assert.strictEqual(f.steps.length, 30);
    assert.deepStrictEqual(C.validate(f), []);
  });

  it('resolves Apertura de OT P13 to Instalaciones, and blocks while it does not exist', () => {
    const p = C.gridToDraft(apertura, (n) => (n === 'Instalaciones' ? INST : null));
    assert.deepStrictEqual(p.errors, []);
    const f = C.compile({ name: 'Apertura de OT', categories: p.categories, steps: p.steps });
    assert.strictEqual(f.steps.length, 36);
    const p13 = f.steps.find((s) => s.id === 'P13');
    assert.strictEqual(p13.type, 'link');
    assert.strictEqual(p13.ref, INST);
    assert.deepStrictEqual(C.validate(f, { selfId: SELF, lib }), []);

    const missing = C.gridToDraft(apertura, () => null);
    assert.deepStrictEqual(missing.errors, [{ row: 12, message: 'Fila 14 (P13): no existe un flujo llamado «Instalaciones».', blocking: true }]);
  });
});

describe('one row numbering: the spreadsheet\'s, with the step ID (1.2.6)', () => {
  it('validate and gridToDraft give the same step the same row', () => {
    const grid = { categories: [], rows: [row('P1', 'start', { ref: 'Facturación', depends_on: 'ZZ' }), row('P2', 'end')] };
    const all = review(grid);
    assert.deepStrictEqual(all.map((e) => e.message), [
      'Fila 2 (P1): la columna Flujo solo se usa en pasos Enlace o Subflujo; se ignoró «Facturación».',
      'Fila 2 (P1): depende de «ZZ», que no existe.',
      'Fila 2 (P1): no tiene salida y no es de tipo Fin.',
      'Fila 3 (P2): no es alcanzable desde ningún inicio.',
    ]);
  });

  it('names the row alone when the ID is missing', () => {
    const msgs = messages(C.validate(flowWith([row('P1', 'start', { exits: 'P2' }), row('', 'activity', { exits: 'P2' }), row('P2', 'end')])));
    assert.ok(msgs.includes('Fila 3: falta el ID.'), msgs.join(' / '));
  });

  it('names both rows of a repeated ID', () => {
    const msgs = messages(C.validate(flowWith([row('P1', 'start', { exits: 'P2' }), row('P2', 'end'), row('P2', 'end')])));
    assert.ok(msgs.includes('Fila 4 (P2): el ID «P2» está repetido; también está en la fila 3.'), msgs.join(' / '));
  });
});

describe('one error shape {row, message, blocking}, each problem once (1.2.6)', () => {
  it('blocks the import for a missing ID, a repeated ID and an unknown type, and nothing else', () => {
    const grid = { categories: [], rows: [
      row('P1', 'start', { exits: 'P2' }), row('', 'activity', { exits: 'P2' }), row('P2', 'Tarea'), row('P2', 'decision', { exits: 'P1' }),
    ] };
    const all = review(grid);
    assert.ok(all.every((e) => Object.keys(e).sort().join() === 'blocking,message,row'));
    assert.deepStrictEqual(all.filter((e) => e.blocking).map((e) => e.message), [
      'Fila 3: falta el ID.',
      'Fila 4 (P2): tipo «Tarea» no reconocido. Usa Inicio, Actividad, Decisión, Espera, Subflujo, Enlace o Fin.',
      'Fila 5 (P2): el ID «P2» está repetido; también está en la fila 4.',
    ]);
    // Structure rules are shown but only block publishing.
    assert.ok(all.some((e) => !e.blocking && e.message === 'Fila 5 (P2): una decisión necesita al menos dos salidas.'));
  });

  it('reports an unknown type exactly once', () => {
    const all = review({ categories: [], rows: [row('P1', 'Tarea')] });
    assert.strictEqual(all.filter((e) => /tipo «Tarea»/.test(e.message)).length, 1);
  });

  it('marks reference problems as not blocking: they stop publishing', () => {
    assert.deepStrictEqual(C.validateRefs(linkFlow(99), SELF, lib).map((e) => e.blocking), [false]);
  });
});

describe('flow ids stay numbers, never text (1.2.6)', () => {
  it('compile keeps the id exactly, and an empty target is null', () => {
    const f = linkFlow(INST);
    assert.strictEqual(f.steps[1].ref, INST);
    assert.strictEqual(typeof f.steps[1].ref, 'number');
    assert.strictEqual(linkFlow(undefined).steps[1].ref, null);
  });

  it('lib receives the id with the type it is stored with', () => {
    const seen = [];
    C.validate(linkFlow(INST), { selfId: SELF, lib: (id) => { seen.push(id); return lib(id); } });
    assert.deepStrictEqual(seen, [INST]);
  });

  it('a target with the same digits but as text is not the same flow', () => {
    // A Map, like the server's lookup, tells 20 from "20" (object keys would not).
    const byId = new Map([[SELF, { name: 'Yo', published: null }]]);
    const mapLib = (id) => byId.get(id) || null;
    assert.deepStrictEqual(messages(C.validateRefs(linkFlow(SELF), SELF, mapLib)), ['Fila 3 (B): un enlace no puede apuntar a su propio flujo.']);
    assert.deepStrictEqual(messages(C.validateRefs(linkFlow(String(SELF)), SELF, mapLib)), ['Fila 3 (B): el flujo de destino ya no existe.']);
  });
});
