// lib/ai/rateLimit.ts
// Rate Limiting System

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type UsageTier = 'free' | 'family' | 'school'

export const RATE_LIMITS = {
  free: {
    careerAnalysis: 3,
    learningPlans: 5,
    chatMessages: 10,
  },
  family: {
    careerAnalysis: 30,
    learningPlans: 50,
    chatMessages: 100,
  },
  school: {
    careerAnalysis: -1,
    learningPlans: -1,
    chatMessages: -1,
  }
}

export async function checkRateLimit(
  userId: string,
  feature: 'careerAnalysis' | 'learningPlans' | 'chatMessages',
  tier: UsageTier = 'free'
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  
  const limit = RATE_LIMITS[tier][feature]
  
  if (limit === -1) {
    return { allowed: true, remaining: -1, limit: -1 }
  }
  
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const { data, error } = await supabase
    .from('ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('feature', feature)
    .gte('created_at', startOfMonth.toISOString())
    .single()
  
  const currentUsage = data?.count || 0
  const remaining = Math.max(0, limit - currentUsage)
  const allowed = remaining > 0
  
  return { allowed, remaining, limit }
}

export async function trackUsage(
  userId: string,
  feature: 'careerAnalysis' | 'learningPlans' | 'chatMessages',
  metadata?: Record<string, any>
): Promise<void> {
  
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const { data: existing } = await supabase
    .from('ai_usage')
    .select('id, count')
    .eq('user_id', userId)
    .eq('feature', feature)
    .gte('created_at', startOfMonth.toISOString())
    .single()
  
  if (existing) {
    await supabase
      .from('ai_usage')
      .update({ 
        count: existing.count + 1,
        last_used_at: new Date().toISOString(),
        metadata
      })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('ai_usage')
      .insert({
        user_id: userId,
        feature,
        count: 1,
        metadata,
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString()
      })
  }
}