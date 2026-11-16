-- Phase 3.5. A tour run can end two ways: finished ("Terminar recorrido",
-- finished_at) or abandoned (abandoned_at): "Empezar de nuevo", or a run the
-- tour engine can no longer replay after its rules changed. The progress
-- report (phase 6) tells them apart. A run is open while both are NULL.
ALTER TABLE tour_runs ADD COLUMN abandoned_at TEXT CHECK (abandoned_at IS NULL OR finished_at IS NULL);

DROP INDEX tour_runs_open;
CREATE UNIQUE INDEX tour_runs_open ON tour_runs (user_id, release_id)
  WHERE finished_at IS NULL AND abandoned_at IS NULL;
