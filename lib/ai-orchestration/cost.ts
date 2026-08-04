// lib/ai-orchestration/cost.ts
// Track AI token usage in usage_events for billing and cost monitoring.
import { repos } from '@/lib/repositories'
import type { ModelProvider } from './types'
import { logger } from '@/lib/observability/logger'

type TrackAICostParams = {
  organization_id: string
  user_id?: string
  provider: ModelProvider
  model: string
  feature?: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_units: number
}

/**
 * Record AI usage in the usage_events table.
 * Always fire-and-forget — never let billing tracking block a response.
 */
export async function trackAICost(params: TrackAICostParams): Promise<void> {
  try {
    await repos.developers.insertAICostEvent({
      organization_id: params.organization_id,
      user_id:         params.user_id ?? null,
      event_type:      'ai.completion',
      resource:        params.feature ?? params.model,
      quantity:        1,
      cost_tokens:     params.total_tokens,
      cost_units:      params.cost_units,
      metadata: {
        provider:          params.provider,
        model:             params.model,
        prompt_tokens:     params.prompt_tokens,
        completion_tokens: params.completion_tokens,
      },
    })
  } catch (err) {
    // Never let cost tracking errors surface to callers/learners — but a
    // silent failure here means this call's cost never reaches usage_events,
    // so at least make it diagnosable server-side.
    logger.warn('AI cost tracking failed', { operation: 'aiOrchestration.trackAICost', organization_id: params.organization_id, feature: params.feature ?? params.model }, err)
  }
}

/**
 * Get AI spending summary for an organization over the last N days.
 */
export async function getAISpendSummary(
  organizationId: string,
  days = 30
): Promise<{
  total_tokens: number
  total_cost_units: number
  by_feature: Record<string, { tokens: number; cost: number; calls: number }>
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const events = await repos.developers.findAICostEvents(organizationId, 'ai.completion', since)
  const total_tokens     = events.reduce((s, e) => s + (e.cost_tokens ?? 0), 0)
  const total_cost_units = events.reduce((s, e) => s + Number(e.cost_units ?? 0), 0)

  const by_feature: Record<string, { tokens: number; cost: number; calls: number }> = {}
  for (const e of events) {
    const key = e.resource ?? 'unknown'
    if (!by_feature[key]) by_feature[key] = { tokens: 0, cost: 0, calls: 0 }
    by_feature[key].tokens += e.cost_tokens ?? 0
    by_feature[key].cost   += Number(e.cost_units ?? 0)
    by_feature[key].calls  += e.quantity ?? 1
  }

  return { total_tokens, total_cost_units, by_feature }
}
