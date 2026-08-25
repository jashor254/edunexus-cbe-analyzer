-- career_review_queue: allow the 'published' status the application already writes
--
-- Root cause (traced, not assumed): career_review_queue_status_check predates
-- 20260813140000_career_knowledge_lifecycle.sql, which built the actual
-- pending -> published|rejected review workflow (publishReviewedCareer()/
-- rejectReviewedCareer() in lib/career/knowledgeRequests.ts,
-- markCareerReviewDecided() in lib/repositories/career.repository.ts) without
-- ever updating this constraint. Every publish attempt has therefore been
-- failing at the database layer with a CHECK-constraint violation. Confirmed
-- by direct read-only inspection: career_review_queue has zero rows in both
-- the local Docker database and the connected Supabase project, so this has
-- never yet corrupted a real review — but it does leave a genuine partial-
-- state risk once a career IS published: `careers` (a separate statement,
-- its own implicit transaction) commits successfully, then the queue-status
-- update fails and rolls back, leaving the queue row permanently stuck at
-- 'pending' even though the career is already live. See
-- docs/architecture/phase9-1-5-review-publish-correctness.md for the full
-- reproduction.
--
-- 'in_review' and 'approved' are kept, not removed: a repo-wide search found
-- zero application code anywhere reads or writes either value. They are
-- inert pre-history vocabulary, not a state anything depends on removing —
-- dropping them would be unrelated cleanup outside this fix's scope.

alter table public.career_review_queue
  drop constraint career_review_queue_status_check;

alter table public.career_review_queue
  add constraint career_review_queue_status_check
  check (status = any (array['pending'::text, 'in_review'::text, 'approved'::text, 'published'::text, 'rejected'::text]));
