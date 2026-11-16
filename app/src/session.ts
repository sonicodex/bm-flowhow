import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Role } from "./users.ts";

// Sessions in D1 (SPEC §9). The cookie holds a random token; the table holds
// its SHA-256, so a copy of the database opens no session. A session does
// not know how the user got in: password login ends in createSession, and a
// later Microsoft SSO will end there too.

export type SessionUser = {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  canEdit: boolean;
  canViewAdminLayer: boolean;
};

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser | null } };

export const COOKIE = "flowhow_session";
const DAY = 24 * 60 * 60 * 1000;
// Seven days since the last use. The expiry moves at most once a day, so
// browsing does not write to D1 on every page.
export const LIFETIME = 7 * DAY;
const RENEW_AFTER = DAY;

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const sessionId = async (token: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));

function writeCookie(c: Context, token: string) {
  setCookie(c, COOKIE, token, { path: "/", httpOnly: true, secure: true, sameSite: "Lax", maxAge: LIFETIME / 1000 });
}

// Stores a new session and returns its token, for the cookie.
export async function openSession(db: D1Database, userId: number, now = new Date()): Promise<string> {
  const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  await db.batch([
    // Each login is a good moment to drop this user's expired sessions.
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?").bind(userId, now.toISOString()),
    db
      .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(await sessionId(token), userId, new Date(now.getTime() + LIFETIME).toISOString()),
  ]);
  return token;
}

export async function createSession(c: Context<AppEnv>, userId: number): Promise<void> {
  writeCookie(c, await openSession(c.env.DB, userId));
}

export async function endSession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sessionId(token)).run();
  deleteCookie(c, COOKIE, { path: "/", secure: true });
}

type Row = {
  expires_at: string;
  id: number;
  username: string;
  full_name: string;
  role: Role;
  can_edit: number;
  can_view_admin_layer: number;
};

// Puts the session's user, or null, in the context. An expired session, or
// one whose user was deactivated, counts as none and is deleted.
export const loadSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", null);
  const token = getCookie(c, COOKIE);
  if (token) {
    const db = c.env.DB;
    const id = await sessionId(token);
    const now = new Date();
    const row = await db
      .prepare(
        `SELECT s.expires_at, u.id, u.username, u.full_name, u.role, u.can_edit, u.can_view_admin_layer
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > ? AND u.is_active = 1`,
      )
      .bind(id, now.toISOString())
      .first<Row>();
    if (!row) {
      await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
      deleteCookie(c, COOKIE, { path: "/", secure: true });
    } else {
      c.set("user", {
        id: row.id,
        username: row.username,
        fullName: row.full_name,
        role: row.role,
        canEdit: row.can_edit === 1,
        canViewAdminLayer: row.can_view_admin_layer === 1,
      });
      if (Date.parse(row.expires_at) - now.getTime() < LIFETIME - RENEW_AFTER) {
        await db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").bind(new Date(now.getTime() + LIFETIME).toISOString(), id).run();
        writeCookie(c, token);
      }
    }
  }
  await next();
};

// Everything after this middleware needs a session. Pages send the browser
// to the login; the tour's JSON routes answer 401 with the message to show.
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("user")) return next();
  if (c.req.method !== "GET" && c.req.header("content-type")?.startsWith("application/json")) {
    return c.json({ error: "Tu sesión terminó. Vuelve a entrar y sigue donde ibas." }, 401);
  }
  return c.redirect("/", c.req.method === "GET" ? 302 : 303);
};

// The user of a request that passed requireUser.
export const userOf = (c: Context<AppEnv>): SessionUser => c.get("user")!;
