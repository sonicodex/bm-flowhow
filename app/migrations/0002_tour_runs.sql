-- Tour attempts (SPEC §7). "Iniciar recorrido" opens a run, "Continuar"
-- resumes the open one and "Repetir" opens a new one; the duration of a
-- review is measured on its run. finished_at is NULL while the run is open.
CREATE TABLE tour_runs (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  release_id  INTEGER NOT NULL REFERENCES releases (id) ON DELETE RESTRICT,
  started_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at TEXT
);
CREATE INDEX tour_runs_user_release ON tour_runs (user_id, release_id);
-- At most one open run per user and version.
CREATE UNIQUE INDEX tour_runs_open ON tour_runs (user_id, release_id) WHERE finished_at IS NULL;

-- Visits now belong to a run, which carries the user and the version.
-- tour_visits has never held a row (nothing wrote to it before phase 3),
-- so it is rebuilt instead of altered: SQLite cannot add a NOT NULL
-- foreign key column to an existing table.
DROP TABLE tour_visits;

-- One row per tour action, at the step the tour stood on (§7; see
-- public/js/tour-log.js). step_path is the step id, prefixed by the path for
-- nested steps ("P6>S3"); exit_index is the exit followed from it, NULL when
-- the tour did not leave through an exit (a dead end, "Ir a lo que falta por
-- visitar"). The key is "<step_path>#<exit_index>". visited_at is the
-- server's time, never the browser's.
CREATE TABLE tour_visits (
  id         INTEGER PRIMARY KEY,
  run_id     INTEGER NOT NULL REFERENCES tour_runs (id) ON DELETE CASCADE,
  step_path  TEXT    NOT NULL CHECK (step_path <> ''),
  exit_index INTEGER CHECK (exit_index >= 0),
  visited_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX tour_visits_run ON tour_visits (run_id);
