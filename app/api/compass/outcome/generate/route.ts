import { generateLessonOutcome } from '@/lib/compass/outcomeGenerator'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError } from '@/lib/api/response'
import { checkFeatureAccess } from '@/lib/payments/access'

export async function POST(req: Request): Promise<Response> {
  try {
    const access = await checkFeatureAccess('learning_compass')
    if (access.allowed === false) {
      const status = access.reason === 'unauthenticated' ? 401 : 403
      return apiError(access.reason, status)
    }

    const body = await req.json() as {
      concept:   string
      substrand: string
      subject:   string
      studentId: string
    }
    const { concept, substrand, subject, studentId } = body

    if (!concept || !subject || !studentId) {
      return apiError('concept, subject, and studentId are required', 400)
    }

    const db = createServiceClient()

    const [{ data: student }, { data: context }] = await Promise.all([
      db.from('students')
        .select('id, grade, curriculum_type')
        .eq('id', studentId)
        .eq('user_id', access.userId)
        .maybeSingle(),
      db.from('student_learning_context')
        .select('overall_level, subject_tiers')
        .eq('student_id', studentId)
        .maybeSingle(),
    ])

    if (!student) return apiError('Student not found', 404)

    const subjectTiers   = (context?.subject_tiers ?? {}) as Record<string, number>
    const currentLevel   = subjectTiers[subject] ?? (context?.overall_level as number | null) ?? 2

    // Archive any existing in-progress outcome
    await db
      .from('compass_outcomes')
      .update({ status: 'consolidated', updated_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('status', 'in_progress')

    const outcome = await generateLessonOutcome(
      subject,
      concept,
      substrand || concept,
      student.grade as number,
      currentLevel,
      (student.curriculum_type as 'cbc' | '8-4-4' | 'igcse') ?? 'cbc'
    )

    const { data: saved } = await db
      .from('compass_outcomes')
      .insert({
        student_id:       studentId,
        subject:          outcome.subject,
        concept:          outcome.concept,
        substrand:        outcome.substrand,
        mastery_statement: outcome.masteryStatement,
        mastery_evidence: outcome.masteryEvidence,
        milestones:       outcome.milestones,
        status:           'in_progress',
        set_by:           'learner',
        sessions_spent:   0,
        last_attempted:   new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()

    return apiSuccess({ outcome: { ...outcome, id: saved?.id ?? outcome.id } })
  } catch (error) {
    console.error('[outcome/generate] Error:', error)
    return apiError('Failed to generate outcome', 500)
  }
}
