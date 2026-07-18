# ADR-0021 — Class Calendar & Announcements

**Status: Approved for implementation** (user-directed, 2026-07-18 — "LMS Basics" initiative continuation, Phase 2 of `docs/pilot-readiness-wave-6-lms-foundations-full-audit.md`'s gap list; see [[project-lms-basics-initiative]] memory).

**Scope note**: like ADR-0020, this governs core classroom LMS mechanics, not a Learner Intelligence/Evidence domain — uses Guardian Mode's standard assessment format, not the heavier Learner-domain ADR template.

## Why new domains

Audit confirmed (Wave 6, 2026-07-18): no calendar/timetable/term-dates table or route exists anywhere; no `announcements`/`messages` table exists — the only class→student communication is the automated WhatsApp/email notify pipeline (`lib/whatsapp/`, `lib/parentPulse/`), which is system-triggered off evidence events, never teacher-composed free text. Neither gap is an extension of an existing domain.

## Domain definitions

**Class Calendar** owns one thing: a shared, read-visible timeline of dated events for a class — teacher-created entries (a test date, a trip, a deadline) **plus** a read-time merge of due dates already tracked elsewhere (`assignments.due_date`, `class_assessments` if/when they gain a date). It does **not** duplicate due-date storage — assignment/assessment due dates are pulled at query time, not copied into a new table, so there is exactly one place a due date can be edited. The calendar table itself stores only teacher-authored events with no other owner (a CAT date, a school trip, a parents' meeting).

**Announcements** owns one thing: a teacher-composed, class-scoped broadcast message, read-only for students/parents. It is explicitly **not** the automated notification pipeline (`lib/whatsapp/`, `lib/parentPulse/`) — those remain system-triggered and unchanged. It is also explicitly **not** two-way messaging — no reply, no thread, no DM. A teacher broadcasting "no school tomorrow, PTA day" is a fundamentally different, lower-risk feature than 1:1 messaging in a K-12 platform (moderation/safeguarding concerns), and the smallest correct slice does not need replies to be useful.

**Never owns**: Calendar never owns grading, attendance, or evidence. Announcements never owns automated notifications (WhatsApp/email pipelines are untouched) and never owns replies/threads (explicitly deferred — no evidence of demand, and two-way messaging in a K-12 app deserves its own scoping pass on safeguarding grounds before being built, not a default "add a reply button" later).

## Ownership / identity

Same identity space as every other LMS Basics addition — `teacher_classes`/`class_students` (legacy FK space) — matching assignments, assessments, attendance, Class Resources, Content Library, Gradebook. Not the `learners`/`school_users` schema (showcase domains only).

## Tables

- `class_calendar_events` — id, class_id (→ teacher_classes), teacher_id, title, description (nullable), event_date, created_at, updated_at.
- `class_announcements` — id, class_id (→ teacher_classes), teacher_id, title, body, created_at, updated_at.

Both RLS-enabled: teacher CRUD on rows they own, student/parent SELECT via current `class_students` membership — same pattern as ADR-0020's two tables, same CLAUDE.md evidence-access rule applied generally (`teacher_id` means who authored it, never a read gate).

## Risks / backward compatibility

Purely additive — two new tables, no existing table altered, no Storage bucket needed (no file attachments in this slice). No conflict with ADR-0020 or the Learner-domain series.
