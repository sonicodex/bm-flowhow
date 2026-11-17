import { Router } from "./access.tsx";
import { AdminForm, AdminList, RowActions, yesNo } from "./admin.tsx";
import { COLOURS, createFlow, getFlow, saveFlowDetails, type FlowDetails } from "./flows.ts";

// The flows list, the new flow form and the flow form (phases 1.5, 4.4).
// Editors only (phase 4.2). Steps are edited, and imported, in the editor
// (src/editor.tsx).
export const flowsScreen = new Router();

type FlowItem = { id: number; name: string; colour: number; version: string | null; draft: number; areas: string | null };

async function listFlows(db: D1Database): Promise<FlowItem[]> {
  const { results } = await db
    .prepare(
      `SELECT f.id, f.name, f.colour,
         (SELECT major || '.' || minor FROM releases r WHERE r.flow_id = f.id ORDER BY major DESC, minor DESC LIMIT 1) AS version,
         EXISTS (SELECT 1 FROM drafts d WHERE d.flow_id = f.id) AS draft,
         (SELECT group_concat(name, ', ') FROM
           (SELECT a.name FROM flow_areas fa JOIN areas a ON a.id = fa.area_id WHERE fa.flow_id = f.id ORDER BY a.name_key)) AS areas
       FROM flows f ORDER BY f.name_key`,
    )
    .all<FlowItem>();
  return results;
}

function FlowsPage({ items }: { items: FlowItem[] }) {
  return (
    <AdminList
      title="Flujos"
      action={{ href: "/flows/new", label: "Nuevo flujo" }}
      columns={[{ label: "Nombre" }, { label: "Versión publicada" }, { label: "Borrador" }, { label: "Áreas" }]}
      empty={{
        purpose: "Aquí están los procesos de la empresa, cada uno con sus pasos, sus versiones y las áreas que lo ven.",
        howToAdd: "Todavía no hay ninguno. Crea el primero con «Nuevo flujo».",
      }}
      rows={items.map((f) => (
        <tr>
          <td>
            <a class={`admin-name flow-${f.colour}`} href={`/flows/${f.id}/edit`}>
              <span class="flow-dot" aria-hidden="true"></span>
              {f.name}
            </a>
          </td>
          <td>{f.version ?? "Sin publicar"}</td>
          <td>{yesNo(f.draft === 1)}</td>
          <td>{f.areas ?? "Ninguna"}</td>
          <RowActions>
            {f.version && (
              <a href={`/flows/${f.id}`} aria-label={`Ver ${f.name}`}>
                Ver
              </a>
            )}
            <a href={`/flows/${f.id}/edit`} aria-label={`Editar ${f.name}`}>
              Editar
            </a>
          </RowActions>
        </tr>
      ))}
    />
  );
}

const BACK = { href: "/flows", label: "Volver a flujos" };

function NewFlowPage({ value, error }: { value: string; error?: string }) {
  return (
    <AdminForm back={BACK} title="Nuevo flujo" error={error} action="/flows" submit="Crear flujo">
      <label for="flow-name">Nombre</label>
      <input id="flow-name" name="name" value={value} required maxlength={100} />
      <p class="muted">Nace sin publicar. En «Editar» le das sus pasos, y desde ahí, en «Datos del flujo», su objetivo, color y áreas.</p>
    </AdminForm>
  );
}

flowsScreen.get("/", "editor", async (c) => c.render(<FlowsPage items={await listFlows(c.env.DB)} />, { title: "Flujos" }));

flowsScreen.get("/new", "editor", (c) => c.render(<NewFlowPage value="" />, { title: "Nuevo flujo" }));

flowsScreen.post("/", "editor", async (c) => {
  const name = String((await c.req.parseBody()).name ?? "");
  const r = await createFlow(c.env.DB, name);
  if (r.ok === false) {
    c.status(422);
    return c.render(<NewFlowPage value={name.trim()} error={r.error} />, { title: "Nuevo flujo" });
  }
  return c.redirect("/flows", 303);
});

async function flowOf(c: { env: Env; req: { param: (k: string) => string | undefined } }) {
  const id = Number(c.req.param("id"));
  return Number.isSafeInteger(id) && id > 0 ? getFlow(c.env.DB, id) : null;
}

// The flow form (SPEC §6 "Flow form"; phases 4.4 and 5.1): name, objective,
// colour and the areas whose Empleados see it. Editors only.
type AreaOption = { id: number; name: string };

// Saving a published flow with no area is allowed (DECISIONS, phase 4.4), but
// it leaves every Empleado without it, so the page says so. A draft is left
// out: publishing it asks for an area anyway.
export const NO_AREAS_WARNING =
  "Este flujo publicado quedó sin áreas, así que ningún Empleado lo verá. Solo lo verán los Líderes y la Junta directiva.";

function DetailsPage({
  flow,
  values,
  areas,
  error,
  saved,
  warning,
}: {
  flow: { id: number; name: string };
  values: FlowDetails;
  areas: AreaOption[];
  error?: string;
  saved?: boolean;
  warning?: string | null;
}) {
  return (
    <AdminForm
      back={{ href: `/flows/${flow.id}/edit`, label: "Volver al editor" }}
      title={flow.name}
      error={error}
      notice={saved ? "Cambios guardados." : undefined}
      warning={warning}
      action={`/flows/${flow.id}/details`}
      submit="Guardar"
    >
      <label for="flow-name">Nombre</label>
      <input id="flow-name" name="name" value={values.name} required maxlength={100} />
      <label for="flow-objective">Objetivo</label>
      <textarea id="flow-objective" name="objective" rows={3}>
        {values.objective}
      </textarea>
      <fieldset class="choice-list">
        <legend>Color</legend>
        <p class="muted">Pinta el flujo en el diagrama y en el recorrido. Cambiarlo no crea una versión nueva.</p>
        <div class="swatches">
          {Array.from({ length: COLOURS }, (_, i) => i + 1).map((n) => (
            <input type="radio" name="colour" value={String(n)} class={`swatch flow-${n}`} aria-label={`Color ${n}`} checked={values.colour === n} />
          ))}
        </div>
      </fieldset>
      <fieldset class="choice-list">
        <legend>Áreas</legend>
        <p class="muted">Los Empleados de estas áreas verán el flujo publicado. Hace falta al menos una para publicarlo por primera vez.</p>
        {areas.length ? (
          areas.map((a) => (
            <label>
              <input type="checkbox" name="area" value={String(a.id)} checked={values.areaIds.includes(a.id)} /> {a.name}
            </label>
          ))
        ) : (
          <p class="muted">
            Todavía no hay áreas. <a href="/areas/new">Crea una</a>.
          </p>
        )}
      </fieldset>
    </AdminForm>
  );
}

const listAreaOptions = async (db: D1Database) => (await db.prepare("SELECT id, name FROM areas ORDER BY name_key").all<AreaOption>()).results;

flowsScreen.get("/:id{[0-9]+}/details", "editor", async (c) => {
  const db = c.env.DB;
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const { results } = await db.prepare("SELECT area_id FROM flow_areas WHERE flow_id = ?").bind(flow.id).all<{ area_id: number }>();
  const values = { name: flow.name, objective: flow.objective, colour: flow.colour, areaIds: results.map((r) => r.area_id) };
  const saved = c.req.query("guardado") === "1";
  const published = saved && !!(await db.prepare("SELECT 1 FROM releases WHERE flow_id = ?").bind(flow.id).first());
  const warning = published && values.areaIds.length === 0 ? NO_AREAS_WARNING : null;
  return c.render(<DetailsPage flow={flow} values={values} areas={await listAreaOptions(db)} saved={saved} warning={warning} />, {
    title: flow.name,
  });
});

flowsScreen.post("/:id{[0-9]+}/details", "editor", async (c) => {
  const db = c.env.DB;
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const form = await c.req.parseBody({ all: true });
  const one = (v: unknown) => String((Array.isArray(v) ? v[0] : v) ?? "");
  const list = (v: unknown) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  const values: FlowDetails = {
    name: one(form.name),
    objective: one(form.objective),
    colour: Number(one(form.colour)),
    areaIds: list(form.area).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0),
  };
  const result = await saveFlowDetails(db, flow.id, values);
  if (result.ok === false) {
    c.status(422);
    return c.render(<DetailsPage flow={flow} values={values} areas={await listAreaOptions(db)} error={result.error} />, { title: flow.name });
  }
  return c.redirect(`/flows/${flow.id}/details?guardado=1`, 303);
});
