# Sprint 4F — Teacher → School Identity Resolution Audit (READ ONLY)

**Status:** Audit only. No code, schema, or data was modified. This sprint is an identity-resolution trace, not a grading audit and not an implementation sprint — it exists to answer, precisely, the question Sprint 4E left open: *can a legacy `teacherId` (a `teachers.id` row) ever be resolved to a `schools.id`, anywhere in the current codebase?*

**Trigger:** Sprint 4E (`docs/engineering/implementation-log.md`, 2026-07-15 entry; `docs/architecture/deprecation-registry.md` entry #5) found that `assessment.repository.ts::gradeLevelFromScore`'s two callers (`getAssessmentAnalytics`, `getCohortData`) are scoped entirely by `teacherId` over `teacher_classes`/`class_assessments`, and neither table has a `school_id` column. This blocked threading `school_settings.grade_boundaries` through the function. Sprint 4E stopped short of tracing whether a resolution path exists *anywhere else* in the codebase — that is this sprint's entire scope.

---

## Part 1 — Identity Flow: `teacherId` → School

### `teachers` table

No `CREATE TABLE teachers` statement exists anywhere in `supabase/migrations/*.sql` (43 migration files, earliest `20260520000000_whatsapp_layer.sql`) — the table predates the tracked migration history and was created directly against the live database (dashboard or an untracked script), same as `students`, `class_assessments` (base), and most of the original legacy schema. The only migration-tracked touches are additive: `supabase/migrations/20260525_performance_indexes.sql:245` (`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS updated_at ...`).

The authoritative live shape comes from the Supabase-generated `lib/database.types.ts` (`teachers` block):

| column | type | notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid, not null | **links to `auth.users.id`** — confirmed by `lib/core/identity.ts:113-122`'s `resolveTeacher(userId)`, which queries `teachers` by `.eq('user_id', userId)` |
| `full_name` | text | |
| `school` | text, not null | **free-text school name, not an identity.** No FK, no uniqueness constraint, no reference to a `schools` row. Confirmed no `school_id` column exists on `teachers` at all. |
| `role` | text | legacy free-text role (`'teacher'`/`'admin'`), distinct from Core's `SchoolUserRole` — `lib/core/identity.ts:51-52` |
| `subject`, `grade_levels`, `phone`, `tsc_number`, `pioneer_number`, `is_verified` | — | not identity-relevant |
| `created_at`, `updated_at` | timestamptz | |

`Relationships: []` in the generated types — Postgres has **zero foreign keys defined on `teachers`** in either direction.

### `teacher_classes` table

Tracked touches: `20260525_performance_indexes.sql`, `20260706_sync_pipeline.sql`, `20260713193000_phase_a_promotions_archival.sql` (none contain the original `CREATE TABLE` — same pre-history-gap as `teachers`). Live shape (`lib/database.types.ts`, `teacher_classes` block):

| column | notes |
|---|---|
| `id` | PK |
| `teacher_id` | FK → `teachers.id` (`teacher_classes_teacher_id_fkey`) |
| `integration_connection_id` | FK → `integration_connections.id` — traced below, dead end |
| `name`, `class_code`, `grade`, `grade_cohort`, `stream`, `subject`, `teaching_subject`, `curriculum_level`, `academic_year`, `external_id`, `selected_subjects` | not identity-relevant |
| `created_at`, `updated_at` | |

No `school_id` column. Only two FK-shaped columns exist (`teacher_id`, `integration_connection_id`); both traced in Part 3.

### `class_assessments` table

Tracked touches: `20260629_core_foundation.sql`, `20260706_sync_pipeline.sql`, `20260713200000_phase_b_assessment_types.sql` (again, additive only — no `CREATE TABLE`). Live shape (`lib/database.types.ts`, `class_assessments` block), with FK relationships as declared in Postgres:

| column | FK target | notes |
|---|---|---|
| `id` | — | PK |
| `class_id` | `teacher_classes.id` | legacy class, not Core's `classes` |
| `teacher_id` | `teachers.id` | |
| `grade_id` | `grades.id` | global curriculum reference table — traced below, dead end |
| `grade_scale_id` | `teacher_grade_scales.id` | traced below, dead end |
| `integration_connection_id` | `integration_connections.id` | traced below, dead end |
| `assessment_type`, `curriculum_type`, `grading_type`, `is_published`, `max_score`, `subjects`, `term`, `year`, `title`, `weight_percent`, `external_id` | — | not identity-relevant |

No `school_id` column. Confirms Sprint 4E's original finding directly against the live generated types, not just migration grep.

**Confirming Core did NOT extend this table with a school reference:** `class_assessments` is the "shared table, extended by Core" per prior audits — its Core-relevant additions (`grade_id`, `grade_scale_id`, `grading_type`, `is_published`, `weight_percent`, added `20260713200000_phase_b_assessment_types.sql`) are grading-policy fields, not identity fields. Core's own `createAssessment` path (`lib/core/assessments.ts`) writes to Core's separate `classes`/`assessments`-domain tables (see Part 4), not to `class_assessments` — the legacy insert path (`lib/repositories/assessment.repository.ts`, e.g. `createCoreAssessment` used by `scripts/reference-school/06-seed-legacy-bridge.ts:490-502`) is the only writer of `class_assessments`.

### Where the chain terminates

Following every FK-shaped column outward from `teacherId`:

- `teachers.id` → `teacher_classes.teacher_id` → dead end (no further FK on `teacher_classes` except `integration_connection_id`, see below)
- `teachers.id` → `class_assessments.teacher_id` → same dead end
- `teachers.user_id` → `auth.users.id` — this link exists and is real (`resolveTeacher`), but **no table maps `auth.users.id` → `schools.id` for a row that only has a `teachers` entry.** The mapping table that *would* do this — `school_users` (`user_id` → `school_id`) — is a separate table that a legacy-only teacher is not guaranteed to have a row in (see Part 2 for when they do).

**Exact termination point:** `teachers.user_id` is a real, working link to `auth.users.id` (Part 1's one genuine identity link). The chain does not break at `teachers` itself — it breaks one hop later: **there is no guaranteed row in `school_users` for a given `teachers.user_id`.** Whether one exists depends entirely on whether that same human was *also* separately onboarded into Core (Part 2). For a teacher who only ever used the legacy product (the common case pre-Core), no `school_users` row exists and the chain has nowhere to go — `schools.id` is unreachable.

---

## Part 2 — Existing School Relationships (Code, Not Just Schema)

### `school_users` table

Confirmed via `supabase/migrations/20260629_core_foundation.sql` (the only migration with `CREATE TABLE school_users`) and `lib/database.types.ts`:

| column | notes |
|---|---|
| `id` | PK |
| `school_id` | FK → `schools.id` (`school_users_school_id_fkey`) |
| `user_id` | **keys off `auth.users.id`** — same identity space as `teachers.user_id` |
| `role` | `SchoolUserRole` (`'teacher'`, `'school_admin'`, `'headteacher'`, `'deputy_headteacher'`, `'parent'`, etc.) |
| `is_active`, `invited_by`, `joined_at` | |

### The bridge exists in production code — used today, just not by `gradeLevelFromScore`

`lib/repositories/school.repository.ts` contains a working, in-use join across the two identity systems, keyed on the shared `user_id` (= `auth.users.id`):

- `findTeacherUserIdsBySchoolId(schoolId)` (lines 487-495) — queries `school_users` where `school_id = X AND is_active = true`, returns `user_id[]`.
- `findTeachersBySchoolId(schoolId)` / `findVerifiedTeachers(schoolId)` (lines 503-528) — takes those `user_id`s, queries `teachers.user_id IN (...)`, returns legacy `teachers.id` rows.
- `findTeacherClasses(teacherIds)` (lines 530-538) — continues the chain into `teacher_classes.teacher_id IN (...)`.

This three-step join (`school_users.school_id` → `school_users.user_id` = `teachers.user_id` → `teacher_classes.teacher_id`) is exactly the mechanism that would resolve `teacherId` → school in the *other* direction if inverted (`teachers.id` → `teachers.user_id` → `school_users.user_id` → `school_users.school_id`). **It is not hypothetical — it is live, used by `lib/school/intelligence.ts::computeSchoolIntelligence()`** (called from `app/api/school/intelligence/route.ts`, `app/api/school/strand-health/route.ts`, `app/api/school/intervention-efficacy/route.ts`), which starts from a `schoolId` and walks exactly this join to find every teacher's classes and students for Principal-Dashboard aggregation.

The join direction `school_users` needs (school → teachers) is the reverse of what `gradeLevelFromScore` needs (teacher → school), but it is the **same underlying join on the same shared column** (`user_id`), just queried from the opposite end. No new table or column is required to invert it — only a new query (`school_users.eq('user_id', teacher.user_id)`, single row via `resolveMembership`-style lookup already implemented generically at `lib/core/identity.ts:160-164`).

### `resolveTeacher` / `resolveMembership` — the identity-layer functions

`lib/core/identity.ts` is the canonical identity-resolution module (per its own header comment, written to replace 82 ad-hoc `teachers` re-queries found in a prior census):

- `resolveTeacher(userId)` (lines 113-122) — `auth.users.id` → `teachers` row. Starts from `user_id`, not `teacherId`.
- `resolveMembership(userId, schoolId)` (lines 160-164) — thin wrapper over `getSchoolUser(userId, schoolId)` (`lib/core/school-users.ts:5-10` → `repos.teachers.findSchoolUser`). **Requires a known `schoolId` as input — it cannot discover which school a user belongs to from `userId` alone**, it only confirms membership in an already-known school.
- `buildSchoolContext(client, schoolId)` (`lib/core/context.ts:63-73`) — composes `resolveSchool` + `resolveMembership` + `resolveTeacher` together, but again requires `schoolId` supplied by the caller (typically from the route path, e.g. `/api/core/school/[schoolId]/...`), not derived from `teacherId`.

**No function in `lib/core/identity.ts`, `lib/core/context.ts`, `lib/core/school-users.ts`, or `lib/repositories/school.repository.ts` takes a bare `teacherId` (or even `userId`) and returns "the school(s) this person belongs to" with no `schoolId` already given as input.** Every existing membership-resolution function is a *confirmation* function (given school + user, is this a member?), not a *discovery* function (given only user, which school?). `findSchoolUserByUserId(userId)` (`school.repository.ts:96-105`) is the closest thing — user_id → single active `school_users` row → `school_id` — but it is never called from `assessment.repository.ts` or any grading path, and it starts from `userId`, not `teacherId` (an extra `teachers.user_id` lookup would be needed first).

### Reference-school fixture — concrete proof the two systems CAN coexist for one real person

`scripts/reference-school/06-seed-legacy-bridge.ts` is explicit, deliberate proof. Its header comment (lines 1-46) states outright that it is temporary infrastructure "to unblock a pilot-readiness UX walkthrough while the legacy teacher-facing schema... is migrated onto the newer Core schema... reuse[s] the SAME identities already created in Core (same auth accounts, same names)."

Concretely, `bridgeTeachers()` (lines 158-264):
1. Reads existing Core `school_users` rows where `role = 'teacher'` (line 160).
2. For each, looks up the matching `auth.users` account by `su.user_id` (lines 163-178).
3. **Inserts a new `teachers` row with `user_id: su.user_id`** (line 198) — i.e., the *same* `auth.users.id` that already has a `school_users` row.

This produces, for every bridged reference-school teacher, one real person with both a `teachers` row and a `school_users` row sharing one `user_id`. It is seed-only and explicitly marked "Production code must NEVER depend on this bridge" (line 13), but it proves the coexistence is structurally possible and that the `user_id` join key is exactly the right one — Sprint 4E's blocking finding is about *missing production wiring*, not a fundamental schema incompatibility.

One documentation staleness caught in this file: its own comment (lines 41-46) describes a "KNOWN PRE-EXISTING BUG" claiming `findVerifiedTeachers()` queries non-existent `teachers.school_name`/`teachers.subjects` columns. The live code at `lib/repositories/school.repository.ts:516-528` does **not** do this — it queries `school_users` by `school_id`/`is_active` then `teachers` by `user_id`/`is_verified`, using only real columns (`school`, singular `subject`, are the correct legacy names per the generated types, and neither is referenced here). This comment appears to describe an earlier version of the function that has since been fixed; it is now inaccurate and should be treated as stale, not as evidence of a current bug — flagged here as an observation, not fixed (read-only sprint).

### Other FK-shaped columns checked, all dead ends

- `teacher_classes.integration_connection_id` → `integration_connections` table (`20260706_sync_pipeline.sql`) — keyed by `developer_id`/`teacher_id`, no `school_id` (confirmed via `lib/database.types.ts`).
- `class_assessments.grade_id` → `grades` — a global curriculum reference table (`code`, `name`, `level_order`, `category`), no `school_id`, not school-owned at all.
- `class_assessments.grade_scale_id` → `teacher_grade_scales` — keyed by `teacher_id` only, no `school_id`.

No other join path from `teacher_classes`/`class_assessments` reaches `schools`.

---

## Part 3 — The Missing Link, Precisely

The chain does not break inside `teachers`, `teacher_classes`, or `class_assessments` themselves — every one of those tables' FK-shaped columns has been traced to completion (Parts 1-2) and none reaches `schools`.

**The first, and only, point past which no further resolution is possible with the current schema is:** there is no guaranteed `school_users` row for a given `teachers.user_id`. `school_users.user_id` and `teachers.user_id` share the same value space (`auth.users.id`), and the join between them is real, indexed-enough production code (`school.repository.ts:487-528`) — but it is **conditional on that specific human having gone through Core onboarding** (`addSchoolUser` / the reference-school bridge). A teacher who signed up only through the legacy product (the majority of the pre-Core install base, since `teachers`/`teacher_classes` predate the Core migration entirely — no `CREATE TABLE` for either in the tracked migration history) has a `teachers` row with **no corresponding `school_users` row at all**, and for that teacher, `schools.id` is confirmed unreachable — not because a column is missing, but because the joining row on the `school_users` side does not exist.

Restated precisely for the grading call chain specifically: `getAssessmentAnalytics(teacherId, ...)` and `getCohortData(teacherId, ...)` would need, as a first step, `teacherId` → `teachers.user_id` → `school_users.user_id` (`.eq('user_id', ...).maybeSingle()`) → `school_users.school_id`. The first two hops are schema-supported today (no missing column). **The last hop fails silently (returns null) for any teacher who has never been added to `school_users`** — which, for the legacy gradebook's existing install base, is presumed to be most or all of them (no evidence found either way — no query in this audit counted real production rows, per the read-only/no-new-queries scope; this is inferred from the fact that `school_users` is a Core-era table and the legacy teacher base predates Core).

---

## Part 4 — Alternative Resolution Paths (Inventory Only)

Every place in the codebase, found during this audit, that resolves *some* entity to a `schools.id`:

| Path | Resolves | Location |
|---|---|---|
| `school_users.user_id` → `school_users.school_id` | any Core-onboarded user → school | `school.repository.ts:96-105` (`findSchoolUserByUserId`), `487-495` (`findTeacherUserIdsBySchoolId`) |
| Core `classes.school_id` | Core class → school (direct column, not a join) | `lib/core/classes.ts`; confirmed by `class_assessments`'s sibling Core table having `school_id` directly on `classes` per Core foundation migration `20260629_core_foundation.sql` |
| Core `learners.school_id` | Core learner → school (direct column) | used throughout `lib/repositories/school.repository.ts` (e.g. `listGuardianLearners`, line 392, `learner.school_id`) |
| `learner_guardians.user_id` → `learners.school_id` | parent account → school (via learner) | `school.repository.ts:384-408` |
| `term_subject_summaries.school_id`, `school_report_cards.school_id` | Core assessment-cycle rows → school (direct column) | `school.repository.ts:1119`, `REPORT_COLS` (line 27) |
| Core `createAssessment` (`app/api/core/assessments/route.ts` → `lib/core/assessments.ts`) | new Core assessment → school, via the `schoolId` already present in the `SchoolRequestContext` built by `buildSchoolContext()` before the route body runs | `lib/core/context.ts:63-73`; the route never needs to *discover* the school — it's supplied by the request context (from the URL path or session), consistent with every Core route being explicitly school-scoped from the outside in |

**The clearest model for what's missing:** Core's own `classes`/`learners`/`assessments` tables solve this by having `school_id` as a direct column populated at creation time — there is no runtime join at all in the Core path, because the identity was captured once, at the point the row was created, by a service that already had a `SchoolRequestContext`. The legacy path has no equivalent because `teacher_classes`/`class_assessments` were created before Core (and before "which school" was even a concept the legacy product had) — this is architecturally the same shape of gap as the already-documented students/learners identity reversal (`students` has a nullable `teacher_id` but, per `docs/architecture/canonical-domain-registry.md:52`, "no `school_id` column was confirmed during the audit" either — the same missing-direct-column pattern recurs across the legacy schema, not unique to `teachers`/`teacher_classes`).

This is inventory only — no fix is proposed or implied to be "the" answer; several of these are different table shapes (direct column vs. join) solving the same problem for different domains.

---

## Part 5 — Architectural Classification

**Classification: Legacy subsystem isolation.**

Justification, weighed against the alternatives:

- **Not "Missing foreign key."** A foreign key implies the referencing table and the target both existed with an expectation of being linked, and a column was simply omitted. Here, `teachers`/`teacher_classes`/`class_assessments` predate `schools`/`school_users` entirely (no `CREATE TABLE` for the legacy tables exists anywhere in tracked migration history; `schools`/`school_users` were introduced in `20260629_core_foundation.sql`, months into the tracked history). There was no `schools` table to reference when the legacy schema was designed.
- **Not "Missing repository."** The repository layer (`SchoolRepository`, `AssessmentRepository`) is not the gap — `SchoolRepository` already contains the exact join primitives needed (`findTeacherUserIdsBySchoolId`, `findSchoolUserByUserId`). The gap is that `AssessmentRepository`'s `gradeLevelFromScore` callers never call into it.
- **Not primarily "Identity duplication"** in the sense of two identities representing the same real-world entity incorrectly — `teachers.id` and `school_users.id`/`schools.id` represent genuinely different things (a legacy teaching profile vs. a Core school-membership record), and they are correctly *linkable* via the shared `user_id`, not duplicated. (Sprint 4E's broader project context flags a students/learners identity reversal elsewhere in the codebase that *is* closer to true duplication — this specific teacher→school gap is not that pattern; it is a directional/coverage gap in an otherwise-valid link.)
- **Not "Data model inconsistency"** — the two schemas are internally consistent; they are simply two generations of the same product that were never fully bridged.
- **Is "Legacy subsystem isolation":** `teachers`/`teacher_classes`/`class_assessments` form a complete, internally-consistent, functioning subsystem that was built before the Core/School model existed and has run in parallel to it ever since (confirmed pattern across three independent audits — Sprint 3's original Assessment Domain Audit, Sprint 4E, and this sprint). The bridge that *would* connect them (`user_id` shared between `teachers` and `school_users`) exists and is exercised in one direction (school → teachers, for Principal Dashboard intelligence) but was never built in the direction the legacy grading path needs (teacher → school), because the legacy path was never re-architected to be school-aware after Core was introduced — it was isolated, not integrated, by the migration that added Core.

---

## Part 6 — Smallest Future Change (Capability, Not Design)

The smallest missing architectural capability is: **a discovery function that, given a `teacherId` (or its underlying `user_id`), returns the `schools.id` it belongs to (if any) — the inverse of the school→teachers lookup that already exists in `SchoolRepository`.** No new table or column is required; the missing piece is a query, not a schema change.

---

## Part 7 — Executive Verdict

**Does the legacy gradebook currently know which School it belongs to? No.** `getAssessmentAnalytics` and `getCohortData` (`lib/repositories/assessment.repository.ts`) resolve nothing past `teacherId`/`teacher_classes`/`class_assessments` — none of those tables carry or can be joined to a `schools.id` without an additional lookup that does not currently exist in the grading call path.

**Is this intentional architecture or historical technical debt? Historical technical debt, not a deliberately designed and documented separation.**

Supporting evidence for "debt, not design":

- `docs/architecture/canonical-domain-registry.md:52` describes the sibling gap on `students` (no `school_id`) as "a gap relative to the Third Law ('Schools own Learners') that Phase A's named stages (0-5) do not currently address... an open item for Phase A+1 scoping, not silently assumed solved" — explicit acknowledgment of an open gap, not a documented design decision to keep the systems separate.
- `docs/architecture/deprecation-registry.md` entry #5 (Sprint 4E's own reclassification) calls the legacy teacher-gradebook path something that "has no school concept at all (an already-accepted fact from the original Sprint 3 domain audit) and runs parallel to, not linked with" Core — framed throughout as a known limitation to eventually close ("now understood to require a separate, larger scoping effort... not a Sprint-4E-sized fix"), never as an intended permanent boundary.
- `scripts/reference-school/06-seed-legacy-bridge.ts`'s header comment states its entire purpose is bridging "while the legacy teacher-facing schema... is migrated onto the newer Core schema" — language describing an in-progress, incomplete migration, not a stable dual-system design.
- No document was found — across `docs/architecture/reference-architecture-specification.md`, `docs/architecture/canonical-domain-registry.md`, or any Sprint 3-series audit referenced by this codebase — that argues *for* keeping the legacy teacher-gradebook path permanently unaware of School identity as a deliberate design choice. Every mention found treats it as an unresolved migration boundary.
- Conversely, the fact that `teachers`/`teacher_classes`/`class_assessments` predate any `CREATE TABLE` in the tracked migration history, while `schools`/`school_users` arrive later (`20260629_core_foundation.sql`), is straightforward evidence of sequential product evolution (legacy-first, Core-later) rather than a simultaneous two-system design.

UNKNOWN — no evidence found: whether any *verbal* or off-repository decision was made to keep the two systems separate; this audit can only speak to what is written in the codebase and its documentation.

---

## Appendix — Files Referenced

- `supabase/migrations/20260525_performance_indexes.sql`
- `supabase/migrations/20260629_core_foundation.sql`
- `supabase/migrations/20260706_sync_pipeline.sql`
- `supabase/migrations/20260713193000_phase_a_promotions_archival.sql`
- `supabase/migrations/20260713200000_phase_b_assessment_types.sql`
- `lib/database.types.ts` (`teachers`, `teacher_classes`, `class_assessments`, `school_users`, `grades`, `teacher_grade_scales`, `integration_connections` blocks)
- `lib/repositories/assessment.repository.ts`
- `lib/repositories/school.repository.ts`
- `lib/core/identity.ts`
- `lib/core/context.ts`
- `lib/core/school-users.ts`
- `lib/school/intelligence.ts`
- `scripts/reference-school/06-seed-legacy-bridge.ts`
- `docs/architecture/deprecation-registry.md` (entry #5)
- `docs/architecture/canonical-domain-registry.md`
- `docs/architecture/reference-architecture-specification.md`
- `docs/engineering/implementation-log.md` (Sprint 4E entry, 2026-07-15)
