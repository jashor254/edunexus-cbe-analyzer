# EduNexus Career Intelligence — Methodology

**Audience:** external evaluators — NGOs, education researchers, school partners, technical reviewers.
**Scope:** the in-school Career Intelligence feature for Kenyan CBC (Grades 7–12) and 8-4-4 learners.
**Last revised:** 6 October 2026 (corrective pass recorded in `docs/architecture/adr-0033-career-intelligence-corrective-pass.md`).

This document describes what the system actually does, including where it is weak. Every number below is taken from the code.

---

## 1. What the system does, and what it does not claim

Career Intelligence reads a learner's **confirmed assessment results** and describes which broad kinds of work their demonstrated strengths point toward.

- **Grades 7–9 (Junior):** it shows *career families*, such as "Health Sciences". It never ranks or scores a single career for a Junior learner.
- **Grades 10–12 and 8-4-4 (Senior):** it shows ranked career matches with an alignment percentage, the strengths behind each match, and the gaps to work on.

It does **not** predict what a learner will become, and it does not measure aptitude independently of school assessments. Its weights and thresholds are **expert judgement**: they have **not yet been validated against real career or education outcomes** (see §12).

No artificial intelligence (language model) is involved in assessing a learner or matching them to careers. That part is deterministic arithmetic: the same inputs always give the same output. AI is used only to *draft* new career descriptions, and a person must review those before any learner sees them (§10).

## 2. Evidence used

The only learner input is assessment results that a teacher entered or the platform confirmed. They are stored as an append-only evidence record and summarised by EduNexus's projection engine. Each result is a CBC performance level from **1 (below expectation) to 4 (exceeding expectation)**. One "snapshot" is one assessment's results across subjects, and snapshots are ordered oldest to newest.

If a learner has no confirmed results, the system says there is not enough evidence and shows nothing else. It never fills in a default.

## 3. Two scales, kept separate

| Scale | Range | Where it is used |
|---|---|---|
| **Raw CBC** | 1–4 | Subject results as recorded; the per-subject resilience thresholds (§5) |
| **Normalised** | 0–1 | Capability scores, trend thresholds, career matching, cohort percentiles |

Conversion: `normalised = (CBC − 1) / 3`. So CBC 2.5 → 0.50, CBC 3.5 → 0.83, CBC 4 → 1.00. Every threshold in this document states which scale it uses.

## 4. The six capability dimensions

Each dimension is a weighted average of the learner's **most recent** results in the subjects that inform it, on the normalised scale. Weights are relative within each dimension and are re-normalised over the subjects actually assessed.

| Dimension | Subject weights |
|---|---|
| **Analytical Reasoning** | Mathematics / Core Mathematics 0.40 · Integrated Science 0.30 · Physics 0.25 · Chemistry 0.20 · Biology 0.15 · Geography 0.12 · Computer Studies 0.10 |
| **Communication** | English 0.50 · Kiswahili 0.30 · Social Studies 0.12 · History / History & Government 0.10 · CRE / IRE / HRE 0.08 |
| **Creative Thinking** | Creative Arts (& Sports) 0.35 · Art & Design 0.30 · Music 0.20 · English (composition) 0.10 · Pre-Technical Studies 0.08 |
| **Technical Aptitude** | Pre-Technical Studies 0.40 · Physics 0.35 · Chemistry 0.25 · Computer Studies 0.25 · Mathematics 0.15 · Integrated Science 0.12 |
| **Social Intelligence** | Community Service Learning 0.40 · Social Studies 0.30 · CRE / IRE / HRE 0.15 · Business Studies 0.15 · Kiswahili 0.10 · English 0.08 |
| **Resilience & Growth** | Not taken from any subject; derived from the trajectory across all subjects over time (§5) |

**Levels** (normalised): ≥ 0.85 exceptional · ≥ 0.70 strong · ≥ 0.50 capable · ≥ 0.30 developing · below that, emerging.

**Confidence** per dimension = the share of that dimension's total subject weight the learner has actually been assessed in (0–1).

**Missing evidence is unknown, not weakness.** If none of a dimension's subjects have been assessed, its confidence is 0 and the system stores a placeholder score of 0.35, labelled "score is an estimate". That placeholder is **never used as a measurement**: career matching ignores it (§6), and so does the cohort comparison (§9).

### Trend (per dimension)

The trend is computed on the normalised scale. It asks whether the learner's recent results are stronger than their earlier ones:

- **3 or more snapshots:** compare the average of the later half with the average of the earlier half. A difference above **+0.18** is *accelerating*, above **+0.07** is *growing*, below **−0.07** is *declining*; anything else is *stable*.
- **2 snapshots:** a change above **+0.10** is *growing*, below **−0.10** is *declining*.
- **1 snapshot:** *stable*. One result is never reported as growth or decline.

These are normalised thresholds. +0.07 corresponds to roughly +0.2 CBC points between the two halves, and +0.18 to roughly +0.5. This trend measure is deliberately different from the projection engine's first-to-last measure, and the two are kept separate on purpose.

## 5. Resilience & Growth

Resilience describes *how* a learner's results have moved, not how high they are. Fewer than **2 snapshots** gives a fixed "developing, 0.40, confidence 0.15" with the note "need at least 2 assessments". It is never computed from one result.

With 2 or more snapshots, **each subject is placed in exactly one category**, checked in this order (thresholds in **raw CBC points**):

1. **Volatile:** two or more reversals among large moves (a move bigger than 0.25), e.g. down, up, down. Earns nothing, and carries the decline penalty if it ends lower than it started.
2. **Recovered:** a result after the first drops more than 0.25 below an *earlier* high, and the latest result is back at or above that high. A low *first* result can never count as recovery, because there was no earlier high to fall from.
3. **Declining:** latest result more than 0.25 below the first.
4. **Bad first result:** the first result is the lowest, the rest sit clearly above it (by more than 0.25 on average) and stay within a 0.5 band of each other (3+ results). This is treated as returning to the learner's usual level, not as growth.
5. **Improving:** latest result more than 0.25 above the first. A rise of 0.75 or more counts as strong momentum.
6. **Sustained strength:** at or above CBC 3.5 in every result (3+ results).
7. **Stable:** anything else, credited in proportion to the level held.

The score (normalised) starts at 0.35 and adds the share of subjects in each category times its credit: improving +0.40, recovered +0.33, sustained strength +0.25, bad first result +0.15, stable +0.20 × level held (normalised). It subtracts declining × 0.20, adds 0.08 if any subject shows strong momentum and 0.05 for 4+ snapshots, and is bounded to 0.05–1.

**Stability alone cannot reach "strong".** If no subject is improving or recovered, the score is capped at 0.69. A learner holding CBC 3.8 every term reads as **capable**; "strong" requires actual upward movement or a genuine recovery.

Measured on synthetic histories (3–8 subjects, 4 snapshots): flat CBC 3.8 → capable (0.65); flat CBC 3.0 → capable (0.53); flat CBC 1.5 → developing (0.43); dip then recovery → strong (0.73); one bad first result → capable (0.55); steady improvement → exceptional (0.88); up-down-up ending high → developing (0.40).

## 6. Matching a learner to careers

Each career in the corpus records, for each dimension it needs, a **minimum**, an **ideal** and a **weight** (all normalised). Careers without these requirements are skipped, never guessed.

**Per dimension** (learner score *s*):
- *s* ≥ ideal → full weight.
- minimum ≤ *s* < ideal → 50% to 100% of the weight, linearly.
- *s* < minimum → 0% to 50% of the weight, falling with the size of the gap.
- Then a trend adjustment: accelerating ×1.08, growing ×1.04, stable ×1.00, declining ×0.94. **No dimension can contribute more than its weight**, so momentum lifts learners below the ideal but cannot push anyone past full credit.

**Unmeasured dimensions are left out.** A dimension with confidence 0 is excluded from both the total and the maximum, and no gap or strength is reported for it. The match score is

> alignment = (sum of contributions from measured dimensions) ÷ (sum of weights of measured dimensions)

bounded to **0–1**, shown as **0–100%**. If more than **half** of a career's required weight is unmeasured, the match is marked **Low confidence** with a note naming the missing dimensions. If none of what a career needs is measured, the career is not scored.

**Evidence volume caps.** With 1 snapshot, alignment is capped at 0.65; with 2, at 0.80. Confidence labels follow the same steps: 1 snapshot → Low, 2 → Medium, 3+ → High. Any match below High says in plain words that it rests on few assessments.

**Gaps** are graded against the career's minimum (normalised shortfall): under 0.10 minor, under 0.25 moderate, otherwise significant.

**Tiers:** alignment ≥ 0.70 *Strong Match* · ≥ 0.50 *Stretch Goal* · below that, *Alternative Path*. The top 5 Strong, top 5 Stretch and top 3 Alternative are kept.

**Entrepreneurial tier.** The "Entrepreneur / Business Owner" career gets an extra *Entrepreneurial Opportunity* entry when the learner has 2+ snapshots and **any one** of Creative Thinking, Resilience or Social Intelligence is ≥ 0.50 (or among their top dimensions). See the base-rate finding in §12.

**Reality check** (shown alongside, not part of the score): whether the KCSE grade the career typically requires looks reachable (e.g. A/A− expects Analytical ≥ 0.70 and Technical ≥ 0.60; B+ expects Analytical ≥ 0.55), the cost barrier (minimum cost above KES 500,000 high, above 150,000 medium), time to first income, risk, difficulty and Kenyan demand.

## 7. Junior learners (Grades 7–9)

The same scoring runs, but the output is regrouped by career family. Families are formed from Strong and Stretch matches and sorted by the best alignment in each family. A Junior learner sees family-level observations and suggested ways to explore (subjects, clubs, projects), plus **unranked example careers within each family**. They never see a ranked or scored single career. The Learner Blueprint shows Juniors only the single top cluster, with no career names.

## 8. Senior pathway context

Senior matching is partly circular: a learner's CBC pathway decides their subjects, subjects shape their capability scores, and those scores shape their matches. So most matches will sit inside the pathway the learner already chose. This is disclosed rather than corrected:

- Each Senior match is tagged **within pathway** or **cross pathway**, using the pathway the corpus files the career under.
- The strongest **cross-pathway** match that reaches at least the Stretch tier is shown separately as an "outside your pathway" insight.
- Every Senior result carries one line explaining that matches reflect subject choices, "not which careers would suit you best". A within-pathway match is never described as the better career.
- If the learner's pathway is not on record, nothing is tagged and the note says so. **As of October 2026, 410 of 413 Senior learners have no pathway recorded**, so most Senior results currently carry that note.

## 9. Cohort-relative view (context, not scoring)

Raw CBC levels mix a learner's ability with the quality of their school. Alongside the absolute profile, the system can show where a learner stands among peers in the **same school and grade**:

- **Method:** for each dimension, a mid-rank percentile, `100 × (peers below + ½ × (peers tied + 1)) ÷ n`, computed from peers' most recently saved capability profiles. Peers with no evidence for a dimension are left out of that dimension, and so is resilience for anyone with fewer than two assessments (it is a fixed placeholder at that point, not a measurement).
- **Minimum cohort:** 15 learners with evidence, applied to the whole cohort and to each dimension. Below that, no percentile is shown, only a reason. A learner with no evidence for a dimension gets no percentile for it.
- **It never affects matching.** The career score uses only the learner's own evidence; a test checks that adding the cohort view leaves every match score unchanged.
- "School" means the school record a learner is enrolled under. Learners not linked to a school record get no cohort view, and the reason is given.

A separate read-only report (`scripts/career-tier-distribution.ts`) counts, per school, how many learners' best match is Strong, Stretch or Alternative. It exists to check whether learners at some schools are systematically pushed toward "Alternative Path". It reports counts only, flags schools with fewer than 15 learners, and is not an input to any learner's results.

## 10. Career knowledge: freshness and provenance

Each career's facts (salary bands, demand, AI impact) carry **when** they were last confirmed and **who** confirmed them.

**Who** (`verification_source`):

| Value | Meaning |
|---|---|
| `human` | Hand-curated by a person, or re-verified by a named reviewer with a note saying what was checked |
| `source_cited` | Drafted with AI, then reviewed and published by a person through the review gate |
| `ai_drafted` | Generated and not yet reviewed; never presented as verified. Unreviewed drafts are held in a review queue that the matcher does not read |
| not recorded | Origin unknown; treated as unverified until a person checks it |

**When** applies only to `human` and `source_cited`: within 120 days the figures are stated plainly; within 300 days they are shown with their confirmation date and a reminder that markets move; after 300 days they are labelled out of date and phrased in the past tense. `source_cited` labels always begin "Drafted with AI and reviewed by a person." `ai_drafted` and unrecorded facts are **never** labelled fresh, whatever their date.

AI may draft a career and request review. It cannot verify itself: only a person can publish a draft or confirm existing facts, and automated tests check this boundary.

**Current corpus (October 2026):** 43 careers. 18 are `human` (the curated seed corpus); **25 have no recorded provenance** and are listed for human review in ADR-0033; none are `source_cited` yet.

## 11. How correctness is checked

Deterministic test suites run on every change, with no database and no network:
- synthetic learners run end to end through the real scoring and matching code against the curated career corpus (consistently strong, recovering, bad first result, single assessment, missing subjects, accelerating, Junior, no evidence);
- score bounds (never above 100%), exclusion of unmeasured dimensions, resilience behaviour, provenance labels, pathway tagging, and cohort percentiles;
- architecture checks that AI paths cannot mark career facts as verified, and that the scoring code never reads the cohort view.

Passing tests show the system does what this document says. **They do not show that what it says is right about careers** (§12).

## 12. Known limitations

- **Weights are expert judgement, not validated.** The subject-to-dimension weights, career requirements, tier cut-offs and resilience credits were set by judgement and have not been tested against what learners go on to study or do.
- **Measurement uncertainty.** CBC levels are coarse (four bands), assessments differ in quality between teachers and schools, and a learner's profile rests on whatever has been assessed so far.
- **School-quality confound.** Absolute levels partly reflect the school. The cohort view adds context but does not correct the career score.
- **Senior circularity.** Matches largely reflect the subjects a pathway requires (§8), and most Senior learners have no pathway recorded.
- **Ceiling saturation.** A learner at or near the top of every subject reaches 100% on many careers at once. The order among those tied careers follows the corpus order and carries no meaning.
- **Entrepreneurial tier can be very common.** In a deterministic set of 20 varied synthetic Senior learners, 17 (85%) qualified, both before and after the October 2026 changes, because "any one of three dimensions at ≥ 0.50" is a low bar. Among real learners with saved profiles in October 2026 the rate was 10% (34 of 328), largely because most real learners so far have a single assessment, and the tier needs at least two. As assessment histories grow, the real rate is expected to rise toward the synthetic figure. The rule has not been changed; it is flagged for review.
- **The coverage floor rarely fires.** No curated career relies on a single dimension for more than half its weight (the highest creative share is 40%), so a learner missing all creative subjects gets no false creative weakness, but also no Low-confidence flag on creative-leaning careers.
- **Flat low performance reads "developing".** The neutral starting value (0.35) sits inside the developing band, so a learner flat at CBC 1.5 reads "developing" rather than "emerging".
- **Incomplete evidence.** Dimensions whose subjects a school does not assess stay unmeasured for every learner there.
- **Subject names.** Schools spell subjects differently ("Pre-Technical Studies", "pre_technical_studies"). Spelling is normalised before scoring. Until 6 October 2026 it was not, and subjects written with spaces, "&" or hyphens were silently left out of capability scores. Agriculture & Nutrition does not currently contribute to any capability dimension.
- **Curriculum differences.** CBC and 8-4-4 subjects are mapped onto the same dimensions, and some (e.g. History & Government vs History & Citizenship) are treated as equivalent.
- **Career-market volatility.** Salaries and demand change quickly (Kenyan tech salaries moved 15–20% a year in the corpus's own notes). Freshness labels disclose age; they do not update the facts.
- **AI-drafted and unrecorded career facts.** 25 of 43 careers have no recorded provenance until reviewed. Their facts are shown as unverified, but they still appear.
- **Small samples.** Cohort percentiles are withheld below 15 learners. The tier report flags small schools but still shows them.
- **Single-assessment profiles dominate real data.** As of October 2026 most learners with a saved profile have one assessment, so their matches are capped at 65% (never "Strong Match") and labelled Low confidence. The tier report shows this clearly: at one pilot school, 68% of learners' best match is "Alternative Path" and none reach "Strong Match". That reflects one low-scoring assessment per learner; it is not a settled judgement about those learners.
