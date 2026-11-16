import type { Context } from "hono";
import { Router, visibleFlows } from "./access.tsx";
import { nameKey } from "./names.ts";
import { hashPassword, temporaryPassword } from "./password.ts";
import type { AppEnv } from "./session.ts";
import { createUser, resetPassword, rolePermissions, saveUser, setActive, type Role } from "./users.ts";

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

// SPEC §4: having an area is not having something to see. Said when the
// account is saved, and the save goes through: flows get assigned later.
async function noFlowsWarning(db: D1Database, account: { id: number; role: Role }): Promise<string | null> {
  if (account.role !== "standard") return null;
  if ((await visibleFlows(db, account)).length > 0) return null;
  return "Sus áreas todavía no tienen flujos publicados, así que por ahora no verá ninguno. Los verá cuando se publique un flujo asignado a alguna de ellas.";
}

// ---- List ----

function UsersPage({ accounts, areas }: { accounts: Account[]; areas: Area[] }) {
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  return (
    <>
      <h1 class="page-title">Usuarios</h1>
      <p>
        <a class="button-primary" href="/users/new">
          Nuevo usuario
        </a>
      </p>
      <ul class="admin-list">
        {accounts.map((a) => {
          const permissions = PERMISSIONS.filter((p) => a[p.key]).map((p) => p.label);
          return (
            <li class="admin-row">
              <a href={`/users/${a.id}`}>{a.fullName}</a>
              <span class="muted">{a.username}</span>
              <span>{ROLES[a.role]}</span>
              {a.areaIds.length > 0 && <span class="muted">{a.areaIds.map((id) => areaName.get(id)).join(", ")}</span>}
              {permissions.length > 0 && <span class="muted">{permissions.join(" · ")}</span>}
              {!a.isActive && <strong>Desactivada</strong>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

usersScreen.get("/", "users", async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare(`${USER_SQL} ORDER BY u.is_active DESC, u.full_name`).all<UserRow>();
  return c.render(<UsersPage accounts={results.map(toAccount)} areas={await listAreas(db)} />, { title: "Usuarios" });
});

// ---- The form ----

function Messages({ error, notice, warning }: { error?: string; notice?: string; warning?: string | null }) {
  return (
    <>
      {error && (
        <p class="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {warning && (
        <p class="form-warning" role="status">
          {warning}
        </p>
      )}
    </>
  );
}

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

function NewUserPage({ values, areas, error }: { values: Values; areas: Area[]; error?: string }) {
  return (
    <>
      <h1 class="page-title">Nuevo usuario</h1>
      <Messages error={error} />
      <form method="post" action="/users" class="stacked-form admin-form">
        <UserFields values={values} areas={areas} isNew />
        <button type="submit" class="button-primary">
          Crear usuario
        </button>
      </form>
      <p>
        <a href="/users">Volver a usuarios</a>
      </p>
    </>
  );
}

function EditUserPage(props: { account: Account; values: Values; areas: Area[]; error?: string; notice?: string; warning?: string | null }) {
  const { account, values, areas } = props;
  return (
    <>
      <h1 class="page-title">{account.fullName}</h1>
      <p class="muted">
        Usuario {account.username}
        {account.isActive ? "" : " · Cuenta desactivada"}
      </p>
      <Messages error={props.error} notice={props.notice} warning={props.warning} />
      <form method="post" action={`/users/${account.id}`} class="stacked-form admin-form">
        <UserFields values={values} areas={areas} isNew={false} />
        <button type="submit" class="button-primary">
          Guardar
        </button>
      </form>
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
      <p>
        <a href="/users">Volver a usuarios</a>
      </p>
    </>
  );
}

// The one time a temporary password is shown: after creating the account
// or resetting it. Never stored in clear, never shown again.
function HandOverPage({ account, password, created, warning }: { account: Account; password: string; created: boolean; warning?: string | null }) {
  return (
    <>
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
        <a href={`/users/${account.id}`}>Ver la cuenta</a> · <a href="/users">Volver a usuarios</a>
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
    passwordHash: await hashPassword(password),
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
  await resetPassword(db, account.id, await hashPassword(password));
  // Resetting one's own password ends one's own session too: the page still
  // shows, and the next click goes to the login.
  return c.render(<HandOverPage account={account} password={password} created={false} />, { title: "Contraseña restablecida" });
});
