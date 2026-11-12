import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import apertura from "../../reference/Flujo_Apertura_OT.grid.json";
import { createFlow } from "../src/flows.ts";
import { applyGrid, parseGrid, reviewGrid, type Accepted } from "../src/import.ts";
import { publishFlow } from "../src/publish.ts";

const db = () => env.DB;
const INST = instalaciones as Grid;
const APERTURA = apertura as Grid;
const row = (id: string, type: string, extra: Partial<Grid["rows"][number]> = {}) => ({
  id, type, ref: "", title: "t" + id, description: "", tags: {}, exits: "", depends_on: "", ...extra,
});
const tiny = (rows: Grid["rows"], categories: string[] = []): Grid => ({ categories, rows });
const VALID = tiny([row("A", "start", { exits: "B" }), row("B", "end")]);

async function flow(name: string) {
  const r = await createFlow(db(), name);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}
async function withArea(flowId: number) {
  await db().prepare("INSERT OR IGNORE INTO areas (name, name_key) VALUES ('Desarrollo', 'desarrollo')").run();
  await db().prepare("INSERT INTO flow_areas (flow_id, area_id) SELECT ?, id FROM areas WHERE name_key = 'desarrollo'").bind(flowId).run();
}
const acceptAll = async (flowId: number, grid: Grid): Promise<Accepted> => {
  const r = await reviewGrid(db(), flowId, grid);
  return { categories: r.newCategories, tags: r.newTags };
};
const count = async (sql: string, ...args: unknown[]) =>
  (await db().prepare(sql).bind(...args).first<number>("n"))!;

describe("parseGrid: the shape the browser sends", () => {
  it("accepts both reference grids", () => {
    expect(parseGrid(instalaciones).ok).toBe(true);
    expect(parseGrid(apertura).ok).toBe(true);
  });

  it("refuses anything else whole", () => {
    for (const bad of [null, "x", {}, { categories: [], rows: [] }, { categories: ["A", "a"], rows: [row("A", "end")] },
      { categories: [], rows: [{ ...row("A", "end"), title: 3 }] }, { categories: ["R"], rows: [row("A", "end")] }]) {
      expect(parseGrid(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("reviewGrid and applyGrid", () => {
  it("imports both real flows, with the link from Apertura de OT P13 to Instalaciones", async () => {
    const inst = await flow("Instalaciones");
    const ot = await flow("Apertura de OT");
    const review = await reviewGrid(db(), inst, INST);
    expect(review.errors).toEqual([]);
    expect(review.newCategories).toEqual(["Responsable", "Herramienta"]);
    expect((await applyGrid(db(), inst, INST, await acceptAll(inst, INST))).ok).toBe(true);
    const r = await applyGrid(db(), ot, APERTURA, await acceptAll(ot, APERTURA));
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.document.steps).toHaveLength(36);
    expect(r.document.steps.find((s) => s.id === "P13")!.ref).toBe(inst);
    expect(await count("SELECT count(*) AS n FROM save_points WHERE flow_id = ?", ot)).toBe(1);
  });

  it("is read-only on review", async () => {
    const id = await flow("Instalaciones");
    await reviewGrid(db(), id, INST);
    expect(await count("SELECT count(*) AS n FROM tag_categories")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM save_points")).toBe(0);
  });

  it("blocks the import on a missing ID, a repeated ID or an unknown type, and writes nothing", async () => {
    const id = await flow("X");
    const before = await db().prepare("SELECT document FROM drafts WHERE flow_id = ?").bind(id).first<string>("document");
    const grid = tiny([row("A", "start", { exits: "B" }), row("", "activity", { exits: "B" }), row("B", "Tarea"), row("B", "end")]);
    const r = await applyGrid(db(), id, grid, { categories: [], tags: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.message)).toEqual([
      "Fila 3: falta el ID.",
      "Fila 4 (B): tipo «Tarea» no reconocido. Usa Inicio, Actividad, Decisión, Espera, Subflujo, Enlace o Fin.",
      "Fila 5 (B): el ID «B» está repetido; también está en la fila 4.",
    ]);
    expect(await db().prepare("SELECT document FROM drafts WHERE flow_id = ?").bind(id).first<string>("document")).toBe(before);
    expect(await count("SELECT count(*) AS n FROM save_points")).toBe(0);
  });

  it("blocks a link to a flow that does not exist", async () => {
    const id = await flow("Apertura de OT");
    const r = await applyGrid(db(), id, APERTURA, await acceptAll(id, APERTURA));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.message)).toEqual(["Fila 14 (P13): no existe un flujo llamado «Instalaciones»."]);
  });

  it("drafts a flow that breaks the structure rules: they block only publishing", async () => {
    const id = await flow("X");
    const grid = tiny([row("A", "start", { exits: "B" }), row("B", "activity")]);
    expect((await reviewGrid(db(), id, grid)).errors).toEqual([
      { row: 1, message: "Fila 3 (B): no tiene salida y no es de tipo Fin.", blocking: false },
    ]);
    expect((await applyGrid(db(), id, grid, { categories: [], tags: [] })).ok).toBe(true);
    const p = await publishFlow(db(), id);
    expect(p.ok).toBe(false);
  });

  it("creates only the accepted categories and tags, and drops the rest", async () => {
    const id = await flow("X");
    const grid = tiny(
      [row("A", "start", { exits: "B", tags: { Responsable: "Ventas, Compras", Herramienta: "ERP" } }), row("B", "end", { tags: { Responsable: "ventas", Herramienta: "" } })],
      ["Responsable", "Herramienta"],
    );
    const review = await reviewGrid(db(), id, grid);
    expect(review.newCategories).toEqual(["Responsable", "Herramienta"]);
    expect(review.newTags).toEqual([
      { category: "Responsable", name: "Ventas" }, { category: "Responsable", name: "Compras" }, { category: "Herramienta", name: "ERP" },
    ]);
    const r = await applyGrid(db(), id, grid, { categories: ["responsable"], tags: [{ category: "Responsable", name: "Ventas" }, { category: "Herramienta", name: "ERP" }] });
    if (!r.ok) throw new Error("refused");
    const ventas = await db().prepare("SELECT id FROM tags WHERE name_key = 'ventas'").first<number>("id");
    expect(r.document.steps.map((s) => s.tags)).toEqual([[ventas], [ventas]]);
    expect(await count("SELECT count(*) AS n FROM tags")).toBe(1);
    expect(await count("SELECT count(*) AS n FROM tag_categories")).toBe(1);
    // A second import of the same tags finds them: nothing left to accept.
    expect((await reviewGrid(db(), id, grid)).newTags).toEqual([{ category: "Responsable", name: "Compras" }, { category: "Herramienta", name: "ERP" }]);
  });
});

describe("publishFlow", () => {
  it("publishes both real flows in 1.0 and deletes their drafts and save points", async () => {
    const inst = await flow("Instalaciones");
    const ot = await flow("Apertura de OT");
    for (const [id, grid] of [[inst, INST], [ot, APERTURA]] as const) {
      await withArea(id);
      expect((await applyGrid(db(), id, grid, await acceptAll(id, grid))).ok).toBe(true);
    }
    // A link only needs its target to exist: Apertura de OT may go first.
    expect(await publishFlow(db(), ot)).toMatchObject({ ok: true, version: "1.0" });
    expect(await publishFlow(db(), inst)).toMatchObject({ ok: true, version: "1.0" });
    expect(await count("SELECT count(*) AS n FROM drafts")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM save_points")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM releases")).toBe(2);
  });

  it("numbers versions 1.0, 1.1, 2.0", async () => {
    const id = await flow("X");
    await withArea(id);
    const versions = [];
    for (const bump of ["minor", "minor", "major", "minor"] as const) {
      await applyGrid(db(), id, VALID, { categories: [], tags: [] });
      const r = await publishFlow(db(), id, bump);
      versions.push(r.ok ? r.version : r.errors);
    }
    expect(versions).toEqual(["1.0", "1.1", "2.0", "2.1"]);
  });

  it("needs an area on the first publication only", async () => {
    const id = await flow("X");
    await applyGrid(db(), id, VALID, { categories: [], tags: [] });
    expect(await publishFlow(db(), id)).toEqual({ ok: false, errors: [{ row: null, message: "Asigna al menos un área al flujo antes de su primera publicación.", blocking: true }] });
    await withArea(id);
    expect((await publishFlow(db(), id)).ok).toBe(true);
    await db().prepare("DELETE FROM flow_areas WHERE flow_id = ?").bind(id).run();
    await applyGrid(db(), id, VALID, { categories: [], tags: [] });
    expect(await publishFlow(db(), id)).toMatchObject({ ok: true, version: "1.1" });
  });

  it("refuses without a draft, and when the link target was deleted after the import", async () => {
    const target = await flow("Destino");
    const id = await flow("X");
    await withArea(id);
    const grid = tiny([row("A", "start", { exits: "B" }), row("B", "link", { ref: "destino", exits: "C" }), row("C", "end")]);
    expect((await applyGrid(db(), id, grid, { categories: [], tags: [] })).ok).toBe(true);
    await db().prepare("DELETE FROM flows WHERE id = ?").bind(target).run();
    const r = await publishFlow(db(), id);
    expect(r.ok ? [] : r.errors.map((e) => e.message)).toEqual(["Fila 3 (B): el flujo de destino ya no existe."]);
    await db().prepare("DELETE FROM drafts WHERE flow_id = ?").bind(id).run();
    expect(await publishFlow(db(), id)).toMatchObject({ ok: false, errors: [{ message: "No hay borrador para publicar." }] });
  });
});

describe("createFlow", () => {
  it("gives each new flow the next free colour and an empty draft", async () => {
    const a = await flow("Uno");
    const b = await flow("Dos");
    const colours = (await db().prepare("SELECT colour FROM flows ORDER BY id").all<{ colour: number }>()).results.map((r) => r.colour);
    expect(colours).toEqual([1, 2]);
    expect(await count("SELECT count(*) AS n FROM drafts WHERE flow_id IN (?, ?)", a, b)).toBe(2);
    expect(await createFlow(db(), "  UNÓ ")).toEqual({ ok: false, error: "Ya existe un flujo llamado «Uno». Los nombres se comparan sin mayúsculas ni tildes." });
  });
});
