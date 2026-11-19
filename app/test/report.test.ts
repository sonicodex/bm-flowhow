import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import apertura from "../../reference/Flujo_Apertura_OT.grid.json";
import { loadDevFlows } from "../src/devload.ts";
import { duration, LEADER_WITHOUT_AREAS, NO_MATCH, NOBODY_YET } from "../src/report.tsx";
import { nameKey } from "../src/names.ts";
import { signIn, type Signed } from "./session.ts";
import { tableHead, tableRows } from "./table.ts";

const area = async (name: string) =>
  (await env.DB.prepare("INSERT INTO areas (name, name_key) VALUES (?, ?) RETURNING id").bind(name, nameKey(name)).first<number>("id"))!;
const idOf = async (name: string) => (await env.DB.prepare("SELECT id FROM flows WHERE name = ?").bind(name).first<number>("id"))!;
const page = async (who: Signed, query = "") => {
  const res = await who.fetch(`/report${query}`);
  expect(res.status).toBe(200);
  return res.text();
};
// Name, area, flow, version, reviewed, time.
const rows = async (who: Signed, query = "") => tableRows(await page(who, query));
const review = (userId: number, flowId: number, completedAt: string, seconds: number) =>
  env.DB.prepare(
    `INSERT INTO review_records (user_id, release_id, completed_at, duration_seconds)
     SELECT ?, id, ?, ? FROM releases WHERE flow_id = ? ORDER BY major DESC, minor DESC LIMIT 1`,
  )
    .bind(userId, completedAt, seconds, flowId)
    .run();

// Two flows, each in an area of its own: Apertura de OT in Ventas,
// Instalaciones in Campo. Ana (Ventas) and Beto (Campo) are Empleados; Lía
// leads Ventas; Leo is a Leader with no area; Caro was deactivated.
async function setup() {
  await loadDevFlows(env.DB, [
    { name: "Instalaciones", grid: instalaciones as Grid },
    { name: "Apertura de OT", grid: apertura as Grid },
  ]);
  await env.DB.prepare("DELETE FROM flow_areas").run();
  const ventas = await area("Ventas");
  const campo = await area("Campo");
  const ot = await idOf("Apertura de OT");
  const inst = await idOf("Instalaciones");
  await env.DB.prepare("INSERT INTO flow_areas (flow_id, area_id) VALUES (?, ?), (?, ?)").bind(ot, ventas, inst, campo).run();
  const board = await signIn({ username: "junta", role: "board" });
  const ana = await signIn({ username: "ana", role: "standard", areaIds: [ventas] });
  const beto = await signIn({ username: "beto", role: "standard", areaIds: [campo] });
  const lia = await signIn({ username: "lia", role: "leader", areaIds: [ventas] });
  const leo = await signIn({ username: "leo", role: "leader" });
  const caro = await signIn({ username: "caro", role: "standard", areaIds: [ventas] });
  await env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = ?").bind(caro.id).run();
  return { ventas, campo, ot, inst, board, ana, beto, lia, leo };
}

describe("progress report (phase 6.9)", () => {
  it("gives the Board a row per Empleado or Leader and flow of theirs, never the Board or a deactivated account", async () => {
    const { board } = await setup();
    const html = await page(board);
    expect(tableHead(html)).toEqual(["Nombre ↑", "Área", "Flujo", "Versión", "Revisado", "Tiempo de revisión"]);
    expect((await rows(board)).map((r) => `${r[0]} | ${r[1]} | ${r[2]}`)).toEqual([
      "Nombre de ana | Ventas | Apertura de OT",
      "Nombre de beto | Campo | Instalaciones",
      // A Leader is certified on every flow (§4), and a Leader with no area
      // is still a row.
      "Nombre de leo | Sin área | Apertura de OT",
      "Nombre de leo | Sin área | Instalaciones",
      "Nombre de lia | Ventas | Apertura de OT",
      "Nombre de lia | Ventas | Instalaciones",
    ]);
    // Stage 1: no score or certified columns yet.
    expect(html).not.toContain("Certificad");
  });

  it("gives a Leader only the people who share an area with them, themselves included", async () => {
    const { ventas, campo, lia, beto } = await setup();
    expect((await rows(lia)).map((r) => `${r[0]} | ${r[2]}`)).toEqual([
      "Nombre de ana | Apertura de OT",
      "Nombre de lia | Apertura de OT",
      "Nombre de lia | Instalaciones",
    ]);
    // Leading Campo too brings in Beto; every area of a row is shown.
    await env.DB.prepare("INSERT INTO user_areas (user_id, area_id) VALUES (?, ?)").bind(lia.id, campo).run();
    const now = await rows(lia);
    expect(now.map((r) => r[0])).toContain("Nombre de beto");
    expect(now.find((r) => r[0] === "Nombre de lia")![1]).toBe("Campo, Ventas");
    // Someone in both areas shows them both, and is found by either.
    await env.DB.prepare("INSERT INTO user_areas (user_id, area_id) VALUES (?, ?)").bind(beto.id, ventas).run();
    const both = (await rows(lia, `?area=${ventas}`)).filter((r) => r[0] === "Nombre de beto");
    expect(both.map((r) => `${r[1]} | ${r[2]}`)).toEqual(["Campo, Ventas | Apertura de OT", "Campo, Ventas | Instalaciones"]);
  });

  it("tells a Leader with no area why the report is empty", async () => {
    const { leo } = await setup();
    const html = await page(leo);
    expect(html).toContain(LEADER_WITHOUT_AREAS);
    expect(html).not.toContain("<table");
  });

  it("says so when nobody in reach has a flow yet", async () => {
    const lia = await signIn({ username: "lia", role: "leader", areaIds: [await area("Ventas")] });
    expect(await page(lia)).toContain(NOBODY_YET);
  });

  it("shows who reviewed what, when, on which version and how long it took", async () => {
    const { ot, inst, board, ana, lia } = await setup();
    await review(ana.id, ot, "2026-11-16T15:00:00.000Z", 754);
    await review(lia.id, inst, "2026-11-18T20:00:00.000Z", 3700);
    const byKey = async () => Object.fromEntries((await rows(board)).map((r) => [`${r[0]} | ${r[2]}`, r.slice(3)]));
    let all = await byKey();
    expect(all["Nombre de ana | Apertura de OT"]).toEqual(["1.0", "Sí · 16 de noviembre de 2026", "12 min 34 s"]);
    expect(all["Nombre de lia | Instalaciones"]).toEqual(["1.0", "Sí · 18 de noviembre de 2026", "1 h 1 min"]);
    expect(all["Nombre de lia | Apertura de OT"]).toEqual(["1.0", "No", "—"]);
    // A minor release keeps the review, and says on which version it was.
    await env.DB.prepare("INSERT INTO releases (flow_id, major, minor, document) SELECT flow_id, 1, 1, document FROM releases WHERE flow_id = ? AND major = 1 AND minor = 0").bind(ot).run();
    all = await byKey();
    expect(all["Nombre de ana | Apertura de OT"]).toEqual(["1.1", "Sí · 16 de noviembre de 2026 , en la versión 1.0", "12 min 34 s"]);
    // A major one asks for a new review.
    await env.DB.prepare("INSERT INTO releases (flow_id, major, minor, document) SELECT flow_id, 2, 0, document FROM releases WHERE flow_id = ? AND major = 1 AND minor = 0").bind(ot).run();
    all = await byKey();
    expect(all["Nombre de ana | Apertura de OT"]).toEqual(["2.0", "No · revisó la versión 1.0", "—"]);
  });

  it("filters by area, flow and reviewed, and sorts by any column, from the address", async () => {
    const { ventas, campo, ot, inst, board, ana, lia } = await setup();
    await review(ana.id, ot, "2026-11-16T15:00:00.000Z", 754);
    await review(lia.id, inst, "2026-11-18T20:00:00.000Z", 3700);
    const names = async (q: string) => (await rows(board, q)).map((r) => `${r[0]} | ${r[2]}`);
    expect(await names(`?area=${ventas}`)).toEqual(["Nombre de ana | Apertura de OT", "Nombre de lia | Apertura de OT", "Nombre de lia | Instalaciones"]);
    expect(await names(`?flujo=${inst}`)).toEqual(["Nombre de beto | Instalaciones", "Nombre de leo | Instalaciones", "Nombre de lia | Instalaciones"]);
    expect(await names("?revisado=si")).toEqual(["Nombre de ana | Apertura de OT", "Nombre de lia | Instalaciones"]);
    expect(await names(`?revisado=no&area=${ventas}`)).toEqual(["Nombre de lia | Apertura de OT"]);
    // The longest review first; the rows with none last, in either direction.
    expect((await names("?orden=tiempo&dir=desc")).slice(0, 2)).toEqual(["Nombre de lia | Instalaciones", "Nombre de ana | Apertura de OT"]);
    expect((await names("?orden=tiempo")).slice(0, 2)).toEqual(["Nombre de ana | Apertura de OT", "Nombre de lia | Instalaciones"]);
    expect((await names("?orden=flujo")).map((n) => n.split(" | ")[1])).toEqual([
      "Apertura de OT", "Apertura de OT", "Apertura de OT", "Instalaciones", "Instalaciones", "Instalaciones",
    ]);
    // The headings carry the order and keep the filters.
    const html = await page(board, `?area=${ventas}&orden=tiempo`);
    expect(html).toContain('<th scope="col" aria-sort="ascending"><a href="/report?area=' + ventas + '&amp;orden=tiempo&amp;dir=desc"');
    expect(html).toContain("3 filas de 6");
    // Nothing left: said, not an empty table.
    expect(await page(board, `?revisado=si&flujo=${ot}&area=${campo}`)).toContain(NO_MATCH);
    // Anything it does not understand is ignored.
    expect(await names("?area=x&flujo=-1&revisado=quizas&orden=nada&dir=up")).toHaveLength(6);
  });

  // Phase 6.16 (SPEC §9): live filters, and the button back without JavaScript.
  it("filters live with its script, and keeps «Filtrar» for a browser without JavaScript", async () => {
    const { board, ventas } = await setup();
    const html = await page(board, `?area=${ventas}`);
    expect(html).toContain('<script type="module" src="/js/report.js"></script>');
    expect(html).toMatch(/<noscript><button type="submit" class="button-secondary">Filtrar<\/button><\/noscript>/);
    // The parts the script swaps from the server's answer.
    expect(html).toContain('<p class="muted report-count" id="report-count" role="status">3 filas de 6</p>');
    expect(html).toMatch(/<div id="report-results"><div class="table-frame"><div class="table-scroll"[^>]*><table/);
    expect(html).toMatch(/<span id="report-clear"><a href="\/report">Quitar filtros<\/a><\/span>/);
    // Unfiltered: «Quitar filtros» is gone, its place kept.
    expect(await page(board)).toContain('<span id="report-clear"></span>');
  });

  it("is in the menu of the Board and Leaders only", async () => {
    const { board, lia, ana } = await setup();
    expect(await page(board)).toContain('<a href="/report">Reporte</a>');
    expect(await page(lia)).toContain('<a href="/report">Reporte</a>');
    const home = await (await ana.fetch("/home")).text();
    expect(home).not.toContain("/report");
    expect((await ana.fetch("/report")).status).toBe(403);
  });

  it("writes review times the way people say them", () => {
    expect([5, 60, 754, 3600, 3700].map(duration)).toEqual(["5 s", "1 min", "12 min 34 s", "1 h", "1 h 1 min"]);
  });
});
