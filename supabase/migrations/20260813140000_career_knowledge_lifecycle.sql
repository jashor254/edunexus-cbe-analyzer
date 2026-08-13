-- Career Knowledge Lifecycle
--
-- Problem this fixes: career knowledge was a frozen snapshot. Every one of the
-- 43 rows in `careers` carried source='seed' and had not been touched since
-- 2026-06-16, yet salary bands and market outlook were rendered to families as
-- present tense. Nothing recorded WHEN a career's facts were last confirmed,
-- and `updated_at` cannot answer that question because any write moves it.
--
-- Two additions:
--
-- 1. `careers.knowledge_verified_at` — the last time this career's FACTS were
--    confirmed, as distinct from the last time the ROW was written. This is the
--    only column freshness may be computed from (lib/career/knowledgeLifecycle.ts).
--
-- 2. `career_review_queue` gains a payload. The table already existed with
--    zero rows and zero code touching it — it could only hold a career NAME,
--    so a reviewer had nothing to review. It now carries the full generated
--    profile, so an AI-generated career can be inspected and published by a
--    human instead of being written straight into the corpus learners read.

-- ── careers: knowledge provenance ────────────────────────────────────────────

alter table public.careers
  add column if not exists knowledge_verified_at timestamptz,
  add column if not exists knowledge_source_note text;

comment on column public.careers.knowledge_verified_at is
  'When this career''s facts (salary bands, market outlook, demand) were last confirmed. NOT the same as updated_at, which any write moves. Null means never verified — treated as unknown freshness, never as fresh.';

comment on column public.careers.knowledge_source_note is
  'Free-text provenance for the last verification: who or what confirmed these facts.';

-- Backfill: the seed corpus was written by hand and last touched on updated_at.
-- That is a truthful verification date for these rows and the only one available.
update public.careers
   set knowledge_verified_at = updated_at
 where knowledge_verified_at is null;

create index if not exists careers_knowledge_verified_at_idx
  on public.careers (knowledge_verified_at);

-- ── career_review_queue: make a review actionable ────────────────────────────

alter table public.career_review_queue
  add column if not exists slug          text,
  add column if not exists payload       jsonb,
  add column if not exists origin        text not null default 'learner_search',
  add column if not exists request_count integer not null default 1,
  add column if not exists reviewed_at   timestamptz,
  add column if not exists reviewed_by   uuid references auth.users(id) on delete set null;

comment on column public.career_review_queue.payload is
  'The full generated career profile awaiting human review. Never served to a learner as canonical knowledge and never matched against — it becomes a career only when a reviewer publishes it into `careers`.';

comment on column public.career_review_queue.origin is
  'How this entry arrived: learner_search | staff_request | refresh_sweep.';

comment on column public.career_review_queue.request_count is
  'How many times this career has been asked for. The demand signal that tells a reviewer what to research first.';

-- One queue entry per career, so repeat searches increment demand rather than
-- stacking duplicate rows for a reviewer to wade through.
create unique index if not exists career_review_queue_slug_key
  on public.career_review_queue (slug)
  where slug is not null;

create index if not exists career_review_queue_status_idx
  on public.career_review_queue (status);

-- FK index (every FK column must have one).
create index if not exists career_review_queue_submitted_by_idx
  on public.career_review_queue (submitted_by);

create index if not exists career_review_queue_reviewed_by_idx
  on public.career_review_queue (reviewed_by);
