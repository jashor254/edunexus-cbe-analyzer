# Sprint 12 — Release Blocker Remediation: Engineering Investigation

**Status: INVESTIGATION ONLY. No code has been written.** Per this sprint's mandate, this document must be reviewed and approved before any implementation begins. It answers, for each of the 2 Critical + 7 High findings from `docs/architecture/sprint11-release-candidate-audit.md`: what already exists, what can be reused, the smallest correct design, and every required risk/test/rollback dimension.

**Method**: five parallel investigation passes traced the actual reusable code for each blocker (repository methods, existing patterns, schema constraints) rather than proposing designs in the abstract. Every recommendation below cites the exact existing function it reuses.

---

## Cross-Cutting Findings (apply to multiple blockers)

- This codebase has one dominant transaction convention: **sequential, idempotent-retryable steps, no cross-table RPC**, documented explicitly in `lib/core/schoolActivation.ts`'s own header. It is not absolute — `lib/repositories/billing.repository.ts:111` and quiz/variant writes use a Postgres RPC where financial/atomicity stakes justify it. This matters for C2 (Promotion) below.
- This codebase has one dominant "immutability" convention already: **derive lock state from existing `is_published` flags rather than storing a separate lock column** (`generateReportCards()`'s publish-guard, `runEndOfTerm()`'s pre-check, `termStatus.ts`'s client-side derived state). This governs H2 and H6 below — no schema change needed for lock semantics.
- Two separate investigations (H5 and H7) converged on the same root architectural gap: **Projection has no `pathway`/`career` projector type**, which is the actual reason three independent modules (`academicClinic`, `learnerModel`, `clinicReportBuilder`) built their own parallel computation instead of using Projection. This is the single highest-leverage design decision in this sprint.

---

## CRITICAL 1 — Guardian → Parent Account Linking

**Objective**: a guardian recorded via Core Admissions must be able to become an authenticated parent who can see their child, without weakening `requireParent`'s existing authorization guarantee.

**Root Cause**: `learner_guardians.user_id` is hardcoded `null` at insert (`lib/core/learnerOnboarding.ts`, `lib/core/learners.ts`), and no invite/claim mechanism anywhere writes to it. The one working parent-link flow (`app/api/parent/link-student/route.ts`, backed by `student_invites`) is schema-coupled to the **legacy** `students` table (FK `student_invites.student_id → students.id`; the claim handler writes `students.parent_user_id`/`parent_email`/`notification_email` directly) and has no path to Core's `learner_guardians`.

**Architectural Cause**: this is the same Core/legacy dual-schema seam every prior sprint has hit — a real mechanism exists, but it was built before Core existed and is shaped around the legacy table's columns, not a school-agnostic "guardian" concept.

**Existing Architecture (confirmed reusable)**:
- Token/expiry/claim *mechanics*: `student_invites`'s shape (token, `expires_at`, used-check) and `app/api/parent/link-student/route.ts`'s claim sequence (validate not-used/not-expired → check not already claimed by someone else → mark used → set the link column) are a proven, working pattern to copy.
- Delivery: `sendWelcomeMessage()` (`lib/whatsapp/sender.ts`) is real, already wired to fire non-blocking on the legacy admission path, and is the only real delivery channel found in the codebase (teacher invites send nothing at all, by the module's own admission).
- Authorization: `resolveParent()`/`requireParent()`/`canViewLearnerRecord()` (`lib/core/identity.ts`, `lib/core/permissions.ts`) already work correctly off `learner_guardians.user_id` alone — **no change needed to authorization**, only to how that column gets populated.
- Signup: confirmed no auto-matching logic exists (`app/(auth)/signup/page.tsx`) — every claim must be explicit and token-driven, matching the existing pattern, not a new auto-link risk to design around.

**Reusable Components**: `sendWelcomeMessage()` (WhatsApp delivery, unchanged), the claim-sequence *shape* from `link-student/route.ts` (not the code itself — target table differs), `requireParent`/`resolveParent` (zero change), `learner_guardians.phone` (already required NOT NULL — a real delivery target already exists on every guardian row today).

**Proposed Design**:
1. New table `core_guardian_invites` (`school_id`, `learner_guardian_id` FK → `learner_guardians(id)`, `token`, `expires_at`, `used_at`, `created_at`) — a parallel table, not an extension of `student_invites`, because the legacy table's FK and claim-handler are irreducibly coupled to `students`; forcing Core through it means branching the claim handler on which FK is populated, which is more coupling than a small new table.
2. `lib/core/guardianInvites.ts` (new, small): `createGuardianInvite(schoolId, learnerGuardianId)` (mirrors `student_invites` insert), `claimGuardianInvite(userId, token)` (mirrors `link-student`'s validate→claim sequence, but sets `learner_guardians.user_id`, not `students.parent_user_id`).
3. Trigger point: `lib/core/learnerOnboarding.ts`'s `ensureGuardianLinked()` step — after creating the guardian row, call `createGuardianInvite()` and `sendWelcomeMessage()` (reused, unchanged), same automatic-at-admission-time pattern the legacy flow already has.
4. New route `app/api/parent/link-guardian/route.ts` (mirrors `link-student`'s shape) + a claim page reusing `app/(auth)/parent-join/page.tsx`'s pattern (branch on invite type, or a `?type=core` param).

**Security Review**: token must be single-use (mirror `used_at` check), expiring (mirror `expires_at`), and the claim handler must reject if `learner_guardians.user_id` is already set to a *different* user (mirror the existing "already claimed by someone else" check) — prevents a second WhatsApp recipient (e.g. a forwarded message) from hijacking an already-claimed guardian slot. **Attempted break**: a malicious actor guessing/brute-forcing tokens — mitigate with a cryptographically random token (confirm `student_invites.token`'s generation is already secure-random; if so, reuse the same generation utility). **Attempted break**: double-claim race (two concurrent claims of the same unused token) — the claim update should be a single `UPDATE ... WHERE used_at IS NULL` conditional write (matching Postgres's atomic row-update semantics), same protection the legacy flow already relies on implicitly.

**Database Review**: purely additive (`CREATE TABLE`), no existing table altered, no data migration, RLS policy needed on `core_guardian_invites` scoped by `school_id` membership (matching every other Core table's pattern), fully backward compatible, trivially rollback-able (`DROP TABLE`) with zero data-loss risk since it's a transient claim artifact, not a record of institutional truth.

**Integration Review**: `resolveParent()` needs zero changes — it already reads `learner_guardians.user_id` (confirmed). Only the write path (claim) and the trigger (admission) are new. No existing consumer of `student_invites` is touched.

**Risks**: a guardian record with a wrong/unreachable phone number silently never gets claimed (same class of risk the legacy flow already has, not new) — acceptable, matches existing product posture; **Migration Risk: none** (additive only); **Rollback**: drop the new table and remove the two call sites in `learnerOnboarding.ts` — the guardian row itself is unaffected either way.

**Test Strategy**: workflow test creating a guardian → invite → claim as a real authenticated second user → assert `requireParent` now passes for that learner and fails for an unrelated third user; expired-token rejection; already-claimed-by-another-user rejection; double-claim race (two concurrent claim calls, assert only one succeeds).

**Complexity Estimate**: Medium (one new table, one new small lib module, one new route, one UI touch-point, WhatsApp delivery reused unchanged).

**Recommendation**: build the parallel table + reused-pattern claim flow. **Why simplest long-term**: keeps Core's schema self-contained (matching this codebase's existing "Core never inherits legacy FK shape" discipline) without duplicating the token/claim *logic* — only the table and its two thin functions are new; delivery and authorization are 100% reused.

---

## CRITICAL 2 — Promotion Re-enrollment

**Objective**: `runAnnualPromotion()` must leave the database in a consistent state — no dangling old enrollment, a real new enrollment for a promotion, a correctly terminal state for a graduation.

**Root Cause**: `runAnnualPromotion()` only calls `repos.learners.insertPromotion()` (an audit-log insert) and, for graduation only, `updateStatusById()`. It never calls any enrollment-mutating repository method. Compounding this: the live UI (`app/teacher/core-office/academic/promotion/page.tsx`) never collects a destination class at all — every decision submitted today has `to_class_id: undefined`.

**Existing Architecture (confirmed reusable, zero new repository methods needed)**:
- `repos.learners.withdrawActiveEnrollments(learnerId, status)` — already exists, already used identically by `transferLearner()` for the exact "close out the old enrollment" step.
- `lib/core/learners.ts`'s `enrollLearner()` — a thin, side-effect-free wrapper over `repos.learners.upsertEnrollment()`, confirmed NOT entangled with onboarding-specific logic (guardian creation is a separate step) — safe to call directly from Promotion.
- `repos.learners.findActiveEnrollmentClass()` — already used by `runAnnualPromotion()` to find the *old* class; no change needed.

**Reusable Components**: `withdrawActiveEnrollments`, `enrollLearner`, `insertPromotion`, `updateStatusById` — **all four already exist**; this fix calls existing functions in a corrected order, adding zero new repository code.

**Proposed Design**:
- **'promoted' decision**: (1) resolve `fromClassId` (existing call, unchanged) → (2) **validate `to_class_id` and `to_academic_year_id` are present**; if either is missing, push a per-learner error into the existing `errors[]` array rather than silently logging an incomplete promotion (matches the function's existing per-decision error-isolation pattern) → (3) resolve a `term_id` for the destination year (none exists on the decision type today — resolve via the destination year's term 1, mirroring `schoolActivation.ts`'s own term-creation convention) → (4) `insertPromotion()` (existing, unchanged) → (5) `withdrawActiveEnrollments(learner_id, 'withdrawn')` (reused from `transfers.ts`, using a status value distinct from `transferLearner`'s `'transferred'`) → (6) `enrollLearner({...to_class_id, term_id, to_academic_year_id})` (reused).
- **'graduated' decision**: (1), (4) as above, then `updateStatusById(..., {status:'graduated', graduation_date})` (existing, unchanged) **plus** `withdrawActiveEnrollments(learner_id, 'withdrawn')` (currently missing entirely — graduation leaves the old enrollment dangling today too, confirmed by investigation) — no new enrollment created, correctly terminal.
- **UI change required, not optional**: `promotion/page.tsx` must be extended to collect a destination class per learner (a `<select>` populated from the destination year's classes, same pattern already used throughout this page and `structure/page.tsx`) — the backend fix is meaningless if the UI still never sends `to_class_id`.

**Security Review**: **concurrent promotion** — two admins submitting overlapping promotion batches for the same learner: `upsertEnrollment`'s `UNIQUE(learner_id, term_id)` constraint makes the *enroll* step naturally idempotent (a second attempt upserts the same row rather than duplicating), but `insertPromotion` has **no** uniqueness guard (confirmed: no unique constraint on `learner_promotions`) — a double-submit still creates duplicate audit-log rows even after this fix. **Recommend as an in-scope companion fix**: a defensive existence-check before insert (same idiom already used by `onboardLearner`/`schoolActivation.ts` — "check then create," not a schema constraint, matching this codebase's established pattern) to reject a duplicate promotion for the same learner+academic_year. **Cross-school**: unaffected — `requireSchoolAdmin` already gates the whole route, unchanged.

**Database Review**: no schema change required for the core fix (all reused methods already exist against existing columns). The companion duplicate-guard is application-level (a pre-insert read), not a migration. `learner_enrollments`' `UNIQUE(learner_id, term_id)` is confirmed to make the new-enrollment step safe to retry. No RLS change (writes still go through the same admin-gated route). Fully backward compatible — no existing row's meaning changes; only new promotions get correct behavior. Historical integrity: prior (broken) promotions remain as an honest historical record of "this happened before the fix" — no backfill recommended (backfilling would require guessing intended destination classes for past decisions, itself risky and out of scope).

**Integration Review**: `previewPromotion()` is untouched by this fix (Finding H4 below extends it separately). `transferLearner()` is unaffected — it already does its own, correct withdraw. No other consumer of `learner_promotions`/`learner_enrollments` found that assumes today's broken behavior (confirmed: `to_class_id` is currently read only for history display, never as "current enrollment" — so no downstream code relies on the gap persisting).

**Risks**: the UI change (collecting destination class) is unavoidable scope, not optional — flagging this so it isn't descoped as "just a lib fix." **Migration Risk**: none. **Rollback**: revert the three added calls in `runAnnualPromotion` and the UI addition independently; the existing `lib/core/promotions.reenrollmentGap.test.ts` regression test is the acceptance gate — it is *designed* to fail once this fix lands, which is the correct signal to update it to assert the new, correct enrollment state.

**Test Strategy**: happy path (promoted learner has exactly one active enrollment, in the new class, old one withdrawn); graduation path (no active enrollment anywhere, `learners.status = 'graduated'`); missing-`to_class_id` decision reported as an error, not silently logged; concurrent double-submit of the same batch (duplicate-guard test); the existing regression test updated to assert correct behavior once implemented.

**Complexity Estimate**: Medium (lib change is small and reuses existing methods; UI change to collect destination class is the larger piece of work; duplicate-guard is a small companion fix).

**Recommendation**: implement exactly the reuse-based design above; treat the UI destination-class picker as in-scope, not follow-up; add the duplicate-promotion guard as a small companion fix within this same blocker, since Critical 2 is explicitly about "no duplicated enrollment." **Why simplest long-term**: zero new repository methods, reuses the exact function `transferLearner` already proved correct for the withdraw half.

---

## HIGH 1 — Current Academic Term

**Objective**: every freshly-activated school must have a current term set automatically, and an admin must be able to change it later without re-running activation.

**Root Cause**: `ensureAcademicYear`/`ensureDefaultTerms` (`lib/core/schoolActivation.ts`) never call the existing `setCurrentAcademicYear`/`setCurrentTerm` functions. The fix route (`POST /api/core/academic-years`, `type: 'set-current-term'`) already exists and is already `requireSchoolAdmin`-gated — it simply has no UI caller.

**Existing Architecture (confirmed reusable)**: `setCurrentAcademicYear()`/`setCurrentTerm()` (`lib/core/school.ts`) are real, working, unconditional clear-then-set functions, already used correctly elsewhere (`runEndOfTerm()` advances the term this same way at term-close). The API route is complete and correctly authorized.

**Proposed Design**:
1. In `activateSchool()` (`lib/core/schoolActivation.ts`), after `ensureDefaultTerms` returns its terms, **guard on absence** — call `getCurrentTerm(schoolId)`; only if `null`, call `setCurrentAcademicYear` + `setCurrentTerm(terms[0])` (sorted by `term_number`). The guard is essential: because the setters are unconditional clear-then-set, an unguarded call inside an idempotent, re-runnable activation pipeline would silently reset an already-progressed school (now correctly in Term 2 via `runEndOfTerm`) back to Term 1 on any re-run of activation. This is a ~6-line, additive change.
2. UI: add a "Set current term" control to `academic/page.tsx`'s existing Terms row (currently static text), reusing the exact `<select>` + `fetchJson(POST)` + loading/error/notice pattern already used for class/stream creation in `structure/page.tsx` — no new UI pattern invented.

**Security Review**: the route is already `requireSchoolAdmin`-gated; no new authorization surface. **Attempted break**: a non-admin calling the route directly — already rejected today, unchanged. **Concurrent**: two admins setting different terms current simultaneously — last-write-wins via the existing clear-then-set semantics, an acceptable, pre-existing behavior (matches how `runEndOfTerm` already behaves), not a new risk introduced by this fix.

**Database Review**: zero schema change. No migration. Fully backward compatible — the guard means schools that already have a current term (e.g. seeded via the reference-school fixture) are provably unaffected. Rollback: remove the guarded call from `schoolActivation.ts`; the UI addition is independently revertible.

**Integration Review**: `app/api/core/my-membership/route.ts`'s `findCurrentTerm` becomes newly satisfiable for fresh schools — every downstream Core Administration screen that gates on `membership.currentTerm` (Structure, Admissions, Promotion, Transfer, core-term) starts working immediately with no changes to any of them.

**Risks**: low — the guard eliminates the only real risk (accidental reset). **Migration Risk**: none. **Rollback**: trivial, two independent small diffs.

**Test Strategy**: fresh school activation results in a real current term (integration test, extends existing `schoolActivation.test.ts`); re-running `activateSchool()` on an already-progressed school (current term manually advanced) does NOT reset it back to term 1 (the specific regression this guard exists to prevent); UI control correctly posts and refreshes membership state.

**Complexity Estimate**: Low.

**Recommendation**: implement as designed — smallest possible diff, directly closes the single largest Sprint 10 UI dead-end. **Why simplest long-term**: reuses 100% of existing functions; the only genuinely new code is the idempotency guard itself.

---

## HIGH 2 — Assessment Lock Integrity, and HIGH 6 — Term Lock (investigated together — same design)

**Objective**: define one coherent, platform-wide meaning for "locked," and enforce it at the one place it's currently missing (`saveScores()`), without inventing a second lock concept.

**Root Cause**: `saveScores()` (`lib/core/assessments.ts`) never checks `is_published` before writing — "Lock Assessment" is a UI promise the backend doesn't keep. Separately, no term-level lock concept exists at all in schema or code.

**Existing Architecture (confirmed reusable — this codebase already has a lock precedent, just not applied everywhere)**: `generateReportCards()`'s publish-guard (refuses to regenerate over a published report card) and `runEndOfTerm()`'s pre-check (refuses to proceed unless every assessment in the class/term is published) are both **derived** checks — computed from existing `is_published` flags via a count query, not backed by a separate stored lock column. `termStatus.ts`'s client-side "locked" state is likewise fully derived.

**Proposed Design**:
- **Do not add a `terms.is_locked` column.** Define "term locked" as a derived predicate: every assessment in the term has `is_published = true` AND report cards for the term are published — computable as one or two single-table count queries, matching the existing `runEndOfTerm` check's cost class (not a per-class loop).
- Add exactly one new guard, in exactly one place: `saveScores()` (`lib/core/assessments.ts`) — before delegating to the repository, check the assessment's own `is_published` flag (already available on the row being saved against — cheaper than a term-wide check) and throw if true, reusing the same "refuse, do not silently overwrite" posture as the report-cards guard.
- A second, cheap guard at `recordAssessmentEvidence()` (`lib/assessments/evidence.ts`) — it already fetches the assessment row, so checking `is_published` there is a zero-new-query addition, closing the "Evidence written into an already-closed term" gap.
- **Explicitly do NOT add a guard inside `recomputeLearnerProjection()`.** Investigation confirmed this function takes only a `learnerId`, recomputes over a learner's whole evidence history by design, and has no term parameter to filter on — adding one would be a real refactor threading a new parameter through every caller, not a "one new guard" fix. The upstream guards (assessment save, evidence write) are sufficient to prevent locked-term evidence from ever being produced in the first place; Projection itself does not need to re-defend against data that can no longer be created.
- **What becomes immutable, stated explicitly** (per the brief's own question): Assessments (via the new `saveScores` guard) and Report Cards (via the existing publish-guard) become immutable once locked. Evidence becomes immutable-by-prevention (can't be newly written for a locked assessment). Promotion and Attendance are explicitly **not** locked by this change — Promotion is inherently a new-term operation that must remain possible after a term closes, and Attendance's existing per-session edit/delete path is a legitimate mistake-correction feature (per the Sprint 11 operational audit, "acceptable, no finding") that this sprint should not remove.

**Security Review**: the new guard is a read-then-conditionally-write pattern — **attempted break**: a race between a "publish assessment" call and a "save scores" call for the same assessment. Recommend the same defensive posture the report-cards guard already uses (check-then-write, accepting a narrow theoretical race window as an acceptable, pre-existing class of risk in this codebase, not a new one this fix introduces). No new authorization surface — the guard fires inside functions already reached only through existing, correctly-gated routes.

**Database Review**: zero schema change (fully derived, per design above). No migration, no RLS impact, no index changes needed (the guard queries reuse existing `idx`-backed columns). Fully backward compatible. Rollback: remove the two guard checks; no data was ever shaped differently.

**Integration Review**: `app/teacher/core-term/page.tsx`'s "Lock" button now actually does what it already claims — no UI change required there, only a backend behavior correction. Any teacher workflow that currently (incorrectly) edits marks after locking will start receiving a clear rejection instead of a silent overwrite — recommend a specific, honest error message surfaced through the existing error-banner pattern already used throughout Core Administration pages.

**Risks**: a teacher who legitimately needs to correct a mark after locking has no path except an admin manually un-publishing the assessment first (same recovery shape `generateReportCards`' guard already implies — "unpublish first if regeneration is intended") — acceptable, matches existing precedent, not a new gap.

**Test Strategy**: `saveScores()` rejected once the assessment is published (happy/failure path); `recordAssessmentEvidence()` rejected the same way; existing unlocked-assessment save behavior unchanged (regression); concurrent publish+save race documented as an accepted, pre-existing risk class, not newly tested beyond what the existing report-cards guard is tested for today.

**Complexity Estimate**: Low.

**Recommendation**: implement both guards as designed; explicitly do not touch Projection. **Why simplest long-term**: zero schema change, reuses an already-proven-correct pattern (report-cards publish-guard) verbatim in two new places, and explicitly draws the line at Projection rather than chasing lock-correctness into a module not designed for it.

---

## HIGH 3 — Zero-Mark Report Cards

**Objective**: a learner with zero real marks must never receive a fabricated grade on a report card.

**Root Cause**: `generateReportCards()` (`lib/core/report-cards.ts:111`) computes `avg = 0` for a learner with an empty scores array, then stores and publishes that as a real `overall_score: 0` / `overall_cbc_level: 'BE'` — directly contradicting the same file's own already-correct null-based "no data" pattern used a few lines above for attendance (`toReportCardAttendance()`).

**Existing Architecture (confirmed — this is a pure code-only fix)**:
- `types/core.ts`: `overall_score: number | null` and `overall_cbc_level: CbcLevel | null` — **already nullable in the type.**
- `supabase/migrations/20260629_core_foundation.sql`: neither column is `NOT NULL` — **already nullable in the database.**
- **No migration is needed.** This is the rare finding where the fix is entirely inside one function.

**Proposed Design**: in `generateReportCards()`, when a learner's aggregated `scores` array is empty, store `overall_score: null` and `overall_cbc_level: null` instead of computing from a fabricated `avg = 0`. Continue using `avg = 0` **internally, only** for `computeRankings()`'s position-in-class calculation (confirmed: `computeRankings()` is never fed the stored `overall_score` field directly — it receives the locally-computed `avg` — so this dual treatment requires no change to the ranking engine and preserves the already-correct, already-documented Sprint 3D behavior that zero-score learners tie for last place).

**Reusable Components**: `toReportCardAttendance()`'s exact null-return idiom, copied for the score/level fields — genuinely zero new abstraction.

**Consumer check (confirmed safe)**: the one real UI consumer (`app/(parent)/report-card/page.tsx`) already does `report.overall_score ?? '—'` and `report.overall_cbc_level ?? '—'` — **already null-safe, requires no change.** One apparent hit (`app/dashboard/clinic/page.tsx`) was confirmed to be an unrelated type (`CareerClinicReport`, not `SchoolReportCard`) — a false positive, not a real consumer.

**Security Review**: none — this is a pure data-correctness fix with no authorization surface.

**Database Review**: zero migration. No RLS impact. No index impact. Fully backward compatible — existing published report cards with a real `0`/`BE` from a genuinely zero-scoring learner (as opposed to a no-data learner) are unaffected, since this fix only changes the *no-summaries* branch, not the *genuinely-scored-zero* branch (these are different learners in different code paths — a learner who sat an assessment and scored 0 keeps a real, honest `0`/`BE`; only a learner with *no summaries at all* gets `null`). Rollback: revert the one function.

**Integration Review**: no other module found reading these fields besides the already-null-safe parent UI and test fixtures (which use non-null data and are unaffected).

**Risks**: none identified beyond the standard "small behavior change to a generation function" risk, mitigated by the existing publish-guard already preventing regeneration over a *published* card (so this fix only affects newly-generated cards going forward, never silently rewrites a historical published one).

**Test Strategy**: a class with one zero-mark learner and one real-scores learner — assert the zero-mark learner's stored `overall_score`/`overall_cbc_level` are `null`, the real learner's are unaffected, and ranking position is still computed correctly for both (regression against the existing Sprint 3D tie-handling test).

**Complexity Estimate**: Low (smallest blocker in this entire sprint).

**Recommendation**: implement immediately as designed. **Why simplest long-term**: literally copies an already-correct pattern that exists three lines away in the same file — there is no simpler fix available.

---

## HIGH 4 — Promotion Evidence Gate

**Objective**: an admin promoting a class with incomplete academic evidence should see a clear warning, but must remain able to proceed — schools may legitimately promote without complete data.

**Root Cause**: `previewPromotion()` derives its suggestion from grade level alone; zero reference to report cards or assessment completeness anywhere in the function.

**Existing Architecture (confirmed reusable)**: `repos.schools.listClassReportCards(classId, termId)` (wrapped by `lib/core/report-cards.ts`) is an existing, single, batched read — exactly the shape needed to answer "how many learners in this class have a generated report card."

**Proposed Design**: extend `previewPromotion(schoolId, academicYearId, termId)` — **note: this requires adding a `termId` parameter**, since the existing year-scoped enrollment read has no term context and the report-card read function requires one. The UI already has a term in hand (`Membership.currentTerm`) to supply it. For each distinct class in the preview response, call `listClassReportCards` once (batched per class, not per learner) and annotate each learner row with a `hasReportCard: boolean` field — a pure additive read composed into the existing response shape, zero new write logic, zero new business rule beyond "does a report card exist."

**UI**: `promotion/page.tsx` has no existing warning-badge pattern to copy verbatim, but does have a reusable `AlertCircle`-based inline message pattern already used for its error banner — apply the same icon/style per-row, non-blocking (never disables the row's decision `<select>` or the submit button), directly satisfying "warn, don't block."

**Security Review**: none — this is an additional read behind an already-`requireSchoolAdmin`-gated route; no new authorization surface, no write path added.

**Database Review**: zero schema change, zero migration. The added read reuses an existing, already-indexed query path (`listClassReportCards` is already used elsewhere at this exact cost).

**Integration Review**: the `previewPromotion` signature change (adding `termId`) has exactly one caller today (`app/api/core/promotions/route.ts`'s GET handler) and one UI caller — both need the one-parameter addition threaded through; confirmed no other consumer exists.

**Risks**: low — a class with many report cards will do one extra batched query per distinct class in the preview, not per learner; acceptable cost, matches the existing performance profile of this page.

**Test Strategy**: a class with a mix of learners with/without report cards — assert the preview response correctly flags each; assert the promotion can still be submitted and processed for a flagged (incomplete-evidence) learner, confirming "warn, never block" holds at the API level, not just the UI.

**Complexity Estimate**: Low-Medium (the signature change touches two call sites; the read itself is trivial).

**Recommendation**: implement as designed. **Why simplest long-term**: a single additive read composed into an existing response, no new table, no new business rule — the flexibility the brief explicitly asks for ("support both") falls out naturally from making this a warning rather than a gate.

---

## HIGH 5 — Academic Clinic / Blueprint Divergence, and HIGH 7 — Student Dashboard Projection Violation (investigated together — one consolidation plan)

**Objective**: identify every place a learner's academic level/capability is computed independently of `recomputeLearnerProjection()`, and produce a plan that retires duplicates by reading Projection instead — without forcing genuinely different concerns (raw score display, Gradebook) into Projection where they don't belong.

**Root Cause**: no single cause — three independent modules (`lib/academicClinic/*`, `lib/learnerModel/updater.ts`, `app/api/student/home/route.ts`) each computed their own version of "how is this learner doing" because **Projection has no `pathway`/`career`-shaped projector type** — the one genuine capability gap that explains why duplication happened in the first place, distinct from the parts that are duplication for no reason at all.

**Full inventory** (file:line, category — (a) trivially replaceable now, (b) needs a new projector type first, (c) legitimately out of scope):

| Computation | Category |
|---|---|
| `app/api/student/home/route.ts` `computeFRS()` — Dashboard's "Future Readiness Score" | **(a)** — linear transform of levels `academic`/`capability` already hold |
| `lib/career/autoReportGenerator.ts`'s `generateCompassBridge()` raw-average gate | **(a)** — also a two-truths bug independent of Projection (disagrees with `student_learning_context.overall_tier` in the same function) |
| `lib/academicClinic/assessmentPipeline.ts`'s subject-tier classification | **(a)** — `classifyGroup` (already used correctly by `lib/remedial/planner.ts`) is the canonical replacement |
| `lib/academicClinic/assessmentPipeline.ts`'s pathway affinity / career-tier | **(b)** — no equivalent projector exists yet |
| `lib/learnerModel/updater.ts`'s `refreshPathwayReadiness()` | **(b)** — same gap, writes to `learner_profiles` (the exact table CLAUDE.md forbids reading directly — here it's the *write* side of the same problem) |
| `lib/learnerModel/updater.ts`'s `refreshCareerSignals()` | **(b)**, but likely foldable into the existing `capability` projector rather than needing a brand-new type |
| `lib/career/clinicReportBuilder.ts`'s pathway/KJSEA calls | **(b)** — same gap, third independent call site |
| `lib/academicClinic/careerEngine.ts` | **(c)** — already self-documented in-file as a known, deferred duplicate of the real canonical engine (`lib/career/capabilityMatchEngine.ts`); already triaged by a prior sprint, not new to this investigation |
| `lib/ai/ragContext.ts`'s narrative level summary (CBC branch) | **(a)** — Projection already covers this; IGCSE branch stays **(c)**-adjacent (Projection is CBC-level-based, no IGCSE equivalent yet — a real, separate future gap, not this sprint's scope) |
| Display-only components (`app/academic-clinic/page.tsx`, `app/dashboard/clinic/page.tsx` badges) | **(c)** — render upstream output, not independent computations |

**Confirmed already correct, no action needed**: `lib/remedial/planner.ts`, `lib/attentionFeed/panel.ts`, `lib/career/careerEngine.ts` (the `lib/career/` one — not to be confused with the duplicate `lib/academicClinic/careerEngine.ts` above), `lib/ai/educationalContext.ts` — all already read Projection correctly.

**Proposed Design (phased, not one change)**:
- **Phase 1 (this sprint, no new projector type needed)**: replace `computeFRS()` and `generateCompassBridge()`'s raw-average gate with reads of the existing `academic`/`capability` projections. This alone closes HIGH 7 completely and removes one of the two "two truths in one function" bugs found along the way.
- **Phase 2 (design a new `pathway` projector type — recommend as its own follow-up design pass, not squeezed into this remediation sprint)**: one new projector type (STEM/Social/Arts/Technical readiness), mirroring `refreshPathwayReadiness()`'s existing weighting logic as the reference implementation, would retire three independent call sites at once (`academicClinic`'s pathway affinity, `learnerModel`'s `refreshPathwayReadiness`, `clinicReportBuilder`'s pathway calls) — the single highest-leverage change in the whole inventory, but a genuine design decision (what the projector's inputs/confidence model should be), not a mechanical fix, and should not be rushed inside a "blocker remediation" sprint.
- **Phase 3 (explicitly leave alone)**: `lib/academicClinic/careerEngine.ts` (already triaged by a prior sprint as a larger, separate migration), all display-only components, and the IGCSE gap in `ragContext.ts` (a distinct future scope, not a duplicate-of-something-that-exists).

**Security Review**: none — this is a read-source consolidation with no new authorization surface anywhere in the affected files.

**Database Review**: Phase 1 requires no schema change. Phase 2 (explicitly deferred) would require a new `learner_projections` row shape for the new projector type — out of scope for this investigation's database review since it is not being implemented this sprint.

**Integration Review**: Phase 1's two replacements are read-only swaps inside existing functions — callers of `app/api/student/home/route.ts` and `generateCompassBridge()` see the same response shape, different (correct, Projection-sourced) values. No consumer contract changes.

**Risks**: Phase 1 changes the actual numeric values students see on their Dashboard (from an independently-computed FRS to a Projection-derived one) — recommend a brief, explicit product sign-off that the new number is expected to differ from historical FRS values, so this isn't mistaken for a regression when observed in production.

**Test Strategy**: Phase 1 — a learner with known Evidence/Projection state, assert `computeFRS`'s replacement matches the Projection-derived value exactly (not just "is present"); assert `generateCompassBridge()`'s starting-difficulty decision now agrees with `student_learning_context.overall_tier` instead of disagreeing (closes the two-truths bug as a testable assertion, not just a narrative claim).

**Complexity Estimate**: Phase 1 — Low. Phase 2 — Architectural (correctly out of this sprint per its own scope rules).

**Recommendation**: implement Phase 1 only in this sprint; explicitly recommend Phase 2 as its own follow-up design sprint (a `pathway` Projector Type ADR), not attempted here. **Why simplest long-term**: Phase 1 requires zero new abstractions and closes the literal CLAUDE.md violation (HIGH 7) completely; Phase 2 is real, valuable, architecturally correct work that would be rushed and under-designed if forced into a remediation sprint whose own mandate says "never redesign an existing subsystem unless absolutely required" — a new projector type is exactly the kind of decision that deserves its own investigation, not a rider on this one.

---

## Cross-Cutting Security Review (attempted breaks, summarized)

| Attack | Result |
|---|---|
| Privilege escalation on any new/changed route | Not found — every design above reuses existing `requireSchoolAdmin`/`requireParent` gates unchanged; none introduce a new authorization decision |
| Cross-school access | Not found — every write remains scoped through existing school-membership resolution |
| Cross-parent access | Not applicable to any design here except C1, where the new claim flow's single-use/expiry/already-claimed checks directly prevent it (mirrors the legacy flow's proven checks) |
| Cross-teacher access | Not affected by any design in this sprint |
| Replay | C1's token is single-use by design (mirrors existing pattern); no other design introduces a replayable action |
| Duplicate promotion | Explicitly found as a real, currently-unguarded gap (Critical 2's security review) — recommended as an in-scope companion fix, not deferred |
| Double invitation | C1's design must check for an existing unclaimed invite before creating a second one for the same guardian (mirror `student_invites`' idempotent-invite precedent — teacher invite flow already does this correctly, reuse that check) |
| Expired invitation | C1's design explicitly checks `expires_at`, mirroring the existing legacy flow |
| Race conditions (concurrent promotion, concurrent report generation, concurrent enrollment) | Concurrent promotion: covered by the duplicate-guard recommendation above. Concurrent report generation: already protected by the existing publish-guard (unchanged by this sprint). Concurrent enrollment: `UNIQUE(learner_id, term_id)` already makes `enrollLearner` naturally idempotent under a race. |

---

## Cross-Cutting Database Review

No blocker in this investigation requires a destructive migration. Summary by blocker:
- **C1**: one new additive table (`core_guardian_invites`) — no existing table altered.
- **C2**: zero schema change.
- **H1**: zero schema change.
- **H2/H6**: zero schema change (lock is derived, not stored).
- **H3**: zero schema change — columns are already nullable in both type and DB.
- **H4**: zero schema change.
- **H5/H7 Phase 1**: zero schema change. Phase 2 (deferred) would need a new projection row shape — not scoped here.

No RLS policy requires modification except C1's new table (net-new policy, same pattern as every other Core table). No index is removed anywhere. No constraint is loosened anywhere. Historical data integrity is preserved in every design — none of these fixes backfill or rewrite existing rows; all apply going forward only, with the single exception of H3, which is also forward-only by explicit design (never touches an already-published report card).

---

## Recommended Sprint Sequencing

Given the "smallest correct change" principle and that this is explicitly not a feature sprint, recommend splitting implementation (a future sprint, after this investigation is approved) into three waves, not one:

**Wave 1 (smallest, highest-confidence, do first)**: H3 (zero-mark reports — single function, zero migration), H1 (current term — six-line guard + one UI control), H7/H5-Phase-1 (Dashboard Projection swap — read-source change only).

**Wave 2 (medium, reuses existing methods but touches more surface)**: C2 (Promotion re-enrollment — lib + required UI change + duplicate-guard), H2/H6 (lock integrity — two new guards, one shared derived-lock concept), H4 (Promotion evidence gate — signature change + UI warning).

**Wave 3 (new schema, most new code, do last)**: C1 (Guardian→Parent linking — one new table, one new small module, one new route).

**Explicitly deferred, not part of any wave**: H5/H7 Phase 2 (new `pathway` projector type) — recommended as its own future design sprint with its own investigation, per this document's own "never redesign unless absolutely required" instruction.

This document is the deliverable for Sprint 12. No implementation should begin until it is reviewed.
