-- Paper Intelligence Phase 1 — rich rubric fields on open_response_rubrics.
--
-- Prototype 01's rubric was simpler (question_text + expected_answer_summary
-- + marking_criteria + max_marks). Phase 0 validation proved the marking
-- actually turns on three more facts the table had no home for:
--   • mode — strict vs accept_relevant (Q3 swings 3 marks on this alone)
--   • points_required / marks_per_point — the "Any N×M=T" structure; a 2-mark
--     point needs name + explanation, a 1-mark point just the name
--   • a human sub-question label — "1a"/"1b" cannot both be question_number 1
--     (the table's UNIQUE is on an int ordinal), so the printed label is kept
--     alongside the ordinal, never instead of it.
--
-- All additive and back-compatible: existing Prototype 01 rows keep working
-- (mode defaults to accept_relevant; label/points are null until a rubric is
-- (re)extracted). No backfill — legacy rows had no such concept.

ALTER TABLE open_response_rubrics
  ADD COLUMN IF NOT EXISTS question_label  text,
  ADD COLUMN IF NOT EXISTS mode            text NOT NULL DEFAULT 'accept_relevant'
    CHECK (mode IN ('strict', 'accept_relevant')),
  ADD COLUMN IF NOT EXISTS points_required int CHECK (points_required IS NULL OR points_required > 0),
  ADD COLUMN IF NOT EXISTS marks_per_point int CHECK (marks_per_point IS NULL OR marks_per_point > 0);
