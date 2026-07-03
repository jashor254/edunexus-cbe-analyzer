import { repos } from '@/lib/repositories'

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
  } catch {
    return []
  }
}
