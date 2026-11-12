// Loads the reference flows into the local D1 and publishes them, through the
// same import and publish code the Worker runs (src/devload.ts). Run from
// app/ after `npm run db:migrate`:  npm run db:load
// Loading again changes nothing unless a reference grid changed.
import { readFileSync } from "node:fs";
import { getPlatformProxy } from "wrangler";
import type { Grid } from "../public/js/core.js";
import { loadDevFlows } from "../src/devload.ts";

const grid = (file: string): Grid => JSON.parse(readFileSync(new URL(`../../reference/${file}`, import.meta.url), "utf8"));

const proxy = await getPlatformProxy<Env>({ configPath: "wrangler.jsonc" });
try {
  const report = await loadDevFlows(proxy.env.DB, [
    { name: "Instalaciones", grid: grid("Flujo_Instalaciones.grid.json") },
    { name: "Apertura de OT", grid: grid("Flujo_Apertura_OT.grid.json") },
  ]);
  console.log(report.join("\n"));
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await proxy.dispose();
}
