# EduNexus — Engineering Hardening Report: End-of-Term Idempotency

## Executive Summary
The prior finding — "`runEndOfTerm()` may create duplicate academic terms if run twice" — is **partially confirmed**. A literal duplicate term row cannot be created: an existing database unique constraint already blocks it. What was genuinely missing is graceful handling of that condition — a second run would recompute and re-publish report cards harmlessly, then crash on term creation with an unhandled Postgres error instead of recognizing the term rollover already happened. Fixed with a 4-line guard reusing an existing repository/service lookup (`listTerms`) — no schema change, no new infrastructure.

## Root Cause
`runEndOfTerm` (`lib/core/endOfTerm.ts`) called `createTerm()` unconditionally as its final mutating step, with no check for whether the target term already existed and no error handling around the call. `app/api/core/school/end-of-term/route.ts` has no try/catch either, so any thrown error propagates as an unhandled 500.

## Verification Findings
Traced every mutating operation in the End-of-Term path, in execution order:

| Stage | Operation | Classification | Evidence |
|---|---|---|---|
| 1. Lock check | `listAssessments` (read-only) | **Safe** | No mutation. |
| 2. Score aggregation | `computeTermSummaries` → `upsertTermSubjectSummaries` | **Already idempotent** | `onConflict: 'learner_id,term_id,subject_id'` — re-running recomputes identical values from the same published assessments and upserts the same rows. |
| 3. Report generation | `generateReportCards` → `upsertReportCards` | **Already idempotent** | `onConflict: 'learner_id,term_id'`. Always resets `is_published: false` on regenerate (existing, pre-sprint behavior, same pattern as Holiday Plans — "regenerating replaces content, goes back to draft") — momentarily true only within a single `runEndOfTerm` call, corrected by step 4 in the same call. |
| 4. Report publish | `publishReportCards` | **Already idempotent** | Filters `is_published = false`; a repeat call affecting already-published rows is a harmless no-op (returns `published: 0`). |
| 5. Next-term creation | `createTerm` → `insertTerm` | **Required protection (fixed)** | No pre-existing guard in application code. Backed by DB constraint `terms_school_id_academic_year_id_term_number_key UNIQUE (school_id, academic_year_id, term_number)` (confirmed live via direct `pg_constraint` query) — a literal duplicate INSERT is rejected by Postgres, but the rejection was never caught, so it surfaced as an unhandled 500 rather than a recognized "already done" outcome. |
| 6. Current-term switch | `setCurrentTerm` → `clearCurrentTerm` + set | **Already idempotent** | Already verified (Sprint 19): clears every other term's `is_current` first, then sets the target — re-running with the same term is a no-op. |

**No audit/event emission occurs anywhere in `runEndOfTerm`** (`publishAssessment`'s event publish is a separate, earlier teacher action, not part of this workflow) — so duplicate execution carries no risk of duplicate audit-log entries.

**Conclusion**: duplicate academic terms cannot literally be created (the finding's specific claim is incorrect — the DB already prevents it). The real, confirmed gap is that the only non-idempotent step failed ungracefully instead of resolving cleanly, wasting a full recompute of steps 2–4 and returning a confusing error on every retry.

## Code Changes
`lib/core/endOfTerm.ts`:
- Imported `listTerms` (existing function, `lib/core/school.ts`) alongside the already-imported `createTerm`.
- Before calling `createTerm`, look up existing terms for `(schoolId, academic_year_id)` via `listTerms` and check whether one with the target `term_number` already exists. If so, reuse it; otherwise create it as before.
- No changes to `EndOfTermInput`/`EndOfTermResult` types, no changes to steps 1–2, 4, 6, no changes to the API route.

This uses preferred-solution #1 (existing unique constraint, kept as the ultimate backstop) and #3 (existing repository/service method, `listTerms`) — no new locking, no new infrastructure, no schema change.

## Validation Results
- **TypeScript**: `npx tsc --noEmit` — clean (0 new errors; 2 pre-existing, unrelated errors in `scripts/` remain, confirmed via `git status` to be untouched).
- **ESLint**: `npx eslint lib/core/endOfTerm.ts app/api/core/school/end-of-term/route.ts` — 0 errors, 0 warnings.
- **Production build**: `npm run build` — Turbopack compile succeeds; same pre-existing unrelated script error blocks the full type-check phase, unaffected by this change.
- **Running End-of-Term twice cannot create duplicate terms**: confirmed by design — the second run's `listTerms` lookup finds the term created by the first run and reuses it; `createTerm` is never called a second time for the same `(academic_year_id, term_number)`. The unique constraint remains as a backstop for a genuine concurrent race (two simultaneous requests both passing the check before either inserts) — documented below, not eliminated.
- **Existing successful (single-run) workflow unchanged**: the new lookup only reuses an existing term; when none exists (the normal case), behavior is identical to before — `createTerm` is called exactly as it was.
- **Partial failures remain recoverable**: if `createTerm` still fails for an unrelated reason (e.g. a genuine constraint conflict from manual term management outside this workflow), the error still surfaces as before — no new failure mode was introduced, and steps 1–4 remain safely re-runnable regardless.
- **Report generation / Holiday Learning unaffected**: neither was touched; `generateReportCards`/`publishReportCards` calls and their upsert semantics are unchanged. Holiday Learning is not called from `runEndOfTerm` at all (documented Core/legacy schema gap from Sprint 19, unchanged).
- **Audit trail intact**: `runEndOfTerm` publishes no events; nothing here duplicates or alters audit-log behavior.

## Remaining Risks
- **Concurrent race window**: two truly simultaneous End-of-Term requests for the same term could both pass the `listTerms` check before either `createTerm` completes, so one would still fail on the unique constraint. This is a narrow, low-probability window (millisecond-scale double-submission) rather than the common "retry after timeout/duplicate click" case this fix targets, and is still safely rejected by the database rather than silently corrupting data. Closing it fully would require a locking mechanism (e.g. an advisory lock or `SELECT ... FOR UPDATE`) — explicitly not introduced here per the "no new locking infrastructure unless already present" instruction, since none already exists in this codebase for this purpose.
- The route still has no try/catch around `runEndOfTerm` — an error in the rare race case above (or any other unexpected failure) still returns a raw 500 rather than a structured error body. Not fixed here (out of the stated idempotency scope); worth a follow-up if operators need a friendlier message for that specific edge case.

## Deferred Items
- The Vercel cron-registration/plan-budget question raised previously — untouched.
- The two stale-duplicate local migration files (already-live content under different version numbers) — untouched.
- Route-level error handling for `runEndOfTerm` beyond the idempotency guard itself — untouched.

## Engineering Confidence
**High.** The fix is a 4-line, additive guard using an already-imported module and an already-existing DB constraint as the correctness backstop. No new types, no new tables, no behavior change to the successful single-run path (verified by code inspection — the new branch only activates when a matching term already exists).

## Operational Go / No-Go
**Go.** The originally reported risk (duplicate terms) was never actually reachable in practice due to the existing constraint; this change closes the practical gap (ungraceful failure on retry) with a minimal, low-risk guard. No further action required before pilot use of the End-of-Term workflow.
