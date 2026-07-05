// lib/infrastructure/ai.ts
// Resolves AI provider configuration from the environment config.
// Business services call this to get the correct provider and token budget
// without knowing which environment they're running in.

import type { RequestContext } from '@/lib/environment/types'
import type { AIProviderConfig } from '@/lib/environment/types'

export type ResolvedAI = AIProviderConfig & {
  applyMaxTokens: (requested: number) => number
}

/**
 * Returns the AI provider config for this request, plus a helper to
 * apply the environment's token multiplier to any max_tokens value.
 */
export function resolveAIProvider(ctx: RequestContext): ResolvedAI {
  const config = ctx.environmentConfig.ai
  return {
    ...config,
    applyMaxTokens: (requested: number) =>
      Math.ceil(requested * config.maxTokensMultiplier),
  }
}

/**
 * Returns true if AI features are enabled for this environment.
 * Gate AI endpoints with this before calling resolveAIProvider.
 */
export function isAIEnabled(ctx: RequestContext): boolean {
  return ctx.environmentConfig.featureFlags.aiEnabled
}
