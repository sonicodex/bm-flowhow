import type { Child } from "hono/jsx";
import type { Context } from "hono";
import { raw } from "hono/html";
import Core from "../public/js/core.js";
import { Router } from "./access.tsx";
import { scriptJson } from "./layout.tsx";
import { AdminList, RowActions, yesNo } from "./admin.tsx";
import { loadTagIndex } from "./document.ts";
import { listSavePoints, listVersions, openDraft, parseBase, restoreRelease, restoreSavePoint, reviewImport, saveDraft, type Opened, type SaveAnswer, type SavePoint, type Version } from "./draft.ts";
import { flowEntries, getFlow, type FlowListEntry, type FlowRow } from "./flows.ts";
import { NO_AREAS_WARNING } from "./flows-screen.tsx";
import { publishFlow, PUBLISH_CONFLICT } from "./publish.ts";
import type { AppEnv } from "./session.ts";

// The editor (SPEC §6, §8; phase 5). Editors only: the step grid (5.3) with
// its live preview (5.4), saving the draft and its save points (5.2), import
// (5.5), template and export (5.6, in the browser), publishing (5.7).
export const editor = new Router();


// What public/js/editor.js starts from.
export type EditorData = {
  flowId: number;
  name: string;
  // Palette slot, for the preview (§9: the flow colour drives the diagram).
  colour: number;
  grid: Opened["grid"];
  base: string;
  // Ids that some release of this flow holds: they stay as they are
  // (phase 5 plan, answer 4), and a new step never reuses one.
  lockedIds: string[];
  // Every flow, for the Flujo selector and for checking links as the
  // server does.
  flows: Omit<FlowListEntry, "key">[];
  // Each category's values, for the cells' suggestions.
  values: Record<string, string[]>;
  types: { value: string; label: string }[];
  // The latest release ("1.0"), or null: the publish panel shows the next
  // minor and major version from it (phase 5.7).
  published: string | null;
  // How many areas the flow has: the first publication needs one (§6).
  areas: number;
};

async function editorData(db: D1Database, flow: FlowRow): Promise<{ data: EditorData; opened: Opened; version: string | null }> {
  const [opened, entries, index, ids, latest, areas] = await Promise.all([
    openDraft(db, flow.id),
    flowEntries(db),
    loadTagIndex(db),
    db
      .prepare(
        `SELECT DISTINCT json_extract(s.value, '$.id') AS id
         FROM releases r, json_each(r.document, '$.steps') s WHERE r.flow_id = ?`,
      )
      .bind(flow.id)
      .all<{ id: string }>(),
    db
      .prepare("SELECT major || '.' || minor AS v FROM releases WHERE flow_id = ? ORDER BY major DESC, minor DESC LIMIT 1")
      .bind(flow.id)
      .first<string>("v"),
    db.prepare("SELECT count(*) AS n FROM flow_areas WHERE flow_id = ?").bind(flow.id).first<number>("n"),
  ]);
  const values: Record<string, string[]> = {};
  for (const c of index.categories) {
    values[c.name] = index.tags
      .filter((t) => t.categoryId === c.id)
      .map((t) => t.name)
      .sort((a, b) => a.localeCompare(b, "es-CO"));
  }
  return {
    opened,
    version: latest,
    data: {
      flowId: flow.id,
      name: flow.name,
      colour: flow.colour,
      grid: opened.grid,
      base: opened.base,
      lockedIds: ids.results.map((r) => r.id).filter((id) => typeof id === "string"),
      flows: entries.map(({ key: _k, ...f }) => f),
      values,
      types: Core.TYPES.map((t: string) => ({ value: t, label: (Core.TYPE_LABELS as Record<string, string>)[t]! })),
      published: latest,
      areas: areas ?? 0,
    },
  };
}

// One line under the title: what the grid holds and who sees it.
function sourceLine(source: Opened["source"], version: string | null) {
  if (!version) return "Este flujo todavía no se ha publicado: nadie lo ve hasta que lo publiques.";
  if (source === "release") return `Estás viendo la versión publicada ${version}. Al guardar se crea un borrador; nadie lo ve hasta que lo publiques.`;
  return `Borrador sobre la versión publicada ${version}. Nadie lo ve hasta que lo publiques.`;
}

function EditorPage({
  flow,
  data,
  source,
  version,
  notice,
}: {
  flow: FlowRow;
  data: EditorData;
  source: Opened["source"];
  version: string | null;
  notice?: Child;
}) {
  return (
    <section class={`editor flow-${flow.colour}`}>
      <p class="admin-back">
        <a href="/flows">← Volver a flujos</a>
      </p>
      <div class="admin-head">
        <h1 class="page-title editor-title">
          <span class="flow-dot" aria-hidden="true"></span>
          {flow.name}
        </h1>
        <div class="editor-save">
          <span id="save-status" class="muted" role="status"></span>
          <button type="button" class="button-primary" data-save disabled>
            Guardar
          </button>
          <button type="button" class="button-secondary" data-publish>
            Publicar
          </button>
        </div>
      </div>
      <p class="muted admin-subtitle" id="source-line">
        {sourceLine(source, version)}
      </p>
      <nav class="editor-links" aria-label="Del flujo">
        <a href={`/flows/${flow.id}/details`}>Datos del flujo</a>
        <a href={`/flows/${flow.id}/save-points`}>Puntos guardados</a>
        <a href={`/flows/${flow.id}/versions`}>Versiones</a>
      </nav>
      <div id="editor-panel">
        {notice && (
          <div class="card editor-message" role="status">
            {notice}
          </div>
        )}
      </div>
      <ImportBox />
      {/* Filled by editor.js with the review of an import (phase 5.5): it
          takes the place of the grid until the import is applied or
          dropped. */}
      <section class="editor-review" id="import-review" aria-labelledby="review-title" hidden></section>
      <div class="editor-cols">
        <div class="editor-main">
          <div class="editor-toolbar">
            <button type="button" class="button-secondary" data-add>
              Agregar paso
            </button>
            <button type="button" class="button-secondary" data-import aria-expanded="false" aria-controls="import-box">
              Importar desde Excel
            </button>
            <button type="button" class="button-secondary" data-export>
              Exportar a Excel
            </button>
          </div>
          <div class="table-frame">
            <div class="table-scroll" data-table-scroll>
              <table class="step-grid" id="step-grid">
                <noscript>
                  <caption class="form-error">La tabla de pasos necesita JavaScript.</caption>
                </noscript>
              </table>
            </div>
          </div>
          <p class="muted editor-hint">
            Conecta los pasos por cualquiera de los dos lados: en <strong>Depende de</strong> escribe el ID del paso anterior, o en{" "}
            <strong>Salidas</strong> el del siguiente; la otra columna se actualiza sola. Con varias, sepáralas con | y, en una decisión,
            rotúlalas: <code>Sí:P5 | No:P4</code>. En las categorías, separa varios valores con coma. Los pasos ya publicados conservan su ID:
            el avance de las personas depende de él.
          </p>
          <section class="card editor-problems" id="problems" aria-live="polite"></section>
        </div>
        {/* SPEC §6: a read-only diagram next to the grid, redrawn while
            editing (phase 5.4). Below the grid on a narrow screen. */}
        <aside class="card editor-preview" aria-labelledby="preview-title">
          <h2 id="preview-title">Vista previa</h2>
          <p class="muted">Toca un paso para ir a su fila.</p>
          <div class="diagram-scroll" id="preview"></div>
        </aside>
      </div>
      <script type="application/json" id="editor-data">
        {raw(scriptJson(data))}
      </script>
      <script type="module" src="/js/editor.js"></script>
      <script type="module" src="/js/table-scroll.js"></script>
    </section>
  );
}

// SPEC §6: an import fills the same grid from a paste or an .xlsx, always
// through a review, and replaces the whole draft (phase 5.5). editor.js
// reads the paste or the file into a grid (import-form.js), the server
// reviews it, and applying it is a save.
function ImportBox() {
  return (
    <section class="card editor-import" id="import-box" aria-labelledby="import-title" hidden>
      <h2 id="import-title">Importar desde Excel</h2>
      <p>
        Reemplaza todos los pasos del borrador. Antes de guardar verás una revisión con los problemas y el diagrama que resultaría.
      </p>
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
        <button type="button" class="button-secondary" data-import-cancel>
          Cancelar
        </button>
      </div>
    </section>
  );
}

editor.get("/:id{[0-9]+}/edit", "editor", async (c) => {
  const flow = await getFlow(c.env.DB, Number(c.req.param("id")));
  if (!flow) return c.notFound();
  const { data, opened, version } = await editorData(c.env.DB, flow);
  const versionIn = (key: string) => (/^\d{1,6}\.\d{1,6}$/.test(c.req.query(key) ?? "") ? c.req.query(key) : null);
  const published = versionIn("publicada");
  const restored = versionIn("restaurada");
  const notice = published ? (
    <>
      {/* With no area (removed after the first publication), the flow
          form's own warning: no Empleado sees it. */}
      Publicada la versión {published}. {data.areas ? "Ya la ven las personas de las áreas del flujo." : NO_AREAS_WARNING}{" "}
      <a href={`/flows/${flow.id}`}>Ver el flujo</a>
    </>
  ) : restored && restored === data.published ? (
    `El borrador volvió a la versión ${restored}, la que todos ven. Tus cambios anteriores siguen en los puntos guardados.`
  ) : restored ? (
    `El borrador ahora tiene el contenido de la versión ${restored}. Nadie lo ve todavía: publícalo para que vuelva a ser el que todos ven; será una versión nueva.`
  ) : c.req.query("importado") === "1" ? (
    "Importado al borrador. Revísalo aquí; nadie lo ve hasta que lo publiques."
  ) : undefined;
  return c.render(<EditorPage flow={flow} data={data} source={opened.source} version={version} notice={notice} />, {
    title: `Editar ${flow.name}`,
  });
});

const flowOf = async (c: Context<AppEnv>) => getFlow(c.env.DB, Number(c.req.param("id")));

// Date and time to the second, in Bogotá: an editor may save several times
// within a minute, and each point must be told apart.
const when = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "medium" });
export const savedAt = (iso: string) => when.format(new Date(iso));

const STATUS: Record<SaveAnswer["status"], 200 | 400 | 409 | 422> = { saved: 200, confirm: 200, invalid: 400, blocked: 422, conflict: 409 };

// The grid's save, as JSON: `{grid, base, accepted?}` (src/draft.ts).
editor.post("/:id{[0-9]+}/draft", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = null;
  }
  const answer = await saveDraft(c.env.DB, flow.id, body, c.get("user")!.id);
  return c.json(answer, STATUS[answer.status]);
});

// Publishing from the editor (SPEC §6 publish validations, §8; phase 5.7):
// `{base, bump}`. Only the saved draft the editor has open is published:
// `base` names it, and anything else is a conflict. The five validations
// are publishFlow's; every problem blocks.
editor.post("/:id{[0-9]+}/publish", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const body = (await c.req.json().catch(() => null)) as { base?: unknown; bump?: unknown } | null;
  const base = parseBase(body?.base);
  const bump = body?.bump === "major" ? "major" : body?.bump === "minor" ? "minor" : null;
  if (!base || !bump) return c.json({ status: "invalid", error: "La publicación no tiene la forma esperada." }, 400);
  if ("release" in base) {
    // The editor shows a release: there is nothing of its own to publish,
    // unless someone saved a draft meanwhile.
    const draft = await c.env.DB.prepare("SELECT 1 AS x FROM drafts WHERE flow_id = ?").bind(flow.id).first("x");
    return draft
      ? c.json({ status: "conflict", message: PUBLISH_CONFLICT }, 409)
      : c.json({ status: "nothing", message: "No hay cambios sin publicar: guarda un cambio primero." }, 422);
  }
  const r = await publishFlow(c.env.DB, flow.id, bump, c.get("user")!.id, base.draft);
  if (r.ok === true) return c.json({ status: "published", version: r.version });
  if (r.conflict) return c.json({ status: "conflict", message: PUBLISH_CONFLICT }, 409);
  return c.json({ status: "blocked", errors: r.errors }, 422);
});

// The review of an import, as JSON (src/draft.ts): writes nothing.
editor.post("/:id{[0-9]+}/draft/review", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const answer = await reviewImport(c.env.DB, flow.id, await c.req.json().catch(() => null));
  return c.json(answer, answer.status === "invalid" ? 400 : 200);
});

function SavePointsPage({ flow, points, notice }: { flow: { id: number; name: string }; points: SavePoint[]; notice?: string }) {
  return (
    <AdminList
      back={{ href: `/flows/${flow.id}/edit`, label: "Volver al editor" }}
      title={`Puntos guardados: ${flow.name}`}
      note="Volver a un punto pone su contenido en el borrador. Los demás puntos se quedan, también los posteriores. Al publicar se borran todos."
      notice={notice}
      columns={[{ label: "Guardado" }, { label: "Por" }, { label: "Pasos", numeric: true }, { label: "Es el borrador actual" }]}
      empty={{
        purpose: "Cada vez que guardas el borrador queda aquí un punto al que puedes volver.",
        howToAdd: "Todavía no hay ninguno: aparecen al guardar desde el editor o al importar.",
      }}
      rows={points.map((p) => (
        <tr>
          <td>{savedAt(p.createdAt)}</td>
          <td>{p.by ?? "—"}</td>
          <td class="num">{p.steps}</td>
          <td>{yesNo(p.current)}</td>
          <RowActions>
            {!p.current && (
              <form method="post" action={`/flows/${flow.id}/save-points/${p.id}/restore`}>
                <button type="submit" class="button-link" aria-label={`Volver al punto del ${savedAt(p.createdAt)}`}>
                  Volver a este punto
                </button>
              </form>
            )}
          </RowActions>
        </tr>
      ))}
    />
  );
}

editor.get("/:id{[0-9]+}/save-points", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const points = await listSavePoints(c.env.DB, flow.id);
  const back = points.find((p) => String(p.id) === c.req.query("vuelta"));
  // No final period: the time already ends in one ("p. m.").
  const notice = back && `El borrador volvió al punto del ${savedAt(back.createdAt)}`;
  return c.render(<SavePointsPage flow={flow} points={points} notice={notice} />, { title: `Puntos guardados: ${flow.name}` });
});

editor.post("/:id{[0-9]+}/save-points/:point{[0-9]+}/restore", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const point = Number(c.req.param("point"));
  if (!(await restoreSavePoint(c.env.DB, flow.id, point, c.get("user")!.id))) return c.notFound();
  return c.redirect(`/flows/${flow.id}/save-points?vuelta=${point}`, 303);
});

// The releases (SPEC §8; phase 5.8): kept forever, any one restorable into
// the draft.
function VersionsPage({ flow, versions }: { flow: { id: number; name: string }; versions: Version[] }) {
  return (
    <AdminList
      back={{ href: `/flows/${flow.id}/edit`, label: "Volver al editor" }}
      title={`Versiones: ${flow.name}`}
      note="Las versiones publicadas no cambian nunca. Restaurar una pone su contenido en el borrador; para que vuelva a ser la que todos ven, se publica como versión nueva. El borrador que tenías sigue en los puntos guardados."
      columns={[{ label: "Versión" }, { label: "Publicada" }, { label: "Por" }, { label: "Pasos", numeric: true }, { label: "Es la que todos ven" }]}
      empty={{
        purpose: "Cada publicación queda aquí para siempre, y cualquiera se puede restaurar.",
        howToAdd: "Este flujo todavía no se ha publicado: publícalo desde el editor.",
      }}
      rows={versions.map((v) => (
        <tr>
          <td>{v.version}</td>
          <td>{savedAt(v.publishedAt)}</td>
          <td>{v.by ?? "—"}</td>
          <td class="num">{v.steps}</td>
          <td>{yesNo(v.latest)}</td>
          <RowActions>
            {v.inDraft ? (
              <span class="muted">Está en el borrador</span>
            ) : !v.restorable ? (
              <span class="muted">Es la que ves en el editor</span>
            ) : (
              <form method="post" action={`/flows/${flow.id}/versions/${v.id}/restore`}>
                <button type="submit" class="button-link" aria-label={`Restaurar la versión ${v.version}`}>
                  Restaurar
                </button>
              </form>
            )}
          </RowActions>
        </tr>
      ))}
    />
  );
}

editor.get("/:id{[0-9]+}/versions", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  return c.render(<VersionsPage flow={flow} versions={await listVersions(c.env.DB, flow.id)} />, { title: `Versiones: ${flow.name}` });
});

editor.post("/:id{[0-9]+}/versions/:release{[0-9]+}/restore", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const version = await restoreRelease(c.env.DB, flow.id, Number(c.req.param("release")), c.get("user")!.id);
  if (!version) return c.notFound();
  return c.redirect(`/flows/${flow.id}/edit?restaurada=${version}`, 303);
});
