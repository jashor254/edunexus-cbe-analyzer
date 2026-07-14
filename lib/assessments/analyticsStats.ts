// lib/assessments/analyticsStats.ts
//
// Phase D (docs/architecture/academic-evidence-layer.md §8): median and
// mode, additive traditional-analytics statistics. Pure, no I/O — kept in
// its own module (not inline in lib/repositories/assessment.repository.ts,
// which has a module-level `export const assessmentRepository = new
// AssessmentRepository()` singleton that eagerly constructs a Supabase
// client on import) specifically so these are unit-testable without a
// database or env vars, mirroring the pure/orchestration split
// lib/projection/engine.ts (pure) vs recompute.ts (orchestration) already
// establishes elsewhere in this codebase.

export function median(nums: number[]): number {
  if (!nums.length) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const value = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  return Math.round(value * 100) / 100
}

/** Most frequent value. Ties broken by first-seen order — deterministic, not arbitrary Map iteration. */
export function mode<T>(values: T[]): T | null {
  if (!values.length) return null
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: T = values[0]
  let bestCount = 0
  for (const v of values) {
    const c = counts.get(v)!
    if (c > bestCount) { best = v; bestCount = c }
  }
  return best
}

/**
 * Phase D: class-insights holiday-risk classification, averaged across all
 * of a student's assessments — extracted from
 * app/api/teacher/classes/[classId]/insights/route.ts so the logic is
 * testable independent of the route (CLAUDE.md: "API routes are thin —
 * call lib/ functions only, no inline business logic"). Was previously
 * "latest assessment only," which misclassified a student whose most
 * recent check disagreed with their overall record. Still reads the same
 * `assessments` table the route already queried — this does not switch to
 * a different assessment store (that was a separate, larger, explicitly
 * deferred question).
 */
export function computeStudentRiskLevel(
  isRecentlyActive: boolean,
  studentAssessmentScores: Array<Record<string, number>>,
): 'high' | 'medium' | 'low' {
  let avgScore = 2.5
  if (studentAssessmentScores.length > 0) {
    const perAssessmentMeans = studentAssessmentScores
      .map((scores) => {
        const vals = Object.values(scores)
        return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
      })
      .filter((v): v is number => v !== null)
    if (perAssessmentMeans.length > 0) {
      avgScore = perAssessmentMeans.reduce((s, v) => s + v, 0) / perAssessmentMeans.length
    }
  }

  if (!isRecentlyActive && avgScore < 2) return 'high'
  if (!isRecentlyActive || avgScore < 2.5) return 'medium'
  return 'low'
}
