import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import apertura from "../../reference/Flujo_Apertura_OT.grid.json";
import { loadDevFlows } from "../src/devload.ts";
import { openDraft } from "../src/draft.ts";
import { createFlow } from "../src/flows.ts";
import { documentFor } from "../src/import.ts";
import { publishFlow } from "../src/publish.ts";
import { signIn, type Signed } from "./session.ts";
import { tableHead, tableRows } from "./table.ts";

const db = () => env.DB;
const row = (id: string, type: string, extra: Partial<Grid["rows"][number]> = {}) => ({
  id, type, ref: "", title: "t" + id, description: "", tags: {}, exits: "", depends_on: "", ...extra,
});
const grid = (rows: Grid["rows"], categories: string[] = []): Grid => ({ categories, rows });
const TWO = grid([row("A", "start", { exits: "B" }), row("B", "end")]);
const THREE = grid([row("A", "start", { exits: "B" }), row("B", "activity", { exits: "C" }), row("C", "end")]);

let board: Signed;
beforeEach(async () => {
  board = await signIn();
});

async function newFlow(name = "Despachos") {
  const r = await createFlow(db(), name);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}
const save = async (flowId: number, body: unknown, who = board) => {
  const res = await who.fetch(`/flows/${flowId}/draft`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};
const count = async (sql: string, ...args: unknown[]) => (await db().prepare(sql).bind(...args).first<number>("n"))!;
const savePoints = (flowId: number) => count("SELECT count(*) AS n FROM save_points WHERE flow_id = ?", flowId);
const draftDoc = async (flowId: number) =>
  JSON.parse((await db().prepare("SELECT document FROM drafts WHERE flow_id = ?").bind(flowId).first<string>("document"))!) as { steps: { id: string }[] };
const loadReference = () =>
  loadDevFlows(db(), [
    { name: "Instalaciones", grid: instalaciones as Grid },
    { name: "Apertura de OT", grid: apertura as Grid },
  ]);
const idOf = async (name: string) => (await db().prepare("SELECT id FROM flows WHERE name = ?").bind(name).first<number>("id"))!;

describe("opening the draft (phase 5.2)", () => {
  it("shows the latest release as a grid when there is no draft, and writes nothing", async () => {
    await loadReference();
    for (const name of ["Instalaciones", "Apertura de OT"]) {
      const id = await idOf(name);
      const opened = await openDraft(db(), id);
      const release = await db().prepare("SELECT id, document FROM releases WHERE flow_id = ?").bind(id).first<{ id: number; document: string }>();
      expect(opened.source).toBe("release");
      expect(opened.base).toBe(`release:${release!.id}`);
      // Every category is a column, in order; links carry the target's name.
      expect(opened.grid.categories).toEqual(["Responsable", "Herramienta"]);
      // The grid reads back into the very document it came from.
      expect(await documentFor(db(), id, opened.grid)).toEqual(JSON.parse(release!.document));
      expect(await count("SELECT count(*) AS n FROM drafts WHERE flow_id = ?", id)).toBe(0);
    }
    const p13 = (await openDraft(db(), await idOf("Apertura de OT"))).grid.rows.find((r) => r.id === "P13")!;
    expect(p13.ref).toBe("Instalaciones");
  });

  it("opens the draft of a new flow, empty, at its first revision", async () => {
    const id = await newFlow();
    expect(await openDraft(db(), id)).toEqual({ grid: { categories: [], rows: [] }, base: "draft:1", source: "draft" });
  });
});

describe("saving the draft (phase 5.2)", () => {
  it("saves the grid as the draft and a save point, and answers the new base", async () => {
    const id = await newFlow();
    let r = await save(id, { grid: TWO, base: "draft:1" });
    expect(r).toEqual({ status: 200, body: { status: "saved", base: "draft:2", saved: true } });
    expect((await draftDoc(id)).steps.map((s) => s.id)).toEqual(["A", "B"]);
    expect(await savePoints(id)).toBe(1);
    expect((await openDraft(db(), id)).base).toBe("draft:2");
    // Saving what the draft already holds writes nothing: no copy in the save points.
    r = await save(id, { grid: TWO, base: "draft:2" });
    expect(r.body).toEqual({ status: "saved", base: "draft:2", saved: false });
    expect(await savePoints(id)).toBe(1);
    r = await save(id, { grid: THREE, base: "draft:2" });
    expect(r.body).toEqual({ status: "saved", base: "draft:3", saved: true });
    expect(await savePoints(id)).toBe(2);
  });

  it("allows a draft with no steps, and saves one that cannot be published yet", async () => {
    const id = await newFlow();
    await save(id, { grid: TWO, base: "draft:1" });
    expect((await save(id, { grid: grid([]), base: "draft:2" })).body.status).toBe("saved");
    expect((await draftDoc(id)).steps).toEqual([]);
    // No start, an end with an exit: only publishing is blocked.
    expect((await save(id, { grid: grid([row("A", "end", { exits: "A" })]), base: "draft:3" })).body.status).toBe("saved");
  });

  it("refuses the second of two editors instead of overwriting the first", async () => {
    const id = await newFlow();
    const other = await signIn({ username: "otra", role: "board" });
    // Both opened at draft:1. The first saves.
    expect((await save(id, { grid: TWO, base: "draft:1" }, other)).body.status).toBe("saved");
    const r = await save(id, { grid: THREE, base: "draft:1" });
    expect(r).toEqual({ status: 409, body: { status: "conflict", message: "Otra persona guardó este borrador; recarga para ver sus cambios." } });
    expect((await draftDoc(id)).steps.map((s) => s.id)).toEqual(["A", "B"]);
    expect(await savePoints(id)).toBe(1);
  });

  it("refuses a save whose draft was published meanwhile, and one that started from an old release", async () => {
    await loadReference();
    const id = await idOf("Instalaciones");
    const opened = await openDraft(db(), id);
    // From the release: the first save creates the draft.
    let r = await save(id, { grid: opened.grid, base: opened.base });
    expect(r.body).toEqual({ status: "saved", base: "draft:1", saved: true });
    // Someone publishes it: the draft is gone.
    expect((await publishFlow(db(), id, "minor")).ok).toBe(true);
    r = await save(id, { grid: opened.grid, base: "draft:1" });
    expect(r).toEqual({
      status: 409,
      body: { status: "conflict", message: "Otra persona publicó este flujo mientras editabas; recarga para ver la versión publicada." },
    });
    // Still on the release before that one: refused too.
    r = await save(id, { grid: opened.grid, base: opened.base });
    expect(r.status).toBe(409);
    expect(r.body.message).toBe("Otra persona publicó este flujo mientras editabas; recarga para ver la versión publicada.");
    // From the current release, someone else saved first.
    const fresh = await openDraft(db(), id);
    expect((await save(id, { grid: fresh.grid, base: fresh.base })).body.status).toBe("saved");
    r = await save(id, { grid: fresh.grid, base: fresh.base });
    expect(r.body.message).toBe("Otra persona guardó este borrador; recarga para ver sus cambios.");
  });

  it("asks before creating new values, then creates the accepted ones and drops the rest", async () => {
    const id = await newFlow();
    await db().prepare("INSERT INTO tag_categories (name, name_key, position) VALUES ('Responsable', 'responsable', 1)").run();
    await db().prepare("INSERT INTO tags (category_id, name, name_key) SELECT id, 'Almacén', 'almacen' FROM tag_categories").run();
    const tagged = grid(
      [row("A", "start", { exits: "B", tags: { Responsable: "almacen, Ventas" } }), row("B", "end", { tags: { Responsable: "Compras" } })],
      ["Responsable"],
    );
    let r = await save(id, { grid: tagged, base: "draft:1" });
    expect(r).toEqual({
      status: 200,
      body: {
        status: "confirm",
        newCategories: [],
        newTags: [
          { category: "Responsable", name: "Ventas" },
          { category: "Responsable", name: "Compras" },
        ],
      },
    });
    expect(await savePoints(id)).toBe(0);
    r = await save(id, { grid: tagged, base: "draft:1", accepted: { categories: [], tags: [{ category: "Responsable", name: "Ventas" }] } });
    expect(r.body.status).toBe("saved");
    const values = await db().prepare("SELECT name FROM tags ORDER BY id").all<{ name: string }>();
    expect(values.results.map((v) => v.name)).toEqual(["Almacén", "Ventas"]);
    // Compras was rejected: B has no value; A keeps the known one (any spelling) and Ventas.
    const opened = await openDraft(db(), id);
    expect(opened.grid.rows.map((x) => x.tags)).toEqual([{ Responsable: "Almacén, Ventas" }, { Responsable: "" }]);
  });

  it("refuses what blocks, and a body that is not a save, writing nothing", async () => {
    const id = await newFlow();
    let r = await save(id, { grid: grid([row("A", "start"), row("A", "end")]), base: "draft:1" });
    expect(r.status).toBe(422);
    expect(r.body.status).toBe("blocked");
    expect(JSON.stringify(r.body.errors)).toContain("ya lo tiene la fila 2");
    for (const bad of [null, {}, { grid: TWO }, { grid: TWO, base: "draft:0" }, { grid: TWO, base: "otro:1" }, { grid: { rows: [] }, base: "draft:1" },
      { grid: TWO, base: "draft:1", accepted: { tags: "x" } }]) {
      r = await save(id, bad);
      expect(r.status, JSON.stringify(bad)).toBe(400);
      expect(r.body.status).toBe("invalid");
    }
    const res = await board.fetch(`/flows/${id}/draft`, { method: "POST", headers: { "content-type": "application/json" }, body: "no es json" });
    expect(res.status).toBe(400);
    expect(await savePoints(id)).toBe(0);
    const missing = await board.fetch(`/flows/${id + 100}/draft`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grid: TWO, base: "draft:1" }) });
    expect(missing.status).toBe(404);
  });
});

describe("save points (phase 5.2)", () => {
  it("lists them newest first and goes back to one without deleting any", async () => {
    const id = await newFlow();
    await save(id, { grid: TWO, base: "draft:1" });
    await save(id, { grid: THREE, base: "draft:2" });
    let html = await (await board.fetch(`/flows/${id}/save-points`)).text();
    expect(tableHead(html)).toEqual(["Guardado", "Por", "Pasos", "Es el borrador actual", "Acciones"]);
    let rows = tableRows(html);
    expect(rows.map((r) => r.slice(1))).toEqual([
      ["Nombre de board", "3", "Sí", ""],
      ["Nombre de board", "2", "No", "Volver a este punto"],
    ]);
    const [newest, oldest] = (await db().prepare("SELECT id FROM save_points WHERE flow_id = ? ORDER BY id DESC").bind(id).all<{ id: number }>()).results;
    const res = await board.fetch(`/flows/${id}/save-points/${oldest!.id}/restore`, { method: "POST" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/flows/${id}/save-points?vuelta=${oldest!.id}`);
    expect((await draftDoc(id)).steps.map((s) => s.id)).toEqual(["A", "B"]);
    expect(await savePoints(id)).toBe(2);
    html = await (await board.fetch(res.headers.get("location")!)).text();
    expect(html).toContain("El borrador volvió al punto del");
    rows = tableRows(html);
    expect(rows.map((r) => r[3])).toEqual(["No", "Sí"]);
    // And forward again, to the later one: it was kept.
    await board.fetch(`/flows/${id}/save-points/${newest!.id}/restore`, { method: "POST" });
    expect((await draftDoc(id)).steps.map((s) => s.id)).toEqual(["A", "B", "C"]);
    // Going back moved the draft on: a save from before it is refused.
    expect((await save(id, { grid: TWO, base: "draft:3" })).status).toBe(409);
    expect((await openDraft(db(), id)).base).toBe("draft:5");
  });

  it("refuses another flow's save point, and says what the list is for when empty", async () => {
    const a = await newFlow("Uno");
    const b = await newFlow("Dos");
    await save(a, { grid: TWO, base: "draft:1" });
    const point = (await db().prepare("SELECT id FROM save_points WHERE flow_id = ?").bind(a).first<number>("id"))!;
    expect((await board.fetch(`/flows/${b}/save-points/${point}/restore`, { method: "POST" })).status).toBe(404);
    expect((await draftDoc(b)).steps).toEqual([]);
    const html = await (await board.fetch(`/flows/${b}/save-points`)).text();
    expect(html).toContain("Cada vez que guardas el borrador queda aquí un punto al que puedes volver.");
  });
});
