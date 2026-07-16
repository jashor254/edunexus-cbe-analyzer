# Phase 13.1 — Security Remediation Report

Date: 2026-07-04
Scope: Fixes for every HIGH/CRITICAL finding from the pre-beta security audit, plus two auth bugs discovered during the audit that were in scope for immediate correction.

---

## 1. IDOR — formative signal recording

**File:** `app/api/formative/signal/route.ts`

**Root cause:** The route resolved the caller's `teacher.id` but never verified that the supplied `classId` belonged to that teacher, nor that the student IDs in `gotItIds`/`confusedIds`/`lostIds` belonged to that class. Any authenticated teacher could write `formative_signals` — and trigger downstream `afterFormativeSignal()` learner-model updates — for arbitrary students in arbitrary classes.

**Fix:** Added a `teacher_classes` ownership check (`id = classId AND teacher_id = teacher.id`) and a `class_students` membership check that validates every submitted student ID against the class roster before any write occurs.

**Previous risk:** High — cross-tenant data write, arbitrary learner-model manipulation.
**New risk:** None — request rejected with 403 before any database write if either check fails.

---

## 2. Broken ownership check — Compass topic override

**File:** `app/api/teacher/students/[studentId]/compass-topic/route.ts`

**Root cause:** The route compared `student.teacher_id !== user.id` — but `students.teacher_id` stores a `teachers.id` value, while `user.id` is the Supabase auth user ID. These are different ID spaces, so the check would never match a legitimate teacher (fails closed, but for the wrong reason, and masked the missing lookup).

**Fix:** Added the standard `teachers.id` resolution step (`teachers.user_id = user.id`) used elsewhere in the codebase (e.g. `app/api/eir/*`), then compare `student.teacher_id === teacher.id`.

**Previous risk:** Low (fails closed) but functionally broken — legitimate teachers could not use the feature, and the pattern was inconsistent with the rest of the codebase, which invites a copy-paste of the wrong pattern into a genuinely exploitable route.
**New risk:** None — ownership now resolves and compares correctly.

---

## 3. Timing-unsafe Paystack signature comparison

**File:** `lib/payments/paystack.ts` (`PaystackClient.verifyWebhookSignature`)

**Root cause:** Used plain `hash === signature` string comparison, vulnerable in principle to a timing attack. Confirmed dead code (no callers in `app/` or `lib/` — the live webhook path in `app/api/payments/callback/route.ts` already used `timingSafeEqual` independently), but a latent footgun if wired up later.

**Fix:** Replaced with a length check + `crypto.timingSafeEqual` comparison, matching the pattern already used in `app/api/payments/callback/route.ts`.

**Previous risk:** Low (unreachable code path) but high if ever adopted.
**New risk:** None.

---

## 4. WhatsApp webhook fail-open on missing secret

**File:** `app/api/whatsapp/inbound/route.ts`

**Root cause:** If `WHATSAPP_WEBHOOK_SECRET` was unset, the handler logged a warning and skipped signature verification entirely rather than rejecting the request — a misconfiguration would silently disable webhook auth.

**Fix:** Missing secret now returns HTTP 401 immediately (fail closed), matching the pattern in `app/api/payments/callback/route.ts`.

**Previous risk:** Medium — a missing environment variable in production would silently accept unsigned/spoofed WhatsApp payloads.
**New risk:** None — misconfiguration now fails loudly and rejects all inbound traffic until fixed.

---

## 5. Timing-unsafe shared-secret comparisons (cron + admin routes)

**Files:** 14 `app/api/cron/*/route.ts` routes (`jobs/process`, `dlq-requeue`, `friday-generation`, `billing-renewals`, `generate-record-of-work`, `events/dispatch`, `cleanup-users`, `quota-alerts`, `eir-research`, `academy-nudge`, `snapshot-metrics`, `sandbox-reset`, `study-group-challenges`, `term-readiness`, `parent-pulse`) and 3 admin routes (`admin/init`, `admin/cleanup-stats`, `admin/trigger-cleanup`), plus `app/api/feedback/route.ts`'s admin-secret GET check (found during remediation, same category).

**Root cause:** All compared `CRON_SECRET` / `ADMIN_SECRET` values with plain `!==`/`===`, vulnerable in principle to timing attacks.

**Fix:** Added `lib/api/secretCompare.ts` exporting `timingSafeEqualString(a, b)` — a single reusable helper wrapping `crypto.timingSafeEqual` with a length guard and null-safety. Replaced every plain comparison across the 18 affected files with this helper. No duplicated crypto logic.

**Previous risk:** Low in practice (all are server-to-server calls, not user-facing), but inconsistent with the defense-in-depth already applied to the payment and WhatsApp webhooks.
**New risk:** None — all shared-secret checks are now uniformly timing-safe.

---

## 6. Missing Zod validation on write endpoints

**Files:** 30 routes across `app/api/students/create`, `app/api/assessments/create`, `app/api/sow/generate`, `app/api/lesson-plans/generate-week`, `app/api/teacher/assignments`, `app/api/teacher/records-of-work` (+ `[id]`), `app/api/student/submit`, `app/api/student/join-class`, `app/api/admin/activate-user`, `app/api/admin/grant-access`, `app/api/early-access/register`, `app/api/feedback`, `app/api/groups/*` (challenge/join/create), `app/api/academic-clinic/pdf`, `app/api/lesson-plans/reflection-suggestions`, `app/api/lesson-plans/download`, `app/api/lesson-plans/[planId]` (PATCH), `app/api/lesson-plans/[planId]/mark-taught`, `app/api/users/create`, `app/api/tokens/check`, `app/api/tokens/deduct`, `app/api/share/generate`, `app/api/learn/end`, `app/api/payments/verify`, `app/api/payments/mobile-init`, `app/api/teacher/assignments/[id]` (PATCH), `app/api/teacher/assignments/[id]/mark`, `app/api/teacher/profile`, `app/api/teacher/alerts`.

**Root cause:** Request bodies were destructured directly from `await request.json()` with ad-hoc manual field checks (or none), rather than validated against a schema — increasing the risk of unexpected types reaching downstream DB writes and RPC calls.

**Fix:** Added a `z.object(...)` schema per route (or a `z.union` for the one route with a discriminated `action` field — `teacher/alerts`) and replaced manual destructuring with `Schema.safeParse(await req.json())`, returning `apiBadRequest(...)` on failure. Followed the existing project convention already used in `app/api/lesson-plans/generate/route.ts` — no new validation framework introduced.

**Previous risk:** Medium — malformed or type-confused input could reach `.insert()`/`.update()`/RPC calls; several routes accepted objects/arrays without validating shape, and `tokens/check` and `tokens/deduct` already had an equivalent membership check but no formal schema.
**New risk:** Low — all listed routes now reject malformed input before any business logic runs.

---

## 7. Client-supplied `role` trusted for EIR feedback

**File:** `app/api/eir/explain/[recommendationId]/route.ts`

**Root cause:** The `POST` (feedback) handler accepted `role: 'teacher' | 'learner' | 'parent'` directly from the request body and used it verbatim to select which feedback column (`teacher_feedback` / `parent_feedback` / `learner_feedback`) to write — allowing any authenticated caller with access to the recommendation to write into a feedback field with an identity claim not actually theirs (spoofing which stakeholder generated the feedback).

**Fix:** `role` was removed from the request schema. The route now resolves the caller's actual relationship to the recommendation's student server-side, reusing the same authorization primitives already used by the sibling `GET` handler in the same file: `isTeacherOfLearner()` (from `lib/api/middleware.ts`) and a `learners.parent_user_id` match. If neither relationship can be verified, the request is rejected with 403 — there is no verifiable "learner self-report" identity path in the current schema (`learners` is a school registry record, not an auth-linked account), so unverified `role: 'learner'` submissions are no longer accepted.

**Previous risk:** Medium — data-integrity/spoofing issue (feedback attributed to the wrong stakeholder), not a data-access IDOR, but corrupts the explainability audit trail EIR depends on.
**New risk:** None — role is derived, not trusted.

---

## Verification

```
npm run typecheck   → 0 errors
npm run lint        → 0 errors (36 pre-existing warnings, unrelated to this change — React effect/state-in-effect patterns, a11y, unused eslint-disable directives in scripts/)
npm run build       → succeeds, all routes compile
```

Manual re-checks:
- `grep -rn "getSession(" app lib` → no matches (unchanged from audit baseline).
- `grep -rn "!== \`Bearer\|secret !== process.env.CRON_SECRET"` across `app/api` → no remaining plain comparisons; all now route through `timingSafeEqualString`.
- Spot-checked `app/api/teacher/students/[studentId]/compass-topic/route.ts` and `app/api/formative/signal/route.ts` — both now perform the ownership/membership check before any write, consistent with the pattern in `app/api/teacher/classes/[classId]/route.ts`.

---

## Remaining security debt (out of scope for this stage)

- `GET /api/eir/explain/[recommendationId]` relies on `learners.parent_user_id`, a column that does not appear to exist in the audited `supabase/migrations/*.sql` schema for the `learners` table — this predates this remediation and was left unchanged to avoid scope creep into the EIR data model; worth a follow-up schema audit.
- The two platform health endpoints (`app/api/health` and `app/api/platform/health`) remain independent/inconsistent — deferred to Phase 13.3 (observability).
- No generic circuit breaker exists for non-AI external calls (Paystack, WhatsApp) — deferred per Phase 13.3/13.4 scoping decision (infra deemed stable enough for now).
- N+1 query patterns (records-of-work, friday-generation cron, generate-record-of-work cron) identified in the performance audit are unchanged — scoped to Phase 13.2.
- `findReportCardWithSubjects` (`lib/repositories/school.repository.ts`) embeds a `term_subject_summaries` join with no actual foreign-key relationship between the two tables — every call fails with Postgres error `PGRST200`, silently swallowed because the function never checks `error`. `getReportCard`'s `?learnerId&termId` path (`GET /api/core/reports`) has therefore returned `{data: null}` for every request, always, regardless of whether a report card exists. Found during SH-001 (below), proven unrelated to that vulnerability (the ownership check runs strictly before this broken query), and left unfixed per SH-001's explicit "do not fix unrelated findings" scope — a correctness bug, not a security issue, but worth a dedicated fix.

---

## SH-001 — Report Card Broken Object Level Authorization (BOLA/IDOR)

| Field | Value |
|---|---|
| **Date** | 2026-07-15 |
| **Severity** | Critical |
| **Category** | Broken Object Level Authorization (BOLA / IDOR) |
| **Affected** | `GET /api/core/reports` |
| **Status** | Closed |

**Root cause:** `app/api/core/reports/route.ts`'s `GET` handler verified only that the caller belonged to the `schoolId` query parameter (`requireSchoolMembership`) — it never verified that the `learnerId`/`classId` supplied in the same request actually belonged to that school. The underlying repository methods trusted those foreign IDs completely: `findReportCardWithSubjects` filtered only by `learner_id`/`term_id`, and `listClassReportCards` only by `class_id`/`term_id` — neither touched `school_id`. Membership was verified; resource ownership was not.

**Impact:** any authenticated school staff member could read another school's report cards — grades, CBC levels, class rank, learner names — by supplying their own valid `schoolId` alongside a guessed or otherwise-obtained `learnerId`/`classId` belonging to a different school. Cross-school academic-record disclosure.

**Fix:** ownership validation added before report retrieval, in `lib/core/report-cards.ts`. `getReportCard`/`listClassReportCards` now call two pre-existing, already-school-scoped repository methods (`repos.learners.findById`, `repos.teachers.findClassById`) before returning any data — no new repository method was created, and neither of those two repositories was modified, only called. A cross-school or nonexistent resource now fails identically (`404`), so no existence signal leaks across tenants. Full detail: `docs/engineering/implementation-log.md`'s "Security Hotfix SH-001" entry.

**Regression tests:** 12, all passing against real (throwaway) Supabase data — `lib/core/reportCardOwnership.security.test.ts`. Covers same-school access (published and draft reports), cross-school access blocked, nonexistent learner/class blocked, malformed UUID blocked, the parent-facing caller path confirmed unchanged, and report generation confirmed unaffected.

**Previous risk:** Critical — confirmed, live, exploitable cross-tenant academic-record exposure.
**New risk:** None — request rejected before any data is returned if ownership doesn't verify.

## Recommended next work

Proceed to **Phase 13.2 — Performance**: fix the three confirmed N+1 loops, the per-class upsert in `term-readiness`, add the two missing indexes (`monday_panel_cache.teacher_id`, `row_entries.row_id`), and clean up the ~11 stray `select('*')` violations found outside the audited hot paths.

## Suggested commit message

```
security: harden auth, timing-safe secrets, and input validation for beta 🔒

Fixes a real IDOR in formative signal recording, a broken teacher-ownership
check on Compass topic overrides, and a client-trusted role field in EIR
feedback. Adds a shared timing-safe secret comparison helper and applies it
across all cron/admin routes and the dormant Paystack webhook verifier.
Makes the WhatsApp webhook fail closed on missing secret. Adds Zod
validation to ~30 write endpoints that previously trusted raw request
bodies.
```
