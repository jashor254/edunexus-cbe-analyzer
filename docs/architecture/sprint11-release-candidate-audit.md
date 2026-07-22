# Sprint 11 — Release Candidate Audit

**Status**: Audit complete, 2026-07-21. Six parallel research passes traced every named journey as real code (not grepped impressions), followed by 2 new workflow tests confirming/documenting the two most consequential findings. No feature work, no redesign, per this sprint's explicit mandate — the two test files added are the only code changes, and they encode discovered behavior (one confirms a working chain, one documents a known gap), not fixes.

**Primary question**: *Can a school complete an entire academic year using EduNexus without encountering a workflow that breaks, dead-ends, contradicts another subsystem, or requires manual intervention?*

**Answer: No.** Two Critical breaks would each independently stop a real school mid-year: Promotion does not actually promote (no re-enrollment), and a guardian recorded through the Core Admissions flow (built in Sprint 10) can never become an authenticated parent who sees their child. Both are silent — no error, no visible symptom until the specific moment they bite (next year's promotion cycle; a parent trying to log in).

---

## 1. Executive Summary

This audit exercised five complete journeys (School Onboarding, Teacher, Student, Parent, End-of-Term) as running code, not isolated pages, plus a dedicated data-flow trace of the platform's most important chain (Assessment → Evidence → Projection → Blueprint → Clinic → Report Cards → Promotion → Transfer). The good news first: the single scenario every prior sprint worried about most — "does a Core-only school's assessment data actually reach Blueprint, or is it a disconnected island" — is **confirmed working**, verified by a new end-to-end test (`lib/core/academicBridge.assessmentToProjection.workflow.test.ts`) that records a mark through the Core/bridge path and asserts real Evidence and Projection rows result. Attendance→Report Cards, Assignments→Gradebook, Compass→Evidence, Resources (teacher↔student), Timeline, Blueprint, and the recently-fixed Career grade-gate and Holiday publish-gate all traced clean.

The bad news is concentrated in exactly the two areas Sprint 10 (Core Administration) and the fresh Parent Experience work most recently touched. **Promotion, activated last sprint, records an audit-trail row but never re-enrolls the learner** — verified by a new regression test that currently passes by asserting the gap exists (`lib/core/promotions.reenrollmentGap.test.ts`); a promoted learner has zero active enrollment anywhere until manually fixed, and the *following* year's promotion cycle would throw for them. **Guardians admitted through Core Admissions (Sprint 10) can never log in as that child's parent** — `learner_guardians.user_id` is hardcoded null at insert with no invite/claim mechanism anywhere in the codebase, silently disconnected from the one working parent-link mechanism (`student_invites`, which targets the legacy `students` table instead). A third systemic issue — a school's "current term" is never set after activation, and no UI can fix it — means the entire Sprint 10 Academic Structure screen is a dead end for every freshly onboarded school until an admin manually calls an API route no page ever surfaces.

Five more High-severity findings round out a pattern: report cards can be generated and published with a fabricated "Below Expectation" grade for a learner with zero real marks; assessment "locking" doesn't actually freeze marks; the Academic Clinic computes career guidance from a completely separate pipeline than Blueprint, capable of disagreeing on the same learner at the same moment; the student Dashboard computes its own capability score directly from raw data, violating this codebase's own explicit architecture rule; and Promotion has no academic-evidence gate at all, letting an admin promote a class that never sat a single assessment.

**Release Readiness Score: 42/100.** Not release-candidate ready. Two Critical findings alone are automatic blockers per this sprint's own release-decision rule.

---

## 2. Journey Verification Matrix

| Journey | Steps traced | Result |
|---|---|---|
| **School Onboarding** | School→Year→Terms→Streams→Classes→Subjects→Teacher allocation→Admission→Parent linking | **Breaks twice**: no current-term set post-activation (dead end, §9.3); guardian never becomes a logged-in parent (dead end, §9.1) |
| **Teacher** | Login→Dashboard→Lesson planning→Resources→Attendance→Assignments→Adaptive assessment→Review→Gradebook→Blueprint→Academic Clinic→Reports | **Mostly works.** Attendance→Report Cards, Assignments→Gradebook, Adaptive delivery-gate, Resources↔student, "Parent Reports" vs "Official Report Cards" naming all confirmed correctly wired/resolved. One Medium: Gradebook and Evidence are parallel writes from the same event with a silently-swallowed failure path. |
| **Student** | Login→Dashboard→Assignments→Adaptive assessment→Resources→Progress→Timeline→Portfolio→Achievements→Blueprint→Career→Holiday | **Mostly works, one High.** Dashboard computes its own capability score bypassing canonical Projection (§9.6). Timeline/Blueprint confirmed canonical. Career grade-gate and Holiday publish-gate both confirmed fixed from prior audits. |
| **Parent** | Login→Children→Assignments→Calendar→Announcements→Progress→Gradebook→Blueprint→Career→Academic Clinic | **Mostly works, no security issue found** in the new, highest-risk Gradebook route (test-covered). One Medium: Calendar/Announcements/Resources only resolve via the legacy parent link, silently empty for Core-only-linked parents (same root cause as the Critical guardian-linking gap). Academic Clinic has no parent-facing surface at all — not found anywhere. |
| **End-of-Term** | Assessment→Review→Approval→Gradebook→Evidence→Projection→Blueprint→Academic Clinic→Report Cards→Publication→Promotion→Transfer | **Two Critical, three High.** Assessment→Evidence→Projection genuinely connected (new test confirms). Blueprint→Clinic diverges (High). Report Cards→Promotion has no gate (High). Promotion→(next cycle) is Critical (no re-enrollment). No term-lock enforcement (High). |

---

## 3. Data Flow Audit

Traced as the full chain: **Assessment → Evidence → Projection → Blueprint → Academic Clinic → Report Cards → Publication → Promotion → Transfer.**

1. **Assessment → Evidence**: connected via `lib/core/academicBridge.ts`'s `recordBridgedMarks()`, which calls `recordAssessmentEvidence()` unconditionally after every score save. **Confirmed working by new test.**
2. **Evidence → Projection**: `recomputeLearnerProjection()` reads real evidence keyed to the bridge's legacy shadow identity, created lazily on first use. **Confirmed working by new test.** Fragile only if a future caller bypasses the bridge and calls Projection with a raw Core id directly — not found today, worth guarding against in review going forward.
3. **Blueprint → Academic Clinic**: **genuinely disconnected.** Blueprint is Evidence/Projection-sourced; the Clinic's `runAssessmentPipeline()` (`lib/academicClinic/assessmentPipeline.ts:70-93`) reads one raw assessment's `subject_scores` directly and runs its own separate analysis/career engine, with zero calls to `composeBlueprint`, `recomputeLearnerProjection`, or the Evidence repository anywhere in `lib/academicClinic/*.ts`. Can disagree with Blueprint on the same learner at the same moment. **High.**
4. **Report Cards → Promotion**: `previewPromotion()`'s suggested action is derived purely from grade level (`level_order === 11 ? 'graduate' : 'promote'`) — no read of report cards, term summaries, or any academic evidence. An admin can promote a class that never ran a single assessment. **High.**
5. **Promotion → next cycle**: `runAnnualPromotion()` inserts a log row only; it never creates a new active `learner_enrollments` row for the destination class. The learner's old enrollment is also never withdrawn. **Confirmed and regression-tested. Critical.**
6. **Term lock**: no `terms.is_locked` concept exists anywhere in schema or code — only per-assessment `is_published`, which itself doesn't block further mark edits (§9.4). Evidence/Projection can be freely written into an already-"closed" term after the fact. **High.**

---

## 4. Authorization Audit

- **Cross-school isolation**: sound. Every Core write route re-derives school membership server-side from `auth.getUser()`; no route found trusting a client-supplied `schoolId` alone.
- **Cross-family isolation**: sound in mechanism (`requireParent`/`canViewLearnerRecord` correctly scope by the authenticated user's own guardian links) but **effectively untestable for any Core-admitted learner**, since guardian `user_id` is never populated — the same root cause as the Critical parent-linking gap (§9.1), not a new issue.
- **Cross-class isolation**: `requireClassTeacher` correctly rejects a real teacher who doesn't own the specific class in question, confirmed by existing tests re-verified this sprint.
- **Privilege escalation**: not found. Every sensitive Core write correctly requires `requireSchoolAdmin`; teacher-tier actions correctly use the looser `requireSchoolStaff`/`canManageAssessment`. One self-flagged, pre-existing, Low-severity inconsistency: `PATCH /api/core/school` omits `deputy_headteacher` from its admin set (under-privileges, not a leak).
- **New parent Gradebook route** (`app/api/parent/gradebook/route.ts`, this sprint's highest-risk new surface): traced fully — `requireAuthentication` then `requireParent(supabase, studentId)` gate the read before any query runs, and an HTTP integration test (`lib/testing/parentExperienceConvergence.http.integration.test.ts:222-223`) already proves a 403 for an unrelated parent. **No exploit found.**
- **Malformed/replay**: Zod validation on Promotion/Transfer routes correctly rejects malformed input. **`learner_promotions` has no unique constraint** — a double-submitted promotion batch (double-click, before this sprint's UX inconsistency finding §9.9 is fixed) inserts duplicate rows with no guard, unlike `onboardLearner`'s check-then-create idempotency. **Medium.**

---

## 5. Operational Audit

- **Beginning of term**: `updateClass()` exists in `lib/core/classes.ts` but the Sprint 10 Structure UI never calls it — no edit/delete path for a wrong-grade class, wrong stream, or a bad subject-grade assignment anywhere in the UI. **Medium.**
- **Mid-term (Attendance)**: full correction path exists (update/delete session and record, ownership-checked). **Acceptable, no finding.**
- **Exam period**: "Lock assessment" doesn't actually block further mark edits — `saveScores()` never checks `is_published`. Misleading UI promise. **High.**
- **End of term, zero-mark learner**: `generateReportCards()` computes and publishes a real "BE" (Below Expectation) grade for a learner with zero marks, directly contradicting the same function's own documented "no fabricated zero" principle already applied to attendance three lines above it in the same file. **High.**
- **Promotion mistake recovery**: no undo function; page text is honest about this ("nothing here is undone automatically"). **Low, acceptable given the disclosure** — though moot in practice while the Critical re-enrollment gap (§9.1 data flow) means promotion barely does anything to undo in the first place.
- **Archived/historical data**: no "current term only" trap found — attendance and report-card reads correctly take an explicit `termId`.

---

## 6. UX Consistency Review

- Terminology, loading/error/empty states, and the `fetchJson`/`OperationalBreadcrumb` pattern are consistent across every Sprint 10 Core Administration page and its predecessors (`core-admissions`, `core-team`).
- **Real inconsistency**: Transfer and Report Publish both use a genuine two-click confirm for an irreversible action; **Promotion's "Run Promotion" button fires immediately on the first click**, despite the same page's own copy admitting "nothing here is undone automatically." The interaction pattern doesn't match the page's own stated stakes. **Medium.**

---

## 7. Performance Review

- No N+1 pattern found in report-card generation or attendance aggregation — both correctly batch via `.in()`-backed bulk reads.
- Sequential-looking multi-fetch pages (Academic Structure, Academic Office) are actually independent `useEffect`s, not chained — effectively parallel. No finding.
- `runAnnualPromotion`'s per-decision `for` loop is not batched, but this is a deliberate error-isolation design (each learner's failure is caught and reported independently) — acceptable for a once-a-year, ~40-learner-class operation. No finding.

---

## 8. Test Coverage Review

New this sprint (both run against real Supabase, both green):
- `lib/core/academicBridge.assessmentToProjection.workflow.test.ts` — first-ever end-to-end coverage of the Assessment→Evidence→Projection chain from the Core/bridge side. Protects the audit's single most important "is this actually connected" finding against regression.
- `lib/core/promotions.reenrollmentGap.test.ts` — documents the Critical re-enrollment gap as a precise, currently-passing regression test. Deliberately designed to start **failing** once Sprint 12 fixes `runAnnualPromotion` — that failure is the correct signal to update the assertion, not evidence of a new bug.

**Still missing, recommended for Sprint 12 before any fix lands**: a route-level test for guardian→parent linking (currently impossible to write meaningfully, since the feature doesn't exist); an HTTP integration test for the Core "current term" dead end; a test proving (or disproving, post-fix) that Promotion actually withdraws the old enrollment.

---

## 9. Critical Findings

1. **Promotion does not promote.** `runAnnualPromotion()` (`lib/core/promotions.ts`) inserts a `learner_promotions` log row only — it never creates an active `learner_enrollments` row for the destination class, and never withdraws the old one. A "promoted" learner has zero active enrollment for the new period until something else enrolls them; the following year's own promotion cycle would throw `No active enrollment found` for that learner. Silent — no error surfaces at promotion time. **Regression-tested this sprint** (`lib/core/promotions.reenrollmentGap.test.ts`, currently passing by documenting the gap).
2. **A guardian linked through Core Admissions can never become an authenticated parent.** `learner_guardians.user_id` is hardcoded `null` at insert (`lib/core/learnerOnboarding.ts`, `lib/core/learners.ts`) with no invite/claim mechanism anywhere targeting that table. The one working parent-link flow (`app/api/parent/link-student/route.ts`, `student_invites`) writes to the unrelated legacy `students.parent_user_id` instead. Any school onboarded entirely through the Sprint 10 Core Admissions UI has parents who can never see their children in the app, with no error message telling anyone why.

---

## 10. High-Priority Findings

3. **No "current term" is ever set after school activation**, and no UI can set one. `ensureAcademicYear`/`ensureDefaultTerms` never call `setCurrentAcademicYear`/`setCurrentTerm`; the Sprint 10 Academic Structure page gates its entire form behind `membership.currentTerm`, whose only fix (`POST /api/core/academic-years`, `type: 'set-current-term'`) has no caller anywhere in the UI. Every freshly-activated school is stuck.
4. **Academic Clinic and Blueprint are separate, disagreeing pipelines.** Confirmed via full grep of `lib/academicClinic/*.ts` — zero calls to the canonical Blueprint/Projection/Evidence path. Same divergence risk flagged in prior sprints, still unresolved.
5. **Promotion has no academic-evidence gate.** `previewPromotion()` suggests promote/graduate from grade level alone; `runAnnualPromotion()` has no precondition on report cards or evidence existing at all.
6. **Assessment "lock" doesn't lock marks.** `saveScores()` never checks `is_published` before writing — a mark can be silently edited after the class was told assessments are locked, with no re-generation trigger tying report cards back to the change.
7. **Report cards fabricate a real failing grade for zero-mark learners.** `generateReportCards()` stores and publishes `overall_cbc_level: 'BE'` for a learner with no summaries at all, directly contradicting the same file's own "no fabricated zero, ever" rule already applied one section above for attendance.
8. **No term-lock enforcement anywhere** — Evidence/Projection can be written into an already-"closed" term after the fact; only per-assessment publish state exists, and even that doesn't block writes (finding 6).
9. **Student Dashboard bypasses canonical Projection.** `app/api/student/home/route.ts` computes a "Future Readiness Score" and subject levels directly from raw `assessments.subject_scores`, violating CLAUDE.md's explicit rule that learner intelligence state is read via `recomputeLearnerProjection()` only — a 4th independent "learner level" source, matching the previously-logged "disagreeing readiness formulas" pattern.

---

## 11. Medium Findings

- Gradebook and Evidence are two independent writes off the same mark-entry event, with the Evidence side's failure caught and only `console.error`'d, never retried or surfaced — Gradebook can show a score Blueprint never learns about.
- Parent-facing Calendar/Announcements/Resources routes scope only via the legacy `parent_user_id` link, silently returning empty for any parent linked exclusively through Core `learner_guardians` — same root cause as Critical Finding 2, different symptom (empty list, not total lockout, since these routes tolerate a parent with zero legacy links gracefully rather than erroring).
- No unique constraint on `learner_promotions` — a double-submitted promotion batch inserts duplicate rows.
- No edit/delete path for Streams, Classes (grade/stream), or Subject-Grade assignment mistakes made during Beginning-of-Term setup, despite `updateClass()` already existing unused.
- Promotion's "Run Promotion" fires immediately with no confirmation, inconsistent with Transfer's and Report Publish's two-click pattern for equally-irreversible actions.

---

## 12. Low Findings

- `deputy_headteacher` inconsistently excluded from `PATCH /api/core/school`'s admin set (self-flagged in code, under-privileges only).
- `academicBridge.ts` is explicitly self-documented temporary tech debt — known, not new.
- Compass session completion still dual-writes to a legacy Learner Model flagged for removal in `docs/architecture/migration-ledger.md`.
- Student Progress page reads raw Compass sessions directly rather than through a shared abstraction — low risk since it only shows session counts, not capability data.
- The publish-time "unapproved questions" UX warning added in a recent commit is redundant with an already-enforced server-side delivery gate — not a bug, but worth confirming in docs so it isn't misread as having been a live leak.

---

## 13. Enhancements

- Consolidate the four independent "what's this learner's level/score" computations (Dashboard FRS, Progress session view, Academic Clinic, and the canonical Projection) onto Projection as the single source, closing Finding 9 and the recurring pattern behind it.
- A parent-facing Academic Clinic surface does not exist at all — not a bug (nothing promises it), but worth a product decision on whether it should.
- An admin runbook for manual promotion-mistake correction, given no undo function exists by design.

---

## 14. Updated Platform Audit

| Domain | Believed state (end of Sprint 10) | Verified state (Sprint 11) |
|---|---|---|
| Core Admin structure (classes/subjects/allocation) | Production-ready | Confirmed reachable and correct; edit/delete gap found (Medium) |
| Promotion | Production-ready, tested | **Critical gap found**: records intent only, never re-enrolls |
| Transfer | Production-ready, tested | Confirmed correct within its own scope (withdraws enrollment as designed) |
| Report Card Publication | Production-ready | Confirmed gate/audit-trail correct; fabricated-zero-mark grade found (High) |
| Assessment→Evidence→Projection (Core path) | Assumed connected, never end-to-end tested | **Confirmed genuinely connected**, now regression-tested |
| Academic Clinic | Assumed Blueprint-aligned | **Confirmed diverging pipeline** (High) |
| Parent Gradebook (new this cycle) | Unverified | **Confirmed secure**, test-covered |
| Guardian→Parent account linking | Assumed working (guardian object accepted at admission) | **Confirmed broken — Critical** |
| School activation → current term | Assumed automatic | **Confirmed broken — dead end, High** |

---

## 15. Release Readiness Score

**42 / 100.**

Scoring basis: core academic data flow (the platform's central value proposition) is sound and now proven — that alone is worth the majority of the score. But two Critical findings each independently represent "a school cannot finish the year": Promotion silently fails to do its one job, and any school onboarded the recommended way (Sprint 10's Core Admissions) has parents locked out entirely. Five further High findings compound the risk (fabricated grades on report cards, no term integrity, no promotion gate, a dead-end setup step, an architecture-rule violation). Per this sprint's own rule, Critical and High findings block Release Candidate status — there are 2 Critical and 7 High.

---

## 16. Technical Debt Remaining

- `academicBridge.ts` (self-documented temporary — not new debt, but now proven load-bearing for the platform's central data flow, raising the cost of ever removing it without a real Core-native assessment path first).
- Four independent "learner level" computations (Dashboard, Progress, Clinic, Projection) — long-flagged, still unconsolidated.
- Legacy dual-write from Compass to the old Learner Model, flagged for removal, still present.
- No central permissions/capabilities table — role lists remain duplicated across RLS and app-layer arrays (carried over from the Sprint 9 audit, unchanged).

---

## 17. Recommended Go / No-Go Decision

**NO-GO.** Two Critical findings (Promotion doesn't re-enroll; Core-admitted guardians can never log in) each independently break a full academic year for any school that uses the platform's own recommended admin flow. Neither is a UI polish issue — both require a real design decision (how should promotion's re-enrollment work; what invite/claim mechanism links a guardian to an account) before implementation, consistent with this sprint's mandate not to fix-in-place during an audit.

---

## 18. Recommended Next Sprint

**Sprint 12 — Release Blocker Remediation**, scoped narrowly to the 2 Critical + 7 High findings only, in this order:
1. Guardian→Parent account linking (Critical) — design a real invite/claim flow targeting `learner_guardians.user_id`, or a deliberate decision to require guardians to exist as accounts before admission.
2. Promotion re-enrollment (Critical) — decide whether `runAnnualPromotion` should immediately create the new enrollment and withdraw the old one, or whether a separate "activate promotion" step is the right model; fix with the existing regression test as the acceptance criterion.
3. Current-term dead end (High) — smallest fix: surface "set current term" in the Academic Structure UI, reusing the existing route.
4. Term-lock + post-lock mark edits (High) — decide the intended semantics (hard lock vs. re-generation trigger) before implementing.
5. Fabricated zero-mark grade (High) — apply the exact "no data available" pattern already used for attendance in the same file.
6. Promotion academic-evidence gate (High) — a warning, not necessarily a hard block, given schools may legitimately promote without full assessment coverage in some contexts — needs a product decision, not just a code fix.
7. Academic Clinic / Blueprint convergence (High) — likely the largest single item; recommend its own design pass rather than folding into this remediation sprint.
8. Student Dashboard Projection violation (High) — smallest structural fix: replace the raw FRS computation with a `recomputeLearnerProjection()` read, matching Career's already-correct pattern.

Do not attempt Timetable, Departments/HOD, or any new feature until this list is closed — consistent with every prior sprint's standing charter.
