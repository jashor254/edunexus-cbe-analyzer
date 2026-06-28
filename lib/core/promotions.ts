import { createServiceClient } from '@/utils/supabase/service'
import type { LearnerPromotion, RunPromotionInput } from '@/types/core'

const PROMOTION_COLS = 'id, school_id, learner_id, from_class_id, to_class_id, from_academic_year_id, to_academic_year_id, promotion_type, processed_by, notes, promoted_at, created_at, updated_at'

export async function getLearnerPromotionHistory(
  learnerId: string,
  schoolId: string
): Promise<LearnerPromotion[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('learner_promotions')
    .select(PROMOTION_COLS)
    .eq('learner_id', learnerId)
    .eq('school_id', schoolId)
    .order('promoted_at', { ascending: false })
  if (error) throw new Error(`getLearnerPromotionHistory: ${error.message}`)
  return data
}

export async function runAnnualPromotion(
  schoolId: string,
  processedBy: string,
  input: RunPromotionInput
): Promise<{ processed: number; errors: string[] }> {
  const supabase = createServiceClient()
  const errors: string[] = []
  let processed = 0

  for (const decision of input.decisions) {
    try {
      // 1. Record the promotion decision
      const { error: promErr } = await supabase.from('learner_promotions').insert({
        school_id: schoolId,
        learner_id: decision.learner_id,
        from_class_id: await resolveCurrentClass(decision.learner_id, input.academic_year_id),
        to_class_id: decision.to_class_id ?? null,
        from_academic_year_id: input.academic_year_id,
        to_academic_year_id: decision.to_academic_year_id ?? null,
        promotion_type: decision.promotion_type,
        processed_by: processedBy,
        notes: decision.notes ?? null,
      })
      if (promErr) throw new Error(promErr.message)

      // 2. Update learner status if graduating
      if (decision.promotion_type === 'graduated') {
        await supabase
          .from('learners')
          .update({ status: 'graduated', graduation_date: new Date().toISOString().split('T')[0] })
          .eq('id', decision.learner_id)
          .eq('school_id', schoolId)
      }

      processed++
    } catch (err) {
      errors.push(`Learner ${decision.learner_id}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return { processed, errors }
}

async function resolveCurrentClass(learnerId: string, academicYearId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('learner_enrollments')
    .select('class_id')
    .eq('learner_id', learnerId)
    .eq('academic_year_id', academicYearId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (!data) throw new Error(`No active enrollment found for learner ${learnerId}`)
  return data.class_id
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
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('learner_enrollments')
    .select(`
      learner_id,
      class_id,
      learners (id, first_name, middle_name, last_name, admission_number),
      classes (id, display_name, grade_id, grades (name, code, level_order))
    `)
    .eq('school_id', schoolId)
    .eq('academic_year_id', academicYearId)
    .eq('status', 'active')

  if (error) throw new Error(`previewPromotion: ${error.message}`)

  return (data ?? []).map((r) => {
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
