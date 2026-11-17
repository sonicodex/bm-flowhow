-- Phase 5.2: two editors on one draft. Each write of the draft raises its
-- revision; a save names the revision it started from and is refused if the
-- draft moved on meanwhile, instead of overwriting the other person's work
-- (phase 5 plan, answer 5). The revision is lost with the draft on
-- publishing, which is fine: a save that started from a draft that no longer
-- exists is refused too.
ALTER TABLE drafts ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1);
