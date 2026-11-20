import type { Context } from "hono";
import { AdminForm, AdminList, RowActions } from "./admin.tsx";
import { Router } from "./access.tsx";
import { FROM_SETUP, ImportPage, plural, readColumns, readTable, rowError, SETUP_DONE, type Invalid, type Review, type RowError, type Saved } from "./import-list.tsx";
import { NAME_RULE, nameKey } from "./names.ts";
import type { AppEnv } from "./session.ts";

// The areas screen (SPEC §9 Administration screens; phase 4.4): the list,
// the form to create or rename one, and deleting an area nobody uses. Behind `can_edit`: assigning flows
// to areas is content and opens no way up (DECISIONS, phase 4.2).
export const areas = new Router();

type Area = { id: number; name: string; users: number; flows: number };

async function listAreas(db: D1Database): Promise<Area[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.name,
         (SELECT count(*) FROM user_areas ua WHERE ua.area_id = a.id) AS users,
         (SELECT count(*) FROM flow_areas fa WHERE fa.area_id = a.id) AS flows
       FROM areas a ORDER BY a.name_key`,
    )
    .all<Area>();
  return results;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const usage = (a: Area) => `${count(a.users, "usuario", "usuarios")} · ${count(a.flows, "flujo", "flujos")}`;
const inUse = (a: Area) => a.users + a.flows > 0;

function AreasPage({ items, error }: { items: Area[]; error?: string }) {
  return (
    <AdminList
      title="Áreas"
      action={{ href: "/areas/new", label: "Nueva área" }}
      more={{ href: "/areas/import", label: "Importar áreas" }}
      columns={[{ label: "Nombre" }, { label: "Flujos", numeric: true }, { label: "Usuarios", numeric: true }]}
      error={error}
      empty={{
        purpose: "Las áreas agrupan a los Empleados y deciden qué flujos ve cada uno.",
        howToAdd: "Todavía no hay ninguna. Crea la primera con «Nueva área», o tráelas todas de Excel con «Importar áreas».",
      }}
      rows={items.map((a) => (
        <tr>
          <td>
            <a href={`/areas/${a.id}`}>{a.name}</a>
          </td>
          <td class="num">{a.flows}</td>
          <td class="num">{a.users}</td>
          <RowActions>
            <a href={`/areas/${a.id}`} aria-label={`Editar el área ${a.name}`}>
              Editar
            </a>
            {!inUse(a) && (
              <form method="post" action={`/areas/${a.id}/delete`}>
                <button type="submit" class="button-link" aria-label={`Borrar el área ${a.name}`}>
                  Borrar
                </button>
              </form>
            )}
          </RowActions>
        </tr>
      ))}
    />
  );
}

// One form for a new area (no `area`) and for renaming one.
function AreaForm({ area, value, error }: { area?: Area; value: string; error?: string }) {
  return (
    <AdminForm
      back={{ href: "/areas", label: "Volver a áreas" }}
      title={area ? area.name : "Nueva área"}
      subtitle={area && (inUse(area) ? `La usan ${usage(area)}.` : "Nadie la usa todavía: se puede borrar desde la lista.")}
      error={error}
      action={area ? `/areas/${area.id}` : "/areas"}
      submit={area ? "Guardar" : "Crear área"}
    >
      <label for="area-name">Nombre</label>
      <input id="area-name" name="name" value={value} required maxlength={100} />
    </AdminForm>
  );
}

const areaOf = async (db: D1Database, id: number) => (await listAreas(db)).find((a) => a.id === id);
const formTitle = (area?: Area) => (area ? area.name : "Nueva área");

async function refuse(c: Context<AppEnv>, area: Area | undefined, value: string, error: string) {
  c.status(422);
  return c.render(<AreaForm area={area} value={value} error={error} />, { title: formTitle(area) });
}

// Creates the area (id null) or renames it. Null when it worked, else why not.
async function saveName(db: D1Database, id: number | null, raw: unknown): Promise<string | null> {
  const name = String(raw ?? "").trim();
  if (!name) return "Escribe el nombre del área.";
  const key = nameKey(name);
  const taken = await db.prepare("SELECT id, name FROM areas WHERE name_key = ?").bind(key).first<{ id: number; name: string }>();
  if (taken && taken.id !== id) return `Ya existe un área llamada «${taken.name}». ${NAME_RULE}`;
  try {
    if (id === null) await db.prepare("INSERT INTO areas (name, name_key) VALUES (?, ?)").bind(name, key).run();
    else await db.prepare("UPDATE areas SET name = ?, name_key = ? WHERE id = ?").bind(name, key, id).run();
  } catch (e) {
    // Taken between the check and the write.
    if (/UNIQUE/.test(String(e))) return `Ya existe un área con ese nombre. ${NAME_RULE}`;
    throw e;
  }
  return null;
}

areas.get("/", "editor", async (c) => c.render(<AreasPage items={await listAreas(c.env.DB)} />, { title: "Áreas" }));

areas.get("/new", "editor", (c) => c.render(<AreaForm value="" />, { title: "Nueva área" }));

areas.post("/", "editor", async (c) => {
  const name = (await c.req.parseBody()).name;
  const error = await saveName(c.env.DB, null, name);
  if (error) return refuse(c, undefined, String(name ?? "").trim(), error);
  return c.redirect("/areas", 303);
});

areas.get("/:id{[0-9]+}", "editor", async (c) => {
  const area = await areaOf(c.env.DB, Number(c.req.param("id")));
  if (!area) return c.notFound();
  return c.render(<AreaForm area={area} value={area.name} />, { title: area.name });
});

areas.post("/:id{[0-9]+}", "editor", async (c) => {
  const area = await areaOf(c.env.DB, Number(c.req.param("id")));
  if (!area) return c.notFound();
  const name = (await c.req.parseBody()).name;
  const error = await saveName(c.env.DB, area.id, name);
  if (error) return refuse(c, area, String(name ?? "").trim(), error);
  return c.redirect("/areas", 303);
});

// Only an area no user and no flow belongs to. The schema refuses the rest
// too (ON DELETE RESTRICT); the check here is for the message, shown on the
// list the button was pressed on.
areas.post("/:id{[0-9]+}/delete", "editor", async (c) => {
  const db = c.env.DB;
  const area = await areaOf(db, Number(c.req.param("id")));
  if (!area) return c.redirect("/areas", 303);
  const refuseOnList = async (error: string) => {
    c.status(422);
    return c.render(<AreasPage items={await listAreas(db)} error={error} />, { title: "Áreas" });
  };
  if (inUse(area)) return refuseOnList(`No se puede borrar «${area.name}»: tiene ${usage(area)}. Quítaselos primero.`);
  try {
    await db.prepare("DELETE FROM areas WHERE id = ?").bind(area.id).run();
  } catch (e) {
    // Someone was assigned to it in the meantime.
    if (/FOREIGN KEY/.test(String(e))) return refuseOnList(`No se puede borrar «${area.name}»: ya está en uso.`);
    throw e;
  }
  return c.redirect("/areas", 303);
});

// ---- Import (SPEC §4 «Importing areas, users and flows»; phase 7.1) ----
// One area per row. A name that already exists, without counting case or
// accents, is matched and left alone, not duplicated.

const AREA_MAX = 100;

type AreaPlan = { errors: RowError[]; fresh: string[]; matched: { typed: string; existing: string }[] };

async function planAreas(db: D1Database, body: unknown): Promise<AreaPlan | Invalid> {
  const read = readTable(body);
  if (read.ok === false) return read.answer;
  const cols = readColumns(read.table, [{ key: "name", label: "Área" }]);
  if (cols.ok === false) return cols.answer;
  const existing = new Map((await db.prepare("SELECT name, name_key FROM areas").all<{ name: string; name_key: string }>()).results.map((a) => [a.name_key, a.name]));
  const plan: AreaPlan = { errors: [], fresh: [], matched: [] };
  const seen = new Map<string, number>();
  for (const { row, cells } of cols.lines) {
    const name = cells.name;
    const key = nameKey(name);
    if (!key) {
      plan.errors.push(rowError(row, "le falta el nombre del área."));
      continue;
    }
    if (name.length > AREA_MAX) {
      plan.errors.push(rowError(row, `el nombre tiene más de ${AREA_MAX} caracteres.`));
      continue;
    }
    const first = seen.get(key);
    if (first !== undefined) {
      plan.errors.push(rowError(row, `«${name}» ya está en la fila ${first}. ${NAME_RULE}`));
      continue;
    }
    seen.set(key, row);
    const known = existing.get(key);
    if (known !== undefined) plan.matched.push({ typed: name, existing: known });
    else plan.fresh.push(name);
  }
  return plan;
}

const freshGroup = (names: string[]) => ({ title: `Áreas nuevas (${names.length})`, columns: ["Área"], rows: names.map((n) => [n]) });
const matchedGroup = (matched: AreaPlan["matched"]) => ({
  title: `Ya existen (${matched.length})`,
  note: "Se emparejan con el área que ya hay y no se tocan.",
  columns: ["En el archivo", "Área que ya existe"],
  rows: matched.map((m) => [m.typed, m.existing]),
});

async function reviewAreas(db: D1Database, body: unknown): Promise<Review | Invalid> {
  const plan = await planAreas(db, body);
  if ("status" in plan) return plan;
  return {
    status: "review",
    summary: `${plural(plan.fresh.length + plan.matched.length + plan.errors.length, "fila", "filas")}: ${plural(plan.fresh.length, "área nueva", "áreas nuevas")}, ${plural(plan.matched.length, "ya existe", "ya existen")}.`,
    errors: plan.errors,
    warnings: [],
    groups: [...(plan.fresh.length ? [freshGroup(plan.fresh)] : []), ...(plan.matched.length ? [matchedGroup(plan.matched)] : [])],
  };
}

// Checked again from the start: the review may be stale. All the new
// areas are written in one batch, which D1 runs as a transaction.
async function applyAreas(db: D1Database, body: unknown): Promise<Saved | Invalid> {
  const plan = await planAreas(db, body);
  if ("status" in plan) return plan;
  if (plan.errors.length) return { status: "invalid", error: "El archivo tiene filas por corregir. Vuelve a revisarlo." };
  if (plan.fresh.length) {
    try {
      await db.batch(plan.fresh.map((name) => db.prepare("INSERT INTO areas (name, name_key) VALUES (?, ?)").bind(name, nameKey(name))));
    } catch (e) {
      // Someone created one of them between the review and now.
      if (/UNIQUE/.test(String(e))) return { status: "invalid", error: "Mientras tanto alguien creó una de estas áreas. Vuelve a revisar el archivo." };
      throw e;
    }
  }
  return {
    status: "saved",
    title: "Áreas importadas",
    message: `Se ${plan.fresh.length === 1 ? "creó" : "crearon"} ${plural(plan.fresh.length, "área", "áreas")}; ${plural(plan.matched.length, "ya existía", "ya existían")}.`,
    warnings: [],
    groups: plan.fresh.length ? [freshGroup(plan.fresh)] : [],
  };
}

areas.get("/import", "editor", (c) => {
  const fromSetup = c.req.query("desde") === FROM_SETUP;
  return c.render(
    <ImportPage
      back={fromSetup ? SETUP_DONE : { href: "/areas", label: "Volver a áreas" }}
      title="Importar áreas"
      intro="Crea de una vez las áreas que falten. Antes de crear nada verás una revisión con los problemas y lo que entraría."
      columnsNote="Una columna, «Área», con un nombre por fila. Un área que ya existe (sin contar mayúsculas ni tildes) se empareja y no se duplica."
      config={{
        sheet: "Áreas",
        reviewUrl: "/areas/import/review",
        applyUrl: "/areas/import",
        template: { name: "Plantilla_Areas_FlowHow.xlsx", columns: ["Área"], widths: [40] },
        done: fromSetup ? SETUP_DONE : { href: "/areas", label: "Ir a áreas" },
      }}
    />,
    { title: "Importar áreas" },
  );
});

areas.post("/import/review", "editor", async (c) => {
  const answer = await reviewAreas(c.env.DB, await c.req.json().catch(() => null));
  return c.json(answer, answer.status === "invalid" ? 400 : 200);
});

areas.post("/import", "editor", async (c) => {
  const answer = await applyAreas(c.env.DB, await c.req.json().catch(() => null));
  return c.json(answer, answer.status === "invalid" ? 422 : 200);
});
