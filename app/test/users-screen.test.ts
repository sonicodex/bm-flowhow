import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import { loadDevFlows } from "../src/devload.ts";
import { nameKey } from "../src/names.ts";
import { verifyPassword } from "../src/password.ts";
import { COOKIE } from "../src/session.ts";
import { LAST_MANAGER } from "../src/users.ts";
import { LEADER_NO_AREAS_WARNING } from "../src/users-screen.tsx";
import { ORIGIN, signIn, withSession, type Signed } from "./session.ts";
import { tableRows } from "./table.ts";

let board: Signed;
beforeEach(async () => {
  board = await signIn({ username: "junta" });
});

type Fields = Record<string, string | string[]>;
const body = (fields: Fields) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) for (const one of Array.isArray(v) ? v : [v]) params.append(k, one);
  return params;
};
const post = (who: Signed, path: string, fields: Fields = {}) => who.fetch(path, { method: "POST", body: body(fields) });

async function area(name: string) {
  return (await env.DB.prepare("INSERT INTO areas (name, name_key) VALUES (?, ?) RETURNING id").bind(name, nameKey(name)).first<number>("id"))!;
}
const row = (username: string) =>
  env.DB.prepare(
    "SELECT id, role, can_edit, can_view_admin_layer, can_manage_users, must_change_password, is_active, password_hash FROM users WHERE username = ?",
  )
    .bind(username)
    .first<{
      id: number;
      role: string;
      can_edit: number;
      can_view_admin_layer: number;
      can_manage_users: number;
      must_change_password: number;
      is_active: number;
      password_hash: string;
    }>();
const tempPassword = (html: string) => html.match(/<code>([a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4})<\/code>/)?.[1];

const login = (username: string, password: string) =>
  exports.default.fetch(`${ORIGIN}/login`, { method: "POST", headers: { origin: ORIGIN }, body: new URLSearchParams({ username, password }), redirect: "manual" });
const cookieOf = (res: Response) => `${COOKIE}=${res.headers.get("set-cookie")!.match(new RegExp(`${COOKIE}=([^;]*)`))![1]}`;

async function create(fields: Fields) {
  const res = await post(board, "/users", fields);
  return { res, html: await res.text() };
}

describe("user screens (phase 4.4)", () => {
  it("are for can_manage_users only: a process owner with can_edit gets 403 and no link", async () => {
    const owner = await signIn({ username: "dueno", role: "leader", permissions: { canEdit: true } });
    expect((await owner.fetch("/users")).status).toBe(403);
    const ownerHome = await (await owner.fetch("/home")).text();
    expect(ownerHome).toContain('<a href="/areas">Áreas</a>');
    expect(ownerHome).not.toContain('href="/users"');
    expect(await (await board.fetch("/home")).text()).toContain('<a href="/users">Usuarios</a>');
  });

  it("creates an account with a temporary password and the role's permissions", async () => {
    const ops = await area("Operaciones");
    const { res, html } = await create({ username: "Andrés", fullName: "Andrés Gómez", role: "standard", area: String(ops) });
    expect(res.status).toBe(200);
    const password = tempPassword(html)!;
    expect(password).toBeDefined();
    expect(html).toContain("Esta es la única vez que se muestra.");
    const created = (await row("andres"))!;
    expect(created).toMatchObject({ role: "standard", can_edit: 0, can_view_admin_layer: 0, can_manage_users: 0, must_change_password: 1, is_active: 1 });
    // Only its hash is stored.
    expect(created.password_hash).not.toContain(password);
    expect(await verifyPassword(password, created.password_hash)).toBe(true);

    await create({ username: "marta", fullName: "Marta", role: "board" });
    expect(await row("marta")).toMatchObject({ can_edit: 1, can_view_admin_layer: 1, can_manage_users: 1 });
  });

  it("refuses an Empleado with no area and a Board member with one, and creates nothing", async () => {
    const ops = await area("Operaciones");
    let { res, html } = await create({ username: "ana", fullName: "Ana", role: "standard" });
    expect(res.status).toBe(422);
    expect(html).toContain("Un usuario Empleado necesita al menos un área");
    // What was typed stays.
    expect(html).toContain('value="ana"');
    ({ res, html } = await create({ username: "ana", fullName: "Ana", role: "board", area: String(ops) }));
    expect(res.status).toBe(422);
    expect(html).toContain("La Junta directiva no pertenece a ningún área");
    expect(await row("ana")).toBeNull();
  });

  it("warns, and still saves, when an Empleado's areas have no published flow", async () => {
    const ventas = await area("Ventas");
    const { res, html } = await create({ username: "ana", fullName: "Ana", role: "standard", area: String(ventas) });
    expect(res.status).toBe(200);
    expect(html).toContain("Sus áreas todavía no tienen flujos publicados, así que por ahora no verá ninguno.");
    const ana = (await row("ana"))!;

    // Saving again says it again; once a flow of hers is published, it stops.
    let saved = await post(board, `/users/${ana.id}`, { fullName: "Ana", role: "standard", area: String(ventas) });
    expect(saved.headers.get("location")).toBe(`/users/${ana.id}?guardado=1`);
    let page = await (await board.fetch(saved.headers.get("location")!)).text();
    expect(page).toContain("Cambios guardados.");
    expect(page).toContain("por ahora no verá ninguno");

    await loadDevFlows(env.DB, [{ name: "Instalaciones", grid: instalaciones as Grid }]);
    const dev = (await env.DB.prepare("SELECT id FROM areas WHERE name = 'Desarrollo'").first<number>("id"))!;
    saved = await post(board, `/users/${ana.id}`, { fullName: "Ana", role: "standard", area: [String(ventas), String(dev)] });
    page = await (await board.fetch(saved.headers.get("location")!)).text();
    expect(page).toContain("Cambios guardados.");
    expect(page).not.toContain("por ahora no verá ninguno");
    // A Leader sees every flow: never warned.
    const { html: leaderPage } = await create({ username: "lia", fullName: "Lía", role: "leader" });
    expect(leaderPage).not.toContain("no verá ninguno");
  });

  // Phase 6.9: a Leader may have no area (§4), but then shares one with
  // nobody and the progress report shows them no one. Said, not blocked.
  it("warns, and still saves, when a Leader has no area", async () => {
    const { res, html } = await create({ username: "lia", fullName: "Lía", role: "leader" });
    expect(res.status).toBe(200);
    expect(html).toContain(LEADER_NO_AREAS_WARNING);
    const lia = (await row("lia"))!;
    let saved = await post(board, `/users/${lia.id}`, { fullName: "Lía", role: "leader" });
    expect(await (await board.fetch(saved.headers.get("location")!)).text()).toContain(LEADER_NO_AREAS_WARNING);
    // With an area, it stops.
    const ventas = await area("Ventas");
    saved = await post(board, `/users/${lia.id}`, { fullName: "Lía", role: "leader", area: String(ventas) });
    expect(await (await board.fetch(saved.headers.get("location")!)).text()).not.toContain(LEADER_NO_AREAS_WARNING);
    // The Board belongs to no area, and is never warned.
    expect((await create({ username: "jd", fullName: "Junta", role: "board" })).html).not.toContain(LEADER_NO_AREAS_WARNING);
  });

  it("sets each permission on its own, and a role change leaves them alone", async () => {
    await create({ username: "dueno", fullName: "Dueño de proceso", role: "leader" });
    const id = (await row("dueno"))!.id;
    await post(board, `/users/${id}`, { fullName: "Dueño de proceso", role: "leader", canEdit: "1" });
    expect(await row("dueno")).toMatchObject({ can_edit: 1, can_view_admin_layer: 0, can_manage_users: 0 });
    await post(board, `/users/${id}`, { fullName: "Dueño de proceso", role: "board", canEdit: "1" });
    expect(await row("dueno")).toMatchObject({ role: "board", can_edit: 1, can_view_admin_layer: 0, can_manage_users: 0 });
  });

  it("refuses, through the screens, to leave nobody able to manage users", async () => {
    // The Board member is the only manager: unchecking it on themselves,
    // or deactivating themselves, is refused with the reason.
    let res = await post(board, `/users/${board.id}`, { fullName: "Junta", role: "board", canEdit: "1", canViewAdminLayer: "1" });
    expect(res.status).toBe(422);
    expect(await res.text()).toContain(LAST_MANAGER);
    res = await post(board, `/users/${board.id}/deactivate`);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain(LAST_MANAGER);
    expect(await row("junta")).toMatchObject({ can_manage_users: 1, is_active: 1 });
    // With a second manager, both go through.
    await create({ username: "marta", fullName: "Marta", role: "board" });
    res = await post(board, `/users/${board.id}`, { fullName: "Junta", role: "board", canEdit: "1", canViewAdminLayer: "1" });
    expect(res.status).toBe(303);
    expect(await row("junta")).toMatchObject({ can_manage_users: 0 });
    // Without the permission, the screens close to them at once.
    expect((await board.fetch("/users")).status).toBe(403);
  });

  it("hands over a temporary password that must be changed before anything else", async () => {
    const { html } = await create({ username: "lia", fullName: "Lía", role: "leader" });
    const temp = tempPassword(html)!;
    const signedIn = await login("lia", temp);
    expect(signedIn.status).toBe(303);
    const lia = withSession(cookieOf(signedIn));
    // Every screen sends her to the change screen first; no links on it.
    for (const path of ["/home", "/flows/1"]) {
      const res = await lia(path);
      expect(res.status, path).toBe(302);
      expect(res.headers.get("location"), path).toBe("/password");
    }
    const screen = await (await lia("/password")).text();
    expect(screen).toContain("Cambia tu contraseña");
    expect(screen).not.toContain('class="site-nav"');

    const change = (password: string, repeat = password) => lia("/password", { method: "POST", body: new URLSearchParams({ password, repeat }) });
    let res = await change("corta");
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("La contraseña necesita al menos 8 caracteres.");
    res = await change("una clave larga", "otra clave larga");
    expect(await res.text()).toContain("Las dos contraseñas no coinciden.");
    res = await change(temp);
    expect(await res.text()).toContain("Elige una contraseña distinta de la temporal.");
    expect((await row("lia"))!.must_change_password).toBe(1);

    res = await change("mi clave propia");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/home");
    expect((await lia("/home")).status).toBe(200);
    // Done: the screen now just goes home.
    expect((await lia("/password")).headers.get("location")).toBe("/home");
    const saved = (await row("lia"))!;
    expect(saved.must_change_password).toBe(0);
    expect(await verifyPassword("mi clave propia", saved.password_hash)).toBe(true);
  });

  it("resets a password: a new temporary one, the old one gone, every session closed", async () => {
    await create({ username: "lia", fullName: "Lía", role: "leader" });
    const id = (await row("lia"))!.id;
    await env.DB.prepare("UPDATE users SET must_change_password = 0 WHERE id = ?").bind(id).run();
    const before = (await row("lia"))!.password_hash;
    await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES ('abierta', ?, '2999-01-01T00:00:00.000Z')").bind(id).run();

    const res = await post(board, `/users/${id}/password`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Contraseña restablecida");
    const temp = tempPassword(html)!;
    const after = (await row("lia"))!;
    expect(after.password_hash).not.toBe(before);
    expect(after.must_change_password).toBe(1);
    expect(await verifyPassword(temp, after.password_hash)).toBe(true);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM sessions WHERE user_id = ?").bind(id).first("n")).toBe(0);
  });

  it("deactivates an account instead of deleting it, and reactivates it", async () => {
    const ana = await signIn({ username: "ana", role: "leader" });
    let res = await post(board, `/users/${ana.id}/deactivate`);
    expect(res.status).toBe(303);
    expect(await row("ana")).toMatchObject({ is_active: 0 });
    // Her open session is over, and the list says so.
    expect((await ana.fetch("/home")).headers.get("location")).toBe("/");
    const list = await (await board.fetch("/users")).text();
    expect(tableRows(list).find((r) => r[1] === "ana")).toEqual(["Nombre de ana", "ana", "Líder", "", "No", "Editar"]);
    expect(list).toContain('<tr class="inactive">');
    res = await post(board, `/users/${ana.id}/activate`);
    expect(res.status).toBe(303);
    expect(await row("ana")).toMatchObject({ is_active: 1 });
  });
});
