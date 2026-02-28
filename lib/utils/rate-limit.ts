// lib/utils/rate-limit.ts
// ✅ Add this check before EVERY AI call
// ✅ Protects your DeepSeek API costs
// ✅ Simple, no Redis needed - uses Supabase

import { createClient } from '@/utils/supabase/server'
import { RATE_LIMITS } from '@/lib/config/api'

// ============================================================
// CHECK AI RATE LIMIT
// ============================================================

export async function checkAIRateLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: string
}> {
  const supabase = await createClient()

  // Get today's AI calls for this user
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('ai_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', today.toISOString())

  const callsToday = count || 0
  const remaining = Math.max(0, RATE_LIMITS.AI_CALLS_PER_DAY - callsToday)

  // Reset time = midnight tonight
  const resetAt = new Date()
  resetAt.setHours(24, 0, 0, 0)

  return {
    allowed: callsToday < RATE_LIMITS.AI_CALLS_PER_DAY,
    remaining,
    resetAt: resetAt.toISOString()
  }
}

// ============================================================
// LOG AI USAGE
// ============================================================

export async function logAIUsage(
  userId: string,
  type: 'career_analysis' | 'guardian_tutor' | 'learning_plan'
) {
  const supabase = await createClient()

  await supabase
    .from('ai_usage_logs')
    .insert({
      user_id: userId,
      usage_type: type,
      created_at: new Date().toISOString()
    })
}

// ============================================================
// HOW TO USE IN YOUR AI ROUTES:
// ============================================================

/*
// In app/api/ai/career/route.ts:

import { checkAIRateLimit, logAIUsage } from '@/lib/utils/rate-limit'

export async function POST(request: NextRequest) {
  const { userId } = await getAuthUser(request)

  // ✅ Check rate limit FIRST
  const { allowed, remaining } = await checkAIRateLimit(userId)

  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Daily AI limit reached',
        message: 'You have used all your AI calls for today. Come back tomorrow!',
        upgradeUrl: '/pricing'
      },
      { status: 429 }
    )
  }

  // ✅ Do the AI call
  const result = await callDeepSeek(...)

  // ✅ Log usage after successful call
  await logAIUsage(userId, 'career_analysis')

  return NextResponse.json(result)
}
*/

// ============================================================
// SQL TO CREATE ai_usage_logs TABLE
// ============================================================

/*
Run this in Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_ai_usage_user_date 
ON ai_usage_logs(user_id, created_at);

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Only user can see their own logs
CREATE POLICY "Users view own AI logs"
  ON ai_usage_logs FOR SELECT
  USING (auth.uid() = user_id);
*/