import type { Context } from "hono";

// The user making the request. Until login exists (phase 4) it is always a
// placeholder user, created on first use. This is the only place phase 4
// replaces with the session user.
export type CurrentUser = { id: number; fullName: string };

const PLACEHOLDER = { username: "usuario de prueba", fullName: "Usuario de prueba" };

export async function currentUser(c: Context<{ Bindings: Env }>): Promise<CurrentUser> {
  const db = c.env.DB;
  // An empty password hash matches no password, so nobody can log in as it.
  const [, row] = await db.batch<{ id: number; full_name: string }>([
    db
      .prepare("INSERT INTO users (username, full_name, password_hash) VALUES (?, ?, '') ON CONFLICT (username) DO NOTHING")
      .bind(PLACEHOLDER.username, PLACEHOLDER.fullName),
    db.prepare("SELECT id, full_name FROM users WHERE username = ?").bind(PLACEHOLDER.username),
  ]);
  const user = row!.results[0]!;
  return { id: user.id, fullName: user.full_name };
}
