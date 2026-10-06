# ADR-0033 — Career Intelligence Corrective Pass

**Status**: Accepted — FIX 1–7 implemented (2026-10-06). The FIX 6 migration is written but must be applied to the live database before the code deploys (see FIX 6, Deployment order).
**Depends on**: ADR-0029 + addendum H2D (momentumTrend vs netTrend stay separate), ADR-0006 §4 (Junior = orientation, never a job title), `docs/architecture/learner-record-layer-decisions.md` Decision 6 (capabilityExtractor is the Reasoning layer's first citizen).
**Scope**: The in-school Career Intelligence pipeline only — `lib/career/capabilityExtractor.ts` → `capabilityMatchEngine.ts` → `lib/learnerIntelligence/careerIntelligence(Orchestration).ts`, plus the career corpus and its freshness/provenance (`knowledgeLifecycle.ts`, `knowledgeRequests.ts`, `careers` table). Not a redesign: no weight map, tier cut-off or level band was changed.

## The principle

> Measure only what there is evidence to measure. Treat missing evidence as unknown, not weakness. Separate performance from trajectory, stability from improvement, AI drafting from human verification, and cohort context from individual matching. Never let a number exceed the meaning of its scale.

Every fix below is that principle applied to one place where the code violated it.

## Invariants preserved (unchanged by this ADR)

- No AI anywhere in the per-learner path; extractor and match engine stay deterministic and token-free.
- `resolveFreshCapabilityProfile(studentId)` remains the one canonical resolver.
- `detectTrend` (momentumTrend) and the Projection Engine's netTrend stay separate.
- No evidence → explicit notice; thin evidence → capped score + Low/Medium label + caveat.
- Careers without `required_capabilities` are skipped, never faked.
- Juniors (Grades 7–9) see career families only.
- The extractor stays DB-free (`capabilityExtractorPurity.architecture.test.ts` passes untouched).

---

## FIX 2 — The match score is bounded to [0, 1]

**Context.** `scoreDimension` gave full credit (`= weight`) at or above ideal and then multiplied by the trend multiplier (accelerating = 1.08). A perfect accelerating learner reached `rawScore = 1.08` and `alignmentToPercent = 108%`. The confidence caps only ever lower a score, so they never caught it.

**Decision.** Each dimension contribution is capped at its own weight *after* the multiplier; `rawScore` is clamped to [0, 1] before the confidence caps. All values are on the normalized 0–1 scale.

**Alternatives considered.** (a) Clamp only the displayed percentage — rejected: the underlying score would still violate its contract and every non-UI consumer would see 1.08. (b) Drop the trend multiplier — rejected: it would remove momentum reweighting for learners below ideal, which is legitimate signal.

**Consequence.** Momentum still lifts a below-ideal learner (base < weight, so a 1.04–1.08× nudge lands at or under full credit). A perfect accelerating learner now scores exactly 1.0.

## FIX 3 — Zero-confidence dimensions are excluded, not scored as weakness

**Context.** The match engine read `raw_score`, `trend` and `level` but never `confidence`. A dimension with no observed subjects carries the extractor's placeholder `raw_score = 0.35, confidence = 0`. The engine scored that 0.35 as a measurement — dragging the match down — and, when a career required more than 0.35, generated a gap narrative ("Creative Thinking is a moderate gap") about a dimension with zero evidence.

**Decision.** A dimension with `confidence === 0` is excluded from the numerator, the denominator, gap and strength classification, and the narrative. `score = Σ observed contributions / Σ observed required weight`. When more than 50% of a career's required weight is excluded, the match confidence is floored to **Low** and the narrative names the unmeasured dimensions. When every required dimension is unobserved, the career is skipped.

**Alternatives considered.** *Confidence weighting* (scale each contribution by its confidence) — rejected. It keeps a fraction of the placeholder 0.35 in the score, so "no evidence" still moves the number, just less; and a confidence-weighted gap is still a fabricated gap. Exclusion matches the existing "skip, never fake" invariant exactly.

**Why 50%.** At or below half, the match still rests on the majority of what the career needs; above it, it does not. The floor is about evidence *coverage*, independent of evidence *volume* — a learner with many assessments but no creative subjects still gets Low on a creative-heavy career.

## FIX 1 — Resilience separates stability, improvement and recovery

**Context.** `computeResilience` scored only each subject's first→last delta. Consequences, measured on synthetic histories (3 subjects, 4 assessments): a learner holding CBC 3.8 every term scored **0.43 "developing"** (flat cannot improve); a learner whose only movement was one bad first assessment followed by their usual level scored **0.96 "exceptional"** (regression to the mean read as growth); an up-down-up oscillation ending high also scored **0.96**.

**Decision.** Each subject is classified into exactly one trajectory, checked in order: volatile (≥2 big-move reversals) → recovered (a mid-history dip below an *earlier* peak, ending back at or above it) → declining → bad-first (first point the strict minimum, the rest settled above it) → improving → sustained-strong (≥ CBC 3.5 at every point, ≥3 points) → stable (credit scaled by the normalized level held). With no improving and no recovered subject, the score is capped at 0.69.

**Scales.** Per-subject thresholds are raw CBC 1–4 (`normalizeSubjectScores` canonicalises keys, never values). The stable-hold credit and every credit/penalty/ceiling are normalized 0–1. The overall trend still uses `detectTrend` on normalized averages, unchanged. The `<2`-assessment branch is unchanged value for value.

**Alternatives considered.** *Sustained strength sufficient for "strong"* — rejected. A learner holding a high level has demonstrated consistency, not growth under difficulty; "strong" resilience is reserved for upward movement or genuine recovery. Sustained strength alone reaches "capable".

**Tuning note.** Two new constants were moved off level boundaries (stable-hold credit 0.20, recovery credit 0.33) so canonical cases do not change label on floating-point rounding.

**Known limitation (not changed, flagged).** A flat-low learner (CBC 1.5) reads "developing" (0.433), not "emerging", because the pre-existing neutral base of 0.35 sits inside the developing band. Changing the base or the level bands was out of scope without explicit approval. Flat-low is still the lowest of the flat cases.

## FIX 6 — "Verified" means verified: `careers.verification_source`

**Context — what was actually wrong.** There is no autonomous AI path that stamps `knowledge_verified_at`; only `runSeed` (hand-curated corpus) and `publishReviewedCareer` (a human reviewer) ever set it, and AI generation only enqueues a pending review. The real gap was provenance: a dated career rendered as plain "fresh" whether it was hand-curated, an AI draft a person reviewed, or a row of unknown origin.

**Decision.** Add nullable `careers.verification_source` ∈ {`human`, `source_cited`, `ai_drafted`}:

| Value | Meaning | Set by |
|---|---|---|
| `human` | Hand-curated, or re-verified by a person | `runSeed`; `markCareerHumanVerified` (admin) |
| `source_cited` | AI draft a person reviewed and published | `publishReviewedCareer` — assigned *after* the payload spread, so a generated payload cannot claim its own provenance |
| `ai_drafted` | Generated, not human-reviewed | `generateCareerProfile` (the draft declares itself) |
| `NULL` | Provenance not recorded | never assigned; legacy rows only |

`assessCareerKnowledge(verifiedAt, now, verificationSource)`:
- `human` — time-based freshness, original labels.
- `source_cited` — time-based freshness; label always begins "Drafted with AI and reviewed by a person."
- `ai_drafted` and `NULL` — never fresh: `unknown`, historical framing, their own verbatim-safe labels; the date is shown as a draft/last-updated date, never as a confirmation.

The single production caller passes `career.verification_source ?? null`, so a missing value fails safe. Omitting the argument entirely keeps the time-only behaviour existing tests rely on; an architecture guard proves the production caller never omits it.

**Human verification path.** `markCareerHumanVerified(slug, reviewerId, note)` reuses the previously orphaned `repos.careers.markCareerKnowledgeVerified`, now recording `human`. It requires a named reviewer and a non-empty note (what was checked, against what). Exposed at `POST /api/admin/career/verify` behind the same `requireGrowthUser` gate as the review route. `publishReviewedCareer` remains the only way new knowledge enters the corpus; the verify action never touches the review queue.

**Alternatives considered.** *Classify a human-reviewed AI draft as `human`* — rejected: a reader could not tell a reviewed model draft from hand-curated data, which is the distinction this fix exists to make. *Default NULL rows to `human` or `ai_drafted`* — rejected: both are guesses.

**Backfill (audit 2026-10-06, read-only; 43 rows, all `source='seed'`).**
- **18 → `human`**: rows with `knowledge_source_note = 'Curated seed corpus (lib/career/seedCareers.ts)'` — software-engineer, medical-doctor, agricultural-scientist, civil-engineer, teacher-education-technologist, entrepreneur-business, journalist-content-creator, environmental-scientist, graphic-designer-creative-technologist, accountant-financial-analyst, advocate-lawyer, journalist-media-producer, social-worker-community-developer, public-administrator, economist-policy-analyst, counselling-psychologist, graphic-designer-creative-director, sports-coach-athlete-development. The `human` claim rests on `seedCareers.ts`'s own statement that the corpus was written and checked by a person; no reviewer is recorded per row.
- **0 → `source_cited`**: the review queue has never published a row.
- **25 → NULL (manual review required)**: created 2026-06-16, `knowledge_source_note` NULL, not in `seedCareers.ts`. Names trace to the Academic Clinic career list (`lib/academicClinic/careerEngine.ts`) and capability metadata to `scripts/seed-cos-batch2.ts`, but no repository file contains their full profiles (doors, salary bands, AI impact), and their `knowledge_verified_at` was itself backfilled from `updated_at` by `20260813140000_career_knowledge_lifecycle.sql` — a row-write date, not a confirmation. Rows: data-scientist, pharmacist, architect, electrical-engineer, veterinarian, cybersecurity-analyst, ux-ui-designer, renewable-energy-engineer, drone-pilot-gis, actuary, quantity-surveyor, digital-health-specialist, creative-director, musician, interior-designer, film-director, event-planner, fashion-designer, animator-game-developer, human-resources, diplomat, tourism-safari-manager, supply-chain-manager, insurance-specialist, urban-planner. Each is resolved by a person checking its facts and calling the verify action.

**Deployment order.** The migration must be applied before deploying code that selects `verification_source`; roll back code before the column.

## FIX 4 — Senior pathway honesty

**Context.** Senior matching is partly circular: pathway choice → subjects taken → capability dimensions → matches. So Senior matches mostly confirm the pathway already chosen, while presenting as a neutral reading of the learner.

**Decision.** Not redesigned; disclosed. Each Senior `CareerMatchInsight` carries `careerPathway` and `pathwayRelation` (`within_pathway` | `cross_pathway`), which is null when the learner's pathway is not on record. The strongest cross-pathway match reaching at least the Stretch tier is surfaced as `outsidePathway` (entrepreneurial-tier duplicates excluded). Every Senior output carries a one-line `pathwayNote`: matches reflect subject choices, "not which careers would suit you best". Scores, tiers and order are unchanged. Pathway names validate against `SENIOR_PATHWAYS`.

**Alternatives considered.** Down-weighting within-pathway matches — rejected as a redesign that would invent a correction with no evidence behind its size.

**Data finding.** 410 of 413 Senior learners have no `current_pathway`, so today most Senior outputs carry the "not on record" note and no tags. The tagging is correct; the input data is missing.

**Not done.** The new fields are in the lib/API output. No UI component renders `outsidePathway` or `pathwayNote` yet (components are UI-only; a follow-up).

## FIX 5 — Cohort-relative capability (additive only)

**Context.** Raw CBC levels mix learner ability with school quality.

**Decision.** `CapabilityProfile.cohort_relative` (nullable): a per-dimension mid-rank percentile among learners in the same Core school (`students.external_id → learners.school_id`; `students.school_id` is unpopulated for all rows) and grade, from peers' saved profiles. Below 15 learners with evidence → `insufficient_cohort` with a reason. The same floor applies per dimension, and a dimension with learner confidence 0 → null. Missing grade, bridge or school → `unavailable` with the reason. A load failure degrades to `unavailable` (logged) and never costs the learner their Career Intelligence.

**Placement.** The pure math is in `lib/career/cohortRelative.ts`. The extractor stays DB-free and returns `cohort_relative: null`. The orchestration layer attaches the view inside `resolveFreshCapabilityProfile`. Saved profiles are written by the extractor directly, so a cohort view is never persisted. Peer ids are filtered in bounded chunks of 100.

**Placeholder fix (found by live testing).** Resilience below 2 assessments is the extractor's fixed placeholder (0.40, confidence 0.15). Because its confidence is non-zero, the first version ranked it, and a live read-only check on a cohort where everyone had one assessment put every learner at exactly the 50th percentile. Resilience is now ranked only for profiles with 2+ assessments.

**Never in the score.** A test proves that adding the view leaves every match unchanged, and a source guard proves the match engine never references `cohort_relative`.

**Equity report.** `scripts/career-tier-distribution.ts` is read-only and reports each learner's best tier per school (optionally per grade), as a terminal table plus CSV, with small samples flagged and no learner identifiers.

**Real cohorts (2026-10-06).** One school's Grades 7, 8 and 9 (57–71 learners with profiles each) and one school's Grade 10 (22 of 136) clear the floor.

## FIX 7 — Validity

- `docs/career-intelligence/METHODOLOGY.md`: the full method for an external evaluator, with an explicit limitations section.
- `lib/learnerIntelligence/careerSyntheticLearners.test.ts`: synthetic learners run end to end through the real extractor, engine and orchestration against the curated 18-career corpus (fixtures: `lib/testing/careerSyntheticLearners.ts`; `CAREER_COS_META` is exported for this).

**Findings recorded, not acted on** (per the instruction to flag rather than change):

1. **Entrepreneurial tier base rate is 85%** (17 of 20 deterministic synthetic Senior learners), identical before and after this pass. The cause is the "any one of creative / resilience / social ≥ 0.50" rule, which most learners clear (in that set, 14/20 for each dimension individually). Threshold unchanged; for review.
2. **Junior output names example careers.** The spec required "zero job titles" for Juniors. As built, Junior families list unranked `exampleCareerTitles`, rendered on the student Career Explorer and the parent Career Intelligence page. What is actually enforced (and now tested) is no ranked or scored single career for a Junior. Removing the examples is a product decision, left open.
3. **Ceiling saturation.** Learners near the top of every subject reach 100% on many careers at once, and the order among ties is corpus order. This predates the pass (ties previously sat at 104–108%).
4. **The FIX 3 coverage floor never fires on the curated corpus.** No career relies on one dimension for more than 50% of its weight (max creative share: 40%).
5. **Live tier report, after the migration (2026-10-06, 328 learners with saved profiles).** Overall best tier: Strong 11%, Stretch 48%, Alternative 41%; entrepreneurial 10% (34/328, real data, against the synthetic 85%). **Kangai Junior School (first pilot, 197 learners): 0% Strong, 32% Stretch, 68% Alternative.** Every Kangai learner has exactly one assessment (so a 65% cap, never Strong), and average normalized analytical/technical scores are 0.04 in Grades 7 and 9 (≈ CBC 1.1), 0.18 in Grade 8. This is either a genuinely low-attaining cohort or a marks→CBC-level conversion problem in the Kangai import. **Check the import before reading these results to the school.** Juniors with no Strong/Stretch match see the existing "Add more assessments to unlock exploration areas" message, not a blank page.

---

## Tests

| Suite | Locks |
|---|---|
| `lib/career/capabilityMatchEngine.test.ts` (new) | FIX 2 bounds incl. exactly-1.0 accelerating; momentum preserved; FIX 3 Cases A–D; no fabricated weakness; confidence caps |
| `lib/career/resilience.test.ts` (new) | FIX 1 behavioural contract — flat low/middle/high ordering, stability-only ceiling, improving/accelerating/recovery ≥ strong, bad-first < recovery, volatility not rewarded, `<2` branch value-for-value |
| `lib/career/careerProvenance.test.ts` (new) | FIX 6 — the three provenance classes cannot be conflated; ai_drafted/unrecorded never fresh; publish records source_cited over a hostile payload; human verify needs reviewer + note; Blueprint note names the real cause |
| `lib/learnerIntelligence/careerPathwayHonesty.test.ts` (new) | FIX 4 — labelling, highlight selection (stretch floor, entrepreneurial excluded), note wording |
| `lib/career/cohortRelative.test.ts` (new) | FIX 5 — <15 / exactly 15 / >15, missing evidence, never alters a match, engine never reads it, extractor leaves it null |
| `lib/learnerIntelligence/careerSyntheticLearners.test.ts` (new) | FIX 7 — end-to-end synthetic learners on the real corpus + entrepreneurial base-rate print |
| `lib/career/reviewPublishGuards.architecture.test.ts` (+Guard P) | AI drafts declare `ai_drafted` and carry no verification date; the learner/AI request path never writes the corpus; source_cited is set after the payload spread; the human stamp has exactly one caller behind a named reviewer; the verify route gates before verifying; the production freshness caller always passes provenance |

Existing suites (`capabilityExtractor.test.ts` CAP-003/CAP-004, `knowledgeLifecycle.test.ts`, `knowledgeRequests.test.ts`, the purity tests) pass unmodified.

## What this ADR does not claim

Passing tests prove the code does what this document says. They do not validate that the capability weights, thresholds or credits predict real career outcomes — those remain expert judgment, as stated in `docs/career-intelligence/METHODOLOGY.md`.
