import { Hono, type Context, type Handler, type MiddlewareHandler } from "hono";
import { type AppEnv, type SessionUser } from "./session.ts";

// Who may reach each route (SPEC §4, §9 Server-enforced rules). A route is
// registered only through a Router, which takes its access as an argument,
// so a route cannot exist without declaring it; assertGuarded refuses to
// start a Worker in which one does.
//
// - public: anyone, signed in or not (the login and leaving).
// - user:   any signed-in user.
// - flow:   a signed-in user who may see the flow in `:id`. Otherwise 404,
//           as for a flow that does not exist (DECISIONS 2026-11-16).
// - editor: `can_edit`. The editor screens and, by the owner's choice, the
//           administration screens (areas, users). Otherwise 403.
// - admin:  `can_view_admin_layer`, for the admin layer (stage 3). No route
//           uses it yet. Otherwise 403.
// Permissions are read from the flags, never from the role (§4).
export type Access = "public" | "user" | "flow" | "editor" | "admin";

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

function forbidden(c: Context<AppEnv>) {
  c.status(403);
  return c.render(
    <>
      <h1 class="page-title">Sin permiso</h1>
      <p>Tu usuario no tiene permiso para abrir esta página.</p>
      <p>
        <a href="/home">Volver al inicio</a>
      </p>
    </>,
    { title: "Sin permiso" },
  );
}

// SPEC §4: a Standard user sees the flows assigned to any of their areas;
// Leaders and Board members see every flow. In the viewer a flow exists only
// once published (§8). The home screen (4.3) lists flows by this same rule.
export async function canSeeFlow(db: D1Database, user: SessionUser, flowId: number): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM flows f
       WHERE f.id = ?
         AND EXISTS (SELECT 1 FROM releases r WHERE r.flow_id = f.id)
         AND (? <> 'standard' OR EXISTS (
           SELECT 1 FROM flow_areas fa JOIN user_areas ua ON ua.area_id = fa.area_id
           WHERE fa.flow_id = f.id AND ua.user_id = ?))`,
    )
    .bind(flowId, user.role, user.id)
    .first();
  return row !== null;
}

function guard(access: Access): Guard {
  const check: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (access === "public") return next();
    const user = c.get("user");
    if (!user) return signInFirst(c);
    if (access === "editor" && !user.canEdit) return forbidden(c);
    if (access === "admin" && !user.canViewAdminLayer) return forbidden(c);
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
