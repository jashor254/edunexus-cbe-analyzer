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

import { randomUUID } from 'node:crypto'
import { logger } from '@/lib/observability/logger'

export type AIProviderName = 'deepseek' | 'gemini'

/** Feature label used when a caller has not said what a request is for. Grep for it to find gaps. */
export const UNATTRIBUTED_FEATURE = 'unattributed'

export type ProviderUsage = {
  promptTokens:     number | null
  completionTokens: number | null
  totalTokens:      number | null
  /** 'provider' = counts came from the provider's response; 'unavailable' = it reported none. */
  source:           'provider' | 'unavailable'
}

export const USAGE_UNAVAILABLE: ProviderUsage = {
  promptTokens: null, completionTokens: null, totalTokens: null, source: 'unavailable',
}

/** What a caller says about the work a request does. */
export type AIAttribution = {
  feature?:       string
  callSite?:      string
  correlationId?: string
}

/** Per-logical-call state shared by every provider request it makes. */
export type LogicalCall = {
  id:            string
  feature:       string
  callSite:      string | null
  correlationId: string | null
  attempts:      number
}

export function startLogicalCall(attribution?: AIAttribution): LogicalCall {
  return {
    id:            randomUUID(),
    feature:       attribution?.feature ?? UNATTRIBUTED_FEATURE,
    callSite:      attribution?.callSite ?? null,
    correlationId: attribution?.correlationId ?? null,
    attempts:      0,
  }
}

export type ProviderErrorKind = 'timeout' | 'network' | 'http' | 'malformed' | 'other'

export function recordProviderRequest(
  call: LogicalCall,
  r: {
    provider:    AIProviderName
    model:       string
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
    provider:          r.provider,
    model:             r.model,
    outcome:           r.outcome,
    error_kind:        r.errorKind ?? null,
    http_status:       r.httpStatus ?? null,
    streamed:          r.streamed ?? false,
    latency_ms:        r.latencyMs,
    prompt_tokens:     usage.promptTokens,
    completion_tokens: usage.completionTokens,
    total_tokens:      usage.totalTokens,
    usage_source:      usage.source,
  })
}

/** Gemini SDK usageMetadata → ProviderUsage (never invents counts). */
export function geminiUsage(meta: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined): ProviderUsage {
  if (!meta || (meta.promptTokenCount == null && meta.candidatesTokenCount == null && meta.totalTokenCount == null)) {
    return USAGE_UNAVAILABLE
  }
  return {
    promptTokens:     meta.promptTokenCount ?? null,
    completionTokens: meta.candidatesTokenCount ?? null,
    totalTokens:      meta.totalTokenCount ?? null,
    source:           'provider',
  }
}

/** OpenAI-compatible `usage` (DeepSeek) → ProviderUsage. */
export function openAIUsage(u: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined | null): ProviderUsage {
  if (!u || (u.prompt_tokens == null && u.completion_tokens == null && u.total_tokens == null)) {
    return USAGE_UNAVAILABLE
  }
  return {
    promptTokens:     u.prompt_tokens ?? null,
    completionTokens: u.completion_tokens ?? null,
    totalTokens:      u.total_tokens ?? null,
    source:           'provider',
  }
}
