import { NAME_RULE, nameKey } from "./names";

export type Role = "standard" | "leader" | "board";

export type UserFields = {
  fullName: string;
  role: Role;
  areaIds: number[];
  canEdit?: boolean;
  canViewAdminLayer?: boolean;
};

export type NewUser = UserFields & { username: string; passwordHash: string };

export type SaveResult = { ok: true; id: number } | { ok: false; error: string };

// SPEC §4: a Standard user sees only the flows of their areas, so one with
// no area would see nothing. Leaders and Board members see every flow.
export function userAreasError(role: Role, areaIds: number[]): string | null {
  if (role === "standard" && areaIds.length === 0) {
    return "Un usuario Empleado necesita al menos un área: sin ella no ve ningún flujo.";
  }
  return null;
}

function areaInserts(db: D1Database, userId: number | null, username: string, areaIds: number[]) {
  // On create the id is not known yet inside the batch, so it is looked up
  // by username.
  return [...new Set(areaIds)].map((areaId) =>
    userId === null
      ? db.prepare("INSERT INTO user_areas (user_id, area_id) SELECT id, ? FROM users WHERE username = ?").bind(areaId, username)
      : db.prepare("INSERT INTO user_areas (user_id, area_id) VALUES (?, ?)").bind(userId, areaId),
  );
}

function failure(e: unknown, username: string): SaveResult {
  const message = e instanceof Error ? e.message : String(e);
  if (/UNIQUE constraint failed: users\.username/.test(message)) {
    return { ok: false, error: `Ya existe el usuario «${username}». ${NAME_RULE}` };
  }
  if (/FOREIGN KEY/.test(message)) {
    return { ok: false, error: "Una de las áreas elegidas ya no existe." };
  }
  throw e;
}

// The user row and its areas are written in one batch, which D1 runs as a
// single transaction: a rejected area leaves no user behind.
export async function createUser(db: D1Database, user: NewUser): Promise<SaveResult> {
  const error = userAreasError(user.role, user.areaIds);
  if (error) return { ok: false, error };
  const username = nameKey(user.username);
  try {
    const [inserted] = await db.batch([
      db
        .prepare(
          "INSERT INTO users (username, full_name, password_hash, role, can_edit, can_view_admin_layer) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(username, user.fullName.trim(), user.passwordHash, user.role, user.canEdit ? 1 : 0, user.canViewAdminLayer ? 1 : 0),
      ...areaInserts(db, null, username, user.areaIds),
    ]);
    return { ok: true, id: inserted.meta.last_row_id };
  } catch (e) {
    return failure(e, username);
  }
}

// Replaces the user's fields and areas.
export async function saveUser(db: D1Database, id: number, user: UserFields): Promise<SaveResult> {
  const error = userAreasError(user.role, user.areaIds);
  if (error) return { ok: false, error };
  try {
    await db.batch([
      db
        .prepare("UPDATE users SET full_name = ?, role = ?, can_edit = ?, can_view_admin_layer = ? WHERE id = ?")
        .bind(user.fullName.trim(), user.role, user.canEdit ? 1 : 0, user.canViewAdminLayer ? 1 : 0, id),
      db.prepare("DELETE FROM user_areas WHERE user_id = ?").bind(id),
      ...areaInserts(db, id, "", user.areaIds),
    ]);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "");
  }
}
