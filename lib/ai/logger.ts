import { repos } from '@/lib/repositories'
import { logger } from '@/lib/observability/logger'

export interface AICallLog {
  feature: string    // 'sow' | 'lesson-plan' | 'compass' | etc.
  model: string      // 'deepseek-chat'
  prompt: string
  response?: string
  latencyMs: number
  tokenCount?: number
  success: boolean
  error?: string
  userId?: string
}

export async function logAICall(log: AICallLog): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('[AI_LOG]', {
      feature: log.feature,
      model: log.model,
      success: log.success,
      latencyMs: log.latencyMs,
      prompt: log.prompt.substring(0, 200),
      response: log.response?.substring(0, 200),
      error: log.error,
    })
    return
  }

  try {
    await repos.analytics.insertAICallLog(log)
  } catch (err) {
    // Logging must never crash the caller — but a failure here means an AI
    // call's cost/usage silently never reaches ai_call_logs, so at least
    // surface it server-side instead of dropping it entirely.
    logger.error('insertAICallLog failed', { operation: 'ai.logger.logAICall', feature: log.feature, user_id: log.userId }, err)
  }
}
