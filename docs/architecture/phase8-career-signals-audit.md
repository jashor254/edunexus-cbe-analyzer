# Phase 8 — Career Signals / World of Work Intelligence: Audit & Architecture Design

**Type:** Audit + product semantics + architecture design only. No code, no migrations, no ingestion.
**Branch:** `main` · **HEAD at start:** `8a0ca5ddf8854c533aa7b8e82edce71c85eac995`
**Working tree at start:** dirty with unrelated in-progress work across ~50+ files (assignment eligibility, career test files, blueprint views, teacher classes, etc.) — untouched by this phase, preserved as-is. No files in this dirty set were modified to produce this document; only this new file was added.

---

## 1. Verdict

```
PHASE 8 COMPLETE WITH NAMED LIMITATIONS
```

The architecture is sound and the existing Career domain is unusually well-boundaried for this to attach cleanly. The limitation is entirely on the *content supply* side: EduNexus has no source-ingestion capability today, no editorial/review workflow, and no Kenyan source inventory. Those are product/operational gaps, not architecture gaps — closing them is the job of the MVP in §35, not a blocker to defining the architecture now.

---

## 2. Career Architecture Today

```
Learner
   │
   ├── recomputeLearnerProjection()  [lib/projection/recompute.ts]
   │        (canonical learner state — evidence, scores, promotions)
   │
   ▼
CANONICAL CAREER ENTRY POINTS  [lib/learnerIntelligence/careerIntelligenceOrchestration.ts]
   ├── resolveFreshCapabilityProfile()
   ├── resolveCurrentCapabilityProfile()
   └── resolveCanonicalCareerMatches()   ← the one function every consumer calls
            │
            ▼
   PURE REASONING (no Supabase/AI imports, enforced by architecture test)
   lib/learnerIntelligence/careerIntelligence.ts
   lib/career/capabilityExtractor.ts        (score history → CapabilityProfile)
   lib/career/capabilityMatchEngine.ts      (CapabilityProfile × Career[] → tiered matches)
   lib/career/growthEngine.ts               (profile deltas)
   lib/career/lifeSimulator.ts              (deterministic income projection)
   lib/career/provisionalPreview.ts

   ORCHESTRATION / DB / AI (career-specific, Supabase via repos.careers only)
   lib/career/careerEngine.ts               (career CRUD, interests, capability persistence)
   lib/career/careerIntelligenceEngine.ts   (13-section report, 1 DeepSeek call)
   lib/career/clinicReportBuilder.ts        (Clinic Report assembly)
   lib/career/clinicPdfRenderer.tsx         (PDF rendering)
   lib/career/autoReportGenerator.ts        (batch teacher-triggered reports)
   lib/career/parentIntelligence.ts         (Phase 6 parent-facing translation)
   lib/career/knowledgeLifecycle.ts         (career-data freshness classification)
   lib/career/knowledgeRequests.ts          (unknown-career → AI draft → human review queue)
            │
            ▼
   ROUTES (app/api/career/**, app/api/learner-intelligence/career/**,
            app/api/parent/career-intelligence/**)
            │
            ▼
   COMPONENTS (components/teacher/CareerIntelligence.tsx,
               components/parent/ParentBlueprintView.tsx → CareerSection)
```

**Reused mental model from the mission brief, filled in with what's real:**

```
Learner
   ↓
Career Intelligence
   ├── learner context        → CapabilityProfile (6 dimensions, from Projection + legacy assessments)
   ├── career matching        → computeCapabilityMatches() — deterministic, tiered, no AI
   ├── pathway reasoning       → Career.pathway (STEM/Social Sciences/Arts&Sports), Junior=family-only / Senior=specific
   ├── career descriptions     → Career rows in `careers` table, hand-authored seed corpus (seedCareers.ts)
   ├── education journey       → early_start, university_courses, kcse_minimum, cost_to_qualify fields on Career
   └── career interpretation   → careerIntelligenceEngine.ts (13-section report, narrative + deterministic)
```

**Where Career Signals attaches without touching canonical learner truth:** at the *interpretation* layer only — i.e. it is a new sibling input alongside `CapabilityProfile`/`CapabilityCareerMatch` that `careerIntelligenceEngine.ts` (and eventually career detail pages) can read, keyed by `Career.slug` / `Career.category` / `Career.pathway`. It never enters `capabilityExtractor.ts`, `capabilityMatchEngine.ts`, `careerEngine.ts`'s capability persistence, or `lib/projection/**`.

**One existing wrinkle worth naming (not something Phase 8 should fix):** `careerEngine.ts`'s `recomputeAndSaveCapabilityProfile()` blends Projection with a direct legacy `assessments` table read, by explicit documented design (Academic Clinic intake doesn't yet emit Evidence Domain rows). This is a pre-existing, intentional exception to the Projection-only rule — Career Signals must not use it as precedent for its own boundary-crossing.

---

## 3. Recommended Signal Definition

> A **Career Signal** is a verified, provenance-backed statement about a change in how work is performed, what skills or specialisations are emerging, or how industries/education routes are connecting — supported by corroborating evidence proportional to its claim strength, scoped to a geography, and mapped to specific careers/industries/subjects in EduNexus's existing taxonomy.

A Career Signal is **not** an article. It is the *output* of evaluating one or more articles/sources against that definition. One signal may cite several sources; several sources rarely produce more than one signal (see §36 duplicate handling).

---

## 4. Explicit Exclusions

Not a Career Signal:

- Single-company events with no structural implication (layoffs, one hire, a product launch)
- Salary rankings, "top N careers" listicles
- Unsupported predictions ("AI will replace 80% of X")
- Get-rich-quick / motivational content
- Celebrity career narratives
- Viral social-media claims without institutional/reporting corroboration
- Marketing copy from an employer, university, or training provider presented as if editorial (see §29)
- Anything where the only source is Tier 4 (see §10) and the claim is structural/occupational rather than a factual announcement

**Isolated event vs. structural trend** — the deciding question: *does removing any single source still leave the claim standing?* One solar company hiring 40 engineers is a single load-bearing source — remove it, claim collapses → not a signal. Multiple national investments + new training programmes + independent reporting is redundant/corroborated — remove any one source, claim still stands → potential signal.

---

## 5. Signal Categories

The mission brief's ten-category list is sufficient; consolidate to nine by merging the two lowest-differentiation pairs, since EduNexus's mapping target (careers/industries/skills/pathways) can't distinguish "infrastructure shift" from "technology shift" in a way that changes downstream behavior:

```
EMERGING_SPECIALISATION       (a career splits into a new named specialisation)
TECHNOLOGY_SHIFT              (a tool/technology changes how tasks are done — includes infra/investment-driven tech adoption)
SKILL_SHIFT                   (an existing career now expects a new skill, without a new title)
INDUSTRY_CONVERGENCE          (two previously separate industries now overlap in one role)
NEW_WORK_PRACTICE             (a way of working changes — remote inspection, telehealth, etc.)
EDUCATION_ROUTE_CHANGE        (new degree/TVET/certification/apprenticeship route)
PROFESSIONAL_STANDARD_CHANGE  (a regulator/professional body changes requirements)
REGIONAL_OPPORTUNITY          (Kenya/EA-specific demand or investment pattern)
SCIENTIFIC_TECHNICAL_DEVELOPMENT (a research/technical development with occupational implications, upstream of the others)
```

Each signal has exactly one primary category; a secondary category is allowed but the primary drives UI framing (§21).

---

## 6. Existing Career Graph Readiness

The audit confirms EduNexus already has enough *relational* structure — a graph database is unnecessary (per §16 constraint). Specifically:

| Graph edge needed | Already exists as |
|---|---|
| career ↔ subject | `Career.required_subjects: string[]`, `Career.subject_importance` |
| career ↔ pathway | `Career.pathway: 'STEM'\|'Social Sciences'\|'Arts & Sports Science'` |
| career ↔ capability dimension | `Career.required_capabilities: CareerCapabilityRequirements` |
| career ↔ category/"industry" | `Career.category: CareerCategory` (10-value fixed union — the closest thing to an industry taxonomy) |
| career ↔ related careers | `Career.alternative_career_slugs`, `Career.complementary_career_slugs` |
| career ↔ knowledge-graph subject chains | `lib/knowledgeGraph/careerReadiness.ts`'s `CAPABILITY_SUBJECT_MAP` |

**Gap:** there is no `Industry`/`Sector`/`Skill`/`Technology` as a first-class entity — only `CareerCategory` (a closed string enum) and free-text fields (`future_skills: string[]`, `kenya_market_outlook: string`). This is sufficient for Phase 8's proposed data model (§13), which maps signals to *existing* identifiers (`career_slug`, `CareerCategory`, `pathway`, and free-text skill/technology tags) rather than inventing new entity tables. If signal volume later demands querying "all signals affecting Skill X" as a first-class filter, a lightweight `skills` lookup table might be justified — not now, and not without evidence of that query pattern actually being needed.

---

## 7. Source Authority Model

Four tiers, as proposed in the brief, mapped to Kenyan/EA/global realities:

- **Tier 1 — Primary/institutional:** Kenya National Bureau of Statistics, KICD, Ministry of Education, TVETA, professional regulators (EBK, KMPDC, etc.), public universities' official programme announcements, KEPSA, AU/UN agency reports, peer-reviewed research.
- **Tier 2 — High-quality reporting:** Business Daily, The Standard/Nation business desks, Africa-focused specialist outlets (e.g. TechCabal, Disrupt Africa) with named bylines and editorial standards, Reuters/AP/BBC Africa business coverage.
- **Tier 3 — Industry evidence:** employer/association reports (KAM, KEPSA sector reports), technology-company research (self-interested — usable as corroboration, never as sole source for a structural claim).
- **Tier 4 — Discovery only:** LinkedIn posts, blogs, forums, individual commentary. May surface a *candidate* for investigation; can never alone support a PUBLISHED signal (§35 architecture guard).

---

## 8. Corroboration Model

- **Tier 1 alone is sufficient** when the claim is a factual institutional announcement the source has authority over (a regulator changing a requirement, a university announcing a degree, KNBS publishing a statistic). The source *is* the fact.
- **Multiple independent sources required** when the claim is interpretive/structural ("robotics is transforming agriculture") — minimum two independent-publisher sources, at least one Tier 1 or Tier 2, before status can move past CANDIDATE (§9).
- **Tier 3/4 alone never suffices** to reach PUBLISHED, regardless of count (ten blog posts don't corroborate each other if they're all citing the same one press release).

---

## 9. Geography Model

Four-value enum: `KENYA | EAST_AFRICA | AFRICA | GLOBAL`.

- A signal's geography is the *narrowest* scope its evidence actually supports — not an assumption. A global technology signal ("agricultural robotics adoption is accelerating") does not become a Kenya signal because Kenya has farms; it stays `GLOBAL` unless a Kenya-specific source demonstrates it here.
- **Presentation rule:** every card visibly states its geography. A `GLOBAL` signal explaining a Kenyan learner's world is legitimate and valuable — but must never be silently presented in a way that implies the development already exists locally, especially in category §11's examples. Suggested framing: "Elsewhere in the world, X is happening. Here's why that matters even before it reaches Kenya." vs. a `KENYA` signal: "In Kenya, X is happening right now."
- Multiple geography-scoped signals about the same underlying development are allowed to coexist (a `GLOBAL` scientific development and a `KENYA` early-adoption signal citing local sources) rather than forcing one into the other's scope.

---

## 10. Freshness Model

Reject the flat `published < 7 days` rule. Fields:

```
observed_at        — when the underlying development happened/was reported
published_at        — when EduNexus first showed it to learners
verified_at         — when corroboration was last confirmed sufficient
last_reviewed_at     — when a human/process last re-checked it's still accurate
valid_until          — optional, category-dependent estimate; absence is not an error
```

`valid_until` is derived per category, not globally fixed:

| Category | Typical useful lifetime |
|---|---|
| EDUCATION_ROUTE_CHANGE | years (a degree programme persists) |
| PROFESSIONAL_STANDARD_CHANGE | years (until superseded) |
| EMERGING_SPECIALISATION | 1–2 years, then either matures into Career knowledge (§39) or archives |
| TECHNOLOGY_SHIFT / SCIENTIFIC_TECHNICAL_DEVELOPMENT | months–years |
| REGIONAL_OPPORTUNITY | months (investment cycles move) |
| NEW_WORK_PRACTICE / SKILL_SHIFT | months–years, re-check periodically |

`last_reviewed_at` drives a scheduled staleness sweep (§38), not `published_at`.

---

## 11. Confidence Model

Three levels, evidence-strength-based, never a fabricated percentage:

```
EARLY       — single Tier 1 source, or 2+ Tier 2/3 sources, not yet independently re-confirmed
EMERGING    — 2+ independent sources including at least one Tier 1/2, consistent claim over time
ESTABLISHED — sustained multi-source evidence over months, no credible contradiction found
```

Confidence is displayed as a word ("Early signal" / "Well-established") never a number. It describes *how sure we are this is really happening*, not *how sure we are it will matter to you* — those are different questions and conflating them is exactly the "87% chance robotics will dominate agriculture" failure mode the brief calls out.

---

## 12. Proposed Signal Lifecycle

All six brief-proposed stages are necessary — collapsing any two loses a real distinction:

```
DISCOVERED   — a candidate development surfaced (any tier, any source)
CANDIDATE    — passes the signal definition test (§3), pending corroboration
VERIFIED     — corroboration model (§8) satisfied for its claim type
PUBLISHED    — human-reviewed (per §23 policy) and visible to learners
UPDATED      — new evidence strengthens/revises a published signal (§36)
STALE/ARCHIVED — past valid_until or last_reviewed_at threshold with no renewal; removed from learner-facing surfaces, retained for audit/history
```

DISCOVERED and CANDIDATE are distinct because "someone flagged this" (could be Tier 4) and "this could plausibly become a signal" (passed the exclusion filter in §4) are different gates — collapsing them would let raw discovery noise straight into the corroboration pipeline.

---

## 13. Proposed Data Model (design only — no migration)

```ts
type CareerSignal = {
  id: string
  slug: string
  title: string                    // learner-facing, age-appropriate (see §21)
  summary: string                  // 2-3 sentences, plain language
  signalType: SignalCategory       // §5, primary category
  secondaryType?: SignalCategory
  geography: 'KENYA' | 'EAST_AFRICA' | 'AFRICA' | 'GLOBAL'

  observedAt: string
  publishedAt: string | null
  verifiedAt: string | null
  lastReviewedAt: string
  validUntil: string | null

  confidence: 'EARLY' | 'EMERGING' | 'ESTABLISHED'
  status: 'discovered' | 'candidate' | 'verified' | 'published' | 'updated' | 'archived'

  relatedCareerSlugs: string[]         // FK-by-slug into `careers.slug`
  relatedCategories: CareerCategory[]  // reuse existing enum, §6
  relatedPathways: CareerPathway[]     // reuse existing enum
  relatedSkills: string[]              // free text, matches Career.future_skills vocabulary where possible

  learnerExplanation: string   // "Why it matters" — the only AI-touchable learner-facing field, see §34
  sources: CareerSignalSource[]

  createdAt: string
  updatedAt: string
}
```

Deliberately reuses `CareerCategory` and `CareerPathway` from `lib/career/types.ts` rather than inventing parallel enums — one taxonomy, not two.

---

## 14. Source Model (design only)

```ts
type CareerSignalSource = {
  signalId: string
  url: string
  publisher: string
  sourceType: 'tier1' | 'tier2' | 'tier3' | 'tier4'
  publishedAt: string
  claim: string            // the specific extracted claim this source supports, not the whole article
}
```

**Normalize, don't embed.** A source often supports multiple signals over time (e.g. one KNBS report seeding both a REGIONAL_OPPORTUNITY and a SKILL_SHIFT signal) — a normalized `signal_id → source` join, not an embedded array baked at publish time, keeps re-corroboration and dedup (§36) tractable. (This is a modeling recommendation for when persistence is built, not a decision to build it now.)

---

## 15. Career Mapping Model

Signals map to existing identifiers only — no new mapping tables required at MVP scale:

```
CareerSignal.relatedCareerSlugs   → careers.slug (existing)
CareerSignal.relatedCategories    → CareerCategory (existing enum, doubles as "industry")
CareerSignal.relatedPathways      → CareerPathway (existing enum)
CareerSignal.relatedSkills        → free text, informally aligned to Career.future_skills
```

No keyword-matching auto-mapper is being built in this phase — mapping is either human-curated (MVP, §35) or LLM-*suggested-then-human-confirmed* (§34). Given `careers` currently numbers in the low hundreds (hand-authored seed corpus), a human choosing 2-6 related career slugs per signal is a tractable curation step, not a scaling problem yet.

---

## 16. Zig-Zag Career Reinforcement

`Career.alternative_career_slugs` and `Career.complementary_career_slugs` already exist and already express non-linear adjacency. A signal doesn't need a new "career journey" concept — it can simply list a `relatedCareerSlugs` array spanning careers that aren't in the same category (e.g. a robotics signal citing both `mechanical-engineer` and `agricultural-technician`), and the existing UI can render that as "this connects careers you might not have linked before." No new journey-generation logic needed for Phase 8.

---

## 17. Skill Signals — the critical distinction

```
NEW CAREER              → a genuinely new title exists, evidence supports occupational distinctness
NEW SPECIALISATION       → an existing career splits (EMERGING_SPECIALISATION category)
NEW SKILL EXPECTATION    → an existing career's Career.future_skills should gain an entry, no new title
NEW TOOL                 → a specific technology within an existing skill (too granular to be its own signal unless it drives one of the above)
CHANGING WORK PRACTICE   → NEW_WORK_PRACTICE category, no title/skill change, just how work happens
```

The guard: a signal's `signalType` of `SKILL_SHIFT` must never carry a "new career" framing in `learnerExplanation` — this is a content-review checklist item (§23), not something enforceable purely in the data model, since the failure mode is in prose, not structure.

---

## 18. Career Extinction / Decline Framing

No `decline` or `extinction` signal type exists in §5 by design. A structural-decline claim, if credible, is authored as a `SKILL_SHIFT` or `NEW_WORK_PRACTICE` signal whose `learnerExplanation` is required (content-review checklist) to include: what tasks are changing, what skills remain/become valuable, adjacent opportunities. There is no data field for "this career is dying" because the product should never say that regardless of evidence quality — it reframes as adaptation, structurally, not just by writer's choice.

---

## 19. AI / Automation Framing

Same mechanism as §18: automation-related signals are `TECHNOLOGY_SHIFT` or `SKILL_SHIFT`, never a new `automation_replaces` category. Content-review checklist (§23) explicitly checks: does the explanation separate "AI changes some tasks" from "AI eliminates the occupation"? A claim of full occupational disappearance is one of the mandatory-human-review triggers (§23) regardless of source tier.

---

## 20. Age-Appropriate Presentation

Card structure (matches the brief's example, made concrete against real fields):

```
[geography badge]  [confidence word, not %]

WHAT'S CHANGING?
{summary — 1-3 short sentences, no jargon}

WHY IT MATTERS
{learnerExplanation — connects to subject/pathway language the learner already sees in Career Intelligence}

EXPLORE
{relatedCareerSlugs rendered as career chips/links, using existing Career title/category}

(expandable) SOURCES
{sources[], publisher + tier label + link — not shown by default}
```

Density target: readable in under 20 seconds by a Grade 7 learner. `summary` and `learnerExplanation` are the only two prose fields shown by default; `sources` is progressive disclosure per §12 of the brief.

---

## 21. "Why This Matters To You" — Personalization Boundary

Allowed inputs to signal *selection/ranking* (never signal *content*):
- careers currently being explored (`student_career_interests`)
- career families under exploration (Junior mode's `CareerFamilyInsight` categories)
- pathway (Senior mode's `Career.pathway`)
- grade band (Junior vs Senior determines whether specific-career or family-level framing is used, mirroring the existing Junior/Senior split in `careerIntelligenceOrchestration.ts`)
- geography (learner's county/region, if already collected elsewhere — not new collection for this phase)

Not allowed: `CapabilityProfile` dimension scores driving *which* signals appear (that would let "your analytical reasoning is strong" imply "so you should see more STEM signals" — too close to the prescriptive framing the brief explicitly bans in §22). `CapabilityProfile` may still appear in `careerIntelligenceEngine.ts`'s narrative *alongside* a signal reference for context, but the signal system itself doesn't read it.

Sentence-level guard: "You've been exploring engineering. Here's a development in agricultural robotics." — allowed. "This is relevant to your strength in mathematical reasoning" — allowed, phrased as observation. "Therefore you should become an engineer" — never generated; this is a hard content-review rule, not a data constraint.

---

## 22. Interest ≠ Trend Boundary

**Confirmed closed.** No mechanism in the proposed data model writes to `student_career_interests`, `students.capability_profile`, `capability_history`, or any Projection-adjacent table. `CareerSignal` is a pure read for the learner-facing UI; nothing in §13's data model has a write path back into learner state. Signal *view* events (§27) are the only learner-signal interaction persisted, and they belong to a signal-engagement analytics scope, never to `student_career_interests`.

---

## 23. Capability Boundary

**Confirmed closed.** `CapabilityProfile`/`CapabilityScore` (lib/career/types.ts) has no field that a Career Signal could populate, and `capabilityExtractor.ts`'s only input is chronological subject-score history — Career Signals are never in that input's shape or provenance. No proposed integration point in this document writes to `capability_history` or `students.capability_profile`.

---

## 24. Career → Compass Boundary

```
CLOSED
```

Nothing in this design references `lib/compass/**`, `student_learning_context.compass_bridge`, or any Compass-consumed field. Career Signals is scoped entirely to Career Intelligence's own surfaces (§26).

---

## 25. Negative / Automation Signals — Recommended Framing

Reaffirming §18/§19 as policy: negative/structural-change signals are permitted and valuable (dishonesty-by-omission is also a risk) but every such signal is a **mandatory human review** case (§23 mission numbering / this doc's §27) and must pass a specific checklist item: does the explanation name adjacent opportunities and changing (not disappearing) skill demand? A signal failing that checklist is rejected at review, not published with a caveat.

---

## 26. Kenyan Relevance

Sector classes worth seeding curation effort into first, based on `CareerCategory`'s existing 10 values and Kenya's documented growth sectors: **agriculture** (digital/precision ag, KICD/Ministry programmes), **technology** (Konza, Silicon Savannah ecosystem), **energy** (renewable/geothermal investment), **health** (digital health, community health workforce), and **creative/media** (Kenya's growing digital creative economy). TVET-route signals deserve disproportionate curation weight relative to their current visibility in `Career.university_courses` (which is university-only today — no TVET field exists on `Career`; a Career Signal citing a new TVET/apprenticeship route is one place this gap becomes visible without requiring an immediate schema change to `Career` itself).

---

## 27. Ingestion Recommendation

**OPTION C — Hybrid, human-anchored**, matching the mission's own MVP steer (§35 of the brief).

| | Trust | Cost | Freshness | Scale | Kenya coverage | Hallucination risk | Ops burden |
|---|---|---|---|---|---|---|---|
| A. Manual | Highest | Low $, high time | Slow | Very low | Curator-dependent | None | High (founder/curator time) |
| B. Automated | Lowest without heavy guardrails | Low time, ongoing $ | Fast | High | Poor (Kenyan sources under-indexed by most feeds/search) | High | Low day-to-day, high setup |
| C. Hybrid | High if review gate enforced | Moderate | Moderate | Moderate | Best of the three — automation finds candidates, human ensures Kenyan relevance | Contained by claim-extraction + review | Moderate, shrinks as tooling matures |

Recommend **starting even narrower than C**: Option A (pure manual curation) for the MVP (§35), because EduNexus today has zero source-ingestion infrastructure and zero editorial review workflow for this content type — building automated discovery before proving five to ten manually-curated signals produce learner value would repeat the platform's own documented pattern (per memory: EILS/EIR frozen as "over-scoped ahead of real usage"). Option C is the target architecture once manual curation proves the format matters.

---

## 28. LLM Role

**Allowed, always with a human gate before publish:**
- candidate classification (does this look like it could be a signal?)
- claim extraction (source text → structured `claim` field)
- comparing multiple sources for overlap/corroboration
- age-appropriate rewriting of an already-verified claim into `summary`/`learnerExplanation`
- suggesting `relatedCareerSlugs`/`relatedCategories` mappings
- duplicate/near-duplicate detection across candidate signals

**Never allowed:**
- deciding VERIFIED/PUBLISHED status from one article
- inventing a trend not traceable to a real source
- predicting occupational extinction
- publishing without a human-visible provenance trail
- writing to `CapabilityProfile`, `student_career_interests`, or any Projection-adjacent table
- generating a signal's `summary`/`learnerExplanation` that reaches learners without a human reviewing the underlying sources first

This mirrors the existing `knowledgeRequests.ts` pattern almost exactly (AI drafts a career profile → `career_review_queue` → human publishes/rejects) — Career Signals should reuse that precedent's shape rather than inventing a new review model.

---

## 29. Human Review Model

```
Institutional factual change (Tier 1 sole source, e.g. regulator requirement change)
   → lighter review: confirm source authenticity + mapping accuracy

Multi-source structural trend (EMERGING_SPECIALISATION, TECHNOLOGY_SHIFT, INDUSTRY_CONVERGENCE)
   → full verification review: corroboration check (§8) + framing check (§17/§18)

High-impact negative claim (decline/automation framing)
   → mandatory human review, checklist per §25, no exceptions regardless of tier

Occupation-disappearance claim
   → mandatory human review; per §18, the product-level rule is this framing is never published as-is —
     review's job is to confirm the rewrite reframes it correctly, not to approve the original framing
```

---

## 30. Duplicate / Contradiction Handling

**Duplicate/evolving:** entity resolution happens at CANDIDATE stage before a new signal is created — a curator (or LLM-assisted matcher, §28) checks existing `published`/`candidate` signals with overlapping `relatedCareerSlugs`/`signalType`/geography before creating a new row. A matching existing signal gets new evidence appended (`UPDATED` lifecycle stage, §12) and `confidence`/`lastReviewedAt` re-evaluated, rather than a duplicate card being created. Four articles about the same accounting-AI development become one signal strengthened four times, not four cards.

**Contradiction:** when credible sources disagree, the signal stays at `EARLY`/`EMERGING` confidence (never reaches `ESTABLISHED`) and `learnerExplanation` is required to acknowledge uncertainty explicitly ("experts are still debating how much this will change X") rather than presenting false consensus. This is a content-review rule, enforced at the human-review gate (§29), not something the data model can check automatically.

---

## 31. Mature Signal Behavior

```
ACTIVE → MATURE → STALE → ARCHIVED
```
(`MATURE` sits between the brief's implicit "still good" and "no longer fresh" — a signal whose `validUntil` hasn't passed but whose novelty has faded; still shown, framed less as "just discovered" and more as settled context.)

The interesting pipeline the brief calls out — mature signal feeding back into permanent `Career` content — is a real and valuable idea, but is explicitly **editorial-workflow-only**, never automated: a human periodically reviews `ESTABLISHED`+`MATURE` signals and, if warranted, manually edits the relevant `Career.kenya_market_outlook`, `Career.future_skills`, or `Career.ai_impact` fields (the same fields `knowledgeLifecycle.ts` already tracks freshness for). No code path in this design connects a `CareerSignal` record to a `Career` row write.

---

## 32. UI Placement

Minimum useful insertion points, ranked:

1. **Career detail page** (`app/api/career/[slug]/route.ts` consumer, wherever that renders) — "What's changing in this field?" section showing signals where `relatedCareerSlugs` includes this career's slug. Highest-value placement: learner is already in specific-career context.
2. **Career Intelligence home / report** (`careerIntelligenceEngine.ts`'s 13-section report, or the family-insight view in `components/teacher/CareerIntelligence.tsx`'s learner-facing counterpart) — a "World of Work Now" section surfacing 2-4 signals relevant to the learner's explored families/pathway, per §21's personalization boundary.
3. **Career family page (Junior mode)** — "Recent developments" for a `CareerFamilyInsight`'s category, satisfying Junior mode's family-level (not specific-career) framing.

Not recommended for Phase 8: a dedicated standalone "Career Signals" page — that risks becoming the "second learner-intelligence authority" the mission explicitly bans; signals should always appear *inside* existing Career Intelligence surfaces, never as a separate destination.

---

## 33. Learner Home Boundary

Confirmed: no insertion point in this design touches `app/student/page.tsx` (`app/api/student/home/route.ts`'s consumer) or any of "Your Next Step / Needs Attention / Assignments." Career Signals remains reachable only by a learner actively entering Career Intelligence — secondary and exploratory, consistent with the existing Phase 7 Home hierarchy referenced in the mission brief.

---

## 34. Low-Connectivity Strategy

`CareerSignal` (§13) is entirely structured text plus optional `sources[].url` links — no embedded media, no live-fetch-on-render requirement. Recommended runtime shape: signals are read from wherever they're persisted (a normal Supabase table once built) exactly like `careers` rows are today — a normal DB read, not a live external call per learner page view. This satisfies §44/§45 of the brief by construction: the *reading* path is cheap and offline-friendly by default; only the *ingestion* path (out of learner request scope entirely) would ever touch the live web. Source links are opt-in (progressive disclosure, §20) so a learner on a constrained connection never has to load an external page to see the card itself.

---

## 35. Threat Model

| Threat | Containment |
|---|---|
| Bad/SEO-spam source | Source tiering (§7) — Tier 4 alone can never reach PUBLISHED |
| Company marketing disguised as editorial | §29 sponsored-vs-editorial distinction; a source that is the subject's own employer/vendor is flagged at intake, never sole-sources a signal |
| LLM hallucination | §28 — LLM never decides truth or publishes directly; claim extraction is checked against the actual source text at human review |
| Duplicate trend | §30 entity resolution at CANDIDATE stage |
| Stale information | §10 freshness model + §38-equivalent lifecycle sweep to STALE/ARCHIVED |
| Fake future prediction | §4 exclusion — unsupported predictions are excluded at the definition level, not just flagged |
| Political/economic propaganda | Source tiering + geography scoping; a claim sourced only from a state actor with no independent corroboration stays capped at EARLY confidence |
| Commercial manipulation | §29 sponsored-content boundary — no silent path from paid content into signal evidence |
| Malicious source content | Human review reads actual source text before publish; no auto-publish path exists anywhere in this design |
| Source disappearance | `sources[].url` may 404 over time; doesn't retroactively invalidate a PUBLISHED signal (the claim was verified at the time), but is a `last_reviewed_at` sweep check — a signal whose sources have all vanished is a candidate for re-verification or archival |

---

## 36. Sample Signals (illustrative only, not persisted, not real-time-verified — for architecture testing)

1. **Precision agriculture / drones** (TECHNOLOGY_SHIFT, KENYA) — Evidence: Ministry of Agriculture digital-ag programme announcement (Tier 1) + Business Daily coverage of drone-survey pilot in Rift Valley (Tier 2). Claim: "Kenyan agriculture increasingly uses drone/satellite data for crop monitoring." Related: `agricultural-engineer`, `agronomist`, `gis-specialist`, `data-analyst`. Confidence: EMERGING.
2. **AI-assisted medical imaging** (TECHNOLOGY_SHIFT, GLOBAL) — Evidence: peer-reviewed radiology journal + WHO digital health report. Claim: "AI tools increasingly assist (not replace) radiologists in image review." Related: `medical-doctor`, `radiographer`, `health-data-analyst`. Confidence: ESTABLISHED. Framing check (§19): explicitly "assist, not replace."
3. **Renewable energy storage expansion** (REGIONAL_OPPORTUNITY, KENYA) — Evidence: KenGen/Ministry of Energy investment announcement (Tier 1) + KEPSA sector report (Tier 3, corroborating). Claim: "Battery storage investment is expanding alongside geothermal/wind capacity." Related: `electrical-engineer`, industry `energy`. Confidence: EMERGING.
4. **Satellite/geospatial agriculture** (INDUSTRY_CONVERGENCE, AFRICA) — Evidence: AU digital agriculture strategy (Tier 1) + two independent East African agritech reports (Tier 2/3). Claim: "Agriculture and GIS/data roles are converging across the region." Related: `agronomist`, `gis-specialist`, `data-analyst`; categories `agriculture`+`technology`. Confidence: EMERGING.
5. **Digital manufacturing / design software** (SKILL_SHIFT, GLOBAL) — Evidence: two international manufacturing-industry skill surveys (Tier 3, independent publishers). Claim: "Mechanical engineering roles increasingly expect CAD/simulation software fluency." Related: `mechanical-engineer`; no new career created — explicitly a skill-shift, not a new title (§17 guard applied). Confidence: EARLY (Tier 3 only, no Tier 1/2 yet).
6. **New TVET data-science certificate route** (EDUCATION_ROUTE_CHANGE, KENYA) — Evidence: a Kenyan polytechnic's official programme announcement (Tier 1, sole-source-sufficient per §8). Claim: "A new TVET-level data analytics certification launched." Related: `data-analyst`; explicitly not scored against labour-market trend claims — pure factual announcement. Confidence: EARLY→can reach ESTABLISHED quickly since it's a factual, not interpretive, claim.
7. **Automation of routine bookkeeping tasks** (SKILL_SHIFT, GLOBAL — the brief's own worked example) — Evidence: multiple accounting-industry surveys + academic study on task-level automation (Tier 2/3, several independent). Claim: framed per §18 as "some bookkeeping tasks are increasingly automated; skills in interpretation, advisory, and audit judgment are becoming more valuable." Related: `accountant`. Mandatory human review (§29) applied due to automation framing; passed only after checklist confirmed adjacent-opportunity language present.
8. **Creative economy / digital content careers** (NEW_WORK_PRACTICE, KENYA) — Evidence: Kenya Film Commission report (Tier 1) + creative-economy sector analysis (Tier 3). Claim: "Independent digital content creation is becoming a viable full/part-time work practice." Related: category `creative`+`media`. Confidence: EMERGING.
9. **Community health workforce digitization** (NEW_WORK_PRACTICE, KENYA) — Evidence: Ministry of Health digital health programme (Tier 1). Claim: "Community health volunteers increasingly use mobile data tools." Related: `community-health-worker` (if such a career slug exists in the seed corpus — else flagged as a mapping gap during curation, not blocking publish of a valid signal). Confidence: EMERGING.
10. **Contradictory-evidence example** (SCIENTIFIC_TECHNICAL_DEVELOPMENT, GLOBAL) — two credible sources disagree on the pace of a battery-technology breakthrough's commercial impact. Per §30: signal stays EARLY/EMERGING, `learnerExplanation` explicitly notes "experts disagree on how quickly this will affect jobs" rather than picking a side.

Each of these exercises a different part of the model: single-vs-multi-source (§8), Kenya/regional/global scoping (§9), skill-vs-career distinction (§17), mandatory-review triggering (§29), and contradiction handling (§30) — the model holds for all ten without needing a special case.

---

## 37. Architecture Guards

All seven from the brief, confirmed appropriate to formally adopt (as future lint/architecture-test targets when implementation begins, matching the existing pattern of `capabilityExtractorPurity.architecture.test.ts` / `careerIntelligencePurity.architecture.test.ts`):

- **Guard A:** Career Signals code never imports/calls `recomputeLearnerProjection` or anything under `lib/projection/**` with write intent — it is a read-nothing, write-nothing relationship to Projection.
- **Guard B:** No Career Signals function may call any capability-persistence path (`saveCapabilityProfile`, `recomputeAndSaveCapabilityProfile`, `repos.careers.updateStudentCapabilityProfile`).
- **Guard C:** No Career Signals function may write `student_career_interests`.
- **Guard D:** No Career Signals function may touch any pathway-affinity field (none currently exists as a persisted value, but the guard holds if one is added later).
- **Guard E:** No Career Signals import may reach `lib/compass/**` or `student_learning_context.compass_bridge`.
- **Guard F:** Every `status: 'published'` `CareerSignal` has ≥1 `CareerSignalSource` row — enforced at the publish-action level, mirrors the existing `knowledgeRequests.ts` review-gate pattern.
- **Guard G:** Learner-facing signal reads always come from persisted, reviewed rows — no code path renders raw LLM/live-web output directly to a learner-facing component.

---

## 38. Database Changes

```
NONE
```
This phase produces no migrations. §13/§14's data model is a design proposal for when implementation is approved, not a schema to apply now.

---

## 39. Files Changed

```
docs/architecture/phase8-career-signals-audit.md   (this file, new)
```
No other files were modified. The dirty working tree from unrelated in-progress work (recorded in §"Branch/HEAD" above) was left untouched.

---

## 40. Tests / Validation

No automated tests were written (nothing was implemented). Validation performed:
- Full read-only audit of `app/api/career/**`, `app/api/learner-intelligence/career/**`, `app/api/parent/career-intelligence/**`, `lib/career/**`, `lib/learnerIntelligence/careerIntelligenceOrchestration.ts`, `lib/curriculum/**`, `lib/knowledgeGraph/careerReadiness.ts`, and relevant components — confirmed via direct reading of source, not inference.
- Confirmed via grep that no "signal"/"trend"/"news"/"world of work" data concept currently exists (§9 of the audit findings above; only cosmetic icon imports and one static UI string matched).
- Confirmed the Projection/canonical-state boundary Career Intelligence already respects (§8 of the audit), including the one documented pre-existing exception (`assessments` table blend in `careerEngine.ts`), which this design does not rely on or extend.
- The ten sample signals (§36) were checked by hand against every stated model rule (tier sufficiency, geography scoping, skill-vs-career framing, mandatory review triggers, contradiction handling) to confirm the model doesn't need a special case for any of them.

---

## 41. MVP Recommendation

**Curated Career Signals MVP**, matching the brief's own suggested slice:

```
admin-curated signal (human writes it, using this doc's data model as the mental template)
      ↓
structured provenance (sources[] filled in manually, even before a `career_signal_sources` table exists —
      could start as a JSON field or even a doc, see below)
      ↓
career mapping (relatedCareerSlugs chosen by the curator against existing `careers.slug`)
      ↓
Career Intelligence (surfaced at UI placement #1 from §32 — career detail page only, single insertion point)
      ↓
"What's changing in this field?"
```

**Smallest possible first step, even smaller than a new table:** write 3-5 real (not hypothetical) Kenyan/regional career signals by hand, in the shape of §13's type, as a static seed file analogous to `lib/career/seedCareers.ts` — no ingestion, no review workflow, no automation — and surface them on 3-5 career detail pages behind the existing knowledge/review conventions already established by `knowledgeLifecycle.ts`. This proves the UI placement and learner reaction *before* any persistence/ingestion/automation investment, consistent with the platform's own "Start Simple, Grow Later" standing practice and its history of freezing over-scoped intelligence features (EILS/EIR) built ahead of real usage. Only after that validates should a real `career_signals`/`career_signal_sources` migration, curation workflow, and eventually Option C hybrid ingestion (§27) be built.

---

## 42. Final Question

> **Can EduNexus show a Grade 7–9 learner what is genuinely changing in the world of careers without turning news, hype, employer marketing or AI predictions into learner intelligence?**

**YES**, with evidence:

1. The existing Career domain already enforces a hard purity boundary (pure reasoning files with an architecture test banning Supabase/AI imports) that Career Signals can sit alongside without crossing — confirmed by direct inspection, not assumption (§2, §8).
2. Every boundary the mission brief worries about (Projection, capability, interest, pathway affinity, Compass) maps to a concrete, checkable guard (§37) against real file/table names in this codebase, not hypothetical ones.
3. The platform already has a working precedent for exactly this shape of problem — `knowledgeRequests.ts`'s AI-draft → `career_review_queue` → human-publish/reject pipeline for unknown careers — proving EduNexus can let an LLM assist without letting it decide truth.
4. The definition (§3) and exclusions (§4) are strict enough that "Company X lays off 1,000 workers" and "AI will replace 80% of accountants" fail the test by construction, not by a moderator's mood.
5. The MVP (§41) requires zero automation, zero live-web calls at read time, and zero schema changes — the riskiest parts of "internet → LLM summary → learner" are structurally absent from even the first slice.

The named limitation (§1) is real: EduNexus has no source-ingestion or editorial-review *operational* capability yet. That is a resourcing/rollout question, not evidence the architecture can't hold — it holds today, on paper, against every guard the mission specified.
