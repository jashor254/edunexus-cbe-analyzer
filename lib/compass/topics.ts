import { createServiceClient } from '@/utils/supabase/service'

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
    const db = createServiceClient()
    const { data } = await db.rpc('get_grade_topics', {
      p_min_grade: minGrade,
      p_grade:     grade,
      p_subject:   subject,
    })
    const results = (data ?? []).map((r: { title: string }) => r.title).filter(Boolean) as string[]
    topicsCache.set(cacheKey, results)
    return results
  } catch {
    return []
  }
}
