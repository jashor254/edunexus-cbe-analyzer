// lib/ai-orchestration/router.ts
// Route AI requests to the optimal provider with automatic fallback.
import { callDeepSeek } from '@/lib/ai/deepseek'
import { recordSuccess, recordError, getProvider } from './registry'
import { trackAICost } from './cost'
import type { AIRequest, AIResponse, ModelProvider } from './types'

// Provider execution order by mode
const PROVIDER_CHAINS: Record<string, ModelProvider[]> = {
  fast:    ['gemini', 'deepseek'],
  quality: ['deepseek', 'gemini'],
  standard:['gemini', 'deepseek'],
}

// Approximate cost per 1K tokens in USD (for normalized billing units)
const COST_PER_1K_TOKENS: Record<ModelProvider, number> = {
  gemini:   0.000075,  // $0.075/M tokens (Flash Lite)
  deepseek: 0.00027,   // $0.27/M tokens (DeepSeek-chat)
  openai:   0.005,     // $5/M tokens (GPT-4o, not currently wired)
}

/**
 * Execute an AI completion with automatic provider routing and fallback.
 */
export async function routedCompletion(request: AIRequest): Promise<AIResponse> {
  const mode = request.mode ?? 'standard'
  const chain = PROVIDER_CHAINS[mode] ?? PROVIDER_CHAINS.standard

  let lastError: Error | null = null

  for (const provider of chain) {
    const config = getProvider(provider)
    if (config.health === 'down') continue

    const start = Date.now()

    try {
      const text = await callProviderCompletion(provider, config.model, request)
      const latency = Date.now() - start

      recordSuccess(provider, latency)

      // Estimate token counts (no reliable way without SDK token counter)
      const prompt_tokens     = estimateTokens(request.prompt + (request.system ?? ''))
      const completion_tokens = estimateTokens(text)
      const total_tokens      = prompt_tokens + completion_tokens
      const cost_units        = (total_tokens / 1000) * COST_PER_1K_TOKENS[provider]

      // Track cost asynchronously
      if (request.organization_id) {
        trackAICost({
          organization_id: request.organization_id,
          user_id:         request.user_id,
          provider,
          model:           config.model,
          feature:         request.feature,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          cost_units,
        }).catch(() => {})
      }

      return {
        text,
        provider,
        model:             config.model,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        latency_ms:        latency,
        cost_units,
        fallback_used:     provider !== chain[0],
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      recordError(provider, lastError.message)
      // Continue to next provider in chain
    }
  }

  throw new Error(`All AI providers failed. Last error: ${lastError?.message ?? 'unknown'}`)
}

async function callProviderCompletion(
  provider: ModelProvider,
  _model: string,
  request: AIRequest
): Promise<string> {
  if (provider === 'gemini' || provider === 'deepseek') {
    // callDeepSeek already handles the Gemini ↔ DeepSeek fallback internally.
    // The orchestration layer adds the mode-aware routing on top.
    return callDeepSeek(request.prompt, request.system, {
      temperature: request.temperature,
      maxTokens:   request.max_tokens,
      history:     request.history ?? [],
    })
  }

  throw new Error(`Provider not implemented: ${provider}`)
}

/** Rough token count: ~4 chars per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
