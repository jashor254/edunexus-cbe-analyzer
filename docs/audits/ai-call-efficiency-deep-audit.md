# EduNexus — Deep AI Call Efficiency Audit

**Date:** 2026-10-30
**Scope:** Every LLM / AI-provider invocation reachable from application code, crons, and scripts
**Method:** Static source analysis, import tracing, and caller tracing at a fixed commit. No code, schema, or configuration was modified. No provider was called. No production data was read.

| Baseline | Value |
|---|---|
| Repository | `/home/the-dev/projects/edunexus` |
| Branch | `feat/growth-reply-loop` |
| HEAD | `00f5dd8` (test: register outreach reply-to test…) |
| Working tree at start | 1 modified (`lib/growth/messaging/replyTo.ts`), 7 untracked paths. All preserved. This report is the only file added. |
| Runtime | Next.js 16.4.3, Node 24, Vercel (functions + `vercel.json` crons), GitHub Actions crons, Supabase |

### Evidence labels used throughout

- **[V-SRC]**: verified by reading the current source at HEAD. The code path exists and does what is described.
- **[INF]**: inferred from source. Plausible, but depends on runtime conditions not observable statically.
- **[UNVERIFIED]**: needs production telemetry, provider billing data, or DB state to confirm.
- **[HIST]**: from older docs or memory. Not re-verified here.

No runtime measurements exist for this audit. Every number in §15 is a **formula or a labelled assumption**, never a measurement.

---

## 1. Executive summary

**Architecture in one paragraph.** EduNexus has **23 distinct production model-call sites** across **19 lib modules**, all of them server-side. They use two providers: **DeepSeek** (`deepseek-chat`, raw `fetch`) and **Google Gemini** (`@google/generative-ai`, `gemini-2.5-flash-lite`, plus `gemini-3.5-flash-lite` for script marking). Three wrappers carry most of the traffic:

- `callDeepSeek` (`lib/ai/deepseek.ts`): DeepSeek primary, one retry on timeout or network failure, then Gemini fallback.
- `streamDeepSeek` (same file): despite the name, **Gemini primary** with DeepSeek fallback. Used only by the Compass tutor.
- `routedCompletion` (`lib/ai-orchestration/router.ts`): a two-entry provider chain where **both entries call `callDeepSeek`**.

Paper Intelligence and the Teaching Intelligence Engine (TIE) call Gemini directly. The deterministic learner-intelligence spine (Projection, Blueprint, Academic Clinic, parent intelligence, pathway calculators) makes **no** model calls **[V-SRC]**. That is the architecture's strongest property.

**Overall verdict.** Most of the AI calls in this codebase are justified. The problems are around them: weak controls, missing measurement, and a few spots where an LLM duplicates or overrides intelligence the deterministic layer already produced.

**Most important verified findings**

1. **P0: The daily AI abuse caps are inert for 10 of 11 capped features [V-SRC].** `checkDailyCallLimit` counts `ai_call_logs` rows by `TokenFeature` key. Only `career_knowledge_request` ever writes a row under its own key. SOW, lesson plans, slides, remedial, holiday, Compass, career report, and variants never log under their key, so their counts stay at 0 and the caps never trip. For zero-token features (`lesson_plan_generate`) and school-covered or subscriber users, the cap was the only bound.
2. **P0 (privacy, already tracked): Compass sends the learner's first name and free text to Gemini, falling back to DeepSeek [V-SRC].** Every other learner-facing generator uses the `LEARNER_NAME_TOKEN` pseudonym. This is consistent with the open items in the 2026-10-17 privacy audit **[HIST]**.
3. **P1: Class-report AI duplicates and overwrites deterministic intelligence [V-SRC].** `generateCompassBridge` regenerates, from subject-level scores, the bridge that `assessmentPipeline` already built deterministically. It then **overwrites** the knowledge-graph-derived `session_goal`/`guided_topics` with an LLM guess. A failed AI call is still counted as `ok` and charged.
4. **P1: Router call multiplication [V-SRC].** `routedCompletion` × `callDeepSeek` can issue up to **6 provider requests per logical call**. A single adaptive-variant tier can reach **24**. Provider-health bookkeeping is mislabelled.
5. **P1: Ungrounded LLM classification persisted as data [V-SRC].** The TIE root-cause classifier asks Gemini to pick between four causes using only three counters. Nothing in those inputs distinguishes the causes. The answer is persisted as `substrand_health.root_cause` and flows into the remedial planner.
6. **P1: Paid calls discarded by design [V-SRC].** `generate-week` has no "already generated" pre-check: the AI calls run, then the insert hits the unique constraint. `Promise.all` also discards a week's successful plans if one lesson fails.
7. **P1: No per-feature cost visibility [V-SRC].** `costContext` is never supplied by any production caller. The only per-call token log has no feature tag. `ai_call_logs` covers about 6 features. Token spend by feature **cannot be measured today**.

**Highest-value opportunities**

- Make the caps real (cheap, high safety value).
- Remove two TIE calls that a template or rule reproduces exactly.
- Stop the class-report LLM from overwriting graph-derived targets.
- Collapse router double-fallback.
- Add a feature tag to usage logs before any further cost decision.

**Limitation that frames everything.** Under the labelled assumptions in §15, Compass tutor turns are likely the dominant call volume, roughly 20× the teacher side. Most deterministic replacements recommended here are **correctness and control wins first, cost wins second**. Compass volume and token size have to be measured before any cost-driven change is made to it.

---

## 2. Repository coverage

### Coverage ledger

| Area | Examined | How |
|---|---|---|
| `lib/ai/` (deepseek, gemini, models, logger, rateLimit, pseudonym, educationalContext, ragContext) | Full | Read |
| `lib/ai-orchestration/` (router, registry, cost, types, templates) | Router, registry fully; cost/templates by import trace | Read + grep |
| `lib/config/api.ts`, `lib/config/env.ts`, `lib/config/adaptiveVariants.ts` | Full / relevant parts | Read |
| All 19 AI-calling lib modules (listed in §4) | AI call sites, prompt builders, parsers, retry loops | Read |
| All 22 routes / crons reaching those modules | Auth, gating, rate limit, charge, persistence | Read relevant sections |
| `app/api/cron/*`, `vercel.json`, `.github/workflows/*` | Schedules, AI reachability | Read + grep |
| `lib/jobs/` queue | Handler registry | grep (no handlers registered) |
| `lib/projection/eventConsumer.ts`, `lib/learnerIntelligence/*`, `lib/academicClinic/*`, `lib/learnerBlueprint/*` | Confirmed **no** model calls | grep of every call primitive |
| Client components (`app/**/*.tsx`, `components/`) | Confirmed no provider SDK or keys client-side. Traced AI-triggering `fetch` calls for 3 pages | grep + read |
| `package.json` AI dependencies | Import usage | grep |
| Tests touching AI | Inventory, plus contract-test titles for `callDeepSeek` | grep + read |
| `scripts/` | Inventoried AI-calling scripts (offline only) | grep |
| `supabase/functions` | Does not exist | ls |

**Search primitives used:** `callDeepSeek`, `streamDeepSeek`, `callGemini(JSON)`, `routedCompletion`, `GoogleGenerativeAI`, `generateContent`, `new OpenAI`, `streamText`/`generateText`/`generateObject`/`useChat`, provider hostnames, `*_API_KEY` env names, and per-module importer tracing.

**Excluded:** `node_modules`, `.next`, `docs/` (except as context), `remotion-pipeline-v1`, the separate `edunexus-devportal` repo, and `_frozen/` (grep found no AI usage). Untracked `research_notes/` and `reports/` were not inspected.

**Remaining uncertainties:**

- Which crons actually fire in production.
- Provider-side billing of aborted requests.
- Real retry and fallback frequencies.
- Whether migration `20260807160000_lesson_plans_week_lesson_unique` is applied in production.

---

## 3. Provider inventory

| Provider | Access path | Model(s) | Where selected |
|---|---|---|---|
| DeepSeek | Raw `fetch` to `https://api.deepseek.com/v1/chat/completions` | `deepseek-chat` (hard-coded) | `lib/config/api.ts` `DEEPSEEK_CONFIG.model` |
| Google Gemini | `@google/generative-ai` SDK | `gemini-2.5-flash-lite` (`GEMINI_PRIMARY`) | `lib/ai/models.ts` |
| Google Gemini (script marking) | Same SDK | `gemini-3.5-flash-lite` (`GEMINI_SCRIPT_MARKING`) | `lib/ai/models.ts`, chosen from a 2-learner × 8-question trial **[HIST, documented in file]** |

**Wrappers and fallback behaviour [V-SRC]**

| Wrapper | Primary | Retry | Fallback | Timeout | Usage capture |
|---|---|---|---|---|---|
| `callDeepSeek` (`lib/ai/deepseek.ts:141`) | DeepSeek | 1 retry, **only** for timeout or `fetch failed` (`:187`) | Gemini non-streaming, after the retry fails | 25s DeepSeek (abort); 20s Gemini (promise race, **no abort**) | `total_tokens` logged with no feature tag; `usage_events` only if `costContext` is set (never, see §13) |
| `streamDeepSeek` (`:387`) | **Gemini** stream | DeepSeek stream retried once on network error | DeepSeek stream | 15s Gemini TTFB (race, **no abort**); 25s DeepSeek | Gemini path logs total tokens; DeepSeek path none |
| `routedCompletion` (`lib/ai-orchestration/router.ts:25`) | Chain `['deepseek','gemini']` (quality) or `['gemini','deepseek']` | Each chain entry calls `callDeepSeek` | Next chain entry: `callDeepSeek` **again** | Inherited | Estimated (chars/4), only with `organization_id` (never supplied) |
| `callGemini` / `callGeminiJSON` (`lib/ai/gemini.ts`) | Gemini | none | none | **none** | none (callers log to `ai_call_logs` themselves) |
| Paper Intelligence direct SDK | Gemini | Script marking: 1 parse-retry (`MAX_ATTEMPTS = 2`) | none | **none** | Real `usageMetadata` returned in result metadata |

**Configured but unused:**

- `GEMINI_FALLBACK` is identical to primary and unreferenced in call paths.
- `GEMINI_CONFIG.isConfigured: () => false` is labelled "dead-ended" yet Gemini is live.
- The registry reads `GEMINI_MODEL`/`DEEPSEEK_MODEL` env vars that the actual call paths ignore.
- npm dependencies `openai`, `ai`, `@ai-sdk/deepseek`, and `@ai-sdk/react` have **zero imports** **[V-SRC]**.

**Client exposure:** no `NEXT_PUBLIC_*` AI keys, and no client component imports a provider SDK or an AI wrapper **[V-SRC]**.

---

## 4. AI call-site register

Column key: **Calls** = provider requests per logical invocation, as *normal / max*. "CD" = `callDeepSeek` (normal 1, max 3). "RC" = `routedCompletion` (normal 1, max 6).

| ID | Feature | Source (file:line, function) | Trigger | Provider / model | Calls (normal/max) | Safeguards | Class | Conf. |
|---|---|---|---|---|---|---|---|---|
| AI-01 | Compass tutor turn | `app/api/learn/route.ts:462` → `streamDeepSeek` | Learner sends a message (POST `/api/learn`) | Gemini 2.5-fl-lite → DeepSeek | 1 / 3 per turn | Auth, ownership, token deduct on first token, history trimmed to 20 msgs, max 1000 out | **A** (with B, F sub-issues) | High |
| AI-02 | Career Intelligence narrative | `lib/career/careerIntelligenceEngine.ts:549` `generateNarrativeSections` | Parent clicks Generate (GET `/api/career/intelligence-report`) | CD | 1 / 3 | Auth, owner/parent, tokens, pseudonym, evidence-strength hedging | **B** (not persisted) | High |
| AI-03 | Class-report Compass bridge | `lib/career/autoReportGenerator.ts:259` `generateCompassBridge` | Teacher POST `generate-reports` → `after()` loop, 1 per learner | CD | N / 3N | Auth, class teacher, one charge per run, pseudonym | **D** | High |
| AI-04 | Unknown-career profile draft | `lib/career/careerEngine.ts:119` via `knowledgeRequests.ts:119` | Learner searches or opens an unknown career slug (incl. **GET** `/api/career/[slug]`) | CD | 1 / 3 | Slug + title lookup, pending-queue dedup, **working** 5/day cap, human review before publish | **E** (well-guarded) | High |
| AI-05 | SOW lesson generation | `lib/sow/aiLessonGenerator.ts:206` `callSowAI` ← `generateValidatedLesson:686` | Teacher generates SOW (`after()` job); batches of 5 in parallel | CD | S / 15S (S = teaching slots; `MAX_RETRIES = 5`) | Validator, KICD grounding, curriculum identity re-attached server-side | **A/B** | High |
| AI-06 | Lesson plan generation | `lib/lessonPlan/generator.ts:301` `generateLessonPlan` | Teacher generate / generate-week; **Friday cron** for every active SOW | CD | 1 / 9 per lesson (3 attempts) | Required-field check | **A/B** | High |
| AI-07 | Lesson reflection suggestions | `lib/lessonPlan/generator.ts:467` `generateReflectionSuggestions` | Teacher opens "mark as taught" form (`app/teacher/lesson-plans/[planId]/page.tsx:262`) | CD | 1 / 3 | Auth + plan ownership only. Deterministic fallback exists | **C** | High |
| AI-08 | Remedial plan narrative | `lib/remedial/planner.ts:347` `enrichWithAI` | Teacher POST `/api/remedial/generate` | RC (quality) | 1 / 6 | Best-effort; deterministic plan always returned; no learner names | **E** | Medium |
| AI-09 | Adaptive variant generate | `lib/assignments/variantGeneration.ts:156` | Teacher generate / regenerate / generate-all | RC | 1–2 / 12 per tier | Structural validation, redacted context, draft-only | **A** | High |
| AI-10 | Adaptive variant verify | `lib/assignments/variantGeneration.ts:168` | Paired with AI-09 | RC | 1–2 / 12 per tier | Strict verdict parser; never auto-pass | **A** | High |
| AI-11 | Holiday WhatsApp/summary rewrite | `lib/holiday/planner.ts:434` `enrichPlanWithAI` | Teacher holiday generate, 1 per learner (concurrency 5) | CD | N / 3N | Template fallback, pseudonym | **E** | Medium |
| AI-12 | Slide deck content | `lib/slides/aiSlideGenerator.ts:88` | Teacher POST `/api/slides/generate` | CD | 1 / 3 | Tokens; `slides[]` non-empty check | **A** | Medium |
| AI-13 | Kiswahili insha evaluation | `lib/kiswahili/inshaEvaluator.ts:256` `evaluateInsha` | Teacher submits essay | CD | 1 / 3 | Zod 50–3000 chars, pack billing only on non-fallback | **A** | High |
| AI-14 | Academy reflection judge | `lib/academy/aiJudge.ts:84` `scoreReflection` | Teacher submits reflection | CD | 0–1 / 3 | <15-word deterministic gate, score range check | **A** | High |
| AI-15 | Academy mission judge | `lib/academy/aiJudge.ts:250` `scoreMissionComparison` | Teacher completes mission | CD | 0–1 / 3 | <20-word gate, tool outputs capped at 800 chars | **A** | High |
| AI-16 | TIE root-cause classifier | `lib/teachingIntelligence/rootCauseClassifier.ts:58` `classifyWithAI` | Friday cron, per ambiguous `substrand_health` row, sequential (`friday-generation/route.ts:164`) | Gemini direct | k / k (no retry) | Rule pass first; code whitelist; failure → `UNKNOWN` | **C / F** | High |
| AI-17 | TIE weekly teacher note | `lib/teachingIntelligence/weeklyGenerator.ts:93` `generateTeacherNote` | Friday cron, per SOW with evaluated plans | Gemini direct | 1 / 1 | Template fallback | **C** | High |
| AI-18 | TIE quick check | `lib/teachingIntelligence/quickCheckGenerator.ts:70` | Teacher POST `/api/teaching-intelligence/quick-check` | Gemini direct | 1 / 1 | Auth, SOW ownership, shape check | **A** (B issues) | Medium |
| AI-19 | Study-group daily challenge | `lib/studyGroups/challengeGenerator.ts:40` | `/api/cron/study-group-challenges`, **not scheduled anywhere** | Gemini direct | 1/group/day | Per-day dedup | **F** (dormant) | Medium |
| AI-20 | Paper page vision marking | `lib/paperIntelligence/vision.ts:91` `recognizeAndMarkPage` | Teacher POST `mark-page` | Gemini direct (multimodal) | 1 / 1 | Rubric-bound validation, rejected list surfaced | **A** | Medium |
| AI-21 | Marking-scheme extraction | `lib/paperIntelligence/schemeExtraction.ts:88` | Teacher POST `extract-rubric` (≤12 images) | Gemini direct (multimodal) | 1 / 1 | Proposed rubrics only | **A** | Medium |
| AI-22 | Whole-script marking | `lib/paperIntelligence/scriptMarking.ts:156` `recognizeAndMarkScript` | Teacher POST `mark-script` | Gemini 3.5-fl-lite, `responseSchema` | 1 / 2 (resends all page images) | Schema-constrained output, validation, `pending_review` evidence, re-mark blocked after review | **A** | High |
| AI-23 | (Compass session-close eval, the same AI-01 call) | Parsed in `app/api/learn/route.ts:537-560` | Part of AI-01 output | — | 0 extra | Mastery claims stay `pending_review`, never auto-confirmed (`lib/compass/evidence.ts`) | **A** (B: no schema validation) | High |

**Offline / manual only (not production paths):**

- `scripts/backfill-career-doors.ts:71` (CD, loops over careers).
- `scripts/_tmp/gate_*` live Gemini smoke tests.
- `scripts/generateBetaReports.ts` and two single-learner `scripts/test*Report.ts` files, which reach AI-03 against real DB rows (needs a privacy review before reuse; not inspected further).

**No model call:**

- `app/api/generate/route.ts` is a placeholder stub.
- `/api/learn/end` records evidence only.
- Projection, Blueprint, Academic Clinic, and parent reports are deterministic **[V-SRC]**.

---

## 5. Workflow call graphs

### 5.1 Compass tutor turn (AI-01 / AI-23)

```
Learner message → POST /api/learn (body: message, learnerId, sessionId, conversationHistory…)
 → checkFeatureAccess + 6 parallel DB reads → resolveCompassMutationAccess → session ownership
 → checkDailyCallLimit('learning_compass')            ← always 0 (see F-01)
 → idle >20 min ? return canned text (no AI)           ← good: deterministic short-circuit
 → resolveCompassLearnerIntelligence (Projection)      ← canonical reuse ✔
 → buildCompassPrompt (≈6.5k chars of template source, static-first ordering)
 → streamDeepSeek(system, message, client-supplied history.slice(-20))
      → Gemini stream (15s TTFB race) ─fail→ DeepSeek stream (+1 retry on network error)
 → TransformStream: deduct tokens on first token; on flush parse COMPASS_EVAL / PEDAGOGY blocks
 → writes: compass_sessions.one_line_summary, student_learning_context.{sessions_without_improvement,
   subject_rest_until}, session state (masteredConcepts), compass_messages
 → /api/learn/end → recordCompassSessionEvidence → mastery claims = pending_review (never auto-confirmed)
```

### 5.2 Class reports (AI-03), the duplicate-intelligence path

```
Assessment upload → assessmentPipeline (deterministic)
   → CareerEngine.buildCompassBridge()  (lib/academicClinic/careerEngine.ts:2749)
   → knowledge-graph root causes → graphSessionGoal / graphGuidedTopics
   → student_learning_context.{session_goal, guided_topics, compass_bridge}   (assessmentPipeline.ts:196-201)

Teacher "Generate reports" → POST generate-reports → after():
   for each learner (sequential):
      buildClinicReport (deterministic)
      generateCompassBridge → CD (1 per learner) → LLM picks firstSubject/firstConcept/priorities
      merge bridge (preserves teacher intent ✔) BUT overwrite session_goal + guided_topics
      (autoReportGenerator.ts:358-359) — discards the graph-derived values above
      bridge === null (AI failed) → still results.push(status:'ok')  (:370) → counted, charged
```

### 5.3 Router double-fallback (AI-08, AI-09, AI-10)

```
routedCompletion(mode='quality') chain = ['deepseek','gemini']
  entry 'deepseek' → callDeepSeek → DeepSeek → (timeout) DeepSeek retry → Gemini      (≤3 requests)
  entry 'gemini'   → callDeepSeek → DeepSeek → (timeout) DeepSeek retry → Gemini      (≤3 requests)
Max 6 provider requests. On a non-retryable DeepSeek HTTP error (e.g. 5xx/429): 1 + 1 = 2
DeepSeek requests, Gemini never tried.
Variant tier: generateWithVerification(maxAttempts=2) × (generate + verify) × ≤6 = ≤24 requests.
```

### 5.4 Friday cron (AI-06, AI-16, AI-17)

```
vercel.json "0 15 * * 5" → /api/cron/friday-generation (maxDuration 300, one sequential loop over all active SOWs)
  per SOW: generateWeeklyPlans(latestWeek+1) → Promise.all(≈5 × generateLessonPlan → CD, ≤3 attempts)
           root-cause backfill: for each ambiguous row → await classifyWithAI (Gemini, no timeout)
           runTIEForSOW → generateTeacherNote (Gemini, no timeout) if evaluated plans exist
```

The cron generates plans for **every** active or saved SOW whether or not the teacher used the previous week. It only advances one week past the latest existing plan, so it is bounded by the timeline **[V-SRC]**. At scale, the 300s single-invocation budget becomes the limiting factor **[INF]**.

### 5.5 SOW (AI-05)

```
POST /api/sow/generate → jobs row → after(): generateSchemePipeline
  slots → batches of 5 → Promise.all(generateValidatedLesson) → while attempt < 5: CD → JSON → validate
  KICD slice present (prod ≈86% grounded [HIST]): prompt includes official outcomes/questions and asks the
  model to echo them; server then overwrites them (aiLessonGenerator.ts:759-762)
```

---

## 6. Deterministic replacement opportunities

| ID | Current operation | Why the LLM adds little | Proposed alternative | Exactness | Educational impact | Complexity | Verdict |
|---|---|---|---|---|---|---|---|
| **AI-17** TIE weekly note | Gemini writes 2–3 sentences from health score + 3 lists | The prompt itself encodes the rule ("solid" >70, "mixed" 50–70, "challenging" <50). Every input is structured | Parameterised template (EN + optionally SW) with the same thresholds and list joins | **Exact** semantically; loses phrasing variety | Neutral to positive (no hallucinated colour) | Low | **Replace now** |
| **AI-16** TIE root cause | Gemini picks PREREQUISITE_GAP / LANGUAGE_BARRIER / RESOURCE_MISMATCH / TEACHER_STRATEGY from `lessons_covered`, `struggle_count`, `remediated` + names | None of those inputs can discriminate the four causes. The output is a guess presented as a diagnosis, and it feeds `remedial/planner.ts:133` and quick-check framing | (a) Persist `UNKNOWN` for the ambiguous branch, which is honest. (b) Later, derive PREREQUISITE_GAP deterministically when the knowledge graph shows a weak prerequisite node | (a) exact-honest; (b) rule-based | Positive: removes fabricated diagnoses | Low | **Replace now** (a); (b) deferred |
| **AI-07** Reflection suggestions | DeepSeek writes 3 generic reflections from subject/sub-strand/outcomes | `generateFallbackReflection` already produces subject-specific variants from the same inputs. The model has **no** information about what actually happened in class, so its "learner responses" are fabricated, and TIE already down-weights `ai_suggestion` reflections (`weeklyGenerator.ts` sourceScore 0.3) | Use the deterministic templates as primary. Optionally cache an AI version per `plan_id` | Approximate (less varied prose) | Neutral to positive (less fabricated observation in TSC records) | Low | **Replace now** (product owner to confirm tone) |
| **AI-03** Class-report bridge | LLM chooses first subject, start difficulty, tier gaps, concept, milestones, parent message | `startDifficulty` is computed then overridden deterministically. Subject priorities and tiers come straight from data. The deterministic `buildCompassBridge` already exists. Concept choice from subject-level scores is a guess; knowledge-graph root causes are the grounded source | Stop calling the LLM. Reuse the pipeline's deterministic bridge plus graph-derived goal/topics. If a parent-facing message is wanted, template it | Approximate (parent message tone) | **Positive**: Compass starts from graph root causes instead of a guess | Medium (UI reads `subjectPriorities`/`weeklyMilestones`/`parentWhatsAppMessage` shapes) | **Replace** (P1). At minimum stop the overwrite now |
| **AI-11** Holiday rewrite | DeepSeek rewrites a WhatsApp message already built by `buildWhatsAppMessage` | Purely stylistic. Template already used on failure | Keep the template; make AI optional or remove it | Approximate | Low | Low | **Conditional**: measure parent engagement first |
| **AI-08** Remedial narrative | 1 routed call writes the week plan from deterministic groups | Groups, activities, and check-in week are deterministic; the narrative is phrasing | Template the week list; keep AI only if teachers prefer it | Approximate | Low | Low | **Conditional / defer** |
| AI-19 Challenge | Gemini authors question **and** answer key | Not replaceable by rules, but see §12 for the answer-key risk | — | — | — | — | Not a replacement candidate |

**Rejected replacements:** AI-01, AI-05, AI-06, AI-09/10, AI-12, AI-13, AI-14/15, AI-20/21/22. See §18.

---

## 7. Duplicate intelligence findings

| Finding | Evidence | Real duplication? |
|---|---|---|
| **D-1** Class-report bridge regenerates the deterministic bridge | `assessmentPipeline.ts:196-201` writes `compass_bridge`, `session_goal` (graph first), `guided_topics` (graph first). `autoReportGenerator.ts:358-359` overwrites `session_goal` and `guided_topics` from the LLM | **Yes**, and it **downgrades** grounded intelligence. Compass then needs `isSubtopicCompatible()` (`learn/route.ts`) to defend against wrong-subject concepts the LLM produced |
| **D-2** Root cause inferred twice, in different vocabularies | Knowledge-graph root causes (`knowledge_root_causes`) vs TIE `substrand_health.root_cause` LLM guess | **Partial.** Different grain (learner vs class sub-strand), but the TIE LLM ignores the graph that could ground it |
| D-3 Compass tutor vs Career narrative vs Holiday message | Different audiences and outputs | **Not duplicate.** All read the Projection or deterministic reports as input ✔ |
| D-4 Variant generate vs verify | Second call checks the first | **Intentional**, not duplicate. Note: same model family verifies itself, so the verification is not fully independent ([G] for value) |
| D-5 `mark-page` (AI-20) vs `mark-script` (AI-22) | Two vision marking paths with separate prompts | **Uncertain.** Mark-script appears to supersede mark-page for Phase 1 **[HIST]**. Confirm whether mark-page is still reachable from the UI before retiring it |

**Canonical reuse verified ✔:** Compass (`resolveCompassLearnerIntelligence`), Career Intelligence (`recomputeLearnerProjection`), remedial (`classifyGroup` over the Projection), and variants (`recommendForClass` + `deriveEducationalAIContext`) all consume canonical learner state rather than re-reading raw marks for the AI. No feature module bypasses the projection for model context **[V-SRC]**.

---

## 8. Prompt and context efficiency

There are no token measurements. Sizes below are **template source character counts** (an upper bound that includes code); divide by ~4 for a rough token estimate. Treat them as estimates.

| Site | Observation | Recommendation |
|---|---|---|
| AI-01 Compass | Prompt template ≈6.5k chars source. KICD topic list for juniors is grades 7..current joined inline, so it is unbounded by count. History is **client-supplied**, trimmed to 20 messages but with **no per-message length bound**. Static-first ordering is good for implicit prefix caching | Load history server-side from `compass_messages` (fixes forgery and bounds size); cap topic list; measure input tokens per turn first |
| AI-05 SOW | When a KICD slice exists, the model is asked to echo official outcomes/questions, which the server then overwrites (`aiLessonGenerator.ts:759-762`). That is wasted output tokens on ~86% of lessons **[HIST share]** | Ask the model to omit those fields when grounded; set them server-side before validation |
| AI-07 Reflection | `maxTokens: 2000` for ~3×3 sentences | Moot if replaced; otherwise ~400 |
| AI-08 / AI-11 | `system` left undefined → `callDeepSeek` default **"Always respond with valid JSON only"** contradicts the plain-text/WHATSAPP format requested (`remedial/planner.ts:343`, `holiday/planner.ts:434`) | Pass an explicit system prompt. This is a reliability fix, not just efficiency |
| AI-03 | ≈4.5k chars of prompt per learner, mostly a fixed topic catalogue repeated N times per run | Moot if replaced |
| AI-04 | ≈5k-char schema prompt, 3500 max tokens. Acceptable for a rare, capped, human-reviewed call | Keep |
| AI-22 | `MAX_OUTPUT_TOKENS = 24576`. Parse retry resends **all page images** | Measure actual completion tokens; a schema failure rate × image tokens is the retry cost |
| AI-13 | Large Kiswahili rubric system prompt (≈9k chars source) per essay | Candidate for provider prefix caching (it is static); measure |
| `callGeminiJSON` | Appends a JSON instruction to the prompt but does not set `responseMimeType`, so fenced output breaks `JSON.parse` in quick-check (`quickCheckGenerator.ts:101`) | Use `responseMimeType: 'application/json'` (already used in AI-22) |

---

## 9. Model and provider efficiency

1. **`streamDeepSeek` is Gemini-primary [V-SRC].** The name misleads every reader and every audit. Rename it, or document it at the call site.
2. **Router chains are illusory [V-SRC].** Both chain entries call `callDeepSeek`. `mode: 'fast'` does not try Gemini first. The registry records `deepseek`/`gemini` health twice per call: once in `callDeepSeek` (real provider) and once in the router (chain label, where a "gemini" success may have been DeepSeek). As a result the circuit breaker can mark "gemini" down because of DeepSeek failures. Recommend that `callProviderCompletion` call **one** provider directly, so the chain is the only fallback layer.
3. **Fallback gaps [V-SRC]:**
   - DeepSeek HTTP 429/5xx are **not** retryable and **never** fall back to Gemini (`deepseek.ts:187`), so a DeepSeek outage that returns 503 fails every `callDeepSeek` feature.
   - Conversely, a timeout triggers a retry, which may double-bill **[UNVERIFIED: depends on whether DeepSeek bills aborted completions]**.
4. **Orphaned requests [INF].** The Gemini timeouts in `callGeminiNonStreaming` (20s) and `streamGeminiFallback` (15s) reject a promise but never abort the SDK request. A slow Gemini response can complete (and be billed **[UNVERIFIED]**) after DeepSeek has already been called.
5. **No timeouts at all** on `callGemini` (TIE ×3, study groups) or the Paper Intelligence SDK calls [V-SRC]. A hang inside the sequential Friday loop consumes the 300s budget for every remaining SOW.
6. **Mid-stream failure:** once a Gemini stream starts, an error mid-stream is not caught for fallback. The learner gets a truncated turn **and is charged** (deduction at first token) **[INF]**.
7. **Model fit:** `flash-lite` for TIE classification and notes is already the cheapest tier. Moving AI-16/17 to code beats moving them to a smaller model. Script marking on `3.5-flash-lite` is evidence-based **[HIST]**. Narrow structured tasks (AI-18 quick check, AI-19) are well matched to flash-lite.
8. **Cross-border routing:** fallback sends **identical context** to the second provider (verified by the contract test AI-FB-002). Any data minimisation must therefore hold for **both** providers.

---

## 10. Caching and repeated execution

| Candidate | What would be cached | Validity inputs | Learner-specific? | Stale-risk | Verdict |
|---|---|---|---|---|---|
| **AI-02 Career Intelligence report** | Full report JSON | learner id + Projection evidence version (or latest evidence `created_at`) + grade/mode + corpus version | Yes. Store per learner, readable only by owner/parent (existing check) | Low: invalidate on new confirmed evidence | **Recommend persisting.** Today every view regenerates and **re-charges 3 tokens**; the parent gets a different narrative each time |
| AI-07 Reflection | 3 suggestions per `plan_id` | plan content | No (teacher-scoped) | None | Moot if replaced; else cache |
| AI-19 Challenge | Question per (grade, subject, date) | Non-personalised | No | None | If ever re-enabled, generate once per grade/subject/day, not per group |
| AI-18 Quick check | Already persisted in `remedial_actions`, but the route regenerates on each POST | `substrand_health_id` + week | Teacher-scoped | Low | Return the existing row for the same `substrand_health_id` + `week_of` before generating |
| AI-06 generate-week | — | — | — | — | Not caching but **idempotency**: pre-check existing plans like `/api/lesson-plans/generate` already does |
| AI-01, AI-13, AI-14/15, AI-20/22 | — | Learner- or submission-specific, evidence-sensitive | — | — | **Do not cache.** Correctness-sensitive or one-shot |

**Request coalescing / double-submit:**

- Class reports, variants generate-all, SOW, and holiday have no in-flight guard per (user, resource) **[V-SRC]**.
- A double-click creates two background jobs with 2× calls. SOW's free-trial path is the only one with a job-confirmation guard.
- Recommend a partial unique index or a status check on `jobs (type, payload->>resource, status='processing')`.

---

## 11. Privacy and security findings

| ID | Finding | Evidence | Severity |
|---|---|---|---|
| **PR-1** | Compass sends the learner's **first name** (`learn/route.ts:249` → `prompt.ts:228`, `:255`, `:341`), learner free text, the client-supplied history, and the prior model summary (which itself starts with the name) to Gemini, and to DeepSeek (PRC) on fallback | [V-SRC] | **P0**, consistent with the open privacy audit **[HIST]** |
| PR-2 | Pseudonymisation is in place for AI-02, AI-03, and AI-11 (`LEARNER_NAME_TOKEN`), and AI-08/09/10 send no names ✔ | [V-SRC] | Positive |
| PR-3 | Paper Intelligence sends page **images** to Google. Handwritten names or admission numbers on scripts cannot be redacted by prompt design | [INF] | P2: document, consider a capture-time crop/mask guidance |
| PR-4 | Insha essay text (AI-13) leaves to DeepSeek/Gemini by design | [V-SRC] | Accepted product risk; disclose |
| PR-5 | Logs: `holiday/planner.ts:450` `console.error` includes `student_name`; `inshaEvaluator.ts:282` logs the full raw model output. `ai_call_logs` stores 500-char prompt/response, anonymised after 90 days by cron. Whether that cron runs in production is **[UNVERIFIED]** | [V-SRC] | P3 |
| PR-6 | **Prompt injection / forgery:** Compass `conversationHistory` is accepted from the client unvalidated (`learn/route.ts:104, 444`). A client can fabricate prior *assistant* turns to steer the tutor or the session-close eval | [V-SRC] | P2. Mastery stays `pending_review`, which limits blast radius ✔ |
| PR-7 | No server-side provider key exposure; all calls server-only ✔ | [V-SRC] | Positive |

*These are code-level observations. They are not a legal conclusion about compliance with the Kenya Data Protection Act or provider terms.*

---

## 12. Reliability and educational correctness

| Site | Validation present | Gap | Authority risk |
|---|---|---|---|
| AI-01/23 eval block | Parsed with a bare `JSON.parse` cast; mastery gated by pedagogy state and `pending_review` | No schema check; `one_line_summary` undefined → literal "undefined" persisted; the model can set `subject_rest_until` (2-day rest) | Mastery protected ✔; rest/summary not |
| AI-03 | `startDifficulty` clamped | Failed bridge counted `ok` and charged (`autoReportGenerator.ts:370`); `firstConcept` unvalidated against KICD | Overwrites graph-derived targets (D-1) |
| AI-09/10 | Structural + strict verifier + bounded retry; teacher approval | Self-verification by the same model family | Draft-only ✔ |
| AI-16 | Whitelist of codes | The answer is ungrounded (see §6) | Persisted as a diagnosis that feeds remedial planning |
| AI-18 | Shape check | `callGeminiJSON` without fence stripping → spurious failures; regenerates on each POST | Low |
| **AI-19** | Requires question + answer | **Model-authored answer key used for exact-string auto-marking** (`app/api/groups/challenge/route.ts:75`) with no verification. A wrong key marks correct learners wrong | Currently dormant (no schedule). Must add verification before enabling |
| AI-20/22 | Rubric bounds, rejected list, schema (AI-22), `pending_review` evidence; re-mark blocked after review | No timeout | Teacher-verified evidence preserved ✔ |
| AI-14 | Score range | `growth_indicator` not enum-checked; success and failure both logged on shape failure | Low |
| AI-06 | Required fields | `Promise.all` loses sibling plans on one failure | — |
| AI-05 | Validator; curriculum identity reattached server-side | — | ✔ Strong |

**Model output cannot reach access control, permission checks, or confirmed evidence anywhere in the audited paths [V-SRC].**

---

## 13. Observability gaps

**Measurable today:**

- `ai_call_logs` rows for Academy (2), TIE (3), career knowledge, and insha **failures only**.
- Stdout `logger.info('AI call completed', { provider, usage_tokens, latency_ms })` per `callDeepSeek` success, **with no feature, call-site, or user tag**.
- Paper Intelligence returns real token counts in result metadata, and its failures go to `paper_intelligence_failure_log`.
- In-memory registry health, which resets on cold start.

**Not measurable today:**

- calls per workflow;
- tokens by feature;
- retry and fallback frequency (only `logger.warn` lines, untagged);
- cost per successful workflow;
- Compass tokens on the DeepSeek fallback path (explicit known gap);
- the router's (chars/4) estimate, which is never recorded because no caller passes `organization_id`;
- `usage_events` AI rows, never written because `costContext` is never supplied.

**Privacy-conscious instrumentation plan (do not log prompts or completions):**

1. Add `feature` and `callSiteId` (the AI-xx IDs above) as required options on every wrapper, and include them in the existing usage log line along with `provider`, `model`, `prompt_tokens`, `completion_tokens`, `attempt`, `fallback_used`, `outcome`, and a random `correlationId` per logical workflow.
2. Write one aggregate row per provider request to a metrics table (or `ai_call_logs` with `prompt = null`), keyed by `TokenFeature` where one exists. This also fixes F-01.
3. Capture DeepSeek streaming usage via `stream_options.include_usage` (documented gap).
4. A weekly SQL view: calls / workflow, tokens / feature, fallback rate, retry rate, failure category.

---

## 14. Prioritised recommendations

| ID | P | Feature | Location | Current → Proposed | Benefit | Risk | Tests | Measure | Conf. | When |
|---|---|---|---|---|---|---|---|---|---|---|
| **F-01** | **P0** | All capped features | `lib/ai/rateLimit.ts`, `lib/ai/logger.ts`, 11 routes | Caps count rows nobody writes → record a success row per call under the `TokenFeature` key (wrapper-level) and keep "fail open" behaviour explicit | Restores the documented abuse bound | Low; may surface legitimate users hitting caps (review limits) | Per-route test: N+1th call → 429; dev-mode logger currently returns early, so make tests use the repo path | 429 counts / day | High | **Now** |
| **F-02** | **P0** | Compass | `learn/route.ts:249`, `lib/compass/prompt.ts` | First name to providers → `LEARNER_NAME_TOKEN` + stream-safe restore (token may split across chunks; buffer on `{{`) | Removes the direct identifier from cross-border calls | Medium: streaming restore; summary text contains the name | Restore-across-chunk unit test; prompt snapshot asserts no name | Grep prompts in tests | High | Privacy batch, per the privacy audit plan |
| **F-03** | P1 | Class reports | `autoReportGenerator.ts:259, 358-359, 370` | Stop overwriting `session_goal`/`guided_topics`; count a null bridge as `error`; then replace the LLM bridge with the deterministic one | Correct Compass targeting; honest billing; −N calls/run | Medium (UI shape) | Graph values preserved after a run; null bridge → `failed`; no charge when all fail | Run success/fail counts | High | Overwrite + status fix **now**; replacement next |
| **F-04** | P1 | Router | `lib/ai-orchestration/router.ts:85-100` | Each chain entry calls one provider (no nested fallback); fix registry double-recording | Max 6→2 requests/logical call; truthful health | Medium (variant + remedial callers) | Router tests: max requests under each failure mode (none exist today) | Fallback rate, requests/call | High | Next |
| **F-05** | P1 | TIE root cause | `rootCauseClassifier.ts:31-76` | AI branch → `UNKNOWN` (honest) | Removes fabricated diagnoses; −k calls/week | Low (UI may show more UNKNOWN) | Ambiguous row → UNKNOWN, no provider call (mock throws) | `root_cause` distribution | High | **Now** |
| **F-06** | P1 | Lesson plans | `generate-week/route.ts:71`, `weeklyGenerator.ts:108,175` | Pre-check existing week; `Promise.allSettled` + save partial | No paid-then-discarded calls | Low | Second call → no provider call; one failing lesson keeps 4 | generation_jobs failures | High | **Now** |
| **F-07** | P1 | Reflection | `generator.ts:394-485`, route | Deterministic templates primary (or gate + cache per plan) | −1 call per plan opened; no fabricated observations | Low (tone) | No provider call on open; Kiswahili template | — | High | **Now** (confirm tone) |
| **F-08** | P1 | Observability | wrappers | Plan in §13 | Enables every later decision | Low | Wrapper emits tagged usage once per request | — | High | **Now** (before cost work) |
| F-09 | P2 | AI-17 weekly note | `weeklyGenerator.ts:56-112` | Template | −1 call/SOW/week; deterministic | Low | Thresholds snapshot | — | High | With F-05 |
| F-10 | P2 | Career report | `careerIntelligenceEngine.ts`, route | Persist per learner + evidence version; regenerate only on change | Fewer calls; no re-charge; stable narrative | Medium (invalidation) | Same evidence → cached, no charge; new evidence → regenerate | Regenerations / learner | Medium | Next |
| F-11 | P2 | Remedial / Holiday | `remedial/planner.ts:347`, `holiday/planner.ts:434` | Explicit plain-text system prompt | Fewer malformed → null fallbacks | Low | Prompt contract test | Null-enrichment rate | High | Next |
| F-12 | P2 | Wrappers | `deepseek.ts`, `gemini.ts`, paperIntelligence | Abort signals on Gemini; timeouts on `callGemini` + Paper SDK; treat 429/5xx as fallback-eligible (no retry) | Bounded latency; no orphan billing; outage resilience | Medium | Extend contract tests | Timeout/fallback counts | Medium | Next |
| F-13 | P2 | Compass history | `learn/route.ts:104,444` | Server-side history from `compass_messages` | Bounded tokens; no forged turns | Medium | Forged assistant turn ignored | Input tokens/turn | High | Next |
| F-14 | P2 | SOW | `aiLessonGenerator.ts:595,625-631` | Don't request echoed KICD fields when grounded | Output-token reduction on grounded lessons | Low-Med (validator expects fields) | Grounded lesson validates with server-set fields | Completion tokens/lesson | Medium | After F-08 |
| F-15 | P2 | Paper Intelligence | 3 routes | Feature gate + daily cap before trial expansion | Cost bound on multimodal calls | Low | 429 test | Calls/teacher/day | High | Before trial scale-up |
| F-16 | P2 | Friday cron | `friday-generation/route.ts` | Gate speculative LP generation on recent teacher activity; fan out per SOW (queue) instead of one 300s loop | Fewer unused plans; scale | Medium (product decision) | — | Unused plans/week | Medium | Deferred (decision) |
| F-17 | P2 | Variants generate-all | route `:83` | `ALL_TIERS = 3` vs 4 tiers; move to background job; in-flight guard | Correct skip; no request timeouts | Low | 4-tier skip test | — | High | Next |
| F-18 | P2 | Double-submit | class reports, holiday, SOW, variants | In-flight job guard | Prevents 2× runs | Low | Concurrent POST → one job | — | Medium | Next |
| F-19 | P2 | AI-19 | `challengeGenerator.ts` | Keep unscheduled until answer-key verification exists | Prevents wrong auto-marks | — | — | — | Medium | Deferred |
| F-20 | P3 | Deps | `package.json` | Remove `openai`, `ai`, `@ai-sdk/deepseek`, `@ai-sdk/react` (verify with `next build`) | Smaller supply-chain surface | Low | build | — | High | Any time |
| F-21 | P3 | Misc | various | Rename `streamDeepSeek`; drop dead `GEMINI_FALLBACK`/`GEMINI_CONFIG`; enum-check `growth_indicator`; scrub names from logs (PR-5); career GET-triggered generation → POST-only | Clarity, hygiene | Low | — | — | High | Opportunistic |

---

## 15. Cost and latency model

**Measured values:** none. **Provider unit prices:** not verified in this audit. The router's hard-coded `COST_PER_1K_TOKENS` constants are unverified estimates and must not be used as fact.

**Formula per feature:**
`Cost_f = Σ_requests (t_in × P_in[provider] + t_out × P_out[provider])`, with
`requests_f = invocations_f × (1 + r_retry_f) × (1 + r_fallback_f)` (bounded by the maxima in §4).

**Call-volume scenarios (illustrative only).** These are not current usage. Assumptions:

- 1 teacher per 40 learners;
- 1 SOW per teacher per term with 60 slots;
- 60 lesson plans per term;
- 60 reflection opens per term;
- 12 TIE notes and 5 root-cause rows per teacher per term;
- class reports once per term;
- holiday plan 3×/year;
- 1 career report per learner per year;
- Compass 30 turns per learner per month for 10 months;
- retry and fallback rates set to 0.

| Workload / year | 100 learners | 1,000 | 10,000 | 100,000 |
|---|---|---|---|---|
| Compass turns (AI-01) | 30,000 | 300,000 | 3,000,000 | 30,000,000 |
| Teacher-side (AI-05/06/07/16/17, ×3 terms) ≈ 591 per teacher | ≈1,500 | ≈14,800 | ≈148,000 | ≈1,480,000 |
| Learner reports (AI-03 ×3 + AI-11 ×3 + AI-02 ×1) | 700 | 7,000 | 70,000 | 700,000 |

Under these assumptions:

- **Compass ≈ 93% of calls.** Removing AI-03 and AI-07 saves roughly 2–3% of *calls*. Their stronger justification is correctness (F-03, F-07), not cost.
- **Cost ≠ calls.** Compass turns carry a large system prompt plus history but ≤1000 output tokens. SOW lessons carry larger outputs (≤1200) and up to 5 attempts. The token mix has to be measured (F-08) before ranking features by money.
- **Rate-limit pressure:** class reports (sequential N calls in one `after()`), holiday (concurrency 5), SOW (batches of 5), and the Friday cron (sequential over all SOWs) are the burst sources. Latency, not cost, is the scaling wall for the Friday cron at 300s.

**Per-change expected effect (direction only):**

| Change | Requests | Tokens | Latency | Confidence |
|---|---|---|---|---|
| F-01 caps | bounds the tail | — | — | High |
| F-03 | −N per class run | −≈1.1k in per learner (est.) | class run faster | High |
| F-04 | worst case 6→2 | — | worst-case latency ↓ | High |
| F-05/F-09 | −(k+1) per SOW-week | small | cron faster | High |
| F-06 | eliminates discarded batches | — | — | High |
| F-07 | −1 per plan opened | — | instant form | High |
| F-10 | −(views−1) per learner-evidence-version | — | instant re-view | Medium |
| F-14 | 0 | output ↓ on grounded lessons | slight ↓ | Medium |

---

## 16. Regression test plan

Use dependency injection or `mock.module` via `npm test -- <path>`. Make every provider mock **throw on call** where "no call" is the assertion. That converts accidental real calls (the hazard documented in `variantGeneration.ts:37`) into failures.

1. **Cap enforcement (F-01):** for each capped route, a stubbed counter at `limit` → 429 and zero provider calls; a successful call writes exactly one row with the `TokenFeature` key.
2. **Router bounds (F-04):** matrix over {timeout, network, 5xx, 429, malformed} × chain position; assert max requests and the provider labels recorded in the registry.
3. **Deterministic-only paths:** TIE ambiguous row → `UNKNOWN` with a throwing provider mock; weekly-note template snapshot (EN/SW thresholds); reflection templates for each subject branch; class-report run preserves graph-derived `session_goal`/`guided_topics`.
4. **Idempotency:** generate-week twice → second run makes no provider call and returns existing plans; one failing lesson → others saved.
5. **Class-report honesty:** all bridges null → `success = 0`, no charge.
6. **Privacy:** Compass prompt snapshot contains no learner name; stream restore across chunk boundaries (`{{LEA` | `RNER}}`); summary written to the DB contains the restored name only where intended.
7. **Compass history:** forged assistant turn in the request body is ignored once history is server-side.
8. **Fallback / timeouts (F-12):** Gemini hang aborts at the bound (fake timers, as in `deepseekWrapperContract.test.ts:155`); 503 → fallback once.
9. **Educational preservation:** mastery claims remain `pending_review` (existing behaviour); variant verify `review`/`invalid_output` never persists; script marking blocked after review.
10. **Career report cache (F-10):** same evidence version → no provider call and no token deduction; new confirmed evidence → regenerate.

---

## 17. Implementation sequence

1. **Batch 0, measurement (F-08):** tagged usage logging at wrapper level. Ship alone and collect 1–2 weeks of data.
2. **Batch 1, safety and honesty (low risk, no educational regression):** F-01 caps → F-06 generate-week idempotency → F-03 (stop the overwrite + null-is-failure only) → F-05 + F-09 TIE to deterministic → F-07 reflection templates. Each is one small commit with its tests (§16 items 1, 3, 4, 5).
3. **Batch 2, wrapper correctness:** F-04 router, F-12 timeouts/abort/fallback, F-11 explicit system prompts. Contract tests first.
4. **Batch 3, privacy:** F-02 Compass pseudonymisation + F-13 server-side history, coordinated with the open privacy-audit items.
5. **Batch 4, data-driven:** F-10 report persistence, F-14 SOW echo removal, F-15/F-16 gating. Only after Batch 0 data shows where tokens actually go.
6. **Batch 5, replacement:** full removal of the AI-03 LLM bridge in favour of the deterministic bridge (UI shape work).

Per the project's main-branch and CI rules: small commits, `npm test -- <path>`, `next build`, and CI architecture checks before push.

---

## 18. Explicit non-recommendations (calls that should stay)

| Call | Why it stays |
|---|---|
| AI-01 Compass tutor | Open-ended, adaptive explanation and misconception handling is the product's core LLM value. Optimise context (F-13) and privacy (F-02); do not reduce turns |
| AI-05 SOW lessons / AI-06 lesson plans | Generative curriculum-grounded prose; already validated and KICD-anchored. Trim echoes (F-14), keep the call |
| AI-09/AI-10 Variant generate + verify | The verify call is a deliberate quality gate with strict parsing. Removing it to save cost would trade correctness for money |
| AI-13 Insha evaluation | Free-text Kiswahili assessment; no deterministic equivalent; charged only on success |
| AI-14/AI-15 Academy judges | Free-text reflection quality; already gated by deterministic word counts |
| AI-20/21/22 Paper Intelligence | Vision recognition; outputs are proposals that a teacher reviews. Gate cost (F-15), keep the calls |
| AI-12 Slides | Generative teaching content; single call |
| AI-04 Unknown-career drafts | Rare, deduped, capped, human-reviewed: a model of how AI calls should be guarded |
| AI-02 Career narrative | Narrative synthesis for parents with evidence-strength hedging; keep, but persist (F-10) |

---

## 19. Unresolved questions

1. Real call volumes, token mix, and retry/fallback rates per feature. Needs F-08 or provider dashboards.
2. Does DeepSeek bill completions for requests aborted at 25s? Does Gemini bill requests abandoned at the 15s/20s race?
3. Is the `lesson_plans` unique constraint migration applied in production? F-06's "discard" behaviour depends on it. Without it, generate-week would **duplicate** plans instead.
4. Is the `ai-log-retention` cron running in production (earlier crons-dead incident **[HIST]**)?
5. Is `mark-page` (AI-20) still reachable from the UI, or superseded by `mark-script`?
6. Is the study-group challenge cron intentionally unscheduled?
7. Product: do teachers value AI-phrased reflections, holiday messages, and remedial narratives over templates? Needs pilot feedback.
8. Should the Friday cron pre-generate plans for inactive SOWs? (Product decision.)
9. Are the two named single-learner report scripts run against real learner rows? Privacy review before reuse.
10. Compass KICD topic-list length for Grade 9 juniors (grades 7–9 combined): measure per subject.

---

## 20. Final engineering verdict

**Is the current AI-call architecture reasonably efficient?** Mostly yes at the call-site level. Most calls are justified, several are well engineered (Paper Intelligence validation, variant verification, career-knowledge dedup, SOW KICD grounding), and the core learner-intelligence spine is deterministic. **It is not well controlled:** the caps are inert, the router multiplies requests, timeouts are missing on Gemini paths, and there is no per-feature measurement.

**Most important verified inefficiencies:**

- Inert daily caps (F-01).
- Router nested fallback (F-04).
- Class-report LLM duplicating and overwriting deterministic, graph-grounded output (F-03).
- generate-week paying for discarded output (F-06).
- Two TIE calls a template or rule reproduces (F-05, F-09).
- Wasted echoed KICD output in SOW (F-14).

**Remove first:** AI-16 (root-cause AI branch → `UNKNOWN`), AI-17 (weekly note → template), AI-07 (reflection → existing templates), then AI-03 (class-report bridge → deterministic bridge).

**Optimise rather than remove:**

- AI-01 Compass (privacy, server-side history, measure tokens).
- AI-02 (persist).
- AI-05 (drop echoes).
- AI-06 (idempotency, `allSettled`).
- AI-08/AI-11 (explicit system prompt; templates are optional).
- AI-18 (reuse existing row, JSON mime type).
- AI-22 (measure parse-retry cost).

**Must remain:** AI-01, AI-04, AI-05, AI-06, AI-09, AI-10, AI-12, AI-13, AI-14, AI-15, AI-20/21/22.

**Measure before further decisions:** tokens and requests per feature with fallback/retry tags (F-08), Compass input tokens per turn, SOW retry rate, script-marking parse-retry rate.

**Safest first implementation batch:** F-08 (tagged usage logging) + F-01 (make caps real) + F-06 (generate-week pre-check + `allSettled`) + F-05/F-09 (TIE to deterministic) + the two-line F-03 fix (stop the overwrite; null bridge = failure). None of these changes educational behaviour for the worse, each is independently revertible, and each has a crisp no-provider-call test.

---

### Quality gate

| Check | Status |
|---|---|
| All provider integrations examined | ✅ DeepSeek (fetch), Gemini (SDK, 2 models); unused SDKs confirmed unimported |
| All model-call sites have stable IDs | ✅ AI-01…AI-23 (+ offline scripts) |
| Indirect invocations / shared helpers traced | ✅ importer tracing per module; careerEngine's 20 importers reduced to the 1 AI function |
| Multi-stage workflows examined | ✅ variants, SOW, class reports, Friday cron, Compass |
| Retry and fallback paths considered | ✅ §3, §5.3, §9 |
| Canonical learner intelligence traced downstream | ✅ §7 |
| Deterministic replacements evaluated for correctness | ✅ §6 |
| Privacy follows actual payloads | ✅ for text prompts; ⚠ image content (PR-3) only inferred |
| Prompt analysis distinguishes measured vs estimate | ✅ all sizes labelled as source-char estimates |
| Caching includes invalidation and isolation | ✅ §10 |
| Educational correctness and mastery protections examined | ✅ §12 |
| Cost estimates not presented as measurements | ✅ §15 |
| Findings include evidence and locations | ✅ |
| Code and configuration unchanged | ✅ only this report added |
| Working tree not reset or overwritten | ✅ pre-existing changes untouched |
| Coverage limitations stated | ✅ §2, §19 |
