# Sprint 12S — Parent Action Centre (Blueprint Guided Actions)

**Status: implemented.** Presentation layer only — zero recalculation, zero new repositories/services, zero write paths, zero new domain logic.

---

## Phase 1 — Architecture Audit

Searched the entire codebase for every existing "tell the parent what to do" generator before writing anything. Confirmed **no canonical parent-action engine exists** — instead, at least **six independent, uncoordinated systems** already produce parent-facing action/recommendation text:

| Generator | Location | Notes |
|---|---|---|
| `buildParentAction()` | `lib/academicClinic/reportGenerator.ts:1195` | Academic Clinic's own PDF-report action, subject-progress-sourced |
| `buildParentAction()` | `lib/learnerIntelligence/blueprint.ts:150` | The **legacy pre-Sprint-12G Blueprint predecessor module** — has its own independent parent-action builder, reading holiday plans/risk flags directly |
| `buildParentAction()` | `lib/parentPulse/builder.ts:124` | The weekly WhatsApp digest's own action builder (documented in Sprint 12P's audit) |
| `parent_action` (per-week) | `lib/holiday/planner.ts` | AI-generated (DeepSeek) per-week action text, plus a separate AI-generated WhatsApp message |
| Conversation-starter suggestions | `lib/career/parentIntelligence.ts` | Capability-dimension-keyed "what to ask/do" text, a different vocabulary again |
| `action` field | `lib/learnerBlueprint/composeParentSummary.ts` | Blueprint's own single deterministic action field (Sprint 12G) — the only one of the six that's Blueprint-canonical |

**Findings, answering Phase 1's explicit questions**:
- **Does a canonical parent-action engine already exist?** No.
- **Are multiple recommendation systems already present?** Yes — six, confirmed above, none coordinated, none reused by any other.
- **Can Blueprint reuse one?** No — every one of the five non-Blueprint generators either reads a domain directly (Academic Clinic, the legacy Blueprint module, Holiday Planner) or is AI-generated (Holiday Planner, indirectly Career's conversation starters' tone), which this sprint's own Constitutional Goal forbids for the Action Centre ("It never recalculates. It never predicts."). None of the six was touched, called, or duplicated by this sprint's new code — the Parent Action Centre is a genuinely new, seventh system, but one built exclusively from Blueprint's own already-composed sections plus one Blueprint Snapshot read, never from any of the five non-canonical generators above.

No STOP condition was triggered (no existing module could be reused as-is without violating the "never predict, never recalculate" constraint), so Phase 2 proceeded.

---

## Phase 2 — Canonical Domain Ownership (frozen)

Implemented exactly the mission's table, no additions:

| Action | Owner |
|---|---|
| Continue Holiday Learning | Learning Compass |
| Read Teacher Reflection | Teacher Reflection |
| Review Attendance | Attendance |
| Celebrate Achievement | Blueprint Snapshot |
| View Report Card | Report Cards |
| Explore Career Journey | Career Intelligence |
| No Action Needed | Parent Action Centre (presentation only) |

Every action's `sourceDomain` field is set to one of exactly these seven strings — confirmed by `actions.pure.test.ts`.

---

## Phase 3 — Action Model

`lib/parentExperience/actions.ts` — `ParentAction` type: `title`, `description`, `actionType`, `priority`, `sourceDomain`, `destination`, `available`, `reasonUnavailable`, `generatedAt`. No AI text (every description is a fixed template string, parameterized only by already-composed Blueprint field values — a subject name, a cluster name, a percentage, a teacher's signature); no duplication (each `actionType` maps to exactly one trigger condition, one description template, verified by the "no duplicated action type" assertion in `actions.pure.test.ts`).

---

## Phase 4 — Action Composer

`composeParentActions()` — pure, synchronous, no DB access, no `await` anywhere in its body. Takes this Blueprint's own already-composed sibling sections (`learningCompass`, `teacherReflection`, `attendance`, `career`) plus the latest Blueprint Snapshot (fetched once by the caller) as its only inputs, and returns one `{ actions: ParentAction[] }` response. One call, one response, exactly as specified.

---

## Phase 5 — Blueprint Integration

Blueprint gains exactly one new section: **Recommended Next Steps** (`recommendedNextSteps: BlueprintSection<RecommendedNextStepsData>`, `RecommendedNextStepsData = { actions: ParentAction[] }`). New thin composer `lib/learnerBlueprint/composeRecommendedNextSteps.ts` performs no selection logic itself — it reads the one additional signal not already among Blueprint's own sibling sections (`getLatestBlueprintSnapshot()`, Sprint 12L-R's function, its first real consumer) and passes everything straight into `composeParentActions()`. Wired into `composeBlueprint.ts` as the tenth and final section. `validation.ts`'s `ALL_SECTIONS` updated to include it (owner-presence/status-validity checks now cover it too).

**One deliberate, explicit exception to the usual layering, documented rather than silently done**: `lib/learnerBlueprint/composeRecommendedNextSteps.ts` imports from `lib/parentExperience/actions.ts` — normally Parent Experience is strictly *downstream* of Blueprint (ADR-0010 Part 8). Here, Blueprint's own composition step calls into a function that happens to live under `lib/parentExperience/` because the mission's Deliverables explicitly named that file path and because the same selection logic must be reusable by both Blueprint's own section and any future Parent Experience surface, without a second implementation. The constitutional flow is still honored in substance: `composeParentActions()`'s only inputs are Blueprint's own already-domain-sourced sections and a Blueprint Snapshot — it never reads Evidence, Projection, or any canonical domain directly. Evidence → Domain Intelligence → Blueprint's other sections → `composeParentActions()` → Blueprint's own new section — never Evidence → Parent Action Centre directly, confirmed by code review (the function's only parameters are pre-composed `BlueprintSection<T>` values and a `BlueprintSnapshotRow`).

---

## Phase 6 — Parent Portal

Parent Home (`app/(parent)/child/[learnerId]/page.tsx`) gained a "Today's Actions" block at the top of the page, rendered by new `components/parent/ParentActionCard.tsx`, fed directly by `blueprint.recommendedNextSteps.data.actions` — **no second call to `composeParentActions()` anywhere in Parent Portal code**; Parent Home only ever reads the field off the same `composeBlueprint()` result it already fetches for every other teaser card. No notifications, no inbox — the block is a plain, always-visible list on the existing Home page, nothing pushed, nothing polled.

The full Blueprint page (`ParentBlueprintView.tsx`) also gained a "Recommended Next Steps" card, reusing the same `RecommendedNextStepsSection` content renderer Teacher's `BlueprintView.tsx` uses (Sprint 12J's established one-renderer-per-section-content discipline) — zero duplicated rendering. This is a new row in ADR-0010 Part 3's Visibility Matrix (which predates this section's existence): **Recommended Next Steps — Yes**, per this sprint's own explicit Phase 6 instruction.

---

## Phase 7 — Prioritisation Rules

Four categorical tiers only (`critical`/`important`/`suggested`/`completed`) — no numeric score anywhere in the type or the composer. **At most one `critical` action** is structurally guaranteed, not just true by accident: a fixed, documented precedence list (`CRITICAL_PRECEDENCE`, currently `['review_attendance']`) demotes every candidate beyond the first critical-eligible one to `important` rather than dropping it — proven directly by `actions.pure.test.ts`'s "at most one critical action ever" test. Today only Attendance is critical-eligible (below the shared `ATTENDANCE_ATTENTION_THRESHOLD_PERCENT` threshold), but the cap mechanism itself is generic and will hold even if a future domain adds a second critical-eligible signal.

---

## Phase 8 — Empty State

When every domain reports nothing actionable, `composeParentActions()` returns exactly one action: `actionType: 'no_action_needed'`, description the literal frozen copy **"Your learner is progressing well. There are no recommended actions at this time."** — verified directly by `actions.pure.test.ts`. Never an empty array rendered as a blank card, never fabricated work.

---

## Phase 9 — Navigation

Every action's `destination` points at a real, already-existing route — never a page this sprint renders itself:

- Continue Holiday Learning / Read Teacher Reflection / Review Attendance → `/child/[learnerId]/full` (the Parent Blueprint page, which already carries these three sections — no dedicated single-domain parent page exists yet for Compass, Teacher Reflection, or Attendance individually; documented as a gap, not worked around, matching this whole sprint series' established discipline)
- Celebrate Achievement → `/child/[learnerId]/history/[snapshotId]`, the exact Snapshot that triggered it (Sprint 12Q's existing Snapshot detail page)
- View Report Card → `/report-card`, the existing `app/(parent)/report-card/page.tsx` (Sprint 12P's audit had already catalogued this route — reused verbatim, zero duplication)
- Explore Career Journey → `/career-intelligence`, the existing `app/(parent)/career-intelligence/page.tsx` (the fuller Career Intelligence surface — deliberately not Blueprint's own cluster-only card, per this Phase's explicit example: "Explore Career Journey ↓ Career Intelligence. Never duplicate Career.")

No action ever embeds another domain's content inline — every card is a link, never an iframe or inlined component from another domain.

---

## Phase 10 — Accessibility

Every action pairs a text label with its priority (`PRIORITY_LABEL`: "Needs Attention" / "Worth Doing Soon" / "When You Have Time" / "All Good" on Parent Home; `action.priority` shown as plain text on the full Blueprint card) — colour is never the only signal. Descriptions are short, plain-sentence templates (no jargon, no icon-only meaning) intended to remain understandable to a phone-first, potentially low-literacy reader — the same design bar ADR-0010 Part 4/Part 7 already set for the rest of Parent Experience. `ParentActionCard` uses the same `focus-visible` treatment and `max-w-2xl` responsive container as every other Parent Portal surface built this session. No print-specific styling was added — same documented, out-of-scope note as every prior Parent Portal sprint (PDF/print is a separate, not-yet-built ADR-0009 layer).

---

## Phase 11 — Tests

`lib/parentExperience/actions.pure.test.ts` — 13 tests, all passing, covering the full mission checklist:

- ✓ Missing Compass → no Holiday Learning action
- ✓ Missing Career → no Career action
- ✓ Missing Reflection → no Reflection action
- ✓ No Attendance → no Attendance action (never fabricated)
- ✓ Report Card exists → View Report Card, correct destination
- ✓ Snapshot exists → Celebrate Achievement, correct destination
- ✓ Empty learner → exactly one "No Action Needed," exact frozen copy
- ✓ Mixed actions → every available domain produces its own action, none missing
- ✓ Priority ordering → never regresses (critical → important → suggested → completed)
- ✓ No duplicated action → `Set` size check across all six real action types

Plus two additional tests beyond the mission's explicit list, both directly testing Phase 7's cap mechanism and Phase 8's field completeness: "at most one critical action ever" and "every action has a real destination and timestamp."

---

## Regression

Full suite re-run after this sprint's changes: `composeBlueprint.pure.test.ts`/`composeBlueprint.integration.test.ts` (updated fixtures for the new required section, all passing), `snapshot.test.ts`, `reflection.integration.test.ts`, `parentPortal.integration.test.ts`, `growthTimeline.pure.test.ts`, `actions.pure.test.ts` — **50/50 passing, zero regressions**. `tsc --noEmit` clean. `eslint` clean on every touched/new file. `npx next build` completed successfully (exit 0, "Compiled successfully," full route manifest, no new routes added this sprint so no collision risk).

---

## Constitutional / RAS / ADR Compliance

- **Constitutional Goal** ("Evidence → Domain Intelligence → Blueprint → Parent Experience → Parent Action Centre, never Evidence → Parent Action Centre directly") — confirmed by code review: `composeParentActions()`'s only inputs are Blueprint's own already-composed `BlueprintSection<T>` values and a `BlueprintSnapshotRow`; it imports nothing from `lib/core/`, `lib/projection/`, `lib/intelligence/`, or any evidence-adjacent module.
- **ADR-0008 Part 5/6** — the Action Centre "owns nothing, it composes, exactly like Blueprint" (mission's own Architectural Goal) — confirmed: zero calculation code, only selection over already-existing outputs.
- **ADR-0010 Part 4/6/7** — plain language, no internal identifiers exposed on Parent Home's teaser card (no `sourceDomain`/owner shown there, only on the full Blueprint's more detailed card, consistent with the rest of this sprint series' Home-vs-Full distinction), no colour-only meaning, no judgment/comparison language anywhere in any action description.
- **Educational Constitution Article XI** — every priority tier ships with a plain-language label, never a bare enum value shown to a parent.
- **No new canonical domain, identity, calculation, or write path** — confirmed; every value in `ParentAction` traces to a field one of the six named owning domains (via Blueprint) already produced.

---

## Verification Checklist — evidence

- **Exactly one owner per action**: Phase 2's table, implemented verbatim — confirmed by `sourceDomain` assertions in `actions.pure.test.ts`.
- **No duplicated business logic**: confirmed — none of the five non-canonical parent-action generators found in Phase 1 is imported or called anywhere in this sprint's new code.
- **Parent Action Centre owns no canonical data**: confirmed — no new table, no new repository, no new service; `lib/parentExperience/actions.ts` and `composeRecommendedNextSteps.ts` are pure functions.
- **Every action links to an existing domain**: Phase 9, above — all six real action types point at real, pre-existing routes.
- **Blueprint remains read-only**: confirmed — no write path exists anywhere in this sprint's code; `composeParentActions()` performs zero database calls.
- **Empty state never fabricates advice**: Phase 8, verified directly by test.
- **One high-priority action maximum**: Phase 7's cap mechanism, verified directly by test.
- **No AI-generated recommendations**: confirmed by code review — every description is a fixed template string over already-composed field values, no `lib/ai/` import anywhere in this sprint's code.
- **`tsc --noEmit`**: clean.
- **`eslint`**: clean on every touched/new file.
- **All tests passing**: 50/50 combined regression + new tests.

---

## Stop Condition

Per explicit mission instruction: the Parent Action Centre is complete. **Stop here.** Notifications, messaging, Behaviour, Portfolio, Community, Homework, Educational Identity implementation, AI copilots, parent chat, and calendar integration do not begin. Waiting for explicit approval before Sprint 12T.
