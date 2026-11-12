import { Hono } from "hono";
import { NAME_RULE, nameKey } from "./names";

// Provisional areas screen: proves the Worker reads and writes D1.
// Phase 4 restricts it to the Board (SPEC §9 Administration screens).
export const areas = new Hono<{ Bindings: Env }>();

type Area = { id: number; name: string };

async function listAreas(db: D1Database): Promise<Area[]> {
  const { results } = await db.prepare("SELECT id, name FROM areas ORDER BY name").all<Area>();
  return results;
}

function AreasPage({ items, error, value }: { items: Area[]; error?: string; value?: string }) {
  return (
    <>
      <h1 class="page-title">Áreas</h1>
      {items.length ? (
        <ul class="plain-list">
          {items.map((a) => (
            <li>{a.name}</li>
          ))}
        </ul>
      ) : (
        <p class="muted">Todavía no hay áreas.</p>
      )}
      <form method="post" action="/areas" class="inline-form">
        <label for="area-name">Nueva área</label>
        <input id="area-name" name="name" value={value ?? ""} required maxlength={100} />
        <button type="submit" class="button-primary">Crear</button>
      </form>
      {error && <p class="form-error" role="alert">{error}</p>}
    </>
  );
}

areas.get("/", async (c) => c.render(<AreasPage items={await listAreas(c.env.DB)} />, { title: "Áreas" }));

areas.post("/", async (c) => {
  const form = await c.req.parseBody();
  const name = String(form.name ?? "").trim();
  let error: string | undefined;
  if (!name) {
    error = "Escribe el nombre del área.";
  } else {
    const key = nameKey(name);
    const { meta } = await c.env.DB.prepare("INSERT INTO areas (name, name_key) VALUES (?, ?) ON CONFLICT (name_key) DO NOTHING")
      .bind(name, key)
      .run();
    if (meta.changes === 0) {
      const existing = await c.env.DB.prepare("SELECT name FROM areas WHERE name_key = ?").bind(key).first<string>("name");
      error = `Ya existe un área llamada «${existing}». ${NAME_RULE}`;
    }
  }
  if (!error) return c.redirect("/areas", 303);
  c.status(422);
  return c.render(<AreasPage items={await listAreas(c.env.DB)} error={error} value={name} />, { title: "Áreas" });
});
