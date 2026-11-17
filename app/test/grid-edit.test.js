// The step grid's operations (phase 5.3): grid-edit.js runs in the browser;
// its functions are tested here, in the Workers runtime. The page wiring
// (editor.js) is not, as with the other browser modules.
import { describe, expect, it } from 'vitest';
import { blankRow, checkGrid, compileGrid, dependsOnText, diagramKey, dropValues, nextStepId, renameStep, setDependsOn, suggestions, toSave } from '../public/js/grid-edit.js';

const row = (id, type, extra = {}) => ({ id, type, ref: '', title: 't' + id, description: '', tags: {}, exits: '', depends_on: '', ...extra });
const ids = (rows) => rows.map((r) => `${r.id}→${r.exits}`);

describe('nextStepId', () => {
  it('takes the next number after every P<n> in the grid and in any release', () => {
    expect(nextStepId([], [])).toBe('P1');
    expect(nextStepId([row('P1', 'start'), row('P7', 'end'), row('X3', 'end')], [])).toBe('P8');
    // P9 was published and since removed: it is not lent to a new step.
    expect(nextStepId([row('P1', 'start')], ['P1', 'P9'])).toBe('P10');
  });
});

describe('blankRow', () => {
  it('is an activity with an empty cell per category', () => {
    expect(blankRow(['Responsable', 'Herramienta'], 'P3')).toEqual(row('P3', 'activity', { title: '', tags: { Responsable: '', Herramienta: '' } }));
  });
});

describe('renameStep', () => {
  it('rewrites every exit that pointed at the old id, labels kept', () => {
    const rows = [row('P1', 'decision', { exits: 'Sí:P2 | No:P3' }), row('P2', 'activity', { exits: 'P3' }), row('P3', 'end')];
    expect(renameStep(rows, 2, ' P30 ')).toEqual({ ok: true });
    expect(ids(rows)).toEqual(['P1→Sí:P2, No:P30', 'P2→P30', 'P30→']);
  });

  it('refuses a blank id, a taken one, or one with separators, changing nothing', () => {
    const rows = [row('P1', 'start', { exits: 'P2' }), row('P2', 'end')];
    expect(renameStep(rows, 1, ' ')).toEqual({ ok: false, message: 'El ID no puede quedar vacío.' });
    expect(renameStep(rows, 1, 'P1')).toEqual({ ok: false, message: 'Ya hay un paso con el ID «P1».' });
    for (const bad of ['P 2', 'P2|', 'Sí:P2', 'P2,P3']) expect(renameStep(rows, 1, bad).ok, bad).toBe(false);
    expect(ids(rows)).toEqual(['P1→P2', 'P2→']);
  });

  it('gives a step with no id one, touching no exit', () => {
    const rows = [row('P1', 'start', { exits: 'P2' }), row('', 'end')];
    expect(renameStep(rows, 1, 'P2')).toEqual({ ok: true });
    expect(ids(rows)).toEqual(['P1→P2', 'P2→']);
  });
});

describe('"Depende de" and "Salidas", two views of one connection (SPEC §6)', () => {
  it('shows a step\'s predecessors, with the branch label of a decision', () => {
    const rows = [row('P1', 'decision', { exits: 'Sí:P3 | No:P2' }), row('P2', 'activity', { exits: 'P3' }), row('P3', 'end')];
    expect(dependsOnText(rows, 2)).toBe('Sí:P1, P2');
    expect(dependsOnText(rows, 0)).toBe('');
  });

  it('a new step filled only in "Depende de" updates its predecessor\'s exits', () => {
    const rows = [row('P1', 'start', { exits: 'P2' }), row('P2', 'end'), row('P3', 'activity', { exits: 'P2' })];
    expect(setDependsOn(rows, 2, 'P1')).toBe(null);
    expect(ids(rows)).toEqual(['P1→P2, P3', 'P2→', 'P3→P2']);
    // Taking a predecessor out of the list removes its exit.
    expect(setDependsOn(rows, 2, '')).toBe(null);
    expect(ids(rows)).toEqual(['P1→P2', 'P2→', 'P3→P2']);
    // A decision's branch carries its label.
    rows[0].type = 'decision';
    expect(setDependsOn(rows, 2, 'No:P1')).toBe(null);
    expect(rows[0].exits).toBe('P2, No:P3');
  });

  it('an unknown id is reported and changes nothing', () => {
    const rows = [row('P1', 'start', { exits: 'P2' }), row('P2', 'end')];
    expect(setDependsOn(rows, 1, 'P1 | P9')).toBe('No existe el paso «P9». No se cambió nada.');
    expect(ids(rows)).toEqual(['P1→P2', 'P2→']);
    expect(setDependsOn([row('', 'end')], 0, 'P1')).toBe('Ponle primero un ID al paso.');
  });
});

describe('checkGrid: what the server will say', () => {
  const ctx = { flowId: 1, name: 'Despachos', flows: [{ id: 1, name: 'Despachos', published: null }, { id: 2, name: 'Facturación', published: null }] };

  it('finds the publish rules and the blocking ones, with their rows', () => {
    let errors = checkGrid({ categories: [], rows: [row('P1', 'decision', { exits: 'P2' }), row('P1', 'end'), row('P3', 'activity')] }, ctx);
    expect(errors.filter((e) => e.blocking).map((e) => e.row)).toEqual([1]);
    const messages = errors.map((e) => e.message).join('\n');
    expect(messages).toContain('Fila 2 (P1): es una decisión, pero solo tiene una salida, a P2.');
    expect(messages).toContain('no lleva a ningún paso');
    expect(messages).toContain('Ningún paso es de tipo Inicio: cambia a Inicio el paso con el que empieza el proceso.');
    errors = checkGrid({ categories: [], rows: [row('P1', 'start', { exits: 'P2' }), row('P2', 'end'), row('P3', 'end')] }, ctx);
    expect(errors.map((e) => [e.row, e.message])).toEqual([[2, 'Fila 4 (P3): ningún camino desde el Inicio llega a este paso. Escribe en su Depende de el paso que va antes.']]);
  });

  it('resolves link targets by name, ignoring case and accents, as the server does', () => {
    const grid = { categories: [], rows: [row('P1', 'start', { exits: 'P2' }), row('P2', 'link', { ref: 'facturacion', exits: 'P3' }), row('P3', 'end')] };
    expect(checkGrid(grid, ctx)).toEqual([]);
    grid.rows[1].ref = 'Despachos';
    expect(checkGrid(grid, ctx).map((e) => e.message)).toEqual(['Fila 3 (P2): es un enlace a este mismo flujo, y un enlace lleva a otro. Para volver a un paso de este flujo, escríbelo en Salidas.']);
    grid.rows[1].ref = '';
    expect(checkGrid(grid, ctx).map((e) => e.message)).toEqual(['Fila 3 (P2): es un enlace, pero no dice a qué flujo lleva. Elígelo en la columna Flujo.']);
  });
});

describe('the messages say what is wrong with that row, with its own data', () => {
  const ctx = { flowId: 1, name: 'Despachos', flows: [{ id: 1, name: 'Despachos', published: null }] };
  const decision = (exits) =>
    checkGrid({ categories: [], rows: [row('P1', 'start', { exits: 'P2' }), row('P2', 'decision', { exits }), row('P3', 'end'), row('P4', 'end'), row('P5', 'end')] }, ctx)
      .filter((e) => e.row === 1)
      .map((e) => e.message);

  it('names the decision\'s own exits in its example', () => {
    // The owner's case: a decision P2 going to P3 and P4, with no labels.
    expect(decision('P3 | P4')).toEqual([
      'Fila 3 (P2): es una decisión, así que cada salida necesita un rótulo que diga qué significa. Por ejemplo: Sí:P3, No:P4.',
    ]);
    // A label already there is kept; the others get the ones still free.
    expect(decision('No:P3, P4')).toEqual([
      'Fila 3 (P2): es una decisión, así que cada salida necesita un rótulo que diga qué significa. Por ejemplo: No:P3, Sí:P4.',
    ]);
    expect(decision('P3 | P4 | P5')[0]).toMatch(/Por ejemplo: Sí:P3, No:P4, Opción 3:P5\.$/);
  });

  it('says how many exits a decision has, and only one message for it', () => {
    expect(decision('P3')).toEqual([
      'Fila 3 (P2): es una decisión, pero solo tiene una salida, a P3. Necesita una por cada respuesta, con su rótulo. Por ejemplo: Sí:P3, y No: con el ID del paso al que lleva esa respuesta.',
    ]);
    // The label it suggests is the one still free.
    expect(decision('No:P3')).toEqual([
      'Fila 3 (P2): es una decisión, pero solo tiene una salida, a P3. Necesita una por cada respuesta, con su rótulo. Por ejemplo: No:P3, y Sí: con el ID del paso al que lleva esa respuesta.',
    ]);
    // P3..P5 are unreachable then; this row has its own message only.
    expect(decision('')).toEqual([
      'Fila 3 (P2): es una decisión, pero no tiene salidas. Necesita una por cada respuesta, cada una con su rótulo y el ID del paso al que lleva; por ejemplo, una con Sí: y otra con No:.',
    ]);
  });
});

describe('the preview (phase 5.4)', () => {
  const ctx = { flowId: 1, name: 'Despachos', flows: [{ id: 1, name: 'Despachos', published: null }, { id: 2, name: 'Facturación', published: null }] };

  it('compiles the grid as the server does: "Depende de" merged, links resolved', () => {
    const grid = { categories: ['R'], rows: [row('P1', 'start', { tags: { R: 'a, b' } }), row('P2', 'link', { ref: 'FACTURACION', depends_on: 'P1' })] };
    const { flow, errors } = compileGrid(grid, ctx);
    expect(errors).toEqual([]);
    expect(flow.steps.map((s) => [s.id, s.exits, s.ref])).toEqual([['P1', [{ label: '', to: 'P2' }], null], ['P2', [], 2]]);
    expect(flow.steps[0].tags).toEqual({ R: ['a', 'b'] });
    // The same problems with or without the compiled flow at hand.
    expect(checkGrid(grid, ctx, compileGrid(grid, ctx))).toEqual(checkGrid(grid, ctx));
  });

  it('redraws only when what the diagram shows changed', () => {
    const grid = { categories: ['R'], rows: [row('P1', 'start', { exits: 'P2' }), row('P2', 'end')] };
    const key = () => diagramKey(compileGrid(grid, ctx).flow);
    const before = key();
    grid.rows[0].description = 'Otra descripción';
    grid.rows[1].tags = { R: 'Almacén' };
    expect(key()).toBe(before);
    for (const change of [() => (grid.rows[0].title = 'Nuevo'), () => (grid.rows[1].type = 'activity'), () => (grid.rows[0].exits = 'Sí:P2'), () => (grid.rows[1].id = 'P9')]) {
      const was = key();
      change();
      expect(key()).not.toBe(was);
    }
  });
});

describe('toSave', () => {
  it('sends exits as the one source, and does not touch the rows on screen', () => {
    const grid = { categories: ['R'], rows: [row('P1', 'start', { depends_on: 'P0', tags: { R: 'a' } })] };
    const sent = toSave(grid);
    expect(sent.rows[0].depends_on).toBe('');
    sent.rows[0].tags.R = 'b';
    expect(grid.rows[0].tags.R).toBe('a');
    expect(grid.rows[0].depends_on).toBe('P0');
  });
});

describe('suggestions', () => {
  const values = [{ value: 'Almacén' }, { value: 'Ventas' }, { value: 'Compras' }];
  const steps = [{ value: 'P1', label: 'Recibir' }, { value: 'P2', label: 'Revisar inventario' }, { value: 'P3', label: 'Comprar' }];

  it('completes the last value of a cell, keeping what came before and leaving out what is there', () => {
    expect(suggestions('', values, 'tags').map((o) => o.value)).toEqual(['Almacén', 'Ventas', 'Compras']);
    expect(suggestions('alma', values, 'tags').map((o) => o.value)).toEqual(['Almacén']);
    expect(suggestions('Almacén, v', values, 'tags').map((o) => o.value)).toEqual(['Almacén, Ventas']);
    expect(suggestions('Almacén, ', values, 'tags').map((o) => o.value)).toEqual(['Almacén, Ventas', 'Almacén, Compras']);
  });

  it('completes step ids, by id or by title, after a branch label', () => {
    expect(suggestions('P', steps, 'steps').map((o) => o.value)).toEqual(['P1', 'P2', 'P3']);
    expect(suggestions('inventario', steps, 'steps')).toEqual([{ value: 'P2', label: 'Revisar inventario' }]);
    expect(suggestions('Sí:P1 | No:', steps, 'steps').map((o) => o.value)).toEqual(['Sí:P1 | No:P2', 'Sí:P1 | No:P3']);
  });
});

describe('dropValues', () => {
  it('takes rejected values out of their category\'s cells only', () => {
    const grid = { categories: ['R', 'H'], rows: [row('P1', 'start', { tags: { R: 'Ventas, compras', H: 'Compras' } })] };
    dropValues(grid, [{ category: 'r', name: 'Compras' }]);
    expect(grid.rows[0].tags).toEqual({ R: 'Ventas', H: 'Compras' });
  });
});
