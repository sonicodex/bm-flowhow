// Subflows on the server (SPEC §7, stage 2; phase 10.1): the tour walks a
// flow with its subflows laid in, counts their steps, and a subflow is never
// listed as a flow of its own. The browser side is checked in Chrome.
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import Core, { type Grid } from "../public/js/core.js";
import { replay, type LogRow } from "../public/js/tour-log.js";
import { visibleFlows } from "../src/access.tsx";
import { loadDevFlows } from "../src/devload.ts";
import { getFlow, latestRelease, withSubflows } from "../src/flows.ts";
import { finishTour, startTour, takeStep, TOO_FAST } from "../src/tour.ts";

const db = () => env.DB;
const T0 = Date.parse("2026-11-20T15:00:00.000Z");
const at = (seconds: number) => new Date(T0 + seconds * 1000);

const row = (id: string, type: string, exits: string, ref = "") => ({
  id, type, ref, title: `Paso ${id}`, description: "", tags: {}, exits, depends_on: "",
});

// A subflow with two branches that meet only at their ends.
const DESPACHO: Grid = {
  categories: [],
  rows: [row("D1", "start", "D2"), row("D2", "decision", "Moto:D3 | Camión:D4"), row("D3", "end", ""), row("D4", "end", "")],
};
const PEDIDO: Grid = {
  categories: [],
  rows: [row("P1", "start", "P2"), row("P2", "subflow", "P3", "Despacho"), row("P3", "end", "")],
};

async function setup() {
  await loadDevFlows(db(), [
    { name: "Despacho", grid: DESPACHO },
    { name: "Pedido", grid: PEDIDO },
  ]);
  const id = async (name: string) => (await db().prepare("SELECT id FROM flows WHERE name = ?").bind(name).first<number>("id"))!;
  const sub = await id("Despacho");
  // A subflow is not assigned to areas (SPEC §7); the loader assigns every flow.
  await db().prepare("DELETE FROM flow_areas WHERE flow_id = ?").bind(sub).run();
  const user = (await db().prepare("INSERT INTO users (username, full_name, password_hash) VALUES ('ana', 'Ana', 'x')").run()).meta.last_row_id;
  return { parent: await id("Pedido"), sub, user };
}

async function logOf(user: number): Promise<LogRow[]> {
  const { results } = await db()
    .prepare("SELECT v.step_path, v.exit_index FROM tour_visits v JOIN tour_runs r ON r.id = v.run_id WHERE r.user_id = ? AND r.finished_at IS NULL AND r.abandoned_at IS NULL ORDER BY v.id")
    .bind(user)
    .all<{ step_path: string; exit_index: number | null }>();
  return results.map((r) => ({ step: r.step_path, exit: r.exit_index }));
}

describe("subflows on the server (SPEC §7)", () => {
  it("the tour walks the subflow inside its box, counts its steps, and finishes", async () => {
    const s = await setup();
    const started = (await startTour(db(), s.user, s.parent, at(0)))!;
    expect(started.flow.steps.map((x) => x.id)).toEqual(["P1", "P2", "P2/D1", "P2/D2", "P2/D3", "P2/D4", "P2/", "P3"]);
    expect(Core.stepCount(started.flow)).toBe(7);
    let t = 0;
    for (let guard = 0; guard < 50; guard++) {
      const tour = replay(started.flow, await logOf(s.user));
      if (tour.canFinish()) break;
      const here = tour.current().id;
      // D3 and D4 meet at the return step in one step each: parallel siblings (phase 6.23).
      const siblings = tour.siblings();
      const action = tour.canSkip()
        ? { at: here, action: "skip" as const }
        : siblings
          ? { at: here, action: "choose" as const, exit: siblings.exits[0] as number }
        : tour.needsChoice()
          ? { at: here, action: "choose" as const, exit: tour.options().find((o: { taken: boolean }) => !o.taken)!.index }
          : { at: here, action: "next" as const };
      const r = await takeStep(db(), s.user, s.parent, action, at(++t));
      expect(r.ok, JSON.stringify(action)).toBe(true);
    }
    const trail = replay(started.flow, await logOf(s.user)).trail.map((x: { id: string }) => x.id);
    // Both branches of the subflow before the parent goes on.
    expect(trail.indexOf("P2/D3")).toBeLessThan(trail.indexOf("P2/"));
    expect(trail.indexOf("P2/D4")).toBeLessThan(trail.indexOf("P2/"));
    expect(trail.indexOf("P2/")).toBeLessThan(trail.indexOf("P3"));
    // Steps × 5 s, the subflow's included: 7 steps, so 34 s is too early.
    expect(await finishTour(db(), s.user, s.parent, at(34))).toEqual({ ok: false, error: TOO_FAST });
    expect(await finishTour(db(), s.user, s.parent, at(35))).toMatchObject({ ok: true, durationSeconds: 35 });
  });

  it("the parent shows the subflow's latest release; a flow without subflows comes back as it is", async () => {
    const s = await setup();
    const parent = (await latestRelease(db(), (await getFlow(db(), s.parent))!))!;
    expect((await withSubflows(db(), parent.flow)).subflows).toEqual({ "P2/": { id: s.sub, name: "Despacho", parent: "", box: "P2" } });
    const sub = (await latestRelease(db(), (await getFlow(db(), s.sub))!))!;
    expect(await withSubflows(db(), sub.flow)).toBe(sub.flow);
    // A new release of the subflow is what the parent shows next.
    await loadDevFlows(db(), [{ name: "Despacho", grid: { ...DESPACHO, rows: DESPACHO.rows.map((r) => (r.id === "D3" ? { ...r, title: "Moto lista" } : r)) } }]);
    const again = await withSubflows(db(), parent.flow);
    expect(again.steps.find((x) => x.id === "P2/D3")!.title).toBe("Moto lista");
  });

  it("a subflow is not listed on its own, for any role", async () => {
    const s = await setup();
    for (const role of ["board", "leader"] as const) {
      const names = (await visibleFlows(db(), { id: s.user, role })).map((f) => f.name);
      expect(names).toContain("Pedido");
      expect(names).not.toContain("Despacho");
    }
  });
});
