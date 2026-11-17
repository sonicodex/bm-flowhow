// The step grid's operations (SPEC §6; phase 5.3), apart from the page, so
// they are tested in the Workers runtime. The rows are the grid's own
// (`{id, type, ref, title, description, tags, exits, depends_on}`, `ref` the
// target flow's name): what the server reads back on saving. Exits are the
// one source of the connections; "Depende de" is computed from them and,
// when edited, rewritten into the predecessors' exits (core.js).
import Core from './core.js';

/**
 * @typedef {import('./core.js').Grid} Grid
 * @typedef {import('./core.js').GridRow} GridRow
 * @typedef {import('./core.js').RowError} RowError
 * @typedef {import('./core.js').Flow} Flow
 * @typedef {{ id: number, name: string, published: Flow|null }} FlowListEntry
 * @typedef {{ flowId: number, name: string, flows: FlowListEntry[] }} CheckContext
 */

/**
 * The id for a new step: P and the next number after every P<n> in the grid
 * and every id ever published (`used`), so a step removed from a release
 * never lends its id, and with it its readers' progress, to a new one.
 * @param {GridRow[]} rows @param {string[]} used @returns {string}
 */
export function nextStepId(rows, used) {
  let max = 0;
  for (const id of rows.map((r) => r.id).concat(used)) {
    const m = /^P(\d+)$/.exec(String(id).trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return 'P' + (max + 1);
}

/** @param {string[]} categories @param {string} id @returns {GridRow} */
export function blankRow(categories, id) {
  /** @type {Record<string, string>} */
  const tags = {};
  for (const c of categories) tags[c] = '';
  return { id, type: 'activity', ref: '', title: '', description: '', tags, exits: '', depends_on: '' };
}

/**
 * Gives the step at `index` a new id and rewrites every exit that pointed at
 * the old one (phase 5 plan, answer 4). A blank id, or one another step
 * already has, is refused with the reason and changes nothing.
 * @param {GridRow[]} rows @param {number} index @param {string} newId
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function renameStep(rows, index, newId) {
  const row = rows[index];
  const id = String(newId).trim();
  const old = String(row.id).trim();
  if (id === old) return { ok: true };
  if (!id) return { ok: false, message: 'El ID no puede quedar vacío.' };
  if (/[|;:,\s]/.test(id)) return { ok: false, message: 'El ID no puede llevar espacios ni los signos | ; : , que separan las salidas.' };
  if (rows.some((r, i) => i !== index && String(r.id).trim() === id)) return { ok: false, message: `Ya hay un paso con el ID «${id}».` };
  if (old) {
    for (const r of rows) {
      const exits = Core.parseExits(r.exits);
      if (exits.some((e) => e.to === old)) r.exits = Core.formatExits(exits.map((e) => (e.to === old ? { label: e.label, to: id } : e)));
    }
  }
  row.id = id;
  return { ok: true };
}

/** "Depende de" of the step at `index`: its predecessors, from their exits. */
/** @param {GridRow[]} rows @param {number} index @returns {string} */
export function dependsOnText(rows, index) {
  return Core.predecessorsText({ steps: /** @type {any} */ (rows) }, rows[index].id);
}

/**
 * Makes exactly the listed steps lead to the step at `index`, rewriting their
 * exits. An unknown id changes nothing (SPEC §6) and says which.
 * @param {GridRow[]} rows @param {number} index @param {string} text
 * @returns {string|null} the message to show, or null when it was applied
 */
export function setDependsOn(rows, index, text) {
  const res = Core.applyDependsOn({ steps: /** @type {any} */ (rows) }, index, text);
  if (res.noId) return 'Ponle primero un ID al paso.';
  if (res.unknown.length) return `No existe el paso «${res.unknown.join('», «')}». No se cambió nada.`;
  return null;
}

/**
 * The grid compiled as the server compiles it: target names resolved with
 * the same list of flows, "Depende de" merged into exits. `errors` are what
 * only this step knows (unknown target names, unknown predecessors).
 * @param {Grid} grid @param {CheckContext} ctx @returns {{ flow: Flow, errors: RowError[] }}
 */
export function compileGrid(grid, ctx) {
  const byKey = new Map(ctx.flows.map((f) => [Core.norm(f.name), f.id]));
  const draft = Core.gridToDraft(grid, (name) => byKey.get(Core.norm(name)) ?? null);
  return { flow: Core.compile({ name: ctx.name, objective: '', categories: draft.categories, steps: draft.steps }), errors: draft.errors };
}

/**
 * Every problem of the grid, as the server will find them on saving and on
 * publishing: the same core.js functions, with the same list of flows.
 * @param {Grid} grid @param {CheckContext} ctx
 * @param {{ flow: Flow, errors: RowError[] }} [compiled] compileGrid's answer, when already at hand
 * @returns {RowError[]}
 */
export function checkGrid(grid, ctx, compiled) {
  const byId = new Map(ctx.flows.map((f) => [f.id, { name: f.name, published: f.published }]));
  const { flow, errors } = compiled || compileGrid(grid, ctx);
  return errors.concat(Core.validate(flow, { selfId: ctx.flowId, lib: (id) => byId.get(id) ?? null }));
}

/**
 * What the diagram draws of a compiled flow: steps, types, titles and
 * exits. When it has not changed, the preview is not laid out again (typing
 * a description or a tag redraws nothing).
 * @param {Flow} flow @returns {string}
 */
export function diagramKey(flow) {
  return JSON.stringify(flow.steps.map((s) => [s.id, s.type, s.title, s.exits]));
}

/** The grid as it is sent: exits carry every connection. @param {Grid} grid @returns {Grid} */
export function toSave(grid) {
  return { categories: grid.categories.slice(), rows: grid.rows.map((r) => ({ ...r, tags: { ...r.tags }, depends_on: '' })) };
}

/**
 * Completions for a cell that holds several values: what was typed before
 * the last separator stays, and the options complete the last part. Every
 * list is separated by commas (SPEC §5); exits and "Depende de" are still
 * read with "|" or ";" too, and an exit may carry a label ("Sí:P5"), kept
 * too.
 * @param {string} text what the cell holds
 * @param {{ value: string, label?: string }[]} options
 * @param {'tags'|'steps'} kind
 * @returns {{ value: string, label?: string }[]}
 */
export function suggestions(text, options, kind) {
  const cut = kind === 'tags' ? text.lastIndexOf(',') : Math.max(...[',', '|', ';'].map((c) => text.lastIndexOf(c)));
  let head = cut === -1 ? '' : text.slice(0, cut + 1) + ' ';
  let part = (cut === -1 ? text : text.slice(cut + 1)).trim();
  if (kind === 'steps') {
    const colon = part.lastIndexOf(':');
    if (colon !== -1) {
      head += part.slice(0, colon + 1);
      part = part.slice(colon + 1).trim();
    }
  }
  const taken = new Set((kind === 'tags' ? Core.parseTags(text) : Core.parseExits(text).map((e) => e.to)).map(Core.norm));
  const want = Core.norm(part);
  return options
    .filter((o) => !taken.has(Core.norm(o.value)) || Core.norm(o.value) === want)
    .filter((o) => Core.norm(o.value).startsWith(want) || (o.label && Core.norm(o.label).includes(want)))
    .map((o) => ({ value: head + o.value, label: o.label }));
}

/**
 * Takes the rejected new values out of the cells, so the grid on screen
 * matches what the server keeps (it drops them: phase 5 plan, answer 2).
 * @param {Grid} grid @param {{ category: string, name: string }[]} rejected
 */
export function dropValues(grid, rejected) {
  for (const r of grid.rows) {
    for (const c of grid.categories) {
      const gone = new Set(rejected.filter((t) => Core.norm(t.category) === Core.norm(c)).map((t) => Core.norm(t.name)));
      if (gone.size) r.tags[c] = Core.parseTags(r.tags[c]).filter((v) => !gone.has(Core.norm(v))).join(', ');
    }
  }
}
