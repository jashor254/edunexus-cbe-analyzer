# EduNexus — Pilot Readiness Wave 2 Report

**Classroom Operations**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: audit only, no code changed. Follows Pilot Readiness Wave 1 (teacher journey). This wave asks whether the platform can operate smoothly every school day of a real pilot — daily rhythm, dashboards, notifications, and whether interventions/assessments actually close their loops. Objectives 4 and 5 (intervention workflow, assessment-feeds-intelligence) were already traced in depth in Wave 1; this report reuses those findings rather than re-deriving them, and focuses new investigation on what Wave 1 didn't cover — weekly rhythm, the full dashboard set, the complete notification inventory, and end-of-term continuity.

---

## 1. Executive Summary

The most consequential finding this wave is a correction to an assumption carried from Wave 1: **Parent Pulse and the "term readiness" brief are not actually scheduled in production.** Both cron routes exist, are correctly coded, and their code comments say "runs every Sunday" / "first Monday of term" — but neither appears in `vercel.json`'s 4 active cron entries. Wave 1 described Parent Pulse as "a weekly Sunday batch" because that's what the code says it should be; this wave found it never fires today unless someone curls it manually. This is worse than Wave 1's "batch is too infrequent" framing — it may currently be **not running at all**.

Three other new findings, all instances of the same underlying pattern Wave 1 already found once (a fully-built backend with no teacher-facing UI):

1. **The entire Core promotion/grade-progression system has zero UI callers** — 9 of 10 `app/api/core/*` routes, including `runAnnualPromotion`, are unreachable from any page. A student's grade never advances automatically; nothing calls the promotion API.
2. **The School/Principal dashboard doesn't exist as a page** — `buildPrincipalDashboard()` and its API route are fully built and correct, but zero pages in `app/` render it.
3. **"Monday Panel" is not Monday-triggered at all** — it's an on-demand recompute (`buildTeacherPanel()`) fetched fresh on every dashboard load, any day of the week. The name is a misnomer that could mislead a pilot teacher into checking it only on Mondays.

The platform is confirmed **fundamentally reactive, not proactive**: nothing pushes a teacher toward action day-to-day; every dashboard is pulled by opening a page, and the one component that would create a "here's what changed" rhythm (weekly digests, daily deltas) doesn't exist anywhere in the teacher-facing code.

On the positive side: the Teacher dashboard's AttentionFeed genuinely works as decision support (every item is a clickable link to a real action), most WhatsApp/email notifications are correctly wired end-to-end with working resolution paths, and the confirmed false promise from Wave 1 ("the teacher has been notified") is now fully traced — the event it should have triggered (`parent.observation.submitted`) has zero subscribers anywhere in the codebase, confirming it as a complete dead end, not just an undertested path.

**Verdict: CONDITIONAL GO** — daily/weekly operations will function for a pilot (teachers can plan, teach, assess, and see a genuinely useful attention feed), but three items should be fixed or explicitly disabled before a real pilot: the false parent-notification promise, the dead Parent Pulse/term-readiness crons (either schedule them or stop implying they run), and the "Monday Panel" name (rename or remove the day-specific framing since it's always-fresh).

---

## 2. Weekly Classroom Flow

Only 4 crons are actually scheduled in production (`vercel.json`):

| Cron | Schedule | Teacher-visible? |
|---|---|---|
| `friday-generation` | Fri 18:00 EAT | Generates next week's lesson plans + weekly intelligence — surfaces as the dashboard's "This week's TIE Intel" card, but only when the teacher navigates there; no push |
| `generate-record-of-work` | Mon 06:00 EAT | Silently converts last week's taught lesson plans to RoW rows — no dashboard surfacing found at all |
| `auto-publish-holiday-plans` | Daily 06:00 UTC | Silent DB mutation; a no-op most days outside holiday season |
| `ai-log-retention` | Daily 04:00 UTC | Pure backend hygiene, not meant to be seen |

**Not scheduled in production, despite existing, working code and "runs weekly/Monday" comments:**
- `app/api/cron/parent-pulse/route.ts` ("Runs every Sunday") — absent from `vercel.json`.
- `app/api/cron/term-readiness/route.ts` ("first Monday of each term") — absent from `vercel.json`.
- `app/api/cron/academy-nudge/route.ts` — same gap.

**"Monday Panel" reality check**: `buildTeacherPanel()` is called on-demand from `/api/teacher/attention-feed`, fetched client-side on every dashboard mount — it recomputes fresh any day of the week, it is not Monday-specific despite the name.

**Day-awareness check**: the teacher dashboard's only date-derived content is a cosmetic greeting string (Good morning/afternoon/evening) and the term label. The actual data queried (`activeClasses`, `needsAttention`, `weeklyIntel`) has no day-of-week branching, no "since you last logged in," no unread/new-since markers anywhere in `app/teacher/`.

**Verdict: no day-to-day rhythm exists.** Monday through Thursday the dashboard is functionally identical regardless of what happened the day before; only Friday's lesson-plan generation and the following Monday's (invisible) RoW conversion mark any real weekly cadence. The platform is pull-only — a teacher who doesn't open the app gets nothing.

## 3. Dashboard Audit

Against the rubric (What needs attention? / What changed today? / What should I do next?):

| Dashboard | Needs attention? | Changed today? | Do next? | Verdict |
|---|---|---|---|---|
| **Teacher** (`app/teacher/dashboard/page.tsx`) | Yes — alert count links to `/teacher/alerts`; AttentionFeed items each carry a real `actionLink` | Partial — only a weekly, not daily, health score | Yes — every AttentionFeed item is a clickable link to a real action | **Keep — genuine decision support** |
| **Student** (`app/student/page.tsx`) | No — "Focus on" box is a static level-based note, not tied to any live signal | No — all data is weekly aggregate counts | Partial — generic CTAs ("Open Compass") not derived from specific need | Borderline — stats/gamification hub, not diagnostic |
| **Parent** (`app/dashboard/page.tsx`) | No — no risk/alert section at all | No — lists sorted by date, not a "what's new" digest | Partial — "Quick Actions" is a static app-wide menu; only the pending-assignments badge is data-driven | **Recommend simplify or merge** — mostly passive lists/menu |
| **School/Principal** (`lib/school/intelligence.ts`, `app/api/school/intelligence/route.ts`) | N/A | N/A | N/A | **No UI consumer exists at all** — fully built backend, zero pages render it. Build-or-delete decision needed, not a display fix |

No exact metric duplication found across the four dashboards.

## 4. Notification Audit

Every distinct notification type found, with source/reason/recipient/action/resolution:

| Type | Recipient | Expected action | Resolution | Verdict |
|---|---|---|---|---|
| Assignment marked | Parent | View score/feedback | One-shot informational | Working |
| Student alert created (`student_alerts`) | Parent + Teacher | Teacher reviews, parent supports child | Teacher can resolve (`is_resolved=true`); **parent side is read-only, no dismiss** | Working (teacher side); incomplete (parent side) |
| Weekly Parent Pulse | Parent | Read only | None by design | **Code correct, but not scheduled in production — see §2** |
| Holiday return processed | Parent | Read only | None | Working |
| Report/Blueprint ready | Parent | Open report | Dedup only | Working |
| Academy reflection nudge | Teacher | Submit reflection | Stops once a reflection exists | Working, but its own cron isn't scheduled either (§2) |
| WhatsApp opt-in welcome | Parent | None | One-shot | Working |
| Term readiness brief | Teacher | "Check your Monday Panel" | Overwritten next cycle, not acted-on | **Code correct, but not scheduled in production — see §2** |
| **Parent reply ack — "struggled"** | Parent | Told teacher will act | **Nothing downstream at all** | **CONFIRMED FALSE PROMISE** |
| `parent.observation.submitted` event | Intended: any subscriber | N/A | **Zero consumers anywhere in the codebase** | **Dead event — missing receiver** |

Also confirmed: **no in-app notification bell/unread-count exists anywhere** — every notification is fire-and-forget WhatsApp/email or a single list page (`/teacher/alerts`, `/dashboard/alerts`); there is no in-product record a user can revisit for anything else.

The false-promise trace is now complete: `processInboundReply()`'s `struggled` branch calls `updateFromParentObservation()`, `recordParentObservationEvidence()`, `logInbound()`, and `publishEvent('parent.observation.submitted')` — none of which write to `student_alerts`, message a teacher, or touch any teacher-facing table. The event it emits has no subscriber in the entire codebase. This is not a timing gap or an undertested path — it is structurally impossible for the teacher to be notified today.

## 5. Intervention Flow

Reusing Wave 1's direct trace (Monday Panel → open learner → intervention → follow-up → outcome → learner intelligence updates), confirmed unchanged this wave:

- **Monday Panel → open learner**: works, but nothing in the panel is clickable (Wave 1 finding, re-confirmed: `app/teacher/classes/[classId]/page.tsx` renders plain text across all 5 tabs).
- **→ Intervention**: no logging UI found anywhere reachable from the panel.
- **→ Follow-up**: `app/api/teacher/intervention-checkin/route.ts` is a complete, correct API (records outcome, recomputes risk, emits evidence) with **zero UI callers** — the Monday Panel's "Check-ins" tab is static text.
- **→ Outcome → Learner intelligence updates**: the API would correctly trigger `recomputeRiskFlags` if called, but it is never called.

**Verdict: the intervention loop stops at the second step for every real teacher.** This is the single most consequential gap for a pilot — good, specific, actionable intelligence exists and is computed correctly, but nothing converts it into a database write.

## 6. Assessment Flow

Reusing Wave 1's finding, extended by this wave's Core-system trace: the gradebook (`class_assessments`/`learner_marks`) correctly captures everything the canonical Projection Engine needs — confirmed live in Wave 3, exam-only evidence reaches every consumer consistently. Topical checks are fast and well-designed for real classroom use.

The one violation of "no intelligence feature should depend on data teachers cannot realistically enter": the **Academic Clinic `assessments` table** feeds a "Clinic" tab on the teacher's own class page, but teachers have no UI to write to that table — only a parent-facing page can, via a raw client-side insert. This wave found the pattern is broader than one tab: **the entire Core module (`app/api/core/*`, including grade promotion) has the same shape — a real backend with no teacher-reachable UI**, confirmed by checking all 10 Core routes: only `app/api/core/school/route.ts` has a caller (one admin page), the other 9 — including `runAnnualPromotion` — have none.

## 7. Operational Friction Inventory

New findings this wave, beyond Wave 1's (two lesson-plan endpoints, orphaned Academic Clinic writer, intervention-checkin's zero callers):

| Finding | Evidence |
|---|---|
| Entire Core API is UI-dead | 9 of 10 `app/api/core/*` routes have zero callers in `app/` |
| Grade promotion has no UI at all, not even an admin form | `lib/core/promotions.ts` / `app/api/core/promotions/route.ts` — zero callers |
| Grade never advances automatically | No code path writes `students.grade`; promotion only happens via the unreachable API |
| Career guidance has no invalidation on a grade change | `careerIntelligenceEngine.ts` reads grade live at query time; `career_signals`/`capability_profile` carry no grade/year scoping — currently untested in practice since grade never changes |
| School/Principal dashboard: built backend, no page | §3 |
| Two more unused teacher API routes | `app/api/teacher/prerequisite-readiness/route.ts`, `app/api/teacher/teaching-patterns/route.ts` — no callers |
| Differentiation approval action not wired to any button | `app/api/teacher/classes/[classId]/differentiation/approve/route.ts` has no caller, though the sibling GET route is used |
| Orphan page | `app/teacher/insights/page.tsx` — a full built page, absent from `TeacherSidebar.tsx`'s nav array, unreachable except by typing the URL |
| Parent-side alerts are read-only | `app/api/parent/alerts/route.ts` is GET-only; a parent can never dismiss an alert |

Three of the ten Core routes and one dashboard now confirm a **recurring pattern across this entire wave and Wave 1**: real, working backend logic exists for promotion, principal oversight, and Academic Clinic assessments, but none of it has a teacher- or admin-reachable UI. This is worth naming as a single systemic issue, not three unrelated ones — Waves 1–3 built and converged the intelligence; a parallel gap of "backend exists, UI doesn't" has accumulated across several features.

## 8. Pilot Operations Scorecard

| Area | Score (1-5) | Basis |
|---|---|---|
| Teacher efficiency | 4 | Strong core loop (Wave 1); AttentionFeed genuinely useful |
| Daily usability | 2 | No day-to-day rhythm; platform is pull-only, no proactive nudges beyond WhatsApp (and two of those crons aren't even scheduled) |
| Operational clarity | 3 | Teacher dashboard is clear; Parent dashboard is a passive list/menu; "Monday Panel" naming is actively misleading |
| Notification quality | 2 | Most types work correctly, but one confirmed false promise sent directly to parents, two "weekly" notifications not scheduled at all, and no in-app record for anything |
| Intervention workflow | 1 | Stops at step 2 of 5 for every real teacher — the follow-up API exists and is correct but has no caller |
| Assessment workflow | 4 | Gradebook and topical checks are genuinely good; one dependent feature (Clinic tab) requires data teachers can't enter |
| School readiness | 2 | Grade promotion and principal oversight are fully built but entirely unreachable — a school cannot actually use either today |
| **Overall pilot operations score** | **2.6 / 5** | Strong single-teacher daily mechanics dragged down by a systemic backend-without-UI pattern and a confirmed false promise to parents |

## 9. Quick Wins (small, safe — not implemented this wave, audit only)

1. Fix or remove the "teacher has been notified" copy in `observationPipeline.ts:275` — it is provably false today.
2. Either add `parent-pulse`, `term-readiness`, and `academy-nudge` to `vercel.json`'s cron schedule, or remove the "runs every Sunday"/"first Monday" comments so nobody assumes they're live.
3. Rename "Monday Panel" (in UI copy and comments) to something that doesn't imply a day-specific cadence, since it recomputes fresh on every page load.
4. Add a resolve/dismiss action to the parent-facing alerts view (`app/api/parent/alerts/route.ts` is currently GET-only).
5. Add `app/teacher/insights/page.tsx` to `TeacherSidebar.tsx`'s nav array, or remove the page if it's superseded.

## 10. Deferred Improvements (larger, needs a product decision)

1. Wire the intervention check-in API into the Monday Panel UI (carried from Wave 1 — the single highest-value fix, real feature work).
2. Decide the fate of the entire Core module (promotion, principal dashboard, academic-year/class/learner management) — either build the missing UI or retire the backend; it currently serves no one.
3. Design a genuine daily/weekly proactive rhythm (push notification, daily digest, or similar) — the platform has none today beyond WhatsApp broadcasts.
4. Design grade-change invalidation for career guidance, once/if promotion is ever wired to a UI.
5. Design an in-app notification center — currently every notification is either WhatsApp/email fire-and-forget or a single flat list page.

## 11. Regression Results

- **TypeScript**: identical to the established baseline (Waves 1–3, Pilot Wave 1) — the same 3 pre-existing script-only errors, zero new errors. No code changed this wave.
- **ESLint**: zero errors across `lib/` and `app/`.
- **Production build**: compiles successfully (Turbopack, 20.9s); the TypeScript pass fails only on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error.

## 12. Final: CONDITIONAL GO

The mechanics a pilot teacher touches daily — planning, teaching, assessing, and a genuinely useful AttentionFeed — work and will hold up for a real term, consistent with Wave 1. What should not go into a pilot unaddressed: a WhatsApp message that tells a parent their concern reached the teacher when it structurally cannot; two "weekly" notifications that may not currently run at all in production; and a "Monday Panel" name that misrepresents an always-fresh feature as day-specific. None of these require an architecture change — they are copy fixes, a cron-schedule addition, and a rename, matching this wave's own "smallest safe improvement" mandate. The larger, systemic pattern found this wave — real backend work (promotion, principal oversight, intervention follow-through) with no path for a human to actually use it — is not a pilot blocker by itself (a single-teacher pilot won't touch promotion or principal dashboards), but it represents real, already-built value the platform isn't yet delivering, and should be the next wave's priority once the quick wins land.
