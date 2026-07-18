# Sprint 12M — Learning Compass ↔ Learner Blueprint Integration

**Status: implemented, with two documented scope reductions (Phase 5, Phase 6/7) — per this sprint's own explicit STOP discipline, not silently worked around.**

---

## 1. Audit of Compass (Phase 1)

Audited every function Blueprint's Learning Compass section could plausibly read from:

| Concern | Canonical function | Owner |
|---|---|---|
| Next-topic decision (teacher recommendation → weakest-gap → rotation, senior pathway filtering) | `getNextSubject()` | `lib/compass/session.ts` |
| Holiday Programme existence | `findPublishedHolidayPlan()` | `lib/repositories/learner-intelligence.repository.ts`, reading `lib/holiday/planner.ts`'s output |
| Mastery / tier calculation | `tierToLevel()`, subject-tier data in `getStudentLearningContext` | `lib/compass/session.ts` / Compass's own context read — **not called by Blueprint, correctly** |
| Readiness label | *(searched — does not exist)* | — |

**Finding — no duplication**: `composeLearningCompass()` (pre-Sprint-12M) already called only `getNextSubject()` and the holiday-plan repository read; it computed nothing itself. No STOP condition triggered on duplication.

**Finding — a real constant-divergence bug**: the pre-Sprint-12M composer defined its own local `HOLIDAY_PLAN_RELEVANCE_DAYS = 90`, while the actual canonical constant already exists at `lib/holiday/types.ts:7` as `45`, documented there as shared specifically so "the Learner Blueprint... and the student Holiday page... agree on when a plan has gone stale." Blueprint was silently disagreeing with the rest of the platform about how long a holiday plan stays "available" — a duplicate constant definition with a diverged value, exactly what CLAUDE.md's "No duplicate constant definitions across files" rule exists to prevent. **Fixed** as part of the Phase 2 consolidation (below) — the new canonical summary function imports the shared constant; no local redefinition remains anywhere in Blueprint.

---

## 2. Canonical Read Interface (Phase 2)

New `lib/compass/summary.ts` — `getLearningCompassSummary(studentId)`, the one function Blueprint (or any future consumer) calls instead of reaching into `getNextSubject()` and the holiday-plan repository separately. Returns exactly two fields, pure domain output, no formatting:

```ts
type LearningCompassSummary = {
  nextSubject: NextSubject | null        // Compass's own decision, unchanged shape
  holidayProgrammeAvailable: boolean     // single boolean, ADR-0006 §3's frozen field
}
```

No presentation, no QR, no UI — confirmed by code review of the file itself.

---

## 3. Blueprint Composer (Phase 3)

`composeLearningCompass()` now calls `getLearningCompassSummary()` exactly once. Removed: the duplicate local `HOLIDAY_PLAN_RELEVANCE_DAYS` constant, the direct `getNextSubject()` call, the direct `repos.learnerIntelligence.findPublishedHolidayPlan()` call. `nextRecommendedAction`'s sentence ("Continue with X — Y") is unchanged — this is presentation formatting of exactly Compass's own subject/subtopic decision, not a new interpretation (ADR-0006's corollary: summarizing/selecting is allowed, re-deriving a new judgment is not — constructing a sentence from Compass's own chosen subject is the former).

---

## 4. Educational Readiness — fields actually rendered (Phase 4)

Confirmed by code review of `components/blueprint/sections.tsx`'s `LearningCompassSection`: only Current Learning Focus, Next Recommended Action, Holiday Programme Available, and Learning Readiness (always null, per §5) render — no practice history, AI conversations, adaptive lesson history, mastery maps, question history, session transcripts, token usage, difficulty graphs, or internal reasoning appear anywhere in Blueprint. Unchanged from before this sprint; verified, not modified.

---

## 5. Readiness Labels — confirmed gap, not implemented around (Phase 5)

Re-confirmed: Compass has **no function producing a readiness label, and no function exposing a raw readiness score either** — not a "raw scores only" situation (which would still permit deferring to a future labeling pass), but a genuine absence. Per explicit mission instruction ("If Compass only exposes raw scores: STOP. Do not invent labels. Document the gap."), `learningReadiness` stays `null`, with the existing explanatory note preserved. **This gap predates Sprint 12M** (documented since Sprint 12G) and remains open — closing it would require Compass itself to grow a new readiness-computation function, which is explicitly forbidden by this sprint's own Forbidden list ("New readiness calculation").

---

## 6. Holiday Programme — scope reduction against the mission brief, reported not built (Phase 6)

**Finding**: the mission's Phase 6 asked Blueprint to display Holiday Programme Available, Duration, Start Date, and QR Available. Checked against what's actually frozen and what Compass/Holiday actually expose:

- **ADR-0006 §3** froze exactly one Holiday Programme field for Blueprint: **"Holiday Programme availability"** — a boolean, not four sub-fields. Duration/Start Date/QR Available were never ADR-approved as Blueprint fields.
- **`HolidayPlanData`** (`lib/holiday/types.ts`), the canonical published-plan shape, has no `start_date` field at all — only a free-text `holiday_period` string (e.g. a season label) and a `weeks` array. There is nothing to read a start date from without parsing free text, which would be fabrication, not a read.
- A "Duration" could technically be derived by counting `weeks.length`, but per the mission's own instruction not to build fields beyond what's ADR-approved, and since Duration was never frozen as a Blueprint field either, it was not added.

**Decision**: `holidayProgrammeAvailable` remains exactly the single boolean ADR-0006 §3 already froze — unchanged from before this sprint. Duration and Start Date are **not implemented** and are reported here as a gap requiring an ADR amendment to ADR-0006 §3 before they could be added, not silently worked around by parsing or inventing data.

---

## 7. QR Integration — confirmed gap, not implemented around (Phase 7)

Audited the entire codebase for any existing QR generation, rendering, or URL-building logic: **none exists anywhere** — not in Compass, not in Blueprint, not in any other domain. ADR-0007 §11 names nine QR destinations as a *design freeze*, not an implementation; no sprint has built QR yet. This sprint's own Forbidden list explicitly forbids building a "QR generator." **Decision**: no QR affordance was added to the Learning Compass section this sprint. This is a pre-existing, platform-wide gap (not Compass- or Blueprint-specific) — closing it is a distinct future sprint's scope, not something to approximate here (e.g., a placeholder link would misrepresent a feature that doesn't exist).

---

## 8. Snapshot Behaviour (Phase 8)

Unchanged and re-verified: `composeBlueprint()` (which calls `composeLearningCompass()`) is the single function both the Current Blueprint page and `createBlueprintSnapshot()` call; a snapshot freezes whatever `composeLearningCompass()` returned at that moment, and the Historical Viewer renders that frozen `blueprint_payload` verbatim, exactly as Sprint 12K established — nothing in this sprint touched the snapshot pipeline itself. Confirmed by the full `snapshot.test.ts` suite still passing (5/5) after this composer change.

---

## 9. Presentation Audit (Phase 9)

`LearningCompassSection` (`components/blueprint/sections.tsx`) already renders exactly ADR-0007's shape for this section: one focus line, one recommended-action line, one Holiday Programme availability line — concise, one insight, one recommendation. No QR exit exists yet (§7). No changes made to this component this sprint — it already complied.

---

## 10. Regression (Phase 10)

Full regression suite re-run after the composer change:

- `composeBlueprint.pure.test.ts` / `composeBlueprint.integration.test.ts` — unchanged, all passing (includes the two tests that directly assert `learningCompass.status`)
- `snapshot.test.ts` — unchanged, all passing (5/5)
- Combined: 25/25 passing, zero regressions
- No file outside `lib/compass/summary.ts` (new) and `lib/learnerBlueprint/composeLearningCompass.ts` (edited) was touched — Attendance, Career, Report Cards, Identity, and every other composer in `composeBlueprint.ts` are byte-for-byte unchanged.

---

## 11. Constitutional / RAS / ADR Compliance

- **ADR-0006 §3**: implemented exactly the five frozen fields (Current Learning Focus, Learning Readiness [null, documented gap], Holiday Programme availability [boolean only], Next Recommended Action, QR [not yet built, documented gap]) — no field invented beyond what's frozen.
- **ADR-0006's corollary rule** ("Blueprint may summarize... never re-derive a new interpretation"): `nextRecommendedAction`'s sentence formatting is presentation of Compass's own decision, not a second judgment.
- **RAS §10.7/§10.8**: one Compass owner, now called through exactly one function (`getLearningCompassSummary`) instead of two direct reads — strictly tightens single-owner encapsulation versus the prior implementation.
- **CLAUDE.md "No duplicate constant definitions across files"**: the `HOLIDAY_PLAN_RELEVANCE_DAYS` divergence (90 vs. the canonical 45) is fixed — one definition remains, imported, not copied.
- **No new canonical domain, identity, calculation, or write path** — confirmed; every change is either a consolidating refactor or an explicit "not built, here's why" gap report.

---

## Verification

- One Compass owner, one Compass calculation — confirmed; `getLearningCompassSummary` calls `getNextSubject` and the holiday-plan read, nothing recomputed.
- Blueprint consumes only — confirmed by code review of `composeLearningCompass.ts`.
- Snapshots remain immutable, historical snapshots unchanged — confirmed, `snapshot.test.ts` 5/5.
- No duplicated logic — confirmed; the one real duplication found (`HOLIDAY_PLAN_RELEVANCE_DAYS`) was fixed, not left in place.
- No duplicated readiness calculation — none exists to duplicate; Blueprint still renders `null`.
- `tsc --noEmit`: clean.
- `eslint`: clean on both touched/new files.
- All tests pass: 25/25 (composeBlueprint pure + integration + snapshot suites).

---

## Stop Condition

Per explicit mission instruction: Learning Compass integration complete, with Phases 5–7 resolved as documented gaps rather than implemented workarounds. **Stop here.** Sprint 12N (Career Intelligence integration) does not begin in this sprint.
