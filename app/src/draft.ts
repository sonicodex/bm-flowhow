import type { Grid, RowError } from "../public/js/core.js";
import { documentToGrid, EMPTY_DOCUMENT, loadTagIndex, type FlowDocument } from "./document.ts";
import { flowCatalog } from "./flows.ts";
import { applyGrid, parseGrid, reviewGrid, type Accepted, type Base, type NewTag } from "./import.ts";

// The draft as the editor sees it (SPEC §6, §8; phase 5.2). Editors only:
// drafts and save points never reach anyone else (§9).

// The grid the editor opens with, and the base its save must name. With no
// draft, the latest release is shown and nothing is written until the first
// save: opening the editor does not create a draft.
export type Opened = { grid: Grid; base: string; source: "draft" | "release" | "empty" };

export const baseToken = (base: Base) => ("draft" in base ? `draft:${base.draft}` : `release:${base.release}`);

export function parseBase(raw: unknown): Base | null {
  const m = /^(draft|release):(\d{1,15})$/.exec(String(raw ?? ""));
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] === "draft" ? (n >= 1 ? { draft: n } : null) : { release: n };
}

export async function openDraft(db: D1Database, flowId: number): Promise<Opened> {
  const [draft, release] = await db.batch<{ document: string; revision?: number; id?: number }>([
    db.prepare("SELECT document, revision FROM drafts WHERE flow_id = ?").bind(flowId),
    db.prepare("SELECT id, document FROM releases WHERE flow_id = ? ORDER BY id DESC LIMIT 1").bind(flowId),
  ]);
  const d = draft!.results[0];
  const r = release!.results[0];
  const [doc, base, source]: [FlowDocument, Base, Opened["source"]] = d
    ? [JSON.parse(d.document), { draft: d.revision! }, "draft"]
    : r
      ? [JSON.parse(r.document), { release: r.id! }, "release"]
      : [EMPTY_DOCUMENT, { release: 0 }, "empty"];
  const [index, { lib }] = await Promise.all([loadTagIndex(db), flowCatalog(db)]);
  return { grid: documentToGrid(doc, index, (id) => lib(id)?.name ?? null), base: baseToken(base), source };
}

// What a save answers, as JSON for the grid's script.
export type SaveAnswer =
  | { status: "invalid"; error: string }
  | { status: "blocked"; errors: RowError[] }
  // New categories or values to accept or reject before anything is written
  // (phase 5 plan, answer 2). The same save, sent again with `accepted`,
  // creates the accepted ones and drops the rest.
  | { status: "confirm"; newCategories: string[]; newTags: NewTag[] }
  | { status: "conflict"; message: string }
  | { status: "saved"; base: string; saved: boolean };

function parseAccepted(raw: unknown): Accepted | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") return null;
  const { categories, tags } = raw as Record<string, unknown>;
  if (!Array.isArray(categories) || !categories.every((c) => typeof c === "string")) return null;
  if (!Array.isArray(tags) || !tags.every((t) => t && typeof t.category === "string" && typeof t.name === "string")) return null;
  return { categories, tags: tags.map((t) => ({ category: t.category, name: t.name })) };
}

// An editor's save: `{grid, base, accepted?}`. An empty grid is allowed
// here, unlike an import: a draft may have no steps yet.
export async function saveDraft(db: D1Database, flowId: number, body: unknown, userId: number): Promise<SaveAnswer> {
  if (typeof body !== "object" || body === null) return { status: "invalid", error: "El guardado no tiene la forma esperada." };
  const b = body as Record<string, unknown>;
  const base = parseBase(b.base);
  if (!base) return { status: "invalid", error: "El guardado no dice de qué borrador partió." };
  const accepted = parseAccepted(b.accepted);
  if (accepted === null) return { status: "invalid", error: "La lista de etiquetas aceptadas no tiene la forma esperada." };
  const parsed = parseGrid(b.grid, { allowEmpty: true });
  if (parsed.ok === false) return { status: "invalid", error: parsed.error };

  if (!accepted) {
    const review = await reviewGrid(db, flowId, parsed.grid);
    if (review.blocking) return { status: "blocked", errors: review.errors.filter((e) => e.blocking) };
    if (review.newCategories.length || review.newTags.length) {
      return { status: "confirm", newCategories: review.newCategories, newTags: review.newTags };
    }
  }
  const r = await applyGrid(db, flowId, parsed.grid, accepted ?? { categories: [], tags: [] }, userId, base);
  if (r.ok === true) return { status: "saved", base: baseToken({ draft: r.revision }), saved: r.saved };
  if (r.conflict) return { status: "conflict", message: r.errors[0]!.message };
  return { status: "blocked", errors: r.errors };
}

// The review of an import (SPEC §6 import rules; phase 5.5): read-only,
// before anything replaces the draft. The browser draws the diagram from
// the same grid; this says what only the server knows: links resolved
// against every flow, and which categories and values are new. An import
// needs at least one row, unlike an editor's save.
export type ImportReview =
  | { status: "invalid"; error: string }
  | { status: "review"; errors: RowError[]; blocking: boolean; newCategories: string[]; newTags: NewTag[] };

export async function reviewImport(db: D1Database, flowId: number, body: unknown): Promise<ImportReview> {
  const grid = typeof body === "object" && body !== null ? (body as Record<string, unknown>).grid : undefined;
  const parsed = parseGrid(grid);
  if (parsed.ok === false) return { status: "invalid", error: parsed.error };
  const { errors, blocking, newCategories, newTags } = await reviewGrid(db, flowId, parsed.grid);
  return { status: "review", errors, blocking, newCategories, newTags };
}

export type SavePoint = { id: number; createdAt: string; by: string | null; steps: number; current: boolean };

// Newest first. `current`: the draft holds exactly this point's document.
export async function listSavePoints(db: D1Database, flowId: number): Promise<SavePoint[]> {
  const { results } = await db
    .prepare(
      `SELECT sp.id, sp.created_at AS createdAt, u.full_name AS by,
         json_array_length(sp.document, '$.steps') AS steps,
         coalesce(sp.document = (SELECT document FROM drafts d WHERE d.flow_id = sp.flow_id), 0) AS current
       FROM save_points sp LEFT JOIN users u ON u.id = sp.created_by
       WHERE sp.flow_id = ? ORDER BY sp.id DESC`,
    )
    .bind(flowId)
    .all<Omit<SavePoint, "current"> & { current: number }>();
  return results.map((r) => ({ ...r, current: r.current === 1 }));
}

// "Volver a este punto" (§8): the save point's document becomes the draft.
// No save point is added and none is deleted, the later ones included. It
// moves the draft's revision, so a save still open from before is refused.
// False when the point is not this flow's.
export async function restoreSavePoint(db: D1Database, flowId: number, pointId: number, userId: number): Promise<boolean> {
  const r = await db
    .prepare(
      `INSERT INTO drafts (flow_id, document, updated_by)
       SELECT flow_id, document, ? FROM save_points WHERE id = ? AND flow_id = ?
       ON CONFLICT (flow_id) DO UPDATE SET document = excluded.document, updated_by = excluded.updated_by,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), revision = revision + 1`,
    )
    .bind(userId, pointId, flowId)
    .run();
  return r.meta.changes > 0;
}

// The releases of a flow (SPEC §8; phase 5.8), newest first. `latest`: the
// one people see. `inDraft`: the draft holds exactly its document.
// `restorable`: restoring changes something. With no draft, the editor
// already shows the latest release, so restoring it would do nothing.
export type Version = {
  id: number;
  version: string;
  publishedAt: string;
  by: string | null;
  steps: number;
  latest: boolean;
  inDraft: boolean;
  restorable: boolean;
};

export async function listVersions(db: D1Database, flowId: number): Promise<Version[]> {
  const { results } = await db
    .prepare(
      `SELECT r.id, r.major || '.' || r.minor AS version, r.published_at AS publishedAt, u.full_name AS by,
         json_array_length(r.document, '$.steps') AS steps,
         r.id = (SELECT id FROM releases WHERE flow_id = r.flow_id ORDER BY major DESC, minor DESC LIMIT 1) AS latest,
         coalesce(r.document = (SELECT document FROM drafts d WHERE d.flow_id = r.flow_id), 0) AS inDraft,
         EXISTS (SELECT 1 FROM drafts d WHERE d.flow_id = r.flow_id) AS hasDraft
       FROM releases r LEFT JOIN users u ON u.id = r.published_by
       WHERE r.flow_id = ? ORDER BY r.major DESC, r.minor DESC`,
    )
    .bind(flowId)
    .all<Omit<Version, "latest" | "inDraft" | "restorable"> & { latest: number; inDraft: number; hasDraft?: number }>();
  return results.map(({ hasDraft, ...r }) => ({
    ...r,
    latest: r.latest === 1,
    inDraft: r.inDraft === 1,
    restorable: r.inDraft !== 1 && (hasDraft === 1 || r.latest !== 1),
  }));
}

// "Restaurar" (§8): the release's document becomes the draft, to be
// published as a new version; releases never change. As "Volver a este
// punto", it adds no save point and moves the draft's revision, so a save
// still open from before is refused. The draft it replaces is not lost:
// every save left a save point. Null when the release is not this flow's.
export async function restoreRelease(db: D1Database, flowId: number, releaseId: number, userId: number): Promise<string | null> {
  const r = await db
    .prepare(
      `INSERT INTO drafts (flow_id, document, updated_by)
       SELECT flow_id, document, ? FROM releases WHERE id = ? AND flow_id = ?
       ON CONFLICT (flow_id) DO UPDATE SET document = excluded.document, updated_by = excluded.updated_by,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), revision = revision + 1
       RETURNING (SELECT major || '.' || minor FROM releases WHERE id = ?) AS version`,
    )
    .bind(userId, releaseId, flowId, releaseId)
    .first<string>("version");
  return r ?? null;
}
