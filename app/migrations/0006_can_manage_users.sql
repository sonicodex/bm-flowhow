-- Phase 4.4: a third permission, separate from can_edit (SPEC §4). It is
-- full control: whoever holds it can grant themselves every other one.
-- Every Board member had it in practice until now, so they keep it.
ALTER TABLE users ADD COLUMN can_manage_users INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_users IN (0, 1));
UPDATE users SET can_manage_users = 1 WHERE role = 'board';

-- At least one active account always holds it (SPEC §4): a lost password is
-- recoverable from the command line, a lost permission is not. Enforced
-- here, so the screens, the CLI and anything later obey it alike, and two
-- managers removing each other at once cannot both succeed.
CREATE TRIGGER users_keep_a_manager
BEFORE UPDATE OF can_manage_users, is_active ON users
WHEN OLD.can_manage_users = 1 AND OLD.is_active = 1
  AND (NEW.can_manage_users = 0 OR NEW.is_active = 0)
  AND NOT EXISTS (SELECT 1 FROM users WHERE id <> OLD.id AND can_manage_users = 1 AND is_active = 1)
BEGIN
  SELECT RAISE(ABORT, 'last active user manager');
END;
