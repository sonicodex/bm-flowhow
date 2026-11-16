import type { Flow, FlowEntry, FlowLib } from "../public/js/core.js";
import { documentToFlow, EMPTY_DOCUMENT, loadTagIndex, type FlowDocument } from "./document.ts";
import { NAME_RULE, nameKey } from "./names.ts";

export const COLOURS = 12;

export type FlowRow = { id: number; name: string; objective: string; colour: number };

export async function getFlow(db: D1Database, id: number): Promise<FlowRow | null> {
  return db.prepare("SELECT id, name, objective, colour FROM flows WHERE id = ?").bind(id).first<FlowRow>();
}

export type Release = { id: number; major: number; minor: number; flow: Flow };

type ReleaseRow = { id: number; major: number; minor: number; document: string };

async function compileRelease(db: D1Database, flow: FlowRow, row: ReleaseRow | null): Promise<Release | null> {
  if (!row) return null;
  const document = JSON.parse(row.document) as FlowDocument;
  return { id: row.id, major: row.major, minor: row.minor, flow: documentToFlow(flow.name, flow.objective, document, await loadTagIndex(db)) };
}

// The flow's latest release, compiled: what users see and tour (§8). Null
// when the flow has never been published.
export async function latestRelease(db: D1Database, flow: FlowRow): Promise<Release | null> {
  const row = await db
    .prepare("SELECT id, major, minor, document FROM releases WHERE flow_id = ? ORDER BY major DESC, minor DESC LIMIT 1")
    .bind(flow.id)
    .first<ReleaseRow>();
  return compileRelease(db, flow, row);
}

// One release of the flow, compiled. Releases are kept forever (§8), so a
// tour started on one can always finish on it.
export async function getRelease(db: D1Database, flow: FlowRow, releaseId: number): Promise<Release | null> {
  const row = await db
    .prepare("SELECT id, major, minor, document FROM releases WHERE id = ? AND flow_id = ?")
    .bind(releaseId, flow.id)
    .first<ReleaseRow>();
  return compileRelease(db, flow, row);
}

// SPEC §9: a new flow gets the first colour not yet in use. Once all twelve
// are taken, the least used one, lowest number first.
export function nextColour(used: number[]): number {
  const count = new Map<number, number>();
  for (const c of used) count.set(c, (count.get(c) ?? 0) + 1);
  let best = 1;
  for (let c = 1; c <= COLOURS; c++) if ((count.get(c) ?? 0) < (count.get(best) ?? 0)) best = c;
  return best;
}

// A new flow starts with an empty draft (it has no release to copy from).
export async function createFlow(
  db: D1Database,
  name: string,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Escribe el nombre del flujo." };
  const key = nameKey(clean);
  const existing = await db.prepare("SELECT name FROM flows WHERE name_key = ?").bind(key).first<string>("name");
  if (existing !== null) return { ok: false, error: `Ya existe un flujo llamado «${existing}». ${NAME_RULE}` };
  const used = (await db.prepare("SELECT colour FROM flows").all<{ colour: number }>()).results.map((r) => r.colour);
  const [inserted] = await db.batch([
    db.prepare("INSERT INTO flows (name, name_key, colour) VALUES (?, ?, ?)").bind(clean, key, nextColour(used)),
    db
      .prepare("INSERT INTO drafts (flow_id, document) SELECT id, ? FROM flows WHERE name_key = ?")
      .bind(JSON.stringify(EMPTY_DOCUMENT), key),
  ]);
  return { ok: true, id: inserted!.meta.last_row_id };
}

export type FlowDetails = { name: string; objective: string; areaIds: number[] };

// The flow form (SPEC §6; phase 4.4): name, objective and assigned areas,
// written in one batch. Areas are optional here; the first publication
// requires one (§5). A flow's steps refer to other flows by id, so a rename
// breaks no link.
export async function saveFlowDetails(db: D1Database, id: number, details: FlowDetails): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = details.name.trim();
  if (!name) return { ok: false, error: "Escribe el nombre del flujo." };
  const key = nameKey(name);
  const taken = await db.prepare("SELECT id, name FROM flows WHERE name_key = ?").bind(key).first<{ id: number; name: string }>();
  if (taken && taken.id !== id) return { ok: false, error: `Ya existe un flujo llamado «${taken.name}». ${NAME_RULE}` };
  try {
    await db.batch([
      db.prepare("UPDATE flows SET name = ?, name_key = ?, objective = ? WHERE id = ?").bind(name, key, details.objective.trim(), id),
      db.prepare("DELETE FROM flow_areas WHERE flow_id = ?").bind(id),
      ...[...new Set(details.areaIds)].map((areaId) => db.prepare("INSERT INTO flow_areas (flow_id, area_id) VALUES (?, ?)").bind(id, areaId)),
    ]);
  } catch (e) {
    const message = String(e);
    if (/UNIQUE/.test(message)) return { ok: false, error: `Ya existe un flujo con ese nombre. ${NAME_RULE}` };
    if (/FOREIGN KEY/.test(message)) return { ok: false, error: "Una de las áreas elegidas ya no existe." };
    throw e;
  }
  return { ok: true };
}

// Every flow, for resolving target names (ignoring case and accents) and for
// validateRefs(): `lib(id)` gives the flow's name and its latest release.
export async function flowCatalog(db: D1Database): Promise<{ resolve: (name: string) => number | null; lib: FlowLib }> {
  const [flows, latest] = await db.batch<Record<string, unknown>>([
    db.prepare("SELECT id, name, name_key FROM flows"),
    db.prepare(
      `SELECT flow_id, document FROM (
         SELECT flow_id, document, ROW_NUMBER() OVER (PARTITION BY flow_id ORDER BY major DESC, minor DESC) AS n
         FROM releases) WHERE n = 1`,
    ),
  ]);
  const published = new Map(latest.results.map((r) => [r.flow_id as number, JSON.parse(r.document as string) as FlowDocument]));
  const byKey = new Map(flows.results.map((f) => [f.name_key as string, f.id as number]));
  const byId = new Map<number, FlowEntry>(
    flows.results.map((f) => {
      const doc = published.get(f.id as number);
      // validateRefs() only follows types and refs of a published flow.
      const flow = doc && {
        name: f.name as string,
        objective: "",
        categories: [],
        steps: doc.steps.map((s) => ({ ...s, tags: {} })),
      };
      return [f.id as number, { name: f.name as string, published: flow ?? null }];
    }),
  );
  return {
    resolve: (name) => byKey.get(nameKey(name)) ?? null,
    lib: (id) => byId.get(id) ?? null,
  };
}
