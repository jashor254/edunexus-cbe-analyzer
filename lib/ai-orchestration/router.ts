// lib/ai-orchestration/router.ts
// Route AI requests to the optimal provider with automatic fallback.
//
// Request budget: each chain entry is ONE provider (callDeepSeekProvider —
// DeepSeek with one transport retry — or callGeminiProvider, one request),
// so a two-entry chain is at most 3 provider requests per routedCompletion().
// Each entry used to call callDeepSeek(), which already carried its own
// DeepSeek-retry-then-Gemini chain, so a 'quality' request could reach 6
// provider requests and the "gemini" entry was really DeepSeek again
// (docs/audits/ai-call-efficiency-deep-audit.md F-04).
import { callDeepSeekProvider, callGeminiProvider, type ProviderCompletion } from '@/lib/ai/deepseek'
import { startLogicalCall, type LogicalCall } from '@/lib/ai/usageTelemetry'
import { getProvider } from './registry'
import { trackAICost } from './cost'
import type { AIRequest, AIResponse, ModelProvider } from './types'

// Provider execution order by mode
const PROVIDER_CHAINS: Record<string, ModelProvider[]> = {
  fast:    ['gemini', 'deepseek'],
  quality: ['deepseek', 'gemini'],
  standard:['gemini', 'deepseek'],
}

// Approximate cost per 1K tokens in USD (for normalized billing units).
// Unverified list-price estimates — not a billing source of truth.
const COST_PER_1K_TOKENS: Record<ModelProvider, number> = {
  gemini:   0.000075,  // $0.075/M tokens (Flash Lite)
  deepseek: 0.00027,   // $0.27/M tokens (DeepSeek-chat)
  openai:   0.005,     // $5/M tokens (GPT-4o, not currently wired)
}

// Same default the router has always inherited from callDeepSeek().
const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful Kenyan CBC tutor. Always respond with valid JSON only — no markdown, no explanation, just the raw JSON.'

/**
 * Execute an AI completion with automatic provider routing and fallback.
 */
export async function routedCompletion(request: AIRequest): Promise<AIResponse> {
  const mode = request.mode ?? 'standard'
  const chain = PROVIDER_CHAINS[mode] ?? PROVIDER_CHAINS.standard
  const call = startLogicalCall({ feature: request.feature, callSite: request.call_site, correlationId: request.correlation_id })

  let lastError: Error | null = null

  for (const provider of chain) {
    const config = getProvider(provider)
    if (config.health === 'down') continue

    const start = Date.now()

    try {
      // Health (recordSuccess/recordError) is recorded by the provider
      // function itself, once per real request, under the real provider.
      const completion = await callProviderCompletion(provider, request, call)
      const latency = Date.now() - start

      const reported = completion.usage.source === 'provider'
      const prompt_tokens     = completion.usage.promptTokens ?? estimateTokens(request.prompt + (request.system ?? ''))
      const completion_tokens = completion.usage.completionTokens ?? estimateTokens(completion.content)
      const total_tokens      = completion.usage.totalTokens ?? prompt_tokens + completion_tokens
      const cost_units        = (total_tokens / 1000) * COST_PER_1K_TOKENS[provider]

      // Track cost asynchronously
      if (request.organization_id) {
        trackAICost({
          organization_id: request.organization_id,
          user_id:         request.user_id,
          provider,
          model:           completion.model,
          feature:         request.feature,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          cost_units,
        }).catch(() => {})
      }

      return {
        text:              completion.content,
        provider,
        model:             completion.model,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        usage_source:      reported ? 'provider' : 'estimated',
        latency_ms:        latency,
        cost_units,
        fallback_used:     provider !== chain[0],
        provider_requests: call.attempts,
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Continue to next provider in chain
    }
  }

  throw new Error(`All AI providers failed. Last error: ${lastError?.message ?? 'unknown'}`)
}

async function callProviderCompletion(
  provider: ModelProvider,
  request: AIRequest,
  call: LogicalCall,
): Promise<ProviderCompletion> {
  const options = {
    temperature: request.temperature ?? 0.7,
    maxTokens:   request.max_tokens ?? 2048,
    history:     request.history ?? [],
  }
  const system = request.system ?? DEFAULT_SYSTEM_PROMPT
  if (provider === 'deepseek') return callDeepSeekProvider(request.prompt, system, options, call)
  if (provider === 'gemini')   return callGeminiProvider(request.prompt, system, options, call)

  throw new Error(`Provider not implemented: ${provider}`)
}

/** Rough token count (~4 chars per token) — used only when the provider reported none. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
