// lib/teacherWorkspace/classListProjectionPure.ts
//
// Pure computation extracted from app/api/teacher/classes/route.ts GET.
// Moved verbatim — same average-of-per-assessment-averages formula, same
// `avgLevel ? round : null` truthy check (not a null check — see the doc
// comment below; this is a pre-existing quirk, deliberately preserved, not
// "improved," per Phase B's extraction rule).

export type ClassListInputRow = Record<string, unknown> & { id: string }

export type ClassListProjectionRow = ClassListInputRow & {
  student_count: number
  avg_level: number | null
}

/**
 * `avg_level` is `null` both when there is genuinely no data AND when the
 * computed average happens to equal exactly `0` — the original route wrote
 * `avgLevel ? Math.round(avgLevel * 10) / 10 : null`, a truthy check, not a
 * null check. A CBC-scale average of `0` is not a realistic value in
 * practice (the scale is 1-4), so this quirk has no observed effect on real
 * data, but it is preserved exactly rather than silently corrected — flagged
 * in the implementation log, not fixed here.
 */
export function computeClassListStats(
  classes: ClassListInputRow[],
  studentLinks: Array<{ class_id: string; student_id: string }>,
  assessments: Array<{ student_id: string; subject_scores: Record<string, number> }>,
): ClassListProjectionRow[] {
  const studentIdsByClass = new Map<string, string[]>()
  for (const link of studentLinks) {
    const list = studentIdsByClass.get(link.class_id) ?? []
    list.push(link.student_id)
    studentIdsByClass.set(link.class_id, list)
  }

  return classes.map(cls => {
    const studentIds = studentIdsByClass.get(cls.id) ?? []
    let avgLevel: number | null = null

    if (studentIds.length > 0) {
      const studentIdSet = new Set(studentIds)
      // Reproduces the original per-class query's `.in(studentIds).order(created_at desc).limit(studentIds.length)`:
      // `assessments` is pre-sorted desc by created_at across the full
      // batch, so filtering to this class's students and taking the first
      // N preserves the same "most recent N assessments among this class's
      // students" semantics the per-class query computed.
      const classAssessments = assessments
        .filter(a => studentIdSet.has(a.student_id))
        .slice(0, studentIds.length)

      if (classAssessments.length > 0) {
        const allAvgs = classAssessments.map(a => {
          const vals = Object.values(a.subject_scores)
          return vals.reduce((s, v) => s + v, 0) / vals.length
        })
        avgLevel = allAvgs.reduce((s, v) => s + v, 0) / allAvgs.length
      }
    }

    return {
      ...cls,
      student_count: studentIds.length,
      avg_level: avgLevel ? Math.round(avgLevel * 10) / 10 : null,
    }
  })
}
