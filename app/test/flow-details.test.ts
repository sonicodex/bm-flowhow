import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import { loadDevFlows } from "../src/devload.ts";
import { createFlow } from "../src/flows.ts";
import { NO_AREAS_WARNING } from "../src/flows-screen.tsx";
import { nameKey } from "../src/names.ts";
import { signIn, type Signed } from "./session.ts";

const area = async (name: string) =>
  (await env.DB.prepare("INSERT INTO areas (name, name_key) VALUES (?, ?) RETURNING id").bind(name, nameKey(name)).first<number>("id"))!;
const post = (who: Signed, path: string, body: unknown) =>
  who.fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const field = (who: Signed, id: number, body: unknown) => post(who, `/flows/${id}/details`, body);
const areas = (who: Signed, id: number, areaIds: unknown) => post(who, `/flows/${id}/areas`, { areaIds });
const flowRow = (id: number) => env.DB.prepare("SELECT name, objective, colour FROM flows WHERE id = ?").bind(id).first();
const areasOf = async (id: number) =>
  (await env.DB.prepare("SELECT area_id FROM flow_areas WHERE flow_id = ? ORDER BY area_id").bind(id).all<{ area_id: number }>()).results.map((r) => r.area_id);
const instalacionesId = async () => {
  await loadDevFlows(env.DB, [{ name: "Instalaciones", grid: instalaciones as Grid }]);
  return (await env.DB.prepare("SELECT id FROM flows WHERE name = 'Instalaciones'").first<number>("id"))!;
};
const releases = (id: number) => env.DB.prepare("SELECT count(*) AS n FROM releases WHERE flow_id = ?").bind(id).first<number>("n");

// SPEC §6: the flow's data lives in a folded panel above the editor's grid,
// and none of it is part of the draft: each change is saved at once.
describe("flow data panel (SPEC §6)", () => {
  it("shows the panel folded in the editor, with every field, and no separate page", async () => {
    const board = await signIn();
    const flow = await createFlow(env.DB, "Despachos");
    if (!flow.ok) throw new Error(flow.error);
    const ops = await area("Operaciones");
    await areas(board, flow.id, [ops]);
    const html = await (await board.fetch(`/flows/${flow.id}/edit`)).text();
    expect(html).toContain('<button type="button" class="button-link" data-flow-data="true" aria-expanded="false" aria-controls="flow-data">Datos del flujo</button>');
    expect(html).toContain('<section class="card editor-import editor-data" id="flow-data" aria-labelledby="flow-data-title" hidden="">');
    expect(html).toContain('<input id="flow-name" name="name" value="Despachos"');
    expect(html).toContain('<textarea id="flow-objective" name="objective"');
    expect(html.match(/name="colour"/g)).toHaveLength(12);
    expect(html).toContain(`<input type="checkbox" name="area" value="${ops}" checked=""`);
    expect(html).toContain('<span data-area-summary="true">Operaciones</span>');
    expect((await board.fetch(`/flows/${flow.id}/details`)).status).toBe(404);
  });

  it("saves name and objective one at a time, trimmed, and refuses a blank or taken name", async () => {
    // A process owner: can_edit and nothing else is enough.
    const owner = await signIn({ username: "dueno", role: "leader", permissions: { canEdit: true } });
    const a = await createFlow(env.DB, "Ventas");
    const b = await createFlow(env.DB, "Compras");
    if (!a.ok || !b.ok) throw new Error("setup");
    let res = await field(owner, b.id, { name: "  Despachos " });
    expect(await res.json()).toEqual({ status: "saved", value: "Despachos" });
    res = await field(owner, b.id, { objective: " Que todo salga a tiempo. " });
    expect(await res.json()).toEqual({ status: "saved", value: "Que todo salga a tiempo." });
    expect(await flowRow(b.id)).toMatchObject({ name: "Despachos", objective: "Que todo salga a tiempo." });
    expect(await (await owner.fetch(`/flows/${b.id}/edit`)).text()).toContain("<title>Editar Despachos · FlowHow</title>");
    res = await field(owner, b.id, { name: "VENTAS" });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ status: "invalid", error: "Ya existe un flujo llamado «Ventas». Los nombres se comparan sin mayúsculas ni tildes." });
    res = await field(owner, b.id, { name: "  " });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ status: "invalid", error: "Escribe el nombre del flujo." });
    // Its own name, written differently, is no clash.
    expect(await (await field(owner, b.id, { name: "despachos" })).json()).toEqual({ status: "saved", value: "despachos" });
    // One field per request, of the right kind.
    for (const bad of [null, {}, { name: "A", objective: "B" }, { name: 3 }, { colour: "7" }, { other: "x" }]) {
      expect((await field(owner, b.id, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect(await flowRow(b.id)).toMatchObject({ name: "despachos", objective: "Que todo salga a tiempo." });
  });

  it("decides which Empleados see a published flow, and the viewer shows the objective", async () => {
    const id = await instalacionesId();
    const ventas = await area("Ventas");
    const board = await signIn();
    const ana = await signIn({ username: "ana", role: "standard", areaIds: [ventas] });
    expect((await ana.fetch(`/flows/${id}`)).status).toBe(404);
    expect(await (await areas(board, id, [ventas])).json()).toEqual({ status: "saved", warning: null });
    expect((await ana.fetch(`/flows/${id}`)).status).toBe(200);
    expect(await (await ana.fetch("/home")).text()).toContain("Instalaciones</h2>");
    await field(board, id, { objective: "Instalar bien." });
    expect(await (await ana.fetch(`/flows/${id}`)).text()).toContain('<p class="muted">Instalar bien.</p>');
    // Taking the area away hides it again.
    await areas(board, id, []);
    expect((await ana.fetch(`/flows/${id}`)).status).toBe(404);
  });

  it("saves the areas as a set, without a version, and warns when a published flow is left with none", async () => {
    const id = await instalacionesId();
    const board = await signIn();
    const ventas = await area("Ventas");
    const ops = await area("Operaciones");
    const before = await releases(id);
    let res = await areas(board, id, [ops, ventas, ops]);
    expect(await res.json()).toEqual({ status: "saved", warning: null });
    expect(await areasOf(id)).toEqual([ventas, ops].sort((a, b) => a - b));
    expect(await releases(id)).toBe(before);
    const html = await (await board.fetch(`/flows/${id}/edit`)).text();
    expect(html).toContain(`<input type="checkbox" name="area" value="${ventas}" checked=""`);
    expect(html).toContain('<span data-area-summary="true">Operaciones, Ventas</span>');
    res = await areas(board, id, []);
    expect(await res.json()).toEqual({ status: "saved", warning: NO_AREAS_WARNING });
    expect(await areasOf(id)).toEqual([]);
    // A draft with no area: nobody sees it yet, and publishing asks for one.
    const draft = await createFlow(env.DB, "Borrador");
    if (!draft.ok) throw new Error(draft.error);
    expect(await (await areas(board, draft.id, [])).json()).toEqual({ status: "saved", warning: null });
    // Anything but a list of ids, or an area that is gone, changes nothing.
    await areas(board, id, [ops]);
    for (const bad of [null, "1", [0], ["1"]]) {
      expect((await areas(board, id, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await post(board, `/flows/${id}/areas`, null)).status).toBe(400);
    res = await areas(board, id, [ventas, ventas + ops + 100]);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ status: "invalid", error: "Una de las áreas elegidas ya no existe." });
    expect(await areasOf(id)).toEqual([ops]);
  });

  it("saves the colour as a palette slot, without a new version (phase 5.1)", async () => {
    const id = await instalacionesId();
    const board = await signIn();
    const colour = () => env.DB.prepare("SELECT colour FROM flows WHERE id = ?").bind(id).first<number>("colour");
    const before = await releases(id);
    // The panel offers the twelve slots, the current one chosen.
    let html = await (await board.fetch(`/flows/${id}/edit`)).text();
    expect(html).toContain(`value="${await colour()}" class="swatch flow-${await colour()}" aria-label="Color ${await colour()}" checked=""`);
    expect(await (await field(board, id, { colour: 7 })).json()).toEqual({ status: "saved", value: 7 });
    expect(await colour()).toBe(7);
    expect(await releases(id)).toBe(before);
    html = await (await board.fetch(`/flows/${id}/edit`)).text();
    expect(html).toContain('value="7" class="swatch flow-7" aria-label="Color 7" checked=""');
    expect(html).toContain('<section class="editor flow-7">');
    // The viewer paints with it.
    expect(await (await board.fetch(`/flows/${id}`)).text()).toContain("flow-7");
    // Anything but a slot is refused, and nothing changes.
    for (const bad of [0, 13, 1.5]) {
      const r = await field(board, id, { colour: bad });
      expect(r.status, String(bad)).toBe(422);
      expect(await r.json()).toEqual({ status: "invalid", error: "Elige uno de los colores." });
    }
    expect(await colour()).toBe(7);
  });
});
