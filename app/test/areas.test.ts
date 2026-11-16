import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createFlow } from "../src/flows.ts";
import { signIn, type Signed } from "./session.ts";

let board: Signed;
beforeEach(async () => {
  board = await signIn();
});

const form = (path: string, fields: Record<string, string> = {}) => board.fetch(path, { method: "POST", body: new URLSearchParams(fields) });
const post = (name: string) => form("/areas", { name });
const names = async () => (await env.DB.prepare("SELECT name FROM areas ORDER BY id").all<{ name: string }>()).results.map((r) => r.name);
const idOf = async (name: string) => (await env.DB.prepare("SELECT id FROM areas WHERE name = ?").bind(name).first<number>("id"))!;

describe("/areas (phase 4.4)", () => {
  it("shows the empty state", async () => {
    const res = await board.fetch("/areas");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Todavía no hay áreas.");
  });

  it("creates an area and lists it with what uses it", async () => {
    const res = await post("  Operaciones  ");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/areas");
    expect(await names()).toEqual(["Operaciones"]);
    const html = await (await board.fetch("/areas")).text();
    expect(html).toContain('value="Operaciones"');
    expect(html).toContain("0 usuarios · 0 flujos");
  });

  it("refuses a duplicate name ignoring case and accents, and says why", async () => {
    await post("Diseño");
    const res = await post("DISENO");
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Ya existe un área llamada «Diseño». Los nombres se comparan sin mayúsculas ni tildes.");
    // What was typed stays in the field.
    expect(html).toContain('<input id="area-name" name="name" value="DISENO"');
    expect(await names()).toEqual(["Diseño"]);
  });

  it("refuses a blank name", async () => {
    const res = await post("   ");
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("Escribe el nombre del área.");
  });

  it("renames an area, to a new spelling of its own name too", async () => {
    await post("diseno");
    const id = await idOf("diseno");
    expect((await form(`/areas/${id}`, { name: "Diseño" })).status).toBe(303);
    expect(await names()).toEqual(["Diseño"]);
  });

  it("refuses to rename onto another area's name", async () => {
    await post("Ventas");
    await post("Compras");
    const res = await form(`/areas/${await idOf("Compras")}`, { name: "ventas" });
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Ya existe un área llamada «Ventas».");
    expect(html).toContain('value="ventas"');
    expect(await names()).toEqual(["Ventas", "Compras"]);
  });

  it("deletes an area nobody uses, and only then", async () => {
    await post("Libre");
    await post("Con gente");
    await post("Con flujo");
    await signIn({ username: "ana", role: "standard", areaIds: [await idOf("Con gente")] });
    const flow = await createFlow(env.DB, "Flujo");
    if (!flow.ok) throw new Error(flow.error);
    await env.DB.prepare("INSERT INTO flow_areas (flow_id, area_id) VALUES (?, ?)").bind(flow.id, await idOf("Con flujo")).run();

    const html = await (await board.fetch("/areas")).text();
    expect(html).toContain('aria-label="Borrar el área Libre"');
    expect(html).not.toContain('aria-label="Borrar el área Con gente"');
    expect(html).toContain("1 usuario · 0 flujos");
    expect(html).toContain("0 usuarios · 1 flujo");

    let res = await form(`/areas/${await idOf("Con gente")}/delete`);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("No se puede borrar «Con gente»: tiene 1 usuario · 0 flujos. Quítaselos primero.");
    res = await form(`/areas/${await idOf("Con flujo")}/delete`);
    expect(res.status).toBe(422);
    res = await form(`/areas/${await idOf("Libre")}/delete`);
    expect(res.status).toBe(303);
    expect(await names()).toEqual(["Con gente", "Con flujo"]);
  });
});
