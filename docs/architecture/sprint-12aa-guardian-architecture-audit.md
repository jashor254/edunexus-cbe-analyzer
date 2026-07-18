# Sprint 12AA — Guardian Architecture Audit

**Status: AUDIT ONLY. No code, schema, or ADR content changed by this sprint.**
**Scope**: every Blueprint-related domain built in Sprint 12A–12Z (Blueprint, Blueprint Snapshots, Parent Experience, Portfolio, Achievement, Projects) plus its ADR series (ADR-0003–0013), performed before Sprint 13 (Competitions, Leadership, Community Service, Wellbeing, Innovation).

**Method**: four parallel grounded research passes over the actual codebase (not documentation alone) — file:line citations required for every claim, cross-checked against `git log`. Full raw findings retained in session; this document is the synthesized verdict.

---

## PHASE 1 — Canonical Ownership Audit

| Section | Owner | Canonical function | Repository/table | Freshness |
|---|---|---|---|---|
| Identity | `lib/core/learners`, `lib/core/school` | `getLearner`, `getLearnerHistory`, `getSchool` | Core tables | live |
| Academic Record | `lib/projection/recompute.ts` | `recomputeLearnerProjection` | Projection Engine | live |
| Attendance | `lib/core/attendance.ts` | `getLearnerAttendanceHistory` | `repos.attendance` | snapshot |
| Learning Compass | `lib/compass/summary.ts` | `getLearningCompassSummary` | `repos.learnerIntelligence` | live |
| Career Intelligence | `lib/learnerIntelligence/careerIntelligence.ts` | `getCareerBlueprintSummary` | Projection + capability engine | live |
| Portfolio | `lib/learnerPortfolio/portfolio.ts` | `getPortfolioSummary` | `repos.portfolios` | live |
| Achievement | `lib/learnerAchievement/achievement.ts` | `getAchievementSummary` | `repos.achievements` | live |
| Projects | `lib/learnerProjects/project.ts` | `getProjectsSummary` | `repos.projects` | live |
| Teacher Reflection | `lib/teacherReflection/reflection.ts` | `findCurrent` | `repos.teacherReflections` | live |
| Parent Actions | `lib/parentExperience/actions.ts` | `composeParentActions` | reads sibling sections + snapshots | derived |
| Growth Timeline | unassigned — reserved | none (`not_implemented`, always `[]`) | none | n/a |
| Historical Snapshots | `lib/learnerBlueprint/snapshot.ts` | `createBlueprintSnapshot`/`getLatestBlueprintSnapshot` | `repos.blueprintSnapshots` | snapshot |
| Evidence Trace | not implemented — inert placeholder (`EvidenceTrailPlaceholder.tsx`), by design per ADR-0005 §3 | none | none | n/a |

Every section has exactly **one** owning function inside the canonical `composeBlueprint()` orchestration. No second calculation of these facts was found *within* `lib/learnerBlueprint/`.

### Finding 1 — CRITICAL: Two live, independently-computed "Learner Blueprint" systems

`lib/learnerIntelligence/blueprint.ts` (`buildLearnerBlueprint()`) is a second, complete Blueprint builder that does **not** call `composeBlueprint()` or any `composeX()` function. It is still live behind `app/api/learner-intelligence/blueprint/route.ts`, consumed by `components/teacher/LearnerBlueprint.tsx`, which is rendered by two real routes: `app/teacher/reports/blueprint/[studentId]/page.tsx` and `app/(student)/blueprint/page.tsx` (via `components/student/StudentBlueprint.tsx`). It independently calls `extractCapabilityProfile`, `computeQuickWins`, and `recomputeLearnerProjection` and builds its own insight text, rather than delegating to the canonical composers.

**Consequence**: a teacher opening `/teacher/reports/blueprint/[studentId]` and a parent opening `/child/[learnerId]` (canonical path) can see two independently-computed "Blueprints" for the same learner — a direct violation of "exactly one owner" and, more importantly, of the Constitution's evidence-first "one truth" principle, since both are presented as authoritative to different stakeholders in the same learner's record.

This predates Sprint 12A–12Z (the legacy builder existed before Blueprint's canonical composer was built) and was never migrated when the canonical composer shipped — it is a carried-forward gap, not something Sprint 12 introduced, but it is real, live, and load-bearing right now.

### Finding 2 — Career computed three separate ways in production
1. `lib/learnerBlueprint/composeCareer.ts` → `getCareerBlueprintSummary` (canonical, Blueprint)
2. `lib/learnerIntelligence/careerIntelligence.ts` → `buildCareerIntelligence` (legacy, still routed via `app/api/learner-intelligence/career/route.ts`)
3. `lib/academicClinic/careerEngine.ts` (3035 lines) → explicitly self-documented as legacy, scoped only to the Academic Clinic PDF/WhatsApp report, not canonical

`composeCareer.ts`'s own header comment records that path 3 was deliberately abandoned in Sprint 12N for showing specific careers to Junior learners in violation of the Career Principle — good evidence the platform already knows path 3 is wrong, yet it is still live.

---

## PHASE 2 — Read Direction Audit

**Confirmed: `composeBlueprint()` is strictly read-only.** No `.insert(`, `.update(`, `.upsert(`, or `.delete(` anywhere in `composeBlueprint.ts` or any `composeX.ts` file. No cached/stored duplicate of Blueprint data exists outside the sanctioned Snapshot mechanism.

The **only** write touching Blueprint output is `lib/learnerBlueprint/snapshot.ts:62` (`createBlueprintSnapshot`), which composes via `composeBlueprint()` and freezes the result — gated to exactly three trigger sites (`lib/core/promotions.ts`, `lib/core/report-cards.ts`, `lib/core/endOfTerm.ts`). This is an intentional, documented write (ADR-0008 Part 3), not a violation: Blueprint composition itself never mutates anything; only the explicitly-designed Snapshot freeze does, and it never runs on a read path.

`components/blueprint/*`, all Blueprint-related `app/` pages, and `app/api/learner-intelligence/blueprint/route.ts` (GET-only) — clean, no mutation found.

**Verdict: PASS.** No accidental write paths, no hidden repository updates, no cached summaries outside the sanctioned Snapshot table.

---

## PHASE 3 — Composition Audit

`composeBlueprint.ts` calls 14 composers (`composeIdentity`, `composeAcademicRecord`, `composeAttendance`, `composeLearningCompass`, `composeCareer`, `composePortfolio`, `composeAchievement`, `composeProjects`, `composeTeacherReflection`, `composeParentSummary`, `composeEducationalIdentity`, `composeGrowthTimeline`, `composeRecommendedNextSteps`, `composeMetadata`) via one `Promise.all`. Every one is defined exactly once, in its own file, with no duplicate/legacy composer of the same name found anywhere else in the codebase.

**However**, as documented under Finding 1/2 above, alternate builders that reimplement composition under different names (not `composeX`) do exist and are live: `lib/learnerIntelligence/blueprint.ts`, `lib/academicClinic/reportGenerator.ts` / `pdfGenerator.tsx`, `lib/academicClinic/careerEngine.ts`. These would not be caught by a naive `composeX` name search — worth noting as a blind spot for future audits.

**Verdict: The canonical composition engine itself has no internal duplication. The platform-wide duplication lives outside it, in code that never migrated to call it.**

---

## PHASE 4 — Intelligence Audit

**Clean.** `composeBlueprint.ts` is a pure orchestrator — no scoring, readiness, or confidence computation happens inside it or any `composeX.ts` file. Every intelligence-bearing field (`confidence`, `lastComputed`, `readiness`) is a passthrough from its owning canonical engine (Projection, Compass, Career, Attendance-tally).

The one place arithmetic happens is `composeAttendance.ts`, which tallies already-labeled present/absent/late/excused counts into a percentage — explicitly sanctioned by ADR-0004 §4 as a "derived value computed by the consumer," not a new calculation. No trend/health/risk label is computed (a documented, not-yet-built gap, not a silent violation).

Where evidence is insufficient, sections return `null`/`unavailable` with a reason string (`composeLearningCompass.ts`, `composeCareer.ts`) rather than a default or floor value — correct evidence-first behavior.

**Verdict: PASS. No hidden or duplicated intelligence computation inside Blueprint.**

---

## PHASE 5 — Constitution Audit

Located the Educational Constitution at `docs/sprint-25-educational-constitution-and-migration-strategy.md`.

| Principle | Status | Evidence |
|---|---|---|
| Evidence First | Honored | Every section names its canonical source function |
| Missing evidence ≠ poor performance | Honored | `null`/`unavailable` returned, never a zero/default |
| AI explains, doesn't invent | Honored (by absence) | No AI call anywhere in `lib/learnerBlueprint/` |
| Teacher remains accountable | Honored | Teacher Reflection reads only a teacher-published record, never auto-generates one |
| Career recommends, doesn't dictate | Honored | Only `careerCluster` surfaced, never a specific job, with the Sprint 12N history to prove the platform corrected itself on this exact point |
| Numbers require names | **Documented gap, not silent** | Attendance returns a bare percentage with no health/trend label — ADR-0006 §5 explicitly defers this, doesn't hide it |
| Freshness labels | Honored | Every section carries `freshness`; Blueprint-wide freshness downgrades to `partial` if any section is unavailable |
| Evidence traceability | Honored | `confidence`/`lastComputed` pass through Projection's evidence-backed values unmodified |

**Verdict: Substantially compliant.** The one open item (attendance health labeling) is a known, ADR-acknowledged deferral, not a violation discovered by this audit. The Constitution is honored inside the canonical path; it is **not** honored by the parallel legacy Blueprint (Finding 1), which computes its own insight text independently and has not been checked against the Constitution by this or any prior audit — flagged as a real compliance gap in Finding 1's blast radius, not a new separate finding.

---

## PHASE 6 — ADR Consistency Audit

No contradictions found in the core ownership/read-direction chain across ADR-0003 → ADR-0013. Two "drifts" found are both **self-documented, reasoned amendments**, not silent inconsistencies:
- ADR-0009 §3 explicitly flags that its disclosure order differs from ADR-0005's ownership order, and states why that's allowed.
- ADR-0012 explicitly and by name partially supersedes ADR-0011 for Competitions/Leadership/Community Service/Innovation/Certifications, moving them to Achievement ownership. ADR-0013 explicitly "touches but does not supersede" ADR-0011's `projects` category. Both are named, reasoned, and match the RAS's own evolution discipline.

### Finding 3 — MEDIUM: ADR-0013's status header was never updated post-ship
ADR-0013 still reads `Status: DRAFT — awaiting explicit approval` and its own Stop Condition says "no code... wait for explicit approval before Sprint 12Z." Sprint 12Z fully shipped (`git log`: `1da29b4`, `7b9db2e`, `6975257`, `b12ba4d`, `b09925b`, `758a85e`), and `composeProjects()` is live and wired into `composeBlueprint.ts`. Compare to ADR-0011 (`Status: APPROVED`) and ADR-0012 (`Status: IMPLEMENTED`), both updated after their sprints landed. This is a paperwork gap, not a functional one — the shipped content matches ADR-0013's design exactly.

### Finding 4 — LOW: an open item from ADR-0005/0006 was never closed
Both ADRs reference an "uncommitted worktree" (`.claude/worktrees/agent-aedf323a0b5ed2eb3`, containing `lib/learnerIntelligence/reportGenerator.ts`/`app/api/learner-intelligence/pdf/route.ts`) that "must be reconciled before any future sprint touches `lib/learnerIntelligence/`." This worktree still exists on disk as of this audit. No later ADR records it being resolved.

**Verdict: ADR series is internally coherent in substance. Two paperwork-level gaps found (Finding 3, Finding 4), zero substantive contradictions.**

---

## PHASE 7 — Snapshot Audit

**Immutability**: enforced at the database layer, not just application code. `supabase/migrations/20260717120000_blueprint_snapshots.sql` installs `enforce_blueprint_snapshot_immutability()` as `BEFORE UPDATE`/`BEFORE DELETE` triggers that unconditionally raise — holds even against the service-role client. `blueprintSnapshot.repository.ts` exposes no `update`/`delete` method at all.

**Versioning**: no numeric version column; each row carries `schema_version` so future Blueprint schema changes never rewrite old payloads. "Latest" is `created_at DESC`, computed by exactly one function (`getLatestBlueprintSnapshot`).

**History viewer**: `app/student/blueprint/[learnerId]/history/*` and a parent-portal mirror, both reusing `BlueprintView` with a `historicalMeta` prop — no second renderer.

**Lifecycle**: created only from three named trigger sites (promotion, report-card publication, end-of-term) matching the DB `CHECK` constraint. No cron creates snapshots directly.

**No second snapshot engine found** — the migration's own header documents an audit that explicitly ruled out `school_intelligence_snapshots`, `academic_reports`, `student_clinic_reports`, `clinic_reports`, `school_report_cards` as wrong-domain/legacy alternatives.

**Verdict: PASS. This is the strongest-engineered domain in the whole audit.**

---

## PHASE 8 — Parent Experience Audit

`lib/parentExperience/` is a pure consumer — zero `.insert(`/`.update(`/repository writes found in `actions.ts`, `growthTimeline.ts`, `terminology.ts`. All functions take already-composed Blueprint data as input and only select/relabel it.

### Finding 5 — HIGH: two parallel "what should the parent do" systems remain unconsolidated
`lib/parentExperience/actions.ts`'s own header comment documents finding **six** independent "tell the parent what to do" generators in a prior audit pass, and states plainly that the new Parent Action Centre "does not touch, call, or duplicate any of them." One of the six, `lib/parentPulse/` (`builder.ts`, `observationPipeline.ts`), is not dead — it is fully live, driving `app/api/cron/parent-pulse/route.ts` (WhatsApp nudge cron) and `app/api/whatsapp/inbound/route.ts`. **Two parallel parent-guidance systems run in production simultaneously**: the WhatsApp Parent Pulse cron and the Parent Portal Action Centre, with no documented consolidation plan and no entry in `deprecation-registry.md`.

**Terminology**: single frozen translation layer (`terminology.ts`), no second table found.

**Verdict: Parent Experience itself is architecturally clean as a consumer. The platform-wide "who tells the parent what to do" ownership question (Finding 5) remains open, same root cause as Finding 1/2 — Sprint 12S added a sixth generator instead of retiring the other five.**

---

## PHASE 9 — Portfolio / Achievement / Projects Audit

Table ownership is clean: each domain writes only its own table(s), confirmed by grep of every `.from(...)` call. `lib/learnerPortfolio/portfolioProjectLink.ts` is the one sanctioned cross-domain read (Portfolio → Projects, summary-only, never a full record) — matches ADR-0013's "Portfolio references Projects, never duplicates it."

Type-level boundaries are explicit and enforced by comment discipline: Portfolio's types file states it "deliberately excludes every concept ADR-0012 assigns to Achievement"; Projects' types file states it owns "the work... never a score, never a competency, never an achievement."

No shared file-upload utility exists, but there's also no duplicated file-upload logic to consolidate — all three domains store plain URL strings via their own junction tables.

### Finding 6 — MEDIUM: verification/lifecycle state-machine logic copy-pasted three times
`portfolio.ts::verifyItem`, `project.ts::verifyProject`, and `achievement.ts::verifyAchievement` each independently reimplement the same shape: status-guard check, `repos.teachers.findSchoolUser(...)` verifier-attribution lookup, near-identical error message wording. No shared state-machine helper exists. Given each domain's explicit "distinct ownership" design intent, this is plausibly deliberate independence rather than an architecture violation, but it is a real maintenance-cost duplication: a future change to the verifier-attribution rule has to be made identically in three places.

**Verdict: Domain boundaries are correctly enforced. Finding 6 is a code-duplication concern, not an ownership violation.**

---

## PHASE 10 — Migration Readiness Audit

`composeBlueprint()` uses a fixed-shape object composition (a hardcoded `Promise.all` + object literal over an explicit `LearnerBlueprint` type), not a plug-in/registry pattern. Diffing the three most recent domain additions (Portfolio, Achievement, Projects — `git show` on their landing commits) shows every addition touched the same five files, every time, in a small, purely additive, mechanical diff:

1. New `composeX.ts` (~50 lines)
2. `composeBlueprint.ts` — 3-line addition (import, `Promise.all` entry, `sections` object key)
3. `types.ts` — one new required field
4. `validation.ts` — one line
5. Test fixtures — updated to satisfy the now-exhaustive type

This pattern has repeated three times with zero deviation. Adding Competitions, Leadership, Innovation, Community Service, or Wellbeing would follow the identical, well-precedented path: 1 new composer + 1 new repository + 3 mechanical shared-file edits. **Portfolio Expansion / Evidence Expansion** (extending an existing section) touches even less, since each section's `data` shape is section-owned.

**Verdict: Blueprint is not zero-touch extensible, but it is low-risk, well-precedented, additive-only extensible. Sprint 13's new domains do not require redesigning Blueprint.**

---

## PHASE 11 — Technical Debt Audit

| # | Finding | Severity |
|---|---|---|
| 1 | Two live, parallel Blueprint engines (`composeBlueprint()` vs. `lib/learnerIntelligence/blueprint.ts`, still teacher/student-facing) | **Critical** |
| 2 | Six parallel "tell the parent what to do" generators, five uncontested by Sprint 12S's new sixth | High |
| 3 | `lib/parentPulse/` fully active in parallel with `lib/parentExperience/`, no consolidation plan | High |
| 4 | Three parallel career computation paths, only one self-documented as deprecated | Medium |
| 5 | Academic Clinic legacy path (`lib/academicClinic/`) fully routed and live — already tracked in `deprecation-registry.md` as unresolved | Medium |
| 6 | Verification/lifecycle logic copy-pasted across Portfolio/Achievement/Projects | Medium |
| 7 | ADR-0013 status header not updated post-ship (Finding 3 above) | Low |
| 8 | Uncommitted worktree from ADR-0005/0006, still unreconciled (Finding 4 above) | Low |
| 9 | `lib/curriculum/regional/ke-cbc.ts` — confirmed dead, already tracked in registry, never actioned | Low |
| 10 | No TODO/FIXME/HACK found in any audited domain; no dead `composeX` functions; no orphaned Blueprint-related repositories | — (clean) |

`deprecation-registry.md` correctly tracks item 5 but has **zero entries** for items 1–4, despite the registry's own stated policy that duplications should be recorded "from the moment a canonical replacement is designated" — and `composeBlueprint()` / `composeParentSummary` already designate themselves canonical in their own header comments.

---

## PHASE 12 — Guardian Verdict

| Metric | Score | Basis |
|---|---|---|
| Architecture Score | 78/100 | Canonical path (composeBlueprint, snapshots, Portfolio/Achievement/Projects, Parent Experience) is excellent; score is held down entirely by unmigrated legacy parallel systems (Findings 1, 2, 4) |
| Maintainability Score | 74/100 | Clean composition pattern and strong test-fixture discipline; docked for copy-pasted verification logic (Finding 6) and un-registered duplications |
| Extensibility Score | 88/100 | Phase 10: three consecutive domain additions with an identical, low-risk, mechanical diff footprint |
| Constitution Compliance | 82/100 | Canonical path fully compliant; legacy Blueprint (Finding 1) has never been checked against the Constitution and independently computes insight text |
| RAS Compliance | 80/100 | Ownership, read-direction, and freshness rules honored inside `lib/learnerBlueprint/`; RAS's "no consumer composes independently" rule is violated by Finding 1 |
| Migration Readiness (Sprint 13) | 90/100 | New domains are additive-only and don't require touching legacy systems to ship |

### Top 10 Strengths
1. `composeBlueprint()` is 100% read-only — verified by exhaustive grep, zero exceptions.
2. Blueprint Snapshots are immutable at the **database trigger** level, not just convention — the strongest guarantee in the codebase.
3. Every Blueprint section has exactly one canonical owner with no internal duplication.
4. Three consecutive new-domain additions (Portfolio, Achievement, Projects) followed an identical, small, mechanical diff pattern — proven extensibility, not theoretical.
5. Evidence-first discipline is real: sections return `null`/`unavailable` with reasons rather than fabricated defaults.
6. The Career Principle violation from Sprint 12N was caught and fixed by the team itself, and the fix is documented in the code that replaced it.
7. Cross-domain references (Portfolio→Projects) are summary-only and explicitly designed to avoid duplication.
8. ADR series is substantively coherent across 11 documents with reasoned, named amendments rather than silent contradictions.
9. Parent Experience is architecturally a pure consumer with zero data-layer calls.
10. Zero TODO/FIXME/HACK debt markers found in any audited domain.

### Top 10 Risks
1. **Two live Blueprint engines computing different content for the same learner, shown to different roles (Finding 1).**
2. Six parallel parent-guidance generators, only one of six ever consolidated (Finding 2/5).
3. `lib/parentPulse/` (WhatsApp) and `lib/parentExperience/` (portal) both live with no merge plan.
4. Three parallel career computation paths in production.
5. `deprecation-registry.md` is silently out of date for exactly the domains this sprint sits on top of.
6. Verification-lifecycle logic triplicated across Portfolio/Achievement/Projects — any rule change now needs three edits.
7. Attendance section still lacks a health/trend label (self-acknowledged gap).
8. ADR-0013 status header contradicts its own shipped state.
9. Unreconciled worktree flagged by two ADRs, still unresolved.
10. No audit has yet checked the legacy Blueprint (`lib/learnerIntelligence/blueprint.ts`) against the Constitution — its compliance status is simply unknown.

### Top 10 Future Opportunities
1. Retire `lib/learnerIntelligence/blueprint.ts` and repoint `LearnerBlueprint.tsx`/teacher & student routes to `composeBlueprint()`.
2. Pick one of the three career paths as canonical and delete the other two.
3. Decide `parentPulse` vs. `parentExperience`'s long-term relationship (merge triggers, or explicit division of labor) and record it.
4. Extract a shared `verifyDomainItem()` state-machine helper for Portfolio/Achievement/Projects.
5. Build the deferred Attendance health/trend/risk label now that three sections already model `freshness` correctly.
6. Backfill `deprecation-registry.md` with Findings 1, 2, 3, 4 (this audit's own items) so they're trackable.
7. Update ADR-0013's status header to match shipped reality.
8. Reconcile or delete the flagged worktree.
9. Build Growth Timeline now that three real domains (Portfolio/Achievement/Projects) give it real events to timeline.
10. Use the proven 5-file addition pattern (Phase 10) as a literal checklist template for Sprint 13's new domains.

### Most Important Recommendation
**Do not let Sprint 13 add a 15th composer to `composeBlueprint()` while the platform still shows two different Blueprints to a teacher and a parent for the same learner.** The dual-engine problem (Finding 1) is not caused by Sprint 13 and does not block it technically — but every sprint that doesn't retire the legacy path makes the eventual migration larger. Schedule a dedicated, small, single-purpose sprint to retire `lib/learnerIntelligence/blueprint.ts` and its two consumer routes before Sprint 13 ships anything teacher-facing.

### Can Sprint 13 safely begin?

**APPROVED WITH MINOR FIXES**

Reasoning: none of the findings in this audit are inside the canonical `composeBlueprint()` path Sprint 13 would extend — that path is read-only, single-owner, non-computing, and proven extensible across three consecutive real additions (Phase 10). The Critical finding (dual Blueprint engines) is pre-existing legacy debt, not something Sprint 13 creates, and is orthogonal to whether new sections can be safely composed. It does **not** meet this audit's bar for "absolutely requires" implementation work mid-audit (STOP CONDITION), because fixing it means migrating live teacher/student-facing consumer routes — real scope, not a minor fix, and better done as its own planned, isolated sprint per the Post-Audit Operating Charter's "small trustworthy fixes only" standing guidance.

Minor fixes recommended before or alongside Sprint 13 (no code in this sprint; listed for the next planning pass):
- Update ADR-0013's status header (Finding 3).
- Add Findings 1, 2, 3, 4 to `deprecation-registry.md` so they are tracked, not just discovered.

Major fix required, but scheduled as its own sprint, not blocking Sprint 13: retire the legacy Blueprint engine (Finding 1).

---

*No code, schema, or ADR content was modified in the production of this audit. All findings are grounded in direct file reads and `git log` at the time of writing (2026-07-18).*
