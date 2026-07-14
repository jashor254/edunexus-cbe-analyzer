-- Sprint 2 (Pilot Hardening): AI Fallback Integrity
-- Phase C audit findings — Insha evaluator and Academy AI Judge fallback
-- scores were indistinguishable from genuine AI evaluations. This adds the
-- persistence side of the isFallback flag for the two Academy tables where
-- AI-judged scores are stored (Insha feedback is stateless — no table).
--
-- Additive-only, backward-compatible: NOT NULL with a default so existing
-- rows (all genuinely AI-scored, since this column didn't exist before) are
-- correctly backfilled as false.

alter table public.academy_reflections
  add column if not exists is_fallback boolean not null default false;

alter table public.academy_mission_completions
  add column if not exists is_fallback boolean not null default false;
