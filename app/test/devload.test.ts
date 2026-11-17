import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import apertura from "../../reference/Flujo_Apertura_OT.grid.json";
import { loadDevAccounts, loadDevFlows, type DevFlow } from "../src/devload.ts";
import { verifyPassword } from "../src/password.ts";

const db = () => env.DB;
const FLOWS: DevFlow[] = [
  { name: "Instalaciones", grid: instalaciones as Grid },
  { name: "Apertura de OT", grid: apertura as Grid },
];
const versions = async () =>
  (
    await db()
      .prepare("SELECT f.name, r.major || '.' || r.minor AS v FROM releases r JOIN flows f ON f.id = r.flow_id ORDER BY r.id")
      .all<{ name: string; v: string }>()
  ).results.map((r) => `${r.name} ${r.v}`);
const count = async (table: string) => (await db().prepare(`SELECT count(*) AS n FROM ${table}`).first<number>("n"))!;

describe("loadDevFlows", () => {
  it("publishes both reference flows in 1.0, in the Desarrollo area", async () => {
    expect(await loadDevFlows(db(), FLOWS)).toEqual(["Instalaciones: publicado en 1.0.", "Apertura de OT: publicado en 1.0."]);
    expect(await versions()).toEqual(["Instalaciones 1.0", "Apertura de OT 1.0"]);
    expect(await count("flow_areas")).toBe(2);
    expect(await db().prepare("SELECT name FROM areas").first<string>("name")).toBe("Desarrollo");
    const ot = await db().prepare("SELECT document FROM releases r JOIN flows f ON f.id = r.flow_id WHERE f.name = 'Apertura de OT'").first<string>("document");
    const inst = await db().prepare("SELECT id FROM flows WHERE name = 'Instalaciones'").first<number>("id");
    expect(JSON.parse(ot!).steps.find((s: { id: string }) => s.id === "P13").ref).toBe(inst);
    expect(await count("drafts")).toBe(0);
  });

  it("loads in any order: the link target only has to exist", async () => {
    await loadDevFlows(db(), [...FLOWS].reverse());
    expect(await versions()).toEqual(["Apertura de OT 1.0", "Instalaciones 1.0"]);
  });

  it("creates no version, flow, area, tag or save point when loaded again", async () => {
    await loadDevFlows(db(), FLOWS);
    const before = await Promise.all(["flows", "areas", "flow_areas", "tag_categories", "tags", "releases"].map(count));
    expect(await loadDevFlows(db(), FLOWS)).toEqual(["Instalaciones: sin cambios, sigue en 1.0.", "Apertura de OT: sin cambios, sigue en 1.0."]);
    expect(await Promise.all(["flows", "areas", "flow_areas", "tag_categories", "tags", "releases"].map(count))).toEqual(before);
    expect(await count("save_points")).toBe(0);
    expect(await count("drafts")).toBe(0);
  });

  it("publishes a minor version when a reference grid changed", async () => {
    await loadDevFlows(db(), FLOWS);
    const changed = structuredClone(instalaciones) as Grid;
    changed.rows[0]!.description += " (revisado)";
    expect(await loadDevFlows(db(), [{ name: "Instalaciones", grid: changed }, FLOWS[1]!])).toEqual([
      "Instalaciones: publicado en 1.1.",
      "Apertura de OT: sin cambios, sigue en 1.0.",
    ]);
  });

  it("stops with the row messages when a grid cannot be imported", async () => {
    const broken = structuredClone(instalaciones) as Grid;
    broken.rows[1]!.id = "";
    await expect(loadDevFlows(db(), [{ name: "Instalaciones", grid: broken }])).rejects.toThrow("Instalaciones: la importación se bloqueó.\nFila 3: no tiene ID, y sin él ningún otro paso puede llevar a este.");
    expect(await count("releases")).toBe(0);
  });
});

describe("loadDevAccounts (phase 4.1)", () => {
  it("creates one account per role with DEV_PASSWORD, once", async () => {
    await loadDevFlows(db(), FLOWS);
    expect(await loadDevAccounts(db(), "clave de desarrollo")).toEqual([
      "Cuenta «empleado»: creada.",
      "Cuenta «lider»: creada.",
      "Cuenta «junta»: creada.",
    ]);
    const { results } = await db()
      .prepare(
        `SELECT u.username, u.role, u.can_edit, u.can_view_admin_layer, u.can_manage_users, group_concat(a.name) AS areas, u.password_hash
         FROM users u LEFT JOIN user_areas ua ON ua.user_id = u.id LEFT JOIN areas a ON a.id = ua.area_id
         GROUP BY u.id ORDER BY u.id`,
      )
      .all<Record<string, unknown>>();
    expect(results.map(({ password_hash, ...r }) => r)).toEqual([
      { username: "empleado", role: "standard", can_edit: 0, can_view_admin_layer: 0, can_manage_users: 0, areas: "Desarrollo" },
      { username: "lider", role: "leader", can_edit: 0, can_view_admin_layer: 0, can_manage_users: 0, areas: "Desarrollo" },
      { username: "junta", role: "board", can_edit: 1, can_view_admin_layer: 1, can_manage_users: 1, areas: null },
    ]);
    for (const r of results) expect(await verifyPassword("clave de desarrollo", r.password_hash as string)).toBe(true);
    expect(await loadDevAccounts(db(), "otra clave larga")).toEqual([
      "Cuenta «empleado»: ya existe.",
      "Cuenta «lider»: ya existe.",
      "Cuenta «junta»: ya existe.",
    ]);
    expect(await count("users")).toBe(3);
  });

  it("creates none without a usable DEV_PASSWORD, and says how to fix it", async () => {
    await loadDevFlows(db(), FLOWS);
    expect(await loadDevAccounts(db(), undefined)).toEqual(["Cuentas de prueba: no se crearon. Pon DEV_PASSWORD en app/.dev.vars y vuelve a cargar."]);
    expect(await loadDevAccounts(db(), "corta")).toEqual(["Cuentas de prueba: no se crearon. DEV_PASSWORD: La contraseña necesita al menos 8 caracteres."]);
    expect(await count("users")).toBe(0);
  });
});
