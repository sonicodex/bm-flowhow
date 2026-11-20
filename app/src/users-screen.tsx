import type { Context } from "hono";
import { Router, visibleFlows } from "./access.tsx";
import { AdminForm, AdminList, Messages, RowActions, yesNo } from "./admin.tsx";
import { NAME_RULE, nameKey } from "./names.ts";
import { hashTemporary, temporaryPassword } from "./password.ts";
import type { AppEnv } from "./session.ts";
import { createUser, createUsers, resetPassword, rolePermissions, saveUser, setActive, userAreasError, type NewUser, type Role } from "./users.ts";
import { FROM_SETUP, ImportPage, plural, readColumns, readTable, rowError, SETUP_DONE, type Invalid, type Review, type RowError, type Saved } from "./import-list.tsx";

// The user screens (SPEC §4, §9 Administration screens; phase 4.4): list,
// create, edit, deactivate instead of delete, and reset a password. Behind
// `can_manage_users`, never `can_edit` (DECISIONS, phase 4.2).
export const usersScreen = new Router();

const ROLES: Record<Role, string> = { standard: "Empleado", leader: "Líder", board: "Junta directiva" };

type Permissions = { canEdit: boolean; canViewAdminLayer: boolean; canManageUsers: boolean };
const PERMISSIONS: { key: keyof Permissions; label: string; note: string }[] = [
  { key: "canEdit", label: "Editar flujos", note: "Cambiar el contenido de los flujos y sus áreas." },
  { key: "canViewAdminLayer", label: "Ver la capa administrativa", note: "Notas, marcas y métricas internas de los flujos." },
  {
    key: "canManageUsers",
    label: "Administrar usuarios",
    note: "Control total: crear cuentas, dar roles y permisos, restablecer contraseñas. Quien lo tiene puede darse cualquier otro permiso.",
  },
];

type Values = Permissions & { username: string; fullName: string; role: Role; areaIds: number[] };
type Area = { id: number; name: string };
type Account = Values & { id: number; isActive: boolean };

async function listAreas(db: D1Database): Promise<Area[]> {
  return (await db.prepare("SELECT id, name FROM areas ORDER BY name_key").all<Area>()).results;
}

type UserRow = {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  can_edit: number;
  can_view_admin_layer: number;
  can_manage_users: number;
  is_active: number;
  area_ids: string | null;
};

const toAccount = (r: UserRow): Account => ({
  id: r.id,
  username: r.username,
  fullName: r.full_name,
  role: r.role,
  canEdit: r.can_edit === 1,
  canViewAdminLayer: r.can_view_admin_layer === 1,
  canManageUsers: r.can_manage_users === 1,
  isActive: r.is_active === 1,
  areaIds: r.area_ids ? r.area_ids.split(",").map(Number) : [],
});

const USER_SQL = `SELECT u.id, u.username, u.full_name, u.role, u.can_edit, u.can_view_admin_layer, u.can_manage_users, u.is_active,
    (SELECT group_concat(area_id) FROM user_areas WHERE user_id = u.id) AS area_ids
  FROM users u`;

async function getAccount(db: D1Database, id: number): Promise<Account | null> {
  const row = await db.prepare(`${USER_SQL} WHERE u.id = ?`).bind(id).first<UserRow>();
  return row && toAccount(row);
}

export const LEADER_NO_AREAS_WARNING = "Este Líder no tiene áreas, así que no verá a nadie en el reporte de avance hasta que tenga una.";

// SPEC §4: having an area is not having something to see. Said when the
// account is saved, and the save goes through: flows get assigned later.
// A Leader may have no area (§4), but then shares one with nobody and the
// progress report shows them no one: said too, without blocking (owner's
// decision, phase 6.9).
async function noFlowsWarning(db: D1Database, account: { id: number; role: Role; areaIds: number[] }): Promise<string | null> {
  if (account.role === "leader") return account.areaIds.length ? null : LEADER_NO_AREAS_WARNING;
  if (account.role !== "standard") return null;
  if ((await visibleFlows(db, account)).length > 0) return null;
  return "Sus áreas todavía no tienen flujos publicados, así que por ahora no verá ninguno. Los verá cuando se publique un flujo asignado a alguna de ellas.";
}

// ---- List ----

function UsersPage({ accounts, areas }: { accounts: Account[]; areas: Area[] }) {
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  return (
    <AdminList
      title="Usuarios"
      action={{ href: "/users/new", label: "Nuevo usuario" }}
      more={{ href: "/users/import", label: "Importar usuarios" }}
      columns={[{ label: "Nombre" }, { label: "Usuario" }, { label: "Rol" }, { label: "Áreas" }, { label: "Activo" }]}
      empty={{
        purpose: "Aquí están las cuentas de quienes entran a FlowHow: su rol, sus áreas y sus permisos.",
        howToAdd: "Todavía no hay ninguna. Crea la primera con «Nuevo usuario», o tráelas todas de Excel con «Importar usuarios».",
      }}
      rows={accounts.map((a) => (
        <tr class={a.isActive ? undefined : "inactive"}>
          <td>
            <a href={`/users/${a.id}`}>{a.fullName}</a>
          </td>
          <td>{a.username}</td>
          <td>{ROLES[a.role]}</td>
          <td>{a.areaIds.map((id) => areaName.get(id)).join(", ")}</td>
          <td>{yesNo(a.isActive)}</td>
          <RowActions>
            <a href={`/users/${a.id}`} aria-label={`Editar a ${a.fullName}`}>
              Editar
            </a>
          </RowActions>
        </tr>
      ))}
    />
  );
}

usersScreen.get("/", "users", async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare(`${USER_SQL} ORDER BY u.is_active DESC, u.full_name`).all<UserRow>();
  return c.render(<UsersPage accounts={results.map(toAccount)} areas={await listAreas(db)} />, { title: "Usuarios" });
});

// ---- The form ----

function UserFields({ values, areas, isNew }: { values: Values; areas: Area[]; isNew: boolean }) {
  return (
    <>
      {isNew && (
        <>
          <label for="username">Usuario</label>
          <input id="username" name="username" value={values.username} required maxlength={100} autocapitalize="none" spellcheck={false} />
        </>
      )}
      <label for="full-name">Nombre completo</label>
      <input id="full-name" name="fullName" value={values.fullName} required maxlength={200} />
      <label for="role">Rol</label>
      <select id="role" name="role">
        {(Object.keys(ROLES) as Role[]).map((r) => (
          <option value={r} selected={values.role === r}>
            {ROLES[r]}
          </option>
        ))}
      </select>
      <fieldset class="choice-list">
        <legend>Áreas</legend>
        <p class="muted">Un Empleado necesita al menos una. La Junta directiva no tiene ninguna.</p>
        {areas.length ? (
          areas.map((a) => (
            <label>
              <input type="checkbox" name="area" value={String(a.id)} checked={values.areaIds.includes(a.id)} /> {a.name}
            </label>
          ))
        ) : (
          <p class="muted">Todavía no hay áreas.</p>
        )}
      </fieldset>
      {isNew ? (
        <p class="muted">Los permisos salen del rol. Después de crear la cuenta puedes cambiarlos uno por uno.</p>
      ) : (
        <fieldset class="choice-list">
          <legend>Permisos</legend>
          <p class="muted">Cambiar el rol no los cambia: se marcan aquí.</p>
          {PERMISSIONS.map((p) => (
            <label>
              <input type="checkbox" name={p.key} value="1" checked={values[p.key]} /> <strong>{p.label}</strong>{" "}
              <span class="muted">{p.note}</span>
            </label>
          ))}
        </fieldset>
      )}
    </>
  );
}

const BACK = { href: "/users", label: "Volver a usuarios" };

function NewUserPage({ values, areas, error }: { values: Values; areas: Area[]; error?: string }) {
  return (
    <AdminForm back={BACK} title="Nuevo usuario" error={error} action="/users" submit="Crear usuario">
      <UserFields values={values} areas={areas} isNew />
    </AdminForm>
  );
}

function EditUserPage(props: { account: Account; values: Values; areas: Area[]; error?: string; notice?: string; warning?: string | null }) {
  const { account, values, areas } = props;
  return (
    <AdminForm
      back={BACK}
      title={account.fullName}
      subtitle={`Usuario ${account.username}${account.isActive ? "" : " · Cuenta desactivada"}`}
      error={props.error}
      notice={props.notice}
      warning={props.warning}
      action={`/users/${account.id}`}
      submit="Guardar"
      after={
        <section class="admin-more">
          <h2>La cuenta</h2>
          <div class="admin-row">
            <form method="post" action={`/users/${account.id}/password`}>
              <button type="submit" class="button-secondary">
                Restablecer contraseña
              </button>
            </form>
            <form method="post" action={`/users/${account.id}/${account.isActive ? "deactivate" : "activate"}`}>
              <button type="submit" class="button-secondary">
                {account.isActive ? "Desactivar cuenta" : "Reactivar cuenta"}
              </button>
            </form>
          </div>
          <p class="muted">Restablecer cierra sus sesiones y le da una contraseña temporal. Desactivar le impide entrar; su historial se conserva.</p>
        </section>
      }
    >
      <UserFields values={values} areas={areas} isNew={false} />
    </AdminForm>
  );
}

// The one time a temporary password is shown: after creating the account
// or resetting it. Never stored in clear, never shown again.
function HandOverPage({ account, password, created, warning }: { account: Account; password: string; created: boolean; warning?: string | null }) {
  return (
    <>
      <p class="admin-back">
        <a href={BACK.href}>← {BACK.label}</a>
      </p>
      <h1 class="page-title">{created ? "Usuario creado" : "Contraseña restablecida"}</h1>
      <p>
        {created ? "La cuenta" : "La contraseña de"} <strong>{account.fullName}</strong> ({account.username}){" "}
        {created ? "ya existe." : "cambió y sus sesiones se cerraron."}
      </p>
      <Messages warning={warning} />
      <div class="card hand-over">
        <p class="eyebrow">CONTRASEÑA TEMPORAL</p>
        <p class="temp-password">
          <code>{password}</code>
        </p>
      </div>
      <p>Dásela en persona. Al entrar tendrá que cambiarla por una suya. Esta es la única vez que se muestra.</p>
      <p>
        <a href={`/users/${account.id}`}>Ver la cuenta</a>
      </p>
    </>
  );
}

// ---- Reading the form ----

function readValues(form: Record<string, string | File | (string | File)[]>, fallback: Values): Values | string {
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const list = (v: unknown) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  const role = String(one(form.role) ?? "");
  if (!(role in ROLES)) return "Elige un rol.";
  const values: Values = {
    username: String(one(form.username) ?? fallback.username).trim(),
    fullName: String(one(form.fullName) ?? "").trim(),
    role: role as Role,
    areaIds: list(form.area).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0),
    canEdit: one(form.canEdit) === "1",
    canViewAdminLayer: one(form.canViewAdminLayer) === "1",
    canManageUsers: one(form.canManageUsers) === "1",
  };
  return values;
}

const EMPTY: Values = { username: "", fullName: "", role: "standard", areaIds: [], canEdit: false, canViewAdminLayer: false, canManageUsers: false };

const idParam = (c: Context<AppEnv>) => Number(c.req.param("id"));

// ---- Create ----

usersScreen.get("/new", "users", async (c) =>
  c.render(<NewUserPage values={EMPTY} areas={await listAreas(c.env.DB)} />, { title: "Nuevo usuario" }),
);

usersScreen.post("/", "users", async (c) => {
  const db = c.env.DB;
  const read = readValues(await c.req.parseBody({ all: true }), EMPTY);
  const refuse = async (error: string, values: Values) => {
    c.status(422);
    return c.render(<NewUserPage values={values} areas={await listAreas(db)} error={error} />, { title: "Nuevo usuario" });
  };
  if (typeof read === "string") return refuse(read, EMPTY);
  if (!nameKey(read.username)) return refuse("Escribe el usuario con el que entrará.", read);
  if (!read.fullName) return refuse("Escribe el nombre completo.", read);
  const password = temporaryPassword();
  const created = await createUser(db, {
    ...read,
    ...rolePermissions(read.role),
    passwordHash: await hashTemporary(password),
    mustChangePassword: true,
  });
  if (created.ok === false) return refuse(created.error, read);
  const account = (await getAccount(db, created.id))!;
  return c.render(<HandOverPage account={account} password={password} created warning={await noFlowsWarning(db, account)} />, {
    title: "Usuario creado",
  });
});

// ---- Edit ----

usersScreen.get("/:id{[0-9]+}", "users", async (c) => {
  const db = c.env.DB;
  const account = await getAccount(db, idParam(c));
  if (!account) return c.notFound();
  const saved = c.req.query("guardado") === "1";
  return c.render(
    <EditUserPage
      account={account}
      values={account}
      areas={await listAreas(db)}
      notice={saved ? "Cambios guardados." : undefined}
      warning={saved ? await noFlowsWarning(db, account) : undefined}
    />,
    { title: account.fullName },
  );
});

async function refuseEdit(c: Context<AppEnv>, account: Account, values: Values, error: string) {
  c.status(422);
  return c.render(<EditUserPage account={account} values={values} areas={await listAreas(c.env.DB)} error={error} />, { title: account.fullName });
}

usersScreen.post("/:id{[0-9]+}", "users", async (c) => {
  const db = c.env.DB;
  const account = await getAccount(db, idParam(c));
  if (!account) return c.notFound();
  const read = readValues(await c.req.parseBody({ all: true }), account);
  if (typeof read === "string") return refuseEdit(c, account, account, read);
  if (!read.fullName) return refuseEdit(c, account, read, "Escribe el nombre completo.");
  // The last-manager rule is the database's (migration 0006); saveUser
  // turns its refusal into the message.
  const saved = await saveUser(db, account.id, read);
  if (saved.ok === false) return refuseEdit(c, account, read, saved.error);
  return c.redirect(`/users/${account.id}?guardado=1`, 303);
});

for (const [path, active] of [["deactivate", false], ["activate", true]] as const) {
  usersScreen.post(`/:id{[0-9]+}/${path}`, "users", async (c) => {
    const db = c.env.DB;
    const account = await getAccount(db, idParam(c));
    if (!account) return c.notFound();
    const result = await setActive(db, account.id, active);
    if (result.ok === false) return refuseEdit(c, account, account, result.error);
    return c.redirect(`/users/${account.id}`, 303);
  });
}

usersScreen.post("/:id{[0-9]+}/password", "users", async (c) => {
  const db = c.env.DB;
  const account = await getAccount(db, idParam(c));
  if (!account) return c.notFound();
  const password = temporaryPassword();
  await resetPassword(db, account.id, await hashTemporary(password));
  // Resetting one's own password ends one's own session too: the page still
  // shows, and the next click goes to the login.
  return c.render(<HandOverPage account={account} password={password} created={false} />, { title: "Contraseña restablecida" });
});

// ---- Import (SPEC §4 «Importing areas, users and flows»; phase 7.2) ----
// Creates accounts only: a username that exists is a row error. Each new
// account gets a temporary password it must change at its first login;
// the list is returned once, never stored.

const USER_COLUMNS = [
  { key: "username", label: "Usuario" },
  { key: "fullName", label: "Nombre completo" },
  { key: "role", label: "Rol" },
  { key: "areas", label: "Áreas" },
] as const;
type UserKey = (typeof USER_COLUMNS)[number]["key"];

const ROLE_BY_KEY = new Map(Object.entries(ROLES).map(([role, label]) => [nameKey(label), role as Role]));
const ROLE_LIST = Object.values(ROLES);

type PlannedUser = { row: number; username: string; fullName: string; role: Role; areaIds: number[]; areaNames: string[] };
type UserPlan = { errors: RowError[]; users: PlannedUser[]; warnings: string[] };

async function planUsers(db: D1Database, body: unknown): Promise<UserPlan | Invalid> {
  const read = readTable(body);
  if (read.ok === false) return read.answer;
  const cols = readColumns<UserKey>(read.table, [...USER_COLUMNS]);
  if (cols.ok === false) return cols.answer;
  const areas = await listAreas(db);
  const areaByKey = new Map(areas.map((a) => [nameKey(a.name), a]));
  const taken = new Set((await db.prepare("SELECT username FROM users").all<{ username: string }>()).results.map((u) => u.username));
  // Areas with a published flow: a new Empleado elsewhere would see none (§4).
  const seeing = new Set(
    (await db.prepare("SELECT DISTINCT fa.area_id AS id FROM flow_areas fa WHERE EXISTS (SELECT 1 FROM releases r WHERE r.flow_id = fa.flow_id)").all<{ id: number }>()).results.map(
      (r) => r.id,
    ),
  );
  const plan: UserPlan = { errors: [], users: [], warnings: [] };
  const seen = new Map<string, number>();
  for (const { row, cells } of cols.lines) {
    const problems: string[] = [];
    const key = nameKey(cells.username);
    if (!key) problems.push("le falta el usuario.");
    else if (key.length > 100) problems.push("el usuario tiene más de 100 caracteres.");
    else if (seen.has(key)) problems.push(`el usuario «${cells.username}» ya está en la fila ${seen.get(key)}. ${NAME_RULE}`);
    else if (taken.has(key)) problems.push(`ya existe el usuario «${cells.username}». Este importador solo crea cuentas. ${NAME_RULE}`);
    if (key && !seen.has(key)) seen.set(key, row);
    if (!cells.fullName) problems.push("le falta el nombre completo.");
    else if (cells.fullName.length > 200) problems.push("el nombre completo tiene más de 200 caracteres.");
    const role = ROLE_BY_KEY.get(nameKey(cells.role));
    if (!cells.role) problems.push(`le falta el rol: ${ROLE_LIST.join(", ")}.`);
    else if (!role) problems.push(`el rol «${cells.role}» no existe: usa ${ROLE_LIST.join(", ")}.`);
    const areaIds: number[] = [];
    const areaNames: string[] = [];
    for (const name of cells.areas.split(",").map((n) => n.trim()).filter(Boolean)) {
      const area = areaByKey.get(nameKey(name));
      if (!area) problems.push(`el área «${name}» no existe. Créala antes con «Importar áreas».`);
      else if (!areaIds.includes(area.id)) {
        areaIds.push(area.id);
        areaNames.push(area.name);
      }
    }
    if (role && problems.length === 0) {
      const areasError = userAreasError(role, areaIds);
      if (areasError) problems.push(areasError);
    }
    if (problems.length) {
      plan.errors.push(...problems.map((p) => rowError(row, p)));
      continue;
    }
    plan.users.push({ row, username: key, fullName: cells.fullName, role: role!, areaIds, areaNames });
    // Said, without blocking, as the form says it (phase 4.4).
    if (role === "standard" && !areaIds.some((id) => seeing.has(id))) {
      plan.warnings.push(`Fila ${row} (${key}): sus áreas todavía no tienen flujos publicados, así que por ahora no verá ninguno.`);
    }
    if (role === "leader" && areaIds.length === 0) plan.warnings.push(`Fila ${row} (${key}): ${LEADER_NO_AREAS_WARNING}`);
  }
  return plan;
}

async function reviewUsers(db: D1Database, body: unknown): Promise<Review | Invalid> {
  const plan = await planUsers(db, body);
  if ("status" in plan) return plan;
  const rows = new Set(plan.errors.map((e) => e.row)).size + plan.users.length;
  return {
    status: "review",
    summary: `${plural(rows, "fila", "filas")}: ${plural(plan.users.length, "cuenta nueva", "cuentas nuevas")}.`,
    errors: plan.errors,
    warnings: plan.warnings,
    groups: [
      {
        title: `Cuentas nuevas (${plan.users.length})`,
        note: "Cada una recibe una contraseña temporal que tendrá que cambiar al entrar por primera vez. Los permisos salen del rol, como en «Nuevo usuario».",
        columns: ["Usuario", "Nombre completo", "Rol", "Áreas"],
        rows: plan.users.map((u) => [u.username, u.fullName, ROLES[u.role], u.areaNames.join(", ")]),
      },
    ],
  };
}

export const PASSWORD_FILE_NOTES = [
  "Contraseñas temporales de FlowHow.",
  "Cada persona tiene que cambiar la suya la primera vez que entre: la temporal solo sirve para ese primer ingreso.",
  "Borra este archivo cuando las hayas repartido todas.",
];

async function applyUsers(db: D1Database, body: unknown): Promise<Saved | Invalid> {
  const plan = await planUsers(db, body);
  if ("status" in plan) return plan;
  if (plan.errors.length) return { status: "invalid", error: "El archivo tiene filas por corregir. Vuelve a revisarlo." };
  const handed = plan.users.map((u) => ({ ...u, password: temporaryPassword() }));
  const users: NewUser[] = [];
  for (const u of handed) {
    users.push({
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      areaIds: u.areaIds,
      ...rolePermissions(u.role),
      passwordHash: await hashTemporary(u.password),
      mustChangePassword: true,
    });
  }
  const created = await createUsers(db, users);
  if (created.ok === false) return { status: "invalid", error: created.error };
  const columns = ["Usuario", "Nombre completo", "Contraseña temporal"];
  const rows = handed.map((u) => [u.username, u.fullName.trim(), u.password]);
  return {
    status: "saved",
    title: "Usuarios importados",
    message: `Se ${handed.length === 1 ? "creó" : "crearon"} ${plural(handed.length, "cuenta", "cuentas")}. Dale a cada persona su contraseña temporal; al entrar tendrá que cambiarla por una suya.`,
    warnings: plan.warnings,
    groups: [{ title: "Contraseñas temporales", columns, rows }],
    download: { name: "Contrasenas_temporales_FlowHow.xlsx", sheet: "Contraseñas", notes: PASSWORD_FILE_NOTES, columns, rows },
  };
}

usersScreen.get("/import", "users", (c) => {
  const fromSetup = c.req.query("desde") === FROM_SETUP;
  return c.render(
    <ImportPage
      back={fromSetup ? SETUP_DONE : BACK}
      title="Importar usuarios"
      intro="Crea de una vez las cuentas de la empresa. Antes de crear nada verás una revisión con los problemas y lo que entraría. Al final verás la contraseña temporal de cada cuenta, una sola vez."
      columnsNote={`Cuatro columnas: «Usuario», «Nombre completo», «Rol» (${ROLE_LIST.join(", ")}) y «Áreas», separadas por coma. Las áreas tienen que existir: créalas antes con «Importar áreas». Solo se crean cuentas nuevas; un usuario que ya existe se marca como error.`}
      config={{
        sheet: "Usuarios",
        reviewUrl: "/users/import/review",
        applyUrl: "/users/import",
        template: {
          name: "Plantilla_Usuarios_FlowHow.xlsx",
          columns: USER_COLUMNS.map((col) => col.label),
          widths: [22, 36, 18, 40],
          lists: [{ col: 2, values: ROLE_LIST, title: "Rol", message: `Usa uno de estos roles: ${ROLE_LIST.join(", ")}.` }],
        },
        done: fromSetup ? SETUP_DONE : { href: "/users", label: "Ir a usuarios" },
        keepWarning: "Esta es la única vez que se muestran estas contraseñas: descárgalas antes de salir de esta página.",
      }}
    />,
    { title: "Importar usuarios" },
  );
});

usersScreen.post("/import/review", "users", async (c) => {
  const answer = await reviewUsers(c.env.DB, await c.req.json().catch(() => null));
  return c.json(answer, answer.status === "invalid" ? 400 : 200);
});

usersScreen.post("/import", "users", async (c) => {
  const answer = await applyUsers(c.env.DB, await c.req.json().catch(() => null));
  return c.json(answer, answer.status === "invalid" ? 422 : 200);
});
