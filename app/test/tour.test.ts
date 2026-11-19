import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import { replay, type Action, type LogRow } from "../public/js/tour-log.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import apertura from "../../reference/Flujo_Apertura_OT.grid.json";
import { loadDevFlows } from "../src/devload.ts";
import { getFlow, latestRelease } from "../src/flows.ts";
import { applyGrid } from "../src/import.ts";
import { publishFlow, type Bump } from "../src/publish.ts";
import { signIn, type Signed } from "./session.ts";
import { finishTour, restartTour, reviewStatus, startTour, takeStep, TOO_FAST } from "../src/tour.ts";

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
    .prepare("SELECT v.step_path, v.exit_index FROM tour_visits v JOIN tour_runs r ON r.id = v.run_id WHERE r.user_id = ? AND r.finished_at IS NULL AND r.abandoned_at IS NULL ORDER BY v.id")
    .bind(user)
    .all<{ step_path: string; exit_index: number | null }>();
  return results.map((r) => ({ step: r.step_path, exit: r.exit_index }));
}

const count = (table: string) => db().prepare(`SELECT count(*) AS n FROM ${table}`).first<number>("n");

describe("the tour on the server (SPEC §7)", () => {
  it("twin branches: both go straight to P3, so it is entered once and the other is taken on the way", async () => {
    const s = await setup("Ramas gemelas");
    await startTour(db(), s.user, s.flowId, at(0));
    const t = await walk(s, 0, { stop: (tour) => tour.taken.has("P2#0") });
    const tour = replay(s.flow, await logOf(s.user));
    expect(tour.current()).toMatchObject({ id: "P3", note: { alsoDirect: "P2", exits: [1] } });
    expect(tour.taken.has("P2#1")).toBe(true);
    const end = await walk(s, t);
    const log = await logOf(s.user);
    expect(replay(s.flow, log).trail.filter((x: { id: string }) => x.id === "P3")).toHaveLength(1);
    expect(log).toContainEqual({ step: "P2", exit: 0 });
    expect(log).not.toContainEqual({ step: "P2", exit: 1 });
    expect(await finishTour(db(), s.user, s.flowId, at(end + 30))).toEqual({ ok: true, durationSeconds: end + 30, newer: null });
  });

  it("goes back with «Anterior» to a decision and picks another branch: logged with its position, replayed", async () => {
    const s = await setup("Ramas gemelas");
    await startTour(db(), s.user, s.flowId, at(0));
    // P1 → P2 (Sí) → P3 → P4 (A) → P5, a dead end.
    await walk(s, 0, { stop: (tour) => tour.current().id === "P5" });
    let tour = replay(s.flow, await logOf(s.user));
    const back = tour.trail.findIndex((x: { id: string }) => x.id === "P4");
    // Not a decision, a branch already chosen there, a position past the end: refused, nothing written.
    const rows = await count("tour_visits");
    expect((await takeStep(db(), s.user, s.flowId, { at: "P3", action: "choose", exit: 0, back: back - 1 }, at(20))).ok).toBe(false);
    expect((await takeStep(db(), s.user, s.flowId, { at: "P4", action: "choose", exit: 0, back }, at(20))).ok).toBe(false);
    expect((await takeStep(db(), s.user, s.flowId, { at: "P5", action: "choose", exit: 0, back: tour.trail.length - 1 }, at(20))).ok).toBe(false);
    expect(await count("tour_visits")).toBe(rows);
    const r = await takeStep(db(), s.user, s.flowId, { at: "P4", action: "choose", exit: 1, back }, at(21));
    expect(r).toEqual({ ok: true, row: { step: "P4", exit: 1, back } });
    expect(await db().prepare("SELECT rewind_to FROM tour_visits ORDER BY id DESC LIMIT 1").first("rewind_to")).toBe(back);
    // A reload rebuilds the same tour: on at P6, P5 still seen, both branches taken.
    const resumed = (await startTour(db(), s.user, s.flowId, at(22)))!;
    tour = replay(resumed.flow, resumed.log);
    expect(tour.trail.map((x: { id: string }) => x.id)).toEqual(["P1", "P2", "P3", "P4", "P6"]);
    expect(tour.visited.has("P5") && tour.taken.has("P4#0") && tour.taken.has("P4#1")).toBe(true);
    expect(tour.canFinish()).toBe(true);
  });

  it("in Apertura de OT, walks every branch to its meeting point and the shared path once", async () => {
    const s = await setup();
    await startTour(db(), s.user, s.flowId, at(0));
    // P34's two branches both lead to P35.
    const p34 = (s.flow.steps as { id: string; exits: { label: string; to: string }[] }[]).find((x) => x.id === "P34")!;
    expect(p34.exits).toEqual([{ label: "Sí", to: "P35" }, { label: "No", to: "P35" }]);
    // «¿Quién entrega el material?»: its three branches before P30.
    await walk(s, 0, { stop: (tour) => tour.visited.has("P30") });
    let tour = replay(s.flow, await logOf(s.user));
    expect(["P26#0", "P26#1", "P26#2"].every((k) => tour.taken.has(k))).toBe(true);
    await walk(s, 0);
    tour = replay(s.flow, await logOf(s.user));
    const trail = tour.trail.map((x: { id: string }) => x.id) as string[];
    // Nothing from P25 on is walked twice, except the P31/P32 loop and the
    // decisions the tour goes back to.
    const decisions = new Set(["P26", "P31", "P34"]);
    for (const id of ["P25", "P27", "P28", "P29", "P30", "P33", "P35", "P36"]) expect([id, trail.filter((x) => x === id).length]).toEqual([id, 1]);
    expect(trail.slice(trail.indexOf("P25")).filter((x) => !decisions.has(x) && x !== "P32" && trail.filter((y) => y === x).length > 1)).toEqual([]);
    // One-step branches in a row (phase 3.6): P7's two, P26's three.
    expect(trail.join(" ")).toContain("P7 P8 P9 P10");
    expect(trail.join(" ")).toContain("P26 P27 P28 P29 P30");
    expect(trail.filter((x) => x === "P7" || x === "P26")).toEqual(["P7", "P26"]);
    // P6's branches meet at P25, P7's at P10, P34's at P35.
    expect(tour.meet.get("P6")).toEqual(["P25", "P25"]);
    expect(tour.meet.get("P7")).toEqual(["P10", "P10"]);
    expect(tour.meet.get("P34")).toEqual(["P35", "P35"]);
    expect(tour.canFinish()).toBe(true);
  });

  it("logs each action as step plus exit index, with the server's time", async () => {
    const s = await setup();
    await startTour(db(), s.user, s.flowId, at(0));
    await walk(s, 0);
    const log = await logOf(s.user);
    // P34's «No» goes straight to P35 like «Sí»: taken on the way, never chosen.
    expect(log).toContainEqual({ step: "P34", exit: 0 });
    expect(log).not.toContainEqual({ step: "P34", exit: 1 });
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
    expect(await finishTour(db(), s.user, s.flowId, at(minimum))).toEqual({ ok: true, durationSeconds: minimum, newer: null });
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

  for (const [bump, line] of [
    ["minor", "Mientras lo recorrías se publicó la versión 1.1, con cambios menores: tu revisión sigue vigente."],
    ["major", "Mientras lo recorrías se publicó la versión 2.0, con cambios importantes: esa versión queda pendiente de revisión."],
  ] as [Bump, string][]) {
    it(`finishes on the version it started on after a ${bump} release, and says so in one line`, async () => {
      const s = await setup("Ramas gemelas");
      const started = (await startTour(db(), s.user, s.flowId, at(0)))!;
      expect(started.version).toBe("1.0");
      await walk(s, 0, { stop: (tour) => tour.trail.length > 2 });
      const changed = structuredClone(TWINS);
      changed.rows.push(row("P7", "end", ""));
      changed.rows[2]!.exits = "Sigue:P4 | Corta:P7";
      changed.rows[2]!.type = "decision";
      expect((await applyGrid(db(), s.flowId, changed, { categories: [], tags: [] })).ok).toBe(true);
      expect((await publishFlow(db(), s.flowId, bump)).ok).toBe(true);
      // Resuming keeps the run, its release and the flow it draws.
      const resumed = (await startTour(db(), s.user, s.flowId, at(50)))!;
      expect(resumed).toMatchObject({ runId: started.runId, version: "1.0", flow: { steps: { length: 6 } } });
      const end = await walk(s, 50);
      expect(await finishTour(db(), s.user, s.flowId, at(end + 30))).toEqual({ ok: true, durationSeconds: end + 30, newer: line });
      const review = await db()
        .prepare("SELECT rel.major, rel.minor FROM review_records rr JOIN releases rel ON rel.id = rr.release_id")
        .all();
      expect(review.results).toEqual([{ major: 1, minor: 0 }]);
      // The next tour starts on the latest release.
      expect((await startTour(db(), s.user, s.flowId, at(end + 100)))!.version).toBe(bump === "minor" ? "1.1" : "2.0");
    });
  }

  it("starts over while there is no review: the open run is abandoned, a clean one opened (phase 3.5)", async () => {
    const s = await setup("Ramas gemelas");
    const first = (await startTour(db(), s.user, s.flowId, at(0)))!;
    await walk(s, 0, { stop: (tour) => tour.trail.length > 3 });
    const again = await restartTour(db(), s.user, s.flowId, at(100));
    expect(again).toMatchObject({ log: [], notice: null });
    expect((again as { runId: number }).runId).not.toBe(first.runId);
    const runs = await db().prepare("SELECT id, started_at, finished_at, abandoned_at FROM tour_runs ORDER BY id").all();
    expect(runs.results).toEqual([
      { id: first.runId, started_at: at(0).toISOString(), finished_at: null, abandoned_at: at(100).toISOString() },
      { id: expect.any(Number), started_at: at(100).toISOString(), finished_at: null, abandoned_at: null },
    ]);
    // The minimum time counts from the clean start.
    const end = await walk(s, 100);
    expect(await finishTour(db(), s.user, s.flowId, at(end + 1))).toEqual({ ok: false, error: TOO_FAST });
    expect((await finishTour(db(), s.user, s.flowId, at(100 + 30))).ok).toBe(true);
  });

  it("offers and allows starting over while repeating a reviewed flow, and keeps the review", async () => {
    const s = await setup("Ramas gemelas");
    const statusOf = async () => reviewStatus(db(), s.user, s.flowId, (await latestRelease(db(), (await getFlow(db(), s.flowId))!))!);
    await startTour(db(), s.user, s.flowId, at(0));
    const end = await walk(s, 0);
    expect((await finishTour(db(), s.user, s.flowId, at(end + 60))).ok).toBe(true);
    expect(await statusOf()).toMatchObject({ state: "reviewed", open: false });
    const review = await db().prepare("SELECT * FROM review_records").first();
    // "Repetir recorrido": still "Revisado", and now a run is open.
    const repeat = (await startTour(db(), s.user, s.flowId, at(500)))!;
    await walk(s, 500, { stop: (tour) => tour.trail.length > 2 });
    expect(await statusOf()).toMatchObject({ state: "reviewed", open: true, action: "Continuar recorrido" });
    const again = (await restartTour(db(), s.user, s.flowId, at(600)))!;
    expect(again.runId).not.toBe(repeat.runId);
    expect(again.log).toEqual([]);
    expect(await db().prepare("SELECT * FROM review_records").all()).toMatchObject({ results: [review] });
    expect(await statusOf()).toMatchObject({ state: "reviewed", open: true });
  });

  it("closes a run that no longer replays under the current rules and opens a clean one, saying so", async () => {
    const s = await setup("Ramas gemelas");
    const first = (await startTour(db(), s.user, s.flowId, at(0)))!;
    // A log written under older rules: the row at P2 no longer matches.
    await db().prepare("INSERT INTO tour_visits (run_id, step_path, exit_index, visited_at) VALUES (?, 'P1', 0, ?), (?, 'P9', 0, ?)")
      .bind(first.runId, at(1).toISOString(), first.runId, at(2).toISOString()).run();
    expect(await takeStep(db(), s.user, s.flowId, { at: "P2", action: "choose", exit: 0 }, at(3))).toEqual({ ok: false, error: expect.stringContaining("Recarga") });
    expect((await finishTour(db(), s.user, s.flowId, at(3))).ok).toBe(false);
    const again = (await startTour(db(), s.user, s.flowId, at(4)))!;
    expect(again.runId).not.toBe(first.runId);
    expect(again.log).toEqual([]);
    expect(again.notice).toContain("Empiezas uno nuevo");
    expect(await db().prepare("SELECT abandoned_at FROM tour_runs WHERE id = ?").bind(first.runId).first("abandoned_at")).toBe(at(4).toISOString());
  });

  it("refuses steps and finishing without an open run", async () => {
    const s = await setup();
    expect((await takeStep(db(), s.user, s.flowId, { at: "P1", action: "next" }, at(1))).ok).toBe(false);
    expect((await finishTour(db(), s.user, s.flowId, at(1))).ok).toBe(false);
    expect(await count("tour_visits")).toBe(0);
  });
});

describe("review status (phase 3.4)", () => {
  const statusOf = async (s: { flowId: number; user: number }) =>
    reviewStatus(db(), s.user, s.flowId, (await latestRelease(db(), (await getFlow(db(), s.flowId))!))!);
  const bump = async (s: { flowId: number }, kind: Bump, end: string) => {
    const changed = structuredClone(TWINS);
    changed.rows.find((r) => r.id === "P6")!.title = end;
    expect((await applyGrid(db(), s.flowId, changed, { categories: [], tags: [] })).ok).toBe(true);
    expect((await publishFlow(db(), s.flowId, kind)).ok).toBe(true);
  };
  const tour = async (s: { flowId: number; user: number; flow: any }, from: number) => {
    await startTour(db(), s.user, s.flowId, at(from));
    const end = await walk(s, from);
    expect((await finishTour(db(), s.user, s.flowId, at(end + 60))).ok).toBe(true);
    return end + 60;
  };

  it("goes from pending to in progress to reviewed, with the date in Bogotá", async () => {
    const s = await setup("Ramas gemelas");
    expect(await statusOf(s)).toEqual({ state: "pending", label: "Pendiente de revisión", detail: null, action: "Iniciar recorrido", open: false });
    await startTour(db(), s.user, s.flowId, at(0));
    expect(await statusOf(s)).toEqual({ state: "in_progress", label: "Recorrido en curso", detail: null, action: "Continuar recorrido", open: true });
    await walk(s, 0);
    // 03:00 UTC on the 14th is still the 13th in Bogotá.
    expect((await finishTour(db(), s.user, s.flowId, new Date("2026-11-14T03:00:00Z"))).ok).toBe(true);
    expect(await statusOf(s)).toEqual({ state: "reviewed", label: "Revisado", detail: "El 13 de noviembre de 2026.", action: "Repetir recorrido", open: false });
    // Repeating: still reviewed, and the button resumes the new run.
    await startTour(db(), s.user, s.flowId, new Date("2026-11-20T15:00:00Z"));
    expect(await statusOf(s)).toMatchObject({ state: "reviewed", detail: "El 13 de noviembre de 2026.", action: "Continuar recorrido" });
  });

  it("keeps the review after a minor release and resets it after a major one (§8)", async () => {
    const s = await setup("Ramas gemelas");
    await tour(s, 0);
    await bump(s, "minor", "Cierre B");
    expect(await statusOf(s)).toMatchObject({ state: "reviewed", detail: "El 13 de noviembre de 2026, en la versión 1.0.", action: "Repetir recorrido" });
    await bump(s, "major", "Cierre C");
    expect(await statusOf(s)).toEqual({
      state: "pending",
      label: "Pendiente de revisión",
      detail: "Revisaste la versión 1.0. La 2.0 trae cambios importantes.",
      action: "Iniciar recorrido",
      open: false,
    });
    await tour({ ...s, flow: (await latestRelease(db(), (await getFlow(db(), s.flowId))!))!.flow }, 1000);
    expect(await statusOf(s)).toMatchObject({ state: "reviewed", detail: "El 13 de noviembre de 2026." });
  });

  it("is in progress on the old version while a run started before a major release is open", async () => {
    const s = await setup("Ramas gemelas");
    await startTour(db(), s.user, s.flowId, at(0));
    await bump(s, "major", "Cierre C");
    expect(await statusOf(s)).toEqual({
      state: "in_progress",
      label: "Recorrido en curso",
      detail: "Lo empezaste en la versión 1.0 y lo terminas en esa versión.",
      action: "Continuar recorrido",
      open: true,
    });
  });
});

describe("tour routes", () => {
  let me: Signed;
  beforeEach(async () => {
    me = await signIn({ username: "beto", role: "leader" });
  });
  const post = (path: string, body?: unknown) =>
    me.fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("start, step and finish speak JSON, as the session's user", async () => {
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
    expect((await post(`/flows/${s.flowId}/tour/step`, { at: "P1", action: "next", back: 0 })).status).toBe(400);
    expect((await post(`/flows/${s.flowId}/tour/step`, { at: "P1", action: "choose", exit: 0, back: "0" })).status).toBe(400);
    expect((await post(`/flows/${s.flowId}/tour/finish`)).status).toBe(409);
    const runs = await db().prepare("SELECT u.username FROM tour_runs r JOIN users u ON u.id = r.user_id").all();
    expect(runs.results).toEqual([{ username: "beto" }]);
    expect((await post("/flows/999/tour")).status).toBe(404);
  });

  // Owner's report after phase 6: an Empleado without access to the flow a
  // link leads to was stuck on Apertura's P13. «Siguiente» on a link step
  // follows its exit, with access to the other flow or without it.
  it("goes on past a link step to a flow the user cannot open", async () => {
    const s = await setup();
    const area = (await db().prepare("INSERT INTO areas (name, name_key) VALUES ('Diseño', 'diseno') RETURNING id").first<number>("id"))!;
    await db().prepare("DELETE FROM flow_areas").run();
    await db().prepare("INSERT INTO flow_areas (flow_id, area_id) VALUES (?, ?)").bind(s.flowId, area).run();
    const ana = await signIn({ username: "empleada", role: "standard", areaIds: [area] });
    const send = (path: string, body?: unknown) =>
      ana.fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const inst = (await db().prepare("SELECT id FROM flows WHERE name = 'Instalaciones'").first<number>("id"))!;
    // She cannot open Instalaciones: to her it does not exist.
    expect((await ana.fetch(`/flows/${inst}`)).status).toBe(404);
    const started = (await (await send(`/flows/${s.flowId}/tour`)).json()) as any;
    // The link is named, and closed to her.
    expect(started.links).toEqual({ [inst]: { name: "Instalaciones", open: false } });
    for (const at of ["P1", "P2", "P3", "P4", "P5"]) expect((await send(`/flows/${s.flowId}/tour/step`, { at, action: "next" })).status).toBe(200);
    expect((await send(`/flows/${s.flowId}/tour/step`, { at: "P6", action: "choose", exit: 1 })).status).toBe(200);
    // P13, the link to Instalaciones: «Siguiente» leads to P14.
    const step = await send(`/flows/${s.flowId}/tour/step`, { at: "P13", action: "next" });
    expect(step.status).toBe(200);
    expect(await step.json()).toEqual({ row: { step: "P13", exit: 0 } });
    const tour = replay(s.flow, await logOf(ana.id));
    expect(tour.current().id).toBe("P14");
    expect(s.flow.steps.find((x: any) => x.id === "P14")?.title).toBe("Poner las artes en el Dropbox de Producción");
  });

  it("answers start and finish with the new status, and the page shows it", async () => {
    const s = await setup("Ramas gemelas");
    const page = async () => (await me.fetch(`/flows/${s.flowId}`)).text();
    expect(await page()).toContain('data-state="pending"');
    expect(await page()).toContain(">Iniciar recorrido</button>");
    // "Empezar de nuevo" is in the page, hidden until a run is open.
    expect(await page()).toContain('<button type="button" class="button-secondary" data-restart="true" hidden="">Empezar de nuevo</button>');
    expect(((await (await post(`/flows/${s.flowId}/tour`)).json()) as any).status).toMatchObject({ state: "in_progress" });
    const html = await page();
    expect(html).toContain('<img class="icon" src="/icons/in_progress.svg" alt="" width="18" height="18"/><strong>Recorrido en curso</strong>');
    expect(html).toContain(">Continuar recorrido</button>");
    // Finishing is refused this early; the status stays as it was.
    expect((await post(`/flows/${s.flowId}/tour/finish`)).status).toBe(409);
    expect(await page()).toContain('data-state="in_progress"');
    expect(await page()).toContain('<button type="button" class="button-secondary" data-restart="true">Empezar de nuevo</button>');
    const restarted = await post(`/flows/${s.flowId}/tour/restart`);
    expect(restarted.status).toBe(200);
    expect(await restarted.json()).toMatchObject({ log: [], notice: null, status: { state: "in_progress" } });
    // The free review is locked until the flow is reviewed (SPEC §7; phase 6.6).
    const free = '<button type="button" class="button-secondary" data-review="true"';
    expect(await page()).toContain(`${free} hidden="">Repaso libre</button>`);
    const release = (await db().prepare("SELECT id FROM releases WHERE flow_id = ?").bind(s.flowId).first<number>("id"))!;
    await db().prepare("UPDATE tour_runs SET finished_at = ? WHERE abandoned_at IS NULL").bind(new Date().toISOString()).run();
    await db()
      .prepare("INSERT INTO review_records (user_id, release_id, completed_at, duration_seconds) SELECT user_id, ?, ?, 60 FROM tour_runs LIMIT 1")
      .bind(release, new Date().toISOString())
      .run();
    expect(await page()).toContain('data-state="reviewed"');
    expect(await page()).toContain(`${free}>Repaso libre</button>`);
  });
});
