import { readFileSync } from "node:fs";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// The reference .xlsx files, base64-encoded: tests run inside workerd and
// cannot read the disk themselves.
const XLSX_FIXTURES = Object.fromEntries(
  ["Flujo_Instalaciones.xlsx", "Flujo_Instalaciones.resaved.xlsx", "Flujo_Apertura_OT.xlsx"].map((name) => [
    name,
    readFileSync(`../reference/${name}`).toString("base64"),
  ]),
);

// Tests run inside the Workers runtime with the bindings from wrangler.jsonc,
// against a real local D1 with the project's migrations applied.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // node:assert for the rules module's tests (test/core.test.js).
        compatibilityFlags: ["nodejs_compat"],
        bindings: { TEST_MIGRATIONS: await readD1Migrations("./migrations"), XLSX_FIXTURES },
      },
    })),
  ],
  test: { setupFiles: ["./test/apply-migrations.ts"] },
});
