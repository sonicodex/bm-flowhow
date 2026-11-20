import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { signIn, type Signed } from "./session.ts";

let board: Signed;
beforeEach(async () => {
  board = await signIn();
});

const send = (path: string, body: unknown) =>
  board.fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const review = async (table: string[][]) => (await send("/areas/import/review", { table })).json<Record<string, any>>();
const names = async () => (await env.DB.prepare("SELECT name FROM areas ORDER BY name_key").all<{ name: string }>()).results.map((r) => r.name);
const addArea = (name: string, key: string) => env.DB.prepare("INSERT INTO areas (name, name_key) VALUES (?, ?)").bind(name, key).run();

describe("area importer (phase 7.1)", () => {
  it("offers the importer beside «Nueva área», and its page reads the «Áreas» sheet", async () => {
    const list = await (await board.fetch("/areas")).text();
    expect(list).toContain('<a class="button-secondary" href="/areas/import">Importar áreas</a>');
    const page = await (await board.fetch("/areas/import")).text();
    expect(page).toContain("<h1 class=\"page-title\">Importar áreas</h1>");
    expect(page).toContain("se lee su hoja «Áreas»");
    expect(page).toContain('<a href="/areas">← Volver a áreas</a>');
    expect(page).toContain('<script type="module" src="/js/import-list.js"></script>');
    const config = JSON.parse(page.match(/<script type="application\/json" id="import-data">([^<]*)<\/script>/)![1]!);
    expect(config).toMatchObject({ sheet: "Áreas", reviewUrl: "/areas/import/review", applyUrl: "/areas/import", done: { href: "/areas" } });
    expect(config.template.columns).toEqual(["Área"]);
  });

  it("opened from the first-use wizard, leads back to it", async () => {
    const page = await (await board.fetch("/areas/import?desde=configuracion")).text();
    expect(page).toContain('<a href="/setup">← Volver a la configuración inicial</a>');
    expect(page).toContain('"done":{"href":"/setup","label":"Volver a la configuración inicial"}');
  });

  it("reviews: new areas, the ones that already exist matched without case or accents, empty rows skipped", async () => {
    await addArea("Logística", "logistica");
    const r = await review([["Área"], ["Ventas"], [""], ["LOGISTICA "], ["Bodega"], ["", ""]]);
    expect(r.status).toBe("review");
    expect(r.errors).toEqual([]);
    expect(r.summary).toBe("3 filas: 2 áreas nuevas, 1 ya existe.");
    expect(r.groups).toEqual([
      { title: "Áreas nuevas (2)", columns: ["Área"], rows: [["Ventas"], ["Bodega"]] },
      { title: "Ya existen (1)", note: "Se emparejan con el área que ya hay y no se tocan.", columns: ["En el archivo", "Área que ya existe"], rows: [["LOGISTICA", "Logística"]] },
    ]);
    // A review writes nothing.
    expect(await names()).toEqual(["Logística"]);
  });

  it("names each wrong row by its row in the file, the header being row 1", async () => {
    const r = await review([["área"], ["Ventas"], ["ventas"], ["x".repeat(101)], ["Bodega"]]);
    expect(r.errors.map((e: { message: string }) => e.message)).toEqual([
      "Fila 3: «ventas» ya está en la fila 2. Los nombres se comparan sin mayúsculas ni tildes.",
      "Fila 4: el nombre tiene más de 100 caracteres.",
    ]);
  });

  it("refuses a table whose columns are not exactly «Área»", async () => {
    const error = async (table: string[][]) => {
      const res = await send("/areas/import/review", { table });
      expect(res.status).toBe(400);
      return (await res.json<{ error: string }>()).error;
    };
    expect(await error([["Nombre"], ["Ventas"]])).toBe("No se reconoce la columna «Nombre». Las columnas son «Área».");
    expect(await error([["Área", "Jefe"], ["Ventas", "Ana"]])).toBe("No se reconoce la columna «Jefe». Las columnas son «Área».");
    expect(await error([["Área"]])).toBe("No hay ninguna fila debajo de los encabezados.");
    expect(await error([["", ""], ["Ventas"]])).toBe("La primera fila tiene que traer los encabezados: «Área».");
    expect(await error([["Área", ""], ["Ventas", "Ana"]])).toBe("La columna 2 tiene datos pero no tiene encabezado. Las columnas son «Área».");
    // An unnamed column left empty all the way down is fine.
    expect((await review([["Área", ""], ["Ventas", ""]])).status).toBe("review");
    expect(await error({ rows: [] } as never)).toMatch(/^La tabla no tiene la forma esperada/);
  });

  it("creates the new areas on «Importar», leaving the existing ones alone", async () => {
    await addArea("Logística", "logistica");
    const res = await send("/areas/import", { table: [["Área"], ["Ventas"], ["logística"], ["Bodega"]] });
    expect(res.status).toBe(200);
    const done = await res.json<Record<string, any>>();
    expect(done).toMatchObject({ status: "saved", title: "Áreas importadas", message: "Se crearon 2 áreas; 1 ya existía." });
    expect(await names()).toEqual(["Bodega", "Logística", "Ventas"]);
    // Importing the same file again creates nothing.
    const again = await (await send("/areas/import", { table: [["Área"], ["Ventas"], ["logística"], ["Bodega"]] })).json<Record<string, any>>();
    expect(again.message).toBe("Se crearon 0 áreas; 3 ya existían.");
    expect(await names()).toEqual(["Bodega", "Logística", "Ventas"]);
  });

  it("writes nothing while a row is wrong, whatever the page sent before", async () => {
    const res = await send("/areas/import", { table: [["Área"], ["Ventas"], ["VENTAS"]] });
    expect(res.status).toBe(422);
    expect(await names()).toEqual([]);
  });

  it("is refused to a user without can_edit", async () => {
    const leader = await signIn({ username: "lider", role: "leader" });
    for (const path of ["/areas/import/review", "/areas/import"]) {
      const res = await leader.fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ table: [["Área"], ["Ventas"]] }) });
      expect(res.status).toBe(403);
    }
    expect(await names()).toEqual([]);
  });
});
