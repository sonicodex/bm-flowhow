import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const post = (name: string) =>
  exports.default.fetch("http://example.com/areas", {
    method: "POST",
    body: new URLSearchParams({ name }),
    redirect: "manual",
  });

describe("/areas", () => {
  it("shows the empty state", async () => {
    const res = await exports.default.fetch("http://example.com/areas");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Todavía no hay áreas.");
  });

  it("writes an area to D1 and lists it", async () => {
    const res = await post("  Operaciones  ");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/areas");
    const row = await env.DB.prepare("SELECT name FROM areas").first<{ name: string }>();
    expect(row?.name).toBe("Operaciones");
    expect(await (await exports.default.fetch("http://example.com/areas")).text()).toContain("<li>Operaciones</li>");
  });

  it("refuses a duplicate name, whatever the case", async () => {
    await post("Almacén");
    const res = await post("ALMACÉN");
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("Ya existe un área llamada «ALMACÉN».");
    const { results } = await env.DB.prepare("SELECT name FROM areas").all();
    expect(results).toHaveLength(1);
  });

  it("refuses a blank name", async () => {
    const res = await post("   ");
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("Escribe el nombre del área.");
  });
});
