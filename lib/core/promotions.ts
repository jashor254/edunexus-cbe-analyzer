import { repos } from '@/lib/repositories'
import type { LearnerPromotion, RunPromotionInput } from '@/types/core'

export async function getLearnerPromotionHistory(
  learnerId: string,
  schoolId: string
): Promise<LearnerPromotion[]> {
  return repos.learners.listPromotionHistory(learnerId, schoolId)
}

export async function runAnnualPromotion(
  schoolId: string,
  processedBy: string,
  input: RunPromotionInput
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = []
  let processed = 0

  for (const decision of input.decisions) {
    try {
      const fromClassId = await repos.learners.findActiveEnrollmentClass(
        decision.learner_id,
        input.academic_year_id
      )

      await repos.learners.insertPromotion({
        school_id: schoolId,
        learner_id: decision.learner_id,
        from_class_id: fromClassId,
        to_class_id: decision.to_class_id ?? null,
        from_academic_year_id: input.academic_year_id,
        to_academic_year_id: decision.to_academic_year_id ?? null,
        promotion_type: decision.promotion_type,
        processed_by: processedBy,
        notes: decision.notes ?? null,
      })

      // Update learner status if graduating
      if (decision.promotion_type === 'graduated') {
        await repos.learners.updateStatusById(decision.learner_id, {
          status: 'graduated',
          graduation_date: new Date().toISOString().split('T')[0],
        })
      }

      processed++
    } catch (err) {
      errors.push(`Learner ${decision.learner_id}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return { processed, errors }
}

export async function previewPromotion(
  schoolId: string,
  academicYearId: string
): Promise<Array<{
  learner_id: string
  full_name: string
  admission_number: string
  current_class: string
  grade_name: string
  suggested_action: 'promote' | 'graduate'
}>> {
  const data = await repos.learners.findEnrollmentsByYear(schoolId, academicYearId)

  return data.map((r) => {
    const learner = r.learners as unknown as { first_name: string; middle_name: string | null; last_name: string; admission_number: string }
    const cls = r.classes as unknown as { display_name: string; grades: { name: string; level_order: number } }
    const isGrade9 = cls?.grades?.level_order === 11
    return {
      learner_id: r.learner_id,
      full_name: [learner?.first_name, learner?.middle_name, learner?.last_name].filter(Boolean).join(' '),
      admission_number: learner?.admission_number ?? '',
      current_class: cls?.display_name ?? '',
      grade_name: cls?.grades?.name ?? '',
      suggested_action: isGrade9 ? 'graduate' : 'promote',
    }
  })
}
