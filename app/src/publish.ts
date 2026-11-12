import Core, { type RowError } from "../public/js/core.js";
import { documentToFlow, loadTagIndex, type FlowDocument } from "./document.ts";
import { flowCatalog, getFlow } from "./flows.ts";

export type Bump = "minor" | "major";

export type PublishResult =
  | { ok: true; version: string; releaseId: number }
  | { ok: false; errors: RowError[] };

const refuse = (message: string): PublishResult => ({ ok: false, errors: [{ row: null, message, blocking: true }] });

// SPEC §6 and §8: publishing validates the draft whatever path filled it,
// needs an area on the first publication, writes release x.y, and deletes the
// draft and its save points. Every validation error blocks it.
export async function publishFlow(db: D1Database, flowId: number, bump: Bump = "minor", userId: number | null = null): Promise<PublishResult> {
  const flow = await getFlow(db, flowId);
  if (!flow) throw new Error(`publish: flow ${flowId} does not exist.`);
  const [draftRow, latest, areas] = await db.batch<Record<string, unknown>>([
    db.prepare("SELECT document FROM drafts WHERE flow_id = ?").bind(flowId),
    db.prepare("SELECT major, minor FROM releases WHERE flow_id = ? ORDER BY major DESC, minor DESC LIMIT 1").bind(flowId),
    db.prepare("SELECT count(*) AS n FROM flow_areas WHERE flow_id = ?").bind(flowId),
  ]);
  const draft = draftRow.results[0];
  if (!draft) return refuse("No hay borrador para publicar.");
  const document = JSON.parse(draft.document as string) as FlowDocument;
  const { lib } = await flowCatalog(db);
  const errors = Core.validate(documentToFlow(flow.name, flow.objective, document, await loadTagIndex(db)), { selfId: flowId, lib });
  const last = latest.results[0] as { major: number; minor: number } | undefined;
  if (!last && (areas.results[0]!.n as number) === 0) {
    errors.push({ row: null, message: "Asigna al menos un área al flujo antes de su primera publicación.", blocking: true });
  }
  if (errors.length) return { ok: false, errors: errors.map((e) => ({ ...e, blocking: true })) };

  const [major, minor] = !last ? [1, 0] : bump === "major" ? [last.major + 1, 0] : [last.major, last.minor + 1];
  try {
    const [inserted] = await db.batch([
      db
        .prepare("INSERT INTO releases (flow_id, major, minor, document, published_by) VALUES (?, ?, ?, ?, ?)")
        .bind(flowId, major, minor, draft.document as string, userId),
      db.prepare("DELETE FROM save_points WHERE flow_id = ?").bind(flowId),
      db.prepare("DELETE FROM drafts WHERE flow_id = ?").bind(flowId),
    ]);
    return { ok: true, version: `${major}.${minor}`, releaseId: inserted!.meta.last_row_id };
  } catch (e) {
    // Two publications at once: the second one finds its version taken.
    if (/UNIQUE constraint failed: releases/.test(String(e))) return refuse("Otra persona acaba de publicar este flujo. Recarga y vuelve a intentarlo.");
    throw e;
  }
}
