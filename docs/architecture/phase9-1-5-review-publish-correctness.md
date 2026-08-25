# Phase 9.1.5 — Career Review Queue Publish Correctness

**Type:** Correctness repair, not a discovery-architecture phase.
**Branch:** `main` · **HEAD at start:** `8a0ca5ddf8854c533aa7b8e82edce71c85eac995`

Phase 9.1 found, via a read-only query against the connected Supabase project, that `career_review_queue`'s live `status` CHECK constraint did not permit `'published'` — the value `markCareerReviewDecided()` already wrote on every publish. This document is the reproduction, root-cause trace, fix, and proof for that finding.

---

## 1. Pre-fix reproduction (local Docker, raw SQL)

```
insert into career_review_queue (status='pending', slug='test-reproduction-career', ...)
  → succeeds

insert into careers (slug='test-reproduction-career', ...) on conflict (slug) do update ...
  → succeeds, commits (its own implicit transaction)

update career_review_queue set status='published' where slug='test-reproduction-career'
  → ERROR: new row for relation "career_review_queue" violates check constraint
    "career_review_queue_status_check"
```

Exact error, captured live:
```
ERROR:  new row for relation "career_review_queue" violates check constraint "career_review_queue_status_check"
DETAIL:  Failing row contains (0ffb15bc-25b2-4013-87dc-ad26074a809c, Test Reproduction Career, published, null, test, ...).
```

## 2. Partial-state proof

After the failed UPDATE, both tables were inspected directly:

```
careers:              slug='test-reproduction-career' EXISTS (committed, live, canonical)
career_review_queue:  slug='test-reproduction-career', status='pending', reviewed_at=null (unchanged)
```

**Confirmed: `publishReviewedCareer()` performs two independent, non-transactional writes** (`repos.careers.upsertCareer()` then `repos.careers.markCareerReviewDecided()`, each its own Supabase/PostgREST call, no shared transaction). Before this fix, step 2 failed *every single time*, deterministically, leaving a career silently live in `careers` while its review row stayed stuck at `pending` forever — invisible as "already handled" to any future reviewer, and re-surfacing indefinitely in `listPendingCareerReviews()`.

Fixture data was deleted immediately after reproduction; no state was left in either table.

## 3. Status inventory

| Status | Written by | Read by | DB allowed (pre-fix) | Meaning |
|---|---|---|---|---|
| `pending` | `enqueueCareerReview()` (insert default) | `listPendingCareerReviews()`, `findPendingCareerReviewBySlug()` (Phase 9.1), `publishReviewedCareer`/`rejectReviewedCareer` (guard: `review.status !== 'pending'` throws) | Yes | Awaiting human decision |
| `in_review` | *nothing* | *nothing* | Yes | Dead — see §5 |
| `approved` | *nothing* | *nothing* | Yes | Dead — see §5 |
| `published` | `markCareerReviewDecided(id, 'published', ...)` | *nothing reads for this value specifically* — its absence from `pending` is what excludes it from the two review-queue queries above | **No (bug)** | Terminal: career is now canonical |
| `rejected` | `markCareerReviewDecided(id, 'rejected', ...)` | same as above | Yes | Terminal: career stays out of `careers` |

## 4/5. `approved` and `in_review` — LEGACY / UNUSED, confirmed by repo-wide search

`grep -rn "'in_review'\|'approved'"` across `lib/career/`, `app/api/career/`, `app/api/admin/career/` returns zero application hits for either value as a live status. Both exist only in the CHECK constraint itself, inherited from before `20260813140000_career_knowledge_lifecycle.sql` built the actual `pending → published|rejected` workflow (`lib/career/knowledgeRequests.ts`). Confirmed that migration never touches the `status` constraint at all (read in full). No admin UI or route references a third/fourth state.

## 6. `published` — exact application dependency

`markCareerReviewDecided(reviewId, 'published', reviewerId, reviewerNotes)` is called from exactly one place: `publishReviewedCareer()`. Nothing queries `.eq('status', 'published')` — published rows simply stop appearing in the `pending`-filtered queries above once correctly written. No admin list, request-count logic, or telemetry currently branches on the literal string `'published'`.

## 7. Root cause

**Schema staleness, not an application-logic bug.** `career_review_queue_status_check` predates the migration that defined the real workflow and was never updated to match it. Application code has been internally consistent (`pending → published | rejected`) since 2026-08-13; the database has been the thing out of date. Confirmed: zero rows exist in `career_review_queue` in both the local Docker database and the connected Supabase project, so this bug has never yet corrupted a real review — it would have failed on the very first one.

## 8. Fix decision: migration (schema), not application code

Code already writes the correct, intended value. Changing the code to write `'approved'` instead of `'published'` would just rename the terminal state to dead legacy vocabulary for no reason and still requires a migration anyway (nothing currently transitions `approved → published`, and inventing that second step is a bigger, unrequested state-machine change). The evidence-based fix is Option A from the mission brief: widen the CHECK constraint to include `'published'`, keeping the two unused values rather than removing them (removing unused-but-harmless allowed values is unrelated cleanup, out of scope, and the mission explicitly asked not to drop unrelated things).

## 9. Migrations applied (local Docker only — see §22)

`supabase/migrations/20260824130531_career_review_queue_status_published.sql`:
```sql
alter table public.career_review_queue drop constraint career_review_queue_status_check;
alter table public.career_review_queue add constraint career_review_queue_status_check
  check (status = any (array['pending','in_review','approved','published','rejected']));
```

A second, independently-discovered bug blocking the same acceptance path, found while proving the fix end-to-end (see §11): `careers.pathways` (a legacy `jsonb NOT NULL` column, distinct from `pathway text`, confirmed unread/unwritten by any application code via repo-wide search) has no default and nothing ever populates it — so `upsertCareer()` failed on **every** publish with `null value in column "pathways" violates not-null constraint`, independently of the status bug. Fixed minimally in `supabase/migrations/20260824131500_careers_pathways_column_not_null_relief.sql`:
```sql
alter table public.careers alter column pathways drop not null;
```
Column kept (not dropped) — see that migration's own comment for why.

## 10. Existing data compatibility

`select status, count(*) from career_review_queue group by status` returned **zero rows** in both the local Docker database and the connected Supabase project (read-only query). No backfill or data migration was needed.

## 11. Publish flow after the fix

```
pending queue row (payload = AI-drafted profile)
        ↓
reviewer calls POST /api/admin/career/review {decision:'publish'}
        ↓
publishReviewedCareer(reviewId, reviewerId, notes)
        ↓
repos.careers.upsertCareer(payload)        → careers row committed, knowledge_verified_at stamped
        ↓
repos.careers.markCareerReviewDecided(id,'published',reviewerId,notes)
        ↓                                     (now succeeds — constraint fixed)
career_review_queue.status='published', reviewed_at set, reviewed_by set
        ↓
next identical search resolves via getCareerBySlug()/findCareerByTitleLike() → status:'known'
(never re-enters the AI-generation or pending-dedup path)
```

## 12. Atomicity

**Improved, not solved.** The deterministic, guaranteed failure is gone — publishing now succeeds end-to-end in the common case (proven, §18). The two writes remain two separate, non-transactional calls (same pattern as the rest of this repository's repository layer); a *new*, non-deterministic failure between them (network blip, timeout) could in principle still leave the same partial state described in §2, just now as rare as any other two-step write in the codebase rather than guaranteed on every attempt. Per the mission's explicit instruction, no transaction/RPC infrastructure was introduced to close this residual gap — it would be broad new infrastructure this repository's repository layer doesn't currently have anywhere, not a "smallest safe correction."

## 13. Idempotency

Proven by test: calling `publishReviewedCareer()` twice on the same `reviewId` throws `Career review {id} is already published` on the second call (pre-existing `review.status !== 'pending'` guard, untouched by this fix) — exactly one `careers` row exists afterward. Deterministic, no duplicate.

## 14. Reject flow

Proven by test: `rejectReviewedCareer()` still marks the row `rejected` and the career never appears in `careers`.

## 15. Human gate — proven preserved

`publishReviewedCareer(reviewId, reviewerId, reviewerNotes)` still requires both arguments; no code path calls it without an explicit reviewer. `markCareerReviewDecided` is called from exactly two places, both inside `knowledgeRequests.ts`, both behind the `pending`-only guard. Confirmed by `reviewPublishGuards.architecture.test.ts` Guards B/D (source-text) and exercised live by the integration test.

## 16. Provisional/canonical boundary — proven preserved

`repos.careers.getAllCareers()` (the real input to search/matching) never includes a still-pending queue row — proven live against the local database, not asserted from reading code.

## 17. Phase 9.1 regression — unaffected

`knowledgeRequests.test.ts` (mocked, no DB) — 8/8 still pass unchanged; the pre-LLM exact-dedup and rate-limit logic added in Phase 9.1 are untouched by this fix (they operate purely on `status='pending'` rows, which this fix doesn't alter the meaning of).

## 18. Full local end-to-end proof

`lib/career/reviewPublishCorrectness.integration.test.ts`, run against local Docker with both credential pairs pointed at it — **5/5 pass**:
1. publish writes the canonical career AND marks the queue row published
2. publishing twice is a safe explicit error, never a duplicate career
3. reject keeps the career out of canonical `careers`
4. a still-pending review never appears in the real canonical-search input
5. after publish, the same query now resolves as canonical, no further AI generation

## 19. Architecture guards

`lib/career/reviewPublishGuards.architecture.test.ts` (4 tests, source-text, in `scripts/standard-tests.json`) — Guards B/C/D. Guard A (DB-compatibility) is deliberately proven live by the integration test above rather than duplicated as a second hardcoded allowed-list, per this document's own lesson: a source-text copy of the constraint's allowed values would just drift from the schema the same way the original bug did.

## 20. Named limitations (unchanged from Phase 9/9.1, restated for continuity)

Two disconnected career corpora · no aliases · no semantic dedup · no career lifecycle beyond `pending/published/rejected` · no structured per-field provenance model · no web research · silent pathway fallback (still unfixed, still gated only by human review — see §21 note below) · prompt injection into the generation prompt (still unmitigated, length-capped only) · no CAREER/ROLE/SPECIALISATION/SKILL taxonomy · slug identity fragility.

## 21. On the silent pathway fallback

Not fixed here, as instructed. Its containment is unchanged and still load-bearing: an AI-generated profile with an invalid `pathway` value silently coerces to `'Social Sciences'` in `careerEngine.ts`, but that coerced value only ever reaches `careers` through the same human-reviewed `publishReviewedCareer()` path this document just repaired — a reviewer sees the payload (including its `pathway` field) before publishing. Fixing the deterministic publish-time failure makes this human check reachable at all; it does not reduce the reviewer's responsibility to actually check it.

## 22. Deployment note

Both migrations were applied and proven **only against the local Docker database** (`supabase_db_edunexus`), per this phase's explicit no-production-writes instruction. The connected Supabase project (verified read-only both before and after this work) still carries the original, broken constraint and the original `pathways NOT NULL` column. The two migration files are committed to `supabase/migrations/` for deployment through this project's normal migration pipeline — they are not yet live anywhere but the local disposable database used to prove them.
