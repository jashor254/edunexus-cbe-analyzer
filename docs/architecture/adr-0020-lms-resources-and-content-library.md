# ADR-0020 — Class Resources & Content Library

**Status: Approved for implementation** (user-directed, 2026-07-18 — "LMS Basics" initiative, see `docs/pilot-readiness-wave-6-lms-foundations-full-audit.md` for the gap audit this responds to).

**Scope note**: this ADR governs core classroom LMS mechanics (file distribution, content organization), not a Learner Intelligence/Evidence domain — it does not use the heavier Learner-domain ADR template (ADR-0011–0018) because no evidence, capability, or projection concept is involved. It follows Guardian Mode's standard assessment format instead.

## Why a new domain

Audit confirmed (Wave 6 LMS audit, 2026-07-18): zero Supabase Storage usage anywhere in the app layer, no `course_materials`/`class_resources`/`content_library` table in any migration, no student-facing route for browsing teacher-shared materials. This is not an extension of an existing domain — no canonical table currently owns "a file a teacher shares with a class" or "a piece of structured content a teacher publishes for students to read."

## Domain definition

**Class Resources** owns file distribution: a teacher uploads a file (PDF/image/doc), scopes it to a class, and students/parents in that class can view and download it. **Content Library** owns structured non-file content: a teacher writes a titled note/topic (text + optional links), scoped to a class, browsable by students. Both are thin — no versioning, no permissions beyond class membership, no AI involvement, no evidence emission. This is intentionally the simplest correct slice, matching this project's own "start simple, grow later" standing philosophy — not a general-purpose CMS.

**Never owns**: grading (Gradebook/assignments own that), evidence (`learner_evidence` owns that), AI-generated content (`lib/ai/` + feature modules own that — a resource is always teacher-authored or teacher-uploaded, never AI-generated in this slice).

## Ownership / identity

Built on the **same identity space assignments already use** — `teacher_classes`/`class_students` (legacy FK space, confirmed live and canonical-in-practice for every teacher-facing feature audited: assessments, assignments, attendance) — not the newer `learners`/`school_users` schema, which today is scoped to the showcase domains (achievements/competitions/leadership/wellbeing/innovation/projects) only. Extending the identity a teacher's actual daily tools already use avoids introducing a second, disconnected roster for the same class.

## Tables

- `class_resources` — id, class_id (→ teacher_classes), teacher_id, title, file_path (Storage), file_name, file_type, created_at.
- `course_materials` — id, class_id (→ teacher_classes), teacher_id, title, body (text), link_url (nullable), created_at, updated_at.

Both RLS-enabled: teacher CRUD on rows they own (`teacher_id` = own), student/parent SELECT via `class_students` membership on `class_id` — current teaching/enrollment relationship, never creator-based, per CLAUDE.md's evidence-access rule applied here as the general access-control default.

## Storage

New private bucket `class-resources`, no anon/authenticated `storage.objects` policy — same posture as `clinic-reports` (post Sprint-15) and `assignment-submissions` (this initiative's Phase 0a): all reads go through a signed-URL API route with an explicit ownership check.

## Risks / backward compatibility

Purely additive — two new tables, one new bucket, no existing table altered. No ADR-trigger conflict with the Learner-domain series (different FK space, different bucket, no shared table).
