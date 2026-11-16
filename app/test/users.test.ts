import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { nameKey } from "../src/names.ts";
import { createUser, LAST_MANAGER, saveUser, setActive, type NewUser } from "../src/users.ts";

async function area(name: string) {
  return (await env.DB.prepare("INSERT INTO areas (name, name_key) VALUES (?, ?)").bind(name, nameKey(name)).run()).meta.last_row_id;
}

const base: NewUser = { username: "ana", fullName: "Ana Pérez", passwordHash: "x", role: "standard", areaIds: [] };

async function areasOf(userId: number) {
  const { results } = await env.DB.prepare("SELECT area_id FROM user_areas WHERE user_id = ? ORDER BY area_id").bind(userId).all<{ area_id: number }>();
  return results.map((r) => r.area_id);
}

const userCount = () => env.DB.prepare("SELECT count(*) AS n FROM users").first<number>("n");

describe("users and areas (SPEC §4)", () => {
  it("refuses a Standard user with no area, and writes nothing", async () => {
    const res = await createUser(env.DB, base);
    expect(res).toEqual({ ok: false, error: "Un usuario Empleado necesita al menos un área: sin ella no ve ningún flujo." });
    expect(await userCount()).toBe(0);
  });

  it("accepts a Leader and a Board member with no area", async () => {
    expect(await createUser(env.DB, { ...base, username: "lider", role: "leader" })).toMatchObject({ ok: true });
    expect(await createUser(env.DB, { ...base, username: "junta", role: "board" })).toMatchObject({ ok: true });
    expect(await userCount()).toBe(2);
  });

  it("creates a Standard user in two areas", async () => {
    const [a, b] = [await area("Operaciones"), await area("Compras")];
    const res = await createUser(env.DB, { ...base, areaIds: [a, b, a] });
    if (!res.ok) throw new Error(res.error);
    expect(await areasOf(res.id)).toEqual([a, b].sort());
  });

  it("refuses to save a Standard user with every area removed", async () => {
    const a = await area("Operaciones");
    const res = await createUser(env.DB, { ...base, areaIds: [a] });
    if (!res.ok) throw new Error(res.error);
    const saved = await saveUser(env.DB, res.id, { fullName: "Ana", role: "standard", areaIds: [] });
    expect(saved.ok).toBe(false);
    expect(await areasOf(res.id)).toEqual([a]);
    // The same user may drop every area once promoted to Leader.
    expect(await saveUser(env.DB, res.id, { fullName: "Ana", role: "leader", areaIds: [] })).toMatchObject({ ok: true });
    expect(await areasOf(res.id)).toEqual([]);
  });

  it("refuses a username that differs only in case or accents", async () => {
    const a = await area("Operaciones");
    await createUser(env.DB, { ...base, username: "José", areaIds: [a] });
    const res = await createUser(env.DB, { ...base, username: "JOSE", areaIds: [a] });
    expect(res).toEqual({ ok: false, error: "Ya existe el usuario «jose». Los nombres se comparan sin mayúsculas ni tildes." });
  });

  it("leaves no user behind when an area does not exist", async () => {
    const res = await createUser(env.DB, { ...base, areaIds: [999] });
    expect(res).toEqual({ ok: false, error: "Una de las áreas elegidas ya no existe." });
    expect(await userCount()).toBe(0);
  });
});

// SPEC §4: at least one active account always holds can_manage_users. The
// rule lives in the database (trigger of migration 0006), so every way of
// writing obeys it; these tests go through src/users.ts, then raw SQL.
describe("the last active user manager (SPEC §4)", () => {
  const manager = (username: string) =>
    createUser(env.DB, { ...base, username, role: "board", canEdit: true, canViewAdminLayer: true, canManageUsers: true }).then((r) => {
      if (!r.ok) throw new Error(r.error);
      return r.id;
    });
  const board = { fullName: "Ana", role: "board" as const, areaIds: [], canEdit: true, canViewAdminLayer: true };
  const flags = (id: number) => env.DB.prepare("SELECT can_manage_users, is_active FROM users WHERE id = ?").bind(id).first();

  it("refuses to take the permission from the last one, and changes nothing", async () => {
    const ana = await manager("ana");
    expect(await saveUser(env.DB, ana, { ...board, fullName: "Otro nombre", canManageUsers: false })).toEqual({ ok: false, error: LAST_MANAGER });
    expect(await flags(ana)).toEqual({ can_manage_users: 1, is_active: 1 });
    // The rest of the save was rolled back with it.
    expect(await env.DB.prepare("SELECT full_name FROM users WHERE id = ?").bind(ana).first("full_name")).toBe("Ana Pérez");
  });

  it("refuses to deactivate the last one", async () => {
    const ana = await manager("ana");
    expect(await setActive(env.DB, ana, false)).toEqual({ ok: false, error: LAST_MANAGER });
    expect(await flags(ana)).toEqual({ can_manage_users: 1, is_active: 1 });
  });

  it("allows both once another active account holds it", async () => {
    const ana = await manager("ana");
    const beto = await manager("beto");
    expect(await saveUser(env.DB, ana, { ...board, canManageUsers: false })).toEqual({ ok: true, id: ana });
    // Beto is now the last one.
    expect(await setActive(env.DB, beto, false)).toEqual({ ok: false, error: LAST_MANAGER });
    await saveUser(env.DB, ana, { ...board, canManageUsers: true });
    expect(await setActive(env.DB, beto, false)).toEqual({ ok: true, id: beto });
    expect(await flags(beto)).toEqual({ can_manage_users: 1, is_active: 0 });
  });

  it("does not count a deactivated account as the other one", async () => {
    const ana = await manager("ana");
    const beto = await manager("beto");
    await setActive(env.DB, beto, false);
    expect(await saveUser(env.DB, ana, { ...board, canManageUsers: false })).toEqual({ ok: false, error: LAST_MANAGER });
    expect(await setActive(env.DB, ana, false)).toEqual({ ok: false, error: LAST_MANAGER });
  });

  it("holds against raw SQL too, both columns at once included", async () => {
    const ana = await manager("ana");
    await expect(env.DB.prepare("UPDATE users SET can_manage_users = 0 WHERE id = ?").bind(ana).run()).rejects.toThrow(/last active user manager/);
    await expect(env.DB.prepare("UPDATE users SET is_active = 0, can_manage_users = 0 WHERE id = ?").bind(ana).run()).rejects.toThrow(/last active user manager/);
    // Removing it from everyone at once leaves nobody: refused as well.
    await manager("beto");
    await expect(env.DB.prepare("UPDATE users SET can_manage_users = 0").run()).rejects.toThrow(/last active user manager/);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM users WHERE can_manage_users = 1").first("n")).toBe(2);
  });

  it("closes the sessions of a deactivated account", async () => {
    await manager("ana");
    const beto = await manager("beto");
    await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES ('s', ?, '2999-01-01T00:00:00.000Z')").bind(beto).run();
    expect(await setActive(env.DB, beto, false)).toEqual({ ok: true, id: beto });
    expect(await env.DB.prepare("SELECT count(*) AS n FROM sessions").first("n")).toBe(0);
  });
});
