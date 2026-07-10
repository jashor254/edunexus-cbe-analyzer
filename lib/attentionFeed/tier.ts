import { createServiceClient } from '@/utils/supabase/service'
import { ATTENTION_FEED_TIERS, type AttentionFeedTier } from '@/lib/config/attentionFeedTiers'

export async function getTeacherAttentionTier(teacherId: string): Promise<AttentionFeedTier> {
  const db = createServiceClient()
  const [marksResult, weeksResult] = await Promise.all([
    db.from('learner_marks').select('assessment_id').eq('teacher_id', teacherId),
    db.from('weekly_intelligence').select('week_number').eq('teacher_id', teacherId),
  ])

  const assessmentCount = new Set((marksResult.data ?? []).map((r) => r.assessment_id as string)).size
  const weeksOfSignal    = (weeksResult.data ?? []).length

  if (weeksOfSignal >= ATTENTION_FEED_TIERS.TIER3_MIN_WEEKS_OF_SIGNAL) return 3
  if (
    assessmentCount >= ATTENTION_FEED_TIERS.TIER2_MIN_ASSESSMENTS &&
    weeksOfSignal >= ATTENTION_FEED_TIERS.TIER2_MIN_WEEKS_OF_SIGNAL
  ) return 2
  if (assessmentCount >= ATTENTION_FEED_TIERS.TIER1_MIN_ASSESSMENTS) return 1
  return 0
}
