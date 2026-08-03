# Application Layer & Workspace Projection Audit

**Date:** 2026-08-03
**Type:** Architecture audit (evidence-only findings + corrections). Not a feature sprint, not a migration sprint, not a database or UI redesign.
**Builds on:** [school-first-operating-model-audit.md](school-first-operating-model-audit.md) — that audit fixed *who owns institutional truth*; this one fixes *how that truth becomes a screen*.

**Frozen foundation this audit builds on, does not redesign:** School owns institutional truth · Teachers never own institutional identity · Learners exist independently of enrollment · Educational Intelligence reasons over evidence · Curriculum → Level → Stream is canonical · Institution Administration and Teaching are separate bounded contexts.

---

## 1. Executive Verdict

**The application layer is a split personality, and the split runs cleanly along the same line as the previous audit's teacher-first/school-first divide.** Wherever code already sits on the Core school-first side, it is composed correctly: `lib/core/*` has a genuine, already-existing use-case catalogue (§9), `app/teacher/core-office/page.tsx` composes it into a workspace with zero embedded business logic, and `lib/gradebook`, `lib/attentionFeed`, `lib/learnerBlueprint`, and `lib/projection` are each a clean service layer with one orchestrator and single-purpose helpers underneath.

Wherever code still sits on the legacy teacher-first side, the application layer doesn't really exist — pages and routes read `teacher_classes`/`students`/`assessments`/`compass_sessions` directly with the service-role client and compute business rules (average score, CBC-level labels, risk buckets, "days inactive") inline, then **duplicate that same computation three to four times across different files** because there's no shared service to call instead.

The Educational Intelligence boundary is the one unqualified success in this audit: the ESLint-enforced canonical-read-path rule for `learner_profiles`/`learner_evidence` has zero live violations in the current tree. `lib/projection/recompute.ts` is genuinely the only door in.

**Verdict: the target Workspace Projection Architecture is not a new design to invent — it's the pattern `lib/core/*` + `app/teacher/core-office/page.tsx` already demonstrates, extended to the legacy-side teacher workspace pages that haven't been given an equivalent service layer to call.** This is a smaller, more mechanical fix than it sounds: the missing services are almost entirely "extract what's already inline into `lib/`," not "invent new business rules."

---

## 2. Current Application Layer Audit

Findings by violation category, all with file:line evidence:

**Reading repositories/DB directly from pages/routes, bypassing services**
- `app/teacher/dashboard/page.tsx:50-66` — direct `db.from('teachers')` / `db.from('teacher_classes')` with the service-role client, no `lib/core/permissions.ts` auth helper used (just `supabase.auth.getUser()`).
- `app/api/teacher/classes/route.ts` GET (lines 32-78) — direct `teacher_classes`/`class_students`/`assessments` reads, no service call.
- `app/api/teacher/classes/[classId]/route.ts` GET (lines 8-13, 68-100) — same pattern plus a local `buildStudentPayload` closure computing derived fields inline.
- `app/api/teacher/classes/[classId]/insights/route.ts` GET (lines 27-135) — five direct table reads, only the risk-level step (line ~105) delegates to a real service (`computeStudentRiskLevel`, `lib/assessments/analyticsStats.ts:47`); subject-distribution and risk-count aggregation stay inline.

**Duplicating business logic across files**
- The average-CBC-level label mapping is independently implemented three times: `app/teacher/classes/page.tsx:10-22`, `app/api/teacher/classes/[classId]/route.ts:8-13`, `app/teacher/insights/page.tsx:8-13`.
- The average-score computation is independently implemented twice: `app/api/teacher/classes/route.ts:63-68` and `app/api/teacher/classes/[classId]/route.ts:78-82`.
- Neither has a `lib/gradebook`-equivalent shared function to call, despite `lib/gradebook/gradebook.ts` existing and already solving exactly this class of problem for a different route.

**Bypassing services that already exist**
- `app/api/teacher/classes/route.ts` POST creates a `teacher_classes` row directly rather than calling any equivalent of `lib/core/schoolActivation.ts`'s `ensureClasses`. (Already flagged in the prior audit as an ownership violation; it is *also* an application-layer violation — there is no service function encapsulating "create a class," only a raw insert.)

**Mixing bounded contexts**
- `lib/core/report-cards.ts:8` and `lib/core/promotions.ts:3` import `createBlueprintSnapshot` from `lib/learnerBlueprint/snapshot`.
- `lib/core/academicBridge.ts:68` imports `resolveCompassStudentAccess` from `lib/compass/ownership`.
- Both are one-directional (`lib/core` → teaching/reasoning domain, never the reverse — confirmed by grep, zero matches going the other way) and both are read/snapshot calls, not writes across the boundary. Narrow, but real: School Office use cases (report generation, promotion) currently know the Blueprint/Compass modules exist by name.

**Leaking database concepts into UI**
- `avg_level`/`overall_level`/CBC-label derivation is computed in API routes and re-derived again with display logic (`levelLabel`/`levelColor`) in the page component — the UI layer isn't just rendering a projection, it's re-interpreting a raw number the route already half-processed, because neither side has a single well-named "learner standing" projection to receive.

**What's clean and should be the model, not the exception**
- `app/api/teacher/gradebook/[classId]/route.ts` — file header literally states "Thin route — all aggregation lives in lib/gradebook/gradebook.ts," and it is: `requireClassTeacher` → `resolveTeacher` → `buildGradebook()`, batched I/O, pure-function merge in a separate file.
- `app/api/teacher/attention-feed/route.ts:34` → `buildAttentionFeed()` in `lib/attentionFeed/aggregate.ts`, two batched `Promise.all`s, no N+1.
- `app/teacher/attendance/page.tsx` — header comment states "No business logic, no calculation"; composes existing `/api/core/*` calls via `components/attendance/attendanceClient.ts`.
- `app/teacher/core-office/page.tsx` — composes three existing routes plus one client helper; header comment explicitly refuses to add a new school-wide aggregate, citing the prior sprint's scope boundary.

---

## 3. Workspace Projection Architecture (canonical model)

```
Institutional Truth (Core: schools, school_users, classes, learners, ...)
        │
        ▼
Application Services (lib/core/*, lib/gradebook, lib/attentionFeed,
                       lib/learnerBlueprint, lib/projection, ...)
   — one function per use case, calls repositories, contains
     every business rule, returns a plain projection shape
        │
        ▼
Workspace Projection
   — a page/route composes ≥1 application-service calls,
     performs NO calculation itself beyond pure display formatting
     (label/color mapping is allowed; averaging/risk-bucketing is not)
        │
        ▼
User (School Office / Teacher / Parent / Learner / Intelligence)
```

**The rule that makes this real, not aspirational:** a workspace projection may be destroyed and rebuilt from institutional truth with zero information loss, because it never stored anything that wasn't derivable. `app/teacher/core-office/page.tsx` already satisfies this today. `app/api/teacher/classes/[classId]/route.ts` does not — its `avgScore`/`overallLevel`/`daysInactive` computation exists only inside that route, uncached, unshared, and re-derivable only by someone reading and re-implementing that exact closure.

Per-workspace projection contracts:

| Workspace | Assembled from | Never contains |
|---|---|---|
| School Office | `lib/core/*` use cases (§9) | Teaching artifacts (lesson content, assignment grading detail) |
| Teacher Workspace | Teacher's `school_users` membership + assigned classes/subjects + `lib/gradebook`, `lib/attentionFeed`, `lib/assessments`, `lib/learnerBlueprint` (read-only) | Institutional structure creation, other teachers' rosters |
| Parent Workspace | `lib/learnerBlueprint` (read), `lib/core` attendance/report reads, scoped to guardian-linked learners | Any institutional write capability, any other learner's data |
| Learner Workspace | Own evidence-derived projections (`recomputeLearnerProjection`, Blueprint, Career Intelligence), own assignments | Institutional administration, other learners' data, raw evidence rows |
| Educational Intelligence | Evidence (via `lib/projection`, `lib/intelligence`) | Institutional truth ownership — it reasons over evidence, never becomes a system of record itself |

---

## 4. School Office Projection

**Already correctly scoped.** `app/teacher/core-office/page.tsx` (despite its `/teacher/*` URL — a navigation problem the prior audit already flagged, not a projection problem) composes exactly the institutional responsibilities the mission specifies and nothing else:

- Admissions → `/api/core/learners`, readiness via `getSchoolLearnerReadiness` (`lib/core/academicActivation.ts`)
- Academic Structure → `/api/core/academic-readiness`, `activateSchool`/`getSchoolActivationStatus` (`lib/core/schoolActivation.ts`)
- Teachers → `/api/core/teachers?list=true`, `getSchoolTeacherReadiness`
- Reports → `lib/core/report-cards.ts` (`generateReportCards`, `publishReportCards`)
- Promotion → `lib/core/promotions.ts` (`runAnnualPromotion`)
- Transfers → `lib/core/transfers.ts` (`transferLearner`)

No teaching task (lesson plan, assignment grading, gradebook entry) appears anywhere in this page's composition. This is the reference implementation the rest of the audit measures against — the only correction needed is moving it out of `/teacher/*` into its own namespace (already recommended in the prior audit, §10).

---

## 5. Teacher Workspace Projection

**Mission's target chain:** Teacher → School Membership → Teacher Assignment → Current Academic Context → Teaching Responsibilities → Workspace Projection → {Lessons, Assignments, Attendance, Gradebook, Resources, Compass, Blueprint, Recommendations}.

**Audit against current implementation:**

| Step | Should read from | Currently reads from |
|---|---|---|
| Teacher identity | `school_users` membership | Legacy `teachers` table, no `school_users` check (`app/teacher/dashboard/page.tsx:50`) |
| Teacher Assignment | Core `class_subjects.teacher_id` | Legacy `teacher_classes.teacher_id` (same file, line 63) |
| Current Academic Context | `resolveActiveAcademicYear`/`resolveActiveTerm` (`lib/core/academicActivation.ts`) | Not consulted on the dashboard path at all |
| Teaching Responsibilities → Gradebook | `buildGradebook()` (`lib/gradebook/gradebook.ts`) | **Correctly delegated** — the one piece of this chain already built right |
| Teaching Responsibilities → Lessons/Attendance | Service call | Attendance: correctly composed via `/api/core/*`; Lessons: not sampled in this pass |
| Teaching Responsibilities → Resources/Compass/Blueprint/Recommendations | Service call (`lib/attentionFeed`, `lib/learnerBlueprint`) | Attention Feed: **correctly delegated** (`buildAttentionFeed`); classes list/insights: inline computation, no service |

**Verdict:** the chain is partially real. Where a service exists (gradebook, attention feed, attendance), the workspace is a genuine projection. Where no service exists yet (classes list, class detail, insights), the page/route becomes the source of truth for its own numbers by default — not by design, simply because nothing else was there to call. This is the single largest gap identified in this audit and the direct application-layer counterpart to the prior audit's "My Classes should read Core" finding.

---

## 6. Parent Workspace Projection

Not directly sampled in this pass (no `app/(parent)/**` pages were read), but the ownership contract is already correctly modeled at the repository layer: `lib/repositories/school.repository.ts`'s `findGuardianLink`/`listGuardianLearners` (lines 434-470) scope every parent-facing read to a verified `learner_guardians` row — a parent can only ever resolve learners they are actually linked to, never an arbitrary learner id. Per CLAUDE.md's standing rule, `learner_evidence`/Blueprint reads for a parent must go through `recomputeLearnerProjection`/`getLearnerTimeline`, same as any other consumer — no parent-specific bypass was found in the sampled files. Fees, permissions, and communication were not present in the sampled code and are correctly out of scope per the mission ("fees (future)").

**Recommendation for follow-up (not actioned here):** a dedicated pass reading `app/(parent)/**` should confirm this holds at the page level, not just the repository level — this audit's confidence here is one level shallower than the other four workspaces.

---

## 7. Learner Workspace Projection

Not directly sampled in this pass. The intelligence-boundary finding (§2, §9) applies here directly: whatever a learner sees of their own Compass/Blueprint/Career Intelligence must come from `recomputeLearnerProjection`/`composeBlueprint`/`capabilityExtractor` — the same canonical functions everything else in the platform is required to use, with zero learner-specific exception found or expected.

---

## 8. Educational Intelligence Projection

**This is the audit's cleanest result.** Grepping every `.from('learner_profiles')` and `.from('learner_evidence')` call site across the live tree found:

- Every non-test hit on `learner_profiles` is inside `lib/repositories/*.repository.ts` — the repository layer itself, which is expected and correct.
- Every non-test hit on `learner_evidence` is inside `lib/repositories/evidence.repository.ts` — same.
- No route, page, or feature module reads either table directly.
- `eslint.config.mjs:36-71` enforces this with an AST rule banning `repos.evidence.findByLearner`/`findConfirmedEvidenceForLearner`/`findPendingReview` from anywhere outside `lib/projection/**` and `lib/intelligence/**`, pointing offenders explicitly at `recomputeLearnerProjection`.
- A stale worktree (`.claude/worktrees/agent-aedf323a0b5ed2eb3/`) and `_frozen/eir/kgEvolution.ts` both contain direct `learner_profiles` access, but neither is live code — the worktree's equivalents in the current main-tree files have already been refactored to zero `.from()` calls, and `_frozen/` is explicitly retired.

**Educational Intelligence never owns institutional truth in the current codebase.** `lib/projection/*Projector.ts` files (academic/behaviour/capability/completeness/growth/knowledge/risk/trend, one file per signal) feed `engine.ts`/`recompute.ts`, which is the sole write path into the derived state everything downstream (Blueprint, Compass, Career Intelligence) reads from. No corrective action identified for this section.

---

## 9. Application Service Catalogue

Classifying what already exists:

**True application services (one function per use case, calling repositories, no direct DB in callers)**
- `lib/core/schoolActivation.ts` — `activateSchool`, `getSchoolActivationStatus`
- `lib/core/learnerOnboarding.ts` — `onboardLearner`, `getLearnerReadiness`
- `lib/core/teacherOnboarding.ts` — `inviteTeacher`, `acceptTeacherInvitation`, `listTeacherMemberships`, `getTeacherReadiness`
- `lib/core/promotions.ts` — `runAnnualPromotion`, `previewPromotion`, `getLearnerPromotionHistory`
- `lib/core/report-cards.ts` — `generateReportCards`, `publishReportCards`, `updateReportCard`, `getReportCard`, `listClassReportCards`
- `lib/core/endOfTerm.ts` — `runEndOfTerm`
- `lib/core/transfers.ts` — `transferLearner`, `getLearnerTransfers`
- `lib/core/guardianInvites.ts` — `createGuardianInvite`, `claimGuardianInvite`
- `lib/core/school.ts` — `createSchool`, `getSchool`, `ensureSchoolMembership`, `enableIntelligence`, academic-year/term CRUD
- `lib/core/academicActivation.ts` — readiness queries (`resolveActiveAcademicYear`, `resolveActiveTerm`, `resolveSubjectReadiness`, `getSchoolTeacherReadiness`, `getSchoolLearnerReadiness`, `getSchoolAcademicReadiness`)
- `lib/gradebook/gradebook.ts` — `buildGradebook`
- `lib/attentionFeed/aggregate.ts` — `buildAttentionFeed`
- `lib/learnerBlueprint/composeBlueprint.ts` — `composeBlueprint` (orchestrates ~19 single-purpose composers)
- `lib/projection/recompute.ts` — `recomputeLearnerProjection`
- `lib/learnerRecord/timeline.ts` — `getLearnerTimeline`

**Domain services (correctly factored, narrower than a full use case)**
- `lib/assessments/analyticsStats.ts` — `computeStudentRiskLevel` and similar pure-computation helpers
- `lib/projection/*Projector.ts` — one per signal type
- `lib/intelligence/pipeline.ts`, `evidenceLifecycle.ts` — evidence lifecycle mutations

**Repositories (correctly used only as data access, not decision-making)**
- `lib/repositories/*.repository.ts` — confirmed no business-rule computation found inside any sampled repository file; they select/insert/update and return rows.

**Missing — the actual gap this audit identifies**
- No `lib/core`-equivalent service for the legacy teacher-classes domain: "get my classes with student counts and average level," "get one class's roster with per-student standing," "get class insights" all currently live as inline route logic (§2) instead of a named service function. These three routes are the concrete backlog this catalogue is missing.

**Mixed responsibility (flagged, not necessarily wrong)**
- `lib/core/attendance.ts` — a genuine 16-function one-service-per-use-case file, but placed inside `lib/core/` rather than a sibling `lib/attendance/`, so School Office concerns and attendance-taking concerns share a file/folder. Low severity — the functions themselves are correctly scoped, only the folder placement blurs the bounded-context line.
- `lib/career/` — contains `clinicPdfRenderer.tsx` (a `.tsx` PDF-rendering file) and `clinicReportBuilder.ts` inside what is otherwise the Reasoning layer's folder; also has three overlapping "engine" files (`careerEngine.ts`, `careerIntelligenceEngine.ts`, `capabilityMatchEngine.ts`) whose boundaries were not fully disambiguated in this pass — worth a dedicated look, not urgent.

---

## 10. Use Case Catalogue

| Use Case | Input | Application Service | Domains Involved | Output Projection |
|---|---|---|---|---|
| Create School | Principal identity, school name | `createSchool` (`lib/core/school.ts`) | Core: School | Empty school, ready to activate |
| Activate School | `schoolId`, optional overrides | `activateSchool` (`lib/core/schoolActivation.ts`) | Core: Academic Year, Terms, Grades, Streams, Classes, Settings | School Office readiness = green |
| Invite Teacher | `schoolId`, teacher contact | `inviteTeacher` (`lib/core/teacherOnboarding.ts`) | Core: `school_users` (pending) | Pending invite, visible in School Office |
| Accept Invitation | `userId`, `schoolId`, profile | `acceptTeacherInvitation` | Core: `school_users` (active) | Teacher gains Teacher Workspace access |
| Assign Subject | `schoolId`, class, subject, teacher | `assignSubjectTeacher` (`lib/core/subjects` — cited in prior audit, not re-verified here) | Core: `class_subjects` | Teacher's "My Classes" gains an entry |
| Admit Learner | `schoolId`, learner details | `onboardLearner` (`lib/core/learnerOnboarding.ts`) | Core: Learner, Guardian, Enrollment | Learner appears in class roster |
| Enroll Learner | `learnerId`, `classId`, `termId` | (`ensureEnrolled`, inside `onboardLearner`, or standalone) | Core: `learner_enrollments` | Class roster count updates |
| Record Attendance | `sessionId`/`classId`, per-learner status | `recordAttendance`/`bulkRecordAttendance` (`lib/core/attendance.ts`) | Core: Attendance | Attendance report, learner history |
| Create Assignment | `classId`, content | `createAssignment` (not fully traced in this pass) | Teaching | Learner assignment list |
| Publish Report Cards | `schoolId`, `termId`, `classId` | `generateReportCards` → `publishReportCards` (`lib/core/report-cards.ts`) | Core + Blueprint snapshot (`createBlueprintSnapshot`) | Parent-visible report card |
| Run Compass | Learner session | `lib/compass/session.ts` + evidence pipeline | Compass, Evidence | Compass session result, feeds Evidence |
| Generate Blueprint | `learnerId` | `composeBlueprint` (`lib/learnerBlueprint/composeBlueprint.ts`) | Reasoning layer, ~19 composers | Full Blueprint document |
| Holiday Plan | Learner/class context | `lib/holiday/*` (not sampled this pass) | Reasoning layer | Holiday plan artifact |
| Career Intelligence | Learner grade/evidence | `capabilityExtractor.ts` + `careerEngine`/`careerIntelligenceEngine` | Reasoning layer | Career recommendation |

Rows left partially unverified ("not fully traced"/"not sampled this pass") are flagged rather than guessed — confirming them is a fast follow-up read, not a re-audit.

---

## 11. Projection Invariants

Permanent rules, stated so they can be checked against, not just aspired to:

1. **Workspaces never store institutional truth.** A workspace page/route may compute a display-ready shape but must not be the only place a fact exists. Violated today by `app/api/teacher/classes/[classId]/route.ts`'s inline `avgScore`/`overallLevel`/`daysInactive` — nowhere else in the codebase can produce that exact number without re-reading this route's source.
2. **Destroying a workspace changes nothing.** Deleting a page component must never lose data. Holds everywhere sampled — even the violating routes read from real tables, they just fail invariant 3, not this one.
3. **Rebuilding a workspace changes nothing.** Two independent implementations of the same projection must agree. Currently **violated** — the three independent CBC-level-label implementations (§2) are not guaranteed to agree if one is edited and the others aren't; they already represent silent drift risk, not just duplication.
4. **Institutional updates automatically appear in projections.** No workspace should require a manual refresh action to reflect an admin change. Holds for anything reading live via `fetch()`/server component on each load (all sampled pages) — no caching-without-invalidation pattern found in this pass, aside from the deliberate `Cache-Control: private, max-age=300` on `app/api/teacher/classes/route.ts:81`, which is a bounded, intentional staleness window, not a stale-forever risk.
5. **Teacher reassignment regenerates the workspace.** Requires Teacher Assignment to be read from `class_subjects.teacher_id` (Core), not `teacher_classes.teacher_id` (legacy, one row per teacher-invented class) — currently **not satisfied** on the legacy path per §5's table; satisfied wherever Core is already the read path (School Office).
6. **Learner admission regenerates class rosters.** Requires roster reads to come from `learner_enrollments` (Core), not a teacher-created `class_students` link to a teacher-created `students` row — same gap as invariant 5, same root cause (prior audit's §12 migration impact item).
7. **No manual synchronization.** No cron/script/manual step should be required to keep a workspace correct after an institutional write. No such manual-sync mechanism was found in this pass — the actual violation is upstream of synchronization: on the legacy path, there's no institutional write to synchronize *from* in the first place, because the teacher's own action *is* the write (prior audit, §2).

---

## 12. Codebase Impact

| File | Issue | Severity |
|---|---|---|
| `app/api/teacher/classes/[classId]/route.ts` | Inline `avgScore`/`overallLevel`/`daysInactive` computation, direct legacy-table reads, no service | **Critical** — invariant 1 and 3 both violated, and it's the primary class-detail view a teacher sees |
| `app/api/teacher/classes/[classId]/insights/route.ts` | Direct 5-table reads, inline aggregation for subject distribution and risk counts | **Critical** — same class of violation, feeds a teacher-facing insights screen |
| `app/api/teacher/classes/route.ts` GET | N+1 query pattern (2N+1 for N classes), inline avg-level computation | **Medium** — correctness risk is lower (list view, not per-student), but the N+1 is a real performance issue independent of the architecture question |
| `app/api/teacher/classes/route.ts` POST | Creates `teacher_classes` directly, no service function | **Critical** — already flagged in the prior audit as an ownership violation; here it's also the absence of a named application service for "create a class" |
| `app/teacher/dashboard/page.tsx:50-66` | Direct legacy-table reads for teacher/class identity, bypasses `lib/core/permissions.ts` | **Critical** — this is the landing page every teacher sees first; the identity resolution it does is exactly the chain §5 says should come from `school_users`/`class_subjects` |
| Three duplicate `levelLabel`-style functions | Business-rule drift risk (invariant 3) | **Medium** — not wrong today, but has no mechanism preventing future disagreement |
| `lib/core/attendance.ts` folder placement | Bounded-context blur (School Office file holds attendance-taking logic) | **Minor** — functions themselves are correctly use-case-scoped; only the folder location is off |
| `lib/career/clinicPdfRenderer.tsx` inside Reasoning-layer folder | UI-adjacent code in a domain folder | **Minor** — doesn't cause a live bug, just misplaced |
| `lib/core/report-cards.ts` / `promotions.ts` → `lib/learnerBlueprint`, `lib/core/academicBridge.ts` → `lib/compass` | One-directional cross-boundary import | **Minor** — narrow, read-only, already isolated to 3 call sites; flagged for awareness, not urgent |
| `app/api/teacher/gradebook/[classId]/route.ts` | (clean) | **False Positive** — included only as the reference counter-example, not a violation |
| `app/teacher/attendance/page.tsx` | (clean) | **False Positive** |
| `app/teacher/core-office/page.tsx` | (clean) | **False Positive** |
| `app/api/teacher/attention-feed/route.ts` | (clean) | **False Positive** |
| Educational Intelligence boundary (`learner_profiles`/`learner_evidence` access) | No live violations found | **False Positive** — the one section of this audit that returned a clean bill of health |
| `.claude/worktrees/agent-aedf323a0b5ed2eb3/`, `_frozen/eir/kgEvolution.ts` | Direct `learner_profiles` access | **False Positive** — stale worktree / explicitly retired code, not live |

---

## 13. Migration Strategy

Safest sequence — extract-before-redirect, so nothing is renamed or moved until the thing it should call already exists and is tested:

1. **Extract, don't yet redirect.** Create `lib/teacherClasses/` (or extend `lib/gradebook/` if the domain overlap is close enough) with pure functions for: class-list-with-stats, class-detail-with-roster-standing, class-insights. Move the exact logic currently inline in the three flagged routes into these functions verbatim first — no behavior change, just a location change. This directly resolves invariant 3 (three duplicate label functions collapse into one shared function) with zero risk, since it's a pure refactor.
2. **Fix the N+1 in the same pass** (`app/api/teacher/classes/route.ts` GET) — batch the per-class `class_students`/`assessments` queries with `.in()`, matching the pattern `lib/gradebook/gradebook.ts` and `lib/attentionFeed/aggregate.ts` already use. Safe to combine with step 1 since both touch the same function being extracted.
3. **Redirect the routes to call the new functions.** Routes become thin, matching the `gradebook`/`attention-feed` pattern. No schema change, no ownership change — purely an application-layer cleanup, independently shippable before or after the prior audit's ownership-migration steps.
4. **Only after the prior audit's §13 steps 3-4 land** (Teacher Workspace reads Core `class_subjects` instead of legacy `teacher_classes`), update the newly-extracted `lib/teacherClasses/` functions to read from Core instead of legacy tables — this is the point where invariants 5 and 6 actually become satisfied, and it's a one-place change because step 1 already consolidated all three routes onto shared functions.
5. **Fold the folder-placement minor findings** (`lib/core/attendance.ts` → `lib/attendance/`, `clinicPdfRenderer.tsx` out of `lib/career/`) into ordinary refactor hygiene whenever those files are next touched for an unrelated reason — not worth a dedicated migration step.
6. **Leave the three narrow `lib/core → lib/learnerBlueprint/lib/compass` imports as-is** unless a future change needs to add a write in that direction — at that point, promote the shared concept (blueprint-snapshot-on-publish, compass-ownership-check) into a small shared interface both sides depend on, rather than one importing the other's internals directly.

No step in this sequence requires a database migration, a breaking API change, or touches the Educational Intelligence boundary (§8), which needs no correction.

---

## 14. Final Recommendation

**Don't design a new Application Layer — finish rolling out the one that already exists in `lib/core/*` to the three teacher-facing routes that never got one.** This audit found a real, working reference implementation (School Office's composition pattern, gradebook's service extraction, the Educational Intelligence boundary's ESLint enforcement) sitting right next to the violations it's meant to prevent. The corrective work is almost entirely extraction of already-written logic into named, shared functions — not new design, not new business rules, and (per §13) sequenced so it can ship independently of, and safely before, the prior audit's ownership-model migration.

Per Architecture Guardian Mode, this document is evidence and design only — no code was changed. §13's steps are ready for founder review before authorization to start.
