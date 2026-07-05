import { repos } from '@/lib/repositories'
import { env } from '@/lib/config/env'

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
  if (env.NODE_ENV === 'development') {
    console.log('[AI_LOG]', {
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
  } catch {
    // Logging must never crash the caller — silently drop the failure.
  }
}
