# AI Data-Flow Register

**Date:** 2026-10-17 · **Verified against repo.** Line numbers may drift; re-verify before relying.
Companion to [../audits/learner-data-privacy-deep-audit.md](../audits/learner-data-privacy-deep-audit.md).

This register lists every confirmed outbound path that can carry learner personal data to a party outside the EduNexus application boundary.

## A. External AI providers

| Feature | Source | Provider (actual) | Destination country | Data sent | Direct ID? | Pseudonymized? | Persisted to logs? |
|---|---|---|---|---|---|---|---|
| Learning Compass (chat) | `app/api/learn/route.ts` → `streamDeepSeek` → `lib/compass/prompt.ts` | **Gemini (primary)**, DeepSeek (fallback) | US / **China** | real first name, grade, CBC level, pathway, root-cause topic, failing topic, **raw learner messages** | **Yes** | No | Not via `logAICall` (streaming); errors may log |
| Kiswahili Insha | `lib/kiswahili/inshaEvaluator.ts` → `callDeepSeek` | **DeepSeek**, Gemini (fallback) | **China** / US | **full raw essay**, grade, insha type | Indirect (essays name people) | No | **Yes — `ai_call_logs` 90d** + error logs (`:266/:286`) |
| Academy judge | `lib/academy/aiJudge.ts` → `callDeepSeek` | DeepSeek, Gemini | China / US | learner reflections (tried/worked/failed/surprised/next_action) | Indirect | No | **Yes — `ai_call_logs`** + 8× error logs |
| Career Intelligence | `lib/career/careerIntelligenceEngine.ts` | DeepSeek, Gemini | China / US | grade, pathway, evidence; **name tokenized** | No (tokenized) | **Yes** | Partial (`career/knowledgeRequests`) |
| Career auto-report | `lib/career/autoReportGenerator.ts` | DeepSeek, Gemini | China / US | as above; name tokenized | No | **Yes** | — |
| Holiday planner | `lib/holiday/planner.ts` | DeepSeek, Gemini | China / US | learner gaps; name tokenized | No | **Yes** | — |
| Remedial planner | `lib/remedial/planner.ts` | DeepSeek, Gemini | China / US | marks, concepts; `Student (xxxx)` | No (partial) | **Partial** | — |
| Scheme of Work | `lib/sow/aiLessonGenerator.ts` | DeepSeek, Gemini | China / US | curriculum context (teacher-authored) | Low | No | — |
| Lesson plan | `lib/lessonPlan/generator.ts` | DeepSeek, Gemini | China / US | curriculum context | Low | No | — |
| Slides | `lib/slides/aiSlideGenerator.ts` | DeepSeek, Gemini | China / US | lesson content | Low | No | — |
| Study-group challenge | `lib/studyGroups/challengeGenerator.ts` | DeepSeek, Gemini | China / US | subject/grade | Low | No | — |
| Teaching intelligence (weekly / root-cause / quick-check) | `lib/teachingIntelligence/*.ts` | DeepSeek, Gemini | China / US | class performance, misconceptions | Indirect (class-level) | No | **Yes — `ai_call_logs`** + error logs |
| **Paper Intelligence — script marking** | `lib/paperIntelligence/scriptMarking.ts` | **Gemini only** | US | **raw photographed script images** (`inlineData`), marking scheme | **Yes — image may show name/signature; EXIF/filename unverified** | No | Image not DB-logged; review path TBD |

**Routing:** `lib/ai-orchestration/router.ts` + `registry.ts` wrap provider selection but do **not** enforce minimization/pseudonymization/allowlist. Fallbacks (`deepseek.ts`) carry the identical raw payload to the alternate provider with no re-check.

## B. Other external processors carrying learner PII

| Channel | Source | Provider | Country | Data | Disclosed in policy? |
|---|---|---|---|---|---|
| Report email + PDF | `lib/email/reportEmail.ts`, `lib/resend-client.ts` | **Resend** | US | parent email, student name, **full report PDF** | **No** |
| Report "ready" notice | `lib/whatsapp/reportNotify.ts` | Meta/WhatsApp | US | parent phone, student name | Yes |
| Payments | `lib/payments/*` | Paystack | NG/KE | parent name, email, payment | Yes |
| Database / auth / storage | `utils/supabase/*` | Supabase | EU? `[UNVERIFIED]` | all user + learner data | Yes (region unverified) |
| Hosting / logs | Vercel | Vercel | Global | request logs may include `ai_call_logs` writes & stdout log lines | Partially |

## C. Persistent internal store of learner content (not external, but retention-relevant)
- Table **`ai_call_logs`** — raw `prompt`/`response` (≤500 chars), 90-day anonymization cron. Written by `lib/ai/logger.ts::logAICall`. Contains essays, reflections, teaching-intelligence inputs.

## D. Enforcement gaps (why drift happened)
1. No single egress function — features call `callDeepSeek` / `streamDeepSeek` / Gemini SDK directly.
2. No provider allowlist check at the boundary; fallbacks are unconditional.
3. Pseudonymization is opt-in per feature (3/16 opted in).
4. Content logging is opt-in-to-*avoid* (default is to log `prompt.substring`).
