import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { nameKey } from "../src/names";

const TABLES = [
  "areas", "drafts", "flow_areas", "flows", "releases", "review_records",
  "save_points", "sessions", "tag_categories", "tags", "tour_visits", "users",
];

const run = (sql: string, ...params: unknown[]) => env.DB.prepare(sql).bind(...params).run();

async function seedFlow(name = "F", colour = 1) {
  return (await run("INSERT INTO flows (name, name_key, colour) VALUES (?, ?, ?)", name, nameKey(name), colour)).meta.last_row_id;
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
    await expect(
      run("INSERT INTO users (username, full_name, password_hash, area_id) VALUES ('ana', 'Ana', 'x', 999)"),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it("refuses an area that is still referenced", async () => {
    const area = await seedArea();
    await run("INSERT INTO users (username, full_name, password_hash, area_id) VALUES ('ana', 'Ana', 'x', ?)", area);
    await expect(run("DELETE FROM areas WHERE id = ?", area)).rejects.toThrow(/FOREIGN KEY/);
  });

  it("allows only the three roles", async () => {
    const area = await seedArea();
    await expect(
      run("INSERT INTO users (username, full_name, password_hash, role, area_id) VALUES ('ana', 'Ana', 'x', 'admin', ?)", area),
    ).rejects.toThrow(/CHECK/);
  });

  it("keeps names unique regardless of case, accented letters included", async () => {
    await seedArea("Almacén");
    await expect(seedArea("ALMACÉN")).rejects.toThrow(/UNIQUE/);
    await seedArea("Almacen"); // accents still count
    await seedFlow("Apertura de OT");
    await expect(seedFlow("APERTURA DE OT")).rejects.toThrow(/UNIQUE/);
  });

  it("builds the name key with Spanish case rules and NFC", () => {
    expect(nameKey("  ÁREA Ñandú ")).toBe("área ñandú");
    expect(nameKey("Almace\u0301n")).toBe(nameKey("Almacén")); // decomposed é
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
    const area = await seedArea();
    const user = (await run("INSERT INTO users (username, full_name, password_hash, area_id) VALUES ('ana', 'Ana', 'x', ?)", area)).meta.last_row_id;
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
