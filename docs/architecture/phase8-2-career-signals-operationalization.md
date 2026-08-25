# Phase 8.2 — Career Signals Operationalization Super Audit + Curated Expansion

**Type:** Audit + proportionate curated content expansion. Zero database changes.
**Branch:** `main` · **HEAD at start:** `8a0ca5ddf8854c533aa7b8e82edce71c85eac995`

## 1. Verdict

```
PHASE 8.2 COMPLETE WITH NAMED LIMITATIONS
```

## 2. Current architecture before

```
CareerSignal (lib/career/careerSignals.ts)
      ↓
static TS array, CAREER_SIGNALS (5 signals)
      ↓
getCareerSignalsForCareer(slug) — pure, capped at 3, most-recent-first
      ↓
CareerSignalCard (app/student/career/[slug]/page.tsx)
      ↓
learner-visible: title/summary/geography/confidence/learnerExplanation/related careers/sources (progressive disclosure)
```
Confirmed exactly as Phase 8.1 built it — no drift, no undocumented changes since.

## 3. Live consumer map

| Surface | Status |
|---|---|
| Career Detail (`/student/career/[slug]`) | **LIVE** — the only consumer |
| Career Explorer / listing page | DEAD (never wired) |
| Learner Home | DEAD (never wired — correct, per Phase 7 boundary) |
| Career Intelligence report | DEAD (never wired) |
| Parent Career Intelligence | DEAD (never wired) |
| Teacher career surfaces | DEAD (never wired) |
| Blueprint / Compass / Academic Clinic | DEAD (never wired, and must stay that way per architecture guards) |

## 4. Signal contract

Extended by one field this phase: `exploreNext: string[]` — concrete, non-personalized starting points, kept structurally distinct from `learnerExplanation`. This directly implements the mission's WHAT'S CHANGING / WHY IT MATTERS / WHAT YOU COULD EXPLORE structure, which the Phase 8.1 shape only half-expressed (it had WHY but not a distinct EXPLORE list). All other fields (source, confidence, geography, dates, mapping) were already present and sufficient — no other extension was needed.

## 5. Editorial policy

Confirmed and exercised, not just documented: 6 real candidates were rejected this phase (see §13) for exactly the excluded categories the mission names — staleness, genericness, corporate-specificity, and no-learning-relevance — proving the policy is applied, not aspirational.

## 6. Geography model

Unchanged (`KENYA`/`EAST_AFRICA`/`AFRICA`/`GLOBAL`), still guarded by the existing "GLOBAL signals never claim to already be happening in Kenya" test. All 6 new signals are `KENYA` — reflects genuinely available, fetchable Kenyan institutional sourcing this pass, not a forced quota (per the mission's explicit instruction not to manufacture geographic balance, the corpus is now 10 KENYA + 1 GLOBAL — an honest reflection of what was findable and verifiable, not a target).

## 7. Source contract

Unchanged — `publisher`/`url`/`sourceType`/`publishedAt`/`claim` per source, already sufficient. One honest adjustment made this phase: two new signals (`kenya-fintech-digital-economy-2026`, `kenya-sports-science-analytics-2026`, and one source in `kenya-mental-health-act-2026`) cite institutional reference pages with no stated publication date — rather than fabricate a plausible-looking date, `publishedAt`/`observedAt` use the actual verification date (2026-08-24), documented as such in the sources record.

## 8. Source quality policy

Unchanged 4-tier model, applied: 2 new signals cite a Tier 1 primary legal source (Kenya Law's Mental Health Act) and Tier 1 university/government pages directly; all new structural-trend claims meet the existing 2-source-including-tier1/2 corroboration bar (proven by test).

## 9. Freshness model

Unchanged (`observedAt`/`lastReviewedAt`, no automated expiry, human-reviewable). Not extended with `validUntil`/status lifecycle — the corpus is still small enough (11 signals) that this remains proportionate to defer, consistent with Phase 8's own original recommendation.

## 10. Signal taxonomy

Unchanged — the existing 9-category `CareerSignalType` union already covered every new signal without needing a new category (`NEW_WORK_PRACTICE`, `EDUCATION_ROUTE_CHANGE`, `REGIONAL_OPPORTUNITY`, `PROFESSIONAL_STANDARD_CHANGE`, `SKILL_SHIFT` were all reused, none invented).

## 11. Existing signal audit

All 5 Phase 8.1 signals reviewed: none were `HYPE`/`UNSOURCED`/`STALE`. Classified `GOOD` (well-sourced, clear interpretation) — all 5 retained unchanged in content, each gained an `exploreNext` list to meet the new contract.

## 12. New signals (6)

| Signal | Date | Geography | Careers mapped | Why relevant |
|---|---|---|---|---|
| `kenya-newsroom-ai-policy-2026` | 2026-06-02/16 | KENYA | journalist ×2 | Newsrooms formalizing AI policy + fact-checking training as standard practice |
| `kenya-jss-teacher-digital-training-2026` | 2026-06-26 | KENYA | teacher-education-technologist | 62,565 teachers trained in digital skills, a real government-scale programme |
| `kenya-fintech-digital-economy-2026` | 2026 (verified 08-24) | KENYA | entrepreneur-business, economist-policy-analyst | 450 fintech firms, 85% financial inclusion, new CBK digital-lending regulation |
| `kenya-mental-health-act-2026` | 2023-12-11 (Act) | KENYA | counselling-psychologist, social-worker-community-developer | Statutory mental-health-in-schools/clinics mandate + active government hiring |
| `kenya-sports-science-analytics-2026` | 2026 (verified 08-24) | KENYA | sports-coach-athlete-development | Sports science degrees now include performance-data analytics as core content |
| `kenya-creative-economy-bill-2026` | 2026-06-11 | KENYA | graphic-designer ×2, journalist ×2 | Ksh 8.6B budget + pending Creative Economy Bill formalizing film/design/content careers |

Full verification record (sources, tiers, corroboration reasoning): `docs/architecture/career-signals-mvp-sources.md` (Phase 8.2 addendum).

## 13. Rejected candidate signals (6)

See the rejection-log table in the sources doc addendum — includes a genuine mid-research correction (a candidate initially believed to be 2026 content, found on closer inspection to be from 2024, and dropped rather than used).

## 14. Storage decision

```
STATIC (unchanged)
```
11 signals, added by one person in one sitting, reviewed via this document — a database would add schema/RLS/admin-API/moderation surface for zero operational gain at this volume. Re-affirmed, not just assumed.

## 15. Editorial gate

Git review remains the human gate — unchanged, and still proportionate at this scale.

## 16. Automated ingestion

```
NOT BUILT
```

## 17. Career Detail result

Unchanged placement (between AI Impact and Skill Timeline sections), unchanged cap (3 cards), progressive-disclosure sources. New: each card now shows a "What you could explore" bullet list between "Why it matters" and the related-career chips.

## 18. Career Intelligence report result

**Not added.** Evaluated per the mission's explicit "do not force it" instruction: the report is generated from multiple call sites (Phase 9.1.6/9.1.7 found 4 real report-rendering surfaces for the *separate* Academic Clinic report; the Career Intelligence report itself has its own generation path in `careerIntelligenceEngine.ts`), and a safe "ABOUT YOU vs. WHAT'S CHANGING" separation would need real design work this phase's scope doesn't cover. Recommended, not attempted — named as a limitation.

## 19. Home result

```
UNCHANGED
```
No entry point added — matches the mission's default expectation exactly; no evidence surfaced to justify an exception.

## 20. Learner intelligence boundary

**Proven, not just asserted.** A genuine naming collision was discovered and guarded against this phase: `lib/learnerModel/types.ts` independently defines an unrelated type *also called* `CareerSignals` (plural — learner-specific derived data: top career matches, readiness scores, refreshed from Projection events). A new test (`careerSignals.test.ts`) proves `lib/career/careerSignals.ts` has zero reference to `lib/learnerModel/**` or `refreshCareerSignals()` — closing a real risk of future maintainer confusion between two identically-named, entirely unrelated concepts.

## 21. Career matching boundary

Unchanged — `careerSignals.ts` still imports only from `./types`; proven by the existing import-allowlist test, still passing.

## 22. Interest boundary

Unchanged — no signal-viewing code path anywhere calls `saveCareerInterest()`; not touched this phase.

## 23. Architecture guards

Existing Guards A–G (Phase 8.1) unchanged and passing. New this phase: **Guard H** (no import from `lib/academicClinic/**`) and the learner-model naming-collision guard (§20). Plus a URL-safety test (`new URL()` parse + `https:` protocol check, replacing the looser `.startsWith('https://')` check) and a mapping-breadth guard (no signal maps to more than 6 careers, currently satisfied — max is 4).

## 24. Content validation

26 tests in `careerSignals.test.ts` (up from 20), all passing — corpus-size bound (8–12), unique IDs, non-empty required fields including the new `exploreNext`, valid enums, parseable dates, source completeness, URL well-formedness, real-career-slug validation, corroboration rules, content-policy phrase bans, GLOBAL/Kenya framing guard, mapping-breadth guard, both-directions career↔signal cardinality proof.

## 25. Freshness tests

Unchanged mechanism (`observedAt`/`lastReviewedAt` parseability) — no new lifecycle states were introduced, so no new freshness tests were needed beyond what already existed.

## 26. Tests

`careerSignals.test.ts`: **26/26 pass** (up from 20). Full standard suite: **1063/1063** (up from 1057 — 6 net-new tests). `tsc --noEmit` clean. `eslint` clean. `next build` exit 0.

## 27. Files changed

- `lib/career/careerSignals.ts` — `exploreNext` field added to the type and all 11 signals; 6 new signal objects appended
- `lib/career/careerSignals.test.ts` — corpus-size bound updated (8–12), 6 new tests added (exploreNext validation, mapping-breadth guard, cardinality proof, URL well-formedness, Guard H, naming-collision guard)
- `app/student/career/[slug]/page.tsx` — `CareerSignalCard` renders the new "What you could explore" section
- `docs/architecture/career-signals-mvp-sources.md` — Phase 8.2 addendum: 6 new verification records + rejection log
- `docs/architecture/phase8-2-career-signals-operationalization.md` (this file, new)

## 28. Database changes

```
NONE
```

## 29. Named limitations

Manual curation (unchanged) · no automated ingestion · no CMS · no structured review workflow beyond git · source interpretation remains editorial · career slug identity fragility (unchanged from Phase 9) · athlete/sports-manager collision (Academic Clinic-side, unrelated to Career Signals, unaffected) · no semantic dedup · limited signal corpus (11, deliberately) · no engagement analytics (unchanged — Phase 9.1's `career_result.opened` event fires for signal-driven navigation, but no signal-specific "signal opened" event exists) · no parent-specific Career Signals design (deferred to the upcoming Parent Portal phase, per explicit instruction) · Career Intelligence report integration evaluated and deliberately not attempted (§18) · two new signals' exact publication dates were unavailable (evergreen institutional pages) — verification date used instead of a fabricated one, documented transparently.

## 30. Future automation gate

Evidence that would justify moving from manual curation toward assisted/automated ingestion: (1) the curated corpus growing past what one person can responsibly review in a sitting (a soft signal around 30–50 signals, not a hard number); (2) Phase 9.1's telemetry showing learners actually opening signal cards at meaningful volume (today: zero engagement data exists to know if anyone reads these); (3) a recurring, predictable cadence of high-quality Kenyan institutional sources being found faster than they can be manually verified. None of these conditions hold today — the honest state is 11 signals, unmeasured engagement, one-person curation velocity that has kept up with demand so far.

## 31. Phase 9 discovery status

```
Unaffected — Phase 9.2 remains blocked by Phase 9.1's telemetry observation window, independent of anything in this phase.
```
