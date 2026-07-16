# Platform Services — Identity, Permissions, Context

Reference documentation for `lib/core/identity.ts`, `lib/core/permissions.ts`, `lib/core/context.ts`, `lib/core/errors.ts`, `lib/core/guards.ts` — the shared platform infrastructure built in Sprint 1A, per `docs/architecture/reference-architecture-specification.md` §8 (the reserved Permissions domain) and the Phase A Execution Plan's Stage 1 groundwork.

**These modules are built but not yet wired into any route.** Route migration is Sprint 1B, explicitly deferred per the Sprint 1A brief. Every existing route continues to use its own inline auth/permission logic until migrated.

## Why this exists

A repository-wide search at the start of Sprint 1A found:
- 162 files call `auth.getUser()` independently.
- 82 files re-query the `teachers` table inline.
- 89 files re-implement student-ownership checks.
- 49 files re-implement "does this teacher own this record" checks.
- Only 11 routes used the one canonical membership check that already existed (`getSchoolUser`/`isSchoolAdmin`).

The two authorization gaps found in the Stage 0 Architectural Census (`app/api/core/assessments` POST, `app/api/core/reports` update action) both happened the same way: a role check was copy-pasted per route action, and one copy was correct while its sibling wasn't. These modules exist to make that specific failure mode structurally impossible — one shared implementation per decision, not a pattern every route author has to remember to copy correctly.

## Module map

| Module | Answers | Built on |
|---|---|---|
| `lib/core/identity.ts` | "Who is this?" — raw resolution, no authorization | `lib/auth/getRole.ts::getUserRoles` (existing canonical role lookup), `lib/core/school-users.ts::getSchoolUser` (existing canonical membership lookup), `repos.schools` |
| `lib/core/permissions.ts` | "Is this identity allowed to do X?" | `identity.ts` only — no raw queries of its own |
| `lib/core/context.ts` | The composed object a Domain Service receives | `identity.ts` + `permissions.ts` |
| `lib/core/errors.ts` | The one error vocabulary for all of the above | — |
| `lib/core/guards.ts` | Assertion functions for internal invariants | `identity.ts` types + `errors.ts` |

## Two function families in `permissions.ts`

- **`requireX()`** — mechanical role/membership gates. Throw on failure. Call at the top of a route, right after authentication.
- **`canX()`** — business-rule-aware capability checks that may combine role with resource ownership (e.g. "admin OR the assigned class teacher"). Return a boolean.

## Known gap, carried forward honestly

No repository currently owns `students`/`learner_guardians` reads for identity purposes — the Reference Architecture Specification's `LearnerRepository` entry describes `lib/repositories/learner.repository.ts`, which queries Core's `learners` table, not the de-facto-canonical `students` table (per Stage 0.5). `identity.ts`'s `resolveTeacher`/`resolveStudent`/`resolveParent` query `students`/`learner_guardians` directly via the service client for now — consolidating an existing pattern already used elsewhere in the codebase (e.g. `lib/repositories/compass.repository.ts`), not introducing a new one. When a `LearnerRepository` re-pointed at `students` is built (per the Canonical Domain Evolution Blueprint), these three functions are the ones that should be refactored to call it.

## Two deliberately conservative decisions

- **`requireClassTeacher`/`canManageAssessment` check `teacher_classes`, not Core's `classes`** — per the Evolution Blueprint's usage evidence (34-file vs. 1-file), `teacher_classes` is the de-facto-canonical Class table until the Class evolution lands. This is the one function that should change when it does.
- **`canEditReport` defaults to admin-tier only**, matching the already-correct, stricter `publish` action pattern — this was an explicitly flagged open product decision (Phase A Execution Plan, Stage 1: should report-comment edits be admin-only or admin-or-class-teacher-of-record?). Rather than guess at the looser alternative, this implementation keeps the conservative, already-proven-correct behavior. If the product decision is made to loosen it, `canEditReport` is the one function to change.

## Testing

All three modules have integration test suites (`lib/core/identity.test.ts`, `lib/core/permissions.test.ts`, `lib/core/context.test.ts`) following the existing convention (`lib/holiday/notify.test.ts`): real synthetic rows created against the live Supabase project, cleaned up in an `after()` hook, run via `npx tsx --env-file=.env.local --test <file>`. 24 tests, all passing as of Sprint 1A, verified to leave zero residual rows after a full run.
