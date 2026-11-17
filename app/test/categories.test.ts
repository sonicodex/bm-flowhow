import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import { NEVER_DELETE } from "../src/categories.tsx";
import { loadDevFlows } from "../src/devload.ts";
import { createFlow } from "../src/flows.ts";
import { applyGrid } from "../src/import.ts";
import { signIn, type Signed } from "./session.ts";
import { tableHead, tableRows } from "./table.ts";

let board: Signed;
beforeEach(async () => {
  board = await signIn();
});

const form = (path: string, fields: Record<string, string> = {}) => board.fetch(path, { method: "POST", body: new URLSearchParams(fields) });
const create = async (name: string) => {
  const res = await form("/categories", { name });
  expect(res.status, name).toBe(303);
  return Number(/\/categories\/(\d+)/.exec(res.headers.get("location")!)![1]);
};
const addValue = (cat: number, name: string) => form(`/categories/${cat}/values`, { name });
const categoryNames = async () =>
  (await env.DB.prepare("SELECT name FROM tag_categories ORDER BY position, id").all<{ name: string }>()).results.map((r) => r.name);
const valueNames = async (cat: number) =>
  (await env.DB.prepare("SELECT name FROM tags WHERE category_id = ? ORDER BY name_key").bind(cat).all<{ name: string }>()).results.map((r) => r.name);
const tagId = async (cat: number, name: string) =>
  (await env.DB.prepare("SELECT id FROM tags WHERE category_id = ? AND name = ?").bind(cat, name).first<number>("id"))!;

// A draft whose one step carries the given tag values, through the import
// contract: the draft and a save point.
async function draftWith(category: string, values: string) {
  const flow = await createFlow(env.DB, `Flujo ${category} ${values}`);
  if (!flow.ok) throw new Error(flow.error);
  const grid: Grid = {
    categories: [category],
    rows: [{ id: "P1", type: "end", ref: "", title: "Único", description: "", tags: { [category]: values }, exits: "", depends_on: "" }],
  };
  const r = await applyGrid(env.DB, flow.id, grid, { categories: [], tags: [] });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return flow.id;
}

describe("/categories (phase 5.1)", () => {
  it("says, with no categories, what they are for and how to add the first", async () => {
    const html = await (await board.fetch("/categories")).text();
    expect(html).not.toContain("<table");
    expect(html).toContain("Las categorías agrupan las etiquetas de los pasos");
    expect(html).toContain("Crea la primera con «Nueva categoría».");
    expect(html).toContain('<a class="button-primary" href="/categories/new">Nueva categoría</a>');
  });

  it("creates a category, opens its form to add values, and lists both", async () => {
    const id = await create("  Responsable ");
    expect(await categoryNames()).toEqual(["Responsable"]);
    let html = await (await board.fetch(`/categories/${id}?creada=1`)).text();
    expect(html).toContain("Categoría creada. Agrega sus valores.");
    expect(html).toContain('<a href="/categories">← Volver a categorías</a>');
    expect(html).toContain("Todavía no tiene ninguno.");
    expect((await addValue(id, " Almacén ")).status).toBe(303);
    expect((await addValue(id, "Ventas")).status).toBe(303);
    expect(await valueNames(id)).toEqual(["Almacén", "Ventas"]);
    html = await (await board.fetch(`/categories/${id}`)).text();
    expect(tableHead(html)).toEqual(["Valor", "Flujos", "Acciones"]);
    expect(tableRows(html)).toEqual([
      ["Almacén", "0", "Editar Borrar"],
      ["Ventas", "0", "Editar Borrar"],
    ]);
    html = await (await board.fetch("/categories")).text();
    expect(tableHead(html)).toEqual(["Nombre", "Valores", "Flujos", "Acciones"]);
    expect(tableRows(html)).toEqual([["Responsable", "2", "0", "Editar Borrar"]]);
    expect((await board.fetch(`/categories/${id + 100}`)).status).toBe(404);
  });

  it("refuses duplicates ignoring case and accents, blanks, and the import format's fixed columns", async () => {
    const id = await create("Herramienta");
    let res = await form("/categories", { name: "HERRAMIENTA" });
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("Ya existe una categoría llamada «Herramienta». Los nombres se comparan sin mayúsculas ni tildes.");
    for (const name of ["Salidas", "depende de", "Título", "ID", "Flujo"]) {
      res = await form("/categories", { name });
      expect(res.status, name).toBe(422);
      expect(await res.text()).toContain("es una columna fija de la plantilla de Excel");
    }
    res = await form("/categories", { name: " " });
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("Escribe el nombre de la categoría.");
    expect(await categoryNames()).toEqual(["Herramienta"]);
    // Values: unique within their category, no commas, not blank.
    await addValue(id, "Correo");
    res = await addValue(id, "correo");
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("«Herramienta» ya tiene el valor «Correo».");
    res = await addValue(id, "ERP, Correo");
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Un valor no puede llevar comas");
    expect(html).toContain('<input id="value-name" name="name" value="ERP, Correo"');
    expect(await valueNames(id)).toEqual(["Correo"]);
    // The same value in another category is fine.
    const other = await create("Canal");
    expect((await addValue(other, "Correo")).status).toBe(303);
  });

  it("renames a category and a value, and the flows show the new names", async () => {
    await loadDevFlows(env.DB, [{ name: "Instalaciones", grid: instalaciones as Grid }]);
    const flow = (await env.DB.prepare("SELECT id FROM flows WHERE name = 'Instalaciones'").first<number>("id"))!;
    const cat = (await env.DB.prepare("SELECT id FROM tag_categories ORDER BY position LIMIT 1").first<{ id: number }>())!.id;
    const [catName, value] = await Promise.all([
      env.DB.prepare("SELECT name FROM tag_categories WHERE id = ?").bind(cat).first<string>("name"),
      env.DB.prepare("SELECT name FROM tags WHERE category_id = ? ORDER BY id LIMIT 1").bind(cat).first<string>("name"),
    ]);
    const before = await (await board.fetch(`/flows/${flow}`)).text();
    expect(before).toContain(catName!);
    let res = await form(`/categories/${cat}`, { name: "Quién lo hace" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/categories/${cat}?guardado=1`);
    expect(await (await board.fetch(res.headers.get("location")!)).text()).toContain("Cambios guardados.");
    res = await form(`/categories/${cat}/values/${await tagId(cat, value!)}`, { name: "Nuevo nombre" });
    expect(res.status).toBe(303);
    const after = await (await board.fetch(`/flows/${flow}`)).text();
    expect(after).toContain("Quién lo hace");
    expect(after).toContain("Nuevo nombre");
    expect(after).not.toContain(`>${catName}<`);
  });

  it("deletes only what no draft, save point or release ever used, and says why", async () => {
    const cat = await create("Responsable");
    await addValue(cat, "Almacén");
    await addValue(cat, "Libre");
    const flow = await draftWith("Responsable", "Almacén");
    // The used value and its category offer no delete, and say why.
    let html = await (await board.fetch(`/categories/${cat}`)).text();
    expect(html).toContain(`Se usó en 1 flujo. ${NEVER_DELETE}`);
    expect(tableRows(html)).toEqual([
      ["Almacén", "1", "Editar"],
      ["Libre", "0", "Editar Borrar"],
    ]);
    html = await (await board.fetch(`/categories/${cat}/values/${await tagId(cat, "Almacén")}`)).text();
    expect(html).toContain(NEVER_DELETE);
    expect(tableRows(await (await board.fetch("/categories")).text())).toEqual([["Responsable", "2", "1", "Editar"]]);
    // Posted anyway: refused with the reason, nothing deleted.
    let res = await form(`/categories/${cat}/values/${await tagId(cat, "Almacén")}/delete`);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain(`No se puede borrar «Almacén»: ya se usó en un flujo. ${NEVER_DELETE}`);
    res = await form(`/categories/${cat}/delete`);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain(`No se puede borrar «Responsable»: ya se usó en un flujo. ${NEVER_DELETE}`);
    expect(await valueNames(cat)).toEqual(["Almacén", "Libre"]);
    // The unused value goes.
    expect((await form(`/categories/${cat}/values/${await tagId(cat, "Libre")}/delete`)).status).toBe(303);
    expect(await valueNames(cat)).toEqual(["Almacén"]);
    // Gone from the draft, still in its save point: still used, forever.
    await env.DB.prepare("UPDATE drafts SET document = '{\"steps\":[]}' WHERE flow_id = ?").bind(flow).run();
    expect((await form(`/categories/${cat}/delete`)).status).toBe(422);
    // Only in a release: the same.
    const release = await env.DB.prepare("SELECT document FROM save_points WHERE flow_id = ?").bind(flow).first<string>("document");
    await env.DB.batch([
      env.DB.prepare("DELETE FROM save_points WHERE flow_id = ?").bind(flow),
      env.DB.prepare("INSERT INTO releases (flow_id, major, minor, document) VALUES (?, 1, 0, ?)").bind(flow, release),
    ]);
    expect((await form(`/categories/${cat}/delete`)).status).toBe(422);
    expect(await categoryNames()).toEqual(["Responsable"]);
  });

  it("deletes a category nobody used, with its values", async () => {
    const cat = await create("Sobrante");
    await addValue(cat, "Uno");
    const res = await form(`/categories/${cat}/delete`);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/categories");
    expect(await categoryNames()).toEqual([]);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM tags").first<number>("n")).toBe(0);
  });

  it("reorders categories, which orders the viewer's categories too", async () => {
    const a = await create("Responsable");
    const b = await create("Herramienta");
    const c = await create("Sistema");
    let html = await (await board.fetch("/categories")).text();
    expect(tableRows(html).map((r) => r[3])).toEqual(["Editar Bajar Borrar", "Editar Subir Bajar Borrar", "Editar Subir Borrar"]);
    await form(`/categories/${c}/move`, { direction: "up" });
    expect(await categoryNames()).toEqual(["Responsable", "Sistema", "Herramienta"]);
    await form(`/categories/${a}/move`, { direction: "down" });
    expect(await categoryNames()).toEqual(["Sistema", "Responsable", "Herramienta"]);
    // Past either end, or a direction that is not one: nothing moves.
    await form(`/categories/${c}/move`, { direction: "up" });
    await form(`/categories/${b}/move`, { direction: "down" });
    await form(`/categories/${b}/move`, { direction: "sideways" });
    expect(await categoryNames()).toEqual(["Sistema", "Responsable", "Herramienta"]);
    html = await (await board.fetch("/categories")).text();
    expect(html).toContain("El orden de la lista es el de las columnas en la plantilla de Excel");
  });
});
