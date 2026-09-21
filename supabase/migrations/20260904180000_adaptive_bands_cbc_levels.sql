-- Redesigns the adaptive-learning tier taxonomy to key directly on Kenya's
-- real CBC 4-level competency rubric (BE/AE/ME/EE — Below/Approaching/
-- Meeting/Exceeding Expectations), the same codes already used platform-wide
-- for report cards and KNEC export (lib/curriculum/regional/ke-cbc.ts).
--
-- Previously: AdaptiveGroupType was critical_gap/prerequisite_gap/
-- concept_confusion/on_track, itself collapsed further to only 3
-- assignment_question_variants tiers (foundation/supported_practice/
-- extension) via BAND_TO_TIER — a Level 1 and a Level 2 learner could both
-- receive the exact same "foundation" variant. Now every CBC level gets its
-- own tier: BE->foundation, AE->guided_practice (new), ME->supported_practice,
-- EE->extension.
--
-- assignment_question_variants already has 29 real rows, all using
-- 'foundation'/'supported_practice'/'extension' — all remain valid; this
-- migration only WIDENS the CHECK constraint to also allow 'guided_practice'.
--
-- assignment_print_routes has zero rows (confirmed before writing this
-- migration) — safe to replace its evidence_band CHECK values outright
-- rather than widen them, since the old critical_gap/prerequisite_gap/
-- concept_confusion/on_track values were never actually written.

ALTER TABLE assignment_question_variants
  DROP CONSTRAINT assignment_question_variants_variant_type_check;
ALTER TABLE assignment_question_variants
  ADD CONSTRAINT assignment_question_variants_variant_type_check
  CHECK (variant_type IN ('foundation', 'guided_practice', 'supported_practice', 'extension'));

ALTER TABLE assignment_print_routes
  DROP CONSTRAINT assignment_print_routes_evidence_band_check;
ALTER TABLE assignment_print_routes
  ADD CONSTRAINT assignment_print_routes_evidence_band_check
  CHECK (evidence_band IN ('BE', 'AE', 'ME', 'EE', 'insufficient_data'));
