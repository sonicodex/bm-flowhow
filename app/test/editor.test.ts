import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import apertura from "../../reference/Flujo_Apertura_OT.grid.json";
import { loadDevFlows } from "../src/devload.ts";
import type { EditorData } from "../src/editor.tsx";
import { createFlow } from "../src/flows.ts";
import { signIn, type Signed } from "./session.ts";

let board: Signed;
beforeEach(async () => {
  board = await signIn();
});

const page = async (id: number) => {
  const res = await board.fetch(`/flows/${id}/edit`);
  const html = await res.text();
  const json = /<script type="application\/json" id="editor-data">(.*?)<\/script>/s.exec(html);
  return { status: res.status, html, data: json ? (JSON.parse(json[1]!) as EditorData) : null };
};
const idOf = async (name: string) => (await env.DB.prepare("SELECT id FROM flows WHERE name = ?").bind(name).first<number>("id"))!;

describe("the editor page (phase 5.3)", () => {
  it("opens a published flow on its release, with what the grid needs", async () => {
    await loadDevFlows(env.DB, [
      { name: "Instalaciones", grid: instalaciones as Grid },
      { name: "Apertura de OT", grid: apertura as Grid },
    ]);
    const id = await idOf("Apertura de OT");
    const { status, html, data } = await page(id);
    expect(status).toBe(200);
    expect(html).toContain("<title>Editar Apertura de OT · FlowHow</title>");
    expect(html).toContain("Estás viendo la versión publicada 1.0. Al guardar se crea un borrador");
    expect(html).toContain('<script type="module" src="/js/editor.js"></script>');
    expect(html).toContain(`<a href="/flows/${id}/details">Datos del flujo</a>`);
    expect(html).toContain(`<a href="/flows/${id}/save-points">Puntos guardados</a>`);
    expect(data!.base).toMatch(/^release:\d+$/);
    // The preview beside the grid, in the flow's colour (phase 5.4).
    expect(html).toContain('<aside class="card editor-preview" aria-labelledby="preview-title"><h2 id="preview-title">Vista previa</h2>');
    expect(html).toContain('<div class="diagram-scroll" id="preview"></div>');
    const colour = await env.DB.prepare("SELECT colour FROM flows WHERE id = ?").bind(id).first<number>("colour");
    expect(data!.colour).toBe(colour);
    expect(html).toContain(`<section class="editor flow-${colour}">`);
    expect(data!.grid.rows).toHaveLength(36);
    // Every id of the release is kept as it is (answer 4).
    expect(data!.lockedIds.sort()).toEqual(data!.grid.rows.map((r) => r.id).sort());
    expect(data!.flows.map((f) => f.name)).toEqual(["Apertura de OT", "Instalaciones"]);
    expect(data!.flows.every((f) => f.published !== null)).toBe(true);
    expect(Object.keys(data!.values)).toEqual(["Responsable", "Herramienta"]);
    expect(data!.values.Responsable).toContain("Almacén");
    expect(data!.types.map((t) => t.label)).toEqual(["Inicio", "Actividad", "Decisión", "Espera", "Subflujo", "Enlace", "Fin"]);
  });

  it("opens an unpublished flow on its draft, with no locked ids", async () => {
    const r = await createFlow(env.DB, "Nuevo");
    if (!r.ok) throw new Error(r.error);
    const { html, data } = await page(r.id);
    expect(html).toContain("Este flujo todavía no se ha publicado");
    expect(data).toMatchObject({ flowId: r.id, name: "Nuevo", base: "draft:1", lockedIds: [], grid: { categories: [], rows: [] } });
  });

  it("escapes step text inside the page's JSON", async () => {
    const r = await createFlow(env.DB, "Raro");
    if (!r.ok) throw new Error(r.error);
    await env.DB.prepare("UPDATE drafts SET document = ? WHERE flow_id = ?")
      .bind(JSON.stringify({ steps: [{ id: "P1", type: "end", title: "</script><b>x</b>", description: "", ref: null, tags: [], exits: [] }] }), r.id)
      .run();
    const { html, data } = await page(r.id);
    expect(html).not.toContain("</script><b>");
    expect(data!.grid.rows[0]!.title).toBe("</script><b>x</b>");
  });

  it("is reached from the flows list, and the flow form and save points go back to it", async () => {
    const r = await createFlow(env.DB, "Ventas");
    if (!r.ok) throw new Error(r.error);
    const list = await (await board.fetch("/flows")).text();
    expect(list).toContain(`<a href="/flows/${r.id}/edit" aria-label="Editar Ventas">Editar</a>`);
    for (const path of [`/flows/${r.id}/details`, `/flows/${r.id}/save-points`]) {
      expect(await (await board.fetch(path)).text(), path).toContain(`<a href="/flows/${r.id}/edit">← Volver al editor</a>`);
    }
    expect((await board.fetch(`/flows/${r.id + 100}/edit`)).status).toBe(404);
  });
});

describe("publishing from the editor (phase 5.7)", () => {
  const VALID: Grid = {
    categories: [],
    rows: [
      { id: "P1", type: "start", ref: "", title: "Empezar", description: "", tags: {}, exits: "P2", depends_on: "" },
      { id: "P2", type: "end", ref: "", title: "Terminar", description: "", tags: {}, exits: "", depends_on: "" },
    ],
  };
  const post = (path: string, body: unknown) =>
    board.fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const n = async (sql: string, ...args: unknown[]) => (await env.DB.prepare(sql).bind(...args).first<number>("n"))!;
  const withArea = async (flowId: number) => {
    await env.DB.prepare("INSERT OR IGNORE INTO areas (name, name_key) VALUES ('Desarrollo', 'desarrollo')").run();
    await env.DB.prepare("INSERT INTO flow_areas (flow_id, area_id) SELECT ?, id FROM areas WHERE name_key = 'desarrollo'").bind(flowId).run();
  };
  const saved = async (id: number, base: string, grid: Grid = VALID) => {
    const r = (await (await post(`/flows/${id}/draft`, { grid, base })).json()) as { status: string; base: string };
    expect(r.status).toBe("saved");
    return r.base;
  };
  const fresh = async (name: string) => {
    const r = await createFlow(env.DB, name);
    if (!r.ok) throw new Error(r.error);
    return r.id;
  };

  it("publishes the open draft as 1.0, by whom, and lands back on the editor with the news", async () => {
    const id = await fresh("Despachos");
    const base = await saved(id, "draft:1");
    // The fifth validation: an area, on the first publication.
    let res = await post(`/flows/${id}/publish`, { base, bump: "minor" });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      status: "blocked",
      errors: [{ row: null, message: "Asigna al menos un área al flujo antes de su primera publicación.", blocking: true }],
    });
    expect((await page(id)).data).toMatchObject({ published: null, areas: 0 });
    await withArea(id);
    res = await post(`/flows/${id}/publish`, { base, bump: "major" });
    expect(await res.json()).toEqual({ status: "published", version: "1.0" });
    expect(await n("SELECT count(*) AS n FROM drafts WHERE flow_id = ?", id)).toBe(0);
    expect(await n("SELECT count(*) AS n FROM save_points WHERE flow_id = ?", id)).toBe(0);
    const by = await env.DB.prepare("SELECT published_by FROM releases WHERE flow_id = ?").bind(id).first<number>("published_by");
    expect(by).toBe(board.id);
    const { html, data } = await page(id);
    expect(data).toMatchObject({ published: "1.0", areas: 1, base: expect.stringMatching(/^release:/) });
    expect((await (await board.fetch(`/flows/${id}/edit?publicada=1.0`)).text())).toContain(
      `Publicada la versión 1.0. Ya la ven las personas de las áreas del flujo. <a href="/flows/${id}">Ver el flujo</a>`,
    );
    expect(html).toContain('<button type="button" class="button-secondary" data-publish="true">Publicar</button>');
    expect(await (await board.fetch(`/flows/${id}/edit?publicada=<b>`)).text()).not.toContain("Publicada");
    // Areas removed after the first publication: the flow form's warning.
    await env.DB.prepare("DELETE FROM flow_areas WHERE flow_id = ?").bind(id).run();
    expect(await (await board.fetch(`/flows/${id}/edit?publicada=1.1`)).text()).toContain(
      `Publicada la versión 1.1. Este flujo publicado quedó sin áreas, así que ningún Empleado lo verá. Solo lo verán los Líderes y la Junta directiva. <a href="/flows/${id}">Ver el flujo</a>`,
    );
  });

  it("numbers minor and major from the latest release", async () => {
    const id = await fresh("Despachos");
    await withArea(id);
    let base = await saved(id, "draft:1");
    const versions: string[] = [];
    for (const bump of ["minor", "minor", "major", "minor"]) {
      const r = (await (await post(`/flows/${id}/publish`, { base, bump })).json()) as { version: string };
      versions.push(r.version);
      const opened = (await page(id)).data!;
      base = await saved(id, opened.base, { ...VALID, rows: VALID.rows.map((row) => ({ ...row, title: row.title + versions.length })) });
    }
    expect(versions).toEqual(["1.0", "1.1", "2.0", "2.1"]);
  });

  it("refuses a draft that changed since the page opened, and publishes nothing", async () => {
    const id = await fresh("Despachos");
    await withArea(id);
    const mine = await saved(id, "draft:1");
    await saved(id, mine, { ...VALID, rows: [VALID.rows[0]!, { ...VALID.rows[1]!, title: "De otra persona" }] });
    const res = await post(`/flows/${id}/publish`, { base: mine, bump: "minor" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ status: "conflict", message: "Otra persona cambió o publicó este borrador; recarga para ver lo que se publicaría." });
    expect(await n("SELECT count(*) AS n FROM releases WHERE flow_id = ?", id)).toBe(0);
    expect(await n("SELECT count(*) AS n FROM save_points WHERE flow_id = ?", id)).toBe(2);
  });

  it("has nothing to publish on a release, unless someone saved a draft meanwhile", async () => {
    await loadDevFlows(env.DB, [
      { name: "Instalaciones", grid: instalaciones as Grid },
      { name: "Apertura de OT", grid: apertura as Grid },
    ]);
    const id = await idOf("Apertura de OT");
    const { base } = (await page(id)).data!;
    let res = await post(`/flows/${id}/publish`, { base, bump: "minor" });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ status: "nothing", message: "No hay cambios sin publicar: guarda un cambio primero." });
    await saved(id, base, { ...(apertura as Grid), rows: (apertura as Grid).rows.map((r, i) => (i ? r : { ...r, title: "Otro" })) });
    res = await post(`/flows/${id}/publish`, { base, bump: "minor" });
    expect(res.status).toBe(409);
  });

  it("blocks on any validation problem, and refuses a body of another shape", async () => {
    const id = await fresh("Despachos");
    await withArea(id);
    const base = await saved(id, "draft:1", { categories: [], rows: [{ ...VALID.rows[0]!, type: "activity" }, VALID.rows[1]!] });
    const res = await post(`/flows/${id}/publish`, { base, bump: "minor" });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors: { message: string }[] };
    expect(body.errors.map((e) => e.message)).toContain("El flujo no tiene ningún paso de tipo Inicio.");
    for (const bad of [{ base, bump: "huge" }, { base: "draft:x", bump: "minor" }, null]) {
      expect((await post(`/flows/${id}/publish`, bad)).status).toBe(400);
    }
    expect((await post(`/flows/${id + 100}/publish`, { base, bump: "minor" })).status).toBe(404);
  });
});
