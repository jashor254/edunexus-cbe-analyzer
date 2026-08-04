import { repos } from '@/lib/repositories'
import { logger } from '@/lib/observability/logger'

// In-process cache — warm for same-process invocations.
// Cold starts will miss but now cost 1 DB roundtrip (was 4).
const topicsCache = new Map<string, string[]>()

export async function getGradeTopics(
  grade: number,
  subject: string,
  options?: { minGrade?: number }
): Promise<string[]> {
  const minGrade = options?.minGrade ?? grade
  const cacheKey = `${minGrade}-${grade}-${subject}`
  if (topicsCache.has(cacheKey)) return topicsCache.get(cacheKey)!

  try {
    const results = await repos.compass.getGradeTopics({
      p_min_grade: minGrade,
      p_grade:     grade,
      p_subject:   subject,
    })
    topicsCache.set(cacheKey, results)
    return results
  } catch (err) {
    // [] here is a deliberate resilient fallback (callers treat "no topics"
    // as an unconstrained AI generation, not an error) — but a fetch failure
    // is indistinguishable from a genuinely empty subject/grade without this log.
    logger.warn('getGradeTopics failed, falling back to empty topic list', { operation: 'compass.getGradeTopics', grade, subject }, err)
    return []
  }
}
