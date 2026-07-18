-- LMS Basics Phase 0a — file attachments on assignment submissions.
--
-- Purely additive to the existing `assignment_submissions` table (no new
-- identity, no new canonical domain — CLAUDE.md/Guardian mode: extending an
-- existing domain, not introducing one). Mirrors the `clinic-reports`
-- bucket precedent (migration 20260710120000_sprint15_corrections.sql):
-- private bucket, no storage.objects SELECT policy for anon/authenticated,
-- all reads/writes go through the service-role client from named API
-- routes (app/api/student/submit-file, app/api/teacher/assignments/.../
-- submission-file-url), which apply their own ownership checks before
-- minting a signed URL. Students previously could only submit typed text
-- (`work_text`); CBC classroom work is frequently handwritten/photographed.

ALTER TABLE assignment_submissions
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_type text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-submissions', 'assignment-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- No storage.objects policy is added for anon/authenticated — access is
-- exclusively through the service-role client in the two API routes above,
-- matching the clinic-reports bucket's post-Sprint-15 posture exactly.
