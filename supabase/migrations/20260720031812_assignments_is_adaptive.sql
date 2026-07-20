-- Sprint 10 Slice A — Part 1 (Adaptive Assignment Creation) + Part 3 (Status Flow).
--
-- One additive column: assignments.is_adaptive. Distinguishes "this quiz
-- should go through the Draft -> Generate Variants -> Teacher Review ->
-- Publish workflow" from a plain quiz (is_quiz=true, is_adaptive=false),
-- which keeps today's existing behavior byte-for-byte (created 'active'
-- immediately, no review gate). Adaptive assignments are always quizzes
-- (is_quiz=true) — enforced in application code at creation, not a CHECK
-- constraint here, matching this codebase's existing convention of
-- enforcing cross-column business rules in the route/lib layer rather than
-- the schema (see e.g. is_compass_guided's own "quizzes are never
-- compass-guided" rule, enforced the same way).
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS is_adaptive boolean NOT NULL DEFAULT false;
