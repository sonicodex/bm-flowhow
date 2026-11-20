import { raw } from "hono/html";
import type { Flow } from "../public/js/core.js";
import type { Action } from "../public/js/tour-log.js";
import { getFlow, latestRelease, type FlowRow } from "./flows.ts";
import { Router, visibleFlows, type VisibleFlow } from "./access.tsx";
import { scriptJson } from "./layout.tsx";
import { userOf, type SessionUser } from "./session.ts";
import { StatusLine } from "./status.tsx";
import { finishTour, restartTour, reviewStatus, startTour, takeStep, type ReviewStatus } from "./tour.ts";

// The flow viewer (SPEC §7): the overview (phase 2.4) and the tour (phase 3).
// Users always see the latest release, never a draft (§8); a tour already
// started finishes on its own release. Every route is "flow": a flow the
// user may not see answers 404 (src/access.tsx).
export const viewer = new Router();

// Where each link step of `flow` leads (SPEC §5, §7; phase 6.4), by target
// flow id: its current name, which is shown whether or not the user can open
// it, and whether they can. Only what a link names is sent: nothing else
// about a flow the user cannot see.
export type LinkTargets = Record<number, { name: string; open: boolean }>;

export async function linkTargets(
  db: D1Database,
  user: Pick<SessionUser, "id" | "role">,
  flow: Flow,
  known?: VisibleFlow[],
): Promise<LinkTargets> {
  const ids = [...new Set(flow.steps.filter((s) => s.type === "link" && s.ref !== null).map((s) => s.ref!))];
  if (!ids.length) return {};
  const [names, visible] = await Promise.all([
    db
      .prepare(`SELECT id, name FROM flows WHERE id IN (${ids.map(() => "?").join(", ")})`)
      .bind(...ids)
      .all<{ id: number; name: string }>(),
    known ?? visibleFlows(db, user),
  ]);
  const open = new Set(visible.map((f) => f.id));
  return Object.fromEntries(names.results.map((r) => [r.id, { name: r.name, open: open.has(r.id) }]));
}

// The flow selector (SPEC §7, Flow selector; phase 6.7): the flows this
// user sees, as on the home screen. A Standard user gets it only with more
// than one; the Board and Leaders always. Subflows are out of stage 1, so
// none is listed. public/js/viewer.js opens the chosen flow.
export const showsSelector = (role: SessionUser["role"], flows: number) => role !== "standard" || flows > 1;

function FlowSelector({ current, flows }: { current: number; flows: VisibleFlow[] }) {
  return (
    <div class="flow-selector">
      <label for="flow-select">Flujo</label>
      <select id="flow-select" data-flow-select>
        {flows.map((f) => (
          <option value={String(f.id)} selected={f.id === current}>
            {f.name}
          </option>
        ))}
      </select>
    </div>
  );
}

type PageProps = { flow: FlowRow; compiled: Flow; status: ReviewStatus; links: LinkTargets; selector: VisibleFlow[] | null };

function ViewerPage({ flow, compiled, status, links, selector }: PageProps) {
  const steps = compiled.steps.length;
  return (
    <section class={`viewer flow-${flow.colour}`}>
      {/* One title line (SPEC §7, Layout; phase 9.2): the flow and its
          state on the left, the selector at the right end. */}
      <div class="viewer-titleline">
        <div class="viewer-head">
          <h1 class="viewer-title">
            <span class="flow-dot" aria-hidden="true"></span>
            {flow.name}
          </h1>
          <StatusLine status={status} id="review-status" />
        </div>
        {selector && <FlowSelector current={flow.id} flows={selector} />}
      </div>
      {/* One card holds the viewer; the step panel is a card inside it
          (app.css lays the rows, the diagram and the panel out on a grid). */}
      <div class="card viewer-cols">
        <div class="diagram-card">
          <div class="diagram-scroll" id="diagram">
            <noscript>
              <p class="form-error">El diagrama necesita JavaScript.</p>
            </noscript>
          </div>
        </div>
        {/* The overview's panel is a card of its own (SPEC §7, Layout;
            phase 8.5): the flow, what the reader is looking at, how many
            steps it has, and its button at the foot. */}
        <aside class="card viewer-side">
          <p class="eyebrow">PANORAMA</p>
          <h2 class="step-title">{flow.name}</h2>
          <p>Estás viendo el flujo completo. Míralo de arriba abajo para ubicarte; después lo recorrerás un paso a la vez.</p>
          {flow.objective && <p class="viewer-objective">{flow.objective}</p>}
          <p class="muted">{steps === 1 ? "1 paso" : `${steps} pasos`}</p>
          <div class="step-actions">
            {/* public/js/viewer.js turns the page into the tour, and asks
                before "Empezar de nuevo" (phase 3.5). */}
            <button type="button" class="button-secondary" data-restart hidden={!status.open}>
              Empezar de nuevo
            </button>
            {/* The free review, unlocked once the flow is reviewed (§7). */}
            <button type="button" class="button-secondary" data-review hidden={status.state !== "reviewed"}>
              Repaso libre
            </button>
            <button type="button" class="button-primary" data-start>
              {status.action}
            </button>
          </div>
        </aside>
      </div>
      <script type="application/json" id="flow-data">
        {raw(scriptJson({ id: flow.id, name: flow.name, colour: flow.colour, flow: compiled, status, links }))}
      </script>
      <script type="module" src="/js/viewer.js"></script>
    </section>
  );
}

viewer.get("/:id{[0-9]+}", "flow", async (c) => {
  const flow = await getFlow(c.env.DB, Number(c.req.param("id")));
  if (!flow) return c.notFound();
  const release = await latestRelease(c.env.DB, flow);
  if (!release) return c.notFound();
  const user = userOf(c);
  const visible = await visibleFlows(c.env.DB, user);
  const [status, links] = await Promise.all([reviewStatus(c.env.DB, user.id, flow.id, release), linkTargets(c.env.DB, user, release.flow, visible)]);
  const selector = showsSelector(user.role, visible.length) ? visible : null;
  return c.render(<ViewerPage flow={flow} compiled={release.flow} status={status} links={links} selector={selector} />, { title: flow.name, page: "viewer" });
});

// The tour (phase 3.2). JSON in and out; the server's clock, never the
// browser's. A refused action answers 409 with the message to show.
const flowId = (c: { req: { param: (name: string) => string | undefined } }) => Number(c.req.param("id"));

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

viewer.post("/:id{[0-9]+}/tour", "flow", async (c) => {
  const user = userOf(c);
  const run = await startTour(c.env.DB, user.id, flowId(c), new Date());
  if (!run) return c.notFound();
  // The run's release may be older than the page's: its links go with it.
  return c.json({ ...run, links: await linkTargets(c.env.DB, user, run.flow), status: await statusOf(c.env.DB, user.id, flowId(c)) });
});

viewer.post("/:id{[0-9]+}/tour/restart", "flow", async (c) => {
  const user = userOf(c);
  const run = await restartTour(c.env.DB, user.id, flowId(c), new Date());
  if (!run) return c.notFound();
  return c.json({ ...run, links: await linkTargets(c.env.DB, user, run.flow), status: await statusOf(c.env.DB, user.id, flowId(c)) });
});

viewer.post("/:id{[0-9]+}/tour/step", "flow", async (c) => {
  const action = readAction(await c.req.json().catch(() => null));
  if (!action) return c.json({ error: "Acción no válida." }, 400);
  const user = userOf(c);
  const result = await takeStep(c.env.DB, user.id, flowId(c), action, new Date());
  if (result.ok === false) return c.json({ error: result.error }, 409);
  return c.json({ row: result.row });
});

viewer.post("/:id{[0-9]+}/tour/finish", "flow", async (c) => {
  const user = userOf(c);
  const result = await finishTour(c.env.DB, user.id, flowId(c), new Date());
  if (result.ok === false) return c.json({ error: result.error }, 409);
  const status = await statusOf(c.env.DB, user.id, flowId(c));
  return c.json({ durationSeconds: result.durationSeconds, newer: result.newer, status });
});
