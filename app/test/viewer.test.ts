import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import apertura from "../../reference/Flujo_Apertura_OT.grid.json";
import { loadDevFlows } from "../src/devload.ts";
import { createFlow } from "../src/flows.ts";
import { applyGrid } from "../src/import.ts";
import { signIn, type Signed } from "./session.ts";

let board: Signed;
beforeEach(async () => {
  board = await signIn();
});
const get = (path: string) => board.fetch(path);
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
    // SPEC §9, Layout: the viewer fits the window (app.css, .viewer-page).
    expect(html).toContain('<body class="viewer-page">');
    expect(html).toContain("Apertura de OT</h1>");
    expect(html).toContain("36 pasos");
    expect(html).toContain('<button type="button" class="button-primary" data-start="true">Iniciar recorrido</button>');
    expect(html).toContain('<script type="module" src="/js/viewer.js"></script>');
    // SPEC §7, Layout (phase 8.5): the overview's panel is a card with the
    // flow, what the reader sees, its steps, and the button at its foot,
    // nothing floating over the diagram.
    const panel = html.match(/<aside class="card viewer-side">(.*?)<\/aside>/s)![1]!;
    expect(panel).toContain('<p class="eyebrow">PANORAMA</p><h2 class="step-title">Apertura de OT</h2>');
    expect(panel).toContain("Estás viendo el flujo completo.");
    expect(panel).toMatch(/36 pasos<\/p><div class="step-actions">.*data-start="true">Iniciar recorrido<\/button><\/div>$/s);
    expect(html.match(/<div class="diagram-card">(.*?)<\/div><aside/s)![1]).not.toContain("<button");
    // One card holds the viewer, with the panel inside it (phase 9.2).
    expect(html).toMatch(/<div class="card viewer-cols"><div class="diagram-card">.*<aside class="card viewer-side">/s);
    expect(html).toMatch(/<div class="viewer-titleline"><div class="viewer-head">.*<\/div><div class="flow-selector">/s);
    const data = flowData(html);
    expect(data).toMatchObject({ id, name: "Apertura de OT", colour: 2 });
    expect(data.flow.steps).toHaveLength(36);
    // Tags travel by name, as the step panel will show them.
    expect(data.flow.categories).toEqual(["Responsable", "Herramienta"]);
    expect(data.flow.steps.find((s: { id: string }) => s.id === "P13").ref).toBe(await idOf("Instalaciones"));
  });

  it("shows the flow name in the display type, and the objective in the overview panel", async () => {
    await load();
    const id = await idOf("Instalaciones");
    let html = await (await get(`/flows/${id}`)).text();
    // One title line (phase 9.2): the name and its state together.
    expect(html).toContain(`Instalaciones</h1><p class="review-status"`);
    // Neither reference flow has an objective: no empty line is drawn.
    expect(html).not.toContain("viewer-objective");
    await env.DB.prepare("UPDATE flows SET objective = ? WHERE id = ?")
      .bind("Dejar el servicio <instalado> y probado en casa del cliente.", id)
      .run();
    html = await (await get(`/flows/${id}`)).text();
    expect(html).toContain('<h1 class="viewer-title">');
    // SPEC §7, Layout: in the overview panel, before the step count, and
    // nowhere else.
    expect(html).toMatch(/<p class="viewer-objective">Dejar el servicio &lt;instalado&gt; y probado en casa del cliente.<\/p><p class="muted">\d+ pasos<\/p>/);
    expect(html.replace(/<script type="application\/json".*?<\/script>/s, "").match(/Dejar el servicio/g)).toHaveLength(1);
    expect(flowData(html).flow.objective).toBe("Dejar el servicio <instalado> y probado en casa del cliente.");
    const rule = env.CSS_FILES["app.css"].match(/\.viewer-title \{[^}]*\}/)![0];
    expect(rule).toContain("font-family: var(--font-display)");
    expect(rule).toContain("font-weight: var(--weight-display)");
    expect(rule).toContain("font-synthesis-weight: none");
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
    expect(html).toContain(`<a href="/flows/${await idOf("Instalaciones")}" aria-label="Ver Instalaciones">Ver</a>`);
    expect(html).not.toContain(`href="/flows/${await idOf("Sin publicar")}" aria-label="Ver`);
  });
});

// SPEC §5 and §7: a link step names the other flow and its contact whether
// or not the user can open it; with access, «Ir a» opens that flow's own
// tour, and nothing walked on either side is lost (phase 6.4).
describe("link steps (phase 6.4)", () => {
  const area = async (name: string) =>
    (await env.DB.prepare("INSERT INTO areas (name, name_key) VALUES (?, lower(?)) RETURNING id").bind(name, name).first<number>("id"))!;
  const assign = (flowId: number, areaId: number) =>
    env.DB.prepare("INSERT INTO flow_areas (flow_id, area_id) VALUES (?, ?)").bind(flowId, areaId).run();
  const post = (who: Signed, path: string, body?: unknown) =>
    who.fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

  it("names the target and its contact to everyone, and says who may open it", async () => {
    await load();
    const ot = await idOf("Apertura de OT");
    const inst = await idOf("Instalaciones");
    const ventas = await area("Ventas");
    const campo = await area("Campo");
    await assign(ot, ventas);
    await assign(inst, campo);
    const p13 = (data: { flow: { steps: { id: string }[] } }) => data.flow.steps.find((s) => s.id === "P13");
    // The Board opens everything.
    let data = flowData(await (await get(`/flows/${ot}`)).text());
    expect(p13(data)).toMatchObject({ type: "link", ref: inst, contact: "Jefe de instalación" });
    expect(data.links).toEqual({ [inst]: { name: "Instalaciones", open: true } });
    // Someone who sees only Apertura de OT: the name and the contact, no way in.
    const ana = await signIn({ username: "ana", role: "standard", areaIds: [ventas] });
    data = flowData(await (await ana.fetch(`/flows/${ot}`)).text());
    expect(p13(data)).toMatchObject({ contact: "Jefe de instalación" });
    expect(data.links).toEqual({ [inst]: { name: "Instalaciones", open: false } });
    expect((await ana.fetch(`/flows/${inst}`)).status).toBe(404);
    // Someone in both areas may go.
    const beto = await signIn({ username: "beto", role: "standard", areaIds: [ventas, campo] });
    data = flowData(await (await beto.fetch(`/flows/${ot}`)).text());
    expect(data.links).toEqual({ [inst]: { name: "Instalaciones", open: true } });
    // A flow without links sends none.
    expect(flowData(await (await beto.fetch(`/flows/${inst}`)).text()).links).toEqual({});
    // Starting the tour carries the links of the run's own release.
    const started = (await (await post(ana, `/flows/${ot}/tour`)).json()) as { links: unknown };
    expect(started.links).toEqual({ [inst]: { name: "Instalaciones", open: false } });
  });

  it("keeps the tour left open, and continues the one already open on arrival", async () => {
    await load();
    const ot = await idOf("Apertura de OT");
    const inst = await idOf("Instalaciones");
    // A tour of Apertura de OT, one step in.
    await post(board, `/flows/${ot}/tour`);
    expect((await post(board, `/flows/${ot}/tour/step`, { at: "P1", action: "next" })).status).toBe(200);
    // «Ir a «Instalaciones»» starts that tour; Apertura de OT stays open.
    let run = (await (await post(board, `/flows/${inst}/tour`)).json()) as { runId: number; log: unknown[] };
    expect(run.log).toHaveLength(0);
    await post(board, `/flows/${inst}/tour/step`, { at: "P1", action: "next" });
    const home = await (await get("/home")).text();
    expect(home.match(/data-state="in_progress"/g)).toHaveLength(2);
    // Coming back through the link again continues where it was.
    const again = (await (await post(board, `/flows/${inst}/tour`)).json()) as { runId: number; log: unknown[] };
    expect(again.runId).toBe(run.runId);
    expect(again.log).toHaveLength(1);
    run = (await (await post(board, `/flows/${ot}/tour`)).json()) as { runId: number; log: unknown[] };
    expect(run.log).toHaveLength(1);
  });
});

// SPEC §7, Flow selector (phase 6.7).
describe("flow selector (phase 6.7)", () => {
  const area = async (name: string) =>
    (await env.DB.prepare("INSERT INTO areas (name, name_key) VALUES (?, lower(?)) RETURNING id").bind(name, name).first<number>("id"))!;
  const assign = (flowId: number, areaId: number) =>
    env.DB.prepare("INSERT INTO flow_areas (flow_id, area_id) VALUES (?, ?)").bind(flowId, areaId).run();
  const options = (html: string) => [...html.matchAll(/<option value="(\d+)"( selected="")?>([^<]*)<\/option>/g)].map((m) => `${m[3]}${m[2] ? "*" : ""}`);

  it("lists the flows the user sees, the current one chosen, for whoever has a choice", async () => {
    await load();
    const ot = await idOf("Apertura de OT");
    const inst = await idOf("Instalaciones");
    // A flow never published is not listed, even for the Board.
    await createFlow(env.DB, "Borrador");
    const ventas = await area("Ventas");
    const campo = await area("Campo");
    await assign(ot, ventas);
    await assign(inst, campo);
    let html = await (await get(`/flows/${inst}`)).text();
    expect(html).toContain('<label for="flow-select">Flujo</label><select id="flow-select" data-flow-select="true">');
    expect(options(html)).toEqual(["Apertura de OT", "Instalaciones*"]);
    // A Standard user with a single flow never sees it.
    const ana = await signIn({ username: "ana", role: "standard", areaIds: [ventas] });
    html = await (await ana.fetch(`/flows/${ot}`)).text();
    expect(html).not.toContain("flow-select");
    // With two flows, they do.
    const beto = await signIn({ username: "beto", role: "standard", areaIds: [ventas, campo] });
    expect(options(await (await beto.fetch(`/flows/${ot}`)).text())).toEqual(["Apertura de OT*", "Instalaciones"]);
    // A Leader always does, even with one flow to show.
    await env.DB.prepare("DELETE FROM releases WHERE flow_id = ?").bind(inst).run();
    const lia = await signIn({ username: "lia", role: "leader" });
    expect(options(await (await lia.fetch(`/flows/${ot}`)).text())).toEqual(["Apertura de OT*"]);
  });
});
