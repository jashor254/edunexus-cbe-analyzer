# Principal Workspace & Blueprint Entry Experience Audit

**Date:** 2026-08-03
**Type:** Workflow architecture audit. Not a Blueprint redesign, not an Educational Intelligence sprint, not a dashboard redesign, not implementation. No code changed.
**Builds directly on:** [blueprint-principal-decision-experience-audit.md](blueprint-principal-decision-experience-audit.md), which found the document itself strong (8/10) but flagged "no reach" as the disqualifying gap. This sprint's job is to fully map that gap, not re-litigate the document.

**Frozen per this sprint's own foundation, not re-audited here:** Blueprint evidence validity, Blueprint editorial maturity, Educational Intelligence correctness, School-first architecture correctness.

---

## 1. Executive Verdict

**The destination is ready. The road to it doesn't exist yet — and one piece of what looks like a road is actively broken.**

This audit went one level deeper than the prior one and found something worse than "no discovery path exists": a discovery path *does exist in the codebase* — a real `/api/search` endpoint with a `learner` result type — and it is silently non-functional for every single user, principal or teacher, because of an identity-scoping bug (§3). It also points to a URL that doesn't exist (§2). And it has zero UI trigger anywhere in the app, so no one has ever actually hit either bug in production. Three independent failures stacked on the one piece of infrastructure that looks, on paper, like it should already solve this sprint's mission.

Beyond that: `school_intelligence_snapshots` (§5) is real, populated, school/grade-scoped rollup data with literally zero UI consumers — but it answers "how many" and "what's the trend," never "who." A Principal Workspace built only on that table would tell someone 12 learners are at risk in Grade 9 and give them no way to find out which 12. The missing piece isn't just a dashboard — it's the join between a count and a name, and that join is the Learner Directory this audit's Part 6 is really asking for.

**The correct workflow — School Intelligence → Attention → Learner → Blueprint → Decision → Action → Follow-up — requires building exactly two new things (a Principal Workspace home and a Learner Directory) and fixing one broken thing (search), then rewiring one existing thing's destinations (Attention Feed). Nothing here requires new Educational Intelligence — every number this workflow needs already exists in a table today.**

---

## 2. Principal Morning Journey

The natural sequence, in the order a Principal's attention should be earned:

1. **Learners needing attention** — the single highest-priority thing to see first; currently has no home (§4).
2. **Classes declining** — a school/grade-level trend signal; the data exists (`school_intelligence_snapshots.risk_trend`), the surface doesn't.
3. **Pending interventions / unread recommendations** — this is the Blueprint Action Plan's `proposed`/`edited`/`deferred` queue (`lib/learnerBlueprint/actionPlan/lifecycle.ts`), which is real and working but has no principal-facing aggregate view across the whole school — only per-learner, reached one learner at a time.
4. **Teachers requesting support** — Teacher Reflection's `recommendedSupport` field surfaces per-learner inside a Blueprint already; there's no school-wide "which teachers flagged a need" rollup.
5. **Parent meetings today** — out of this audit's evidence base; not verified either way this session, flagged as unconfirmed rather than asserted missing.

**The Principal should never need to know a learner ID to discover an important Blueprint** — confirmed, per this audit's own evidence, that today they very much do: every real path into a Blueprint (§3 of the prior audit, reconfirmed here) requires already knowing the learner's class, or the exact URL.

---

## 3. Blueprint Discovery Matrix

| Path | Status | Detail |
|---|---|---|
| Attention Feed | **Wrong destination** | All 9 `actionLink` values in `lib/attentionFeed/sources.ts` route to `/teacher/classes/{classId}/students/{studentId}` or `.../insights` — never `/student/blueprint/{learnerId}` (re-confirmed this session, unchanged since the prior audit) |
| Learner Directory | **Missing** | No index route exists — `app/teacher/learners/` contains exactly one route, `[learnerId]/blueprint/review/page.tsx`, which requires a learner id in hand. No `app/teacher/learners/page.tsx` at all |
| Class View | **Existing, correct** | `app/teacher/classes/[classId]/page.tsx`'s student rows link into Blueprint via `app/teacher/reports/blueprint/[studentId]/page.tsx`'s redirect shim — real, works, but requires already being in the right class |
| Search | **Existing but broken in three independent ways** — see below | |
| Recommendations (Action Plan) | **Existing, per-learner only** | `listReviewableBlueprintActionsForLearner` (used in `app/student/blueprint/[learnerId]/page.tsx` for a teacher viewer) is real and correct, but there is no school-wide "all pending actions across all learners" view — a Principal can't see the queue without opening each learner first |
| School Intelligence | **Missing entirely as a UI surface** | See §5 — the data exists, nothing renders it |
| Parent Meeting | **Not verified this session** | No dedicated meeting-scheduling surface was found in this pass; flagged as unconfirmed, not asserted absent |
| Teacher Concern | **Partial** | Teacher Reflection is a real, correctly-modeled per-learner concern channel, but nothing aggregates "teachers with unresolved concerns" across a school |
| Academic Review | **Existing, per-class only** | `/teacher/classes/{id}/insights` exists; no school-wide academic review view |
| Promotion Review | **Not verified this session** | `app/api/core/promotions` exists and is real (confirmed in an earlier sprint), but whether its UI links out to individual learners' Blueprints was not checked this pass — flagged, not asserted |
| Transfer Review | **Not verified this session** | Same caveat as Promotion Review |
| Intervention Follow-up | **Existing, per-action only** | The Review Workspace (`lib/learnerBlueprint/actionPlan/review.ts`, reached from a Blueprint's own "Teacher Review Workspace" link) is real, but only reachable per-action, never as a school-wide follow-up queue |

### Search — the most important finding in this audit

`/api/search` (`app/api/search/route.ts`) has a real `learner` result type (`lib/search/index.ts`'s `searchLearners`). On inspection, it fails in three independent, stacked ways:

1. **Identity bug — always returns zero results.** The route passes the raw authenticated `user.id` straight into `searchStudentsByQuery(q, teacherId)` (`app/api/search/route.ts:31`, `lib/search/index.ts:45-46`), which filters `students.eq('teacher_id', teacherId)` (`lib/repositories/teacher.repository.ts:589`). `students.teacher_id` is a legacy `teachers.id` value, never an `auth.users.id` — the two are never equal, so this query returns nothing for any caller, teacher or principal, confirmed by reading the exact comparison being made, not by running it.
2. **Dead destination.** Even if the identity bug were fixed, `searchLearners` builds `url: '/teacher/learners/${r.id}'` (`lib/search/index.ts:51`) — that route doesn't exist (confirmed, §2's Learner Directory row). A working search result would still 404.
3. **No UI trigger anywhere.** Grepped every component and page for a call to `/api/search` — zero matches outside the route file itself. No search bar, no command palette, nothing in the app ever calls this endpoint. It is fully orphaned.

Even after fixing all three, the underlying scope model is wrong for this sprint's purpose: `searchStudentsByQuery` filters to *one teacher's own* legacy roster (`teacher_id`), not the whole school. A Principal isn't a "teacher" of every learner in the legacy sense — this search, even repaired, could never become a school-wide directory without also being redirected to read from Core (`learners`/`school_users`) instead of the legacy `students.teacher_id` model. This is the same teacher-first/school-first tension the very first audit in this engagement named — reappearing here in a fourth, previously-undiscovered place.

---

## 4. Principal Workspace Findings

Evaluated against the mission's five questions, using `app/teacher/core-office/page.tsx` (the current closest thing to a Principal home) as the real artifact:

| Question | Answered today? |
|---|---|
| Who needs me today? | **No.** `core-office` composes school readiness (academic year/terms/classes/teachers setup status), not a learner-attention list |
| Why? | N/A — nothing to explain, since nothing is surfaced |
| What evidence supports that? | N/A |
| What should I do? | Partial — `core-office`'s own readiness checklist tells a Principal what *institutional setup* to finish, which is real and useful, but is a different kind of "what should I do" than an educational decision |
| Can I drill directly into the learner? | **No** — `core-office` has no learner-level links at all |

**Missing workflow, stated plainly**: `core-office` answers "is my school's institutional structure complete" — a real, correctly-scoped question for the School Office bounded context (per the earlier School-First Operating Model audit). It does not, and was never meant to, answer "which learners need me today." That's a different page that doesn't exist yet — not a defect in `core-office` itself, a genuinely separate page this sprint's Part 6/10 recommendations name.

---

## 5. School Intelligence Findings

`school_intelligence_snapshots` (confirmed schema, `lib/database.types.ts:9973+`) already stores, per school/grade/subject/week: `total_students`, `normal_count`, `watch_count`, `at_risk_count`, `critical_count`, `risk_trend`, `top_struggling_substrands`, `interventions_run`, `interventions_effective`, `avg_capability_dimensions`. Write path confirmed (`upsertIntelligenceSnapshot`, `lib/repositories/school.repository.ts`) and read path confirmed (`lib/school/intelligence.ts`, reads via `repos`, never raw `.from()` calls — correctly using the repository layer).

**Why it isn't surfaced**: not a technical blocker — the data and the read function both already exist and are correctly built. It simply has zero UI consumer anywhere in `app/teacher/core-office/**` or `app/admin/**` (re-confirmed by grep this session, zero matches, consistent with the prior audit's finding).

**The real design nuance this sprint's deeper look surfaces**: this table is a **rollup**, not a **roster**. It can answer "12 at-risk in Grade 9 this week, trend declining" — it cannot answer "which 12." A Principal Workspace page built directly on this table alone would show a count with no way to act on it. **It should participate in the workflow as the top-of-funnel number, not as the whole page**:

- **School Intelligence → Attention Feed**: the snapshot's `at_risk_count`/`critical_count`/`risk_trend` per grade should be the headline numbers a Principal Workspace shows first; clicking one should filter the Attention Feed (or its principal-scoped equivalent) down to that grade's actual flagged learners.
- **School Intelligence → Learner Blueprint**: no direct link — the snapshot has no learner-level granularity to link from. The connection is always mediated through Attention Feed or the Learner Directory, never snapshot-to-Blueprint directly.
- **School Intelligence → Principal Workspace**: this *is* the Workspace's opening view — the weekly trend numbers are exactly "what should I look at this week," matching the mission's own funnel (School Intelligence first, then Attention, then Learner, then Blueprint).

---

## 6. Learner Directory Findings

**EduNexus needs one, and doesn't have one.** The evidence is total: no index route, no search UI, and the one search API that theoretically covers this ground is broken three separate ways (§3) and scoped to the wrong ownership model even when fixed.

Evaluating the requested filter/sort dimensions against what data already exists to support them, without designing the UI itself:

| Dimension | Data already available? |
|---|---|
| Grade / Level / Stream | Yes — Core `classes`/`grades`/`streams`, already correctly modeled |
| Risk | Yes — via `learner_profiles`/Projection (`recomputeLearnerProjection`), the canonical read path already exists and is ESLint-enforced as the only way to reach it |
| Recent change | Partial — `growthTimeline`/Blueprint History exist per-learner; no batched "who changed this week" query was found to exist yet |
| Intervention status | Yes — the Blueprint Action Plan's lifecycle states (`proposed`/`approved`/`rejected`/`deferred`) are real and queryable per learner; no school-wide aggregate query confirmed to exist |
| Parent meeting | Not verified this session (§3) |
| Blueprint status | Trivial to derive — `validation.valid`/`coherence.result` are already computed per composition, just never persisted or listed in aggregate |

**Should it become the canonical gateway into learner-level decision making? Yes — but it is the *second* stop, not the first.** Per the mission's own success criteria (School Intelligence → Attention → Learner → Blueprint), the Directory is where a Principal lands *after* a school-level number or an attention item prompts them, or when they're searching cold (parent-call scenario). It is the "learner" step in that funnel, not a replacement for the "attention" step before it — a full unfiltered directory of hundreds of learners is not itself a discovery mechanism, it's the browse/search fallback for when Attention doesn't already have the answer.

---

## 7. Decision Flow Maps

Using the mission's own template, marking what's real (✓) versus missing (✗) at each arrow, per decision type:

**Academic decline**: School Intelligence (✓, but unsurfaced) → Attention (✓ signal exists in `lib/attentionFeed/sources.ts`, ✗ wrong destination) → Learner (✗ no directory) → Blueprint (✓) → Decision (✓, prose supports it) → Action (✓, `deliver-assignment`/`deliver-compass` real) → Follow-up (✓, Review Workspace real, ✗ no aggregate queue).

**Behaviour concern**: School Intelligence (✗ no such domain) → ... → this entire flow does not exist, by deliberate absence (no discipline/behavior domain anywhere in the codebase, confirmed in the prior audit) — correctly out of Blueprint's scope, but also out of *every* other surface's scope; not this sprint's gap to close.

**Parent meeting**: Starting point unconfirmed this session → Evidence (✓, Blueprint) → Blueprint (✓) → Decision (✓) → Action (partial — no explicit "log this meeting" action was found) → Follow-up (unconfirmed).

**Holiday planning**: Teacher Reflection's `holidayFocus` (✓) → Blueprint (✓, Page 3 follow-on) → Decision (✓) → Action (✓, real Holiday Planner domain exists elsewhere in the platform, not audited this session) → Follow-up (unconfirmed this session).

**Teacher concern**: Teacher Reflection (✓ per-learner) → ... → Attention (✗ no school-wide "teachers with concerns" aggregate) → the flow breaks at exactly the same "no directory/aggregate" point as academic decline.

**Career discussion**: Career Intelligence (✓) → Blueprint Page 4 (✓) → Decision (✓) → Action (✓, "Explore the full Career Intelligence journey" link real) → Follow-up (unconfirmed).

**Promotion / Transfer**: `lib/core/promotions.ts`/`lib/core/transfers.ts` are real, correct, Core-native mechanisms (confirmed in an earlier sprint) — but whether their own review UI links back into a learner's Blueprint before the decision is made was not verified this session (§3).

**The pattern across every flow that touches an individual learner**: every single one breaks at the identical point — the "Learner" step. School Intelligence and Attention have partial or fixable paths in; Blueprint and Action are consistently strong once reached. The missing middle is the same missing middle every time.

---

## 8. Action Loop

Re-verified, not re-designed (already covered in the prior audit's §7): Assignments and Compass delivery are real (`deliver-assignment`, `deliver-compass`). Parent meeting and Teacher discussion as *logged actions* were not confirmed to exist as first-class Action Plan outcomes this session — the lifecycle's decision states (`approved`/`rejected`/`deferred`) don't include a "scheduled a conversation" outcome type as far as this audit's evidence shows. Monitoring and Re-review are covered by the Review Workspace and History view respectively, both real.

**Where a Principal still finishes wondering "what now?"**: after reading the "What we're watching" risk box on Page 3 specifically (re-confirmed from the prior audit — it's the one box on the page with no attached action), and after reading the Career "doors" grid on Page 4 (four informative cards, one link, at the bottom, not per-card).

---

## 9. Navigation Audit

Counting real interactions, not ideal ones, from each named starting point to a specific learner's Blueprint, as the codebase stands today:

| From | Clicks today | Within 3? |
|---|---|---|
| Principal Home | **N/A — doesn't exist** | Fails by default, since there's no page to count from |
| Attention Feed | Click item → lands on class/student detail (not Blueprint) → must find a Blueprint link from there, if one exists on that page (not confirmed this session) → **at least 3, likely more, and the first click is already the wrong destination** | No |
| Learner Directory | **N/A — doesn't exist** | Fails by default |
| Class View | Classes list → specific class → student row's Blueprint link → **3 clicks, correct destination** | **Yes** — this is the one path that already meets the mission's own bar |
| School Intelligence | **N/A — doesn't exist as a UI surface** | Fails by default |
| Search | Would be 1 click if it worked (type name, click result) — **but it's broken three ways (§3)**, so today it's **infinite (never arrives)** | No |

**The single existing good path is Class View, at exactly 3 clicks.** Every other named starting point either doesn't exist or terminates at the wrong page. This is a narrow, encouraging finding: the mission's "3 interactions" bar is already proven achievable by one real, working path — the job is replicating that same shape (list → specific item → Blueprint link) at three more starting points (Attention, Directory, School Intelligence), not inventing a new pattern.

---

## 10. Highest-Impact Workflow Improvements

Ordered by leverage — how much of the mission's funnel each one unlocks relative to its cost, all architecture-only (no implementation performed):

1. **Fix Attention Feed's destinations.** Change the `actionLink` values in `lib/attentionFeed/sources.ts` that concern a specific learner (risk, holiday risk — not the class-wide/subject-distribution ones, which correctly stay pointed at `/insights`) to `/student/blueprint/{learnerId}` instead of the class/student detail view. This is a values-only change to existing code, zero new architecture, and immediately closes the Attention → Blueprint gap for every flow in §7 that already has a real signal.
2. **Build the Learner Directory as a real, indexed route** (`app/teacher/learners/page.tsx` doesn't exist — this is a genuine gap, not a redirect fix), scoped to Core `learners`/`school_users` (school-wide), not legacy `students.teacher_id` (one-teacher-scoped) — this is the fix that makes the directory usable by a Principal at all, not just by a teacher of that specific learner.
3. **Fix or retire the three-way-broken Search.** Given it has zero current UI trigger and three independent defects, this is a real build-vs-delete decision for a future sprint, not a quick patch — named here so it isn't mistaken for "already working" and left silently broken.
4. **Surface `school_intelligence_snapshots` as the Principal Workspace's opening view**, explicitly as counts/trends only, with each number linking into the (now-fixed) Attention Feed or Directory filtered to that grade — never presenting the snapshot as if it were itself a learner list.

---

## 11. Implementation Order

Architecture-only sequencing (no step executed this sprint), respecting dependencies:

1. Fix Attention Feed destinations (§10.1) — zero dependencies, immediately valuable on its own, safe to do first.
2. Build the Learner Directory on Core identity (§10.2) — depends on nothing else in this list, but is the largest single piece of new surface area.
3. Decide Search's fate (§10.3) — informed by whether the Directory (step 2) already satisfies the "find a learner by name" need well enough to make repairing Search redundant; likely resolves to "retire it" once the Directory exists.
4. Build the Principal Workspace home over `school_intelligence_snapshots` (§10.4) — depends on steps 1 and 2 both existing, since its numbers need somewhere real to link *to*.
5. Re-audit the Decision Flow Maps' unconfirmed cells (parent meetings, promotion/transfer review links, meeting-logging as an Action Plan outcome) — deliberately last, since they're currently unknowns rather than confirmed gaps, and shouldn't block the four confirmed, load-bearing fixes above.

---

## 12. Final Principal Experience Score

| Dimension | Score /10 | Basis |
|---|---|---|
| Document Quality | 8 | Unchanged from the prior audit — not re-evaluated here by design |
| Workflow Quality | 3 | One real, working 3-click path (Class View); every other named workflow either doesn't exist or terminates wrong |
| Discovery Quality | 2 | Search exists on paper and fails three independent ways in practice; no directory; no whole-school view |
| Decision Support | 7 | Once a Blueprint is open, decision support is genuinely strong (per the prior audit) — this dimension is about the document, which this sprint didn't re-litigate |
| Navigation | 3 | 3-of-3 named entry points other than Class View fail the mission's own "3 interactions" bar outright, by not existing |
| Actionability | 7 | The Action Plan → Assignment/Compass pipeline is real and strong; two known dead-end sections (risk box, career doors grid) keep it off a higher score |

**Overall Principal Experience Score: 4.5/10.**

Per this sprint's own instruction — "the Blueprint should only receive a high overall score when the entire workflow supports it" — the strong Document Quality and Decision Support scores are correctly outweighed by Discovery and Navigation, which are close to the floor. This is not a regression from the prior audit's 5.5/10; it's a sharper, lower-level view of the same gap, now with the specific broken component (Search) identified by name and three concrete, ordered fixes in hand rather than general direction. The verdict is consistent across both audits: **the document has already arrived; the school hasn't been given a road to it yet.**
