# Mark Papers — mark first, file after (plan)

Status: approved by founder 2026-10-19 ("do everything step by step"). Built in small commits; each one logged in `implementation-log.md`.

## The teacher flow

1. **What are you marking?** Pick an in-progress paper, an existing topical assignment, or **quick-create** a paper (title, class, subject, out of). Adaptive assignments are hidden — not finalised yet, integrate later (Paper Intelligence marks against one rubric; a variant paper would be marked wrong).
2. **Scheme** → editable rubric (unchanged).
3. **Capture scripts** — teacher's choice: 📱 phone, one learner at a time (unchanged), or 🖨️ **bulk scan**: upload the class PDF, the browser splits it per learner, teacher confirms, every script auto-marks.
4. **Review** question by question (unchanged screen). **Nothing reaches the gradebook or report card yet.**
5. **Upload marks** once satisfied → **topical** (assignment score / gradebook) or **termly** (Opener, CAT, Mid-Term, End-Term, Exam, KJSEA SBA → `learner_marks` → report cards). One destination per paper, so marks are never filed twice.

## Step 1 — Database (one migration)

- `paper_mark_uploads` — `id`, `assignment_id` (UNIQUE, FK), `destination` (`topical`|`termly`), `class_assessment_id` + `subject` (required iff termly), `uploaded_by` (teachers), `uploaded_at`, `learner_count`, `created_at`, `updated_at`. FK indexes, RLS (teacher reads own; writes via service client in `lib/`).
- `assignments.origin` — `standard` (default) | `paper_marking`. A quick-created paper is `origin = paper_marking, status = draft`: invisible to learners (student reads filter `status = 'active'`) and hidden from teacher lists until filed topical (then `status = closed`).
- `assignment_submission_pages.capture_source` — `phone` (default) | `scan`.
- Backfill: every assignment with an already-finalized Paper Intelligence script is recorded as uploaded `topical`, so pilot work is neither lost nor re-filed.
- KJSEA SBA needs no schema: `assessment_types` rows are created on first use (`resolveOrCreateAssessmentType`).

## Step 2 — Existing `lib/` reused

| Need | Reused |
|---|---|
| Quick create + roster fan-out | `lib/assignments/create.ts` `createAssignment` (+ `origin`) |
| Topical filing | `lib/assignments/markSubmission.ts` `recordSubmissionMark` (same bounds, notification, evidence, correction key) |
| Termly filing side-effects | `triggerLearnerModelUpdates`, `recordAssessmentEvidence` (same as the CSV upload route) |
| Assessment pick / create | `getClassAssessments`, `createAssessment`, `resolveOrCreateAssessmentType` |
| Script totals | `scriptCompletion` (`reviewGrouping.ts`), `findScriptMarksForAssignment` |
| Capture, marking, review | `scriptPages.ts`, `mark-script` route, review screen — unchanged |

## Step 3 — New `lib/` functions

- `lib/paperIntelligence/review.ts` — `confirmQuestionMarks` stops writing to the gradebook; it reports which scripts are complete.
- `lib/paperIntelligence/upload.ts` — `getUploadReadiness(assignmentId)` (complete / incomplete / over "out of" scripts, existing upload) and `uploadPaperMarks(...)`: topical → `recordSubmissionMark` per complete script, closes a quick paper; termly → `mergeSubjectMarks`, never `recordSubmissionMark` (no double evidence). Re-upload keeps the first destination.
- `lib/assessments/mutations.ts` — `mergeSubjectMarks(assessment, subject, entries)`: sets ONE subject's score per learner, keeping every other subject; matches existing rows by `student_id` first (never nulls a link); recomputes totals, means, positions. Refuses a published (locked) assessment. Paper "out of" ≠ assessment max → proportional conversion, shown to the teacher before filing.
- `assessmentTypeCatalog.ts` — add `sba` (KJSEA SBA, purpose `summative`).
- Readers exclude unfiled quick papers: gradebook, calendar, teacher assignment list, dashboard counts.

## Step 4 — API routes (thin, Zod, `auth.getUser()` first)

- `POST /api/teacher/paper-intelligence/papers` — quick create.
- `GET  /api/teacher/assignments/[id]/paper-intelligence/upload` — readiness + the class's termly assessments.
- `POST /api/teacher/assignments/[id]/paper-intelligence/upload` — file the marks.
- `pages` route accepts `captureSource`.

## Step 5 — Screens

- `/teacher/mark-papers` — chooser: in-progress papers, topical assignments (non-adaptive), quick create.
- Review page — "Upload marks" panel: destination, assessment (or create one), subject, conversion preview, confirm.
- Capture — "Scan a PDF" option: pdf.js in the browser renders pages, split by pages-per-learner in class-list order, thumbnail confirm, upload through the existing pages route (`captureSource: scan`), then auto-mark every script.

## Scanner roadmap (beyond this build)

- S1 (this build): PDF upload, page-count split, teacher confirm. Keep blank pages (page-count splitting depends on them). Scan at 300 dpi greyscale.
- S2: photocopy-safe QR (paper + page) and per-learner QR sticker labels — order-independent auto-sorting.
- S3: scan-to-email inbound, background queue, exams-officer upload role (access-control design needed).
- Privacy: bulk scanning raises volume of learner handwriting sent to the vision model — B6 (privacy policy) and the per-school Paper Intelligence gate must land before onboarding a scanner school.
