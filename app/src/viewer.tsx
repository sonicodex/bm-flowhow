import { Hono } from "hono";
import { raw } from "hono/html";
import type { Flow } from "../public/js/core.js";
import type { Action } from "../public/js/tour-log.js";
import { getFlow, latestRelease, type FlowRow } from "./flows.ts";
import { userOf, type AppEnv } from "./session.ts";
import { finishTour, restartTour, reviewStatus, startTour, takeStep, type ReviewState, type ReviewStatus } from "./tour.ts";

// The flow viewer (SPEC §7): the overview (phase 2.4) and the tour (phase 3).
// Users always see the latest release, never a draft (§8); a tour already
// started finishes on its own release. Access by area and role comes in
// phase 4.2.
export const viewer = new Hono<AppEnv>();

// JSON inside <script>: "<" is escaped so no text in a step can close it.
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

// public/js/viewer.js draws the same line again when the status changes.
const STATUS_ICONS: Record<ReviewState, string> = { pending: "pending", in_progress: "in_progress", reviewed: "done" };

function StatusLine({ status }: { status: ReviewStatus }) {
  return (
    <p class="review-status" id="review-status" data-state={status.state}>
      <img class="icon" src={`/icons/${STATUS_ICONS[status.state]}.svg`} alt="" width="18" height="18" />
      <strong>{status.label}</strong>
      {status.detail && <span class="muted">{status.detail}</span>}
    </p>
  );
}

function ViewerPage({ flow, compiled, status }: { flow: FlowRow; compiled: Flow; status: ReviewStatus }) {
  const steps = compiled.steps.length;
  return (
    <section class={`viewer flow-${flow.colour}`}>
      <div class="viewer-head">
        <h1 class="viewer-title">
          <span class="flow-dot" aria-hidden="true"></span>
          {flow.name}
        </h1>
        {flow.objective && <p class="muted">{flow.objective}</p>}
        <StatusLine status={status} />
      </div>
      <div class="viewer-cols">
        <div class="card diagram-card">
          <div class="diagram-scroll" id="diagram">
            <noscript>
              <p class="form-error">El diagrama necesita JavaScript.</p>
            </noscript>
          </div>
          <div class="diagram-actions">
            {/* public/js/viewer.js turns the page into the tour, and asks
                before "Empezar de nuevo" (phase 3.5). */}
            <button type="button" class="button-secondary" data-restart hidden={!status.open}>
              Empezar de nuevo
            </button>
            <button type="button" class="button-primary" data-start>
              {status.action}
            </button>
          </div>
        </div>
        <aside class="card viewer-side">
          <p class="eyebrow">PANORAMA</p>
          <h2 class="step-title">El flujo completo</h2>
          <p>Míralo de arriba abajo para ubicarte. Después lo recorrerás un paso a la vez.</p>
          <p class="muted">{steps === 1 ? "1 paso" : `${steps} pasos`}</p>
        </aside>
      </div>
      <script type="application/json" id="flow-data">
        {raw(scriptJson({ id: flow.id, name: flow.name, colour: flow.colour, flow: compiled, status }))}
      </script>
      <script type="module" src="/js/viewer.js"></script>
    </section>
  );
}

viewer.get("/:id{[0-9]+}", async (c) => {
  const flow = await getFlow(c.env.DB, Number(c.req.param("id")));
  if (!flow) return c.notFound();
  const release = await latestRelease(c.env.DB, flow);
  if (!release) return c.notFound();
  const user = userOf(c);
  const status = await reviewStatus(c.env.DB, user.id, flow.id, release);
  return c.render(<ViewerPage flow={flow} compiled={release.flow} status={status} />, { title: flow.name });
});

// The tour (phase 3.2). JSON in and out; the server's clock, never the
// browser's. A refused action answers 409 with the message to show.
const flowId = (c: { req: { param: (name: "id") => string } }) => Number(c.req.param("id"));

// The status after starting or finishing, so the page can redraw it.
async function statusOf(db: D1Database, userId: number, id: number) {
  const flow = (await getFlow(db, id))!;
  return reviewStatus(db, userId, id, (await latestRelease(db, flow))!);
}

function readAction(body: unknown): Action | null {
  if (typeof body !== "object" || body === null) return null;
  const { at, action, exit, back } = body as Record<string, unknown>;
  if (typeof at !== "string") return null;
  if (back !== undefined) {
    // A different branch on a decision "Anterior" came back to (phase 3.6).
    if (action === "choose" && Number.isInteger(exit) && Number.isInteger(back)) return { at, action, exit: exit as number, back: back as number };
    return null;
  }
  if (action === "next" || action === "skip") return { at, action };
  if (action === "choose" && Number.isInteger(exit)) return { at, action, exit: exit as number };
  return null;
}

viewer.post("/:id{[0-9]+}/tour", async (c) => {
  const user = userOf(c);
  const run = await startTour(c.env.DB, user.id, flowId(c), new Date());
  if (!run) return c.notFound();
  return c.json({ ...run, status: await statusOf(c.env.DB, user.id, flowId(c)) });
});

viewer.post("/:id{[0-9]+}/tour/restart", async (c) => {
  const user = userOf(c);
  const run = await restartTour(c.env.DB, user.id, flowId(c), new Date());
  if (!run) return c.notFound();
  return c.json({ ...run, status: await statusOf(c.env.DB, user.id, flowId(c)) });
});

viewer.post("/:id{[0-9]+}/tour/step", async (c) => {
  const action = readAction(await c.req.json().catch(() => null));
  if (!action) return c.json({ error: "Acción no válida." }, 400);
  const user = userOf(c);
  const result = await takeStep(c.env.DB, user.id, flowId(c), action, new Date());
  if (result.ok === false) return c.json({ error: result.error }, 409);
  return c.json({ row: result.row });
});

viewer.post("/:id{[0-9]+}/tour/finish", async (c) => {
  const user = userOf(c);
  const result = await finishTour(c.env.DB, user.id, flowId(c), new Date());
  if (result.ok === false) return c.json({ error: result.error }, 409);
  const status = await statusOf(c.env.DB, user.id, flowId(c));
  return c.json({ durationSeconds: result.durationSeconds, newer: result.newer, status });
});
