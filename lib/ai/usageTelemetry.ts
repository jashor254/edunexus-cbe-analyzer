// lib/ai/usageTelemetry.ts
// One structured log line per PROVIDER REQUEST — the measurement layer the
// AI-call audit found missing (docs/audits/ai-call-efficiency-deep-audit.md
// §13, F-08). Before this, the only per-call usage line carried no feature
// name, so spend by feature, retry rate and fallback rate were unknowable.
//
// What is recorded: feature + call site (what the request was for), provider
// + model, which attempt of which logical call it was, outcome, latency, and
// token counts exactly as the provider reported them.
//
// What is never recorded: prompts, completions, learner names, or any
// learner/teacher identifier. Usage the provider did not report is
// `usage_source: 'unavailable'` with null counts — never a guess.
//
// Distinguishes:
//   logical call    — one callDeepSeek()/stream/router invocation (`logical_call_id`)
//   provider request — one line here; `attempt` numbers them within the call
//   retry / fallback — `attempt > 1`; `provider` shows which one answered
// A workflow-level id (e.g. a SOW job) can be threaded via `correlation_id`.
//
// Cost fields: cache-hit / cache-miss tokens and
// reasoning tokens are recorded exactly as the provider reports them. Every
// optional measurement is `null` when the provider did not report it — never
// 0 — so "missing" and "zero" stay distinguishable. `cache_write_tokens` is
// always null today: neither DeepSeek nor the Gemini SDK reports a cache-write
// count, and the log never invents one. `served_model` is the model name the
// provider's RESPONSE says answered (the requested name is `model`); they can
// differ when a legacy alias is remapped.

import { randomUUID } from 'node:crypto'
import { logger } from '@/lib/observability/logger'
import { assertAIFeatureAllowed } from '@/lib/ai/childDataPolicy'

export type AIProviderName = 'deepseek' | 'gemini'

/** Feature label used when a caller has not said what a request is for. Grep for it to find gaps. */
export const UNATTRIBUTED_FEATURE = 'unattributed'

export type ProviderUsage = {
  promptTokens:     number | null
  completionTokens: number | null
  totalTokens:      number | null
  /** Prompt tokens served from the provider's context cache; null = not reported. */
  cacheHitTokens:   number | null
  /** Prompt tokens that missed the cache; null = not reported. */
  cacheMissTokens:  number | null
  /** Tokens written to a cache; null = not reported (no supported provider reports it today). */
  cacheWriteTokens: number | null
  /** Tokens spent on hidden reasoning; null = not reported. */
  reasoningTokens:  number | null
  /** 'provider' = counts came from the provider's response; 'unavailable' = it reported none. */
  source:           'provider' | 'unavailable'
}

export const USAGE_UNAVAILABLE: ProviderUsage = {
  promptTokens: null, completionTokens: null, totalTokens: null,
  cacheHitTokens: null, cacheMissTokens: null, cacheWriteTokens: null, reasoningTokens: null,
  source: 'unavailable',
}

/** What a caller says about the work a request does. */
export type AIAttribution = {
  feature?:       string
  callSite?:      string
  /** Non-personal workflow id (a job or scheme uuid) tying many calls to one bundle. Never a user, learner or teacher id. */
  correlationId?: string
  /**
   * Which attempt of the WORKFLOW's own validation loop this request belongs to
   * (1-based). Distinct from `attempt`, which counts provider requests inside
   * one logical call: a lesson that fails validation makes a new logical call.
   */
  workflowAttempt?: number
}

/** Per-logical-call state shared by every provider request it makes. */
export type LogicalCall = {
  id:            string
  feature:       string
  callSite:      string | null
  correlationId: string | null
  workflowAttempt: number | null
  attempts:      number
}

export function startLogicalCall(attribution?: AIAttribution): LogicalCall {
  // Containment: every provider request path begins here, so a blocked
  // (learner-data) feature throws before any provider function can run.
  assertAIFeatureAllowed(attribution?.feature)
  return {
    id:            randomUUID(),
    feature:       attribution?.feature ?? UNATTRIBUTED_FEATURE,
    callSite:      attribution?.callSite ?? null,
    correlationId: attribution?.correlationId ?? null,
    workflowAttempt: attribution?.workflowAttempt ?? null,
    attempts:      0,
  }
}

export type ProviderErrorKind = 'timeout' | 'network' | 'http' | 'malformed' | 'other'

export function recordProviderRequest(
  call: LogicalCall,
  r: {
    provider:    AIProviderName
    model:       string
    /** The model name in the provider's response, when it reports one. */
    servedModel?: string | null
    outcome:     'success' | 'error'
    latencyMs:   number
    usage?:      ProviderUsage
    errorKind?:  ProviderErrorKind
    httpStatus?: number
    streamed?:   boolean
  },
): void {
  const usage = r.usage ?? USAGE_UNAVAILABLE
  logger.info('AI provider request', {
    service:           'ai.provider',
    feature:           call.feature,
    call_site:         call.callSite,
    correlation_id:    call.correlationId,
    logical_call_id:   call.id,
    attempt:           call.attempts,
    workflow_attempt:  call.workflowAttempt,
    provider:          r.provider,
    model:             r.model,
    served_model:      r.servedModel ?? null,
    outcome:           r.outcome,
    error_kind:        r.errorKind ?? null,
    http_status:       r.httpStatus ?? null,
    streamed:          r.streamed ?? false,
    latency_ms:        r.latencyMs,
    prompt_tokens:     usage.promptTokens,
    completion_tokens: usage.completionTokens,
    total_tokens:      usage.totalTokens,
    cache_hit_tokens:  usage.cacheHitTokens,
    cache_miss_tokens: usage.cacheMissTokens,
    cache_write_tokens: usage.cacheWriteTokens,
    reasoning_tokens:  usage.reasoningTokens,
    usage_source:      usage.source,
  })
}

/** A finite, non-negative number, else null — a provider field that is absent or malformed is "not reported", never 0. */
function reported(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null
}

/** Gemini SDK usageMetadata → ProviderUsage (never invents counts). */
export function geminiUsage(meta: {
  promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number
  cachedContentTokenCount?: number; thoughtsTokenCount?: number
} | undefined): ProviderUsage {
  if (!meta || (meta.promptTokenCount == null && meta.candidatesTokenCount == null && meta.totalTokenCount == null)) {
    return USAGE_UNAVAILABLE
  }
  return {
    promptTokens:     meta.promptTokenCount ?? null,
    completionTokens: meta.candidatesTokenCount ?? null,
    totalTokens:      meta.totalTokenCount ?? null,
    cacheHitTokens:   reported(meta.cachedContentTokenCount),
    cacheMissTokens:  null,
    cacheWriteTokens: null,
    reasoningTokens:  reported(meta.thoughtsTokenCount),
    source:           'provider',
  }
}

/** OpenAI-compatible `usage` as DeepSeek returns it → ProviderUsage. */
export type OpenAIUsageWire = {
  prompt_tokens?: number; completion_tokens?: number; total_tokens?: number
  prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number } | null
  completion_tokens_details?: { reasoning_tokens?: number } | null
}

export function openAIUsage(u: OpenAIUsageWire | undefined | null): ProviderUsage {
  if (!u || (u.prompt_tokens == null && u.completion_tokens == null && u.total_tokens == null)) {
    return USAGE_UNAVAILABLE
  }
  return {
    promptTokens:     u.prompt_tokens ?? null,
    completionTokens: u.completion_tokens ?? null,
    totalTokens:      u.total_tokens ?? null,
    // DeepSeek documents prompt_cache_hit_tokens and prompt_tokens_details.cached_tokens as the same quantity.
    cacheHitTokens:   reported(u.prompt_cache_hit_tokens) ?? reported(u.prompt_tokens_details?.cached_tokens),
    cacheMissTokens:  reported(u.prompt_cache_miss_tokens),
    cacheWriteTokens: null,
    reasoningTokens:  reported(u.completion_tokens_details?.reasoning_tokens),
    source:           'provider',
  }
}
