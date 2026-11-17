import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import { loadDevFlows } from "../src/devload.ts";
import { createFlow } from "../src/flows.ts";
import { signIn } from "./session.ts";
import { tableHead, tableRows } from "./table.ts";

// SPEC §9 Administration screens: one pattern for areas, users and flows.
describe("administration screens (phase 4.4)", () => {
  it("lists each entity in a table with the columns SPEC names, the page's action above it", async () => {
    await loadDevFlows(env.DB, [{ name: "Instalaciones", grid: instalaciones as Grid }]);
    const board = await signIn({ username: "junta" });
    const expected = {
      "/areas": { head: ["Nombre", "Flujos", "Usuarios", "Acciones"], action: '<a class="button-primary" href="/areas/new">Nueva área</a>' },
      "/users": { head: ["Nombre", "Usuario", "Rol", "Áreas", "Activo", "Acciones"], action: '<a class="button-primary" href="/users/new">Nuevo usuario</a>' },
      "/flows": {
        head: ["Nombre", "Versión publicada", "Borrador", "Áreas", "Acciones"],
        action: '<a class="button-primary" href="/flows/new">Nuevo flujo</a>',
      },
    };
    for (const [path, { head, action }] of Object.entries(expected)) {
      const html = await (await board.fetch(path)).text();
      expect(tableHead(html), path).toEqual(head);
      // The action sits in the title row, before the table.
      expect(html.indexOf(action), path).toBeGreaterThan(html.indexOf('<div class="admin-head">'));
      expect(html.indexOf(action), path).toBeLessThan(html.indexOf("<table"));
      expect(html, path).not.toMatch(/<ul class="(admin-list|plain-list)"/);
      // The frame that shades its right edge while there is more to scroll to.
      expect(html, path).toContain('<div class="table-frame"><div class="table-scroll" data-table-scroll="true"><table class="admin-table">');
      expect(html, path).toContain('<script type="module" src="/js/table-scroll.js"></script>');
    }
    expect(tableRows(await (await board.fetch("/users")).text())).toEqual([["Nombre de junta", "junta", "Junta directiva", "", "Sí", "Editar"]]);
  });

  it("shows a flow's colour dot, version, draft and areas", async () => {
    await loadDevFlows(env.DB, [{ name: "Instalaciones", grid: instalaciones as Grid }]);
    const draft = await createFlow(env.DB, "Borrador nuevo");
    if (!draft.ok) throw new Error(draft.error);
    const html = await (await (await signIn()).fetch("/flows")).text();
    expect(tableRows(html)).toEqual([
      ["Borrador nuevo", "Sin publicar", "Sí", "Ninguna", "Editar"],
      ["Instalaciones", "1.0", "No", "Desarrollo", "Ver Editar"],
    ]);
    const { id, colour } = (await env.DB.prepare("SELECT id, colour FROM flows WHERE name = 'Instalaciones'").first<{ id: number; colour: number }>())!;
    expect(html).toContain(`<a class="admin-name flow-${colour}" href="/flows/${id}/edit"><span class="flow-dot" aria-hidden="true"></span>Instalaciones</a>`);
  });

  it("creates a flow from its own form, which keeps what was typed when refused", async () => {
    const board = await signIn();
    expect((await board.fetch("/flows", { method: "POST", body: new URLSearchParams({ name: "Ventas" }) })).headers.get("location")).toBe("/flows");
    const res = await board.fetch("/flows", { method: "POST", body: new URLSearchParams({ name: "VENTAS" }) });
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("<h1 class=\"page-title\">Nuevo flujo</h1>");
    expect(html).toContain('<input id="flow-name" name="name" value="VENTAS"');
  });

  it("lays out every form the same way: the way back at the top, the save at the bottom left", async () => {
    const board = await signIn({ username: "junta" });
    const flow = await createFlow(env.DB, "Ventas");
    if (!flow.ok) throw new Error(flow.error);
    const area = (await env.DB.prepare("INSERT INTO areas (name, name_key) VALUES ('Ventas', 'ventas') RETURNING id").first<number>("id"))!;
    const forms = {
      "/areas/new": "/areas",
      [`/areas/${area}`]: "/areas",
      "/users/new": "/users",
      [`/users/${board.id}`]: "/users",
      "/flows/new": "/flows",
      // The flow form belongs to the editor (phase 5.3): it goes back there.
      [`/flows/${flow.id}/details`]: `/flows/${flow.id}/edit`,
    };
    for (const [path, back] of Object.entries(forms)) {
      const html = await (await board.fetch(path)).text();
      const main = html.slice(html.indexOf('<main class="site-main">'));
      // First thing in the page: the way back to its list.
      expect(main, path).toMatch(new RegExp(`^<main class="site-main"><p class="admin-back"><a href="${back}">← Volver a`));
      // Last thing in the form: its one save button.
      expect(main, path).toMatch(/<div class="admin-submit"><button type="submit" class="button-primary">[^<]+<\/button><\/div><\/form>/);
    }
  });
});
