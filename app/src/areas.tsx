import type { Context } from "hono";
import { Router } from "./access.tsx";
import { NAME_RULE, nameKey } from "./names.ts";
import type { AppEnv } from "./session.ts";

// The areas screen (SPEC §9 Administration screens; phase 4.4): create,
// rename, and delete an area nobody uses. Behind `can_edit`: assigning flows
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

// What the page shows again after a refused form: the message, and what was
// typed, in the form it was typed in.
type Refused = { error: string; areaId: number | null; value: string };

function AreasPage({ items, refused }: { items: Area[]; refused?: Refused }) {
  const typed = (id: number | null, fallback: string) => (refused && refused.areaId === id ? refused.value : fallback);
  return (
    <>
      <h1 class="page-title">Áreas</h1>
      {refused && (
        <p class="form-error" role="alert">
          {refused.error}
        </p>
      )}
      {items.length ? (
        <ul class="admin-list">
          {items.map((a) => (
            <li class="admin-row">
              <form method="post" action={`/areas/${a.id}`} class="inline-form">
                <input name="name" value={typed(a.id, a.name)} required maxlength={100} aria-label={`Nombre del área ${a.name}`} />
                <button type="submit" class="button-secondary">
                  Renombrar
                </button>
              </form>
              <span class="muted">{usage(a)}</span>
              {a.users + a.flows === 0 && (
                <form method="post" action={`/areas/${a.id}/delete`}>
                  <button type="submit" class="button-link" aria-label={`Borrar el área ${a.name}`}>
                    Borrar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p class="muted">Todavía no hay áreas.</p>
      )}
      <form method="post" action="/areas" class="inline-form">
        <label for="area-name">Nueva área</label>
        <input id="area-name" name="name" value={typed(null, "")} required maxlength={100} />
        <button type="submit" class="button-primary">
          Crear
        </button>
      </form>
    </>
  );
}

async function refuse(c: Context<AppEnv>, refused: Refused) {
  c.status(422);
  return c.render(<AreasPage items={await listAreas(c.env.DB)} refused={refused} />, { title: "Áreas" });
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

areas.post("/", "editor", async (c) => {
  const name = (await c.req.parseBody()).name;
  const error = await saveName(c.env.DB, null, name);
  if (error) return refuse(c, { error, areaId: null, value: String(name ?? "").trim() });
  return c.redirect("/areas", 303);
});

areas.post("/:id{[0-9]+}", "editor", async (c) => {
  const id = Number(c.req.param("id"));
  if (!(await c.env.DB.prepare("SELECT 1 FROM areas WHERE id = ?").bind(id).first())) return c.notFound();
  const name = (await c.req.parseBody()).name;
  const error = await saveName(c.env.DB, id, name);
  if (error) return refuse(c, { error, areaId: id, value: String(name ?? "").trim() });
  return c.redirect("/areas", 303);
});

// Only an area no user and no flow belongs to. The schema refuses the rest
// too (ON DELETE RESTRICT); the check here is for the message.
areas.post("/:id{[0-9]+}/delete", "editor", async (c) => {
  const id = Number(c.req.param("id"));
  const area = (await listAreas(c.env.DB)).find((a) => a.id === id);
  if (!area) return c.redirect("/areas", 303);
  if (area.users + area.flows > 0) {
    return refuse(c, { error: `No se puede borrar «${area.name}»: tiene ${usage(area)}. Quítaselos primero.`, areaId: null, value: "" });
  }
  try {
    await c.env.DB.prepare("DELETE FROM areas WHERE id = ?").bind(id).run();
  } catch (e) {
    // Someone was assigned to it in the meantime.
    if (/FOREIGN KEY/.test(String(e))) return refuse(c, { error: `No se puede borrar «${area.name}»: ya está en uso.`, areaId: null, value: "" });
    throw e;
  }
  return c.redirect("/areas", 303);
});
