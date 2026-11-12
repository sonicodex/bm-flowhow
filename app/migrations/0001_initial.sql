-- FlowHow stage 1 schema (SPEC §4, §5, §7, §8, §9).
-- Timestamps are UTC ISO-8601 text; booleans are 0/1 integers.
-- Case-insensitive uniqueness uses a name_key column computed by the app
-- (src/names.ts): SQLite's NOCASE folds ASCII letters only.
-- Flow documents (steps, exits, tags) are JSON text, one per draft,
-- save point and release.

CREATE TABLE areas (
  id         INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL CHECK (trim(name) <> ''),
  name_key   TEXT    NOT NULL UNIQUE CHECK (name_key <> ''),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A user belongs to exactly one area (§4).
CREATE TABLE users (
  id                   INTEGER PRIMARY KEY,
  -- Stored as its name key, so login is case-insensitive.
  username             TEXT    NOT NULL UNIQUE CHECK (username <> ''),
  full_name            TEXT    NOT NULL CHECK (trim(full_name) <> ''),
  password_hash        TEXT    NOT NULL,
  role                 TEXT    NOT NULL DEFAULT 'standard'
                               CHECK (role IN ('standard', 'leader', 'board')),
  area_id              INTEGER NOT NULL REFERENCES areas (id) ON DELETE RESTRICT,
  -- Separate from the role on purpose (§4).
  can_edit             INTEGER NOT NULL DEFAULT 0 CHECK (can_edit IN (0, 1)),
  can_view_admin_layer INTEGER NOT NULL DEFAULT 0 CHECK (can_view_admin_layer IN (0, 1)),
  is_active            INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX users_area ON users (area_id);

-- Login sessions (§9). The id is a hash of the cookie token, never the token.
CREATE TABLE sessions (
  id         TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT    NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

-- colour is a palette slot, 1–12, mapped to the --flow-N token (§9).
-- Not unique: the 13th flow reuses a colour.
CREATE TABLE flows (
  id         INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL CHECK (trim(name) <> ''),
  name_key   TEXT    NOT NULL UNIQUE CHECK (name_key <> ''),
  objective  TEXT    NOT NULL DEFAULT '',
  colour     INTEGER NOT NULL CHECK (colour BETWEEN 1 AND 12),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE flow_areas (
  flow_id INTEGER NOT NULL REFERENCES flows (id) ON DELETE CASCADE,
  area_id INTEGER NOT NULL REFERENCES areas (id) ON DELETE RESTRICT,
  PRIMARY KEY (flow_id, area_id)
);
CREATE INDEX flow_areas_area ON flow_areas (area_id);

CREATE TABLE tag_categories (
  id       INTEGER PRIMARY KEY,
  name     TEXT    NOT NULL CHECK (trim(name) <> ''),
  name_key TEXT    NOT NULL UNIQUE CHECK (name_key <> ''),
  position INTEGER NOT NULL DEFAULT 0
);

-- Documents store tags by id, so a rename does not break past releases.
CREATE TABLE tags (
  id          INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES tag_categories (id) ON DELETE RESTRICT,
  name        TEXT    NOT NULL CHECK (trim(name) <> ''),
  name_key    TEXT    NOT NULL CHECK (name_key <> ''),
  UNIQUE (category_id, name_key)
);

-- At most one draft per flow; publishing deletes it (§8).
CREATE TABLE drafts (
  flow_id    INTEGER PRIMARY KEY REFERENCES flows (id) ON DELETE CASCADE,
  document   TEXT    NOT NULL CHECK (json_valid(document)),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by INTEGER REFERENCES users (id) ON DELETE SET NULL
);

-- Append-only snapshots of the draft; publishing deletes them (§8).
CREATE TABLE save_points (
  id         INTEGER PRIMARY KEY,
  flow_id    INTEGER NOT NULL REFERENCES flows (id) ON DELETE CASCADE,
  document   TEXT    NOT NULL CHECK (json_valid(document)),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by INTEGER REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX save_points_flow ON save_points (flow_id);

-- Immutable, kept forever (§8). Version is major.minor, first is 1.0.
CREATE TABLE releases (
  id           INTEGER PRIMARY KEY,
  flow_id      INTEGER NOT NULL REFERENCES flows (id) ON DELETE RESTRICT,
  major        INTEGER NOT NULL CHECK (major >= 1),
  minor        INTEGER NOT NULL CHECK (minor >= 0),
  document     TEXT    NOT NULL CHECK (json_valid(document)),
  published_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  UNIQUE (flow_id, major, minor)
);

-- One row per step shown in a tour (§7). step_path is the step id, prefixed
-- by the path for nested steps ("P6>S3"); exit_index is the exit taken from
-- it, NULL when none was taken. The key is "<step_path>#<exit_index>".
CREATE TABLE tour_visits (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  release_id INTEGER NOT NULL REFERENCES releases (id) ON DELETE RESTRICT,
  step_path  TEXT    NOT NULL CHECK (step_path <> ''),
  exit_index INTEGER CHECK (exit_index >= 0),
  visited_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX tour_visits_user_release ON tour_visits (user_id, release_id);

-- "Reviewed" per user and version, with the tour duration (§7).
CREATE TABLE review_records (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  release_id       INTEGER NOT NULL REFERENCES releases (id) ON DELETE RESTRICT,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  completed_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, release_id)
);
