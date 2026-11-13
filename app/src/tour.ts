import type { Flow } from "../public/js/core.js";
import { apply, replay, type Action, type LogRow } from "../public/js/tour-log.js";
import { getFlow, getRelease, latestRelease, type Release } from "./flows.ts";

// The tour on the server (SPEC §7; phase 3.2). The browser only proposes
// actions: the server rebuilds the tour from its own log, checks each action
// against it, and stores it with the server's time. Finishing is decided
// here too, on the server's clock. `now` is a parameter so tests control
// time without waiting.

export const SECONDS_PER_STEP = 5;
export const TOO_FAST = "Fuiste muy veloz, ¿no se te habrá pasado algo? Repasa el flujo y vuelve a intentarlo.";
const RELOAD = "El recorrido cambió en otra pestaña o ventana. Recarga la página para seguir.";
const NO_RUN = "No tienes un recorrido abierto en este flujo. Recarga la página.";

export type Refused = { ok: false; error: string };

type OpenRun = { id: number; startedAt: string; release: Release; log: LogRow[] };

const version = (r: { major: number; minor: number }) => `${r.major}.${r.minor}`;

// The user's open run on this flow, with its release and its log. A run
// finishes on the release it started on, even after a newer one is
// published: interrupting someone at step 25 of 36 would throw away their
// work for nothing (owner's decision, phase 3.2).
async function openRun(db: D1Database, userId: number, flowId: number): Promise<OpenRun | null> {
  const flow = await getFlow(db, flowId);
  if (!flow) return null;
  const run = await db
    .prepare(
      `SELECT r.id, r.release_id, r.started_at FROM tour_runs r JOIN releases rel ON rel.id = r.release_id
       WHERE r.user_id = ? AND rel.flow_id = ? AND r.finished_at IS NULL
       ORDER BY r.started_at DESC, r.id DESC LIMIT 1`,
    )
    .bind(userId, flowId)
    .first<{ id: number; release_id: number; started_at: string }>();
  if (!run) return null;
  const release = (await getRelease(db, flow, run.release_id))!;
  const { results } = await db
    .prepare("SELECT step_path, exit_index FROM tour_visits WHERE run_id = ? ORDER BY id")
    .bind(run.id)
    .all<{ step_path: string; exit_index: number | null }>();
  return { id: run.id, startedAt: run.started_at, release, log: results.map((r) => ({ step: r.step_path, exit: r.exit_index })) };
}

export type Started = { runId: number; version: string; flow: Flow; log: LogRow[] };

// "Iniciar recorrido" and "Continuar recorrido": resumes the open run, on
// the release it started on, or opens one on the latest release. After a
// finished run this is "Repetir recorrido": a new run, and the saved review
// is left alone. The answer carries the release's flow, which the browser
// draws. Null when the flow has no release.
export async function startTour(db: D1Database, userId: number, flowId: number, now: Date): Promise<Started | null> {
  let run = await openRun(db, userId, flowId);
  if (!run) {
    const flow = await getFlow(db, flowId);
    const release = flow && (await latestRelease(db, flow));
    if (!release) return null;
    // The partial unique index allows one open run per user and release.
    await db
      .prepare("INSERT INTO tour_runs (user_id, release_id, started_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
      .bind(userId, release.id, now.toISOString())
      .run();
    run = (await openRun(db, userId, flowId))!;
  }
  return { runId: run.id, version: version(run.release), flow: run.release.flow, log: run.log };
}

// One action of the tour. The row is written only if the log is still the
// one the action was checked against, so two tabs cannot interleave.
export async function takeStep(db: D1Database, userId: number, flowId: number, action: Action, now: Date): Promise<{ ok: true; row: LogRow } | Refused> {
  const run = await openRun(db, userId, flowId);
  if (!run) return { ok: false, error: NO_RUN };
  const tour = replay(run.release.flow, run.log);
  if (!tour) throw new Error(`Tour run ${run.id} does not replay`);
  const applied = apply(tour, action);
  if (!applied.ok) return { ok: false, error: RELOAD };
  const written = await db
    .prepare(
      `INSERT INTO tour_visits (run_id, step_path, exit_index, visited_at)
       SELECT ?1, ?2, ?3, ?4
       WHERE (SELECT count(*) FROM tour_visits WHERE run_id = ?1) = ?5
         AND EXISTS (SELECT 1 FROM tour_runs WHERE id = ?1 AND finished_at IS NULL)`,
    )
    .bind(run.id, applied.row.step, applied.row.exit, now.toISOString(), run.log.length)
    .run();
  if (written.meta.changes !== 1) return { ok: false, error: RELOAD };
  return { ok: true, row: applied.row };
}

// "Terminar recorrido". Allowed only when the engine allows it (every step
// visited, every branch taken, standing at a dead end or a decision) and
// once steps × 5 s have passed since the run started, on the server's
// clock. Too early, nothing is saved and the answer is only the warning.
// The duration is end minus start, pauses included: see DECISIONS.md,
// "Known flaw: tour duration is end minus start".
export type Finished = { ok: true; durationSeconds: number; newer: string | null };

export async function finishTour(db: D1Database, userId: number, flowId: number, now: Date): Promise<Finished | Refused> {
  const run = await openRun(db, userId, flowId);
  if (!run) return { ok: false, error: NO_RUN };
  const tour = replay(run.release.flow, run.log);
  if (!tour) throw new Error(`Tour run ${run.id} does not replay`);
  if (!tour.canFinish()) return { ok: false, error: RELOAD };
  const elapsed = now.getTime() - Date.parse(run.startedAt);
  if (elapsed < run.release.flow.steps.length * SECONDS_PER_STEP * 1000) return { ok: false, error: TOO_FAST };
  const durationSeconds = Math.floor(elapsed / 1000);
  const finishedAt = now.toISOString();
  const [closed] = await db.batch([
    db
      .prepare(
        `UPDATE tour_runs SET finished_at = ?2
         WHERE id = ?1 AND finished_at IS NULL AND (SELECT count(*) FROM tour_visits WHERE run_id = ?1) = ?3`,
      )
      .bind(run.id, finishedAt, run.log.length),
    // A repeated tour leaves the first review as it was.
    db
      .prepare(
        `INSERT INTO review_records (user_id, release_id, duration_seconds, completed_at)
         SELECT user_id, release_id, ?2, ?3 FROM tour_runs WHERE id = ?1 AND finished_at = ?3
         ON CONFLICT DO NOTHING`,
      )
      .bind(run.id, durationSeconds, finishedAt),
  ]);
  if (closed!.meta.changes !== 1) return { ok: false, error: RELOAD };
  return { ok: true, durationSeconds, newer: await newerVersion(db, flowId, run.release) };
}

// One line for a user who finishes a release that is no longer the latest,
// so that "Pendiente de revisión" after a major one does not look like a
// failure. A minor release keeps "Revisado", a major one does not (§8).
async function newerVersion(db: D1Database, flowId: number, toured: Release): Promise<string | null> {
  const latest = await db
    .prepare("SELECT major, minor FROM releases WHERE flow_id = ? ORDER BY major DESC, minor DESC LIMIT 1")
    .bind(flowId)
    .first<{ major: number; minor: number }>();
  if (!latest || (latest.major === toured.major && latest.minor === toured.minor)) return null;
  return latest.major > toured.major
    ? `Mientras lo recorrías se publicó la versión ${version(latest)}, con cambios importantes: esa versión queda pendiente de revisión.`
    : `Mientras lo recorrías se publicó la versión ${version(latest)}, con cambios menores: tu revisión sigue vigente.`;
}
