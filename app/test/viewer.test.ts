import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import apertura from "../../reference/Flujo_Apertura_OT.grid.json";
import { loadDevFlows } from "../src/devload.ts";
import { createFlow } from "../src/flows.ts";
import { applyGrid } from "../src/import.ts";

const get = (path: string) => exports.default.fetch(`http://example.com${path}`);
const load = () =>
  loadDevFlows(env.DB, [
    { name: "Instalaciones", grid: instalaciones as Grid },
    { name: "Apertura de OT", grid: apertura as Grid },
  ]);
const idOf = async (name: string) => (await env.DB.prepare("SELECT id FROM flows WHERE name = ?").bind(name).first<number>("id"))!;
const flowData = (html: string) => JSON.parse(html.match(/<script type="application\/json" id="flow-data">(.*?)<\/script>/s)![1]!);

describe("GET /flows/:id (overview)", () => {
  it("shows the latest release with the flow's colour, its steps and the tour button", async () => {
    await load();
    const id = await idOf("Apertura de OT");
    const res = await get(`/flows/${id}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<section class="viewer flow-2">');
    expect(html).toContain("Apertura de OT</h1>");
    expect(html).toContain("36 pasos");
    expect(html).toContain('<button type="button" class="button-primary">Iniciar recorrido</button>');
    expect(html).toContain('<script type="module" src="/js/viewer.js"></script>');
    const data = flowData(html);
    expect(data).toMatchObject({ name: "Apertura de OT", colour: 2 });
    expect(data.flow.steps).toHaveLength(36);
    // Tags travel by name, as the step panel will show them.
    expect(data.flow.categories).toEqual(["Responsable", "Herramienta"]);
    expect(data.flow.steps.find((s: { id: string }) => s.id === "P13").ref).toBe(await idOf("Instalaciones"));
  });

  it("never shows a draft: an import after publishing changes nothing until it is published", async () => {
    await load();
    const id = await idOf("Instalaciones");
    const changed = structuredClone(instalaciones) as Grid;
    changed.rows[0]!.title = "Título solo en el borrador";
    expect((await applyGrid(env.DB, id, changed, { categories: [], tags: [] })).ok).toBe(true);
    const html = await (await get(`/flows/${id}`)).text();
    expect(html).not.toContain("Título solo en el borrador");
    expect(flowData(html).flow.steps[0].title).toBe((instalaciones as Grid).rows[0]!.title);
  });

  it("is 404 for a flow without a release and for an unknown flow", async () => {
    const r = await createFlow(env.DB, "Sin publicar");
    if (!r.ok) throw new Error(r.error);
    expect((await get(`/flows/${r.id}`)).status).toBe(404);
    expect((await get("/flows/999")).status).toBe(404);
  });

  it("keeps step text from closing the script that carries the flow", async () => {
    await load();
    const id = await idOf("Instalaciones");
    const tricky = structuredClone(instalaciones) as Grid;
    tricky.rows[0]!.title = "</script><script>alert(1)</script>";
    await loadDevFlows(env.DB, [{ name: "Instalaciones", grid: tricky }]);
    const html = await (await get(`/flows/${id}`)).text();
    expect(html).not.toContain("</script><script>alert(1)");
    expect(flowData(html).flow.steps[0].title).toBe("</script><script>alert(1)</script>");
  });

  it("is linked as «Ver» from the flow list once published", async () => {
    await load();
    await createFlow(env.DB, "Sin publicar");
    const html = await (await get("/flows")).text();
    expect(html).toContain(`<a href="/flows/${await idOf("Instalaciones")}">Ver</a>`);
    expect(html).not.toContain(`<a href="/flows/${await idOf("Sin publicar")}">Ver</a>`);
  });
});
