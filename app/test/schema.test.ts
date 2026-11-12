import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { nameKey } from "../src/names";

const TABLES = [
  "areas", "drafts", "flow_areas", "flows", "releases", "review_records",
  "save_points", "sessions", "tag_categories", "tags", "tour_visits", "user_areas", "users",
];

const run = (sql: string, ...params: unknown[]) => env.DB.prepare(sql).bind(...params).run();

async function seedFlow(name = "F", colour = 1) {
  return (await run("INSERT INTO flows (name, name_key, colour) VALUES (?, ?, ?)", name, nameKey(name), colour)).meta.last_row_id;
}

async function seedUser(username = "ana", role = "standard") {
  return (await run("INSERT INTO users (username, full_name, password_hash, role) VALUES (?, 'Ana', 'x', ?)", username, role)).meta.last_row_id;
}

async function seedArea(name = "Operaciones") {
  return (await run("INSERT INTO areas (name, name_key) VALUES (?, ?)", name, nameKey(name))).meta.last_row_id;
}

describe("schema", () => {
  it("creates every table", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(TABLES);
  });

  it("enforces foreign keys", async () => {
    const user = await seedUser();
    await expect(run("INSERT INTO user_areas (user_id, area_id) VALUES (?, 999)", user)).rejects.toThrow(/FOREIGN KEY/);
  });

  it("refuses an area that is still referenced", async () => {
    const area = await seedArea();
    const user = await seedUser();
    await run("INSERT INTO user_areas (user_id, area_id) VALUES (?, ?)", user, area);
    await expect(run("DELETE FROM areas WHERE id = ?", area)).rejects.toThrow(/FOREIGN KEY/);
  });

  it("allows only the three roles", async () => {
    await expect(seedUser("ana", "admin")).rejects.toThrow(/CHECK/);
  });

  it("keeps names unique ignoring case and accents", async () => {
    await seedArea("Diseño");
    await expect(seedArea("DISEÑO")).rejects.toThrow(/UNIQUE/);
    await expect(seedArea("Diseno")).rejects.toThrow(/UNIQUE/);
    await expect(seedArea("Almacén")).resolves.toBeTypeOf("number");
    await expect(seedArea("almacen")).rejects.toThrow(/UNIQUE/);
    await seedFlow("Apertura de OT");
    await expect(seedFlow("APERTURA DE OT")).rejects.toThrow(/UNIQUE/);
  });

  it("builds the name key without case or accents, the eñe included", () => {
    expect(nameKey("  ÁREA Ñandú ")).toBe("area nandu");
    expect(nameKey("Diseño")).toBe(nameKey("Diseno"));
    expect(nameKey("Almace\u0301n")).toBe(nameKey("Almacén")); // decomposed é
    expect(nameKey("Pingüino")).toBe("pinguino");
  });

  it("lets a user belong to several areas, to none, but not twice to one", async () => {
    const [a, b] = [await seedArea("Operaciones"), await seedArea("Compras")];
    const ana = await seedUser("ana");
    await seedUser("junta", "board"); // no area at all
    await run("INSERT INTO user_areas (user_id, area_id) VALUES (?, ?), (?, ?)", ana, a, ana, b);
    await expect(run("INSERT INTO user_areas (user_id, area_id) VALUES (?, ?)", ana, a)).rejects.toThrow(/UNIQUE|PRIMARY/);
    const { results } = await env.DB.prepare(
      "SELECT u.username, count(ua.area_id) AS n FROM users u LEFT JOIN user_areas ua ON ua.user_id = u.id GROUP BY u.id ORDER BY u.username",
    ).all();
    expect(results).toEqual([{ username: "ana", n: 2 }, { username: "junta", n: 0 }]);
    await run("DELETE FROM users WHERE id = ?", ana); // cascades to user_areas
    expect(await env.DB.prepare("SELECT count(*) AS n FROM user_areas").first("n")).toBe(0);
  });

  it("limits the flow colour to the 12 palette slots", async () => {
    await expect(seedFlow("X", 13)).rejects.toThrow(/CHECK/);
    await expect(seedFlow("X", 0)).rejects.toThrow(/CHECK/);
  });

  it("stores documents only as valid JSON", async () => {
    const flow = await seedFlow();
    await expect(run("INSERT INTO drafts (flow_id, document) VALUES (?, 'not json')", flow)).rejects.toThrow(/CHECK/);
    await run("INSERT INTO drafts (flow_id, document) VALUES (?, ?)", flow, JSON.stringify({ steps: [] }));
    await expect(run("INSERT INTO drafts (flow_id, document) VALUES (?, '{}')", flow)).rejects.toThrow(/UNIQUE|PRIMARY/);
  });

  it("keeps one release per version and links visits and reviews to it", async () => {
    const user = await seedUser();
    const flow = await seedFlow();
    const doc = JSON.stringify({ steps: [] });
    const release = (await run("INSERT INTO releases (flow_id, major, minor, document) VALUES (?, 1, 0, ?)", flow, doc)).meta.last_row_id;
    await expect(run("INSERT INTO releases (flow_id, major, minor, document) VALUES (?, 1, 0, ?)", flow, doc)).rejects.toThrow(/UNIQUE/);
    await run("INSERT INTO tour_visits (user_id, release_id, step_path, exit_index) VALUES (?, ?, 'P6>S3', 1)", user, release);
    await run("INSERT INTO review_records (user_id, release_id, duration_seconds) VALUES (?, ?, 150)", user, release);
    await expect(run("INSERT INTO review_records (user_id, release_id, duration_seconds) VALUES (?, ?, 200)", user, release)).rejects.toThrow(/UNIQUE/);
    await expect(run("DELETE FROM releases WHERE id = ?", release)).rejects.toThrow(/FOREIGN KEY/);
  });
});
