import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import apertura from "../../reference/Flujo_Apertura_OT.grid.json";
import { assertGuarded, guardedRoutes, Router, type Access } from "../src/access.tsx";
import { loadDevFlows } from "../src/devload.ts";
import { createFlow } from "../src/flows.ts";
import app from "../src/index.tsx";
import { renderer } from "../src/layout.tsx";
import { loadSession, type AppEnv } from "../src/session.ts";
import { signIn, withSession, type Signed } from "./session.ts";

const anonymous = withSession("");

// Each request as a browser would send it. POSTs go as JSON, the shape the
// tour's routes read; the form routes read an empty body and refuse it.
const send = (who: Signed["fetch"], method: string, path: string) =>
  who(path, method === "GET" ? {} : { method, headers: { "content-type": "application/json" }, body: "{}" });

const sentToLogin = (res: Response, method: string) =>
  method === "GET" ? res.status === 302 && res.headers.get("location") === "/" : res.status === 401;

const sentToPasswordChange = (res: Response, method: string) =>
  method === "GET" ? res.status === 302 && res.headers.get("location") === "/password" : res.status === 403;

// Through the guard: the route's own handler answered.
const through = (res: Response) =>
  ![401, 403, 404].includes(res.status) && !(res.status >= 300 && res.status < 400 && res.headers.get("location") === "/");

describe("route access (phase 4.2)", () => {
  it("lists every route from the app itself, each with the access decided for it", () => {
    // Read from the app, compared with what was decided. A new route turns
    // this red until someone writes down who may reach it; a route whose
    // declared access changes does too.
    const routes = Object.fromEntries(guardedRoutes(app).map((r) => [`${r.method} ${r.path}`, r.access]));
    expect(routes).toEqual({
      "GET /": "public",
      "POST /login": "public",
      "POST /logout": "public",
      "GET /password": "account",
      "POST /password": "account",
      "GET /home": "user",
      "GET /areas": "editor",
      "GET /areas/new": "editor",
      "POST /areas": "editor",
      "GET /areas/:id{[0-9]+}": "editor",
      "POST /areas/:id{[0-9]+}": "editor",
      "POST /areas/:id{[0-9]+}/delete": "editor",
      "GET /categories": "editor",
      "GET /categories/new": "editor",
      "POST /categories": "editor",
      "GET /categories/:id{[0-9]+}": "editor",
      "POST /categories/:id{[0-9]+}": "editor",
      "POST /categories/:id{[0-9]+}/move": "editor",
      "POST /categories/:id{[0-9]+}/values": "editor",
      "GET /categories/:id{[0-9]+}/values/:value{[0-9]+}": "editor",
      "POST /categories/:id{[0-9]+}/values/:value{[0-9]+}": "editor",
      "POST /categories/:id{[0-9]+}/values/:value{[0-9]+}/delete": "editor",
      "POST /categories/:id{[0-9]+}/delete": "editor",
      "GET /users": "users",
      "GET /users/new": "users",
      "POST /users": "users",
      "GET /users/:id{[0-9]+}": "users",
      "POST /users/:id{[0-9]+}": "users",
      "POST /users/:id{[0-9]+}/deactivate": "users",
      "POST /users/:id{[0-9]+}/activate": "users",
      "POST /users/:id{[0-9]+}/password": "users",
      "GET /flows/:id{[0-9]+}": "flow",
      "POST /flows/:id{[0-9]+}/tour": "flow",
      "POST /flows/:id{[0-9]+}/tour/restart": "flow",
      "POST /flows/:id{[0-9]+}/tour/step": "flow",
      "POST /flows/:id{[0-9]+}/tour/finish": "flow",
      "GET /flows": "editor",
      "GET /flows/new": "editor",
      "POST /flows": "editor",
      "GET /flows/:id{[0-9]+}/details": "editor",
      "POST /flows/:id{[0-9]+}/details": "editor",
      "GET /flows/:id{[0-9]+}/edit": "editor",
      "POST /flows/:id{[0-9]+}/draft": "editor",
      "POST /flows/:id{[0-9]+}/draft/review": "editor",
      "POST /flows/:id{[0-9]+}/publish": "editor",
      "GET /flows/:id{[0-9]+}/save-points": "editor",
      "POST /flows/:id{[0-9]+}/save-points/:point{[0-9]+}/restore": "editor",
    });
  });

  it("walks every route against each kind of user", async () => {
    await loadDevFlows(env.DB, [
      { name: "Instalaciones", grid: instalaciones as Grid },
      { name: "Apertura de OT", grid: apertura as Grid },
    ]);
    const area = (await env.DB.prepare("SELECT id FROM areas WHERE name = 'Desarrollo'").first<number>("id"))!;
    const flow = (await env.DB.prepare("SELECT id FROM flows WHERE name = 'Instalaciones'").first<number>("id"))!;
    const users = {
      inArea: await signIn({ username: "ana", role: "standard", areaIds: [area] }),
      otherArea: await signIn({ username: "beto", role: "standard" }),
      leader: await signIn({ username: "lia", role: "leader" }),
      board: await signIn({ username: "junta", role: "board" }),
      // A process owner who maintains their area's flow: can_edit and
      // nothing else (SPEC §4). The case that keeps the user screens apart.
      owner: await signIn({ username: "dueno", role: "standard", areaIds: [area], permissions: { canEdit: true } }),
    };
    // Signed in with a temporary password: every route but the change
    // screen sends them there, whatever their permissions.
    const pending = await signIn({ username: "temporal", role: "board" });
    await env.DB.prepare("UPDATE users SET must_change_password = 1 WHERE id = ?").bind(pending.id).run();
    // The ids that a route's `:id` stands for, by what the route is about.
    // The user and area routes act on accounts and areas of their own, so
    // what the walk changes touches no one walking.
    const target = await signIn({ username: "objetivo", role: "leader" });
    const spareArea = (await env.DB.prepare("INSERT INTO areas (name, name_key) VALUES ('Sobrante', 'sobrante') RETURNING id").first<number>("id"))!;
    // A category and value of their own too: the walk deletes them.
    const spareCategory = (await env.DB.prepare("INSERT INTO tag_categories (name, name_key) VALUES ('Sobrante', 'sobrante') RETURNING id").first<number>("id"))!;
    const spareValue = (await env.DB.prepare("INSERT INTO tags (category_id, name, name_key) VALUES (?, 'Sobra', 'sobra') RETURNING id").bind(spareCategory).first<number>("id"))!;
    // A save point of the flow, for "Volver a este punto".
    const point = (await env.DB.prepare("INSERT INTO save_points (flow_id, document) SELECT flow_id, document FROM releases WHERE flow_id = ? RETURNING id").bind(flow).first<number>("id"))!;
    const idFor = (path: string) =>
      path.startsWith("/users") ? target.id : path.startsWith("/areas") ? spareArea : path.startsWith("/categories") ? spareCategory : flow;
    // Who gets through each kind of access; everyone else is refused.
    const allowed: Record<Exclude<Access, "public">, (keyof typeof users)[]> = {
      account: ["inArea", "otherArea", "leader", "board", "owner"],
      user: ["inArea", "otherArea", "leader", "board", "owner"],
      flow: ["inArea", "leader", "board", "owner"],
      editor: ["board", "owner"],
      admin: ["board"],
      users: ["board"],
    };
    // Refused with 404 when the route is about a flow (nothing leaks about
    // it), 403 when it is about a permission.
    const refusal: Record<Exclude<Access, "public">, number> = { account: 0, user: 0, flow: 404, editor: 403, admin: 403, users: 403 };

    const routes = guardedRoutes(app).filter((r) => r.access !== "public");
    for (const { method, path, access } of routes) {
      if (access === "public") continue;
      const url = path.replace(/:id(\{[^}]*\})?/, String(idFor(path))).replace(/:value(\{[^}]*\})?/, String(spareValue)).replace(/:point(\{[^}]*\})?/, String(point));
      const label = `${method} ${url} (${access})`;
      expect(sentToLogin(await send(anonymous, method, url), method), `${label}: sin sesión`).toBe(true);
      const res = await send(pending.fetch, method, url);
      if (access === "account") expect(through(res), `${label}: temporal → ${res.status}`).toBe(true);
      else expect(sentToPasswordChange(res, method), `${label}: temporal → ${res.status}`).toBe(true);
      for (const [name, user] of Object.entries(users) as [keyof typeof users, Signed][]) {
        const res = await send(user.fetch, method, url);
        if (allowed[access].includes(name)) expect(through(res), `${label}: ${name} → ${res.status}`).toBe(true);
        else expect(res.status, `${label}: ${name}`).toBe(refusal[access]);
      }
    }
  });

  it("answers a hidden flow exactly as one that does not exist", async () => {
    await loadDevFlows(env.DB, [{ name: "Instalaciones", grid: instalaciones as Grid }]);
    const flow = (await env.DB.prepare("SELECT id FROM flows WHERE name = 'Instalaciones'").first<number>("id"))!;
    const outsider = await signIn({ username: "beto", role: "standard" });
    const hidden = await outsider.fetch(`/flows/${flow}`);
    const missing = await outsider.fetch(`/flows/${flow + 100}`);
    expect(hidden.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await hidden.text()).toBe(await missing.text());
  });

  it("shows nobody an unpublished flow in the viewer, the Board included", async () => {
    const created = await createFlow(env.DB, "Borrador");
    if (!created.ok) throw new Error(created.error);
    const board = await signIn();
    expect((await board.fetch(`/flows/${created.id}`)).status).toBe(404);
  });

  it("shows the Flujos, Áreas and Categorías links only to editors", async () => {
    const board = await signIn();
    const leader = await signIn({ username: "lia", role: "leader" });
    const boardHtml = await (await board.fetch("/home")).text();
    expect(boardHtml).toContain('<a href="/flows">Flujos</a>');
    expect(boardHtml).toContain('<a href="/areas">Áreas</a>');
    expect(boardHtml).toContain('<a href="/categories">Categorías</a>');
    const leaderHtml = await (await leader.fetch("/home")).text();
    expect(leaderHtml).not.toContain('href="/flows"');
    expect(leaderHtml).not.toContain('href="/areas"');
    expect(leaderHtml).not.toContain('href="/categories"');
  });

  it("refuses the admin layer without can_view_admin_layer, whatever the role", async () => {
    const test = new Hono<AppEnv>();
    test.use(loadSession);
    test.use(renderer);
    test.route("/", new Router().get("/capa", "admin", (c) => c.text("capa")).app);
    const leader = await signIn({ username: "lia", role: "leader" });
    const board = await signIn();
    const get = (cookie: string) => test.request("/capa", { headers: { cookie } }, env);
    expect((await get(leader.cookie)).status).toBe(403);
    expect(await (await get(board.cookie)).text()).toBe("capa");
    // The flag decides, not the role.
    await env.DB.prepare("UPDATE users SET can_view_admin_layer = 1 WHERE id = ?").bind(leader.id).run();
    expect(await (await get(leader.cookie)).text()).toBe("capa");
  });
});

describe("a route cannot exist without its access", () => {
  it("refuses a route added with Hono directly, wherever it is mounted", () => {
    const sub = new Hono<AppEnv>();
    sub.get("/abierta", (c) => c.text("sin guardia"));
    const root = new Hono<AppEnv>();
    root.use(loadSession);
    root.route("/", new Router().get("/", "user", (c) => c.text("ok")).app);
    root.route("/x", sub);
    expect(() => assertGuarded(root)).toThrow("La ruta GET /x/abierta no declara su acceso");
  });

  it("refuses app.all on a path, which is a route and not middleware", () => {
    const root = new Hono<AppEnv>();
    root.all("/todo", (c) => c.text("sin guardia"));
    expect(() => assertGuarded(root)).toThrow("La ruta ALL /todo no declara su acceso");
  });

  it("accepts middleware and the routes of a Router", () => {
    const root = new Hono<AppEnv>();
    root.use(loadSession);
    root.use("/flows/*", loadSession);
    root.route("/", new Router().get("/a", "user", (c) => c.text("a")).post("/a", "editor", (c) => c.text("a")).app);
    expect(guardedRoutes(root)).toEqual([
      { method: "GET", path: "/a", access: "user" },
      { method: "POST", path: "/a", access: "editor" },
    ]);
  });
});
