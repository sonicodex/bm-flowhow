import { Hono } from "hono";
import { raw } from "hono/html";
import type { Flow } from "../public/js/core.js";
import type { Action } from "../public/js/tour-log.js";
import { currentUser } from "./current-user.ts";
import { getFlow, latestRelease, type FlowRow } from "./flows.ts";
import { finishTour, startTour, takeStep } from "./tour.ts";

// The flow viewer, overview mode (SPEC §7; phase 2.4). Users always see the
// latest release, never a draft (§8). The tour comes in phase 3, and access
// by area and role in phase 4.
export const viewer = new Hono<{ Bindings: Env }>();

// JSON inside <script>: "<" is escaped so no text in a step can close it.
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

function ViewerPage({ flow, compiled }: { flow: FlowRow; compiled: Flow }) {
  const steps = compiled.steps.length;
  return (
    <section class={`viewer flow-${flow.colour}`}>
      <div class="viewer-head">
        <h1 class="viewer-title">
          <span class="flow-dot" aria-hidden="true"></span>
          {flow.name}
        </h1>
        {flow.objective && <p class="muted">{flow.objective}</p>}
      </div>
      <div class="viewer-cols">
        <div class="card diagram-card">
          <div class="diagram-scroll" id="diagram">
            <noscript>
              <p class="form-error">El diagrama necesita JavaScript.</p>
            </noscript>
          </div>
          <div class="diagram-actions">
            {/* The tour arrives in phase 3; until then the button does nothing. */}
            <button type="button" class="button-primary">Iniciar recorrido</button>
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
        {raw(scriptJson({ name: flow.name, colour: flow.colour, flow: compiled }))}
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
  return c.render(<ViewerPage flow={flow} compiled={release.flow} />, { title: flow.name });
});

// The tour (phase 3.2). JSON in and out; the server's clock, never the
// browser's. A refused action answers 409 with the message to show.
const flowId = (c: { req: { param: (name: "id") => string } }) => Number(c.req.param("id"));

function readAction(body: unknown): Action | null {
  if (typeof body !== "object" || body === null) return null;
  const { at, action, exit } = body as Record<string, unknown>;
  if (typeof at !== "string") return null;
  if (action === "next" || action === "skip") return { at, action };
  if (action === "choose" && Number.isInteger(exit)) return { at, action, exit: exit as number };
  return null;
}

viewer.post("/:id{[0-9]+}/tour", async (c) => {
  const user = await currentUser(c);
  const run = await startTour(c.env.DB, user.id, flowId(c), new Date());
  if (!run) return c.notFound();
  return c.json(run);
});

viewer.post("/:id{[0-9]+}/tour/step", async (c) => {
  const action = readAction(await c.req.json().catch(() => null));
  if (!action) return c.json({ error: "Acción no válida." }, 400);
  const user = await currentUser(c);
  const result = await takeStep(c.env.DB, user.id, flowId(c), action, new Date());
  if (result.ok === false) return c.json({ error: result.error }, 409);
  return c.json({ row: result.row });
});

viewer.post("/:id{[0-9]+}/tour/finish", async (c) => {
  const user = await currentUser(c);
  const result = await finishTour(c.env.DB, user.id, flowId(c), new Date());
  if (result.ok === false) return c.json({ error: result.error }, 409);
  return c.json({ durationSeconds: result.durationSeconds });
});
