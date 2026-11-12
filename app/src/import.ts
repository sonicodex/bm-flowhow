import Core, { type Flow, type Grid, type RowError } from "../public/js/core.js";
import { loadTagIndex, type DocStep, type FlowDocument, type TagIndex } from "./document.ts";
import { flowCatalog, getFlow } from "./flows.ts";
import { nameKey } from "./names.ts";

// SPEC §6 and §9: the browser parses the paste or the .xlsx into a grid; the
// server checks it, shows the review, and on confirmation replaces the draft.

const ROW_FIELDS = ["id", "type", "ref", "title", "description", "exits", "depends_on"] as const;

// A grid that does not have exactly this shape did not come from our own
// parser: it is refused whole (400), not reviewed row by row.
export function parseGrid(body: unknown): { ok: true; grid: Grid } | { ok: false; error: string } {
  const fail = (why: string) => ({ ok: false as const, error: `El grid no tiene la forma esperada: ${why}` });
  if (typeof body !== "object" || body === null) return fail("no es un objeto.");
  const { categories, rows } = body as Record<string, unknown>;
  if (!Array.isArray(categories) || !categories.every((c) => typeof c === "string" && c.trim() !== "")) {
    return fail("categories debe ser una lista de nombres.");
  }
  const keys = categories.map((c: string) => nameKey(c));
  if (new Set(keys).size !== keys.length) return fail("hay una categoría repetida.");
  if (!Array.isArray(rows) || rows.length === 0) return fail("rows debe ser una lista con al menos una fila.");
  for (const [i, row] of rows.entries()) {
    if (typeof row !== "object" || row === null) return fail(`la fila ${i} no es un objeto.`);
    const r = row as Record<string, unknown>;
    const bad = ROW_FIELDS.find((f) => typeof r[f] !== "string");
    if (bad) return fail(`la fila ${i} no trae el campo de texto ${bad}.`);
    const tags = r.tags;
    if (typeof tags !== "object" || tags === null || Array.isArray(tags)) return fail(`la fila ${i} no trae tags.`);
    const t = tags as Record<string, unknown>;
    if (!categories.every((c: string) => typeof t[c] === "string") || Object.keys(t).length !== categories.length) {
      return fail(`los tags de la fila ${i} no coinciden con las categorías.`);
    }
  }
  return { ok: true, grid: body as Grid };
}

export type NewTag = { category: string; name: string };
export type Accepted = { categories: string[]; tags: NewTag[] };

export type Review = {
  errors: RowError[];
  blocking: boolean;
  // What the admin must accept or reject (SPEC §6), with the grid's spelling.
  newCategories: string[];
  newTags: NewTag[];
  // The flow as it would be drafted, every category and tag kept, for the
  // review's diagram.
  flow: Flow;
};

type Prepared = Review & { steps: Flow["steps"]; categories: string[] };

async function prepare(db: D1Database, flowId: number, grid: Grid, index: TagIndex): Promise<Prepared> {
  const flowRow = await getFlow(db, flowId);
  if (!flowRow) throw new Error(`import: flow ${flowId} does not exist.`);
  const { resolve, lib } = await flowCatalog(db);
  const draft = Core.gridToDraft(grid, resolve);
  const flow = Core.compile({ name: flowRow.name, objective: flowRow.objective, categories: draft.categories, steps: draft.steps });
  const errors = draft.errors.concat(Core.validate(flow, { selfId: flowId, lib }));

  const knownCats = new Map(index.categories.map((c) => [c.key, c]));
  const knownTags = new Set(index.tags.map((t) => `${t.categoryId}:${t.key}`));
  const newCategories = flow.categories.filter((c) => !knownCats.has(nameKey(c)));
  const newTags: NewTag[] = [];
  const seen = new Set<string>();
  for (const category of flow.categories) {
    const cat = knownCats.get(nameKey(category));
    for (const step of flow.steps) {
      for (const name of step.tags[category] ?? []) {
        const key = `${nameKey(category)}:${nameKey(name)}`;
        if (seen.has(key) || (cat && knownTags.has(`${cat.id}:${nameKey(name)}`))) continue;
        seen.add(key);
        newTags.push({ category, name });
      }
    }
  }
  return {
    errors,
    blocking: errors.some((e) => e.blocking),
    newCategories,
    newTags,
    flow,
    steps: flow.steps,
    categories: flow.categories,
  };
}

// Read-only: what the import would do, for the review screen.
export async function reviewGrid(db: D1Database, flowId: number, grid: Grid): Promise<Review> {
  const { steps: _s, categories: _c, ...review } = await prepare(db, flowId, grid, await loadTagIndex(db));
  return review;
}

// The stored document of a prepared grid, with the categories and tags that
// exist in `index`; any other is dropped.
function toDocument(prep: Prepared, index: TagIndex): FlowDocument {
  const catByKey = new Map(index.categories.map((c) => [c.key, c.id]));
  const tagByKey = new Map(index.tags.map((t) => [`${t.categoryId}:${t.key}`, t.id]));
  const steps: DocStep[] = prep.steps.map((s) => {
    const ids: number[] = [];
    for (const category of prep.categories) {
      const catId = catByKey.get(nameKey(category));
      if (catId === undefined) continue; // rejected category: its column is dropped
      for (const name of s.tags[category] ?? []) {
        const id = tagByKey.get(`${catId}:${nameKey(name)}`);
        if (id !== undefined && !ids.includes(id)) ids.push(id); // rejected tags are dropped
      }
    }
    return { id: s.id, type: s.type, title: s.title, description: s.description, ref: s.ref, tags: ids, exits: s.exits };
  });
  return { steps };
}

// The document an import of this grid would store, when nothing is left to
// accept or reject; null when something blocks or is new. Read-only: the dev
// loader uses it to leave an unchanged flow alone.
export async function documentFor(db: D1Database, flowId: number, grid: Grid): Promise<FlowDocument | null> {
  const index = await loadTagIndex(db);
  const prep = await prepare(db, flowId, grid, index);
  if (prep.blocking || prep.newCategories.length || prep.newTags.length) return null;
  return toDocument(prep, index);
}

export type ApplyResult = { ok: true; document: FlowDocument } | { ok: false; errors: RowError[] };

// Replaces the draft with the grid, as one save (draft plus save point).
// Accepted categories and tags are created; anything new and not accepted
// is dropped: a rejected category takes its column with it. Refused if any
// error blocks. The grid is reviewed again here: the server never trusts
// the review the browser saw.
export async function applyGrid(
  db: D1Database,
  flowId: number,
  grid: Grid,
  accepted: Accepted,
  userId: number | null = null,
): Promise<ApplyResult> {
  let index = await loadTagIndex(db);
  const prep = await prepare(db, flowId, grid, index);
  if (prep.blocking) return { ok: false, errors: prep.errors.filter((e) => e.blocking) };

  const acceptCat = new Set(accepted.categories.map(nameKey));
  const acceptTag = new Set(accepted.tags.map((t) => `${nameKey(t.category)}:${nameKey(t.name)}`));
  const cats = prep.newCategories.filter((c) => acceptCat.has(nameKey(c)));
  const tags = prep.newTags.filter((t) => acceptTag.has(`${nameKey(t.category)}:${nameKey(t.name)}`));
  if (cats.length || tags.length) {
    // Created before the draft so the document can hold their ids. Both
    // inserts tolerate a concurrent creation of the same name. (`WHERE true`:
    // SQLite cannot parse INSERT ... SELECT ... ON CONFLICT without a WHERE.)
    await db.batch([
      ...cats.map((c) =>
        db
          .prepare(
            "INSERT INTO tag_categories (name, name_key, position) SELECT ?, ?, coalesce(max(position), 0) + 1 FROM tag_categories WHERE true ON CONFLICT (name_key) DO NOTHING",
          )
          .bind(c.trim(), nameKey(c)),
      ),
      ...tags.map((t) =>
        db
          .prepare(
            "INSERT INTO tags (category_id, name, name_key) SELECT id, ?, ? FROM tag_categories WHERE name_key = ? ON CONFLICT (category_id, name_key) DO NOTHING",
          )
          .bind(t.name.trim(), nameKey(t.name), nameKey(t.category)),
      ),
    ]);
    index = await loadTagIndex(db);
  }

  const document = toDocument(prep, index);
  const json = JSON.stringify(document);
  await db.batch([
    db
      .prepare(
        `INSERT INTO drafts (flow_id, document, updated_by) VALUES (?, ?, ?)
         ON CONFLICT (flow_id) DO UPDATE SET document = excluded.document, updated_by = excluded.updated_by,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(flowId, json, userId),
    db.prepare("INSERT INTO save_points (flow_id, document, created_by) VALUES (?, ?, ?)").bind(flowId, json, userId),
  ]);
  return { ok: true, document };
}
