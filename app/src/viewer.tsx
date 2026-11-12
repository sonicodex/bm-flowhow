import { Hono } from "hono";
import { raw } from "hono/html";
import type { Flow } from "../public/js/core.js";
import { documentToFlow, loadTagIndex, type FlowDocument } from "./document.ts";
import { getFlow, type FlowRow } from "./flows.ts";

// The flow viewer, overview mode (SPEC §7; phase 2.4). Users always see the
// latest release, never a draft (§8). The tour comes in phase 3, and access
// by area and role in phase 4.
export const viewer = new Hono<{ Bindings: Env }>();

type Release = { major: number; minor: number; document: string };

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
  const release = await c.env.DB.prepare(
    "SELECT major, minor, document FROM releases WHERE flow_id = ? ORDER BY major DESC, minor DESC LIMIT 1",
  )
    .bind(flow.id)
    .first<Release>();
  if (!release) return c.notFound();
  const document = JSON.parse(release.document) as FlowDocument;
  const compiled = documentToFlow(flow.name, flow.objective, document, await loadTagIndex(c.env.DB));
  return c.render(<ViewerPage flow={flow} compiled={compiled} />, { title: flow.name });
});
