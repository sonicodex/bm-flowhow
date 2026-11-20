import type { Context } from "hono";
import Core from "../public/js/core.js";
import { AdminForm, AdminList, AdminTable, Messages, RowActions } from "./admin.tsx";
import { Router } from "./access.tsx";
import { NAME_RULE, nameKey } from "./names.ts";
import type { AppEnv } from "./session.ts";

// The tag categories screen (SPEC §5 Tags with categories, §9
// Administration screens; phase 5.1): categories and their values. Behind
// `can_edit`, like areas: tags are flow content.
//
// Documents store tags by id, so renaming is always safe. Deleting is not:
// releases are kept forever and never change, so a value that any draft,
// save point or release ever held must stay (DECISIONS, phase 5 plan,
// answer 6).
export const categories = new Router();

// Said wherever a delete is not offered or is refused.
export const NEVER_DELETE =
  "Como las publicaciones no cambian nunca, una categoría o un valor que se usó alguna vez ya no se puede borrar. Sí se puede renombrar.";

// Every (flow, tag) pair any document ever held: drafts, save points and
// releases. Prefixes the queries below.
const USES = `WITH docs (flow_id, document) AS (
    SELECT flow_id, document FROM drafts
    UNION ALL SELECT flow_id, document FROM save_points
    UNION ALL SELECT flow_id, document FROM releases),
  uses (flow_id, tag_id) AS (
    SELECT DISTINCT d.flow_id, t.value FROM docs d, json_each(d.document, '$.steps') s, json_each(s.value, '$.tags') t)`;

type Category = { id: number; name: string; values: number; flows: number };
type Value = { id: number; name: string; flows: number };

async function listCategories(db: D1Database): Promise<Category[]> {
  const { results } = await db
    .prepare(
      `${USES}
       SELECT c.id, c.name,
         (SELECT count(*) FROM tags t WHERE t.category_id = c.id) AS "values",
         (SELECT count(DISTINCT u.flow_id) FROM uses u JOIN tags t ON t.id = u.tag_id WHERE t.category_id = c.id) AS flows
       FROM tag_categories c ORDER BY c.position, c.id`,
    )
    .all<Category>();
  return results;
}

async function listValues(db: D1Database, categoryId: number): Promise<Value[]> {
  const { results } = await db
    .prepare(
      `${USES}
       SELECT t.id, t.name, (SELECT count(DISTINCT u.flow_id) FROM uses u WHERE u.tag_id = t.id) AS flows
       FROM tags t WHERE t.category_id = ? ORDER BY t.name_key`,
    )
    .bind(categoryId)
    .all<Value>();
  return results;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const usedIn = (flows: number) => `Se usó en ${count(flows, "flujo", "flujos")}.`;

function CategoriesPage({ items, error }: { items: Category[]; error?: string }) {
  return (
    <AdminList
      back={{ href: "/flows", label: "Volver a flujos" }}
      title="Categorías"
      action={{ href: "/categories/new", label: "Nueva categoría" }}
      note="El orden de la lista es el de las columnas en la plantilla de Excel, y decide la convención de cada categoría en el diagrama."
      columns={[{ label: "Nombre" }, { label: "Valores", numeric: true }, { label: "Flujos", numeric: true }]}
      error={error}
      empty={{
        purpose: "Las categorías agrupan las etiquetas de los pasos, como Responsable o Herramienta. Cada una es una columna de la plantilla de Excel.",
        howToAdd: "Todavía no hay ninguna. Crea la primera con «Nueva categoría».",
      }}
      rows={items.map((cat, i) => (
        <tr>
          <td>
            <a href={`/categories/${cat.id}`}>{cat.name}</a>
          </td>
          <td class="num">{cat.values}</td>
          <td class="num">{cat.flows}</td>
          <RowActions>
            <a href={`/categories/${cat.id}`} aria-label={`Editar la categoría ${cat.name}`}>
              Editar
            </a>
            {i > 0 && <MoveButton cat={cat} direction="up" />}
            {i < items.length - 1 && <MoveButton cat={cat} direction="down" />}
            {cat.flows === 0 && (
              <form method="post" action={`/categories/${cat.id}/delete`}>
                <button type="submit" class="button-link" aria-label={`Borrar la categoría ${cat.name}`}>
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

function MoveButton({ cat, direction }: { cat: Category; direction: "up" | "down" }) {
  const label = direction === "up" ? "Subir" : "Bajar";
  return (
    <form method="post" action={`/categories/${cat.id}/move`}>
      <input type="hidden" name="direction" value={direction} />
      <button type="submit" class="button-link" aria-label={`${label} la categoría ${cat.name}`}>
        {label}
      </button>
    </form>
  );
}

// One form for a new category (no `cat`) and for an existing one, which
// also lists its values and takes new ones.
function CategoryForm(props: {
  cat?: Category;
  value: string;
  values?: Value[];
  newValue?: string;
  error?: string;
  valueError?: string;
  notice?: string;
}) {
  const { cat } = props;
  const subtitle = cat && (cat.flows > 0 ? `${usedIn(cat.flows)} ${NEVER_DELETE}` : "Ningún flujo la ha usado todavía: se puede borrar desde la lista.");
  return (
    <AdminForm
      back={{ href: "/categories", label: "Volver a categorías" }}
      title={cat ? cat.name : "Nueva categoría"}
      subtitle={subtitle}
      error={props.error}
      notice={props.notice}
      action={cat ? `/categories/${cat.id}` : "/categories"}
      submit={cat ? "Guardar" : "Crear categoría"}
      after={cat && <ValuesSection cat={cat} values={props.values ?? []} newValue={props.newValue ?? ""} error={props.valueError} />}
    >
      <label for="category-name">Nombre</label>
      <input id="category-name" name="name" value={props.value} required maxlength={100} />
    </AdminForm>
  );
}

function ValuesSection({ cat, values, newValue, error }: { cat: Category; values: Value[]; newValue: string; error?: string }) {
  return (
    <section class="admin-more">
      <h2>Valores</h2>
      <AdminTable
        columns={[{ label: "Valor" }, { label: "Flujos", numeric: true }]}
        empty={{ purpose: "Los valores son las etiquetas que un paso puede llevar en esta categoría.", howToAdd: "Todavía no tiene ninguno. Agrega el primero aquí abajo." }}
        rows={values.map((v) => (
          <tr>
            <td>
              <a href={`/categories/${cat.id}/values/${v.id}`}>{v.name}</a>
            </td>
            <td class="num">{v.flows}</td>
            <RowActions>
              <a href={`/categories/${cat.id}/values/${v.id}`} aria-label={`Editar el valor ${v.name}`}>
                Editar
              </a>
              {v.flows === 0 && (
                <form method="post" action={`/categories/${cat.id}/values/${v.id}/delete`}>
                  <button type="submit" class="button-link" aria-label={`Borrar el valor ${v.name}`}>
                    Borrar
                  </button>
                </form>
              )}
            </RowActions>
          </tr>
        ))}
      />
      <Messages error={error} />
      <form method="post" action={`/categories/${cat.id}/values`} class="stacked-form admin-form">
        <label for="value-name">Nuevo valor</label>
        <input id="value-name" name="name" value={newValue} required maxlength={100} />
        <button type="submit">Agregar valor</button>
      </form>
    </section>
  );
}

function ValueForm({ cat, item, value, error }: { cat: Category; item: Value; value: string; error?: string }) {
  return (
    <AdminForm
      back={{ href: `/categories/${cat.id}`, label: `Volver a ${cat.name}` }}
      title={item.name}
      subtitle={item.flows > 0 ? `${usedIn(item.flows)} ${NEVER_DELETE}` : `Valor de ${cat.name}. Ningún flujo lo ha usado todavía: se puede borrar desde la categoría.`}
      error={error}
      action={`/categories/${cat.id}/values/${item.id}`}
      submit="Guardar"
    >
      <label for="value-name">Nombre</label>
      <input id="value-name" name="name" value={value} required maxlength={100} />
    </AdminForm>
  );
}

const categoryOf = async (db: D1Database, id: number) => (await listCategories(db)).find((c) => c.id === id);
const valueOf = async (db: D1Database, cat: Category, id: number) => (await listValues(db, cat.id)).find((v) => v.id === id);

async function renderCategory(c: Context<AppEnv>, cat: Category, extra: Partial<Parameters<typeof CategoryForm>[0]> = {}) {
  if (extra.error || extra.valueError) c.status(422);
  return c.render(<CategoryForm cat={cat} value={cat.name} values={await listValues(c.env.DB, cat.id)} {...extra} />, { title: cat.name });
}

// Creates the category (id null) or renames it: the new id, or why not.
async function saveCategory(db: D1Database, id: number | null, raw: unknown): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const name = String(raw ?? "").trim();
  if (!name) return { ok: false, error: "Escribe el nombre de la categoría." };
  // Any other header of the import format is a category: these are taken.
  if (Core.fixedColumn(name)) return { ok: false, error: `«${name}» es una columna fija de la plantilla de Excel. Elige otro nombre.` };
  const key = nameKey(name);
  const taken = await db.prepare("SELECT id, name FROM tag_categories WHERE name_key = ?").bind(key).first<{ id: number; name: string }>();
  if (taken && taken.id !== id) return { ok: false, error: `Ya existe una categoría llamada «${taken.name}». ${NAME_RULE}` };
  try {
    if (id !== null) {
      await db.prepare("UPDATE tag_categories SET name = ?, name_key = ? WHERE id = ?").bind(name, key, id).run();
      return { ok: true, id };
    }
    const created = await db
      .prepare("INSERT INTO tag_categories (name, name_key, position) SELECT ?, ?, coalesce(max(position), 0) + 1 FROM tag_categories RETURNING id")
      .bind(name, key)
      .first<number>("id");
    return { ok: true, id: created! };
  } catch (e) {
    // Taken between the check and the write.
    if (/UNIQUE/.test(String(e))) return { ok: false, error: `Ya existe una categoría con ese nombre. ${NAME_RULE}` };
    throw e;
  }
}

// Adds a value to the category (id null) or renames it. Null when it worked.
async function saveValue(db: D1Database, cat: Category, id: number | null, raw: unknown): Promise<string | null> {
  const name = String(raw ?? "").trim();
  if (!name) return "Escribe el valor.";
  // The grid separates several values of a cell with commas.
  if (name.includes(",")) return "Un valor no puede llevar comas: en la tabla, la coma separa un valor de otro.";
  const key = nameKey(name);
  const taken = await db
    .prepare("SELECT id, name FROM tags WHERE category_id = ? AND name_key = ?")
    .bind(cat.id, key)
    .first<{ id: number; name: string }>();
  if (taken && taken.id !== id) return `«${cat.name}» ya tiene el valor «${taken.name}». ${NAME_RULE}`;
  try {
    if (id === null) await db.prepare("INSERT INTO tags (category_id, name, name_key) VALUES (?, ?, ?)").bind(cat.id, name, key).run();
    else await db.prepare("UPDATE tags SET name = ?, name_key = ? WHERE id = ? AND category_id = ?").bind(name, key, id, cat.id).run();
  } catch (e) {
    if (/UNIQUE/.test(String(e))) return `«${cat.name}» ya tiene ese valor. ${NAME_RULE}`;
    if (/FOREIGN KEY/.test(String(e))) return "La categoría ya no existe.";
    throw e;
  }
  return null;
}

const refused = (name: string) => `No se puede borrar «${name}»: ya se usó en un flujo. ${NEVER_DELETE}`;

const idParam = (c: Context<AppEnv>, name = "id") => Number(c.req.param(name));

categories.get("/", "editor", async (c) => c.render(<CategoriesPage items={await listCategories(c.env.DB)} />, { title: "Categorías" }));

categories.get("/new", "editor", (c) => c.render(<CategoryForm value="" />, { title: "Nueva categoría" }));

categories.post("/", "editor", async (c) => {
  const name = (await c.req.parseBody()).name;
  const r = await saveCategory(c.env.DB, null, name);
  if (r.ok === false) {
    c.status(422);
    return c.render(<CategoryForm value={String(name ?? "").trim()} error={r.error} />, { title: "Nueva categoría" });
  }
  // Straight to its form: a category is there to receive values.
  return c.redirect(`/categories/${r.id}?creada=1`, 303);
});

categories.get("/:id{[0-9]+}", "editor", async (c) => {
  const cat = await categoryOf(c.env.DB, idParam(c));
  if (!cat) return c.notFound();
  const notice = c.req.query("creada") === "1" ? "Categoría creada. Agrega sus valores." : c.req.query("guardado") === "1" ? "Cambios guardados." : undefined;
  return renderCategory(c, cat, { notice });
});

categories.post("/:id{[0-9]+}", "editor", async (c) => {
  const cat = await categoryOf(c.env.DB, idParam(c));
  if (!cat) return c.notFound();
  const name = (await c.req.parseBody()).name;
  const r = await saveCategory(c.env.DB, cat.id, name);
  if (r.ok === false) return renderCategory(c, cat, { value: String(name ?? "").trim(), error: r.error });
  return c.redirect(`/categories/${cat.id}?guardado=1`, 303);
});

// Swaps the category with its neighbour and renumbers them all 1..n, so
// positions left equal by older rows end up distinct.
categories.post("/:id{[0-9]+}/move", "editor", async (c) => {
  const db = c.env.DB;
  const direction = String((await c.req.parseBody()).direction ?? "");
  const ids = (await listCategories(db)).map((cat) => cat.id);
  const at = ids.indexOf(idParam(c));
  const to = direction === "up" ? at - 1 : direction === "down" ? at + 1 : -1;
  if (at !== -1 && to >= 0 && to < ids.length) {
    [ids[at], ids[to]] = [ids[to]!, ids[at]!];
    await db.batch(ids.map((id, i) => db.prepare("UPDATE tag_categories SET position = ? WHERE id = ?").bind(i + 1, id)));
  }
  return c.redirect("/categories", 303);
});

categories.post("/:id{[0-9]+}/values", "editor", async (c) => {
  const cat = await categoryOf(c.env.DB, idParam(c));
  if (!cat) return c.notFound();
  const name = (await c.req.parseBody()).name;
  const error = await saveValue(c.env.DB, cat, null, name);
  if (error) return renderCategory(c, cat, { newValue: String(name ?? "").trim(), valueError: error });
  return c.redirect(`/categories/${cat.id}`, 303);
});

categories.get("/:id{[0-9]+}/values/:value{[0-9]+}", "editor", async (c) => {
  const cat = await categoryOf(c.env.DB, idParam(c));
  const item = cat && (await valueOf(c.env.DB, cat, idParam(c, "value")));
  if (!cat || !item) return c.notFound();
  return c.render(<ValueForm cat={cat} item={item} value={item.name} />, { title: item.name });
});

categories.post("/:id{[0-9]+}/values/:value{[0-9]+}", "editor", async (c) => {
  const cat = await categoryOf(c.env.DB, idParam(c));
  const item = cat && (await valueOf(c.env.DB, cat, idParam(c, "value")));
  if (!cat || !item) return c.notFound();
  const name = (await c.req.parseBody()).name;
  const error = await saveValue(c.env.DB, cat, item.id, name);
  if (error) {
    c.status(422);
    return c.render(<ValueForm cat={cat} item={item} value={String(name ?? "").trim()} error={error} />, { title: item.name });
  }
  return c.redirect(`/categories/${cat.id}`, 303);
});

// Deletes only a value no document ever held. The condition is in the
// DELETE itself, so a document written since the page was drawn still
// stops it.
categories.post("/:id{[0-9]+}/values/:value{[0-9]+}/delete", "editor", async (c) => {
  const db = c.env.DB;
  const cat = await categoryOf(db, idParam(c));
  if (!cat) return c.redirect("/categories", 303);
  const item = await valueOf(db, cat, idParam(c, "value"));
  if (!item) return c.redirect(`/categories/${cat.id}`, 303);
  const done = await db
    .prepare(`${USES} DELETE FROM tags WHERE id = ? AND category_id = ? AND NOT EXISTS (SELECT 1 FROM uses WHERE tag_id = ?)`)
    .bind(item.id, cat.id, item.id)
    .run();
  if (done.meta.changes === 0) return renderCategory(c, cat, { valueError: refused(item.name) });
  return c.redirect(`/categories/${cat.id}`, 303);
});

// Deletes a category none of whose values any document ever held, with
// those values. One batch, so it is all or nothing.
categories.post("/:id{[0-9]+}/delete", "editor", async (c) => {
  const db = c.env.DB;
  const cat = await categoryOf(db, idParam(c));
  if (!cat) return c.redirect("/categories", 303);
  const [, gone] = await db.batch([
    db
      .prepare(
        `${USES} DELETE FROM tags WHERE category_id = ?
           AND NOT EXISTS (SELECT 1 FROM uses u JOIN tags t ON t.id = u.tag_id WHERE t.category_id = ?)`,
      )
      .bind(cat.id, cat.id),
    db.prepare("DELETE FROM tag_categories WHERE id = ? AND NOT EXISTS (SELECT 1 FROM tags WHERE category_id = ?)").bind(cat.id, cat.id),
  ]);
  if (gone!.meta.changes === 0) {
    c.status(422);
    return c.render(<CategoriesPage items={await listCategories(db)} error={refused(cat.name)} />, { title: "Categorías" });
  }
  return c.redirect("/categories", 303);
});
