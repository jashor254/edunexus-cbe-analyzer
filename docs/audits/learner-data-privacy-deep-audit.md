# Learner Data Privacy — Deep Audit

**Date:** 2026-10-17
**Scope:** Every outbound path that can carry learner personal data out of EduNexus, verified against the repository (not against the prior report).
**Status:** Audit complete. **No code changed in this pass** — remediation is staged in [`learner-data-privacy-remediation-plan.md`](./learner-data-privacy-remediation-plan.md) and awaits approval.
**Method:** Each claim below was traced to source file + line and the calling chain confirmed. Evidence is cited inline. External facts (vendor contracts, data residency, ODPC status) are explicitly marked `[UNVERIFIED — owner action]` and are **not** asserted from code.

---

## 1. Executive verdict

EduNexus **can** send learner data safely, but **today it does not**, and the published privacy policy materially misstates where data goes. The learner-protection mechanism that exists (`learnerPseudonym.ts`) is sound but is wired into only **3 of 16** AI call sites. The dominant risks are **cross-border transfer to China and the US that is undisclosed or misdescribed**, **raw children's content (essays, tutoring chat, exam-script photos) leaving the app**, and **a 90-day in-database store of raw prompts**.

Verdict: **Not defensible for a new school onboarding in its current state.** The blocking items are containable with staged, reversible code changes plus three owner/vendor verifications. See the go/no-go checklist in the remediation plan.

---

## 2. Verified findings (independent verification of the prior report)

Legend — **Confidence:** Confirmed (traced in code) / Needs-external (cannot be proven from code).

| # | Prior claim | Verdict | Evidence |
|---|-------------|---------|----------|
| 1 | `lib/config/api.ts` configures `https://api.deepseek.com` | **CONFIRMED** | [lib/config/api.ts:21](../../lib/config/api.ts) `baseURL: 'https://api.deepseek.com'`. This is DeepSeek's first-party API (PRC-operated), **not** Together AI. |
| 2 | DeepSeek impl sends learner info to that endpoint | **CONFIRMED** | [lib/ai/deepseek.ts:45](../../lib/ai/deepseek.ts) and `:247` POST `${baseURL}/v1/chat/completions` with system+history+user messages built from learner content. |
| 3 | `deepseek.ts` tries **Gemini before DeepSeek** for Compass streaming | **CONFIRMED** | [lib/ai/deepseek.ts:396-413](../../lib/ai/deepseek.ts) `streamDeepSeek()` calls `streamGeminiFallback()` first; DeepSeek is the *fallback*. The function name is misleading — Gemini is primary for streaming. |
| 4 | `callDeepSeek` uses Gemini as a fallback | **CONFIRMED** | [lib/ai/deepseek.ts:199-210](../../lib/ai/deepseek.ts) after DeepSeek retry fails, `callGeminiNonStreaming()` is invoked. |
| 5 | Paper Intelligence uses Gemini for script marking | **CONFIRMED** | [lib/ai/models.ts:13](../../lib/ai/models.ts) `GEMINI_SCRIPT_MARKING = 'gemini-3.5-flash-lite'`; used in `scriptMarking.ts`. Gemini is the **only** provider for this feature (no DeepSeek path). |
| 6 | `scriptMarking.ts` transmits raw page images via inline image data | **CONFIRMED** | [lib/paperIntelligence/scriptMarking.ts:146](../../lib/paperIntelligence/scriptMarking.ts) `{ inlineData: { mimeType, data: p.imageBase64 } }`. Prompt instructs "Transcribe EVERY line the learner wrote" ([scriptMarkingPrompt.ts:38](../../lib/paperIntelligence/scriptMarkingPrompt.ts)). |
| 7 | `app/api/learn/route.ts` puts real name/weakness/root-cause/grade/pathway/raw messages in prompts | **CONFIRMED** | [app/api/learn/route.ts:249](../../app/api/learn/route.ts) `firstName` from `student.name`; passed to `buildCompassPrompt` (`:442`). Emitted at [lib/compass/prompt.ts:228](../../lib/compass/prompt.ts) (`${p.firstName} | Grade ${p.grade} | ... Pathway: ${p.pathway}`) and `:341` (name + rootCauseTopic + failingTopic). Raw learner `message` is the streamed user turn (`:462`). |
| 8 | `inshaEvaluator.ts` transmits raw essays | **CONFIRMED** | [lib/kiswahili/inshaEvaluator.ts](../../lib/kiswahili/inshaEvaluator.ts) `buildPrompt()` embeds `${insha.trim()}` verbatim; sent via `callDeepSeek` (`:256`). No pseudonymization. Essays are personal narratives → high indirect-ID risk. |
| 9 | Other lesson/SOW/slides/study-group/academy/teaching-intelligence features transmit learner-identifiable content | **CONFIRMED (partial)** | Call sites: `lib/academy/aiJudge.ts`, `lib/sow/aiLessonGenerator.ts`, `lib/lessonPlan/generator.ts`, `lib/slides/aiSlideGenerator.ts`, `lib/studyGroups/challengeGenerator.ts`, `lib/teachingIntelligence/{weeklyGenerator,rootCauseClassifier,quickCheckGenerator}.ts`. None import `learnerPseudonym`. Academy judge sends learner free-text reflections (`tried/worked/failed/surprised/next_action`). Per-site identifier inventory in [ai-data-flow-register.md](../security/ai-data-flow-register.md). |
| 10 | `learnerPseudonym.ts` used only at a subset of call sites | **CONFIRMED** | Importers (non-test): `lib/holiday/planner.ts`, `lib/career/autoReportGenerator.ts`, `lib/career/careerIntelligenceEngine.ts`. **3 of 16** AI call sites. |
| 11 | Career & holiday modules already pseudonymize | **CONFIRMED & sound** | [lib/career/careerIntelligenceEngine.ts:484](../../lib/career/careerIntelligenceEngine.ts) sets `firstName = LEARNER_NAME_TOKEN`, builds prompt with the token, restores real name locally via `restoreLearnerName(..., learnerFirstName(studentName))` (`:557`). This is the correct pattern to generalize. **Caveat:** only the *name* is tokenized; grade/pathway/evidence still sent (acceptable for these reports, but note it). |
| 12 | Logging/error handling can expose prompts/responses/images | **CONFIRMED — and worse than reported** | Two separate exposures: **(a)** content-bearing error logs: `prompt.substring(0,500)` in `aiJudge.ts` (×8), `inshaEvaluator.ts:266/286`, `rootCauseClassifier.ts:69`, `weeklyGenerator.ts:102`. **(b)** a **persistent DB store**: `logAICall()` → [analytics.repository.ts `insertAICallLog`](../../lib/repositories/analytics.repository.ts) writes `prompt`/`response` (first 500 chars) into table `ai_call_logs` in production, anonymised only after **90 days** by [app/api/cron/ai-log-retention/route.ts](../../app/api/cron/ai-log-retention/route.ts). Callers include `inshaEvaluator`, `aiJudge`, teaching-intelligence, `career/knowledgeRequests`. So raw essay/reflection text sits in the DB for up to 90 days. |

### New findings not in the prior report

| # | Finding | Severity | Evidence |
|---|---------|----------|----------|
| N1 | **`ai_call_logs` persists raw learner prompt + response for 90 days** | High | See #12(b). A parallel store of children's free-text content, distinct from the immutable evidence layer, inside the DB. |
| N2 | **Resend (email, US) is an undisclosed processor** carrying full learner reports | High | [lib/resend-client.ts](../../lib/resend-client.ts), [lib/email/reportEmail.ts](../../lib/email/reportEmail.ts) send `studentName` + Learner Intelligence Report **PDF attachment** to parents. Resend is **not** in the privacy policy processor/cross-border tables. Reply-to is a **personal Gmail** (`kariukidennis092@gmail.com`) — not a controlled data-controller channel. |
| N3 | **Function naming hides provider reality** | Medium | `streamDeepSeek()` actually calls Gemini first; `GEMINI_CONFIG.isConfigured → false` in `api.ts` while Gemini is in fact the primary streaming + script-marking provider. Dangerous for future maintainers reasoning about data flow. |
| N4 | **No central AI egress boundary** | Medium (systemic) | Each feature builds its own prompt and calls `callDeepSeek`/`streamDeepSeek`/Gemini SDK directly. There is no single chokepoint enforcing minimization, pseudonymization, provider allowlist, or safe logging. This is why 13/16 sites drifted. |

---

## 3. Threat model (Phase 2)

**Assets:** children's names, grade/class/school, CBC performance levels, misconceptions/root-cause, career/pathway, free-text tutoring conversations, Kiswahili essays, photographed exam scripts, parent phone/email, guardian national ID (Core), special-needs data (DPA s.46 sensitive).

| Threat | Present today? | Where |
|--------|----------------|-------|
| Direct identification (name) sent to external AI | **Yes** | Compass (name+grade+pathway), all non-pseudonymized sites |
| Indirect identification (free text / essays / combinations) | **Yes** | Insha essays, Compass chat, academy reflections |
| Identifying marks in images (name on script, signature, EXIF, filename) | **Yes, uninspected** | Paper Intelligence — images sent raw; no redaction, metadata not stripped `[UNVERIFIED whether EXIF/filenames leave]` |
| Prompt injection inside learner submissions | **Yes, unmitigated** | Any free-text → AI path; outputs are validated for *shape* (scriptValidation) but injection into instructions not specifically defended |
| Provider fallback bypassing privacy intent | **Yes** | Gemini→DeepSeek(China) streaming fallback; DeepSeek→Gemini non-streaming fallback — both carry the same raw payload, neither re-checks an allowlist |
| Sensitive content in logs / parallel store | **Yes** | `ai_call_logs` (90d), error logs with `prompt.substring` |
| Cross-tenant / unauthorized retrieval | Not found in this pass | RLS + service-role boundaries appear intact; not the focus here |
| Over-retention of learner content | **Yes** | 90-day raw prompt store |
| Debug/test routes in prod | **None found** | `find app/api -name 'test-*'` → empty (good) |

### Data classification applied
- **Identified personal data:** Compass prompts (name), report emails, WhatsApp (parent phone + student name), `ai_call_logs` prompts, script images.
- **Pseudonymized:** career + holiday report prompts (name tokenized; still carries grade/evidence → *pseudonymized, not anonymous*).
- **Effectively anonymized:** none claimed. (Name removal alone ≠ anonymous — essays/chat remain identifying.)
- **Non-personal technical metadata:** token counts, latency, feature name, model id — safe to log.

---

## 4. Policy discrepancy matrix (Phase 7)

Classifications: **(1)** supported · **(2)** contradicted · **(3)** unverified · **(4)** legal interpretation · **(5)** needs code · **(6)** needs operational/contractual action.

| Policy claim ([privacy/page.tsx](../../app/(marketing)/legal/privacy/page.tsx)) | Reality | Class |
|---|---|---|
| "DeepSeek AI (accessed via **Together AI**) … **United States**" (§7, §8) | Code calls `api.deepseek.com` directly (PRC). Together AI not used anywhere. | **2, 5, 6** |
| Cross-border table omits **China** entirely (§9) | Primary text-AI destination is China. | **2, 6** |
| **Gemini/Google absent** from processor & transfer tables (§8, §9) | Gemini is primary streaming + sole script-marking provider (US). | **2, 6** |
| **Resend** absent from processor table (§8) | Resend emails full reports + PDFs to parents (US). | **2, 6** |
| "Your data is **NOT used to train** DeepSeek or any external AI model" (§4, §7) | Depends on DeepSeek/Gemini API tier terms; not provable from code; standard tiers often allow training/retention. | **3, 6** |
| "Supabase … **EU (Frankfurt)/Germany** … GDPR Protected" (§8, §9) | Region not derivable from code/MCP. Must be confirmed in dashboard. | **3, 6** |
| "Together AI processes data under a **DPA** … may not retain/reuse" (§7) | Vendor not used; no evidence of any signed DPA with actual vendors. | **2, 3, 6** |
| "72-hour ODPC breach notice", "quarterly audits" (§6, §11) | Operational commitments; no code/process evidence. | **3, 6** |
| "Essential cookies only; no third-party analytics" (§14) | Not contradicted in this pass `[spot-check only]`. | **1/3** |
| ODPC registration of Jashor Technologies as controller/processor | Not evidenced anywhere in repo. Likely required. | **3, 6** (legal) |

**Rule honored:** no policy text was edited in this pass. A draft revision is deferred until vendor facts (§6 items) are confirmed, so the policy is not updated with invented safeguards.

---

## 5. What is genuinely sound (do not regress)
- `learnerPseudonym.ts` token-swap design and its use in career/holiday reports.
- Remedial planner pseudonymizes to `Student (xxxx)` ([planner.ts:143](../../lib/remedial/planner.ts)).
- WhatsApp is minimal and scoped to the parent's own number ([reportNotify.ts](../../lib/whatsapp/reportNotify.ts)).
- No debug/test routes in production.
- `ai_call_logs` retention cron exists and auth-gates on `CRON_SECRET` (the mechanism is right; the 90-day window and raw-by-default capture are the issue).
- Structured logger strips stack traces in prod ([logger.ts:70](../../lib/observability/logger.ts)).

---

## 6. Deliverables produced in this pass
- This audit.
- [ai-data-flow-register.md](../security/ai-data-flow-register.md) — per-call-site outbound inventory.
- [vendor-verification-register.md](../security/vendor-verification-register.md) — vendor matrix + owner actions.
- [learner-data-privacy-remediation-plan.md](./learner-data-privacy-remediation-plan.md) — staged, reversible plan + go/no-go.

Deferred (next stage, require approval / external facts): privacy-policy redraft, regression-test report, and the code changes themselves.
