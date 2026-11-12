import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run inside the Workers runtime with the bindings from wrangler.jsonc,
// against a real local D1 with the project's migrations applied.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // node:assert for the rules module's tests (test/core.test.js).
        compatibilityFlags: ["nodejs_compat"],
        bindings: { TEST_MIGRATIONS: await readD1Migrations("./migrations") },
      },
    })),
  ],
  test: { setupFiles: ["./test/apply-migrations.ts"] },
});
