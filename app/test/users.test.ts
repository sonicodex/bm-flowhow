import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { nameKey } from "../src/names.ts";
import { createUser, saveUser, type NewUser } from "../src/users.ts";

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
