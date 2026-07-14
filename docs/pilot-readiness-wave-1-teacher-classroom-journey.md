# EduNexus — Pilot Readiness Wave 1 Report

**Teacher Classroom Journey**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: audit only, no code changed. Traces the full teacher-facing journey (onboarding → SOW → lesson planning → teaching → assessment → learner intelligence → parent communication → holiday planning → end of term → next term) against the standard of "can a real Kenyan teacher use this comfortably for an entire term." Follows Implementation Waves 1–3, which established that the platform's underlying intelligence is now computed once and read consistently everywhere. This wave asks a different question: does a teacher ever actually get to use that intelligence without friction, duplication, or a dead end.

---

## 1. Executive Summary

The academic backbone — Scheme of Work → Lesson Plan → Record of Work → Assessment — is genuinely well built: RoW auto-generates from taught lesson plans without teacher re-entry, lesson plan generation pulls its inputs straight from the saved SOW with no re-typing, and the gradebook gives live per-keystroke feedback (totals, mean, grade, position). This is real, working, time-saving software.

But five concrete, traceable gaps would be visible to a real teacher within the first few weeks of a pilot term, not theoretical:

1. **The Monday Panel — the platform's single richest source of "what should I do about this student" — has zero interactive elements.** Every risk flag, peer-pairing suggestion, and prerequisite warmup is text a teacher must act on somewhere else. The one feature purpose-built to close this loop, intervention check-in, is a fully working API with **no UI anywhere that calls it.**
2. **A whole assessment system is orphaned.** The "Academic Clinic" `assessments` table has no teacher-facing way to populate it, yet a teacher's own class page has a "Clinic" tab that depends on it and shows a bare "⚠️ missing assessment" warning with no explanation or link.
3. **Parent Pulse tells parents "the teacher has been notified" when nothing notifies the teacher.** This is a false promise a real parent could act on and be wrong about.
4. **Next-term rollover barely exists.** Only the term record itself carries forward — the SOW must be rebuilt from scratch every term, and Core end-of-term (which generates report cards) is architecturally unbridged from the Holiday Planner, so finishing a term does not trigger holiday plans.
5. **A five-level school-hierarchy approval chain (Teacher→HOD→Deputy→Principal→Parent) does not exist in the schema or code and would require inventing four new role types from nothing** — correctly out of scope, but worth stating plainly rather than leaving ambiguous.

None of these are computation bugs — Waves 1–3 already established the intelligence itself is sound and convergent. These are workflow and wiring gaps: good insights that never reach a button, and page transitions that assume knowledge the platform already has.

**Verdict: CONDITIONAL GO** — the core weekly teaching loop (plan → teach → assess) is pilot-ready as-is; the intelligence-to-action loop (risk → intervention → parent) is not, and should not be presented to pilot teachers as more actionable than it currently is.

---

## 2. End-to-End Teacher Journey

Traced by direct code reading (routes, pages, and their actual call graph — not assumed from names):

```
Sign up → app/teacher/setup (name, free-text school, TSC number)
        → POST /api/teacher/profile
        → redirect /teacher/scheme-of-work (empty list)
        → /teacher/scheme-of-work/new (5-step wizard: curriculum/grade/subject → strands → lesson structure → breaks → generate)
        → save → success screen: Download PDF/Text, New Scheme, "Create Record of Work →"
        → [DEAD END: no lesson-plan CTA here — see §3]
        → teacher must independently return to /teacher/scheme-of-work
        → click "Generate Wk N" on the scheme card
        → lesson plan generated, pulling subject/grade/term/curriculum/strand from the saved SOW row server-side (no re-entry)
        → RoW auto-generated weekly by cron once a newer week exists (no teacher re-entry of what was taught)
        → Classes → class → Assessments tab → New Assessment → Enter Marks (Excel-like grid or CSV upload)
        → "Save All Marks" → live toast, live recompute (mean/grade/position)
        → [SILENT GAP: struggling-learner alerts created server-side, never mentioned in the save toast — see §3]
        → Monday Panel (weekly teacher brief) shows risk/peer-pairing/prerequisite/career insights
        → [DEAD END: zero clickable elements — teacher must act on all of it manually elsewhere — see §3]
        → Parent Pulse (weekly Sunday batch) sends one concern per student per week via WhatsApp
        → Holiday Planner generates automatically from Projection + career intelligence (no re-entry)
        → teacher approves via Holiday Plans Publish Gate (real UI action, 3-day auto-publish fallback)
        → Core end-of-term (admin-triggered) generates + auto-publishes report cards, advances the Term record
        → [GAP: does not trigger holiday plan generation — separate, unbridged system — see §3]
        → Next term: only the Term record carries forward; SOW is rebuilt from scratch
```

No stage of this journey is entirely blocked — a determined teacher can get end-to-end. The gaps are friction and lost value, not hard failures.

## 3. Workflow Bottlenecks

| # | Bottleneck | Evidence | Severity |
|---|---|---|---|
| 1 | Monday Panel has no interactive elements across all 5 tabs (students/patterns/prereqs/checkins/moments) | `app/teacher/classes/[classId]/page.tsx:1636-1774` — plain `<div>`/`<p>` rendering, no `<button>`/`onClick`/link found | **High** |
| 2 | Intervention check-in is a complete, correct API with zero UI callers | `app/api/teacher/intervention-checkin/route.ts` POST records outcome, recomputes risk, emits evidence; grep across `app/**/*.tsx` found no call sites; Monday Panel's "Check-ins" tab is static text | **High** |
| 3 | Struggling-learner alerts are computed on marks save but never surfaced at that moment | `app/api/teacher/assessments/[assessmentId]/marks/route.ts:85-121` inserts `student_alerts`; the save toast only says "Saved N learners — positions calculated" | Medium |
| 4 | Marksheet re-types student names as free text instead of pulling the class roster, then re-matches by name string later | `app/teacher/classes/[classId]/assessments/[assessmentId]/page.tsx:81-92,149-153`; `marks/route.ts:103-107` matches via `student.name.toLowerCase()` — a typo silently breaks both the alert and the Learner Model update (fire-and-forget) | Medium |
| 5 | SOW → Lesson Plan generation success screen has no direct CTA to the next stage | `app/teacher/scheme-of-work/new/page.tsx:1107-1145` — only Download/New Scheme/Create RoW; teacher must independently find "Generate Wk N" on the list page | Medium |
| 6 | New teacher whose free-text school name doesn't fuzzy-match leaves them silently unlinked from Core, with no error and no fix UI | `lib/core/school.ts:49-86` `ensureSchoolMembership` — logs into a "reconciliation backlog" with no UI | Medium |
| 7 | Report cards auto-publish with no teacher approval gate, unlike the Holiday Plan's real gate | `lib/core/endOfTerm.ts:60-84` | Low–Medium (may be intentional — report cards are only generated once every assessment is already published) |
| 8 | Core end-of-term and the legacy Holiday Planner are architecturally unbridged — finishing a term doesn't generate holiday plans | `lib/core/endOfTerm.ts:1-14` explicitly documents the schema mismatch (`learner_enrollments` vs `students`/`teacher_classes`) | Medium |

## 4. Duplicate Work Inventory

| Duplication | Where | Notes |
|---|---|---|
| Two live lesson-plan generation endpoints | `app/api/lesson-plans/generate/route.ts` (marked "canonical," writes to `jobs`) vs `/generate-week/route.ts` (older, writes to `generation_jobs`) — the scheme list page actually calls the **non-canonical** one | Split-brain risk if both remain reachable |
| School name captured twice as independent free text | `app/teacher/setup/page.tsx:15,34` and again (pre-filled but editable) in `app/teacher/scheme-of-work/new/page.tsx:126,171` | No validation the two ever match; there's usually no real Core `schools` row behind either |
| Two assessment systems, one orphaned | Gradebook (`class_assessments`/`learner_marks`, actively used) vs Academic Clinic `assessments` table (`app/api/assessments/create/route.ts`, **zero UI callers** in the teacher app — its only writer is a parent-facing dashboard page doing a raw client-side Supabase insert, bypassing `lib/` entirely, a CLAUDE.md violation) | The teacher-facing "Clinic" tab depends on data teachers have no way to create |
| Same student issue re-described in two places with no pre-fill | A "lost/struggled" formative signal and a later remedial intervention log entry both require independently re-typing the same substrand/root cause | No code path pre-fills an intervention entry from an existing formative signal |
| Redundant student re-selection across per-student reports | `/teacher/reports/blueprint/[studentId]` and `/teacher/reports/career-intelligence/[studentId]` aren't cross-linked or reachable from the main `/teacher/reports` list — each requires an independent class→student navigation | Minor but adds up over a term |

## 5. Classroom Readiness Matrix

Objective 4 (does every generated document feed the next stage) and Objective 5 (does every assessment strengthen understanding), assessed per stage:

| Stage | Feeds forward automatically? | Evidence |
|---|---|---|
| SOW → Lesson Plan | **Yes**, once the teacher finds the button — inputs pulled server-side from the saved SOW, no re-entry | `app/api/lesson-plans/generate/route.ts:53-59` |
| Lesson Plan → RoW | **Yes, fully automatic** — weekly cron generates RoW from taught lesson plans, explicitly built because "teachers often teach offline and never mark lessons as taught" | `app/api/cron/generate-record-of-work/route.ts:36-37` |
| Assessment (exam-only) → Learner Intelligence | **Yes** — confirmed live in Wave 3: exam-only evidence (opener/midterm/end-term) reaches the same canonical Projection Engine every other consumer reads, with no contradiction between surfaces | See Wave 3 report |
| Assessment (topical/richer evidence) → confidence | **Yes, by design** — richer evidence increases confidence and depth without invalidating exam-only understanding, per the Constitution and Wave 3's convergence | Confirmed architecturally; topical checks are fast and roster-referenced, "meant to be quick enough that teachers actually do it between term assessments" |
| Learner Intelligence → Classroom Action | **No — the weakest link.** Good, specific, actionable text exists (risk flags, peer pairing, prerequisite warmups, remedial plans) but nothing in the Monday Panel UI is clickable | §3 items 1–2 |
| Learner Intelligence → Parent Communication | **Partial** — weekly batch only, one concern per student per week, no manual "notify now" action, and one confirmed false promise ("teacher has been notified" when nothing notifies the teacher) | `lib/parentPulse/observationPipeline.ts:275` vs `processInboundReply` (lines 150-256) |
| Term end → Holiday Learning | **Partial** — Holiday Planner itself pulls automatically from Projection/career intelligence with no re-entry, but nothing in Core end-of-term triggers it | §3 item 8 |
| Term end → Reports | **Yes** — report cards generate and publish reliably, idempotently | `lib/core/endOfTerm.ts:68-76` |
| This term → Next term | **No** — only the term record advances; SOW must be rebuilt from scratch, no class-roster carry-forward found | §3 item 8, confirmed via grep for `rollover`/`carryForward`/`next_term` |

## 6. Approval Flow Verification

**A Teacher → HOD → Deputy → Principal → Parent chain does not exist and cannot be built on the current schema without inventing new roles.** Confirmed directly:

- The only real, assignable roles in the main auth system are `teacher | parent | student` (`lib/auth/getRole.ts:5`).
- A separate Core-schema role enum (`school_users.role`) permits `school_admin, headteacher, deputy_headteacher, teacher, parent` — but the CHECK constraint explicitly does **not** permit `'hod'` or `'principal'` as values. Those words appear only in comments and a read-only `PrincipalDashboard` aggregation, never as an actor who approves anything.
- Per this wave's explicit rule ("do not redesign school hierarchy"), no chain is proposed.

What **does** exist and works well — both are flat, single-approver (teacher-only) gates, not chains:

1. **Holiday Plans Publish Gate** — a real UI approval action with a 3-day auto-publish fallback if the teacher doesn't act (`lib/holiday/planner.ts:212-244`, `app/api/cron/auto-publish-holiday-plans/route.ts`).
2. **Adaptive Learning Differentiation approval** — a real per-class draft→approve flow (`app/api/teacher/classes/[classId]/differentiation/approve/route.ts`), correctly gated so one teacher can't approve another's class.

**Recommendation**: electronic approval should stay exactly where it already is (holiday plans, differentiation) — both genuinely remove work (an automatic fallback prevents a forgotten approval from blocking a parent). No further approval automation is recommended this wave; there is no verified case where adding one would remove real work rather than add a step.

## 7. Teacher-Facing Page Audit

Teacher pages live under `app/teacher/*`, consistently wrapped by a 15-item left sidebar (`components/teacher/TeacherSidebar.tsx`) — this is a cleanly separate navigation shell from the parent/student dashboard (`DashboardNavbar.tsx`), and a pure teacher is correctly redirected away from the latter. No cross-nav inconsistency found.

| Page | Finding |
|---|---|
| `/teacher/dashboard` | Clear purpose, good single entry point (greeting, class count, alerts, weekly intel) |
| `/teacher/scheme-of-work` | Clear purpose, correctly feeds Booklets |
| `/teacher/booklets` | Empty by design until a SOW exists ("Generate a Scheme of Work first") — reads as broken if a new teacher clicks it first, before SOW |
| `/teacher/reports` | Mixes legacy KNEC/class reports with per-student delivery tracking in one page — broad, dense scope |
| `/teacher/reports/blueprint/[studentId]` and `/career-intelligence/[studentId]` | Not reachable from the main `/teacher/reports` list — each needs its own class→student navigation |
| `/teacher/analytics` vs `/teacher/reports` | Naming alone doesn't make clear which is authoritative without opening both |

## 8. Teacher Experience Score

Scored 1 (broken) – 5 (excellent, no friction), based on the evidence above, not impression:

| Area | Score | Basis |
|---|---|---|
| Teacher onboarding | 3 | Works, but a mismatched school name silently strands the teacher with no error and no fix path |
| Daily workflow (SOW/plan/teach) | 4 | Genuinely strong automatic feed-forward; loses a point for the missing SOW→lesson-plan CTA and the dual lesson-plan endpoints |
| Assessment workflow | 3 | Gradebook itself is excellent (live feedback); loses points for the silent alert gap, fragile name-matching, and the orphaned Clinic tab a teacher can actually encounter |
| Approval workflow | 4 | What exists (holiday, differentiation) works cleanly with sensible fallbacks; no chain exists, correctly out of scope |
| Reporting | 4 | Report cards are reliable and idempotent; page-level navigation is dense in places |
| Parent communication | 2 | Weekly-batch-only, one concern per week, and a confirmed false promise to parents |
| Learner intelligence | 2 | Computation and language are genuinely good; **zero** of it is actionable in the UI, and the one built action path (intervention check-in) has no caller |
| Career guidance | 5 | Converged across all surfaces per Waves 2–3, grade-gated correctly, live-verified |
| Holiday learning | 4 | Generation itself is automatic and evidence-driven; disconnected from end-of-term triggering |
| End-of-term workflow | 3 | Reliable for report cards; no next-term rollover beyond the term record itself |
| **Overall classroom readiness** | **3.4 / 5** | Strong backbone, weak intelligence-to-action loop |

## 9. Intelligence-to-Action Verification

Per Objective 8, checked whether each insight type actually reaches a classroom action:

| Insight | Reaches action? | Evidence |
|---|---|---|
| Risk flag → intervention | **No** — text-only in Monday Panel, intervention check-in API unused | §3 items 1–2 |
| Career interest → lesson adaptation | Not found as a wired path — career signals feed guidance surfaces (Waves 2–3) but no lesson-plan adaptation consumes them | Not investigated deeply enough to confirm absence definitively; flagged for a future pass |
| Confidence → teacher awareness | **Partial** — confidence is exposed on every career/capability insight (Wave 2) and Blueprint, but Blueprint itself has no follow-up prompt | `lib/learnerIntelligence/blueprint.ts` — no CTA logic found |
| Holiday recommendation → holiday work | **Yes** — Holiday Planner generates real, evidence-sourced work automatically, with a working teacher-approval gate | §5, §6 |
| Remedial plan → teacher allocation | **Yes** — `lib/remedial/planner.ts` produces genuinely rich, differentiated, persisted week-by-week group plans | Confirmed by the parent-communication research agent |

Two of five checked paths fully close the loop; one is text-only with a built-but-unwired action API; one is unconfirmed either way.

## 10. Pilot Risks

1. **A pilot teacher will see good advice in the Monday Panel and have no way to act on it inside the app** — the single highest-visibility gap in a real classroom.
2. **A pilot teacher may click the "Clinic" tab on their own class page and hit an unexplained wall** ("⚠️ missing assessment," no link, no CTA) because the data source is only writable from a different, parent-facing page.
3. **A parent may be told "the teacher has been notified" when the teacher was never notified** — a credibility risk if discovered during a pilot.
4. **A teacher will have to rebuild their SOW from scratch every term** — a real time cost the platform's stated goal ("save time rather than learn software") directly contradicts.
5. **A new teacher whose school name doesn't match anything gets silently stranded** with no visible error.

## 11. Quick Wins (small, safe, high-value — not implemented this wave, audit only)

1. Add a "Generate Lesson Plan" button directly to the SOW success screen (`app/teacher/scheme-of-work/new/page.tsx`), next to the existing "Create Record of Work" CTA.
2. Surface the struggling-learner alert count directly in the marks-save toast ("Saved 32 learners — 3 flagged for follow-up") instead of only on a separate page.
3. Add a link/explanation on the teacher "Clinic" tab's missing-assessment warning, or hide the tab until the underlying data path is teacher-writable.
4. Fix or remove the false "teacher has been notified" copy in `observationPipeline.ts` until a real teacher-notification path exists.
5. Reconcile the two lesson-plan generation endpoints onto the one already marked canonical.

## 12. Deferred Improvements (larger, needs a product decision — not scoped for a quick fix)

1. Wire the intervention check-in API into the Monday Panel UI — the single highest-value fix, but is real feature work, not a small change.
2. Bridge Core end-of-term and the Holiday Planner so finishing a term can trigger holiday plan generation.
3. Design SOW rollover / next-term carry-forward — genuinely new functionality, not a wiring fix.
4. Decide whether the Academic Clinic `assessments` pipeline should be retired, or made teacher-writable — currently in between, serving neither purpose well.
5. Investigate whether career interest ever adapts a lesson plan — not confirmed either way this wave.

## 13. Regression Results

- **TypeScript**: identical to the established baseline (Waves 1–3) — the same 3 pre-existing script-only errors, zero new errors. This wave changed no code.
- **ESLint**: zero errors across `lib/` and `app/`.
- **Production build**: compiles successfully (Turbopack, 46s); the build's TypeScript pass fails only on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error.
- No code was written or modified this wave — audit only, as scoped.

## 14. Final: CONDITIONAL GO

The core weekly teaching loop — Scheme of Work, Lesson Planning, Record of Work, Assessment entry — is pilot-ready today: it saves real time, feeds forward automatically in almost every case, and gives good live feedback. Career guidance is converged and consistent per Waves 2–3. Both existing approval gates (holiday, differentiation) work cleanly.

The condition is the intelligence-to-action loop: pilot teachers should not be told the Monday Panel's advice is something the app will help them track, because today it isn't — every insight is text they must act on manually, and the one feature built to close that loop has no UI. Parent communication's false "teacher notified" promise should be fixed or its copy softened before any pilot parent sees it, and the orphaned Academic Clinic tab should be hidden or explained before a pilot teacher encounters it as a broken feature. None of these require an architecture change — they are wiring and copy fixes matching this wave's own "quiet, small, safe" mandate — but they should land before, not during, a real pilot term.
