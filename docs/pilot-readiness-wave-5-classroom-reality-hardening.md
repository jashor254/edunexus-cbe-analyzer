# EduNexus — Pilot Readiness Wave 5 Report

**Classroom Reality Hardening**
Date: 2026-07-13
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: audit only, no code changed. Final synthesis wave in the Pilot Readiness series (Waves 1–4). This wave's objectives — full-term simulation, per-role journeys, exam-only compliance, progressive-evidence compliance, and a classroom-impact ranking — are, almost entirely, the exact ground Waves 1–4 already covered in cited, verified detail. Re-running the same investigation would duplicate confirmed findings rather than add new information. This report therefore reuses those findings directly, organized into the structure this wave requests, and adds exactly one piece of genuinely new investigation: the **learner's own logged-in journey across a full term**, which no prior wave traced from the student's own screen.

---

## 1. Executive Summary

Across five waves of investigation, the picture has stayed consistent and has only sharpened, not changed: **the core teaching loop and the learner's own experience are both genuinely good**, the **intelligence layer computes and converges correctly** (Waves 1–3 of the implementation series), but a small, specific, well-located set of trust and reachability gaps remain — three confirmed false promises, three notification crons that never fire, one real status-badge bug, two roles (HOD, Principal) that don't exist in the schema, and two educational actions (assessment corrections, term rollover) with no audit trail.

This wave's new finding: the learner's own journey is stronger than the teacher-facing surfaces audited in Waves 1–2. Compass sessions have a genuine, visible feedback loop (XP, level-up, next-step hooks), the Holiday Learning page is independently discoverable by the student (not WhatsApp-only), and the Junior/Senior Career Guidance split — verified at the API layer in Wave 2 — is now confirmed to hold on the student's own rendered screen, with an explicit "not being predicted" disclaimer for Junior learners. The only day-one friction found: the onboarding video only fires on `/student`, not on the other three student-facing routes, so a student who lands elsewhere first gets no "start here" moment.

**Verdict: CONDITIONAL GO** — unchanged from Wave 4, because nothing this wave found changes that assessment. The condition remains the same short, already-itemized list from Waves 3–4: fix the swapped notification-status bug, the two false promises, schedule (or stop implying) the three dead crons, and add the two small audit-trail additions. No new blocker was found in this wave's fresh territory (the learner journey) or in re-confirming the already-covered ground.

---

## 2. Full Teacher Journey (from Waves 1–2, reconfirmed unchanged)

```
Setup → SOW wizard → [dead end: no direct lesson-plan CTA] → Lesson Plan (auto-pulls from SOW)
     → RoW (fully automatic, weekly cron) → Gradebook (live feedback, good UX)
     → [silent gap: struggling-learner alerts not surfaced in the save toast]
     → Monday Panel (rich, specific, actionable text — but zero clickable elements)
     → [dead end: intervention check-in API has no UI caller]
     → Holiday Planner (automatic, evidence-sourced, real teacher-approval gate)
     → Core end-of-term (report cards, reliable) — [not bridged to Holiday Planner]
     → Next term: only the term record carries forward, SOW rebuilt from scratch
```

No stage is fully blocked; a determined teacher completes the term. The friction is lost time and lost value, not hard failure — exactly Wave 1's original finding, unchanged.

## 3. HOD Journey

**Confirmed in Wave 2: this journey cannot begin.** `lib/auth/getRole.ts`'s `UserRole` type permits only `teacher | parent | student`. A separate Core-schema role enum (`school_users.role`) permits `school_admin, headteacher, deputy_headteacher, teacher, parent` — but its CHECK constraint explicitly does **not** permit `'hod'` as an assignable value. The word appears only in comments and a read-only aggregation type, never as a real actor. There is no page, no login flow, and no permission model for a Head of Department today. Per this wave's own mandate ("do not redesign architecture"), no chain is proposed — this is reported as a factual gap, not a defect to fix.

## 4. Principal Journey

**Confirmed in Waves 2 and 4: the backend exists, the journey does not.** `buildPrincipalDashboard()` (`lib/school/intelligence.ts`) and its route (`app/api/school/intelligence/route.ts`) are fully built, correct, and compute real school/subject-wide risk distributions — but zero pages anywhere in `app/` render it. A Principal who logged in today would have nowhere to go; the schema's `headteacher`/`deputy_headteacher` roles exist but have no corresponding UI either. Same verdict as HOD: journey cannot begin, not a defect requiring redesign, a build-or-retire decision for a future wave.

## 5. Parent Journey (from Waves 1–3, reconfirmed unchanged)

The parent dashboard (Wave 2) is mostly passive — lists and a static action menu, with only one genuinely data-driven element (a pending-assignments badge). Parent Pulse (weekly digest) and the holiday/report-card notification paths are real, but three specific claims sent directly to parents are compromised: "the teacher has been notified" (false — zero subscribers to the underlying event), "full report sent to your email" (false — unconditional regardless of whether email was attempted), and the email/WhatsApp "sent" status badges a teacher sees about that parent (swapped by a real positional-array bug in `assessmentPipeline.ts`). Parent-side alerts are read-only — a parent can never dismiss one.

## 6. Learner Journey (new this wave)

Traced from the student's own logged-in screens, not the teacher/parent view of the student:

- **Day one**: a skippable onboarding video fires on `/student` (tracked via `localStorage` + an API status check), with a clear "Start Learning" hero CTA. Empty states are explicit and non-blocking ("No sessions yet," "your parent or teacher will add scores") rather than blank pages. **Gap**: the onboarding modal only exists on `/student` — the parallel route group serving `/career`, `/blueprint`, `/holiday`, `/progress` has no equivalent, so a student entering via a shared link to one of those pages gets no "start here" moment.
- **Weekly use**: the Compass session loop (`/learn` → 30-minute session → `/api/learn/end`) has a genuine, visible feedback loop — XP, a level-up badge, session-count milestones, an AI summary, and a "next level" hook. This is not a backend black hole; the outcome is designed to be seen and to motivate return use.
- **Risk/intervention framing**: confirmed absent from the student's own surface, by design — no "you're at risk" language found anywhere; `StudentBlueprint.tsx` reuses the teacher's evidence-first Blueprint component verbatim, consistent with the Constitution's confidence-not-judgment framing.
- **Holiday Learning**: `/holiday` is independently discoverable via the student's own nav — not WhatsApp-only, as one might assume from the teacher/parent-side audit. A clear empty state exists if nothing is published yet.
- **Career guidance grade gating**: confirmed to hold on the student's own rendered screen (not just the API, which Wave 2 verified) — Junior mode renders `CareerExplorationPanel` with an explicit "not being predicted" disclaimer; Senior mode renders the ranked-match panel.
- **Friction found**: `/progress` is a pure read-only log with no action button — a genuine minor dead end. Assignments are shown redundantly across three screens for the same session flow (mild repetition, not blocking). Two parallel student layouts (`app/student/layout.tsx` and `app/(student)/layout.tsx`) independently duplicate the same role-redirect logic — a maintenance risk, not a user-facing one, already flagged in the code's own comments about a prior redirect-loop history.

**Verdict: the learner's own journey is the strongest-performing surface audited across all five waves** — a genuine, motivating feedback loop with no risk-framing leakage and correctly grade-gated guidance, undercut only by minor day-one inconsistency and a dead-end progress page.

## 7. Operational Friction Inventory (consolidated from Waves 1–2, plus this wave's addition)

| Friction | Source wave | Severity |
|---|---|---|
| Monday Panel has zero interactive elements; intervention check-in API unused | Wave 1/2 | High |
| Struggling-learner alerts not surfaced at marks-save time | Wave 1 | Medium |
| Two lesson-plan generation endpoints, UI calls the non-canonical one | Wave 1 | Medium |
| Academic Clinic `assessments` table has no teacher-facing writer | Wave 1 | Medium |
| Core end-of-term and Holiday Planner architecturally unbridged | Wave 1 | Medium |
| No SOW/roster rollover — full rebuild every term | Wave 1 | Medium |
| Entire Core module (promotion, principal oversight) has no reachable UI | Wave 2 | Medium (not a pilot blocker, real lost value) |
| Onboarding video missing on 3 of 4 student route-group entry points | **This wave** | Low |
| `/progress` page is a dead end with no action | **This wave** | Low |
| Two parallel student layouts duplicating redirect logic | **This wave** | Low (maintenance, not user-facing) |

## 8. Classroom Reality Compliance Matrix

| Requirement | Status |
|---|---|
| Exam-only schools complete every workflow | **Confirmed, Wave 4** — Monday Panel, Blueprint, Career Explorer, Holiday Planner, Remedial Planner all verified working at the UI layer for exam-only evidence |
| Topical assessments enrich, never gate, functionality | **Confirmed, Wave 4** — the one real UI gate (Career Explorer's "at least one assessment") is evidence-existence, not evidence-type |
| Confidence increases with evidence, never fabricated without it | **Confirmed, prior intelligence-convergence waves** — every `Insight`/`CapabilityCareerMatch` carries a Low/Medium/High confidence derived from real assessment-count thresholds; "insufficient evidence" is stated plainly rather than filled with a guess |
| No workflow requires data real schools are unlikely to have | **Confirmed, Wave 4** — no feature found requiring topical-assessment-specific fields to function at all |
| Every promise either happens automatically or clearly requires human action | **Not yet fully true** — 3 confirmed false promises remain open (Waves 3–4) |

## 9. Exam-only School Verification

Reconfirmed unchanged from Wave 4 (§8 of that report): Monday Panel's core risk layer, Blueprint's capability-dimension fallback, Career Explorer's family/match computation, Holiday Planner's subject-level (not substrand-level) priority gaps, and Remedial Planner's Projection-driven risk lists all function correctly for a student with only opener/midterm/end-term marks. No remediation required.

## 10. Progressive Evidence Verification

Reconfirmed from the intelligence-convergence waves and Wave 4: richer evidence (topical checks, formative signals, observations) increases the `evidenceCount`/`evidenceDiversity` inputs to confidence scoring and unlocks bonus tiers (e.g. the entrepreneurial career tier's 2-assessment floor) — it never changes the underlying conclusion's direction, only its confidence and depth, matching the Constitution's Article II ("missing evidence is not negative evidence") and Article III ("confidence ≠ ability, shown separately").

## 11. Findings Ranked by Classroom Impact

1. Swapped email/WhatsApp status badges — a teacher could personally catch this and stop trusting every status shown (Wave 3/4)
2. False "teacher has been notified" promise to a parent (Wave 3/4)
3. Three orphaned notification crons implying contact that never happens (Wave 3/4)
4. Monday Panel → intervention dead end — good intelligence, no way to act on it (Wave 1/2)
5. False "sent to your email" WhatsApp line (Wave 3/4)
6. No operational visibility if any of the above fails silently during a pilot (Wave 3/4)
7. Assessment correction / term rollover have no audit trail (Wave 4)
8. Onboarding video gap on 3 of 4 student entry points (**this wave** — real but low-frequency, a shared-link edge case)
9. HOD/Principal journeys don't exist — real gap, but out of scope for a single-teacher pilot (Waves 2/4)

## 12. Recommended Quick Wins

Carried forward, unchanged priority (Waves 3–4):
1. Fix the positional-destructuring bug in `assessmentPipeline.ts`.
2. Fix/remove the two false-promise strings (`observationPipeline.ts`, `reportNotify.ts`).
3. Schedule the three orphaned crons or remove any implication they run.
4. Add a `published_by` column to report cards; add minimal history for assessment corrections and term rollover.

New, small, this wave:
5. Add the onboarding modal (or an equivalent lightweight "start here" prompt) to the `(student)` route group's layout, not just `/student`, so a student entering via `/career`, `/blueprint`, `/holiday`, or `/progress` first still gets oriented.
6. Give `/progress` at least one action (e.g. a "Start a session" CTA) so it isn't a pure dead end.

## 13. Regression Results

- **TypeScript**: identical to the established baseline across every prior wave — the same 3 pre-existing script-only errors, zero new errors. No code changed this wave.
- **ESLint**: zero errors across `lib/` and `app/`.
- **Production build**: compiles successfully (Turbopack); the TypeScript pass fails only on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error, unchanged since Wave 1.

## 14. Final: CONDITIONAL GO

Five waves of investigation converge on the same, stable picture: EduNexus's educational computation is sound and consistent (established in the intelligence-convergence waves), its core teaching loop and — as confirmed this wave — its learner-facing experience are genuinely strong, and exam-only schools are fully and fairly served with no hidden dependency on richer evidence. What remains before a real pilot is the same short, already-itemized, small-and-safe list carried since Wave 3: two false promises, one real status-badge bug, three silently-dead crons, and two small audit-trail additions — joined this wave by two minor, low-frequency learner-side polish items. None of these require new architecture or new intelligence. The classroom that exists today is well served by what's already built; the remaining work is entirely about making sure the platform never claims more than it has actually done.
