import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createFlow } from "../src/flows.ts";
import { verifyPassword } from "../src/password.ts";
import { PASSWORD_FILE_NOTES } from "../src/users-screen.tsx";
import { signIn, withSession, type Signed } from "./session.ts";

let board: Signed;
beforeEach(async () => {
  board = await signIn();
});

const HEAD = ["Usuario", "Nombre completo", "Rol", "Áreas"];
const send = (path: string, body: unknown, who = board) =>
  who.fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const review = async (rows: string[][]) => (await send("/users/import/review", { table: [HEAD, ...rows] })).json<Record<string, any>>();
const addArea = async (name: string, key: string) =>
  (await env.DB.prepare("INSERT INTO areas (name, name_key) VALUES (?, ?) RETURNING id").bind(name, key).first<number>("id"))!;
const accounts = async () =>
  (
    await env.DB.prepare(
      `SELECT u.username, u.full_name, u.role, u.can_edit, u.can_manage_users, u.must_change_password,
         (SELECT group_concat(a.name, ', ') FROM user_areas ua JOIN areas a ON a.id = ua.area_id WHERE ua.user_id = u.id) AS areas
       FROM users u WHERE u.username <> 'board' ORDER BY u.username`,
    ).all()
  ).results;

describe("user importer (phase 7.2)", () => {
  it("offers the importer beside «Nuevo usuario», with a template whose Rol column is a list", async () => {
    expect(await (await board.fetch("/users")).text()).toContain('<a class="button-secondary" href="/users/import">Importar usuarios</a>');
    const page = await (await board.fetch("/users/import")).text();
    const config = JSON.parse(page.match(/<script type="application\/json" id="import-data">([^<]*)<\/script>/)![1]!);
    expect(config.sheet).toBe("Usuarios");
    expect(config.template.columns).toEqual(HEAD);
    expect(config.template.lists[0]).toMatchObject({ col: 2, values: ["Empleado", "Líder", "Junta directiva"] });
    expect(config.keepWarning).toContain("única vez");
  });

  it("reviews new accounts, roles and areas matched without case or accents", async () => {
    await addArea("Logística", "logistica");
    await addArea("Ventas", "ventas");
    const r = await review([
      ["Ana.Gomez", "Ana Gómez", "empleado", "logistica, VENTAS"],
      ["luis", "Luis Pérez", "LIDER", ""],
      ["marta", "Marta Ruiz", "Junta Directiva", ""],
    ]);
    expect(r.errors).toEqual([]);
    expect(r.summary).toBe("3 filas: 3 cuentas nuevas.");
    expect(r.groups[0].rows).toEqual([
      ["ana.gomez", "Ana Gómez", "Empleado", "Logística, Ventas"],
      ["luis", "Luis Pérez", "Líder", ""],
      ["marta", "Marta Ruiz", "Junta directiva", ""],
    ]);
    // Said, not blocking: Ana's areas have no published flow, Luis has no area.
    expect(r.warnings).toEqual([
      "Fila 2 (ana.gomez): sus áreas todavía no tienen flujos publicados, así que por ahora no verá ninguno.",
      "Fila 3 (luis): Este Líder no tiene áreas, así que no verá a nadie en el reporte de avance hasta que tenga una.",
    ]);
    expect(await accounts()).toEqual([]);
  });

  it("says nothing about flows when the Empleado's area has a published one", async () => {
    const area = await addArea("Ventas", "ventas");
    const created = await createFlow(env.DB, "Pedidos");
    const flow = created.ok ? created.id : 0;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO flow_areas (flow_id, area_id) VALUES (?, ?)").bind(flow, area),
      env.DB.prepare("INSERT INTO releases (flow_id, major, minor, document, published_by) VALUES (?, 1, 0, '{}', ?)").bind(flow, board.id),
    ]);
    expect((await review([["ana", "Ana", "Empleado", "Ventas"]])).warnings).toEqual([]);
  });

  it("names every problem of every row", async () => {
    await addArea("Ventas", "ventas");
    const r = await review([
      ["board", "Otra Junta", "Junta directiva", ""],
      ["ana", "", "Gerente", "Ventas"],
      ["Ána", "Ana Dos", "Empleado", "Bodega"],
      ["pedro", "Pedro", "Empleado", ""],
      ["sofia", "Sofía", "Junta directiva", "Ventas"],
      ["", "Sin usuario", "Líder", ""],
    ]);
    expect(r.errors.map((e: { message: string }) => e.message)).toEqual([
      "Fila 2: ya existe el usuario «board». Este importador solo crea cuentas. Los nombres se comparan sin mayúsculas ni tildes.",
      "Fila 3: le falta el nombre completo.",
      "Fila 3: el rol «Gerente» no existe: usa Empleado, Líder, Junta directiva.",
      "Fila 4: el usuario «Ána» ya está en la fila 3. Los nombres se comparan sin mayúsculas ni tildes.",
      "Fila 4: el área «Bodega» no existe. Créala antes con «Importar áreas».",
      "Fila 5: Un usuario Empleado necesita al menos un área: sin ella no ve ningún flujo.",
      "Fila 6: La Junta directiva no pertenece a ningún área: quítale las áreas marcadas.",
      "Fila 7: le falta el usuario.",
    ]);
    expect(r.summary).toBe("6 filas: 0 cuentas nuevas.");
  });

  it("refuses a file without the four columns", async () => {
    const res = await send("/users/import/review", { table: [["Usuario", "Nombre completo", "Rol"], ["ana", "Ana", "Líder"]] });
    expect(res.status).toBe(400);
    expect((await res.json<{ error: string }>()).error).toBe("Falta la columna «Áreas».");
  });

  it("creates the accounts with the role's permissions, each with a temporary password shown once", async () => {
    await addArea("Ventas", "ventas");
    const res = await send("/users/import", { table: [HEAD, ["ana", "Ana Gómez", "Empleado", "Ventas"], ["marta", "Marta Ruiz", "Junta directiva", ""]] });
    expect(res.status).toBe(200);
    const done = await res.json<Record<string, any>>();
    expect(done.title).toBe("Usuarios importados");
    expect(done.message).toBe("Se crearon 2 cuentas. Dale a cada persona su contraseña temporal; al entrar tendrá que cambiarla por una suya.");
    const [list] = done.groups;
    expect(list.columns).toEqual(["Usuario", "Nombre completo", "Contraseña temporal"]);
    expect(list.rows.map((r: string[]) => r.slice(0, 2))).toEqual([
      ["ana", "Ana Gómez"],
      ["marta", "Marta Ruiz"],
    ]);
    for (const [, , password] of list.rows) expect(password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    // The file says what it is, and that it is to be deleted.
    expect(done.download).toEqual({ name: "Contrasenas_temporales_FlowHow.xlsx", sheet: "Contraseñas", notes: PASSWORD_FILE_NOTES, columns: list.columns, rows: list.rows });
    expect(PASSWORD_FILE_NOTES.join(" ")).toMatch(/temporales.*cambiar.*primera vez.*Borra este archivo/);
    expect(await accounts()).toEqual([
      { username: "ana", full_name: "Ana Gómez", role: "standard", can_edit: 0, can_manage_users: 0, must_change_password: 1, areas: "Ventas" },
      { username: "marta", full_name: "Marta Ruiz", role: "board", can_edit: 1, can_manage_users: 1, must_change_password: 1, areas: null },
    ]);
    // The password works, and only to get to the change screen.
    const hash = (await env.DB.prepare("SELECT password_hash FROM users WHERE username = 'ana'").first<string>("password_hash"))!;
    expect(hash).toMatch(/^pbkdf2-sha256\$100\$/);
    expect(await verifyPassword(list.rows[0][2], hash)).toBe(true);
    const login = await withSession("")("/login", { method: "POST", body: new URLSearchParams({ username: "ana", password: list.rows[0][2] }) });
    expect(login.status).toBe(303);
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const home = await withSession(cookie)("/home");
    expect(home.headers.get("location")).toBe("/password");
    // Nothing keeps the list: the same file again is all row errors.
    const again = await (await send("/users/import/review", { table: [HEAD, ["ana", "Ana Gómez", "Empleado", "Ventas"]] })).json<Record<string, any>>();
    expect(again.errors[0].message).toMatch(/^Fila 2: ya existe el usuario «ana»/);
  });

  it("writes no account while a row is wrong", async () => {
    const res = await send("/users/import", { table: [HEAD, ["ana", "Ana", "Líder", ""], ["luis", "Luis", "Empleado", ""]] });
    expect(res.status).toBe(422);
    expect(await accounts()).toEqual([]);
  });

  it("is refused to a user without can_manage_users, even one who edits flows", async () => {
    const editor = await signIn({ username: "editor", role: "leader", permissions: { canEdit: true } });
    for (const path of ["/users/import/review", "/users/import"]) {
      expect((await send(path, { table: [HEAD, ["ana", "Ana", "Líder", ""]] }, editor)).status).toBe(403);
    }
    expect((await editor.fetch("/users/import")).status).toBe(403);
  });
});
