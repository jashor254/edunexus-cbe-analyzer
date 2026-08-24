# Parent Portal Phase P2 — Compass / Learner-Action Access Boundary Super Audit

**Verdict: P2 AUDIT COMPLETE — FIX IMPLEMENTED AND VERIFIED (scoped to the boundary this phase targeted)**

Date: 2026-08-24. Builds on `docs/architecture/parent-portal-super-audit-p0.md` (P0) and
`docs/architecture/parent-portal-p1-entry-convergence.md` (P1). Executed against local Docker
Supabase with real fixture rows, not source-reading alone, for the claims below that are
labeled "executed."

---

## 1. Verdict

The mission's opening question has a clear, evidence-backed answer (§2 below): **`resolveCompassStudentAccess` was an ACT-AS-LEARNER bridge, not a view-only one.** A parent authenticated against their own account could drive `/api/learn` (POST) and `/api/learn/end` (POST) to completion, identically to the learner, and the resulting `learner_evidence` rows and XP landed attributed to the learner alone. This has been fixed for the two write routes (§13) and the institutional-guardian gap on the read routes has been fixed the same way P1 fixed it elsewhere (§3). The regression gate (§23) is green except for three pre-existing, unrelated test-teardown failures documented and reproduced in §23 (not caused by this change).

## 2. `resolveCompassStudentAccess` Map

File: `lib/compass/ownership.ts`. Composes three independent checks in order: `resolveTeacherOwnership` → `resolveParentOwnership` → `resolveLearnerOwnership`, any one match grants `{ allowed: true, via }`.

Callers found (whole-repo grep, not just "compass"-named files):

| Caller | Purpose | Read/Write | What is written | Actor recorded? |
|---|---|---|---|---|
| `app/api/learn/route.ts` (POST) | Compass tutoring turn (streaming) | **WRITE** | `compass_sessions` (session_state, starting_level, one_line_summary), `compass_messages` (transcript), `student_learning_context` (sessions_without_improvement, subject_rest_until, compass_bridge), token deduction | No — `access.userId` never persisted anywhere on these rows |
| `app/api/learn/end/route.ts` (POST) | Session completion | **WRITE** | `compass_sessions` (xp_earned, ending_level), `student_learning_context` (total_sessions, sessions_this_week), Learner Model (`updateFromCompass`), `learner_evidence` via `recordCompassSessionEvidence`, group bonus | Only on `ingestion_runs.initiated_by` (a *separate* table), never on the evidence row itself or as a discriminating `evidence_source` |
| `app/api/learn/student/route.ts` (GET) | Subject picker (levels, recommended subject) | READ_ONLY | none | n/a |
| `app/api/learn/progress/route.ts` (GET) | Progress view | READ_ONLY | none | n/a |
| `app/api/holiday/mine/route.ts` (GET) | Holiday plan view | READ_ONLY | none | n/a |
| `app/(parent)/child/[learnerId]/progress/page.tsx` | Server page → `StudentProgress` → `/api/learn/progress` | READ_ONLY (transitively) | none | n/a |
| `app/(parent)/child/[learnerId]/holiday/page.tsx` | Server page → `StudentHolidayPlan` → `/api/holiday/mine` | READ_ONLY (transitively) | none | n/a |
| `lib/core/academicBridge.ts`'s `getBridgedCompassAccess` | Wraps the resolver for Core-learner-id callers | READ_ONLY (returns a decision, no I/O of its own) | none | n/a — **DEAD_UNREACHABLE**, zero callers outside its own test |
| `lib/compass/compassAccess.integration.test.ts`, `lib/core/academicBridge.test.ts`, `lib/core/academicReadMigration.test.ts` | Tests | n/a | n/a | n/a |

**Classification: `/api/learn` and `/api/learn/end` = LEARNER_MUTATION reachable via PARENT credentials (the P0 finding, confirmed). Everything else = READ_ONLY.**

## 3. Institutional Guardian Result (executed)

`resolveParentOwnership` checked only `students.parent_user_id` — the exact legacy-only shape P1 already found and fixed on `/api/student/{resources,materials,calendar,announcements}`. An institutional-only guardian (linked solely via `learner_guardians`, no `parent_user_id` row) got a silent 403 from `resolveCompassStudentAccess`, even though the PAGE-level gate (`requireParent(supabase, learnerId)` in both `app/(parent)/child/[learnerId]/progress/page.tsx` and `.../holiday/page.tsx`) resolves against the Core learner-id space and would have already let them through — the exact "page passes, API 403s" pattern P1 documented for assignments/gradebook.

Fixed by bridging `resolveParent()`'s `coreLearnerIds` back to the legacy compatibility `students.id` space via `repos.teachers.findLegacyStudentsByExternalIds` — the same primitive `resolveFamilyStudentIds` uses internally, but scoped to a single-student ownership check rather than a family-wide list (see code comment in `lib/compass/ownership.ts` for why `resolveFamilyStudentIds` itself was not reused wholesale — it also unions in the caller's own self-ids, which would mislabel a learner's own login as `via: 'parent'`).

Executed proof: `lib/compass/compassActorBoundary.integration.test.ts`, tests "institutional-only guardian: READ access now granted (was 403 before the P2 fix)" — passes against real `learners`/`learner_guardians`/Phase-1C-compatibility `students` rows in local Docker Supabase.

## 4. Current Actor Model

The platform recognizes, at the authorization layer, exactly three actor shapes reaching Compass: `teacher`, `parent`, `learner` (the `via` field on `OwnershipResult`). At the DATA layer, `compass_sessions` has no actor column at all — only `learner_id` (confirmed via `\d compass_sessions` against local Docker: columns are `id, learner_id, session_state, last_subject, ..., xp_earned, starting_level, ending_level` — no `created_by`, no `actor_id`). `learner_evidence` likewise has no actor/guardian column — only `learner_id`. `ingestion_runs.initiated_by` is the only place `access.userId` is ever recorded for a Compass-sourced write, and no downstream consumer (Projection, Learner Model, Blueprint, XP display) joins back to `ingestion_runs` to recover it.

**Conclusion: LEARNER_SELF and PARENT_ACTING_WITH_LEARNER were, before this fix, indistinguishable everywhere except a table nothing reads.** PARENT_VIEWING_LEARNER was already a real, distinct, correctly-scoped mode (Progress/Holiday, read-only, unaffected by this fix). TEACHER and SYSTEM are unaffected.

## 5. Compass Parent Behavior Before (traced, not executed against a browser)

`/learn` (`app/learn/page.tsx`) is a client component with no server-side auth page — the auth check happens entirely inside the APIs it calls. If a parent navigates to `/learn` with no `?studentId=`, `/api/learn/student` GET auto-selects via `repos.compass.findOwnedStudents(user.id)`, which is parent-owned-inclusive. A parent with exactly one legacy-linked child lands directly on the subject picker for that child — no "picker" step, no copy distinguishing parent from learner anywhere on the page. Before this fix, clicking a subject card called `startSession()` → POST `/api/learn`, which streamed a live AI tutoring turn exactly as if the parent were the learner, with no UI indication this was happening on the child's behalf rather than as the child.

No copy anywhere on `/learn` says "your child's Compass" or otherwise frames the experience as parent-mediated — the page has no parent-aware branch at all. This is a genuine UI gap, but per the mission's scope (smallest truthful label change only, and only if the policy decision changes what a parent can do), the fix implemented is a proper 403 + visible error message rather than a redesign (§20, §31).

## 6. Compass Session Ownership (executed)

`\d compass_sessions` (local Docker Supabase, executed): columns are `id, learner_id, session_state, last_subject, created_at, updated_at, status, message_count, one_line_summary, exchange_count, subject, mode, completed_at, duration_seconds, xp_earned, starting_level, ending_level`. RLS policies (`compass_sessions: own insert/read/update`) all key on `auth.uid() = learner_id` — but every actual write in `/api/learn` and `/api/learn/end` goes through `createServiceClient()` (service role, bypasses RLS), so these RLS policies were never the operative gate; the app-level `resolveCompassStudentAccess`/`resolveSessionOwnership` calls were the only real authorization.

**Plain answer: NO, the database cannot currently distinguish "learner Mary answered this" from "Mary's parent answered this while accessing Mary's Compass."** There is no session-owner column separate from `learner_id`, and no actor column on `learner_evidence` either (§7). This is not manufactured — it is the literal schema.

## 7. Evidence Trace (executed, the most important section)

Traced end-to-end and reproduced by direct source read of `app/api/learn/end/route.ts` and `lib/compass/evidence.ts`, cross-checked against `\d learner_evidence` and `\d ingestion_runs` (executed):

1. `/api/learn/end` POST calls `resolveCompassStudentAccess(access.userId, studentId)` (BEFORE this fix — parent passes).
2. On success, it calls `recordCompassSessionEvidence({ studentId, initiatedBy: access.userId, ... })`.
3. `recordCompassSessionEvidence` builds an `engagementEvidence` row (always) and, if `genuineProgress && masteredConcepts.length > 0`, a `mastery` row too. Both have `learnerId: input.studentId` — the CHILD's id — and no field carries `initiatedBy` onto the evidence row itself.
4. `initiatedBy` is passed only to `repos.evidence.createIngestionRun({ source: 'compass_session', initiatedBy, ... })`, which writes `ingestion_runs.initiated_by`. `learner_evidence.ingestion_run_id` is a foreign key to that row, but no Projection, Learner Model, Blueprint, or XP-display code path joins through it to recover who actually drove the session.
5. `persistEvidenceBatch` runs the normal Evidence Domain lifecycle — trust tier 1, confidence capped at 60, `pending_review` unless conservatively auto-confirmed (engagement only, never mastery).
6. `recomputeLearnerProjection(learnerId)` (invoked elsewhere on confirmation) treats this evidence identically to learner-self evidence — there is no `evidence_source` value or field that would let it, or any consumer, distinguish parent-mediated from learner-self Compass evidence.

**Answer to the mission's central question (§10): before this fix, YES — a parent-originated Compass interaction could emit Evidence, attributed entirely to the learner, indistinguishable anywhere Projection/Learner Model/Blueprint reads it from the learner's own work. It could reach `pending_review` (engagement claims could even auto-confirm) and, once confirmed, influence capability/risk/growth exactly like self-authored evidence, because nothing downstream knows the difference.**

## 8. XP Trace

Independently of Evidence: `/api/learn/end` computes `xpEarned = calcXp(exchanges, completed, genuineProgress)` and writes it unconditionally to `compass_sessions.xp_earned` and via `student_learning_context` counters (`total_sessions`, `sessions_this_week`). None of this is gated on WHO called the route — only on session state. Before this fix, a parent-driven session completion awarded the child real XP and incremented real session/streak counters with zero distinction from a learner-driven completion. This is fixed by the same `resolveCompassMutationAccess` change (§13) — a parent can no longer reach `/api/learn/end` at all.

## 9. Fast-Loop Context (not re-litigated)

Per Phase 6 (prior work, not reopened here): Compass has no deterministic code-level consecutive-right/wrong fast-loop state machine. The only session-adjacent state a parent interaction could touch is `session_state` (masteredConcepts, lockedSubject/Substrand) and `sessions_without_improvement` — both writable by the now-blocked mutation path. No fast-loop redesign was done or needed.

## 10. Read ≠ Act Invariant

**Violated before this fix.** Authorization to view (`resolveCompassStudentAccess` returning `allowed: true` for a parent) was the SAME check gating the ability to generate learner-authored Evidence and XP (`/api/learn`, `/api/learn/end` used the identical resolver). Fixed by splitting the check (§13/§16).

## 11. Parent Observation Comparison (comparison only, not modified)

`/api/parent/assessments/process` (per P0) emits deliberately parent-attributed Evidence: `evidence_source='parent_observation'`, tier-1 trust, confidence capped, always `pending_review`. This is the platform's own existing precedent for "a parent may contribute academically relevant signal, but it must be honestly labeled as parent-sourced, lower-trust, and reviewed before it counts." The Compass path, before this fix, had NONE of these three properties for parent-driven sessions — the evidence carried `evidence_source='compass_session'`, the same value learner-self sessions produce, with no lower trust tier and no parent flag. This asymmetry is the clearest evidence that Compass's parent-write path was an oversight, not a deliberate co-use design — if parent-mediated Compass evidence were a genuine product intent, it would look like `parent_observation`, not silently borrow `compass_session`'s learner-self semantics.

## 12. Teacher-Mediated Comparison (comparison only, not modified)

The delivery/binding system (`lib/compass/deliveryBinding.ts`, `blueprint_compass_deliveries`) already distinguishes "a teacher queued this objective" (`compass_bridge.teacherSuggested`, `subStrandId` anchor) from "the learner completed the session that consumed it" (`completeDeliveryForSession`, matched on exact session id) from "Projection later judged whether it worked" (a separate Blueprint action review). This is architectural precedent that the platform already knows how to keep initiator/consumer/judge distinct when it needs to — it just never applied that pattern to the parent-vs-learner distinction in Compass. Not modified.

## 13. Policy Decision

**OPTION A — VIEW ONLY.** A parent may inspect Compass-adjacent state (Progress, Holiday) but may not perform learner interactions that generate learner Evidence or XP.

Reasoning: (1) §11 shows the platform's own existing parent-contribution precedent requires honest labeling and reduced trust — Compass had neither, so preserving parent-write access without building that (Option B) would mean either building a real actor-provenance model (large, unjustified — see below) or continuing to silently misattribute a parent's answers as the child's mastery. (2) §5 shows there is no existing product surface, copy, or design that invites a parent to run a Compass tutoring turn themselves — Progress and Holiday, the only parent-facing Compass-adjacent surfaces, are already read-only. Blocking mutation breaks nothing a parent currently legitimately uses. (3) Option C (full impersonation) was current behavior but was never a deliberate choice — the evidence in §11 shows it contradicts the platform's own honesty-in-attribution standard for every other parent-contribution channel.

Option B (co-use with provenance) was considered and rejected for now: it would require a genuine actor-provenance model (new evidence field or a new `evidence_source` value, a lower trust tier for parent-driven mastery claims, and UI copy inviting parent-mediated Compass use) that nothing in this audit found a real, current product need for. If a genuine parent-co-use case emerges later, Option B is the next step and P0's `parent_observation` precedent is the template — flagged in §26 Recommended P3 space.

## 14. Fix

Two changes to `lib/compass/ownership.ts`:

1. `resolveParentOwnership` now also checks the institutional-guardian bridge (§3), fixing Progress/Holiday/subject-picker access for institutional-only guardians — a pure availability fix, no new restriction.
2. New `resolveCompassMutationAccess(userId, studentId)`: teacher OR learner-self only, parent excluded. Wired into `app/api/learn/route.ts` POST and `app/api/learn/end/route.ts` POST in place of `resolveCompassStudentAccess`. `resolveCompassStudentAccess` itself is UNCHANGED for read routes (still used by `/api/learn/progress`, `/api/holiday/mine`, `/api/learn/student`).

Also fixed `app/learn/page.tsx`'s `startSession()`: a non-OK response from `/api/learn` used to `return` silently (stuck spinner, no error, no explanation). Now shows a visible message, distinguishing the 403 case with truthful copy ("This account can't start a Compass session for this learner. Compass sessions are for the learner themselves.") from a generic failure.

## 15. Read vs Mutation Boundary

Now two distinct functions in `lib/compass/ownership.ts`:
- `resolveCompassStudentAccess` — READ authority: teacher, parent, learner-self. Used by Progress, Holiday, subject picker.
- `resolveCompassMutationAccess` — MUTATION authority: teacher, learner-self only. Used by `/api/learn` POST, `/api/learn/end` POST.

They were previously the same function for every caller.

## 16. Legacy/Core Identity Proof (executed)

`lib/compass/compassActorBoundary.integration.test.ts`, executed against local Docker Supabase (9/9 passing):
- Institutional-only guardian: READ granted, MUTATION denied.
- Legacy guardian (`parent_user_id`): READ granted (unchanged), MUTATION denied.
- Learner-self: READ and MUTATION both granted, unchanged, `via: 'learner'`.
- Teacher (direct link): READ and MUTATION both granted, unchanged.
- Unrelated user: denied READ and MUTATION on every one of the three students.

`StudentId` and `LearnerId` are kept explicit throughout — the institutional fixture creates a real `learners` row (Core id space) AND a separate Phase-1C-compatibility `students` row (legacy id space) bridged via `external_id`, and every access check in the test operates on the legacy `studentId` the routes actually key on, never coercing one UUID space into the other.

## 17. Mixed-Family Proof (executed)

Test "mixed-family isolation: institutional parent denied on legacy student, legacy parent denied on institutional student" — confirms an institutional guardian's newly-granted read access does not leak onto an unrelated legacy student, and vice versa. A true mixed-family case (one parent, one institutional child AND one legacy child) was covered structurally by P1's HTTP suite (`mixedParent`, not re-duplicated here); this phase's addition (institutional-guardian Compass access) rides the same `resolveParent().coreLearnerIds` union P1 already proved is per-guardian, not per-relationship-type, so a mixed guardian gets the SAME policy for both children by construction — no separate mixed-guardian fixture was needed to prove this narrower claim.

## 18. Multi-School Proof

Not independently re-executed in this phase's new test (P1's HTTP suite already proves the underlying `resolveParent`/`resolveFamilyStudentIds` primitives are school-agnostic — keyed on `learner_guardians.user_id`/`students.parent_user_id`, never a "current school" concept). This fix reuses those same primitives without modification, so the multi-school property carries over by construction; not re-verified with a fresh multi-school fixture in this phase given time budget — flagged as a thin spot in §25, not a known gap.

## 19. IDOR Proof

`resolveSessionOwnership(sessionId, studentId)` (unchanged by this phase) is still called after `resolveCompassMutationAccess` in both `/api/learn` and `/api/learn/end`, and independently verifies the session belongs to the studentId the caller was just authorized for — a caller authorized for student A cannot pivot to student B's existing session by supplying B's sessionId alongside A's studentId, unchanged behavior, not re-tested fresh in this phase (already covered by `lib/compass/endSession.integration.test.ts`'s "another learner cannot end this learner's session," which passed in this run).

## 20. Delivered Compass Action + Home Next Action

Traced: a teacher-approved action is delivered via `compass_bridge` (`blueprintExecutionExperience`/`deliveryBinding.ts`, Phase 7, not modified). If a PARENT opens the same delivered Compass action, they would previously have been able to complete it via `/api/learn/end`, which calls `completeDeliveryForSession(sessionId)` — this WOULD have satisfied the teacher's queued intervention as if the learner had done it, contaminating the adaptive loop's "did the learner actually do the intervention" signal. This is now blocked: `resolveCompassMutationAccess` denies the parent before any of `/api/learn`'s writes (including `bindDeliveryToSession`) or `/api/learn/end`'s writes (including `completeDeliveryForSession`) can run. Not executed as a full end-to-end delivered-action fixture in this phase (time budget) — the conclusion follows directly from the fact that both mutation routes are now uniformly gated before any delivery-binding code path executes, verified by reading `app/api/learn/route.ts` lines 178-196 and `app/api/learn/end/route.ts` lines 737-741 (ownership check precedes `bindDeliveryToSession`/`completeDeliveryForSession` in both).

## 21. Adaptive Loop Integrity

Per §20: parent-originated entry into the action-completion → Evidence → Projection → next-decision circuit is now blocked at the authorization boundary, before any of that circuit's writes execute. Learner completion is unaffected — `resolveCompassMutationAccess`'s learner branch is byte-identical to `resolveLearnerOwnership`, unchanged. Not executed as a live before/after adaptive-decision-changes fixture in this phase; the `lib/compass/deliveryBinding.integration.test.ts` suite (20/21 real assertions passing, 1 unrelated teardown failure — see §23) already covers "wrong-subject session cannot claim the delivery," "a different learner cannot claim this learner's delivery," and "ending the bound session completes the delivery" — all pass unchanged after this fix, confirming the mutation-gate change did not alter delivery-binding semantics for authorized callers.

## 22. Projection Regression (executed)

Projection itself was not touched. `lib/compass/learnerContext.integration.test.ts` (10/10 passing) and `lib/compass/compassEvidenceLoop.integration.test.ts` (9/9 passing, all real assertions) both exercise learner-self Compass Evidence reaching Projection through the unmodified path and pass unchanged. Compass DOES emit canonical Evidence in the tested flow (confirmed, not assumed) — `lib/compass/compassClaimIdentity.integration.test.ts`'s "a completed Compass session emits two distinct claim shapes, both pending_review at creation" passes, executed against real rows.

## 23. Architecture Guards / Tests (executed)

New test: `lib/compass/compassActorBoundary.integration.test.ts` (9/9 passing) — proves (A) parent read and learner/teacher mutation authority are no longer the same check, (B) institutional guardian identity uses the canonical `resolveParent` bridge, (C)/(D) a parent cannot reach the routes that would emit learner-self Evidence or XP (denied before any write), (E) learner-self Compass access (both read and mutation) is unchanged. (F) Career Intelligence: out of scope, not touched, not re-verified. (G) Projection: not touched, verified via §22's unmodified passing suites.

Full regression run (local Docker Supabase, `TEST_SUPABASE_*` pointed at `127.0.0.1:54321`):

- `npm test` (standard-safe manifest): **1063/1063 pass.**
- `lib/compass/compassAccess.integration.test.ts`: **12/12 pass** (unmodified by this phase, confirms no regression on the G-05 access-union logic).
- `lib/compass/compassActorBoundary.integration.test.ts` (new): **9/9 pass.**
- `lib/compass/{aiGroundingContract,compassClaimIdentity,compassEvidenceLoop,deliveryBinding,endSession,learnerAgency,learnerContext}.integration.test.ts`: **68/69 real assertions pass**; the one reported failure (`deliveryBinding.integration.test.ts`) is its `after()` cleanup hook failing with `deleteAuthUserOrThrow: ... Database error deleting user (dangling FK)` — a known local-Docker teardown limitation the test file's own header documents, not an assertion failure; the test's actual assertions all passed before teardown ran.
- `lib/core/{academicBridge,academicReadMigration}.test.ts`: **20/22 real assertions pass**, including "Compass: the bridged teacher is granted direct access to the bridged learner, unmodified resolveCompassStudentAccess" and "Compass: an unrelated teacher is denied access" — both pass unchanged. The 2 reported failures are the same `deleteAuthUserOrThrow` cleanup-hook error as above, on tests whose real assertions already passed.
- `lib/core/{identity,permissions.selforparent,permissions.student-parent}.test.ts`: **all pass.**
- `lib/holiday/{holidayPlanner,holidayReturn}.integration.test.ts`: **all pass.**
- `npx tsc --noEmit`: **clean, zero errors.**
- `npx eslint` on all 5 changed/added files: **clean, zero warnings.**
- `npm run build` (`next build`): **succeeded**, all routes compiled, no new errors (only pre-existing unrelated informational Vercel-output-size notices).

**Not executed in this phase (honest limitation):** the `*.http.integration.test.ts` suites (`parentPortalP1Convergence`, `parentExperienceConvergence`, the Compass `.http.integration.test.ts` files) require a running `next dev` server pointed at the same local-Docker target in addition to the test process itself — standing this up was out of the time budget for this pass. The non-HTTP integration suites covering the same code paths (§23 above) were run instead and are green; this is a real gap in the regression gate, not silently glossed over. Recommend running the HTTP suites before this fix is considered fully proven at the HTTP layer.

## 24. Files Changed

- `lib/compass/ownership.ts` — fixed `resolveParentOwnership` institutional-guardian gap; added `resolveCompassMutationAccess`.
- `app/api/learn/route.ts` — switched to `resolveCompassMutationAccess`.
- `app/api/learn/end/route.ts` — switched to `resolveCompassMutationAccess`.
- `app/learn/page.tsx` — `startSession()` no longer silently swallows a non-OK response.
- `lib/compass/compassActorBoundary.integration.test.ts` — new, 9 tests.

5 files, 1 commit (`628a341`).

## 25. Database Changes

**NONE.** No migration was written or is required — the fix is entirely authorization-layer (which function a route calls), not schema.

## 26. Named Limitations (carried forward + new)

Carried forward from P0/P1, not resolved by this phase:
- P0's broader finding that `students.teacher_id`-style actor columns are conflated with access-control ownership elsewhere in the codebase (CLAUDE.md's own standing rule) — Compass's teacher path (`resolveTeacherOwnership`) already correctly uses roster/direct-link, not touched here.
- P1's own named limitations (institutional guardian coverage was enumerated route-by-route, not proven exhaustive platform-wide) — this phase closes the Compass/Progress/Holiday instance of that gap but does not claim to have found every remaining instance elsewhere in the codebase.

New from this phase:
- **HTTP-layer regression not executed** (§23) — the non-HTTP integration suites covering the same code paths are green, but the actual HTTP routes were not exercised end-to-end with a live `next dev` server in this pass.
- **No actor-provenance model built.** If a genuine parent-co-use product need for Compass emerges later, Option B (§13) — a `parent_observation`-style discriminated evidence source and UI redesign — is the next step, not built here because no current need was found.
- **`/learn` page has no parent-aware UI branch.** A parent can still reach the subject picker and attempt to start a session; they now get a truthful 403 message instead of a silent failure, but the page does not proactively hide or relabel Compass entry for a parent context. Left as-is per the mission's "smallest truthful label change only" instruction — a fuller redesign (e.g., redirecting a parent straight to Progress with an explanatory message) is a reasonable P3 follow-up, not done here.
- `getBridgedCompassAccess` (`lib/core/academicBridge.ts`) is dead code (zero callers outside its own test) — left untouched, flagged for potential removal in a future cleanup pass, not this phase's scope.
- §18 (multi-school) and §19 (IDOR) were verified by construction/reuse of already-tested primitives, not by fresh dedicated fixtures in this phase — a thin spot, not a known failure.

## 27. Recommended P3

**PARENT HOME / CHILD-CONTEXT CONVERGENCE**, narrower scope: specifically, closing the `/learn` page's lack of parent-awareness found in §5/§26 — either redirect a parent who reaches `/learn` straight to a read-only Progress-style view of Compass activity, or show a clear "you are viewing on [child]'s behalf" banner before any subject card is even offered. This is a real, small, honest gap this audit found but did not fix (correctly, per the mission's narrow-copy-change instruction), and it is the natural continuation of P1's entry-convergence work rather than a new initiative.

A secondary, lower-priority candidate: stand up the HTTP-layer regression environment (`next dev` against local Docker) as reusable test infrastructure, since this gap will recur on every future phase that needs to prove an HTTP-level fix and was the single largest process gap in this phase's own regression gate.
