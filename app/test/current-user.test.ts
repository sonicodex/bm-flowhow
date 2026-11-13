import { env } from "cloudflare:test";
import type { Context } from "hono";
import { describe, expect, it } from "vitest";
import { currentUser } from "../src/current-user.ts";

const context = { env: { DB: env.DB } } as unknown as Context<{ Bindings: Env }>;

describe("currentUser (placeholder until phase 4)", () => {
  it("creates the placeholder user on first use and returns the same one after", async () => {
    const first = await currentUser(context);
    expect(first.fullName).toBe("Usuario de prueba");
    expect(await currentUser(context)).toEqual(first);
    const row = await env.DB.prepare("SELECT username, password_hash, role FROM users").all();
    expect(row.results).toEqual([{ username: "usuario de prueba", password_hash: "", role: "standard" }]);
  });
});
