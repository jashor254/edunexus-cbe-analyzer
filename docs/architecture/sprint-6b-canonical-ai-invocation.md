# Sprint 6B — Canonical AI Invocation (Activate the AI Router)

## Implementation, following ADR-0028

**Status: Implemented.** One production AI workflow migrated to `routedCompletion()`. Every audit question the brief required was answered by reading the actual code, not assumed — including one finding that materially changed how the migration was done.

---

## 1. Audit — Why Does `routedCompletion()` Have Zero Callers?

Not because it's broken. Because of what it actually does when called, verified line-by-line:

```ts
async function callProviderCompletion(provider, _model, request) {
  if (provider === 'gemini' || provider === 'deepseek') {
    return callDeepSeek(request.prompt, request.system, { ... })   // ← ALWAYS callDeepSeek
  }
  throw new Error(`Provider not implemented: ${provider}`)
}
```

**Finding, confirmed by reading, not assumed**: `callProviderCompletion` calls `callDeepSeek()` for **both** `'gemini'` and `'deepseek'` chain entries. `callDeepSeek()` itself has its own fixed internal ordering (DeepSeek first, one retry, then Gemini fallback) that the `provider` string passed in cannot override. This means **`PROVIDER_CHAINS.fast = ['gemini', 'deepseek']` and `PROVIDER_CHAINS.quality = ['deepseek', 'gemini']` currently produce identical observable behavior** — the router's headline feature, mode-aware provider selection, does not actually select a provider. This is very likely the real reason nobody adopted it: the one thing it was built to do differently from calling `callDeepSeek()` directly, it doesn't yet do. **Not fixed in this sprint** — fixing `callProviderCompletion`'s dispatch would be redesigning the router, explicitly out of scope. Named here as the honest reason, not silently worked around.

## 2. Audit — Does It Support Every Current Provider?

No — and this reframes the whole 17-site count. Three distinct AI-invocation shapes exist on this platform today, not one:

| Shape | Files | Registry-visible? |
|---|---|---|
| `callDeepSeek()` direct | 10 remaining + 1 migrated (§5) | Yes — `callDeepSeek` itself calls `recordSuccess`/`recordError` |
| `callGemini()`/`callGeminiJSON()` + `logAICall()` (`lib/ai/gemini.ts` + `lib/ai/logger.ts`) | `weeklyGenerator.ts`, `quickCheckGenerator.ts`, `rootCauseClassifier.ts`, `challengeGenerator.ts` — **4 files** | **No** — a wholly separate path, invisible to the registry, invisible to `routedCompletion`, invisible to the platform health/metrics dashboards |
| `streamDeepSeek()` | `app/api/learn/route.ts` (Compass) | Partially (feeds the same registry via its own retry path) but **the router has no streaming method at all** — `AIResponse.text` is always a complete string |

**The router supports exactly one of these three shapes as written.** The direct-Gemini path is a second, previously-undocumented parallel invocation mechanism this audit surfaces for the first time — not named in ADR-0028's original 17-site count as a distinct category. It is explicitly **not migrated** in this sprint (different function signatures, different logging system, `callGeminiJSON`'s structured-output mode has no equivalent in `routedCompletion`) — named in §6 as its own future migration category, not folded into "legacy `callDeepSeek` callers."

## 3. Audit — Telemetry, Cost Tracking, Retry, Timeout, Prompt Logging, Token Accounting

| Concern | `callDeepSeek()` direct (today) | `routedCompletion()` | Verified difference |
|---|---|---|---|
| Provider health telemetry | `recordSuccess`/`recordError` called directly | Same functions, called one layer up | **No difference** — same registry, same data |
| Cost tracking | Opt-in `costContext` param — **confirmed zero current callers ever pass it** (grepped the whole repo) | Calls `trackAICost()` automatically when `organization_id` is supplied | Router's version is real and automatic; the direct-call version exists in code but has never fired in production |
| Retry | One retry on `DeepSeek timeout`/`fetch failed`, then Gemini fallback — all inside `callDeepSeek` | `callProviderCompletion` calls `callDeepSeek` (retry+fallback intact) as chain entry 1; because of §1's finding, chain entry 2 calls the **entire same sequence again** | Net effect: **more resilient, not less** — a full double-retry before final failure, at the cost of extra latency in a genuine dual-outage (rare) |
| Timeout | 25s (DeepSeek), 20s (Gemini non-streaming) — both inside `callDeepSeek`, unchanged by the router | Same — the router adds no timeout of its own | **No difference** |
| Prompt/completion logging | `logger.info('AI call completed', ...)` inside `callDeepSeek`, fires unconditionally | Same call, same log line — because `callProviderCompletion` still calls `callDeepSeek` underneath | **No difference** |
| Token accounting | Real, API-reported `usage.total_tokens` from DeepSeek's response (Gemini fallback path: not captured, documented as a known gap in `deepseek.ts`'s own comments) | `estimateTokens()` — a **`chars/4` heuristic**, not the real count, used for `AIResponse.prompt_tokens/completion_tokens/cost_units` | **Real difference, confirmed**: router-reported token/cost figures are approximate, not exact. Irrelevant to this migration (no `organization_id` supplied, so `trackAICost` never fires — see §5) but a real, load-bearing limitation for any future caller that *does* want accurate billing |
| Model name in telemetry | `DEEPSEEK_CONFIG.model` (`lib/config/api.ts`, hardcoded `'deepseek-chat'`) | `getProvider('deepseek').model` (`registry.ts`, `process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'`) | Same value today by coincidence, not by a shared source of truth — if `DEEPSEEK_MODEL` were ever set to override the default, the router's telemetry would report a model name that doesn't match what `callDeepSeek` actually invoked. A real, currently-benign inaccuracy, named not fixed |

**A fourth piece of never-adopted infrastructure, found in this audit**: `callDeepSeek`'s own `costContext` opt-in parameter has zero real callers, same pattern ADR-0028 already found three times (`routedCompletion`, `kicd_curriculum_lessons`, `kicd_data`/`kicd_subject_data`). And a fifth: `lib/ai-orchestration/templates.ts`'s `registerTemplate`/`getTemplate`/`renderTemplate` — zero callers anywhere in the repository.

## 4. Audit — Streaming Compatibility

**Not compatible, confirmed structurally, not just by absence of a caller.** `routedCompletion()` returns `Promise<AIResponse>` with `text: string` — there is no streaming return type anywhere in `lib/ai-orchestration/`. The one real streaming consumer (`app/api/learn/route.ts`, via `streamDeepSeek`) cannot migrate until the router gains a streaming method — correctly out of this sprint's scope, named explicitly in §6.

---

## 5. Migration Performed — `lib/remedial/planner.ts::enrichWithAI`

**Chosen deliberately, not arbitrarily**, against the brief's own example list (lesson generation, recommendation explanation, quiz/adaptive-assessment generation — all either higher-stakes production content or not yet built): `enrichWithAI` is the lowest-risk live AI call site on the platform — single-shot, non-streaming, no conversation history, already best-effort (wrapped in a try/catch that falls back to `null` — a structured plan with no AI narrative — on any failure, before this migration and after it). Migrating it proves the router without risking a higher-stakes workflow's output quality.

**What changed**: `callDeepSeek(prompt, undefined, { maxTokens: 400, temperature: 0.3 })` → `routedCompletion({ prompt, mode: 'quality', max_tokens: 400, temperature: 0.3, feature: 'remedial.enrich' })`, reading `.text` instead of the bare string return.

**`mode: 'quality'` is the one non-obvious, load-bearing decision**: because of §1's finding, `'quality'`'s first chain entry (`'deepseek'`) produces the **exact same call** this function made directly before migration. `'fast'` was deliberately avoided — its distinguishing "try Gemini first" intent doesn't actually happen today, and using it here would have been misleading about what the migration actually changed.

**`system` left unset** — matching the pre-migration call exactly. The prompt itself asks for "plain English... no markdown," in tension with `callDeepSeek`'s own default system prompt ("Always respond with valid JSON only") — a pre-existing prompt-quality issue, **not fixed here**, per the brief's own framing: this sprint activates the router, it does not make the AI smarter.

**No duplicated invocation logic left behind**: the old `callDeepSeek` call was replaced, not wrapped — there is exactly one AI-invocation call in `enrichWithAI` now, and it is the canonical one.

---

## 6. Remaining Direct AI Call Sites — Documented for Future Incremental Migration

| Category | Files | Why not migrated now |
|---|---|---|
| Streaming (router has no streaming method) | `app/api/learn/route.ts` (Compass, via `streamDeepSeek`) | Requires the router to gain streaming support first — a real feature gap, not a wiring task |
| Direct-Gemini path (bypasses `callDeepSeek` and the registry entirely — found by this audit, not previously documented as its own category) | `lib/teachingIntelligence/weeklyGenerator.ts`, `quickCheckGenerator.ts`, `rootCauseClassifier.ts`, `lib/studyGroups/challengeGenerator.ts` | Different call signature (`callGeminiJSON`), different logging system (`logAICall`, not `logger`/registry) — migrating these means reconciling a second logging mechanism, a larger change than "activate the router" |
| Direct `callDeepSeek()`, single-shot, un-migrated | `lib/academy/aiJudge.ts`, `lib/lessonPlan/generator.ts`, `lib/sow/aiLessonGenerator.ts`, `lib/career/autoReportGenerator.ts`, `lib/career/careerIntelligenceEngine.ts`, `lib/slides/aiSlideGenerator.ts`, `lib/kiswahili/inshaEvaluator.ts`, `lib/holiday/planner.ts`, `lib/career/careerEngine.ts`, `lib/career/matchEngine.ts` | Each is a real candidate for the same `mode: 'quality'` migration pattern proven here — deliberately left for future, incremental, one-at-a-time sprints, per the brief's own "migrate only one, stop" instruction |
| Not a real call site | `lib/utils/cache.ts` | A code comment mentioning a hypothetical `callDeepSeekForCareers` as example usage — confirmed not an actual invocation, corrects the original 17-site count to 16 real sites + this migration |

**10 real, un-migrated `callDeepSeek` call sites remain** — each a candidate for the exact pattern this sprint proved, one at a time, in future sprints.

---

## 7. Tests — Behavioral Compatibility Demonstrated

New file: `lib/remedial/plannerRouterMigration.test.ts` (4 tests, `routedCompletion` mocked via `node:test`'s `mock.module`, the same convention already established in `lib/kiswahili/inshaEvaluator.test.ts`):

- Success path returns the identical parsed week-plan shape as before.
- A `routedCompletion` rejection (both providers failed) falls back to `null` — exactly the same graceful degradation as a direct `callDeepSeek` failure did.
- A too-short/malformed response falls back to `null`.
- **The exact request sent to `routedCompletion` is captured and asserted**: `mode: 'quality'`, `system: undefined`, `max_tokens: 400`, `temperature: 0.3` — proving the migration preserves the original call's parameters precisely, not just its happy-path output.

```
lib/remedial/plannerRouterMigration.test.ts   4 pass, 0 fail
lib/remedial/planner.test.ts (Sprint 6A)      9 pass, 0 fail (unmodified, confirming no regression)
npx tsc --noEmit                              clean
npx eslint lib/remedial/planner.ts lib/remedial/plannerRouterMigration.test.ts   clean
```

---

## 8. Verification Report

**One production AI workflow now uses `routedCompletion()`**: `lib/remedial/planner.ts::enrichWithAI`, confirmed by direct code inspection and by the request-capture test in §7.

**Provider selection**: technically automatic (the router's chain mechanism runs), but §1's finding must be stated plainly here rather than glossed over — the chain's *provider-differentiation* doesn't yet function as designed. This migration's chosen mode (`'quality'`) sidesteps the issue by matching pre-migration behavior exactly; it does not fix it.

**Telemetry**: works, unchanged — same `recordSuccess`/`recordError`/`logger.info` calls fire underneath, because `callProviderCompletion` still calls `callDeepSeek`.

**Cost tracking**: works when `organization_id` is supplied (not the case for this specific migration — `enrichWithAI` has no organization context to pass, matching its behavior before this sprint, where cost tracking never fired either). Confirmed functionally live for any future caller that does have one, with the token-accounting caveat in §3 (estimated, not exact) documented, not hidden.

**Fallback**: works, and is now *more* resilient than before (a full double-retry-and-fallback sequence rather than one), a direct, harmless consequence of §1's finding rather than an intentional design goal.

**Existing output quality**: unchanged — same prompt, same system-prompt default (including its pre-existing tension with the prompt's own instructions, deliberately not fixed), same model call sequence for the success path.

**Existing tests**: all pass, plus 4 new tests where none existed for this specific call before.

**No duplicated AI invocation logic**: confirmed — `enrichWithAI` contains exactly one AI call, the canonical one.

**Does the platform now have one proven, production-ready canonical AI invocation path?** For the one workflow migrated: yes, proven with tests, not asserted. Platform-wide: no, and this document says so explicitly — 10 real `callDeepSeek` call sites, 4 direct-Gemini call sites (a previously undocumented second parallel path this audit surfaced), and 1 streaming call site all remain, each named, each categorized, each left for its own future sprint rather than bundled into this one.
