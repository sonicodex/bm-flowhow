import type { RowError } from "../public/js/core.js";
import { Router } from "./access.tsx";
import { createFlow, getFlow, saveFlowDetails, type FlowDetails } from "./flows.ts";
import { applyGrid, parseGrid, reviewGrid, type NewTag, type Review } from "./import.ts";

// Provisional flows and import screens (phase 1.5): a scaffold to exercise
// the import contract. Phase 5 replaces them with the editor. Editors
// only (phase 4.2). They only reuse the existing app.css classes.
export const flowsScreen = new Router();

type FlowItem = { id: number; name: string; version: string | null; draft: number };

async function listFlows(db: D1Database): Promise<FlowItem[]> {
  const { results } = await db
    .prepare(
      `SELECT f.id, f.name,
         (SELECT major || '.' || minor FROM releases r WHERE r.flow_id = f.id ORDER BY major DESC, minor DESC LIMIT 1) AS version,
         EXISTS (SELECT 1 FROM drafts d WHERE d.flow_id = f.id) AS draft
       FROM flows f ORDER BY f.name`,
    )
    .all<FlowItem>();
  return results;
}

function FlowsPage({ items, error, value }: { items: FlowItem[]; error?: string; value?: string }) {
  return (
    <>
      <h1 class="page-title">Flujos</h1>
      {items.length ? (
        <ul class="plain-list">
          {items.map((f) => (
            <li>
              {f.name} — {f.version ? `publicado en ${f.version}` : "sin publicar"}
              {f.draft ? ", con borrador" : ""}
              {f.version ? (
                <>
                  {" · "}
                  <a href={`/flows/${f.id}`}>Ver</a>
                </>
              ) : null}
              {" · "}
              <a href={`/flows/${f.id}/details`}>Datos</a>
              {" · "}
              <a href={`/flows/${f.id}/import`}>Importar</a>
            </li>
          ))}
        </ul>
      ) : (
        <p class="muted">Todavía no hay flujos.</p>
      )}
      <form method="post" action="/flows" class="inline-form">
        <label for="flow-name">Nuevo flujo</label>
        <input id="flow-name" name="name" value={value ?? ""} required maxlength={100} />
        <button type="submit" class="button-primary">Crear</button>
      </form>
      {error && <p class="form-error" role="alert">{error}</p>}
    </>
  );
}

flowsScreen.get("/", "editor", async (c) => c.render(<FlowsPage items={await listFlows(c.env.DB)} />, { title: "Flujos" }));

flowsScreen.post("/", "editor", async (c) => {
  const name = String((await c.req.parseBody()).name ?? "");
  const r = await createFlow(c.env.DB, name);
  if (r.ok === false) {
    c.status(422);
    return c.render(<FlowsPage items={await listFlows(c.env.DB)} error={r.error} value={name.trim()} />, { title: "Flujos" });
  }
  return c.redirect("/flows", 303);
});

function ImportPage({ flow, done }: { flow: { id: number; name: string }; done?: boolean }) {
  return (
    <>
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
      <p>
        <a href="/flows">Volver a flujos</a>
      </p>
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
      <p>
        <a href={`/flows/${flow.id}/import`}>Volver a importar</a>
      </p>
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

// The flow form (SPEC §6 "Flow form"; phase 4.4): name, objective and the
// areas whose Empleados see it. Editors only.
type AreaOption = { id: number; name: string };

function DetailsPage({ flow, values, areas, error, saved }: { flow: { id: number; name: string }; values: FlowDetails; areas: AreaOption[]; error?: string; saved?: boolean }) {
  return (
    <>
      <h1 class="page-title">Datos: {flow.name}</h1>
      {error && (
        <p class="form-error" role="alert">
          {error}
        </p>
      )}
      {saved && <p role="status">Cambios guardados.</p>}
      <form method="post" action={`/flows/${flow.id}/details`} class="stacked-form admin-form">
        <label for="flow-name">Nombre</label>
        <input id="flow-name" name="name" value={values.name} required maxlength={100} />
        <label for="flow-objective">Objetivo</label>
        <textarea id="flow-objective" name="objective" rows={3}>
          {values.objective}
        </textarea>
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
              Todavía no hay áreas. <a href="/areas">Crea una</a>.
            </p>
          )}
        </fieldset>
        <button type="submit" class="button-primary">
          Guardar
        </button>
      </form>
      <p>
        <a href="/flows">Volver a flujos</a>
      </p>
    </>
  );
}

const listAreaOptions = async (db: D1Database) => (await db.prepare("SELECT id, name FROM areas ORDER BY name_key").all<AreaOption>()).results;

flowsScreen.get("/:id{[0-9]+}/details", "editor", async (c) => {
  const db = c.env.DB;
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const { results } = await db.prepare("SELECT area_id FROM flow_areas WHERE flow_id = ?").bind(flow.id).all<{ area_id: number }>();
  const values = { name: flow.name, objective: flow.objective, areaIds: results.map((r) => r.area_id) };
  return c.render(<DetailsPage flow={flow} values={values} areas={await listAreaOptions(db)} saved={c.req.query("guardado") === "1"} />, {
    title: `Datos ${flow.name}`,
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
    areaIds: list(form.area).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0),
  };
  const result = await saveFlowDetails(db, flow.id, values);
  if (result.ok === false) {
    c.status(422);
    return c.render(<DetailsPage flow={flow} values={values} areas={await listAreaOptions(db)} error={result.error} />, { title: `Datos ${flow.name}` });
  }
  return c.redirect(`/flows/${flow.id}/details?guardado=1`, 303);
});
