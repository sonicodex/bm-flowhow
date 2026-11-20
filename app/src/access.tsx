import { Hono, type Context, type Handler, type MiddlewareHandler } from "hono";
import { type AppEnv, type SessionUser } from "./session.ts";

// Who may reach each route (SPEC §4, §9 Server-enforced rules). A route is
// registered only through a Router, which takes its access as an argument,
// so a route cannot exist without declaring it; assertGuarded refuses to
// start a Worker in which one does.
//
// - public: anyone, signed in or not (the login and leaving).
// - account: signed in, even with a temporary password: the screen that
//           changes it. Every level below sends a user who must change
//           their password to that screen first.
// - user:   any signed-in user.
// - flow:   a signed-in user who may see the flow in `:id`. Otherwise 404,
//           as for a flow that does not exist (DECISIONS 2026-11-16).
// - editor: `can_edit`, which means "may change the content of flows": the
//           flows and import screens, and the areas screen, since assigning
//           flows to areas is content and opens no way up. Never the user
//           screens (4.4): whoever manages accounts can reset the Board's
//           password or promote themselves (DECISIONS, phase 4.2).
//           Otherwise 403.
// - users:  `can_manage_users`: the user screens. Full control (§4), since
//           whoever holds it can grant themselves anything. Otherwise 403.
// - admin:  `can_view_admin_layer`, for the admin layer (stage 3). No route
//           uses it yet. Otherwise 403.
// - setup:  `can_edit` and `can_manage_users` together: the first-use
//           wizard (phase 7.3), which walks through the areas, users and
//           flows screens, so it is for whoever may use all of them.
//           Otherwise 403.
// - report: the progress report, Board members and Leaders (SPEC §7, §9).
//           Otherwise 403. Which rows a Leader gets is the report's own
//           filter (src/report.tsx).
// Permissions are read from the flags, never from the role (§4). The one
// exception is `report`: SPEC gives the report to two roles, not to a
// permission.
export type Access = "public" | "account" | "user" | "flow" | "editor" | "admin" | "users" | "setup" | "report";

// The first-use wizard's access (phase 7.3), also used to offer it.
export const canSetUp = (user: SessionUser) => user.canEdit && user.canManageUsers;

const ACCESS = Symbol("access");
type Guard = MiddlewareHandler<AppEnv> & { [ACCESS]: Access };

export const SESSION_ENDED = "Tu sesión terminó. Vuelve a entrar y sigue donde ibas.";

// Pages send the browser to the login; the tour's JSON routes answer 401
// with the message to show.
export function signInFirst(c: Context<AppEnv>) {
  if (c.req.method !== "GET" && c.req.header("content-type")?.startsWith("application/json")) {
    return c.json({ error: SESSION_ENDED }, 401);
  }
  return c.redirect("/", c.req.method === "GET" ? 302 : 303);
}

export const PASSWORD_SCREEN = "/password";
export const CHANGE_FIRST = "Antes de seguir tienes que cambiar tu contraseña temporal. Recarga la página.";

function changePasswordFirst(c: Context<AppEnv>) {
  if (c.req.method !== "GET" && c.req.header("content-type")?.startsWith("application/json")) {
    return c.json({ error: CHANGE_FIRST }, 403);
  }
  return c.redirect(PASSWORD_SCREEN, c.req.method === "GET" ? 302 : 303);
}

function forbidden(c: Context<AppEnv>) {
  c.status(403);
  return c.render(
    <>
      <h1 class="page-title">Sin permiso</h1>
      <p>Tu usuario no tiene permiso para abrir esta página.</p>
      <p>
        <a href="/">Volver al inicio</a>
      </p>
    </>,
    { title: "Sin permiso" },
  );
}

// SPEC §4: a Standard user sees the flows assigned to any of their areas;
// Leaders and Board members see every flow. Users see a flow only once it
// is published (§8). One rule, written once, for the viewer, the tour and
// the home screen. It binds the user's role and id, in that order.
const VISIBLE = `EXISTS (SELECT 1 FROM releases r WHERE r.flow_id = f.id)
  AND (? <> 'standard' OR EXISTS (
    SELECT 1 FROM flow_areas fa JOIN user_areas ua ON ua.area_id = fa.area_id
    WHERE fa.flow_id = f.id AND ua.user_id = ?))`;

export async function canSeeFlow(db: D1Database, user: SessionUser, flowId: number): Promise<boolean> {
  const row = await db.prepare(`SELECT 1 FROM flows f WHERE f.id = ? AND ${VISIBLE}`).bind(flowId, user.role, user.id).first();
  return row !== null;
}

export type VisibleFlow = { id: number; name: string; objective: string; colour: number; major: number; minor: number };

// The flows the user sees, by name, each with its latest release's version.
export async function visibleFlows(db: D1Database, user: Pick<SessionUser, "id" | "role">): Promise<VisibleFlow[]> {
  const { results } = await db
    .prepare(
      `SELECT f.id, f.name, f.objective, f.colour, rel.major, rel.minor FROM flows f
       JOIN releases rel ON rel.id = (
         SELECT id FROM releases WHERE flow_id = f.id ORDER BY major DESC, minor DESC LIMIT 1)
       WHERE ${VISIBLE}
       ORDER BY f.name_key`,
    )
    .bind(user.role, user.id)
    .all<VisibleFlow>();
  return results;
}

function guard(access: Access): Guard {
  const check: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (access === "public") return next();
    const user = c.get("user");
    if (!user) return signInFirst(c);
    if (access !== "account" && user.mustChangePassword) return changePasswordFirst(c);
    if (access === "editor" && !user.canEdit) return forbidden(c);
    if (access === "admin" && !user.canViewAdminLayer) return forbidden(c);
    if (access === "users" && !user.canManageUsers) return forbidden(c);
    if (access === "setup" && !canSetUp(user)) return forbidden(c);
    if (access === "report" && user.role !== "board" && user.role !== "leader") return forbidden(c);
    if (access === "flow") {
      const id = Number(c.req.param("id"));
      if (!Number.isSafeInteger(id) || id <= 0 || !(await canSeeFlow(c.env.DB, user, id))) return c.notFound();
    }
    return next();
  };
  return Object.assign(check, { [ACCESS]: access });
}

// The only way to add a route: every method takes the route's access.
export class Router {
  readonly app = new Hono<AppEnv>();

  get(path: string, access: Access, handler: Handler<AppEnv>): this {
    this.app.on("GET", path, guard(access), handler);
    return this;
  }

  post(path: string, access: Access, handler: Handler<AppEnv>): this {
    this.app.on("POST", path, guard(access), handler);
    return this;
  }
}

const accessOf = (handler: unknown): Access | undefined => (handler as Partial<Guard>)[ACCESS];

export type GuardedRoute = { method: string; path: string; access: Access };

// Every route of the app with its access, read from the app itself. Throws
// if a route has none: one added with Hono directly, outside a Router.
// Middleware registered with `use` (method ALL, a path ending in `*`) is
// not a route. A route's handlers are consecutive entries with the same
// method and path, and a Router puts the guard first.
export function guardedRoutes(app: Hono<AppEnv>): GuardedRoute[] {
  const found: GuardedRoute[] = [];
  let current: { method: string; path: string } | null = null;
  for (const r of app.routes) {
    if (r.method === "ALL" && r.path.endsWith("*")) {
      current = null;
      continue;
    }
    if (current && current.method === r.method && current.path === r.path && accessOf(r.handler) === undefined) continue;
    const access = accessOf(r.handler);
    if (access === undefined) throw new Error(`La ruta ${r.method} ${r.path} no declara su acceso: regístrala con un Router.`);
    found.push({ method: r.method, path: r.path, access });
    current = { method: r.method, path: r.path };
  }
  return found;
}

export function assertGuarded(app: Hono<AppEnv>): void {
  guardedRoutes(app);
}
