import { raw } from "hono/html";
import { Router } from "./access.tsx";
import { AdminForm, AdminList, RowActions, yesNo } from "./admin.tsx";
import { loadTagIndex } from "./document.ts";
import { createFlow, flowEntries, getFlow, newFlowNameError, nextColour, saveFlowAreas, saveFlowField, type FlowField } from "./flows.ts";
import { parseAccepted } from "./draft.ts";
import { applyGrid, parseGrid, reviewGrid } from "./import.ts";
import { scriptJson } from "./layout.tsx";

// The flows list, the new flow form, and what the editor's flow data panel
// saves (phases 1.5, 4.4; SPEC §6). Editors only (phase 4.2). Steps are
// edited, and imported, in the editor (src/editor.tsx).
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
      more={{ href: "/flows/import", label: "Importar flujo" }}
      related={{ href: "/categories", label: "Categorías de etiquetas", why: "Cada una es una columna de etiquetas en la tabla de un flujo." }}
      columns={[{ label: "Nombre" }, { label: "Versión publicada" }, { label: "Borrador" }, { label: "Áreas" }]}
      empty={{
        purpose: "Aquí están los procesos de la empresa, cada uno con sus pasos, sus versiones y las áreas que lo ven.",
        howToAdd: "Todavía no hay ninguno. Crea el primero con «Nuevo flujo», o tráelo de Excel con «Importar flujo».",
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
      <p class="muted">Nace sin publicar. Al crearlo pasas a su editor, donde le das sus pasos; su objetivo, color y áreas están ahí mismo, en «Datos del flujo».</p>
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
  // A new flow has no steps: its editor is where they are written or
  // imported (phase 5.9).
  return c.redirect(`/flows/${r.id}/edit?creado=1`, 303);
});

// «Importar flujo» (SPEC §9, Navigation; phase 8.3): a flow made from a
// paste or an .xlsx, as the areas and users are. The browser reads the
// grid (public/js/flow-import.js, with the editor's reader); the server
// reviews it with the editor's rules, and accepting creates the flow with
// that grid as its draft, unpublished. The editor keeps its own import,
// which replaces a draft.
type ImportFlowData = { colour: number; categories: string[]; flows: { id: number; name: string }[] };

function ImportFlowPage({ data }: { data: ImportFlowData }) {
  return (
    <>
      <p class="admin-back">
        <a href={BACK.href}>← {BACK.label}</a>
      </p>
      <h1 class="page-title">Importar flujo</h1>
      <section class="card editor-import flow-import" id="import-box" aria-labelledby="import-title">
        <h2 id="import-title" class="visually-hidden">
          El flujo y sus pasos
        </h2>
        <p>
          Crea un flujo con los pasos de un Excel. Antes de crearlo verás una revisión con los problemas y el diagrama que resultaría. Nace sin publicar.
        </p>
        <label for="import-name">Nombre del flujo</label>
        <input id="import-name" name="name" required maxlength={100} />
        <p class="editor-template">
          ¿Vas a empezar en Excel?{" "}
          <button type="button" class="button-link" data-template>
            Descarga la plantilla
          </button>
          : trae las columnas de todas las categorías que ya existen y la lista de tipos.
        </p>
        <label for="import-file">Un archivo .xlsx (se lee su hoja «Flujo»)</label>
        <input id="import-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
        <label for="import-paste">O las celdas copiadas de Excel, con la fila de encabezados</label>
        <textarea id="import-paste" rows={6} spellcheck={false}></textarea>
        <ul class="plain-list form-error" role="alert" id="import-errors" hidden></ul>
        <div class="editor-message-actions">
          <button type="button" class="button-primary" data-import-review>
            Revisar
          </button>
          <a class="button-secondary" href={BACK.href}>
            Cancelar
          </a>
        </div>
      </section>
      <section class="editor-review" id="import-review" aria-labelledby="review-title" hidden></section>
      <script type="application/json" id="flow-import-data">
        {raw(scriptJson(data))}
      </script>
      <script type="module" src="/js/flow-import.js"></script>
    </>
  );
}

flowsScreen.get("/import", "editor", async (c) => {
  const db = c.env.DB;
  const [entries, index, colours] = await Promise.all([flowEntries(db), loadTagIndex(db), db.prepare("SELECT colour FROM flows").all<{ colour: number }>()]);
  const data: ImportFlowData = {
    // The colour the flow will get, for the review's diagram.
    colour: nextColour(colours.results.map((r) => r.colour)),
    categories: index.categories.map((cat) => cat.name),
    flows: entries.map((f) => ({ id: f.id, name: f.name })),
  };
  return c.render(<ImportFlowPage data={data} />, { title: "Importar flujo" });
});

// The name and the grid, as JSON. Both reviews (this one, read-only, and
// the one accepting repeats) say the name's problem first: there is no flow
// to review the steps of without one.
async function reviewNewFlow(db: D1Database, body: unknown) {
  const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const nameError = await newFlowNameError(db, name);
  if (nameError) return { status: "invalid" as const, error: nameError };
  const parsed = parseGrid(b.grid);
  if (parsed.ok === false) return { status: "invalid" as const, error: parsed.error };
  return { status: "review" as const, name, grid: parsed.grid, ...(await reviewGrid(db, { name }, parsed.grid)) };
}

flowsScreen.post("/import/review", "editor", async (c) => {
  const r = await reviewNewFlow(c.env.DB, await c.req.json().catch(() => null));
  if (r.status === "invalid") return c.json(r, 422);
  const { errors, blocking, newCategories, newTags } = r;
  return c.json({ status: "review", errors, blocking, newCategories, newTags });
});

// Accepting: reviewed again, then the flow is created and the grid becomes
// its draft. If the draft cannot be written after all (something changed in
// between), the flow just created is removed: nothing is left half made.
flowsScreen.post("/import", "editor", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => null);
  const r = await reviewNewFlow(db, body);
  if (r.status === "invalid") return c.json(r, 422);
  // As the editor's save (src/draft.ts): no list yet means nothing new was
  // accepted, so anything new has to be confirmed first.
  const accepted = parseAccepted((body as Record<string, unknown>).accepted);
  if (accepted === null) return c.json({ status: "invalid", error: "La lista de etiquetas aceptadas no tiene la forma esperada." }, 422);
  if (r.blocking) return c.json({ status: "blocked", errors: r.errors.filter((e) => e.blocking) }, 422);
  if (!accepted && (r.newCategories.length || r.newTags.length)) return c.json({ status: "confirm", newCategories: r.newCategories, newTags: r.newTags }, 422);
  const created = await createFlow(db, r.name);
  if (created.ok === false) return c.json({ status: "invalid", error: created.error }, 422);
  const applied = await applyGrid(db, created.id, r.grid, accepted ?? { categories: [], tags: [] }, c.get("user")!.id);
  if (applied.ok === false) {
    await db.batch([db.prepare("DELETE FROM drafts WHERE flow_id = ?").bind(created.id), db.prepare("DELETE FROM flows WHERE id = ?").bind(created.id)]);
    return c.json({ status: "blocked", errors: applied.errors }, 422);
  }
  return c.json({ status: "saved", id: created.id });
});

async function flowOf(c: { env: Env; req: { param: (k: string) => string | undefined } }) {
  const id = Number(c.req.param("id"));
  return Number.isSafeInteger(id) && id > 0 ? getFlow(c.env.DB, id) : null;
}

// The flow data panel above the editor's grid (SPEC §6) saves here: name,
// objective, colour and areas. Editors only. None of it is part of the
// draft, so each change is saved at once and makes no version.
export type AreaOption = { id: number; name: string };

// Saving a published flow with no area is allowed (DECISIONS, phase 4.4), but
// it leaves every Empleado without it, so the editor says so. A draft is left
// out: publishing it asks for an area anyway.
export const NO_AREAS_WARNING =
  "Este flujo publicado quedó sin áreas, así que ningún Empleado lo verá. Solo lo verán los Líderes y la Junta directiva.";

export const listAreaOptions = async (db: D1Database) => (await db.prepare("SELECT id, name FROM areas ORDER BY name_key").all<AreaOption>()).results;

// One field per request, as JSON: `{name}`, `{objective}` or `{colour}`.
// The answer carries the value as saved (trimmed), for the page to show.
flowsScreen.post("/:id{[0-9]+}/details", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const keys = body && typeof body === "object" ? Object.keys(body) : [];
  const field: FlowField | null =
    keys.length !== 1
      ? null
      : typeof body!.name === "string"
        ? { name: body!.name }
        : typeof body!.objective === "string"
          ? { objective: body!.objective }
          : typeof body!.colour === "number"
            ? { colour: body!.colour }
            : null;
  if (!field) return c.json({ status: "invalid", error: "No se pudo guardar." }, 400);
  const result = await saveFlowField(c.env.DB, flow.id, field);
  if (result.ok === false) return c.json({ status: "invalid", error: result.error }, 422);
  return c.json({ status: "saved", value: result.value });
});

// The areas, from the selector in the same panel (DECISIONS, 2026-11-19),
// as JSON: `{areaIds}`, the whole set. The answer carries the warning when a
// published flow is left with no area.
flowsScreen.post("/:id{[0-9]+}/areas", "editor", async (c) => {
  const db = c.env.DB;
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const body = (await c.req.json().catch(() => null)) as { areaIds?: unknown } | null;
  const ids = Array.isArray(body?.areaIds) ? body.areaIds : null;
  if (!ids || !ids.every((n) => Number.isSafeInteger(n) && (n as number) > 0)) {
    return c.json({ status: "invalid", error: "No se pudieron guardar las áreas." }, 400);
  }
  const result = await saveFlowAreas(db, flow.id, ids as number[]);
  if (result.ok === false) return c.json({ status: "invalid", error: result.error }, 422);
  const published = !!(await db.prepare("SELECT 1 FROM releases WHERE flow_id = ?").bind(flow.id).first());
  return c.json({ status: "saved", warning: published && ids.length === 0 ? NO_AREAS_WARNING : null });
});
