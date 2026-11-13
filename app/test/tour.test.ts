import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import { replay, type Action, type LogRow } from "../public/js/tour-log.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import apertura from "../../reference/Flujo_Apertura_OT.grid.json";
import { loadDevFlows } from "../src/devload.ts";
import { getFlow, latestRelease } from "../src/flows.ts";
import { finishTour, startTour, takeStep, TOO_FAST } from "../src/tour.ts";

const db = () => env.DB;
const T0 = Date.parse("2026-11-13T15:00:00.000Z");
const at = (seconds: number) => new Date(T0 + seconds * 1000);

const row = (id: string, type: string, exits: string) => ({
  id, type, ref: "", title: `Paso ${id}`, description: "", tags: {}, exits, depends_on: "",
});

// A twin-branch decision like Apertura's P34 ("Sí" and "No" both reach P35),
// placed first so that its second branch is the last thing left: the
// engine closes nearer decisions before it returns there.
const TWINS: Grid = {
  categories: [],
  rows: [
    row("P1", "start", "P2"),
    row("P2", "decision", "Sí:P3 | No:P3"),
    row("P3", "activity", "P4"),
    row("P4", "decision", "A:P5 | B:P6"),
    row("P5", "end", ""),
    row("P6", "end", ""),
  ],
};

async function setup(name = "Apertura de OT") {
  await loadDevFlows(db(), [
    { name: "Instalaciones", grid: instalaciones as Grid },
    { name: "Apertura de OT", grid: apertura as Grid },
    { name: "Ramas gemelas", grid: TWINS },
  ]);
  const flowId = (await db().prepare("SELECT id FROM flows WHERE name = ?").bind(name).first<number>("id"))!;
  const user = (await db().prepare("INSERT INTO users (username, full_name, password_hash) VALUES ('ana', 'Ana', 'x')").run()).meta.last_row_id;
  const release = (await latestRelease(db(), (await getFlow(db(), flowId))!))!;
  return { flowId, user, flow: release.flow };
}

// The action a user would take next: untaken branches first, in order,
// unless `prefer` picks one; skip when a decision has nothing left.
function nextAction(tour: any, prefer?: (step: string) => number | undefined): Action | null {
  const step = tour.current().id;
  if (tour.canFinish()) return null;
  if (tour.canSkip()) return { at: step, action: "skip" };
  if (!tour.needsChoice()) return { at: step, action: "next" };
  const options = tour.options() as { index: number; taken: boolean }[];
  const exit = prefer?.(step) ?? (options.find((o) => !o.taken) ?? options[0]!).index;
  return { at: step, action: "choose", exit };
}

// Walks the tour through the server, one second per action, until `stop`
// says so or the tour can be finished. Returns the last second used.
async function walk(
  s: { flowId: number; user: number; flow: any },
  from: number,
  opts: { prefer?: (step: string) => number | undefined; stop?: (tour: any) => boolean } = {},
) {
  let t = from;
  for (let guard = 0; guard < 500; guard++) {
    const tour = replay(s.flow, await logOf(s.user));
    if (opts.stop?.(tour)) return t;
    const action = nextAction(tour, opts.prefer);
    if (!action) return t;
    const r = await takeStep(db(), s.user, s.flowId, action, at(++t));
    if (!r.ok) throw new Error(`${JSON.stringify(action)}: ${r.error}`);
  }
  throw new Error("the tour did not end");
}

async function logOf(user: number): Promise<LogRow[]> {
  const { results } = await db()
    .prepare("SELECT v.step_path, v.exit_index FROM tour_visits v JOIN tour_runs r ON r.id = v.run_id WHERE r.user_id = ? AND r.finished_at IS NULL ORDER BY v.id")
    .bind(user)
    .all<{ step_path: string; exit_index: number | null }>();
  return results.map((r) => ({ step: r.step_path, exit: r.exit_index }));
}

const count = (table: string) => db().prepare(`SELECT count(*) AS n FROM ${table}`).first<number>("n");

describe("the tour on the server (SPEC §7)", () => {
  it("does not finish with every step visited while a twin branch is not taken", async () => {
    const s = await setup("Ramas gemelas");
    await startTour(db(), s.user, s.flowId, at(0));
    const t = await walk(s, 0, { stop: (tour) => tour.visited.size === s.flow.steps.length && tour.current().id === "P2" });
    const tour = replay(s.flow, await logOf(s.user));
    expect(tour.taken.has("P2#0")).toBe(true);
    expect(tour.taken.has("P2#1")).toBe(false);
    expect(tour.current().note).toMatchObject({ endAt: "P6", returned: true });
    expect(await finishTour(db(), s.user, s.flowId, at(10_000))).toEqual({ ok: false, error: expect.any(String) });
    expect(await count("review_records")).toBe(0);
    const end = await walk(s, t);
    expect(replay(s.flow, await logOf(s.user)).taken.has("P2#1")).toBe(true);
    expect(await finishTour(db(), s.user, s.flowId, at(end + 30))).toEqual({ ok: true, durationSeconds: end + 30 });
  });

  it("in Apertura de OT, goes back to P34 for «No» although P35 is already visited", async () => {
    const s = await setup();
    await startTour(db(), s.user, s.flowId, at(0));
    // P34's two branches both lead to P35.
    const p34 = (s.flow.steps as { id: string; exits: { label: string; to: string }[] }[]).find((x) => x.id === "P34")!;
    expect(p34.exits).toEqual([{ label: "Sí", to: "P35" }, { label: "No", to: "P35" }]);
    await walk(s, 0, { stop: (tour) => tour.taken.has("P34#0") && tour.current().id === "P34" });
    const tour = replay(s.flow, await logOf(s.user));
    expect(tour.visited.has("P35")).toBe(true);
    expect(tour.current().note).toMatchObject({ endAt: "P36", returned: true });
    expect(tour.options().map((o: { taken: boolean }) => o.taken)).toEqual([true, false]);
    expect((await finishTour(db(), s.user, s.flowId, at(10_000))).ok).toBe(false);
  });

  it("logs each action as step plus exit index, with the server's time", async () => {
    const s = await setup();
    await startTour(db(), s.user, s.flowId, at(0));
    await walk(s, 0);
    const log = await logOf(s.user);
    expect(log).toContainEqual({ step: "P34", exit: 0 });
    expect(log).toContainEqual({ step: "P34", exit: 1 });
    // A step with one exit records exit 0; a return from a dead end records none.
    expect(log[0]).toEqual({ step: "P1", exit: 0 });
    const ends = (s.flow.steps as { id: string; type: string }[]).filter((x) => x.type === "end").map((x) => x.id);
    for (const row of log.filter((r) => ends.includes(r.step))) expect(row.exit).toBeNull();
    const first = await db().prepare("SELECT visited_at FROM tour_visits ORDER BY id LIMIT 1").first<string>("visited_at");
    expect(first).toBe(at(1).toISOString());
  });

  it("refuses to finish too early: only the warning, no review, the run stays open", async () => {
    const s = await setup("Instalaciones");
    await startTour(db(), s.user, s.flowId, at(0));
    await walk(s, 0);
    const minimum = s.flow.steps.length * 5; // 30 steps: 150 s
    expect(await finishTour(db(), s.user, s.flowId, at(minimum - 1))).toEqual({ ok: false, error: TOO_FAST });
    expect(TOO_FAST).toBe("Fuiste muy veloz, ¿no se te habrá pasado algo? Repasa el flujo y vuelve a intentarlo.");
    expect(await count("review_records")).toBe(0);
    expect(await db().prepare("SELECT finished_at FROM tour_runs").first("finished_at")).toBeNull();
    expect(await finishTour(db(), s.user, s.flowId, at(minimum))).toEqual({ ok: true, durationSeconds: minimum });
    expect(await db().prepare("SELECT duration_seconds, completed_at FROM review_records").first()).toEqual({
      duration_seconds: minimum,
      completed_at: at(minimum).toISOString(),
    });
  });

  it("refuses an action that does not belong to the current step, and writes nothing", async () => {
    const s = await setup();
    await startTour(db(), s.user, s.flowId, at(0));
    expect((await takeStep(db(), s.user, s.flowId, { at: "P2", action: "next" }, at(1))).ok).toBe(false); // not here
    expect((await takeStep(db(), s.user, s.flowId, { at: "P1", action: "choose", exit: 0 }, at(1))).ok).toBe(false); // not a decision
    expect((await takeStep(db(), s.user, s.flowId, { at: "P1", action: "skip" }, at(1))).ok).toBe(false);
    expect(await count("tour_visits")).toBe(0);
    // Up to the first decision: "next" there is refused, and so is a branch that does not exist.
    await walk(s, 0, { stop: (tour) => tour.needsChoice() });
    const tour = replay(s.flow, await logOf(s.user));
    const step = tour.current().id as string;
    const before = await count("tour_visits");
    expect((await takeStep(db(), s.user, s.flowId, { at: step, action: "next" }, at(99))).ok).toBe(false);
    expect((await takeStep(db(), s.user, s.flowId, { at: step, action: "choose", exit: 9 }, at(99))).ok).toBe(false);
    expect((await takeStep(db(), s.user, s.flowId, { at: step, action: "choose", exit: 1 }, at(99))).ok).toBe(true);
    // The same action again, from a second tab that did not see the first.
    expect((await takeStep(db(), s.user, s.flowId, { at: step, action: "choose", exit: 1 }, at(99))).ok).toBe(false);
    expect(await count("tour_visits")).toBe(before! + 1);
  });

  it("resumes the open run after a reload, and opens a new one only after finishing", async () => {
    const s = await setup("Instalaciones");
    const first = (await startTour(db(), s.user, s.flowId, at(0)))!;
    expect(first.log).toEqual([]);
    await walk(s, 0, { stop: (tour) => tour.trail.length > 5 });
    const resumed = (await startTour(db(), s.user, s.flowId, at(500)))!;
    expect(resumed.runId).toBe(first.runId);
    expect(resumed.log).toEqual(await logOf(s.user));
    expect(replay(s.flow, resumed.log).current().id).toBe(replay(s.flow, await logOf(s.user)).current().id);
    expect(await db().prepare("SELECT started_at FROM tour_runs").first("started_at")).toBe(at(0).toISOString());
    // Finish, then repeat: a new run, and the saved review is left alone.
    const end = await walk(s, 10);
    expect((await finishTour(db(), s.user, s.flowId, at(end + 1000))).ok).toBe(true);
    const review = await db().prepare("SELECT * FROM review_records").first();
    const again = (await startTour(db(), s.user, s.flowId, at(end + 2000)))!;
    expect(again.runId).not.toBe(first.runId);
    expect(again.log).toEqual([]);
    await walk(s, end + 2000);
    expect((await finishTour(db(), s.user, s.flowId, at(end + 9000))).ok).toBe(true);
    expect(await db().prepare("SELECT * FROM review_records").all()).toMatchObject({ results: [review] });
    expect(await count("tour_runs")).toBe(2);
  });

  it("refuses steps and finishing without an open run", async () => {
    const s = await setup();
    expect((await takeStep(db(), s.user, s.flowId, { at: "P1", action: "next" }, at(1))).ok).toBe(false);
    expect((await finishTour(db(), s.user, s.flowId, at(1))).ok).toBe(false);
    expect(await count("tour_visits")).toBe(0);
  });
});

describe("tour routes", () => {
  const post = (path: string, body?: unknown) =>
    exports.default.fetch(`http://example.com${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("start, step and finish speak JSON, as the placeholder user", async () => {
    const s = await setup();
    const started = await post(`/flows/${s.flowId}/tour`);
    expect(started.status).toBe(200);
    expect(await started.json()).toMatchObject({ log: [] });
    const step = await post(`/flows/${s.flowId}/tour/step`, { at: "P1", action: "next" });
    expect(step.status).toBe(200);
    expect(await step.json()).toEqual({ row: { step: "P1", exit: 0 } });
    const stale = await post(`/flows/${s.flowId}/tour/step`, { at: "P1", action: "next" });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toHaveProperty("error");
    expect((await post(`/flows/${s.flowId}/tour/step`, { at: "P2", action: "fly" })).status).toBe(400);
    expect((await post(`/flows/${s.flowId}/tour/finish`)).status).toBe(409);
    const runs = await db().prepare("SELECT u.username FROM tour_runs r JOIN users u ON u.id = r.user_id").all();
    expect(runs.results).toEqual([{ username: "usuario de prueba" }]);
    expect((await post("/flows/999/tour")).status).toBe(404);
  });
});
