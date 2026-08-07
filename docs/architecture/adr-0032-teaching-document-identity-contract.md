# ADR-0032 — Teaching Document Identity Contract & Record of Work Ownership

**Status:** Accepted
**Date:** 2026-08-07
**Phase:** Teaching-Document Convergence, Phase 1 (Record of Work Integrity)
**Supersedes:** nothing. **Superseded by:** nothing.
**Related:** `docs/architecture/adr-0019-teacher-workspace-architecture.md`, `supabase/migrations/20260807120000_record_of_work_integrity.sql`

---

## 1. Context

EduNexus has two legitimate identity namespaces for a teacher:

| Namespace | Value | Obtained via |
|---|---|---|
| **Auth identity** | `auth.users.id` | `supabase.auth.getUser()` → `user.id`; `auth.uid()` in SQL |
| **Teacher-record identity** | `teachers.id` | `resolveTeacher(userId)` → `teacher.id`; `auth_teacher_id()` in SQL |

They are disjoint. Verified live: `SELECT count(*) FROM teachers t JOIN auth.users u ON u.id = t.id` returns **0** across 259 teacher records. The only bridge between them is `teachers.user_id`.

Both namespaces are correct and both are load-bearing. The teaching-document tables were built at different times by different code and each settled on one of them. That was never written down, so a later change copied a value from one namespace into a column governed by the other, and no test or constraint caught it.

The concrete production failure: `/api/cron/generate-record-of-work` read `lesson_plans.teacher_id` (an auth id) and wrote it into `records_of_work.teacher_id` (a column whose RLS policy and every API filter resolve `teachers.id`). Because `records_of_work.teacher_id` had **no foreign key**, the database accepted it. The resulting Record of Work was invisible to the teacher who owned it, under both RLS and the service-role query filter.

This ADR fixes the namespace of the record, not the namespaces themselves.

---

## 2. Decision — the canonical contract

```
                    teachers.user_id
auth.users.id  ◄─────────────────────────►  teachers.id
      │                                            │
      │ AUTH IDENTITY                              │ TEACHER-RECORD IDENTITY
      ▼                                            ▼
lesson_plans.teacher_id                    schemes_of_work.teacher_id
generation_jobs.teacher_id                 records_of_work.teacher_id
```

| Table | Column | Canonical namespace | Enforced by |
|---|---|---|---|
| `lesson_plans` | `teacher_id` | **`auth.users.id`** | FK → `auth.users(id)`; RLS `auth.uid()` |
| `generation_jobs` | `teacher_id` | **`auth.users.id`** | FK → `auth.users(id)`; RLS `auth.uid()` |
| `schemes_of_work` | `teacher_id` | **`teachers.id`** | FK → `teachers(id)`; RLS `auth_teacher_id()` |
| `records_of_work` | `teacher_id` | **`teachers.id`** | FK → `teachers(id)` *(added by this phase)*; RLS `auth_teacher_id()` |
| `scheme_lessons`, `row_entries` | — | inherited via parent FK | parent RLS |

### Why this split, and why not "make them all the same"

The reason is **existing domain semantics, not stylistic consistency.**

- Lesson Plans and generation jobs are *session-scoped work products*. Their routes operate entirely in authenticated-user identity space: `checkFeatureAccess()` returns `userId`, rate limiting is per auth user, and eleven read paths plus the RLS policy filter on `auth.uid()`. This is coherent and correct.
- Schemes and Records of Work are *professional records belonging to a teacher's practice*. Their APIs resolve through `resolveTeacher()`, their RLS resolves through `auth_teacher_id()`, and they carry teacher-record metadata (`teacher_name`, `tsc_number`).

Unifying them was considered and **rejected**. Migrating `lesson_plans.teacher_id` to `teachers.id` would break 11 code readers plus its RLS policy, to repair 2 broken readers. The cost/benefit runs firmly the wrong way, and the table is internally consistent as it stands (14/14 live rows valid). Two correct namespaces with an explicit contract is a better outcome than one namespace bought with a high-risk migration.

---

## 3. Rule: never copy across the boundary

> **A value read from `lesson_plans.teacher_id` or `generation_jobs.teacher_id` must never be written to `schemes_of_work.teacher_id` or `records_of_work.teacher_id`, or vice versa, without resolving through `teachers.user_id`.**

Prefer *deriving* the owner over *translating* it. Where a scheme is in scope, `schemes_of_work.teacher_id` is already the canonical `teachers.id` — read it from there rather than resolving an auth id. That is what `syncRecordOfWorkForScheme()` does, and it is why the cron no longer handles a teacher identity at all.

Where translation is genuinely required:

```ts
// auth id -> teacher-record id
const { data } = await db.from('teachers').select('id').eq('user_id', authUserId).maybeSingle()
// or, canonically:
const teacher = await resolveTeacher(authUserId)   // lib/core/identity.ts
```

The foreign key added in this phase makes the wrong direction fail loudly at the database instead of silently producing an unreadable record.

---

## 4. Rule: teacher-authored evidence is never machine-written

A Record of Work is **the teacher's record of actual teaching**, not a second copy of the plan.

| Field | Owner | May automation write it? |
|---|---|---|
| `row_entries.date_taught` | **Teacher** | **Never** |
| `row_entries.reflection` | **Teacher** | **Never** |
| `row_entries.remarks` | **Teacher** | **Never** |
| `row_entries.strand`, `substrand` | Machine | Yes — refreshed each sync |
| `row_entries.learning_outcomes`, `key_inquiry_questions`, `learning_resources`, `activities_summary` | Machine | Yes |
| `row_entries.status` | Machine | Yes |

The mechanism is **structural, not conditional**. `TEACHER_OWNED_ENTRY_FIELDS` in `lib/row/recordOfWork.ts` are absent from the upsert payload entirely, so PostgREST's `ON CONFLICT DO UPDATE` cannot name them. A conditional guard can be forgotten at one call site; an absent column cannot be. Regression-guarded by Test E, which re-runs the synchronisation path three times and asserts the teacher's values are byte-identical afterwards.

---

## 5. Consequence: two shapes for the same information

`row_entries.learning_outcomes` and friends are `jsonb` arrays. `lesson_plans` stores them as `jsonb` too, but `scheme_lessons` stores them as **`text`**. This is a live divergence, not a modelling choice, and it predates this phase. `toStringArray()` in `lib/row/recordOfWork.ts` normalises both to arrays so either source produces identical rows. Not reconciled at the schema level in this phase — out of scope, recorded here so the next reader knows it is known.

---

## 6. Consequence: the detail route's column names

`GET /api/teacher/records-of-work/[id]` selected `sow_id` and `subject`. Neither column exists — `records_of_work` has `scheme_id` and `learning_area`. PostgREST errored, the route's `if (error || !row)` branch fired, and **every** Record of Work detail request returned 404. The client page had always expected the correct names. Corrected in this phase; the error and not-found branches are now distinct.

---

## 7. Consequence: one canonical writer

`lib/row/recordOfWork.ts` is the only module that writes `records_of_work` or `row_entries`. Both the interactive route and the Monday cron call it.

- **Header:** get-or-create keyed on `scheme_id`. An existing header is returned **untouched** — its owner and metadata both survive. `records_of_work_scheme_id_key` can therefore never surface a raw `23505` to a teacher, and neither writer can flip the other's ownership.
- **Entries:** deterministic source selection — `lesson_plans` if any exist (richer), else `scheme_lessons`, else no-op. Never fabricate an empty document.
- **Idempotent:** safe to run repeatedly by construction.

---

## 8. Consequence: `status` and week coverage

The cron previously wrote `status = 'completed'` on every entry and skipped each scheme's latest week (a week counted as "complete" only once a newer one existed). Two problems: a machine was asserting that teaching had happened, and the **final week of every scheme could never enter the Record of Work at all**.

Entries are now explicitly structural — `status: 'planned'` — and the whole scheme is seeded. What was actually taught is recorded by the teacher, in the teacher-owned fields. No surface reads `status` today, so this changes no rendered output.

---

## 9. Explicitly out of scope for this phase

Carrying `lesson_plans.taught_date` → `row_entries.date_taught`, or `lesson_plans.teacher_self_evaluation` → `row_entries.reflection`. That is **Phase 2**, and §4's ownership rule is the precondition that makes it safe: any such carry-forward needs explicit merge semantics in which an existing teacher value always wins.

---

## 10. Alternatives rejected

| Alternative | Why rejected |
|---|---|
| Migrate `lesson_plans.teacher_id` → `teachers.id` | Breaks 11 readers + RLS to fix 2. Table is internally consistent. |
| Let the cron own the Record of Work outright | Makes a machine the author of teaching evidence — inverts the domain. |
| Make the interactive route own it and delete the cron | Loses structural seeding for teachers who never open the page. |
| Drop `UNIQUE (scheme_id)` to let both writers insert freely | Produces duplicate Records of Work per scheme; no evidence contradicts the one-per-scheme invariant. |
| Rebuild the tables from `20260530_sow_tables.sql` | Destroys production data to fix a documentation problem. |
| Reproduce every live RLS policy byte-for-byte | Two were provable duplicates and two granted unconstrained admin writes no code path uses. Least privilege wins. |
