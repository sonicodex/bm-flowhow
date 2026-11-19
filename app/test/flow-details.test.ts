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
const save = (who: Signed, id: number, fields: { name: string; objective?: string; colour?: string; areas?: number[] }) => {
  const body = new URLSearchParams({ name: fields.name, objective: fields.objective ?? "", colour: fields.colour ?? "1" });
  for (const a of fields.areas ?? []) body.append("area", String(a));
  return who.fetch(`/flows/${id}/details`, { method: "POST", body });
};
const flowRow = (id: number) => env.DB.prepare("SELECT name, objective FROM flows WHERE id = ?").bind(id).first();
const areasOf = async (id: number) =>
  (await env.DB.prepare("SELECT area_id FROM flow_areas WHERE flow_id = ? ORDER BY area_id").bind(id).all<{ area_id: number }>()).results.map((r) => r.area_id);

describe("flow form (phase 4.4)", () => {
  it("saves name, objective and areas, and shows the form with them", async () => {
    // A process owner: can_edit and nothing else is enough.
    const owner = await signIn({ username: "dueno", role: "leader", permissions: { canEdit: true } });
    const flow = await createFlow(env.DB, "Borrador");
    if (!flow.ok) throw new Error(flow.error);
    const ops = await area("Operaciones");
    const res = await save(owner, flow.id, { name: "  Despachos ", objective: " Que todo salga a tiempo. ", areas: [ops] });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/flows/${flow.id}/details?guardado=1`);
    expect(await flowRow(flow.id)).toEqual({ name: "Despachos", objective: "Que todo salga a tiempo." });
    expect(await areasOf(flow.id)).toEqual([ops]);
    const html = await (await owner.fetch(res.headers.get("location")!)).text();
    expect(html).toContain("Cambios guardados.");
    expect(html).toContain('value="Despachos"');
    expect(html).toContain(`<input type="checkbox" name="area" value="${ops}" checked=""`);
  });

  it("refuses a blank name or another flow's name, keeping what was typed", async () => {
    const board = await signIn();
    const a = await createFlow(env.DB, "Ventas");
    const b = await createFlow(env.DB, "Compras");
    if (!a.ok || !b.ok) throw new Error("setup");
    let res = await save(board, b.id, { name: "VENTAS", objective: "Algo" });
    expect(res.status).toBe(422);
    let html = await res.text();
    expect(html).toContain("Ya existe un flujo llamado «Ventas». Los nombres se comparan sin mayúsculas ni tildes.");
    expect(html).toContain('value="VENTAS"');
    res = await save(board, b.id, { name: "  " });
    expect(res.status).toBe(422);
    html = await res.text();
    expect(html).toContain("Escribe el nombre del flujo.");
    expect(await flowRow(b.id)).toEqual({ name: "Compras", objective: "" });
  });

  it("decides which Empleados see a published flow", async () => {
    await loadDevFlows(env.DB, [{ name: "Instalaciones", grid: instalaciones as Grid }]);
    const id = (await env.DB.prepare("SELECT id FROM flows WHERE name = 'Instalaciones'").first<number>("id"))!;
    const ventas = await area("Ventas");
    const board = await signIn();
    const ana = await signIn({ username: "ana", role: "standard", areaIds: [ventas] });
    expect((await ana.fetch(`/flows/${id}`)).status).toBe(404);
    await save(board, id, { name: "Instalaciones", areas: [ventas] });
    expect((await ana.fetch(`/flows/${id}`)).status).toBe(200);
    expect(await (await ana.fetch("/home")).text()).toContain("Instalaciones</h2>");
    // The objective shows in the viewer.
    await save(board, id, { name: "Instalaciones", objective: "Instalar bien.", areas: [ventas] });
    expect(await (await ana.fetch(`/flows/${id}`)).text()).toContain('<p class="muted">Instalar bien.</p>');
    // Taking the area away hides it again.
    await save(board, id, { name: "Instalaciones", areas: [] });
    expect((await ana.fetch(`/flows/${id}`)).status).toBe(404);
  });

  it("warns, and still saves, when a published flow is left with no area", async () => {
    await loadDevFlows(env.DB, [{ name: "Instalaciones", grid: instalaciones as Grid }]);
    const id = (await env.DB.prepare("SELECT id FROM flows WHERE name = 'Instalaciones'").first<number>("id"))!;
    const board = await signIn();
    let res = await save(board, id, { name: "Instalaciones", areas: [] });
    expect(res.status).toBe(303);
    expect(await areasOf(id)).toEqual([]);
    let html = await (await board.fetch(res.headers.get("location")!)).text();
    expect(html).toContain("Cambios guardados.");
    expect(html).toContain(NO_AREAS_WARNING);
    // Only right after saving, not on every visit.
    expect(await (await board.fetch(`/flows/${id}/details`)).text()).not.toContain(NO_AREAS_WARNING);
    // With an area, no warning.
    res = await save(board, id, { name: "Instalaciones", areas: [await area("Ventas")] });
    expect(await (await board.fetch(res.headers.get("location")!)).text()).not.toContain(NO_AREAS_WARNING);
    // A draft with no area: nobody sees it yet, and publishing asks for one.
    const draft = await createFlow(env.DB, "Borrador");
    if (!draft.ok) throw new Error(draft.error);
    res = await save(board, draft.id, { name: "Borrador", areas: [] });
    html = await (await board.fetch(res.headers.get("location")!)).text();
    expect(html).toContain("Cambios guardados.");
    expect(html).not.toContain(NO_AREAS_WARNING);
  });

  it("saves the colour as a palette slot, without a new version (phase 5.1)", async () => {
    await loadDevFlows(env.DB, [{ name: "Instalaciones", grid: instalaciones as Grid }]);
    const id = (await env.DB.prepare("SELECT id FROM flows WHERE name = 'Instalaciones'").first<number>("id"))!;
    const board = await signIn();
    const releases = () => env.DB.prepare("SELECT count(*) AS n FROM releases WHERE flow_id = ?").bind(id).first<number>("n");
    const colour = () => env.DB.prepare("SELECT colour FROM flows WHERE id = ?").bind(id).first<number>("colour");
    const before = await releases();
    // The form offers the twelve slots, the current one chosen.
    let html = await (await board.fetch(`/flows/${id}/details`)).text();
    expect(html.match(/name="colour"/g)).toHaveLength(12);
    expect(html).toContain(`value="${await colour()}" class="swatch flow-${await colour()}" aria-label="Color ${await colour()}" checked=""`);
    const res = await save(board, id, { name: "Instalaciones", colour: "7" });
    expect(res.status).toBe(303);
    expect(await colour()).toBe(7);
    expect(await releases()).toBe(before);
    html = await (await board.fetch(`/flows/${id}/details`)).text();
    expect(html).toContain('value="7" class="swatch flow-7" aria-label="Color 7" checked=""');
    // The viewer paints with it.
    expect(await (await board.fetch(`/flows/${id}`)).text()).toContain("flow-7");
    // Anything but a slot is refused, and nothing changes.
    for (const bad of ["0", "13", "", "azul"]) {
      const r = await save(board, id, { name: "Instalaciones", colour: bad });
      expect(r.status, bad).toBe(422);
      expect(await r.text()).toContain("Elige uno de los colores.");
    }
    expect(await colour()).toBe(7);
  });

  it("saves the areas alone from the editor, the same data as the form (DECISIONS, 2026-11-19)", async () => {
    await loadDevFlows(env.DB, [{ name: "Instalaciones", grid: instalaciones as Grid }]);
    const id = (await env.DB.prepare("SELECT id FROM flows WHERE name = 'Instalaciones'").first<number>("id"))!;
    const board = await signIn();
    const ventas = await area("Ventas");
    const ops = await area("Operaciones");
    const releases = () => env.DB.prepare("SELECT count(*) AS n FROM releases WHERE flow_id = ?").bind(id).first<number>("n");
    const before = await releases();
    const put = (body: unknown) =>
      board.fetch(`/flows/${id}/areas`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    // The editor shows the selector with every area, the flow's checked.
    let html = await (await board.fetch(`/flows/${id}/edit`)).text();
    expect(html).toContain('id="area-picker"');
    let res = await put({ areaIds: [ops, ventas, ops] });
    expect(await res.json()).toEqual({ status: "saved", warning: null });
    expect(await areasOf(id)).toEqual([ventas, ops].sort((a, b) => a - b));
    expect(await releases()).toBe(before);
    html = await (await board.fetch(`/flows/${id}/details`)).text();
    expect(html).toContain(`<input type="checkbox" name="area" value="${ops}" checked=""`);
    html = await (await board.fetch(`/flows/${id}/edit`)).text();
    expect(html).toContain(`<input type="checkbox" name="area" value="${ventas}" checked=""`);
    expect(html).toContain('<span data-area-summary="true">Operaciones, Ventas</span>');
    // A published flow left with no area: saved, with the form's warning.
    res = await put({ areaIds: [] });
    expect(await res.json()).toEqual({ status: "saved", warning: NO_AREAS_WARNING });
    expect(await areasOf(id)).toEqual([]);
    // Anything but a list of ids, or an area that is gone, changes nothing.
    for (const bad of [null, {}, { areaIds: "1" }, { areaIds: [0] }, { areaIds: ["1"] }]) {
      expect((await put(bad)).status).toBe(400);
    }
    res = await put({ areaIds: [ventas, ventas + ops + 100] });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ status: "invalid", error: "Una de las áreas elegidas ya no existe." });
    expect(await areasOf(id)).toEqual([]);
  });
});
