import { NAME_RULE, nameKey } from "./names.ts";

export type Role = "standard" | "leader" | "board";

export type UserFields = {
  fullName: string;
  role: Role;
  areaIds: number[];
  canEdit?: boolean;
  canViewAdminLayer?: boolean;
  canManageUsers?: boolean;
};

export type NewUser = UserFields & { username: string; passwordHash: string; mustChangePassword?: boolean };

export type SaveResult = { ok: true; id: number } | { ok: false; error: string };

// SPEC §4: a Standard user sees only the flows of their areas, so one with
// no area would see nothing. Leaders and Board members see every flow.
// The permissions a role gives a new account (SPEC §4). After that each is
// set on its own, in the user form.
export function rolePermissions(role: Role): { canEdit: boolean; canViewAdminLayer: boolean; canManageUsers: boolean } {
  const board = role === "board";
  return { canEdit: board, canViewAdminLayer: board, canManageUsers: board };
}

export const LAST_MANAGER =
  "Es la única cuenta activa que puede administrar usuarios. Dale ese permiso a otra cuenta antes de quitárselo o desactivarla.";

export function userAreasError(role: Role, areaIds: number[]): string | null {
  if (role === "standard" && areaIds.length === 0) {
    return "Un usuario Empleado necesita al menos un área: sin ella no ve ningún flujo.";
  }
  // §4: Board members belong to no area.
  if (role === "board" && areaIds.length > 0) {
    return "La Junta directiva no pertenece a ningún área: quítale las áreas marcadas.";
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

const flag = (value: boolean | undefined) => (value ? 1 : 0);

function failure(e: unknown, username: string): SaveResult {
  const message = e instanceof Error ? e.message : String(e);
  if (/UNIQUE constraint failed: users\.username/.test(message)) {
    return { ok: false, error: `Ya existe el usuario «${username}». ${NAME_RULE}` };
  }
  // The trigger of migration 0006.
  if (/last active user manager/.test(message)) return { ok: false, error: LAST_MANAGER };
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
          `INSERT INTO users (username, full_name, password_hash, role, can_edit, can_view_admin_layer, can_manage_users, must_change_password)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          username,
          user.fullName.trim(),
          user.passwordHash,
          user.role,
          flag(user.canEdit),
          flag(user.canViewAdminLayer),
          flag(user.canManageUsers),
          flag(user.mustChangePassword),
        ),
      ...areaInserts(db, null, username, user.areaIds),
    ]);
    return { ok: true, id: inserted.meta.last_row_id };
  } catch (e) {
    return failure(e, username);
  }
}

// Several accounts at once (the user importer, phase 7.2), in one batch:
// one refused row, a username taken in the meantime say, leaves none of
// them behind.
export async function createUsers(db: D1Database, users: NewUser[]): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const user of users) {
    const error = userAreasError(user.role, user.areaIds);
    if (error) return { ok: false, error };
  }
  try {
    await db.batch(
      users.flatMap((user) => {
        const username = nameKey(user.username);
        return [
          db
            .prepare(
              `INSERT INTO users (username, full_name, password_hash, role, can_edit, can_view_admin_layer, can_manage_users, must_change_password)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(username, user.fullName.trim(), user.passwordHash, user.role, flag(user.canEdit), flag(user.canViewAdminLayer), flag(user.canManageUsers), flag(user.mustChangePassword)),
          ...areaInserts(db, null, username, user.areaIds),
        ];
      }),
    );
    return { ok: true };
  } catch (e) {
    const message = String(e);
    if (/UNIQUE constraint failed: users\.username/.test(message)) {
      return { ok: false, error: "Mientras tanto alguien creó una cuenta con uno de estos usuarios. Vuelve a revisar el archivo." };
    }
    if (/FOREIGN KEY/.test(message)) return { ok: false, error: "Mientras tanto se borró una de las áreas. Vuelve a revisar el archivo." };
    throw e;
  }
}

// Replaces the user's fields and areas.
export async function saveUser(db: D1Database, id: number, user: UserFields): Promise<SaveResult> {
  const error = userAreasError(user.role, user.areaIds);
  if (error) return { ok: false, error };
  try {
    await db.batch([
      db
        .prepare("UPDATE users SET full_name = ?, role = ?, can_edit = ?, can_view_admin_layer = ?, can_manage_users = ? WHERE id = ?")
        .bind(user.fullName.trim(), user.role, flag(user.canEdit), flag(user.canViewAdminLayer), flag(user.canManageUsers), id),
      db.prepare("DELETE FROM user_areas WHERE user_id = ?").bind(id),
      ...areaInserts(db, id, "", user.areaIds),
    ]);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "");
  }
}

// Deactivating replaces deleting (§9): the user's history stays, and a
// deactivated session counts as none (src/session.ts). Their open sessions
// are deleted too.
export async function setActive(db: D1Database, id: number, active: boolean): Promise<SaveResult> {
  try {
    await db.batch([
      db.prepare("UPDATE users SET is_active = ? WHERE id = ?").bind(flag(active), id),
      ...(active ? [] : [db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id)]),
    ]);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "");
  }
}

// A password reset by the Board (phase 4.4): the temporary password must be
// changed at the next sign-in, and every open session closes.
export async function resetPassword(db: D1Database, id: number, passwordHash: string): Promise<void> {
  await db.batch([
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?").bind(passwordHash, id),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id),
  ]);
}

// The user's own new password, replacing a temporary one.
export async function changeOwnPassword(db: D1Database, id: number, passwordHash: string): Promise<void> {
  await db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").bind(passwordHash, id).run();
}
