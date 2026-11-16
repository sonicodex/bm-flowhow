-- Phase 3.6. "Anterior" can undo a choice: picking a different branch on a
-- decision left behind. Such a row records the trail position it went back
-- to; replaying the log goes back there before choosing. NULL on every other
-- row.
ALTER TABLE tour_visits ADD COLUMN rewind_to INTEGER CHECK (rewind_to IS NULL OR rewind_to >= 0);
