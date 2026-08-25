# Phase 9 — Open Career Discovery & Canonical Career Knowledge: Super Audit

**Type:** Audit only. No code, no migrations, no APIs, no AI calls added, no Career Signals changes, no corpus expansion.
**Branch:** `main` · **HEAD:** `8a0ca5ddf8854c533aa7b8e82edce71c85eac995`
**Working tree:** dirty with ~178 unrelated in-progress files, preserved untouched.

Every claim below is tagged **PROVEN** (traced to file:line or live schema), **INFERRED** (reasonable but not directly witnessed), or **NOT VERIFIED** (genuine gap in what the repo can answer). Four parallel read-only investigations fed this document; live Postgres schema was inspected via the Supabase MCP tool (read-only `list_tables`), not mutated.

---

## Headline finding before anything else

**PROVEN.** The premise "the corpus is 18 careers" is already wrong today, in two different ways, and both matter for this audit:

1. The live Postgres `careers` table has **43 rows**, not 18 — `lib/career/seedCareers.ts`'s 18 are only the first seed batch; `scripts/seed-cos-batch2.ts` added COS metadata for "the 25 remaining careers." Adding a 44th career to this table is already the platform's normal-case behavior, not a novel edge case.
2. **A second, entirely separate, hardcoded career corpus exists and is live**: `lib/academicClinic/careerEngine.ts:182-185` defines `CAREER_DATABASE`, a 40-entry in-memory TypeScript array (`kenyaShortageScore`, `matchRequirements`, `aiImpact.disruptionRisk` — a different shape than the `Career` DB type entirely), consumed by `CareerEngine.matchCareers()` and wired into `lib/academicClinic/assessmentPipeline.ts` — **the shared pipeline for both the teacher-run and parent-self-service Academic Clinic flows**. This array never reads the `careers` Postgres table. `scripts/career-corpus-audit.ts:9-33` documents this exact split as a known, unresolved problem, quoted verbatim: *"Career knowledge sits in two places that no code keeps in agreement... They were authored independently and cover substantially the same careers under different slugs and titles."* A one-off migration script (`scripts/migrate-academic-careers-to-supabase.ts`, already run) copied 25 of the 40 into Postgres to shrink content divergence, but did **not** repoint `CareerEngine.matchCareers()` at Postgres — the array is still what Academic Clinic iterates.

**Consequence for Phase 9:** "the authoritative source of a career" is not one thing today. Career Explorer/search/Career Signals/capability-matching reads Postgres `careers`. Academic Clinic (teacher + parent) reads a disconnected hardcoded array. Any career discovery design that assumes "canonicalise once, it's now known everywhere" is false on day one — a career discovered and published to Postgres `careers` would still be invisible to Academic Clinic reports until someone manually edits `CAREER_DATABASE`. This is scoped out of Phase 9 (no code changes), but it is the single most consequential fact this audit surfaces, and every downstream section below is written with this split in view.

---

## 1. Career Domain Map (evidence-traced, not filename-inferred)

```
SOURCE OF CAREER TRUTH (two, disconnected)
├── Postgres `careers` table (43 rows)                    [PROVEN: live schema + repository queries]
│     id uuid PK · slug text UNIQUE NOT NULL · title, category, description,
│     ai_impact jsonb, pathway, required_subjects, skill_timeline, future_skills,
│     required_capabilities, kcse_minimum, cost_to_qualify, social_reality,
│     alternative_career_slugs[], complementary_career_slugs[],
│     knowledge_verified_at, knowledge_source_note (added 2026-08-13)
│     Written ONLY via lib/repositories/career.repository.ts (service-role client)
│
└── lib/academicClinic/careerEngine.ts CAREER_DATABASE (40 in-memory entries)
      Different shape entirely; consumed by CareerEngine.matchCareers()
      Called from lib/academicClinic/assessmentPipeline.ts (teacher + parent Clinic flows)

READERS
├── lib/repositories/career.repository.ts        — all Postgres `careers` reads (slug-keyed, see §5)
├── lib/academicClinic/careerEngine.ts            — reads only its own CAREER_DATABASE array
├── lib/career/careerEngine.ts                    — searchCareers/getAllCareers/getCareerBySlugWithCOS
└── lib/learnerIntelligence/careerIntelligenceOrchestration.ts — resolveCanonicalCareerMatches() etc.

TRANSFORMERS
├── lib/career/capabilityExtractor.ts / capabilityMatchEngine.ts  (pure, Postgres-corpus-only)
├── lib/career/careerIntelligenceEngine.ts        (13-section report; 1 DeepSeek/Gemini call)
├── lib/career/clinicReportBuilder.ts             (Junior/Senior Clinic Report; Postgres corpus)
└── lib/academicClinic/assessmentPipeline.ts      (separate Clinic pipeline; CAREER_DATABASE)

LEARNER-FACING SURFACES
├── app/student/career/page.tsx, [slug]/page.tsx  (Explorer + Detail; Postgres-backed, client fetch, NO generateStaticParams)
├── components/blueprint/sections.tsx CareerSection (via orchestration layer — see §29 below)
├── components/parent/ParentBlueprintView.tsx     (same CareerData as above)
├── components/teacher/CareerIntelligence.tsx     (teacher view of family/match insights)
└── Academic Clinic PDF/report surfaces            (CAREER_DATABASE-sourced, separate pipeline)

DEPENDENT INTELLIGENCE DOMAINS
├── Career Signals (Phase 8.1)  — reads Postgres careers.slug only (relatedCareerSlugs), zero DB coupling itself
├── Blueprint     — INDIRECT dependency, deeper than documented (see §29)
├── Compass       — reverse-import CLOSED and architecture-test-guarded; shared-field coupling exists but is dormant (see §30)
├── Pathway (CareerPathway enum, 3 values) — required field on Career, no fabrication fallback found beyond a silent default (see §16)
└── Learner interest (student_career_interests) — soft-coupled to careers via slug + nullable/no-FK-action career_id (see §15)
```

---

## 2/3. The 18(43)-Career Corpus, Hardcoding Audit, and "Data or Code?"

**PROVEN — no `generateStaticParams` anywhere.** Both `app/student/career/page.tsx` and `[slug]/page.tsx` are `'use client'` components that `fetch()` at runtime; a 44th (or 500th) Postgres row renders immediately with **zero deployment/rebuild** required. This is the single most important positive finding of the whole audit: *for the Explorer/Detail surface, careers are already mutable data, not compiled code.*

**Every location where "career #19" would misbehave, proven with evidence:**

| Location | Effect on a new Postgres `careers` row | Evidence |
|---|---|---|
| `app/api/career/search/route.ts` zod schema | WORKS — only `pathway` (3 values) and `ai_impact_level` (4 values) are `z.enum`'d; no career-identity enum | PROVEN |
| `lib/career/careerEngine.ts:23-27` `VALID_CATEGORIES`/`VALID_PATHWAYS` | New career's category/pathway must be one of the existing closed 10/3 values; if AI-generated content produces something else, it **silently coerces** to `'business'`/`'Social Sciences'`, no error | PROVEN |
| `lib/career/capabilityMatchEngine.ts:359` — `career.slug === 'entrepreneur-business'` | WORKS — irrelevant to new careers; only ever special-cases that one slug for the "entrepreneurial" tier | PROVEN |
| `lib/career/careerSignals.ts` `relatedCareerSlugs` (Phase 8.1) | New career gets **no signal** until a human manually adds one — degrades gracefully (section renders nothing), never crashes | PROVEN (confirmed by Phase 8.1's own tests) |
| `scripts/seed-cos-batch2.ts` `alternative_career_slugs`/`complementary_career_slugs` | Free-text arrays, no FK/validation; some entries already reference slugs that don't exist anywhere (e.g. `'diplomat'`, `'ux-ui-designer'`) — **WORKS but dangling**, would render as a broken cross-reference if any UI surfaced these two specific arrays (none currently does, per the codebase searched) | PROVEN |
| **`lib/academicClinic/careerEngine.ts` `CAREER_DATABASE`** | **REQUIRES MANUAL EDIT** — a career added only to Postgres `careers` will **silently never appear** in any Academic Clinic report (teacher or parent), with no error, because `matchCareers()` iterates a closed 40-entry array with zero notion of anything outside it | PROVEN |
| Any test asserting an exact career count | None found | PROVEN absence |

**Answer to "is a career data or code?"** Split verdict, and this split is the actual finding:
- **On the Explorer/Detail/Career-Signals/capability-matching path: data.** A DB insert alone (via the service-role repository, which is how `publishReviewedCareer()` already works) is sufficient — no redeploy, no code edit, no test violation.
- **On the Academic Clinic path: effectively code.** A new career requires a manual TypeScript edit to `CAREER_DATABASE` and a redeploy — the exact "compiled application code" failure mode the mission asked about, just localized to one specific (large, legacy) subsystem rather than the whole domain.

**Practical cost of adding career #44 today, exact workflow (Postgres path only, the "correct" one):** one `upsertCareer()` call (already the mechanism `publishReviewedCareer()` uses) — INSERT + optionally an entry in `careerSignals.ts` and `CAREER_DATABASE` if full-platform parity is wanted, both manual and both optional-not-mandatory for the career to be searchable and viewable.

---

## 4. Search Resolution Audit

**PROVEN.** Search is DB-backed (`lib/repositories/career.repository.ts:82-102`, `searchCareers`): `SELECT ... FROM careers WHERE title ILIKE '%q%' OR description ILIKE '%q%'`, capped at 20 rows. This is **substring match only** — no fuzzy/trigram matching, no full-text search config, no alias/synonym expansion, no search over `category`/`required_subjects`/`alternative_career_slugs`.

Reproducing the mission's example queries against this logic (not executed against a live DB — traced against the matching rule and known corpus, marked **INFERRED** where the exact 43-row title list wasn't enumerated by the agents):

| Query | Expected behavior against ILIKE title/description match |
|---|---|
| "software engineer" | Matches `title = 'Software Engineer'` directly — **WORKS**, exact hit |
| "software developer" | No exact title match (no alias/synonym); likely zero rows unless "developer" appears in some description text — **INFERRED miss**, triggers unknown-career flow |
| "AI engineer" / "machine learning engineer" / "robotics engineer" / "prompt engineer" / "quantum engineer" / "climate risk analyst" / "drone agronomist" / "education technologist" | None of these are seed/batch2 titles; ILIKE substring match against `title`/`description` only — **INFERRED miss** for all, each independently triggers the unknown-career flow |

**Zero-result flow, proven exactly (`app/api/career/search/route.ts:36-53`, `lib/career/knowledgeRequests.ts:57-90`):**
```
zero DB rows + free-text query
   → requestCareerKnowledge(query, userId)
   → resolve by exact slugify(query) lookup → miss
   → resolve by ILIKE title-like lookup → miss
   → generateCareerProfile(query)                    ← LLM call, EVERY TIME, no pre-check
   → callDeepSeek(prompt, sys, {temperature:0.4, maxTokens:3500})
        (misleadingly named — lib/ai/deepseek.ts actually calls Gemini via
         @google/generative-ai; confirmed by import at lib/ai/deepseek.ts:4)
   → enqueueCareerReview({slug, career_name, payload, submitted_by, origin:'learner_search'})
        (dedupes only the DB WRITE — if slug already queued, increments request_count,
         does NOT overwrite payload — but does NOT skip the LLM call itself)
   → route returns { careers: [], provisional: true, preview, requestCount }
        (preview = provisionalPreview.ts's stripped-down shape — no salary/cost/KCSE/capability fields)
```

**Critical proven fact:** *every* repeated identical unknown search re-triggers a full LLM generation call. Deduplication exists only at the `career_review_queue` row level (via a partial unique index on `slug`), never before the AI call. This is a real, already-live cost/abuse surface (relevant to §26).

---

## 5/6. Canonical Identity & Alias Audit

**PROVEN.** `careers.id` (uuid) is the real primary key; `careers.slug` (`text UNIQUE NOT NULL`) is the de facto identity used by essentially every code path: `findCareerBySlug`, `upsertCareer(..., {onConflict:'slug'})`, `markCareerKnowledgeVerified`, `updateCareerBySlug`, all URL routing (`/student/career/[slug]`), Career Signals' `relatedCareerSlugs`, and `saveCareerInterest(careerSlug, ...)` (id is looked up *from* slug, best-effort, can be `null`).

**No alias/synonym mechanism exists anywhere** — confirmed absent by repo-wide grep across `lib/career/**` and every migration. "Software developer," "application developer," and "Software Engineer" are three unrelated strings to the current system; there is no table, column, or code path that would resolve them to one entity.

**Could EduNexus safely merge "software developer"/"software engineer"/"application developer" into one canonical entity today? No — proven, not inferred.** The identity model has no representation for "this string used to mean / also means that career." A rename of `careers.slug` today would: break every `relatedCareerSlugs` reference in `careerSignals.ts` (plain string match, no cascading update), leave `student_career_interests.career_slug` (a denormalized text column with no FK) pointing at a dead string while `career_id` (if it was resolved) still correctly follows the row, and change every learner-facing URL with no redirect mechanism. `student_career_matches.career_id` would survive a slug rename cleanly (real FK to `id`), but not a slug-identity assumption anywhere that keys by slug instead.

---

## 7. Career vs Role vs Skill vs Specialisation

**PROVEN gap.** The `Career` type (`lib/career/types.ts`) has exactly one taxonomic concept: `category: CareerCategory` (10 fixed values — technology, health, agriculture, creative, business, trades, education, environment, media, finance) plus `pathway: CareerPathway` (STEM/Social Sciences/Arts & Sports Science). There is no field distinguishing a standalone occupation from a specialisation-within-a-career, a role, a skill, or an emerging/unstable title. Testing the mission's examples against this schema: "prompt engineer," "AI safety researcher," "data annotator," and "content creator" have no schema slot that would mark them as *provisionally distinct* from "software engineer" or "journalist" — the schema would force every one of them into being either a full standalone `Career` row or nothing at all. This is named as a limitation per the mission's instruction not to invent a taxonomy here.

---

## 8. Duplicate Creation Threat Model

Per-mechanism, proven from the live schema:

| Protection | Level | Evidence |
|---|---|---|
| `careers.slug` global uniqueness | **DATABASE-ENFORCED** | `slug TEXT UNIQUE NOT NULL` + `careers_slug_key` unique index |
| `career_review_queue.slug` uniqueness (pending queue only) | **DATABASE-ENFORCED (partial)** | `career_review_queue_slug_key` unique index `WHERE slug IS NOT NULL` |
| Semantic/spelling/pluralization/capitalization duplicate detection ("AI Engineer" vs "Artificial Intelligence Engineer" vs "AI Developer" vs "ML Engineer") | **NO PROTECTION** | Slug is derived via `slugify(query)` (exact-string-based); each of the six example phrases would `slugify()` to a *different* slug, sail past the unique-slug constraint, and independently trigger `generateCareerProfile()` — six distinct `career_review_queue` rows, six LLM calls |
| Regional-terminology duplicates | **NO PROTECTION** | Same mechanism as above |

**Conclusion: the six-variant example from the mission genuinely could become six separate queue entries (and, if all six were separately reviewed and published, six separate `careers` rows) under the system exactly as it exists today.** This is the concrete, proven form of the "duplicate creation" risk the mission asked about.

---

## 9. Career Knowledge Provenance Audit

Per major field on the existing 43 careers, provenance classified from how the data actually entered the table:

| Field | Provenance |
|---|---|
| description, category, pathway, required_subjects (seed corpus, 18+25) | **MANUALLY CURATED** — hand-authored in `seedCareers.ts`/`seed-cos-batch2.ts` |
| Anything published via `publishReviewedCareer()` | **AI-GENERATED, then human-reviewed** — but the review is a human accept/reject of an LLM free-generation (§21), not verification against any external source, since none was fetched |
| `knowledge_verified_at` / `knowledge_source_note` | **HARDCODED at publish time** — stamped by the publishing action itself, not derived from any actual source citation (no source URL field exists on `careers` at all) |
| `ai_impact`, `kenya_market_outlook`, `salary_range_kes`, future_skills | **MANUALLY CURATED for seed data; AI-GENERATED (unsourced) for anything from the review-queue path** |

**Does provenance survive to the learner?** For seed-corpus careers: no explicit provenance is shown to the learner at all (the field exists in the DB but Career Detail page doesn't render a "how do we know this" section — confirmed absent in the traced page). For review-queue-originated careers: `knowledge_source_note` exists as a column but its content is whatever the human reviewer types, not a structured citation — there is no source-URL/publisher/date model on `careers` at all, unlike the newly-built Career Signals model (§10 below).

---

## 10. Evidence Model Comparison — Reuse Career Signals' provenance shape?

**Recommendation: do not reuse `CareerSignal`'s provenance shape for career *identity/knowledge* verbatim — the two problems are different enough to warrant it staying separate, though the *fields* are worth borrowing.**

`CareerSignal` (Phase 8.1) answers "is this a real, current *change*, worth showing." A future career-knowledge evidence model would need to answer "is this a real *occupation*, and are these specific facts about it (salary, KCSE minimum, subjects) currently true" — a stronger and more granular bar, since a wrong salary figure or wrong subject requirement is actionable misinformation in a way a slightly-stale trend framing isn't. `careers` today has **zero** of `CareerSignal`'s provenance fields (no `source URL`, no `publisher`, no `source tier`, no `retrieved date`, no per-claim structure) — only the two freshness-adjacent columns noted above. Reuse recommendation: **borrow the shape** (source tier, geography, claim-level granularity) as a design pattern, but attach it as a **separate provenance record per career (or per-field, given salary/KCSE-minimum/subjects are independently falsifiable)**, not as an extension of `CareerSignal` itself — `CareerSignal.relatedCareerSlugs` should remain a one-directional pointer *into* career knowledge, never a two-way coupling.

---

## 11. Career Lifecycle Feasibility

**PROVEN: no lifecycle/status concept exists on `careers` at all** — not `status`, not `discovered_at`, not `merged_into`, not `retired`. The only lifecycle-shaped column anywhere in the domain is `career_review_queue.status` (`pending → published | rejected`), which describes the *review workflow*, not the *career's* trust state once published — once a row lands in `careers`, it is permanently and uniformly trusted by every downstream reader (capability matcher, search, Career Signals, Blueprint) with **zero distinction** between a hand-curated seed career and an AI-generated one published five minutes ago by one reviewer. **Every current reader assumes every `careers` row is equally trustworthy** — proven by absence: no code anywhere branches on a trust/lifecycle field, because none exists to branch on.

Two concrete risk confirmations relevant to a future lifecycle design (not proposing one, per mission instruction):
- **Provisional careers cannot accidentally enter recommendations today** — proven safe, because `career_review_queue` is a physically separate table from `careers`, and `resolveCanonicalCareerMatches`/`capabilityMatchEngine` only ever read `careers`. A provisional career literally cannot reach the matcher until a human publishes it. This containment is structural, not a status flag — worth preserving in any future design rather than replacing with a status-flag-only gate.
- **Retired careers could break saved learner interests** — proven by schema: `student_career_matches.career_id` has `ON DELETE CASCADE` (a deleted career silently deletes the student's match rows, no history preserved), while `student_career_interests.career_id` has no declared `ON DELETE` action (defaults to `RESTRICT`/`NO ACTION` — a delete would be *blocked* by Postgres, not silently cascaded) but `career_slug` (the text column, no FK) would survive untouched and become a dangling reference to nothing.

---

## 12/13. Dynamic Persistence Safety & Concurrency

**Threat model against what exists today (learner-triggered generation, not yet learner-triggered *persistence* — that gate doesn't exist yet, see the "Consequence" note below):**

| Threat | Current exposure |
|---|---|
| Spam/nonsense search terms | Each triggers a full LLM call (§4) — no rate limit found on `app/api/career/search/route.ts` beyond whatever global API rate-limiting exists (`lib/ai/rateLimit.ts` — not traced by this audit to confirm it's actually applied to this route) |
| Prompt injection via the search query | **PROVEN unmitigated** — `generateCareerProfile()`'s user prompt directly interpolates the raw trimmed query string into the LLM prompt with no escaping/delimiting (`careerEngine.ts:40`) |
| Hallucinated occupations, fabricated salary/qualifications | **PROVEN structurally likely** — the prompt asks the model to invent salary bands, KCSE minimums, market outlook from training data alone, with zero grounding and zero Zod/schema validation on the response (regex + `JSON.parse` + best-effort field coercion only) |
| Duplicates / semantic variants | **NO PROTECTION**, proven in §8 |
| Malicious URLs, source poisoning, SEO content farms, AI-generated circular sources | **N/A today** — there is no source retrieval at all (§22), so there is nothing to poison; the *risk class* shifts entirely to "the model's own hallucination," not "a bad external source," until source retrieval is ever built |
| Obscene content / extremely long names | **NO PROTECTION found** — no length cap or content filter on the search query before it reaches `generateCareerProfile()` |

**Consequence note, important:** today's flow is "learner searches → LLM generates → queued for human review," and **nothing reaches `careers` (canonical, servable-to-all-learners state) without a human `publishReviewedCareer()` action.** So "dynamic persistence" in the sense the mission worries about — an unknown search silently becoming permanent shared knowledge — **does not exist today; the human gate is real and load-bearing.** The actual live risk is narrower: unbounded LLM spend and unbounded `career_review_queue` growth from spam, not corruption of canonical knowledge (§26 covers the cost/abuse angle in full).

**Concurrency (§13):** Three simultaneous distinct-string searches ("AI agronomist" / synonyms) — proven, each independently misses the slug/title check, each independently calls the LLM, each independently attempts `enqueueCareerReview`. Because `career_review_queue.slug` has a unique partial index, if two of the three happen to `slugify()` to the *identical* slug there's a real DB-level race: two concurrent inserts racing the unique constraint (one wins, one would need an upsert-or-catch — **not verified** whether `enqueueCareerReview`'s implementation is race-safe under concurrent identical-slug writes, since the agents traced the logic but did not test concurrent execution). If the three strings slugify *differently* (the more likely case for "AI agronomist" vs "artificial intelligence agronomist"), **three separate queue rows are created** — the identity/dedup gap from §5/§8 applies at the concurrency layer too, not just sequentially.

---

## 14/15. Learner Identity Boundary & Interest Boundary

**This is the cleanest set of findings in the whole audit — PROVEN, not inferred, across every layer:**

- `saveCareerInterest()` (`lib/career/careerEngine.ts:226-242`) does exactly two things: a slug→id lookup, and one INSERT into `student_career_interests`. **No capability recompute, no projection write, no match-engine call, no event publish, no `compass_bridge` touch** — confirmed by reading the full function body and both repository calls it makes.
- `lib/career/capabilityConvergence.architecture.test.ts:80` is an existing, running architecture test asserting exactly this: *"interest (student_career_interests, learner-entered) and capability (marks-derived CapabilityProfile) are deliberately never blended; a career match score must never be influenced by stated interest."*
- **SEARCHED vs VIEWED vs SAVED-AS-INTEREST vs RECOMMENDED vs SUPPORTED-BY-EVIDENCE are cleanly distinguished by the current architecture, proven by the absence of any code path connecting them**, except:
  - **SEARCHED does currently have one indirect side effect: an unknown search can trigger LLM generation + a `career_review_queue` row.** That is not learner-*evidence* in the CapabilityProfile/Projection sense (proven — §12 confirms zero coupling to those systems), but it is a real, persisted server-side action triggered by the mere act of searching, worth naming explicitly as a boundary a future discovery design must keep narrow (a search must never become interest, and per this audit, today it does not).

**`student_career_interests` chain, traced (§15):**
- Stores **both** `career_id` (nullable, FK to `careers.id`, no declared `ON DELETE` → defaults to RESTRICT) and `career_slug` (plain text, no FK).
- **Rename:** the row's `career_id` still resolves correctly (FK is UUID-based); `career_slug` becomes stale text with no automatic repair — a UI reading `career_slug` directly (rather than joining via `career_id`) would show a dead reference. **Not verified** which of the two the interest-display UI actually reads — the write path prefers writing both, but the read/display path wasn't traced by this audit.
- **Merge:** no merge concept exists; nothing would happen automatically to `career_id`/`career_slug` on a hypothetical merge because there's no merge mechanism at all today.
- **Retirement (delete):** blocked at the DB level for `career_id` (RESTRICT — the delete itself would fail, not silently cascade) — this is actually a *safety feature* by accident, not by design (no explicit `ON DELETE` clause was written; RESTRICT is Postgres's default when none is specified).
- **Interest saving does not affect intelligence elsewhere** — proven above.

---

## 16/17. Pathway & Subject Requirements Boundary

**Pathway (§16):** `Career.pathway: CareerPathway` is a **required, non-nullable field** in the TypeScript type (`lib/career/types.ts`) and `NOT NULL` at the DB migration level for the base `pathways jsonb NOT NULL` column (note: the recovered baseline shows both a legacy `pathways jsonb NOT NULL` array-ish column *and* a later `pathway text` scalar column — **not fully reconciled**, flagged as NOT VERIFIED which one is authoritative in current writes; application code (`careerEngine.ts`) reads/writes the scalar `pathway`). Because it's required, `careerEngine.ts:123-124`'s AI-generation path **silently defaults to `'Social Sciences'`** if the model's output doesn't match one of the three valid values — this is exactly the "fabricating certainty to satisfy a required field" failure mode the mission warned against, and it is proven to already exist in the current AI-generation path, not hypothetical.

**Subjects (§17):** `required_subjects: string[]` and `subject_importance: Record<string, ...>` are **free-text strings**, not references to any canonical KICD/CBC subject-identity table. **Not verified** by this audit whether such a canonical subject-ID vocabulary exists elsewhere in the codebase (`lib/curriculum/**` was audited in Phase 8 as defining `SubjectConfig`/pathway electives, but this Phase 9 audit did not re-confirm whether `Career.required_subjects` strings are validated against `lib/curriculum/**`'s subject identifiers — flagging as a gap to close before trusting this boundary, not asserting it's broken). The mission's threat model (AI producing `"Computer Science"` when the canonical entity uses a different exact string) is architecturally *possible* today given `required_subjects` is unconstrained free text with no enum/FK — this matches the description of an existing, if quieter, version of the §16 fabrication risk.

---

## 18. Kenya vs Global Knowledge

**PROVEN gap, matches Phase 8's own finding for Career Signals but here applies to career *identity/knowledge* itself.** `Career` has `kenya_market_outlook: string` (free prose) and no `geography` enum comparable to Career Signals' `KENYA | EAST_AFRICA | AFRICA | GLOBAL`. A field like `required_subjects` or `kcse_minimum` has no marker distinguishing "this is how it works in Kenya" from "this is generally true globally" — it's all just prose or flat fields with an implicit Kenya frame baked into the whole `Career` type's design intent, never made explicit per-field. A future research system generating content for a genuinely global-only career (with no Kenya-specific KCSE/pathway reality yet) would have nowhere honest to put that — every field implies Kenya-specific certainty by the schema's shape.

---

## 19. Career Signals Integration Boundary

**PROVEN.** `careerSignals.ts`'s `relatedCareerSlugs: string[]` is a plain string array matched via `.includes(careerSlug)` — no FK, no lookup, no validation against `careers` at read time (validation exists only in `careerSignals.test.ts`, a build-time check against the seed-file source text, not a runtime guarantee). **This is fragile against career mutability exactly as the mission worried:** if a career's slug ever changed (rename, merge), every `CareerSignal` referencing the old slug would silently stop resolving (return zero matches) with no error, no broken link, just quiet disappearance of the signal from that career's page. Today this is a non-issue because slugs are practically immutable (nothing renames them), but a future dynamic-career-discovery world where slugs could plausibly be corrected/merged would need either a stable non-slug identity for `relatedCareerSlugs` to point at, or an explicit re-validation step whenever a slug changes. **Career Signals itself needs no modification for this Phase 9 audit** — this is a forward-looking fragility note, not a present defect.

---

## 20. Career Detail Page Dynamic-Readiness

**PROVEN — the page is already runtime-dynamic (no SSG), confirmed in §2.** Testing "what if a provisional career has only `name`, `description`, `category`, `sources`" against the actual page (`app/student/career/[slug]/page.tsx`):

- The page currently only ever receives a *fully-formed* `Career` object (from `getCareerBySlugWithCOS`) or a `provisional: true` / `ProvisionalCareerPreview` shape via a *different* code path (the zero-result search flow, not this route) — **the Detail page itself has no branch that handles a partial/provisional career object today** (confirmed: no `provisional` handling found in `[slug]/page.tsx` — that concept only exists in the *search* route/response, not the detail route).
- If a hypothetical provisional career (missing `ai_impact`, `doors`, `skill_timeline`, `social_reality`, etc.) were ever fetched through the existing `/api/career/[slug]` route today, multiple sections would likely **degrade gracefully via existing conditional rendering** (`{aiImpact && (...)}`, `{socialReality && (...)}` patterns are already used throughout the page, confirmed in the Phase 8.1 work on this same file) — but this was not exhaustively tested against every section in this audit pass, and some sections (e.g. `CapabilityAlignmentSection`, which expects a `CapabilityCareerMatch`) are not gated the same way and could behave unpredictably if their upstream data (`capability_match` from the API route) is `null` for a career the matcher has never scored — **NOT VERIFIED as crash-safe**, only observed as "likely graceful for AI-generated-content-shaped gaps, unconfirmed for matcher-shaped gaps."

---

## 21/22. AI Generation & Web Research Readiness

**PROVEN, full detail from the dedicated audit pass:**

- **One real AI call path exists for career knowledge generation**: `generateCareerProfile()` (`lib/career/careerEngine.ts`) → `callDeepSeek()` (`lib/ai/deepseek.ts`) — which, despite its name, calls **Gemini** (`@google/generative-ai`, confirmed by import) as primary with a DeepSeek/Gemini retry-fallback chain that is inconsistent in ordering between its streaming and non-streaming variants.
- **No Zod validation anywhere in `lib/career/**` AI paths**, despite `zod` being a project dependency — response parsing is regex-extract-JSON + manual per-field `typeof`/`Array.isArray`/enum-`.includes()` coercion with silent fallback defaults (§16's pathway-fabrication finding is a direct symptom of this).
- **Prompt injection: unmitigated.** Raw user search text flows directly into the LLM prompt with no escaping.
- **Cost controls: a token cap exists (`maxTokens: 3500`), but no per-user rate limit or spend cap was found specific to this path**, and — critically — **usage is not cost-tracked**: none of the three career-related AI call sites pass a `costContext`, so their token spend is invisible to whatever cost-monitoring exists elsewhere in the platform (a direct violation of this project's own "Log token usage for cost monitoring" standing rule, worth flagging even though fixing it is out of scope for an audit phase).
- **Web research infrastructure: proven absent, entirely.** No web-search API client (SerpAPI/Tavily/Exa/Bing/Google Search) exists anywhere in the repo. No general-purpose URL-fetch-and-extract capability exists — Playwright is present but used exclusively to render *EduNexus's own* pages to PDF, never to scrape external sites. The `lib/growth/**` school-discovery module has schema fields suggestive of web enrichment (`website`, `google_place_id`) but **contains no in-repo crawler implementation** and is **completely unwired from any career code** — confirmed by cross-reference grep.
- **Direct answer to the mission's core AI-readiness question:** *"Could any existing AI infrastructure responsibly research a previously unknown career?"* **No.** What exists is LLM free-generation from training data only — zero web search, zero source retrieval, zero source verification, zero structured extraction from a real source. "Research" today is a euphemism for "ask the model to make up a plausible-sounding profile," contained only by the human-review gate before publication. The one thing worth reusing as-is: the shared `callDeepSeek()` wrapper's retry/timeout/fallback mechanics, and the proven human-review-queue *pattern* (`career_review_queue` + `publishReviewedCareer()`) as an architectural template — not its current lack of grounding.

---

## 23. Source Quality — What Could Be Reused

Nothing career-specific exists to reuse for source tiering. The one directly-reusable asset is **Phase 8.1's `CareerSignalSourceTier` model** (`tier1`–`tier4`, with the corroboration/human-review policy already built and tested in `lib/career/careerSignals.test.ts`) — a proven, working pattern for exactly this kind of policy, just not currently wired to career *identity/knowledge* at all (only to Career Signals). Reusing its *shape* (not its code, per §10) is the concrete recommendation.

---

## 24. Freshness Audit

No field-level freshness distinction exists on `careers` — only the one blunt `knowledge_verified_at`/`knowledge_source_note` pair added in the most recent migration, which timestamps the *whole row* at publish time, not per-field. Classifying the mission's own examples against reality: `description`/`category` (structurally stable) and `kcse_minimum`/`required_subjects` (slowly changing) get exactly the same freshness treatment today as `ai_impact`/`kenya_market_outlook`/salary (fast-changing) — the schema cannot express "this field is 3 years stale but that one was checked last week." `lib/career/knowledgeLifecycle.ts`'s `assessCareerKnowledge()` (confirmed in Phase 8) classifies whole-row freshness (`fresh`/`aging`/`stale`/`unknown`) from the single `knowledge_verified_at` — a real, working mechanism, but row-granular, not field-granular.

---

## 25/26. Cost Model & Abuse/Cost Attack

**Today's actual cost shape, proven:** every unknown search = one LLM call (no caching before generation, §4). Repeated identical or near-identical unknown searches multiply spend linearly with request volume, mitigated only at the DB-write level (not the LLM-call level). A search matching an existing slug/title is free (a single ILIKE query). There is no distinct "verify source" or "structured enrichment" cost step today because neither exists (§22) — so the *current* cost model is simpler than the mission's six-stage breakdown implies, but also cheaper-to-abuse in exactly the way that simplicity suggests.

**10,000-arbitrary-string abuse scenario, modeled against proven mechanics:** each distinct string → one LLM call (cost) → one `career_review_queue` row (if the resulting slug is novel) → unbounded queue growth, since nothing expires or caps pending entries. **No rate limit specific to this route was confirmed to exist** (the audit found `lib/ai/rateLimit.ts` exists in the codebase generally but did not confirm it's applied to `app/api/career/search/route.ts` specifically — marked NOT VERIFIED, worth checking before any future work touches this route). This is a real, already-latent cost/moderation exposure in the *existing* system, independent of whether Phase 9's future architecture is ever built — worth surfacing to the team regardless of this audit's "don't implement" mandate.

---

## 27. Human Review Question

Today's answer is absolute: **every** AI-generated career requires human review before becoming reusable — there is no trust tier at all, only `pending`/`published`/`rejected`. Evaluating the mission's proposed trust tiers against actual risk (§9-§11 findings): a tier like "visible to the searching learner but not globally indexed" **already effectively exists** in embryonic form — the `ProvisionalCareerPreview` shown at search time (stripped of salary/cost/KCSE/capability fields, per §9) is exactly that: visible to the one learner who searched, never entered into global `careers`, never reusable by anyone else until a human acts. This existing pattern is worth naming as already-correct-in-spirit, not something to redesign from scratch.

---

## 28/29/30. Career Intelligence, Blueprint, and Compass Compatibility

**Career Intelligence pipeline (§28):** `capabilityMatchEngine.ts`/`careerIntelligenceEngine.ts`/`clinicReportBuilder.ts` all assume a fully-formed `Career` row (title, category, pathway, required_capabilities, etc.) — none were found to have partial-data handling for a hypothetical provisional/thin career object, because today nothing provisional ever reaches them (§11's containment finding). A provisional career participating in these pipelines today would require either fabricating the missing fields (unsafe, exactly what the mission warns against) or excluding provisional careers from matching entirely (the current *de facto* behavior, achieved structurally rather than by an explicit guard).

**Blueprint (§29) — the most significant proven finding in this section, and arguably in the whole audit:**

Blueprint's own code comments (`lib/learnerBlueprint/composeCareer.ts:16-18`, `lib/learnerIntelligence/careerIntelligenceOrchestration.ts:195`) explicitly state the Career section "never surfaces a specific career/job title" — this claim was previously taken at face value (including in this project's Phase 8 audit, which repeated it). **It is false, proven by tracing the actual narrative fields:**

- `strengthProfile` = `match.narrative`, built by `buildMatchNarrative()` (`lib/career/capabilityMatchEngine.ts:166-210`), which names `career.title` verbatim in every tier's narrative string (e.g. *"Based on available evidence, ${career.title} looks like a strong match..."*).
- `futureDirection` = an insight `action` string that, in Senior/well-aligned mode, reads *"...start exploring ${match.career_title} directly..."*, and in Junior/family mode embeds up to three real career titles: *"Explore this field through subjects, clubs, or projects related to: ${exampleTitles.join(', ')}."*
- Both fields render unconditionally in `components/blueprint/sections.tsx` (`CareerSection`) and `components/blueprint/BlueprintView.tsx`.

**Why this matters for Phase 9 specifically:** it is currently *contained* — only fully-published `careers` rows ever reach `capabilityMatchEngine`, so today's leak surfaces only real, vetted career titles, not provisional/hallucinated ones. But it proves the pipeline that *would* carry a future provisional career's title into Blueprint prose already exists and is already live, with zero provenance/confidence framing attached to the name once it's inside a narrative string. Any future design that lets a provisional/lower-confidence career enter `capabilityMatchEngine`'s input even conditionally (e.g. "show provisional matches to the searching learner only") would need to either intercept `buildMatchNarrative()`/`matchToInsight()` specifically, or keep the existing hard separation (provisional careers never reach the matcher at all) — the second option is what's structurally true today and is the safer default to preserve.

**Dependency classification for §29, precisely:**
- Career category → Blueprint's `careerCluster`: **INDIRECT** (via `CATEGORY_LABEL[Career.category]` lookup one layer up in the orchestration file)
- Career slug → Blueprint's doors/AI-change-summary/exploration-suggestions content: **INDIRECT but consequential** (resolved via `getCareerBySlugWithCOS(top.careerSlug)`, feeds real rendered content)
- Career title → Blueprint's narrative prose: **DIRECT**, proven above, contradicting the module's own documentation
- Career pathway (`CareerPathway`) → Blueprint: **NO DEPENDENCY** (Blueprint's own "pathway" concept, `recommended_pathway`, is KJSEA-composite-derived, unrelated to `Career.pathway`)

**Compass (§30):** **CLOSED, and actively guarded** — `lib/compass/blueprintCompassConvergence.architecture.test.ts` walks every file in `lib/compass/**` and `app/api/learn/**` and fails the build if any of them imports `lib/career/**` or `lib/academicClinic/**`. This is a real, currently-running test, not just a convention. The one test-only exception (`deliveryBinding.integration.test.ts` importing a merge helper to test it directly) does not touch production code paths.

However, a **real but currently-dormant** reverse-direction coupling exists via the shared `student_learning_context.compass_bridge` jsonb field: `lib/career/autoReportGenerator.ts` (a `lib/career/**` file) is a documented co-writer of this field, including two keys (`firstSubject`/`firstConcept`) that Compass treats as session-starting signal. In principle this lets Career-domain content influence Compass targeting. In practice, the specific upstream field that would carry that influence (`student_learning_context.top_careers`) **has no writer anywhere in the codebase today** — so this specific path is proven dead code, not a live risk. The actual live influence on Compass's Senior-student session targeting comes from a **third, entirely separate system** — `lib/academicClinic/careerEngine.ts` (yes, the same disconnected 40-entry array from the headline finding) via `assessmentPipeline.ts`, which is neither `lib/career/**` nor learner-search/interest-driven. `student_career_interests` itself was confirmed to have **zero** path into `compass_bridge` — the interest-boundary finding from §14/§15 holds even under this reverse-coupling check.

---

## 31/32/33. Database, RLS, and Ownership Readiness

**Schema readiness, proven against the live table (not inferred):** `careers` already has `id` (stable uuid), `slug` (unique), `created_at`/`updated_at`, and a freshness pair (`knowledge_verified_at`/`knowledge_source_note`). **Missing, proven absent:** any `alias`/`synonym` representation, any `status`/lifecycle column, `merged_into`, `discovered_at`, `career_kind` (the CAREER/ROLE/SPECIALISATION/SKILL distinction from §7), and any structured per-field-or-per-row source-provenance record beyond the one free-text note. None of these are assumed necessary wholesale by this audit — each is named only where a proven current gap traces directly to a mission risk (identity stability → needs stable-ID-independent-of-slug per §35; duplicate threat → needs alias/synonym per §6/§8; trust asymmetry → needs some lifecycle marker per §11/§27).

**RLS, proven from actual policy SQL, not assumed:**
- `careers`: `SELECT` open to `authenticated` (`USING (true)`) — **no INSERT/UPDATE/DELETE policy exists at all** for any client role. All writes go through `lib/repositories/career.repository.ts`'s service-role client. **A learner/teacher client cannot write to `careers` directly today, under RLS as written — proven, not assumed.**
- `career_review_queue`: `authenticated` clients can `SELECT` their own submissions and `INSERT` their own (`submitted_by = auth.uid()`) — but **no client role can `UPDATE`/`DELETE`** (i.e., no client can move a row from `pending` to `published`). In practice, the actual insert path is the service-role repository anyway (`enqueueCareerReview`), so this client-facing INSERT policy is currently unexercised defense-in-depth, not the live write path.
- `student_career_interests`/`student_career_matches`: `FOR ALL` scoped to the student's own rows via a `students.user_id = auth.uid()` subquery — standard learner-owns-their-own-row pattern, no career-write implications.
- **A genuine open question surfaced by this audit, not resolved by any repo file:** the only `CHECK` constraint found for `career_review_queue.status` (in a known-stale legacy schema doc, not a tracked migration) permits `('pending','in_review','approved','rejected')` — it does **not** include `'published'`, which is the value the live application code actually writes on publish. Whether production's real constraint matches the code or the stale doc **cannot be determined from repo files alone** — marked NOT VERIFIED, worth a direct production-schema check before any future work touches this table.

**Ownership (§33):** proven consistent — canonical career knowledge is unambiguously global/platform-owned today (service-role-only writes, no school/teacher/learner-scoped career rows exist anywhere in the schema or code). Nothing in the current architecture conflicts with keeping it that way; no evidence suggests a redesign is warranted.

---

## 34/35. Deletion/Merge Safety & URL Stability

**Merge/delete, proven from FK behavior (§11/§15 findings restated for completeness):** a `careers` row delete cascades destructively through `student_career_matches` (real data loss, no history preserved) while being blocked outright by `student_career_interests.career_id`'s implicit RESTRICT — an inconsistency between the two tables that would need resolving before any merge/retirement feature could be built safely. Career Signals (`relatedCareerSlugs`, plain strings) would neither cascade nor error — it would just silently stop matching (§19). **No merge mechanism, soft-delete, or history-preservation concept exists anywhere today** — a merge cannot currently preserve history because there is no history-preservation concept at all, only hard delete or permanent existence.

**URL stability (§35):** `/student/career/[slug]` uses the slug as both the identity key and the URL segment — proven to be the same string doing double duty. A canonical rename today would change the URL with **no redirect mechanism found anywhere in the routing code**. Recommendation worth recording for whenever this is designed (not implemented): **future career identity should be independent of display slug** (i.e., resolve by a stable ID internally, treat slug as a mutable display/routing convenience with alias-redirect support) — but this is a design recommendation for a not-yet-built feature, not a claim about what exists.

---

## 36/37. Analytics Requirement & Real Search Demand

**Proven: zero career-search analytics exist today**, despite two career-related event types (`student.career_recommendation.updated`, `student.career_pathway.changed`) being pre-declared in `lib/events/types.ts` and `docs/events/event-catalog.md` — grepped repo-wide, **neither is ever actually fired** via `publishEvent()`. No career-search event type is cataloged at all, successful or zero-result.

**However — and this is a genuinely useful positive finding — a narrow, real demand signal already exists and is already consumed**: `career_review_queue`, populated exclusively by the zero-result search → AI-generation flow, with `request_count` tracking repeat demand for the same (slugified) unknown term, already read by a working admin endpoint (`app/api/admin/career/review/route.ts`, ordered by `request_count` descending). **This is close to a direct answer to "what careers are learners searching for that the existing corpus doesn't contain" — with two caveats, both proven:** (1) it only captures the miss case for free-text queries specifically (filter-only zero-result searches are never queued), and (2) it captures *generated-slug* demand, not raw query text, so near-duplicate phrasings of the same underlying demand (§8's "AI Engineer" vs "AI Developer" problem) would appear as multiple separate low-count entries rather than one clear signal — understating true demand for any concept with more than one common phrasing.

**Minimum recommended event set** (per the mission's request to recommend without implementing): `career_search` (every search, success or not, with query text and result count), `career_search_no_result`, `career_result_opened`, `career_saved_interest` — the four cover "is this feature used at all" and "what's actually missing" without requiring any discovery-specific infrastructure to be built first. `career_discovery_requested/completed/failed` and `career_alias_resolved` are premature — they describe a system that doesn't exist yet.

---

## 38. Architecture Guard Audit

**Guards that already exist and already protect adjacent ground, proven running today:**
- `lib/compass/blueprintCompassConvergence.architecture.test.ts` — blocks any `lib/compass/**`/`app/api/learn/**` file from importing `lib/career/**`/`lib/academicClinic/**`.
- `lib/career/capabilityExtractorPurity.architecture.test.ts` — blocks `capabilityExtractor.ts` from importing Supabase/AI/repositories.
- `lib/learnerIntelligence/careerIntelligencePurity.architecture.test.ts` — same purity boundary one layer up.
- `lib/career/capabilityConvergence.architecture.test.ts:80` — asserts interest and capability are never blended (directly protects §14/§15's finding).
- `lib/career/careerSignals.test.ts` — Phase 8.1's guards (no Projection/repositories/Compass import, every signal has a source, no fetch/await).

**None of these guards currently say anything about career *discovery*, because the feature doesn't exist.** Future tests this phase's own instructions correctly anticipate needing (not built here): an import-boundary test asserting career-discovery code cannot import `lib/projection/**` or write `capability_history`/`learner_evidence` (mirrors the existing pattern exactly); a behavioral test asserting `saveCareerInterest`-adjacent code never gets called from a search path (search ≠ interest, proven true today, would need to stay proven true); a `career_review_queue`-to-`careers` boundary test asserting no code path reads `career_review_queue` for matching/recommendation purposes (true today only because no such code exists — worth pinning down explicitly if discovery is ever built); and a provenance-completeness test analogous to Career Signals' "every signal has ≥1 source" guard, applied to any future career-knowledge evidence model.

---

## 39. Failure-State Design (illustrative, not implemented)

For each failure mode, what today's closest analog already does right, worth carrying forward: `career_review_queue`'s `pending` status is already an honest "we're still verifying this" state rather than fabricated completeness — the existing `ProvisionalCareerPreview` (stripped fields) is already the correct instinct for "insufficient evidence" framing. What's proven **not** to exist yet: any distinct failure state for "sources disagree," "AI failure" (a JSON-parse failure today just throws an unhandled-shaped error up to the route, not a graceful "still verifying" message), "web failure" (N/A, no web calls exist), or "career may not be legitimate" (no rejection-reason taxonomy exists on `career_review_queue` beyond a free-text `reviewer_notes` field).

---

## 40. Core Product Hypothesis — A vs B vs C

| | **A — Fixed curated corpus (current)** | **B — Open search, research-on-demand, NO auto-persistence** | **C — Open search + evidence-backed canonical persistence** |
|---|---|---|---|
| Learner value | Bounded to 43 careers (in the *good* pipeline; effectively 40, disconnected, in Academic Clinic) | Any career explorable immediately; nothing lost for common/unknown queries | Same as B, plus future learners benefit from earlier research (if evidence model is trustworthy) |
| Complexity | None — proven already working | Moderate — mostly reuses existing generation+preview pattern, explicitly *without* touching the identity/lifecycle/provenance gaps this audit found | High — requires closing nearly every gap this audit found (identity, alias, lifecycle, provenance, dedup, geography, taxonomy) before it's safe |
| Safety | Proven safe — human gate, provisional careers structurally can't leak into matching (§11) | Safe if the provisional-preview boundary (already proven to strip sensitive fields) is preserved and *nothing new persists* | Unsafe **today** — §8 (duplicates), §12 (unmitigated prompt injection + unvalidated hallucination), §16/§17 (fabricated pathway/subject certainty), and the two-corpus split (headline finding) would all need fixing first |
| Cost | Lowest | Same LLM cost as today's already-live zero-result flow — not a new cost, a continuation of an existing one | Same generation cost, plus whatever a real evidence/verification pipeline costs (currently nonexistent, §22) |
| Maintenance | Lowest, but the two-corpus split (`CAREER_DATABASE` vs `careers`) is an existing, unrelated maintenance liability regardless of this phase's decision | Low — no new canonical data to maintain, only ephemeral generation | Highest — canonical data now needs the freshness/lifecycle/merge machinery this audit found entirely absent |
| Evidence quality | High for seed data, none for anything AI-generated (proven, §9) | Unchanged from today — still ungrounded LLM generation, just framed honestly as provisional and never made permanent | Would need to *improve* evidence quality (real source retrieval, §22) to be responsible — not proven to exist anywhere close to ready |
| Scalability | N/A — fixed | Scales fine — no persistent state growth beyond the existing bounded review queue | Unbounded canonical-table growth without the dedup/lifecycle machinery this audit found missing |
| Current product maturity | Matches reality | Matches reality — extends an already-working pattern | Does not match reality — presupposes infrastructure (web research, alias resolution, lifecycle states, geography-aware provenance) that is proven absent |

**Recommendation: B, explicitly not C, and not by default-to-the-long-term-vision reasoning — by evidence.** Every one of the mission's own risk sections (8, 12, 16/17, 27, 34) traces to a real, proven gap that C would require closing, while B requires closing none of them — B is what today's system *already, functionally, does* (generate on demand, show a stripped provisional preview, never auto-persist), just without today's incidental leak of every miss into a growing, semi-visible `career_review_queue` regardless of whether a human ever reviews it. B is not "build something new" so much as "keep the current human-gated boundary intentional rather than incidental," which is a much smaller, safer step than C.

---

## 41. Architecture Maps

**Current (evidence-backed, corrected from the mission's illustrative sketch):**

```
                        CAREER WORLD (today — two disconnected sources)
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                             ▼
   Postgres `careers` (43 rows)                lib/academicClinic CAREER_DATABASE (40, hardcoded)
   ILIKE-substring search only                  closed in-memory array, no DB read
              │                                             │
   miss + free-text query ──► generateCareerProfile()       │  (feeds Academic Clinic
   (LLM free-generation, no web/source grounding,            │   teacher + parent reports
    no Zod, silent pathway/category fallback)                 only — never synced with
              │                                             │   the Postgres corpus)
              ▼                                             │
   career_review_queue (pending)                             │
   human review (publishReviewedCareer) ─── upsert ──────────┘  (NOT wired — a career published
              │                                                  here never reaches CAREER_DATABASE)
              ▼
   `careers` (canonical, servable)
              │
   ┌──────────┼───────────────┬─────────────────┐
   ▼          ▼                ▼                 ▼
Career     capabilityMatchEngine          Career Signals (slug-string match,
Detail     (feeds Blueprint's                no FK, fragile to rename — §19)
page        narrative prose — proven
            DIRECTLY, contradicting
            the module's own comments — §29)


============================================================
        LEARNER-IDENTITY BOUNDARY — PROVEN INTACT
============================================================
saveCareerInterest(): pure insert, zero side effects (§14/§15)
Compass reverse-import: CLOSED, architecture-test-guarded (§30)
Compass shared-field (`compass_bridge`) coupling: real but PROVEN DORMANT —
   the one field that would carry it (`top_careers`) has no writer anywhere.
   Live Senior-session-targeting influence instead comes from the SAME
   disconnected `CAREER_DATABASE` engine, not from career search/interest.
```

**Proposed future boundary (illustrative, matching the mission's target shape, corrected for what this audit proved must sit either side of the line):**

```
                     CAREER WORLD
                         │
              ┌──────────▼──────────┐
              │ Career Search        │  ← must query BOTH corpora, or the split must be
              └──────────┬──────────┘     resolved first (headline finding) — otherwise
                         │                 "search any career" quietly means "search
              ┌──────────▼──────────┐      only the Explorer's half of career knowledge"
              │ Career Resolver      │  ← needs an alias/synonym layer that does not exist (§6)
              └───────┬──────┬──────┘     to avoid the proven 6-duplicate-slug failure mode (§8)
                      │      │
                   known   unknown
                      │      ▼
                      │   Research   ← proven: no web/source infra exists (§22); would be
                      │      │          built from nothing, not extended from something
                      │   Evidence  ← proven: no per-field provenance model exists (§9/§10);
                      │      │          Career Signals' shape is reusable, its code is not
                      │  Canonicalise ← proven: no lifecycle/status/merge concept exists (§11/§34);
                      │      │          proven: identity is slug-based with no rename safety (§35)
                      └──────┬──────
                             ▼
                    Career Knowledge  ← must be re-synced into CAREER_DATABASE too,
                             │           or Academic Clinic silently diverges further (headline)
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
       Career Detail    Career Signals    Education Routes
       (already runtime-  (slug-fragile,   (no canonical subject-ID
        dynamic — §20)     §19)             vocabulary confirmed reused — §17)


============================================================
                  HARD INTELLIGENCE BOUNDARY
   PROVEN INTACT for interest/Compass (§14/§15/§30).
   PROVEN LEAKY for Blueprint narrative prose (§29) —
   contained today only because provisional careers structurally
   cannot reach the matcher (§11) — that containment, not a
   content filter, is what must be preserved, explicitly, in
   any future design that admits provisional careers further
   into the pipeline than "shown only to the searching learner."
============================================================

                       LEARNER WORLD
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
          Interests     Capability     Evidence
              │             │             │
              └─────────────┼─────────────┘
                            ▼
                    Career Intelligence
                            │
                     Human-readable
                      interpretation
```
