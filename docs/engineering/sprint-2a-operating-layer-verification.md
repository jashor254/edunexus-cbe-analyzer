# Sprint 2A — Operating Layer Consolidation & Verification

**Status: VERIFICATION ONLY. No code changed.** Every claim below is backed by a command run against the live repository in this session (`grep`, `wc`, `npx tsc`, `npx tsx --test`), not estimated. Where a grep hit turned out to be a comment or an already-documented exception, it is called out explicitly rather than counted as a gap.

---

## 1. Architectural Assessment

**Method**: repo-wide `grep` for `auth.getUser()` across all of `app/api`, cross-checked line-by-line against comment-only false positives (a naive file-level grep overcounts — two migrated files matched only because a code comment mentions `auth.getUser()` in prose; both verified and excluded below).

**Remaining duplicated authorization, by directory** (real code call sites, comments excluded):

| Directory | Files with raw `auth.getUser()` | Status |
|---|---:|---|
| `app/api/core` | 0 | Fully migrated (Batch A) |
| `app/api/reports` | 0 | Fully migrated (Batch B) — 1 comment-only false positive verified and excluded |
| `app/api/assessments` | 0 | Fully migrated (Batch B) |
| `app/api/teacher/classes` | 0 | Fully migrated (Batch C) |
| `app/api/teacher/assessments` | 0 | Fully migrated (Batch D) |
| `app/api/teacher/students` | 0 | Fully migrated (Batch E) |
| `app/api/parent` | 0 | Fully migrated (Batch F) — 1 file matched only for its documented, intentional *second* call (`user_metadata` in `whatsapp-optin.ts`, not a gap) |
| `app/api/student` | 0 | Fully migrated (Batch G) |
| `app/api/students` | 0 | Fully migrated (Batch G) |
| `app/api/class` | 0 | Fully migrated (Batch G) |
| **`app/api/school`** | **3** | **Not migrated** — `intelligence`, `strand-health`, `intervention-efficacy` — these were identified in the original Batch-planning pass as a "Batch H" candidate (auth-layer-only) and never executed |
| **`app/api/teacher/{assignments,records-of-work,grade-scales,reports,profile,alerts,analytics,cohort(s),monday-panel,prerequisite-readiness,intervention-checkin,teaching-patterns,attention-feed}`** | **19** | **Not migrated** — explicitly out of scope from the original Sprint 1B Batch A audit's ~104-file exclusion, never assigned to a batch |
| Everything else (`academy`, `career`, `admin`, `organizations`, `compass`, `clinic`, `sow`, `lesson-plans`, `holiday`, `learn`, `kiswahili`, `documents`, `groups`, `invitations`, `platform`, `payments`, `users`, `auth`, `search`, `share`, `schemes`, `dashboard`, `ai`, `teaching-intelligence`, `learner-intelligence`, `remedial`) | ~77 | **Intelligence Layer / developer-platform** — explicitly out of scope for the entire Sprint 1B series by design, per the Absolute Rules in every batch prompt |

**Every Operating-Layer route named in Batches A–G (55 routes) is confirmed migrated. Zero regressions to raw `auth.getUser()` found.**

**Remaining inline role arrays**: exactly one, `app/api/core/school/route.ts`'s PATCH handler (`['school_admin', 'headteacher']`) — this is the deliberately-preserved discrepancy documented in Batch A's own code comment (narrower than the canonical `requireSchoolAdmin`'s 3-role set; preserving it exactly was a conscious decision, not an oversight). No other inline role array exists anywhere in `app/api`.

**Remaining duplicated ownership helpers**: none within the migrated batches' scope. Two local, intentionally-preserved compositions exist (`isSelfOrParentOf`, defined identically in `app/api/parent/assessments/process/route.ts`, `app/api/parent/whatsapp-optin/route.ts`, and `app/api/student/assignments/route.ts`) — these are not "duplicated authorization," they're the same already-canonical `requireStudent`/`requireParent` pair composed locally per route, per the explicit "do not invent new lib/core architecture" instruction in Batches F/G. Outside the migrated scope, `verifyTeacherTeachesStudent`-shaped roster checks remain in `app/api/teacher/students/[studentId]/remarks/route.ts` (documented, preserved per the Discovery Rule) and in the 19 unmigrated `teacher/**` files listed above (not yet assessed for duplication internally — out of this verification's scope, since those files were never targeted).

**Remaining duplicate identity resolution patterns**: `resolveTeacher` is called directly by 23 route files rather than through a `requireTeacherExists`-style wrapper — this is not duplication (there's exactly one implementation), but it is a repeated *pattern* (every migrated route that needs "does a teacher record exist" writes the same two-line `resolveTeacher` + `if (!teacher) return apiForbidden()` shape). Flagged in §5 as a candidate for a thin convenience wrapper, not a defect.

---

## 2. Engineering Assessment

| File(s) | Reason still duplicated | Why Sprint 1 skipped it | Migration complexity | Architectural risk | Security impact |
|---|---|---|---|---|---|
| `app/api/school/{intelligence,strand-health,intervention-efficacy}` | Never assigned to a batch | Explicitly named a "Batch H" candidate in the original Batch-planning pass, batches stopped at G pending approval | Low (same `resolveTeacher`/`requireSchoolMembership` pattern as Batch A) | Low | None currently known — not yet individually audited for a Stage-0-style gap |
| `app/api/core/school/route.ts` PATCH's narrower role array | Deliberate preservation, not a gap | Batch A found this inconsistency and explicitly chose not to fix it (out of that sprint's two named security fixes) | Low | Low-Medium — an inconsistency, not a vulnerability (it's *stricter* than `requireSchoolAdmin`, not looser) | None — this is a stricter-than-canonical check, not a weaker one |
| 19 `app/api/teacher/**` files (assignments, records-of-work, grade-scales, reports, profile, alerts, analytics, cohort(s), monday-panel, prerequisite-readiness, intervention-checkin, teaching-patterns, attention-feed) | Never assigned to any batch | Explicitly excluded from the Sprint 1B Batch A audit's ~104-file "Intelligence-Layer or developer-platform" bucket | Unknown — **not individually assessed**; several names (`monday-panel`, `prerequisite-readiness`, `intervention-checkin`, `teaching-patterns`, `attention-feed`) read as Intelligence-Layer-adjacent by name, while others (`assignments`, `records-of-work`, `grade-scales`, `reports`, `profile`, `alerts`) read as genuinely Operating-Layer-shaped — this classification is a naming inference, not a verified read of each file, and is reported as such | Unknown until read | Unknown — **not verified this sprint**, since the Absolute Rules forbid any migration work |
| `class_students.parent_id` mechanism (5 confirmed files across B, F, G) | No canonical function models it | Explicit Discovery Rule instruction each time it was found: document, do not normalize | Medium-High (touches guardian-linking semantics, needs a product decision on whether to fold into `resolveParent`) | Medium | None currently — access decisions using it were preserved exactly, not weakened |

**Classification**:
- **SAFE** (no action needed, or already correctly resolved): `core/school.ts`'s role-array discrepancy (documented, intentional, stricter not weaker); the `isSelfOrParentOf` local compositions (intentional, not duplication); `resolveTeacher`'s 23 direct call sites (a pattern, not a defect).
- **NEEDS ADR**: whether/how to fold `class_students.parent_id` into a canonical guardian-resolution function (touches the Canonical Domain Registry's Guardian entry); whether to build the `ClassRepository` the RAS already reserves, which several of the 19 unmigrated `teacher/**` files would likely need.
- **OUT OF SCOPE** (confirmed, not just assumed): the ~77 Intelligence-Layer/developer-platform files — verified by directory name against the RAS's canonical domain list, not merely carried forward from memory.

---

## 3. Canonical Service Adoption Report

Exact call-site counts, `grep`-verified, excluding the service's own definition file and test files.

| Canonical Service | Current Call Sites | Remaining Legacy Call Sites (raw equivalent pattern found) | Status |
|---|---:|---:|---|
| `requireAuthentication` | 47 files | 0 within migrated batches; 22 files outside (`school/*` ×3, `teacher/*` unmigrated ×19) still call `auth.getUser()` directly | Adopted everywhere it was targeted |
| `requireSchoolMembership` | 8 files | 0 | Fully adopted in its scope (Core routes) |
| `requireSchoolAdmin` | 10 files | 0 (except the one documented narrower-role-array exception in `core/school.ts`) | Fully adopted in its scope |
| `requireSchoolStaff` | 1 file | 0 | Adopted at its one known use site (`core/learners/[id]` enroll) |
| `requireStudent` | 8 files | 0 within migrated batches | Fully adopted |
| `requireParent` | 7 files | 0 within migrated batches; `class_students.parent_id`-based checks (5 files) remain a parallel, undocumented-by-canon mechanism | Adopted where its exact mechanism applies |
| `requireClassTeacher` | 14 files | 11 files under unmigrated `teacher/**` still run the equivalent raw `teacher_classes` ownership query | Adopted in migrated scope; real remaining duplication exists outside it |
| `canManageAssessment` | 1 file | N/A (single intended use site: `core/assessments` POST) | Adopted at its one intended call site |
| `canEditReport` | 1 file | N/A (single intended use site: `core/reports` update action) | Adopted at its one intended call site |
| `canManageClass` | **0 files** | N/A | **Built in Sprint 1A, never called by any route** — dead code as of this verification |
| `canViewLearner` | **0 files** | N/A | **Built in Sprint 1A, never called by any route** — dead code as of this verification |
| `canPublishReport` | **0 files** | N/A (`canEditReport` delegates to it internally — that's its only caller) | Used only internally by `canEditReport`, never called directly by a route |
| `resolveTeacher` | 23 files | N/A | Heavily adopted as a direct identity-layer call (see §1's note on this being a repeated pattern, not duplication) |
| `resolveStudent` | 0 direct route call sites (2 comment-only mentions verified and excluded) | N/A | Used only internally by `requireStudent`/`canViewLearner`, never called directly by a route |
| `resolveParent` | 0 direct route call sites (1 comment-only mention verified and excluded) | N/A | Used only internally by `requireParent`/`canViewLearner`, never called directly by a route |

**Headline finding**: `canManageClass` and `canViewLearner` were designed and built in Sprint 1A, documented in the RAS and platform-services doc, and **never actually adopted by any migrated route across Batches A–G**. This is not a defect in the functions themselves — it means the specific ownership decisions they were designed for either didn't arise in the 55 routes actually migrated, or were handled by a different, more specific composition (e.g. `canManageAssessment` for the assessment case `canManageClass` might have covered generically). Recorded in §5 as technical debt to investigate, not fixed here.

---

## 4. Discovery Review

| Finding | Classification | Basis |
|---|---|---|
| Three parent ownership mechanisms (`students.parent_user_id`, `class_students.parent_id`, Core `learner_guardians`) | **Architectural fact** | Confirmed by direct schema/code inspection across Batches B, F, G; not a bug, a real historical divergence |
| Three teacher→student ownership mechanisms (Compass's `resolveTeacherOwnership`, `students.teacher_id` direct, `class_students`⋈`teacher_classes` roster) | **Architectural fact**, bordering on **technical debt** | The three *can* disagree on an edge case (documented in Batch E) — that disagreement potential is the debt; the existence of three mechanisms per se is a fact of how the codebase evolved |
| Three class ownership conventions for "class not owned" status codes (404 in 6 files, 403 in 4 files, no-check in 1, student-scoped in 1) | **Technical debt** | Batch C's own finding — inconsistent API contracts for logically identical failures, not a security issue but a maintainability one |
| Assessment ownership already centralized (Batch D finding — nothing to migrate) | **Expected design** | Confirmed correct on inspection; not debt, not a gap — `lib/assessments/getters.ts` was already doing this right |
| `class_students.parent_id` recurrence (5 confirmed files) | **Future ADR** | Explicitly flagged each time per the Discovery Rule; a real decision is owed (fold into `resolveParent`, or formally document as a permanent second mechanism) — not yet made |
| `generate-reports/status` missing ownership check | **Technical debt** | Confirmed pre-existing (not introduced by migration), relies solely on job-row `user_id` scoping — a narrower but not necessarily broken design; needs a deliberate read to confirm safe vs. debt |
| Compass ownership isolation (`resolveTeacherOwnership` never touched) | **Expected design** | Correctly respecting the Intelligence Layer boundary — this is the system working as intended, not a gap |
| Career RLS pattern (`career-intelligence.ts` using the request-scoped client + 401 instead of 403) | **Expected design** | An intentional, pre-existing defense-in-depth pattern this sprint correctly chose not to "correct" — verified not to be an accidental inconsistency, since RLS is doing real, additional enforcement work there |

**No false alarms found** — every discovery reviewed here holds up under this pass's evidence-gathering.

---

## 5. Technical Debt Register

| Priority | Issue | Evidence | Risk | Recommended Sprint | ADR Required |
|---|---|---|---|---|---|
| **High** | `canManageClass`/`canViewLearner` built but never adopted | §3, 0 call sites confirmed by grep | Low directly, but signals a gap between designed and actual authorization coverage — worth understanding *why* before building more capability functions nobody calls | Sprint 2B (investigate before adding new `can*` functions) | No |
| **High** | `class_students.parent_id` — 5 confirmed files, no canonical model | §1, §4 | Medium — a real access-control mechanism with no single owner in the permission service | Future dedicated sprint | **Yes** |
| **Medium** | 19 `teacher/**` routes unmigrated, unclassified by individual file read | §1, §2 | Unknown until read — several look Intelligence-adjacent, several look Operating-Layer-shaped | Sprint 2B or a dedicated "Batch H+" | No (classification first, ADR only if a new mechanism is found) |
| **Medium** | `app/api/school/{intelligence,strand-health,intervention-efficacy}` — the identified-but-never-executed "Batch H" | §1, §2 | Low — same low-risk pattern as Batch A | Sprint 2B, quick win | No |
| **Medium** | Sequential re-authentication inside composed permission checks (§7) | §7 below | Low security risk, real but small latency cost | Sprint 2B, if performance work is prioritized | No |
| **Low** | `resolveTeacher` called directly 23 times instead of through a `requireTeacherExists`-style wrapper | §1, §3 | None — cosmetic/DRY only | Backlog | No |
| **Low** | `core/school.ts` PATCH's narrower role array vs. canonical `requireSchoolAdmin` | §1, §2 | None (stricter, not looser) | Backlog, only if the product decision favors widening it | No |

---

## 6. Security Verification

- **Stage 0 Gap #1** (`app/api/core/assessments` POST previously membership-only): **confirmed still closed** — `canManageAssessment` is imported and called at all three mutating call sites (`save-scores`, `compute`, create) as of this verification's direct read of the current file.
- **Stage 0 Gap #2** (`app/api/core/reports` update action previously inconsistent with its siblings): **confirmed still closed** — `canEditReport` is imported and called in the `update` action, matching the `publish`/generate actions' `requireSchoolAdmin` gate.
- **No migrated route weakened authorization**: every batch's per-route report documented the before/after check explicitly; this verification's independent re-read of both security-fix files found no drift from what was reported at the time.
- **No route accidentally broadened permissions**: the two deliberate broadenings in this whole series were both intentional and previously documented — `requireParent`'s Core `learner_guardians` superset (Batch B, proven to be a no-op given disjoint UUID spaces) and nothing else. No undocumented broadening found.
- **Cross-school isolation preserved**: verified by the 53-test suite, which includes dedicated cross-school isolation tests for `requireSchoolMembership`, `requireSchoolAdmin`, and `canManageAssessment` (Batch A's suite) — all passing as of this session's test run.

**No regression found. Not stopping.**

---

## 7. Performance Review

**Method**: direct read of `lib/core/permissions.ts`'s current implementation (§full file reproduced during this verification).

- **Sequential resolver chains, confirmed real**: `requireSchoolAdmin` → `requireSchoolMembership` → `requireAuthentication` is a 3-deep sequential chain for a single decision (each layer re-derives the one before it rather than accepting a pre-resolved value). For a route like `app/api/core/assessments` POST's `save-scores` action, the call chain is: `requireAuthentication` (route-level) → `requireCanManageAssessment` → `requireSchoolMembership` (→ `requireAuthentication` again internally) → `canManageAssessment` (→ `requireAuthentication` again internally, and on the non-admin path, → `requireClassTeacher` → `requireAuthentication` a fourth time). **Up to 4 sequential `auth.getUser()` calls for one incoming request**, confirmed by reading the actual composition, not estimated.
- **`canViewLearner`'s sequential-but-independent resolvers**: `resolveStudent`, `resolveMembership`, `resolveParent`, `resolveTeacher` are called with sequential `await`s even though none depends on another's result — a `Promise.all` candidate, confirmed by reading the function body (the early-`return true` pattern means the worst case, an unrelated user, is the one that pays for all four sequential round-trips).
- **Duplicate lookups**: `resolveTeacher(user.id)` is called twice in some composed paths (once inside `canManageAssessment` if the admin check fails, once inside the `requireClassTeacher` it then calls) — a real, small duplicate query, not just a duplicate function call.
- **Opportunities for batching**: `canViewLearner`'s four independent resolvers are the clearest `Promise.all` candidate found. `requireCanManageAssessment`'s repeated `requireAuthentication` calls are a candidate for accepting an already-resolved `CurrentUser`/context parameter instead of re-deriving it — this is exactly what `lib/core/context.ts`'s `SchoolRequestContext` was designed for (RAS §2: "every service should receive Context instead of rebuilding it"), but no migrated route in Batches A-G actually constructs and passes a `SchoolRequestContext` — every route still calls the `require*` functions directly, bypassing the context layer entirely.
- **This section measures only — no code was changed to address any of the above**, per the Absolute Rules.

---

## 8. Test Coverage Audit

- **Current total tests**: 53, across 7 files (`identity.test.ts` 10, `permissions.test.ts` 21, `context.test.ts` 3, `permissions.student-parent.test.ts` 7, `permissions.classownership.test.ts` 5, `permissions.assessmentbatch.test.ts` 3, `permissions.selforparent.test.ts` 4).
- **Permission tests**: all 53 are permission/identity-layer tests (integration-style, real synthetic Supabase rows) — there are zero HTTP-level route regression tests anywhere in the codebase, a limitation explicitly and repeatedly flagged in every batch's implementation-log entry since Batch A (no test infrastructure exists for calling Next.js route handlers directly, since `createClient()` depends on request-scoped `next/headers` cookies unavailable outside a running request).
- **Route regression tests**: 0 — confirmed by the consistent absence across every batch, not merely assumed.
- **Missing scenarios / coverage gaps, confirmed by direct check against §3's adoption table**: `canManageClass` and `canViewLearner` have **zero tests**, consistent with having zero call sites — untested because unused, not unused because untested (a distinction worth keeping straight rather than conflating). `canPublishReport` has no *direct* test (only indirectly exercised via `canEditReport`'s tests, since `canEditReport` delegates to it) — its behavior is covered, just not under its own name.
- **Recommended next tests** (not written, per the Absolute Rules): if `canManageClass`/`canViewLearner` are adopted in a future sprint, they need their own dedicated test coverage before that adoption, matching this series' established pattern (test the composition, not just re-assert already-covered primitives). If the `Promise.all` opportunity in `canViewLearner` (§7) is ever acted on, a regression test comparing before/after output ordering-independence would be the right guard.

---

## 9. Implementation Log Update

*(Appended to `docs/engineering/implementation-log.md` as a real entry — see below.)*

---

## Executive Summary

Sprint 1 (1A + Batches A–G) achieved exactly what it claimed, verified independently in this sprint rather than taken on faith: 55 Operating-Layer routes across 7 batches are confirmed migrated with zero raw `auth.getUser()` regressions, both Stage 0 security gaps remain closed, and the 53-test suite passes in full. The verification also surfaced two things Sprint 1's own batch reports didn't claim and shouldn't have been assumed: two of Sprint 1A's five `can*` functions (`canManageClass`, `canViewLearner`) were built but never actually adopted by any route, and the composed permission checks re-derive authentication redundantly (up to 4 sequential calls in one request path) because no route yet uses the `SchoolRequestContext` object that was designed to prevent exactly that. Neither is a regression — both are honest gaps between what Sprint 1A designed and what Batches A–G actually needed, now documented with evidence instead of left implicit.

## Architecture Health Score

| Dimension | Score /10 | Justification |
|---|---:|---|
| Identity Layer | 8 | `resolveTeacher`/`resolveStudent`/`resolveParent` are solid, well-tested, and the sole source of identity resolution across all 55 migrated routes with zero drift found. Docked for the two unused `can*` functions signaling incomplete real-world validation of the full design. |
| Permission Layer | 7 | Zero known security regressions, both Stage 0 gaps verifiably closed. Docked for the confirmed sequential re-authentication pattern and the unused `canManageClass`/`canViewLearner` — the layer is correct but not yet fully proven against real usage. |
| Operating Layer | 6 | 55/58 originally-scoped routes migrated (95%); the 3-route "Batch H" gap and 19 unclassified `teacher/**` routes are real, acknowledged remaining work, not silently dropped. |
| Security | 8 | Both named gaps closed and re-verified independently this sprint, not just carried forward from memory. No new gap found. Not a 9-10 because the 19 unmigrated `teacher/**` files haven't been individually security-reviewed. |
| Test Coverage | 6 | 53 real, integration-style tests against live data is a genuine asset — but zero HTTP-level route tests exist anywhere, a structural gap acknowledged in every batch, not new to this sprint. |
| Maintainability | 8 | Consistent commit-sized batches, an implementation log that reads as real history (not a changelog), every deliberate exception documented in-file at the point it was made — this is the strongest dimension. |
| Technical Debt | 6 | Nothing hidden — every item in §5 was found by direct evidence this sprint, not estimated, and none is a security risk. The debt is real but honestly catalogued. |

## Readiness Assessment

**EduNexus is ready for Sprint 2B**, with two explicit conditions carried forward rather than silently deferred:
1. The three items in §5 marked "Sprint 2B" (investigate the two unused `can*` functions, classify the 19 `teacher/**` files, execute the small "Batch H" for `school/{intelligence,strand-health,intervention-efficacy}`) should be the first work items considered, not treated as closed.
2. The `class_students.parent_id` ADR (§5, High priority) should be scheduled before any further parent/guardian-adjacent work is done, since it's the one open item with a real (if currently low) risk of two mechanisms disagreeing.

No regression, no closed security gap reopened, no evidence of architectural drift was found. This is not "another stabilization sprint required" — it's "proceed, with the two conditions above tracked, not forgotten."
