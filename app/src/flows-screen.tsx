import type { RowError } from "../public/js/core.js";
import { Router } from "./access.tsx";
import { AdminForm, AdminList, RowActions, yesNo } from "./admin.tsx";
import { COLOURS, createFlow, getFlow, saveFlowDetails, type FlowDetails } from "./flows.ts";
import { applyGrid, parseGrid, reviewGrid, type NewTag, type Review } from "./import.ts";

// Provisional flows and import screens (phase 1.5): a scaffold to exercise
// the import contract. Phase 5 replaces them with the editor. Editors
// only (phase 4.2). They only reuse the existing app.css classes.
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
            <a class={`admin-name flow-${f.colour}`} href={`/flows/${f.id}/details`}>
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
            <a href={`/flows/${f.id}/details`} aria-label={`Editar ${f.name}`}>
              Editar
            </a>
            <a href={`/flows/${f.id}/import`} aria-label={`Importar a ${f.name}`}>
              Importar
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
      <p class="muted">Nace sin publicar. Después le das objetivo y áreas en «Editar», y sus pasos en «Importar».</p>
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

function ImportPage({ flow, done }: { flow: { id: number; name: string }; done?: boolean }) {
  return (
    <>
      <p class="admin-back">
        <a href={BACK.href}>← {BACK.label}</a>
      </p>
      <h1 class="page-title">Importar: {flow.name}</h1>
      {done && <p role="status">Importado al borrador. No se publicó.</p>}
      <p class="muted">La importación reemplaza todo el borrador y siempre pasa por una revisión antes de guardarse.</p>
      <form method="post" action={`/flows/${flow.id}/import/review`} data-import>
        <p>
          <label for="paste">Pega aquí las celdas copiadas de Excel, con la fila de encabezados:</label>
          <br />
          <textarea id="paste" name="paste" rows={10} cols={80}></textarea>
        </p>
        <p>
          <label for="file">O elige un archivo .xlsx (se lee la hoja «Flujo»; si eliges archivo, se ignora lo pegado):</label>
          <br />
          <input id="file" name="file" type="file" accept=".xlsx" />
        </p>
        <input type="hidden" name="grid" />
        <ul class="plain-list form-error" role="alert" data-errors hidden></ul>
        <noscript>
          <p class="form-error">Esta pantalla necesita JavaScript para leer lo pegado o el archivo.</p>
        </noscript>
        <button type="submit" class="button-primary">Revisar</button>
      </form>
      <script type="module" src="/js/import-form.js"></script>
    </>
  );
}

function ErrorList({ errors }: { errors: RowError[] }) {
  return (
    <ul class="plain-list">
      {errors.map((e) => (
        <li class={e.blocking ? "form-error" : undefined}>
          {e.message} {e.blocking ? "(bloquea la importación)" : "(bloquea solo la publicación)"}
        </li>
      ))}
    </ul>
  );
}

const tagValue = (t: NewTag) => JSON.stringify([t.category, t.name]);

function ReviewPage({ flow, review, grid }: { flow: { id: number; name: string }; review: Review; grid: string }) {
  return (
    <>
      <p class="admin-back">
        <a href={`/flows/${flow.id}/import`}>← Volver a importar</a>
      </p>
      <h1 class="page-title">Revisión: {flow.name}</h1>
      <p>
        {review.flow.steps.length} pasos{review.flow.categories.length ? `; categorías: ${review.flow.categories.join(", ")}` : ""}.
      </p>
      {review.errors.length ? <ErrorList errors={review.errors} /> : <p>Sin errores.</p>}
      {review.blocking ? (
        <p class="form-error" role="alert">
          No se puede importar: corrige en Excel las filas marcadas y vuelve a pegarlas.
        </p>
      ) : (
        <form method="post" action={`/flows/${flow.id}/import/apply`}>
          <input type="hidden" name="grid" value={grid} />
          {review.newCategories.length > 0 && (
            <fieldset>
              <legend>Categorías nuevas (las no marcadas se descartan con su columna)</legend>
              {review.newCategories.map((cat) => (
                <label>
                  <input type="checkbox" name="category" value={cat} checked /> {cat}{" "}
                </label>
              ))}
            </fieldset>
          )}
          {review.newTags.length > 0 && (
            <fieldset>
              <legend>Etiquetas nuevas (las no marcadas se descartan)</legend>
              {review.newTags.map((t) => (
                <label>
                  <input type="checkbox" name="tag" value={tagValue(t)} checked /> {t.category}: {t.name}{" "}
                </label>
              ))}
            </fieldset>
          )}
          <p>
            <button type="submit" class="button-primary">Importar al borrador</button>
          </p>
        </form>
      )}
    </>
  );
}

async function flowOf(c: { env: Env; req: { param: (k: string) => string | undefined } }) {
  const id = Number(c.req.param("id"));
  return Number.isSafeInteger(id) && id > 0 ? getFlow(c.env.DB, id) : null;
}

function readGrid(raw: unknown) {
  try {
    return parseGrid(JSON.parse(String(raw ?? "")));
  } catch {
    return { ok: false as const, error: "El grid no tiene la forma esperada: no es JSON." };
  }
}

flowsScreen.get("/:id/import", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  return c.render(<ImportPage flow={flow} done={c.req.query("done") === "1"} />, { title: `Importar ${flow.name}` });
});

flowsScreen.post("/:id/import/review", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const parsed = readGrid((await c.req.parseBody()).grid);
  if (parsed.ok === false) return c.text(parsed.error, 400);
  const review = await reviewGrid(c.env.DB, flow.id, parsed.grid);
  if (review.blocking) c.status(422);
  return c.render(<ReviewPage flow={flow} review={review} grid={JSON.stringify(parsed.grid)} />, { title: `Revisión ${flow.name}` });
});

flowsScreen.post("/:id/import/apply", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const form = await c.req.parseBody({ all: true });
  const parsed = readGrid(form.grid);
  if (parsed.ok === false) return c.text(parsed.error, 400);
  const list = (v: unknown) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map(String);
  const tags: NewTag[] = [];
  for (const raw of list(form.tag)) {
    try {
      const [category, name] = JSON.parse(raw) as unknown[];
      if (typeof category === "string" && typeof name === "string") tags.push({ category, name });
    } catch {
      // Not ours: an unreadable choice is treated as rejected.
    }
  }
  const result = await applyGrid(c.env.DB, flow.id, parsed.grid, { categories: list(form.category), tags });
  if (result.ok) return c.redirect(`/flows/${flow.id}/import?done=1`, 303);
  // Blocked since the review (e.g. a target flow was deleted): review again.
  c.status(422);
  const review = await reviewGrid(c.env.DB, flow.id, parsed.grid);
  return c.render(<ReviewPage flow={flow} review={review} grid={JSON.stringify(parsed.grid)} />, { title: `Revisión ${flow.name}` });
});

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
      back={BACK}
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
