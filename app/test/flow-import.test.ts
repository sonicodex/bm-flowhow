import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import { createFlow } from "../src/flows.ts";
import { signIn, type Signed } from "./session.ts";

const db = () => env.DB;
const row = (id: string, type: string, extra: Partial<Grid["rows"][number]> = {}) => ({
  id, type, ref: "", title: "t" + id, description: "", tags: {}, exits: "", depends_on: "", ...extra,
});
const VALID: Grid = { categories: [], rows: [row("A", "start", { exits: "B" }), row("B", "end")] };
// A step id twice: the import cannot even be drafted.
const BLOCKED: Grid = { categories: [], rows: [row("A", "start", { exits: "B" }), row("B", "end"), row("B", "end")] };

let board: Signed;
beforeEach(async () => {
  board = await signIn();
});

const post = async (path: string, body: unknown, who = board) => {
  const res = await who.fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};
const flows = async () => (await db().prepare("SELECT name FROM flows ORDER BY id").all<{ name: string }>()).results.map((r) => r.name);

describe("«Importar flujo» on the flows screen (phase 8.3)", () => {
  it("is offered on the flows screen beside «Nuevo flujo», with the editor's reader and the template", async () => {
    const list = await (await board.fetch("/flows")).text();
    expect(list).toContain('<a class="button-secondary" href="/flows/import">Importar flujo</a>');
    const page = await (await board.fetch("/flows/import")).text();
    expect(page).toContain('<input id="import-name" name="name" required="" maxlength="100"/>');
    expect(page).toContain('<input id="import-file" type="file"');
    expect(page).toContain("data-template");
    expect(page).toContain('<script type="module" src="/js/flow-import.js"></script>');
    // Nobody but an editor.
    const ana = await signIn({ username: "ana", role: "standard" });
    expect((await ana.fetch("/flows/import")).status).toBe(403);
  });

  it("reviews a grid with the editor's rules and writes nothing", async () => {
    const r = await post("/flows/import/review", { name: "Despachos", grid: instalaciones });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "review", blocking: false });
    // The reference flow's categories and values are all new here.
    expect((r.body.newCategories as string[]).length).toBeGreaterThan(0);
    expect(await flows()).toEqual([]);
    const blocked = await post("/flows/import/review", { name: "Despachos", grid: BLOCKED });
    expect(blocked.body).toMatchObject({ status: "review", blocking: true });
  });

  it("refuses a missing or taken name before reviewing the steps", async () => {
    expect((await post("/flows/import/review", { name: "  ", grid: VALID })).body).toEqual({ status: "invalid", error: "Escribe el nombre del flujo." });
    await createFlow(db(), "Despachos");
    const taken = await post("/flows/import/review", { name: "DESPACHOS", grid: VALID });
    expect(taken.status).toBe(422);
    expect(taken.body.error).toContain("Ya existe un flujo llamado «Despachos».");
    expect((await post("/flows/import/review", { name: "Otro", grid: { categories: [], rows: [] } })).body.status).toBe("invalid");
  });

  it("creates the flow with the grid as its draft, unpublished", async () => {
    const r = await post("/flows/import", { name: "Despachos", grid: VALID, accepted: { categories: [], tags: [] } });
    expect(r.body.status).toBe("saved");
    const id = r.body.id as number;
    const draft = JSON.parse((await db().prepare("SELECT document FROM drafts WHERE flow_id = ?").bind(id).first<string>("document"))!);
    expect(draft.steps.map((s: { id: string }) => s.id)).toEqual(["A", "B"]);
    expect(await db().prepare("SELECT count(*) AS n FROM releases WHERE flow_id = ?").bind(id).first<number>("n")).toBe(0);
    // The editor opens on it.
    expect((await board.fetch(`/flows/${id}/edit?importado=1`)).status).toBe(200);
  });

  it("creates the categories and values accepted, and asks first when nothing was said", async () => {
    const review = (await post("/flows/import/review", { name: "Instalaciones", grid: instalaciones })).body;
    const unsaid = await post("/flows/import", { name: "Instalaciones", grid: instalaciones });
    expect(unsaid.body.status).toBe("confirm");
    expect(await flows()).toEqual([]);
    const accepted = { categories: review.newCategories, tags: review.newTags };
    expect((await post("/flows/import", { name: "Instalaciones", grid: instalaciones, accepted })).body.status).toBe("saved");
    expect(await flows()).toEqual(["Instalaciones"]);
    const cats = await db().prepare("SELECT count(*) AS n FROM tag_categories").first<number>("n");
    expect(cats).toBe((review.newCategories as string[]).length);
  });

  it("creates nothing when the grid blocks or the name is taken", async () => {
    const blocked = await post("/flows/import", { name: "Despachos", grid: BLOCKED, accepted: { categories: [], tags: [] } });
    expect(blocked.status).toBe(422);
    expect(blocked.body.status).toBe("blocked");
    await createFlow(db(), "Despachos");
    const taken = await post("/flows/import", { name: "despachos", grid: VALID, accepted: { categories: [], tags: [] } });
    expect(taken.body.status).toBe("invalid");
    expect(await flows()).toEqual(["Despachos"]);
  });
});
