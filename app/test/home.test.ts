import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("GET /", () => {
  it("renders the base page with the theme and the logo", async () => {
    const res = await exports.default.fetch("http://example.com/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="es-CO">');
    expect(html).toContain('href="/theme.css"');
    expect(html).toContain('src="/flowhow_logotype.svg"');
    expect(html).toContain('<h1 class="page-title">FlowHow</h1>');
  });
});
