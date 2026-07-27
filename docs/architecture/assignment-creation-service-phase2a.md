# Assignment Creation Service — Phase 2A (Blueprint Living Action Plan)

**Date:** 2026-07-25
**Scope:** Extraction and parity only. Extracted the assignment-creation behavior that lived inline in `app/api/teacher/assignments/route.ts` into one canonical server-side service, `lib/assignments/create.ts`, with `lib/repositories/assignment.repository.ts` beneath it. No Blueprint linkage, no Compass change, no new assignment UI, no schema change.

---

## 1. Executive verdict

**DONE — extraction complete, behavior unchanged, GO for Phase 2B.**

`app/api/teacher/assignments/route.ts` `POST` is now a thin handler: parse the request body with the existing Zod schema, call `createAssignment()`, map the result/errors onto an HTTP response. All authorization, the adaptive/quiz status derivation, the assignments insert, the pending-submission roster fan-out, and the `teacher.assignment.created` event now live in `lib/assignments/create.ts`. The route is the service's only production caller. Every pre-existing assignment-creation test (38 in `lib/testing/lmsRoutes.http.integration.test.ts`) still passes unmodified, plus 9 new tests targeting the authorization matrix and side-effect boundaries this phase needed to prove.

## 2. Previous inline architecture

Before this phase, `app/api/teacher/assignments/route.ts`'s `POST` handler did all of the following inline, in one function body: session resolution, teacher-record resolution, request-body Zod parsing, class-ownership authorization, adaptive/quiz status derivation, the `assignments` insert, a `class_students` read, an `assignment_submissions` bulk insert (fan-out), and a fire-and-forget `publishEvent()` call. This was the exact debt the Blueprint Living Action Plan audit (`docs/architecture/blueprint-living-action-plan-audit.md` §2, "Assignment/quiz creation" row) flagged: *"One inline route handler (not a `lib/` function — pre-existing debt)"*, cited as the reason a future Blueprint action-delivery adapter could not safely call assignment creation without either duplicating this logic or reaching around its authorization.

## 3. Ownership audit

**Search performed:** every `.from('assignments')` insert, every `.from('assignment_submissions')` insert, every `.from('assignment_question_variants')`/quiz-question insert, across `lib/` and `app/`.

**Findings:**
- **Canonical (and only) writer of `assignments` rows:** `app/api/teacher/assignments/route.ts` `POST`, now `lib/assignments/create.ts` → `lib/repositories/assignment.repository.ts#createAssignmentRecord`. No other file inserts into `assignments`; every other reference found is a `select`.
- **Canonical (and only) writer of `assignment_submissions` rows *at creation time*:** the same route/service, now `lib/repositories/assignment.repository.ts#createAssignmentSubmissions`. Two other writers of this table exist but are a different lifecycle stage, not a duplicate of creation-time fan-out: `app/api/student/submit-file/route.ts` / `app/api/student/submit/route.ts` / `app/api/student/submit-quiz/route.ts` (student submission, an update of an existing pending row, not an insert of a new one) and `app/api/teacher/classes/[classId]/students/route.ts` (enrolling a *new* student into a class backfills pending submission rows for that student's already-existing assignments — a legitimate, distinct roster-change writer, correctly out of this phase's scope per the task brief: *"roster changes after assignment creation do not silently alter historical behavior unless the current system already does so"*, which this pre-existing writer is the proof of).
- **Quiz question insert:** lives entirely in `app/api/teacher/assignments/[id]/questions/route.ts` and the variant-generation pipeline (`lib/assignments/variants.ts`, `variantGeneration.ts`) — confirmed **not part of the creation flow**. An assignment is created first (with `is_quiz: true`, no questions yet); questions are authored in a separate subsequent `PUT`. Phase 2A's "quiz behavior" section of the task brief therefore reduces to preserving the `is_quiz`/`is_adaptive` derivation on the assignment row itself — there is no quiz-question insert inside creation to extract.
- **Transaction boundaries:** none. Both writes (`assignments` insert, then `assignment_submissions` bulk insert) are separate Supabase calls with no wrapping transaction — pre-existing, see §6.
- **Side effects:** one — `publishEvent('teacher.assignment.created', ...)`, fire-and-forget, already idempotency-keyed on `assignment.id`.
- **Authorization:** `requireAuthentication` (session) → `resolveTeacher` (teacher record exists) → `requireClassTeacher` (owns `class_id`), all from the pre-existing canonical `lib/core/permissions.ts` / `lib/core/identity.ts` — reused verbatim, not reimplemented.
- **Idempotency:** creation itself has none (each `POST` creates a new assignment; there is no dedup key on the assignment row). The one idempotency behavior in this flow is the event's `idempotency_key`, unaffected.
- **Fields controlled by clients:** everything in the Zod-validated body (`class_id`, `title`, `subject`, `topic`, `substrand_id`, `instructions`, `due_date`, `type`, `max_score`, `is_quiz`, `is_adaptive`, `is_compass_guided`, `is_holiday_assignment`, `holiday_period`, `lesson_plan_id`).
- **Fields derived by the server:** `teacher_id` (from the resolved session, never trusted from the body), `is_quiz`/`status` (derived from `is_adaptive`), `is_compass_guided` (forced `false` for quizzes), `holiday_period` (nulled unless `is_holiday_assignment`), `id`/`created_at`/`updated_at` (database defaults).

No second live writer of `assignments` existed, so no consolidation decision was needed — this was a single-writer extraction.

## 4. Canonical service boundary

```
lib/assignments/create.ts
  createAssignment(supabase: SupabaseClient, command: CreateAssignmentCommand): Promise<CreateAssignmentResult>

lib/repositories/assignment.repository.ts
  AssignmentRepository
    createAssignmentRecord(input: InsertAssignmentInput): Promise<AssignmentRow>
    listClassStudentIds(classId: string): Promise<string[]>
    createAssignmentSubmissions(rows: InsertAssignmentSubmissionInput[]): Promise<void>
```

`CreateAssignmentCommand` is a typed command object built by the route from its already-Zod-validated body — the service never receives a raw `Request` or unvalidated JSON. The route contains request parsing and HTTP response mapping only; no `NextResponse`, header, or status-code concern exists in the service or repository.

`app/api/teacher/assignments/route.ts` `POST` is the service's only caller. `grep -rn "createAssignment(" app lib` (excluding the service's own definition and tests) confirms this.

## 5. Authorization behavior

Unchanged in effect, tightened in one respect (see below). `createAssignment` internally:

1. `requireAuthentication(supabase)` — throws `UnauthorizedError` (401) if there is no session.
2. `resolveTeacher(user.id)` — throws `ResourceOwnershipError` (403) if the authenticated account has no `teachers` row. Covers both "parent" and "student/learner" callers identically, since neither has a teacher record.
3. `requireClassTeacher(supabase, command.classId)` — the pre-existing canonical class-ownership gate (`lib/core/permissions.ts`) — throws `ResourceOwnershipError` (403) if the resolved teacher does not own `classId`, including when `classId` does not exist at all (indistinguishable from "not your class" by the existing helper's own design).

The route never accepts or trusts a caller-provided teacher id; the actor is always resolved from the session inside the service.

**Documented intentional micro-fix (non-parity, in scope of "correct a confirmed defect"):** the original route wrapped its `requireClassTeacher` call in a bare `try { } catch { return apiForbidden() }`, which would have forced *any* error from that call — including a hypothetical `UnauthorizedError` — into a 403. The extracted route now maps errors by type (`UnauthorizedError` → 401, any `ForbiddenError` subclass → 403), so a genuine authentication failure at that point now correctly returns 401 instead of 403. In practice this path is unreachable in the current flow (authentication is already confirmed one step earlier), so no observable behavior change was found in testing — flagged here for completeness per the task brief's "document any intentional response change" requirement.

## 6. Transaction / atomicity behavior

No transaction wraps the `assignments` insert and the `assignment_submissions` fan-out — this is a **pre-existing defect**, not introduced by this phase. In the original route, a fan-out failure was silently discarded (`await db.from('assignment_submissions').insert(submissions)` with no error check at all); the created assignment was still returned as a 201 success with zero submission rows.

**Smallest safe correction made:** the fan-out failure is now caught and logged (`console.error('[assignments/create] submission fan-out failed:', ...)`, `lib/assignments/create.ts`) rather than discarded outright, satisfying CLAUDE.md's "never swallow errors silently" without changing the response the caller receives — the assignment is still returned as created, matching the original success-path behavior exactly. A broader fix (wrapping both writes in a real transaction, e.g. a Postgres function) was in scope to consider but is explicitly **not** implemented here: the task brief asks for the smallest safe correction "without redesigning the domain," and no existing database function/transaction pattern for this pair of writes was found to reuse. Recommended as real follow-up work, not attempted.

## 7. Quiz behavior

No quiz-question insert occurs during assignment creation (see §3) — questions are authored via a separate, unaffected route (`PUT /api/teacher/assignments/[id]/questions`). Creation-time quiz behavior is limited to the `is_quiz`/`is_adaptive`/`status`/`is_compass_guided` derivation, preserved byte-for-byte:

```
adaptive = is_adaptive === true
quiz     = adaptive ? true : is_quiz === true
status   = adaptive ? 'draft' : 'active'
is_compass_guided = quiz ? false : is_compass_guided !== false
```

Confirmed via the pre-existing `is_quiz=true`, `is_adaptive=true`, and "omitting is_adaptive" tests in `lmsRoutes.http.integration.test.ts`, all still passing.

## 8. Submission fan-out behavior

Preserved exactly: every current `class_students` row for `command.classId` gets one `assignment_submissions` row with `status: 'pending'`. An empty class produces zero submission rows and does not error (`listClassStudentIds` returning `[]` short-circuits before the insert, same as the original `if (classStudents && classStudents.length > 0)` guard). Confirmed with a new test asserting a roster-outsider student (never added to `class_students`) receives no submission row, alongside the enrolled student receiving exactly one `pending` row.

## 9. Before/after parity results

All 38 pre-existing tests in `lib/testing/lmsRoutes.http.integration.test.ts` — covering standard-assignment creation, quiz creation, adaptive draft/publish, substrand persistence/omission, non-owning-teacher denial, and the quiz-question/submit-quiz paths built on top of assignment creation — pass unmodified against the extracted service. 9 new tests in `lib/assignments/create.http.integration.test.ts` cover the authorization matrix (unauthenticated, parent-shaped session, learner session, unrelated teacher, non-existent class) and validation (missing title, empty due date) not previously exercised at the route level, plus explicit side-effect-boundary assertions (no Blueprint/Compass/`learner_evidence` writes from creation). No behavioral difference found beyond the documented micro-fix in §5.

## 10. Remaining assignment-domain debt

- No transaction wraps the assignment insert and submission fan-out (§6) — pre-existing, now logged instead of silently discarded, not otherwise fixed.
- No dedup/idempotency key on assignment creation itself (only the downstream event is idempotency-keyed).
- `GET /api/teacher/assignments` (list) remains inline in the route — out of scope for Phase 2A, which was creation-only per the task brief.
- The two other `assignment_submissions` writers (student submission update, class-enrollment backfill) remain separately owned, correctly, per §3 — not consolidated, not touched.

## 11. Blueprint / Compass — explicitly not started

No `blueprint_action_item_id` column, no Blueprint read or write, no Compass session creation, and no delivery fan-out were added anywhere in this phase. Verified both by code review of every file touched and by a new automated test (`lib/assignments/create.http.integration.test.ts`, "creation has no Blueprint, Compass, or learner_evidence side effects") that queries `compass_sessions` and `learner_evidence` for the creating teacher's student after each creation and asserts zero new rows. (`blueprint_action_items` itself is a table introduced by unrelated, uncommitted Phase 1 work in this working tree and was left out of that specific query to avoid coupling this phase's test to another phase's in-flight migration — the code-review pass is the applicable check for that table.)

## 12. Recommendation for Phase 2B

GO. The canonical service (`createAssignment`) and its authorization gate are now a stable, single, well-tested boundary a Blueprint delivery adapter can call as a second production caller without duplicating logic or authorization.

**Update, 2026-07-25 — Phase 2B shipped.** `CreateAssignmentCommand` gained an optional, server-derived-only `blueprintActionItemId` field; `blueprint_action_item_id` landed as a nullable column directly on `assignments` (not a join table — a database-enforced-unique single FK was sufficient for the "at most one assignment per action item" rule). The acting "teacher" question was resolved by never allowing a system-initiated trigger in this phase at all: delivery is always a real authenticated teacher's explicit action (`confirmClassWideDelivery: true`), never automatic on approval. Full record: `docs/architecture/blueprint-assignment-delivery-phase2b.md`.
