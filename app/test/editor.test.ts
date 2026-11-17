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
