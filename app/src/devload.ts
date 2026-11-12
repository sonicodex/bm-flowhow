import type { Grid } from "../public/js/core.js";
import { createFlow } from "./flows.ts";
import { applyGrid, documentFor, reviewGrid } from "./import.ts";
import { nameKey } from "./names.ts";
import { publishFlow } from "./publish.ts";

// Development only: loads the reference flows through the real import and
// publish contract (SPEC §11 phase 1), accepting every new category and tag.
// Idempotent: a flow whose latest release already holds this grid is left
// alone, so loading again creates no version.

export type DevFlow = { name: string; grid: Grid };

// The reference flows have no area yet ("[POR DEFINIR]"); the first
// publication needs one (SPEC §6).
const DEV_AREA = "Desarrollo";

export async function loadDevFlows(db: D1Database, flows: DevFlow[]): Promise<string[]> {
  const report: string[] = [];
  await db
    .prepare("INSERT INTO areas (name, name_key) VALUES (?, ?) ON CONFLICT (name_key) DO NOTHING")
    .bind(DEV_AREA, nameKey(DEV_AREA))
    .run();

  // Every flow exists before any grid is read, so links between them resolve
  // whatever the order (a link only needs its target to exist).
  const ids: number[] = [];
  for (const f of flows) {
    let id = await db.prepare("SELECT id FROM flows WHERE name_key = ?").bind(nameKey(f.name)).first<number>("id");
    if (id === null) {
      const created = await createFlow(db, f.name);
      if (!created.ok) throw new Error(created.error);
      id = created.id;
    }
    ids.push(id);
  }

  for (const [i, f] of flows.entries()) {
    const id = ids[i]!;
    const latest = await db
      .prepare("SELECT major, minor, document FROM releases WHERE flow_id = ? ORDER BY major DESC, minor DESC LIMIT 1")
      .bind(id)
      .first<{ major: number; minor: number; document: string }>();
    const doc = await documentFor(db, id, f.grid);
    if (latest && doc && JSON.stringify(doc) === latest.document) {
      report.push(`${f.name}: sin cambios, sigue en ${latest.major}.${latest.minor}.`);
      continue;
    }

    const review = await reviewGrid(db, id, f.grid);
    const applied = await applyGrid(db, id, f.grid, { categories: review.newCategories, tags: review.newTags });
    if (!applied.ok) throw new Error(`${f.name}: la importación se bloqueó.\n${applied.errors.map((e) => e.message).join("\n")}`);
    if (!latest) {
      await db
        .prepare("INSERT INTO flow_areas (flow_id, area_id) SELECT ?, id FROM areas WHERE name_key = ? ON CONFLICT DO NOTHING")
        .bind(id, nameKey(DEV_AREA))
        .run();
    }
    const published = await publishFlow(db, id, "minor");
    if (!published.ok) throw new Error(`${f.name}: no se pudo publicar.\n${published.errors.map((e) => e.message).join("\n")}`);
    report.push(`${f.name}: publicado en ${published.version}.`);
  }
  return report;
}
