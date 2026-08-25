-- Parent Portal Phase P5.5 — Report Card Subject Snapshot Integrity
--
-- Root cause (docs/architecture/parent-portal-p5-academic-result-authority.md
-- §4/§14A, reproduced fresh in
-- docs/architecture/parent-portal-p5-5-report-card-snapshot-integrity.md):
-- `school_report_cards.overall_score`/`overall_cbc_level`/`position_in_class`
-- are computed once at generation and never recomputed on view — a real,
-- enforced immutable snapshot. But the per-subject breakdown a parent sees
-- alongside that frozen headline is a LIVE join onto `term_subject_summaries`
-- (`findReportCardWithSubjects`), and `term_subject_summaries` is a single
-- shared, in-place-upserted row per (learner_id, term_id, subject_id) with
-- no history and no FK back to `school_report_cards` — any later teacher
-- assessment publish for that same term silently overwrites it, with no
-- check against `school_report_cards.is_published`. There is nothing in the
-- existing schema a per-subject freeze could be reconstructed from after the
-- fact (no assessment-version id, no per-publish subject table, no snapshot
-- column anywhere) — a narrow migration is genuinely required, not avoided
-- out of caution.
--
-- Fix: one nullable JSONB column, populated once, at the moment of publish,
-- from term_subject_summaries's then-current state — the same
-- "computed-once-and-stored" precedent overall_score already uses, extended
-- to the subject breakdown. NULL for every already-published report card
-- (this migration cannot fabricate a past state that was never captured —
-- see the P5.5 doc's Historical Existing-Report Status section) and for any
-- still-draft report card (drafts intentionally stay live, unaffected).

alter table public.school_report_cards
  add column if not exists subject_snapshot jsonb;

comment on column public.school_report_cards.subject_snapshot is
  'Frozen per-subject breakdown captured at the moment this report card was published (subject_id/name/code, weighted_score, cbc_level, position_in_class, teacher_comment). NULL for draft cards (which read term_subject_summaries live, by design) and for cards published before this column existed (historical drift for those rows is a named, accepted limitation — cannot be reconstructed after the fact). Never written to after the publish that set it.';
