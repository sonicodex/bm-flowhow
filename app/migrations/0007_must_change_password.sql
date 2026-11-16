-- Phase 4.4: a password reset gives a one-time temporary password, and the
-- user must choose their own before doing anything else (phase 4 plan,
-- answer 2). The Board never knows its people's passwords.
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1));
