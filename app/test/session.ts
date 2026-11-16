import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { nameKey } from "../src/names.ts";
import { COOKIE, openSession } from "../src/session.ts";
import { createUser, type Role } from "../src/users.ts";

export const ORIGIN = "http://example.com";

export type Signed = {
  id: number;
  cookie: string;
  // A request to the Worker with this user's session, as a browser on the
  // app's own page sends it (same Origin, so CSRF lets forms through).
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
};

export const withSession = (cookie: string) => (path: string, init: RequestInit = {}) =>
  exports.default.fetch(ORIGIN + path, {
    redirect: "manual",
    ...init,
    headers: { origin: ORIGIN, cookie, ...(init.headers as Record<string, string> | undefined) },
  });

// Creates a user with no password (none is needed: the session is opened
// directly) and signs them in. A Standard user gets an area of its own when
// none is given, as the server requires one.
export async function signIn(
  options: { username?: string; role?: Role; areaIds?: number[] } = {},
): Promise<Signed> {
  const role = options.role ?? "board";
  const username = options.username ?? role;
  let areaIds = options.areaIds ?? [];
  if (role === "standard" && areaIds.length === 0) {
    const name = `Área de ${username}`;
    const area = await env.DB.prepare("INSERT INTO areas (name, name_key) VALUES (?, ?) RETURNING id").bind(name, nameKey(name)).first<number>("id");
    areaIds = [area!];
  }
  const board = role === "board";
  const created = await createUser(env.DB, {
    username,
    fullName: `Nombre de ${username}`,
    role,
    areaIds,
    passwordHash: "",
    canEdit: board,
    canViewAdminLayer: board,
  });
  if (!created.ok) throw new Error(created.error);
  const cookie = `${COOKIE}=${await openSession(env.DB, created.id)}`;
  return { id: created.id, cookie, fetch: withSession(cookie) };
}
