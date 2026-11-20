import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createFlow } from "../src/flows.ts";
import { signIn, type Signed } from "./session.ts";

let board: Signed;
beforeEach(async () => {
  board = await signIn();
});

const page = async (path = "/setup", who = board) => (await who.fetch(path)).text();
// The step that is open: its heading.
const current = (html: string) => html.match(/<li class="card setup-step is-current" aria-current="step"><h2>([^<]*)<\/h2>/)?.[1];
const addArea = (name: string) => env.DB.prepare("INSERT INTO areas (name, name_key) VALUES (?, ?)").bind(name, name.toLowerCase()).run();

describe("first-use wizard (phase 7.3)", () => {
  // SPEC §9, Navigation (phase 8.1): reachable by its URL, linked from nowhere.
  it("is linked from nowhere, and still opens by its URL for whoever may edit flows and manage users", async () => {
    for (const path of ["/home", "/report", "/flows", "/areas", "/users"]) expect(await page(path)).not.toContain('href="/setup"');
    expect((await board.fetch("/setup")).status).toBe(200);
    const owner = await signIn({ username: "dueno", role: "leader", permissions: { canEdit: true } });
    const manager = await signIn({ username: "gestor", role: "leader", permissions: { canManageUsers: true } });
    for (const who of [owner, manager]) {
      const home = await page("/home", who);
      expect(home).not.toContain("/setup");
      expect((await who.fetch("/setup")).status).toBe(403);
    }
  });

  it("opens on the first step with nothing yet, so leaving and coming back resumes it", async () => {
    let html = await page();
    expect(current(html)).toBe("1. Áreas");
    expect(html).toContain('<a class="button-primary" href="/areas/import?desde=configuracion">Importar áreas</a>');
    expect(html).toContain('<a class="button-secondary" href="/setup?paso=usuarios">Saltar este paso</a>');
    expect(html).toContain("Todavía no hay ninguna.");
    await addArea("Ventas");
    html = await page();
    expect(current(html)).toBe("2. Usuarios");
    expect(html).toContain("Ya hay 1 área.");
    expect(html).toContain('<a class="button-primary" href="/users/import?desde=configuracion">Importar usuarios</a>');
    // The Board member walking it does not count as a user.
    expect(html).toContain("Todavía no hay ninguna además de la tuya.");
    await signIn({ username: "ana", role: "leader" });
    html = await page();
    expect(current(html)).toBe("3. Flujos");
    expect(html).toContain("Ya hay 1 cuenta además de la tuya.");
    expect(html).toContain('<a class="button-primary" href="/flows/new">Crear un flujo</a>');
    expect(html).toContain('<a class="button-secondary" href="/">Terminar por ahora</a>');
  });

  it("skips to the step asked for, without storing anything", async () => {
    const html = await page("/setup?paso=flujos");
    expect(current(html)).toBe("3. Flujos");
    expect(html).toContain('<a href="/setup?paso=areas">Ir a este paso</a>');
    // Nothing was kept: without the step asked for, it opens where the data says.
    expect(current(await page())).toBe("1. Áreas");
    expect(current(await page("/setup?paso=nada"))).toBe("1. Áreas");
  });

  it("with everything in place, opens no step and lets any be revisited", async () => {
    await addArea("Ventas");
    await signIn({ username: "ana", role: "leader" });
    await createFlow(env.DB, "Pedidos");
    const html = await page();
    expect(current(html)).toBeUndefined();
    expect(html).toContain("Ya hay áreas, usuarios y flujos.");
    expect(html).toContain("Ya hay 1 flujo.");
  });
});
