import { createServiceClient } from '@/utils/supabase/service'
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
    const db = createServiceClient()
    await db.from('ai_call_logs').insert({
      feature:     log.feature,
      model:       log.model,
      prompt:      log.prompt.substring(0, 500),
      response:    log.response?.substring(0, 500),
      latency_ms:  log.latencyMs,
      token_count: log.tokenCount,
      success:     log.success,
      error:       log.error,
      user_id:     log.userId,
      created_at:  new Date().toISOString(),
    })
  } catch {
    // Logging must never crash the caller — silently drop the failure.
  }
}
