# Learner Blueprint — Principal Decision Experience Audit

**Date:** 2026-08-03
**Type:** Decision-support audit. Not implementation, not UI redesign, not an Educational Intelligence or editorial sprint. No code changed.
**Premise accepted as given:** the Blueprint is architecturally correct, the Evidence Engine is correct, editorial quality is acceptable (per the two preceding sprints). This document asks a different question entirely: **does it help a Principal make better decisions, faster, today** — evaluated against the real codebase (`components/blueprint/BlueprintView.tsx`, `lib/attentionFeed/*`, `app/teacher/**`), not the ideal design.

---

## 1. Executive Verdict

**The document is excellent. The path to it is the problem.**

Once a Principal has a specific learner's Blueprint open, it genuinely passes the Thirty-Second Test (§3) and reads as calm, evidence-honest, and non-punitive (§9) — this is real decision-support prose, not a report. But two structural gaps sit *in front of* that document, and they're severe enough to threaten §10's verdict on their own:

1. **There is no way to arrive at a learner's Blueprint except already knowing which learner and which class they're in.** No whole-school view exists. No searchable learner list exists (`app/teacher/learners/` has exactly one route, `[learnerId]/blueprint/review`, which requires a `learnerId` you already have — there is no `app/teacher/learners/page.tsx`, confirmed by direct file listing). A Principal who gets a parent call about "a kid in Grade 9" with no name in hand has no in-product path to the Blueprint at all.
2. **The platform's own proactive "what needs attention" surface never links to it.** Every `actionLink` in `lib/attentionFeed/sources.ts` (9 call sites, grepped directly) points to `/teacher/classes/{classId}/students/{studentId}` or `/teacher/classes/{classId}/insights` — plain class-detail views, never `/student/blueprint/{learnerId}`. The system that's supposed to tell a Principal "here's who needs you today" doesn't hand them the one document actually built to answer that.

A Principal who is *told* to open a specific learner's Blueprint (a parent meeting already scheduled, a teacher hands them a printout, a direct link from somewhere) gets real value from it. A Principal trying to use it as their daily decision-support tool — the mission's own framing — currently cannot, because nothing in their daily workflow surfaces it as a destination.

---

## 2. Principal Decision Journey

| Scenario | Where the Blueprint fits today | Reality check |
|---|---|---|
| Parent requests a meeting | Opens it to prep, if they know the learner's class | No search — must navigate class roster first (`app/teacher/classes/[classId]/page.tsx` → student row → Blueprint link, per `app/teacher/reports/blueprint/[studentId]/page.tsx`'s own header comment) |
| Teacher raises a concern | Should be the natural next click from the concern itself | Doesn't happen — Attention Feed items link to the class/student detail view, never the Blueprint (`lib/attentionFeed/sources.ts`, all 9 `actionLink` values) |
| Learner performance drops | Same gap | Same — nothing routes a dropping-performance signal into the Blueprint automatically |
| Board asks for an explanation | Blueprint is genuinely strong here *if already open* — calm, evidence-grounded prose | But raw evidence IDs/confidence numbers are deliberately never shown (`BlueprintView.tsx`'s own header: "never a raw percentage, badge, owner name, freshness label, or evidence ID") — a board pressing "show me the actual data" hits a wall, see §6 |
| End-of-term review | Plausible use, one learner at a time | No batch/whole-class view exists — reviewing 30 learners means 30 separate navigations, each requiring the class-roster route first |
| Transfer request | Not really Blueprint's job — `lib/core/transfers.ts` is the actual mechanism | Correctly out of scope; Blueprint isn't pretending to help here, which is honest |
| Intervention follow-up | This is what the Action Plan (approve/reject/defer, deliver-assignment, deliver-compass) is *for* | Genuinely real — see §5's Actionability findings, this is the strongest part of the whole system |

**When do they open it? When someone already told them which learner.** **When do they close it? When the specific question that brought them there is answered — there's no natural "browse to the next learner" affordance, so it closes and the next learner requires the same navigation from scratch.**

---

## 3. Thirty-Second Test

Walking Page 1 in real time, against real data (Victor Gitau, Mwatate Ridge Senior School):

| Question | Answer time | Where |
|---|---|---|
| Who is this learner? | Instant | Header: name, school, "Page 1 of 4" |
| How is the learner doing? | ~5s | Page 1's subject-level CBC badges ("Exceeding Expectations" etc.) + prose opener |
| What evidence supports that? | **Not answerable in 30 seconds — arguably not answerable on the page at all** | See §6 — no citation, no "based on N assessments" visible on Page 1 itself (that detail lives in the narrative prose on Page 2, one page later) |
| What needs attention? | ~10s, Page 3 | "What we're watching" box — but this requires already being on Page 3, not Page 1 |
| What should happen next? | ~10s, Page 3 | "The one thing that matters most right now" — a genuinely good, single, unambiguous callout |

**Verdict: 3 of 5 questions answer within 30 seconds; 2 require navigating past Page 1.** The "what should happen next" answer is excellent once reached (`priorityAction` is deliberately singular, not a list — a real design strength). The slowdown is structural: the four-page format spreads the 5 canonical questions across pages by design (Page 1 = who/how, Page 3 = what's needed/next), which is a reasonable document structure for a *read-through* but works against a *30-second* skim specifically. Nothing is technically hidden — it's paginated.

---

## 4. Meeting Simulation

Simulated with the real Victor Gitau Blueprint, four participants:

**Principal, opening cold:** "Exceptional... consistent... no risk flags... continue with mathematics." Confident, calm, no confusion. Would say this out loud in a meeting without hesitation — the prose is written for exactly this.

**Teacher, reading the "what we're watching" box:** No flags, no watch language. A teacher who *does* have a private concern not yet reflected in scored evidence would find the Blueprint silent on it — correctly so (the whole system's "no fabrication" design means it can't invent a concern it has no evidence for), but the teacher needs a separate channel to raise it (Teacher Reflection exists for exactly this and is correctly surfaced when present — for Victor, it's empty, `status: 'unavailable', unavailableReason: "This learner's teacher has not yet published a reflection."` — an honest gap, not a bug).

**Parent, hearing "Continue with mathematics" as the one priority action:** Immediately asks "why mathematics, and not [subject]?" — the Blueprint's own confidenceStatement ("moderate-confidence... coverage is still incomplete, 2 subjects") answers this if read aloud, but it lives in a different section (`learningStory`, which — per the prior editorial sprint's own finding — **isn't rendered in the actual four-page document at all**). The page the parent is looking at doesn't contain that sentence. The Principal would need to know to say it, not read it.

**Learner (self-view), reading Page 4's career direction:** "Electrical Engineer / Power Systems Specialist... one direction worth exploring... early signal that may sharpen or change." Correct hedge, no false certainty, would not induce anxiety about a locked-in future.

**Immediate follow-up questions the document itself doesn't answer:** "How many assessments is this based on?" (page 1 doesn't say — the count exists in composed data, not on the page); "When was this last updated?" (exists as `generatedAtLabel` in the footer, small, easy to miss); "Has this changed since last term?" (the History view — `/student/blueprint/{id}/history` — exists and answers this, but it's one click away, not visible on the main page itself).

---

## 5. Decision Quality Audit

| Decision | Can a Principal realistically act on the Blueprint's support for it? |
|---|---|
| Holiday support | **Yes.** `holidayFocus` (Teacher Reflection) and the Career direction both feed real, nameable next steps |
| Subject intervention | **Yes, and unusually well.** `priorityAction` is singular and concrete ("Continue [subject] learning focus with targeted practice and feedback") |
| Parent engagement | **Yes.** Parent Summary headline + detail is a ready-made talking point, third-person, warm |
| Teacher support | **Conditional.** Only populated when a Teacher Reflection exists — correctly honest when it doesn't, but means this decision has *no* support for the majority of learners without one |
| Career discussion | **Yes.** Page 4 is built exactly for this, correctly hedged for grade band (Junior vs. Senior framing genuinely differs, `getGradeBand()`) |
| Wellbeing referral | **No support at all — by deliberate design, not oversight.** `lib/learnerWellbeing/wellbeingBoundary.architecture.test.ts` (Sprint 13G) is a real, passing architecture test proving Blueprint has *zero* dependency on Wellbeing, and that no "Wellbeing Status"/"Risk Level" indicator exists anywhere in Blueprint's type shape. This is a correct safeguarding boundary (wellbeing/counseling data shouldn't share the same access model as academic data) — but it means a Principal genuinely cannot make a wellbeing decision from this document, full stop, and should never be led to expect they can |
| Academic monitoring | **Yes.** This is the document's strongest single use case |
| Transition planning | **Partial.** Career direction helps; there's no explicit "ready for Grade X" or pathway-readiness signal beyond the CBC level badges themselves |

---

## 6. Evidence Trust Audit

This is the audit's most consequential finding.

**By deliberate design** (confirmed in `BlueprintView.tsx`'s own header comment), the rendered document **never shows**: a confidence percentage, an evidence count, an evidence ID, a "last computed" timestamp, or a section owner/source. Confidence is communicated *only* through sentence hedging ("this is an early snapshot," "moderate-confidence picture," "may sharpen or change").

**What this buys:** genuinely warm, non-clinical prose — a real, considered design choice, not negligence, and it's why the document reads as written by an educator rather than a dashboard.

**What it costs:** a Principal cannot **see** the distinction the mission's Part 5 explicitly asks for (Observation / Evidence / Inference / Recommendation / Prediction / Confidence) as a *visible* structure — they can only infer it from how confidently a sentence is worded, which requires trusting the writer, not verifying the claim. For routine parent conversations this is fine, arguably better. For the mission's own "Board asks for an explanation" scenario, or a dispute ("why does it say improving when my child's marks went down"), the Principal has no on-page way to point at the underlying evidence count or date range — they'd have to go around the document (into raw data, or ask a developer) rather than through it.

**Nothing is dishonest** — the composed JSON *does* carry `supportingEvidenceIds`, `confidence`, `coverage.evidenceCount`, `freshnessDays` on every section (confirmed directly against a real composed Blueprint). The gap is presentational: that trail exists one layer beneath what's printed, not on it.

---

## 7. Actionability Audit

Genuinely strong, not just aspirational — this is the one area where the system goes further than most "AI recommends" tooling:

- `priorityAction` (Page 3) is singular by design — the mission's own worry about a wall of un-prioritized suggestions doesn't apply here.
- The Action Plan lifecycle (`lib/learnerBlueprint/actionPlan/lifecycle.ts` — propose/approve/reject/defer) is a real state machine, not a static recommendation. An approved action can become a genuine `Assignment` (`deliver-assignment`) or a queued Compass objective (`deliver-compass`) — confirmed as real, existing, tested delivery adapters from the prior Application Layer audit. A Principal or teacher who acts on a Blueprint recommendation produces a real, trackable downstream artifact, not just a checked box.
- `requireCoherentApproval` (confirmed live, seen failing correctly in this session's own test run) refuses to let a teacher approve an action if doing so would leave the Blueprint in a coherence FAIL state — a real guardrail against acting on a contradiction.

**Informative-but-non-actionable sections, named honestly:**
- Page 4's "Four ways this direction could open" (doors preview) — genuinely informative, but there's no action attached to any individual door; the only actionable link on the whole page is the single "Explore the full Career Intelligence journey" link, sitting below four cards that don't themselves lead anywhere.
- "What we're watching" (risk box, Page 3) is pure text with no attached action, unlike the priority action above it — a Principal reading an active risk flag has nothing to click from that box itself; they'd have to know to go build an intervention elsewhere.

---

## 8. Natural Workflow Findings

A Principal would naturally want, in this order: **whole-school view first → identify who needs attention → open that one learner's Blueprint.** That flow **does not exist today.** The pieces are individually real (`school_intelligence_snapshots` table, `findLatestIntelligenceSnapshot` repository method) but have **zero UI consumers** anywhere in `app/teacher/core-office/**` or `app/admin/**` (confirmed by direct grep — zero matches). The only aggregate view that exists at all is per-class (`teacher/classes/[classId]/insights`), not whole-school, and it's teacher-scoped, not principal-scoped.

**Side-by-side comparison** of two or more Blueprints doesn't exist — reading two learners means two full page-loads, no shared frame.

**Trend before detail** partially exists: the History view (`/student/blueprint/{id}/history`) is real and does let someone see change over time, but it's reached by clicking away from the current Blueprint, not offered up front as the entry point.

**The one workflow that genuinely matches "natural"**: single-learner, cold-open, front-to-back read. That's what the four-page design optimizes for, and it does it well. It is not what a Principal scanning "who needs me today" across hundreds of learners needs.

---

## 9. Emotional Readability Findings

This holds up well on direct read-through:

- **Parents**: "Victor Gitau is showing improving progress this term" (Parent Summary) — clear, respectful, no jargon. Career language ("one direction worth exploring... may sharpen or change") avoids locking in a future, which protects hope without dishonesty.
- **Teachers**: nothing in the document assigns blame or implies underperformance on the teacher's part — Teacher Reflection is framed as the teacher's own voice, not evaluated against them.
- **Principals**: the singular priority action and the calm "what we're watching" framing are genuinely confidence-building rather than alarm-triggering — a Principal reading this before a parent meeting would feel prepared, not defensive.

**Never punitive** — confirmed structurally, not just anecdotally: the Coherence Engine's `DEFICIENCY_MARKERS` list exists specifically to catch language that would read as blame or deficit ("least secure" is deliberately gated to only the genuinely-below-threshold case, per the prior editorial sprint's own verification), and the whole prose layer avoids second-person address entirely (no "you failed to," no "the learner struggles with" outside the one gated case).

---

## 10. Missing Decision Support

Genuine workflow gaps, not feature wishes — each one already demonstrated as absent in this audit, not inferred:

1. **No path to a learner without already knowing who they are.** No searchable learner directory anywhere in `app/teacher/**`.
2. **No whole-school "who needs attention" view**, despite the backing data existing unused (`school_intelligence_snapshots`).
3. **The Attention Feed doesn't connect to the Blueprint** — the one proactive nudge system in the product routes elsewhere.
4. **No side-by-side or batch view** for end-of-term review across a class or school.
5. **Wellbeing referral has zero support**, by correct design — but this means it's a real gap for the Principal's actual decision set, not a false one.
6. **Discipline/behavioral decisions have no support anywhere in the platform**, not just Blueprint — confirmed, no such domain exists in the codebase at all (`grep` for discipline/behavior/behaviour domains: zero results).
7. **No on-page evidence citation** for a Principal who needs to defend a claim to a board or a disputing parent, despite the underlying data existing one layer down.

---

## 11. Highest-Impact Improvements

Ranked by how directly each closes a gap found above, cheapest-and-most-load-bearing first:

1. **Wire Attention Feed's `actionLink` to the Blueprint, not just the class/student detail view**, for signals that are actually about the *learner* (risk, holiday risk) rather than the *class* (subject-distribution, class-wide gaps). This alone would connect the platform's one proactive surface to its best decision-support document — the smallest change with the largest workflow impact.
2. **Surface the school-level intelligence snapshot that already exists in the database** as a real page under the School Office. This is a read-only UI over data that's already computed and stored — not a new intelligence build.
3. **Add a searchable learner directory** under `/teacher/learners` (currently has zero index route) — the single missing piece that makes "parent calls about a kid I can't immediately place" solvable in-product.
4. **Put a one-line evidence-basis sentence on Page 1 itself** ("based on N assessments across N subjects, most recent on [date]") rather than leaving that detail in a narrative section that isn't even rendered on the page today — closes the Board/dispute gap without breaking the "no raw numbers" design principle (a plain-language date/count, not a confidence percentage).

None of these require new Educational Intelligence, new evidence computation, or new architecture — every one is either a routing change, a UI wrapper over already-computed data, or a one-sentence addition to an existing page. Consistent with this audit's own boundary: the document itself doesn't need to get smarter, the path to it and the fine-grained honesty of Page 1 do.

---

## 12. Final Decision Readiness Score: **5.5/10**

**The document, evaluated alone: 8/10.** Calm, honest, singularly actionable, genuinely non-punitive, backed by a real action-delivery pipeline. This half of the mission is essentially solved.

**The system, evaluated as a daily decision-support tool for a Principal with hundreds of learners: fails on reach.** A document that only helps once you already know exactly who to open it for is not yet a decision-support *tool* — it's a very good decision-support *page*. §10's gaps (no directory, no whole-school view, no Attention Feed connection) are the reason a real Principal, most days, would not open it unprompted — not because it disappoints them when they do, but because nothing in their normal workflow ever hands it to them.

**Answering the mission's own final question directly**: if every learner had this Blueprint today, most Principals would use it *when someone else already pointed them at a specific learner* — a scheduled parent meeting, a teacher's printout, a direct link. It would not yet become the thing they open first thing each morning to decide who needs them today, because the product gives them no way to ask that question and get this document as the answer. That is a routing and discovery problem sitting on top of a genuinely good document, not a defect in the document itself — and per §11, it's a cheap one to close.
