-- ADR-0024 Sprint A, Objective 3 — complete the assignments KICD picker.
--
-- The picker already resolves a real sow_substrands.id when a teacher
-- selects a sub-strand (app/teacher/assignments/new/page.tsx's local
-- `substrandId` state, sourced from real curriculum data via
-- /api/teacher/assignments/substrands -> getTopicsForSubject() ->
-- sow_strands/sow_substrands) — but that id was never submitted to the
-- server, only the sub-strand's title text (assignments.topic). This adds
-- the column so the already-resolved id can actually be persisted.
-- Nullable and additive: assignments created before this migration, and
-- assignments created in "custom" mode (free-text, no curriculum picker
-- involved) or where no substrand data exists for a grade/subject, are
-- unaffected and remain fully readable — no backfill, no rewriting of
-- existing rows, per Objective 4 ("preserve existing behaviour").

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS substrand_id uuid REFERENCES sow_substrands(id);

CREATE INDEX IF NOT EXISTS idx_assignments_substrand_id ON assignments (substrand_id) WHERE substrand_id IS NOT NULL;
