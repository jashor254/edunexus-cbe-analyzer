# Phase 13.2 — Performance: Query Optimisations

Date: 2026-07-04
Scope: Fix every confirmed N+1 pattern, per-row upsert loop, and missing index found in the pre-beta performance audit. Most hot paths (SOW list, teacher/student assignments, billing renewals) were already correctly batched — this stage closes the remaining gaps.

---

## 1. Records of Work — entry counts

**File:** `app/api/teacher/records-of-work/route.ts` (`GET`)

**Before:** For each record returned (up to 50), issued 2 separate `count`-only queries against `row_entries` (`total` and `completed`) inside `Promise.all` — **up to 100 queries per request**.

**After:** One batched `.in('row_id', rowIds)` fetch of `{row_id, reflection}` for every returned record, with totals and completed counts aggregated in memory. Query count for this endpoint is now fixed at 2 regardless of how many records are returned (the `records_of_work` select + the one `row_entries` fetch).

**Before/after query count (50 records):** 101 → 2

---

## 2. Cron: `friday-generation`

**File:** `app/api/cron/friday-generation/route.ts`

**Before:** For each active SOW in the loop: 1 query for `schemes_of_work.timeline`, 1 query for the latest `lesson_plans.week_number`, plus one `substrand_health.update()` **per pending row** inside a nested loop.

**After:**
- Pre-fetch `schemes_of_work.timeline` for all active SOW ids via one `.in('id', sowIds)` query before the loop.
- Pre-fetch all `lesson_plans.week_number` rows for those SOWs via one `.in('sow_id', sowIds)` query, then compute the max week per SOW in memory.
- Collect all root-cause classifications for a SOW's pending rows and write them with a single `substrand_health.upsert(rows, { onConflict: 'id' })` instead of one `.update()` per row.

**Before/after query count (N active SOWs, M pending rows per SOW):** `2N + M` queries → `2 + N` queries (the two pre-fetches, plus one upsert per SOW's pending-row batch — no longer one per row).

---

## 3. Cron: `generate-record-of-work`

**File:** `app/api/cron/generate-record-of-work/route.ts`

**Before:** For each SOW being converted to a Record of Work: 1 query for `schemes_of_work` metadata, 1 query for the teacher's `full_name`, then a per-SOW `records_of_work` upsert and a per-SOW `row_entries` upsert.

**After:**
- Pre-fetch `schemes_of_work` metadata for every SOW via one `.in('id', sowIds)` query.
- Pre-fetch `teachers.full_name` for every distinct teacher via one `.in('id', teacherIds)` query.
- Build every ROW header row in memory and upsert them **all in one call** (`records_of_work.upsert(headerRows, { onConflict: 'scheme_id' })`), reading back `{id, scheme_id}` to map each SOW to its header row.
- Build every per-lesson entry across every SOW and upsert them **all in one call** (`row_entries.upsert(allEntries, { onConflict: 'row_id,week,lesson' })`).

**Before/after query count (N SOWs):** `2N + 2N` (4N) → `2 + 2` (2 pre-fetches + 2 batched upserts), independent of N.

---

## 4. Cron: `term-readiness`

**File:** `app/api/cron/term-readiness/route.ts`

**Before:** `monday_panel_cache.upsert(...)` called once per class inside the brief-building loop.

**After:** All class briefs are collected first; a single multi-row `upsert(briefs.map(...), { onConflict: 'class_id' })` runs once after the loop.

**Before/after query count (N classes):** N upserts → 1 upsert.

---

## 5. Missing indexes

**Migration:** `supabase/migrations/20260704_phase13_performance_indexes.sql`

- `monday_panel_cache.teacher_id` — had an RLS policy filtering on this column (`USING (teacher_id = auth.uid())`) with no supporting index, forcing a sequential scan on every RLS-filtered read/write.
- `row_entries.row_id` — a FK column (Postgres does not auto-index FK columns) queried directly by the records-of-work N+1 fix above (`.in('row_id', rowIds)`).

Both added as plain B-tree indexes via `CREATE INDEX IF NOT EXISTS`.

---

## 6. Stray `select('*')` cleanup

Replaced with explicit column lists (verified against each file's actual field usage before editing, not guessed):

- `app/api/admin/stats/route.ts` — 5 `count`-only queries switched from `select('*', {count:'exact', head:true})` to `select('id', ...)` for consistency with the rest of the codebase (no functional change — `head: true` never returns row data either way).
- `app/shared/[token]/page.tsx` — narrowed to `expires_at, report_data, created_at, student_name, grade`.
- `app/student/groups/[groupId]/page.tsx` — narrowed the `study_group_challenges` fetch to `id, question, correct_answer, hint, difficulty, kenyan_context, date`.
- `app/dashboard/groups/[groupId]/page.tsx` — narrowed `study_groups`, `study_group_members` (2 call sites), and `study_group_challenges` fetches to the fields the page's `GroupDetails`/`Member`/`Challenge` types actually declare.
- `app/dashboard/clinic/reports/[studentId]/page.tsx` — narrowed `students` to `id, name, grade, current_pathway, school, date_of_birth` and `assessments` to `subject_scores, term, year` (verified against the `StudentProfile`/report-generation code paths that consume them).
- `app/dashboard/assessments/add/page.tsx` — narrowed `students` to the exact fields of the page's own `Student` interface (`id, name, grade, current_pathway, curriculum_type, year_level, user_id`).

---

## Verification

```
npm run typecheck   → 0 errors
npm run lint        → 0 errors (36 pre-existing warnings, unrelated to this change)
npm run build       → succeeds, all routes compile
```

All column selections were derived by reading each file's actual field usage (interfaces, destructuring, downstream function signatures) rather than assumed, to avoid silently dropping a field a component depends on.

## Remaining performance debt (out of scope for this stage)

- `assignment_submissions` and `assignments` table definitions live in `supabase/teacher_portal_migration.sql`, outside the `supabase/migrations/` set audited for indexes — worth a follow-up check that `assignment_submissions(assignment_id, student_id)` and `assignments(class_id)` are indexed.
- `lib/jobs/process.ts`'s internal `processQueue` batching was not reviewed in this pass (flagged, not confirmed as an issue).
- `app/api/cron/dlq-requeue/route.ts` and `app/api/cron/events/dispatch/route.ts` still issue one write per job/delivery — acceptable given per-row status differs and volume is low, but noted as a possible future batching target if volume grows.

## Recommended next work

Proceed to **Phase 13.3 + 13.4 — Observability & Reliability**: add the slow-query timing wrapper, wire the AI circuit breaker into `lib/ai/deepseek.ts`'s actual call path, and extend `app/api/platform/health/route.ts` with jobs/events queue health — per the scoping already agreed (no rebuild of the existing retry/backoff/DLQ/idempotency infrastructure, which is already solid).

## Suggested commit message

```
perf: batch N+1 queries in ROW, friday-generation, and generate-record-of-work crons ⚡

Replaces per-row/per-SOW/per-class database round trips with batched
.in()/upsert() calls across the records-of-work endpoint and three cron
jobs. Adds missing indexes on monday_panel_cache.teacher_id and
row_entries.row_id. Removes remaining select('*') usage in favor of
explicit column lists.
```
