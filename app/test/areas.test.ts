import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { signIn, type Signed } from "./session.ts";

let board: Signed;
beforeEach(async () => {
  board = await signIn();
});

const post = (name: string) => board.fetch("/areas", { method: "POST", body: new URLSearchParams({ name }) });

describe("/areas", () => {
  it("shows the empty state", async () => {
    const res = await board.fetch("/areas");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Todavía no hay áreas.");
  });

  it("writes an area to D1 and lists it", async () => {
    const res = await post("  Operaciones  ");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/areas");
    const row = await env.DB.prepare("SELECT name FROM areas").first<{ name: string }>();
    expect(row?.name).toBe("Operaciones");
    expect(await (await board.fetch("/areas")).text()).toContain("<li>Operaciones</li>");
  });

  it("refuses a duplicate name ignoring case and accents, and says why", async () => {
    await post("Diseño");
    const res = await post("DISENO");
    expect(res.status).toBe(422);
    expect(await res.text()).toContain(
      "Ya existe un área llamada «Diseño». Los nombres se comparan sin mayúsculas ni tildes.",
    );
    const { results } = await env.DB.prepare("SELECT name FROM areas").all();
    expect(results).toHaveLength(1);
  });

  it("refuses a blank name", async () => {
    const res = await post("   ");
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("Escribe el nombre del área.");
  });
});
